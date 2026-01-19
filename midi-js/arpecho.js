/**
 * =================================================================
 * MIDI PROCESSOR: COMPLEX ARPEGGIATOR
 * =================================================================
 * Complex arpeggiator featuring a bouncing model, step-by-step looping,
 * delay, feedback, and dynamic time-distribution (spread).
 * =================================================================
 * * * FEATURES:
 * - Mode: 100% Wet (Original note is muted)
 * - Pitch Folding: Between 21 (A0) and 108 (C7).
 * - Auto-Panic: Note 108 (C7), double-tap < 250ms.
 * =================================================================
 * *** PARAMETERS:
 * - Inlet 1: MIDI Live (Note & Velocity). Triggers the delay cycle.
 * - Inlet 2: Interval list applied to the note (applied before the first echo).
 * - Inlet 3: Vel Modulation, gain correction on the initial velocity.
 * - Inlet 4: Delay Time, waiting time. Hardware safety set to 20ms minimum.
 * - Inlet 5: Feedback, 0% = 1 single repetition. >0% = multiple repetitions.
 * - Outlet 2: Number of active polyphony voices.
 * - Message [spread]: Delay distribution: -100 to 0 = ritardandos, 
 * 0 = unchanged delays, 0 to 100 = accelerandos.
 * =================================================================
 */

inlets = 5;
outlets = 2;

// --- PARAMETERS ---
var intervalList = [0];   
var velMod = 0;
var delayTime = 100;      
var feedback = 0; 
var spreadValue = 0;      
var MAX_SEQUENCES = 16;   
var MAX_POLYPHONY = 64;   

// --- SYSTEM ---
var activeSequences = []; 
var noteMemory = {};
var totalActiveVoices = 0; 
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

/**
 * Pitch Folding Logic
 */
function foldNote(value) {
    var min = 21, max = 108;
    var current = value;
    while (current < min || current > max) {
        if (current > max) current = max - (current - max);
        else if (current < min) current = min + (min - current);
    }
    return Math.floor(current);
}

function spread(v) { spreadValue = Math.max(-100, Math.min(100, v)); }

function updateMonitor() { 
    outlet(1, totalActiveVoices); 
}

function msg_int(v) {
    switch (inlet) {
        case 2: velMod = v; break;
        case 3: delayTime = Math.max(20, v); break;
        case 4: feedback = Math.max(0, Math.min(v, 100)); break;
    }
}

function list() {
    if (inlet === 1) intervalList = Array.prototype.slice.call(arguments);
    else if (inlet === 0) processMidi(arguments);
}

/**
 * Panic Function: Clears all tasks and mutes all notes
 */
function panic() {
    activeSequences.forEach(function(s) { if(s.task) s.task.cancel(); });
    activeSequences = [];
    for (var n = 0; n <= 127; n++) outlet(0, n, 0);
    noteMemory = {};
    totalActiveVoices = 0;
    updateMonitor();
    
    // Print to Max Window
    post("ARPECHO PANIC\n");
}

/**
 * SEQUENCE ENGINE
 */
function sequenceTick() {
    var self = arguments.callee.task.parent;
    
    // Polyphony Protection
    if (totalActiveVoices >= MAX_POLYPHONY) {
        self.index++;
        arguments.callee.task.schedule(self.currentDelay);
        return;
    }

    var idx = self.index % intervalList.length;
    var outP = foldNote(self.originPitch + intervalList[idx]);
    var outV = Math.max(1, Math.min(self.currentVel + velMod, 127));

    // Note ON
    outlet(0, outP, outV);
    totalActiveVoices++;
    updateMonitor();

    // Storage for Note Off
    var pToOff = outP;

    // Note Off Task
    var offT = new Task(function() { 
        outlet(0, pToOff, 0); 
        totalActiveVoices = Math.max(0, totalActiveVoices - 1);
        updateMonitor();
    });
    offT.schedule(self.currentDelay * 0.8);

    // Evolution (Time and Velocity)
    self.index++;
    var stepChange = (delayTime * (spreadValue / 500));
    self.currentDelay = Math.max(20, Math.min(3000, self.currentDelay - stepChange));

    if (self.index % intervalList.length === 0) {
        self.currentVel = Math.floor(self.currentVel * (feedback / 100));
    }

    // Recursion: Re-schedule if velocity is audible
    if (self.currentVel > 2) {
        arguments.callee.task.schedule(self.currentDelay);
    } else {
        removeSequence(self.id);
    }
}

function removeSequence(id) {
    for (var i = 0; i < activeSequences.length; i++) {
        if (activeSequences[i].id === id) {
            activeSequences[i].task.cancel();
            activeSequences.splice(i, 1);
            break;
        }
    }
}

/**
 * MIDI Input Handling
 */
function processMidi(args) {
    var p = args[0], v = args[1];
    if (v > 0) {
        // Auto-Panic Detection
        if (p === PANIC_NOTE) {
            var ct = Date.now();
            if (ct - lastPanicNoteTime < 250) { panic(); return; }
            lastPanicNoteTime = ct;
        }

        // Sequence Stealing (Max 16 sequences)
        while (activeSequences.length >= MAX_SEQUENCES) {
            var old = activeSequences.shift();
            old.task.cancel();
        }

        // Create new sequence object
        var newSeq = {
            id: Math.random(),
            originPitch: p,
            currentVel: v,
            currentDelay: delayTime,
            index: 0
        };
        
        newSeq.task = new Task(sequenceTick, newSeq);
        newSeq.task.parent = newSeq;
        activeSequences.push(newSeq);
        newSeq.task.schedule(delayTime);
    } else {
        // Manual Note Off: Mute the original pitch immediately
        outlet(0, p, 0); 
    }
}