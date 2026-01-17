/**
 * =================================================================
 * MIDI PROCESSOR: PROBECHO (Polyrhythmic Arpeggiator V27)
 * =================================================================
 * * DESCRIPTION:
 * A "100% Wet" MIDI echo engine triggered upon key release.
 * Each note generates its own independent delay line, enabling
 * complex polyrhythmic textures and Looper-style behaviors.
 *
 * INLETS:
 * 0: [list] MIDI Input [pitch, velocity].
 * 1: [int/list] Messages (probability, limit) or Intervals (e.g., 4 7 12).
 * 2: [int] Vel Modulation (Offset applied to the initial velocity).
 * 3: [list] Delays & Speeds [BaseTime(ms), Speed1, Speed2...].
 * 4: [int] Feedback (0-100) - Exponential curve.
 *
 * OUTLETS:
 * 0: [list] MIDI Output [pitch, velocity].
 * 1: [int] Voice Monitor (Number of active voices).
 *
 * SPECIAL COMMANDS (Inlet 1):
 * - probability [0-100] : Mix between sequential and random modes.
 * - limit [N]           : Max number of repetitions per note.
 * - Double-click C7(108): PANIC (Global Reset).
 *
 * =================================================================
 */

inlets = 5;
outlets = 2;

// --- GLOBAL PARAMETERS ---
var intervalList = [0];   
var coeffList = [1];        
var baseDelay = 100;        
var velMod = 0;
var feedback = 0; 
var probValue = 0;          
var MAX_POLYPHONY = 128; 
var SAFE_MIN_DELAY = 10;    
var maxStepsPerNote = 128; 

// Pending areas for quantized updates
var pendingIntervalList = null;
var pendingCoeffList = null;
var pendingBaseDelay = null;

// System management
var activeSequences = []; 
var noteMemory = {}; 
var totalActiveVoices = 0; 
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

// --- CONTROL FUNCTIONS (INLET 1) ---
function probability(v) { probValue = Math.max(0, Math.min(v, 100)); }
function limit(v) { maxStepsPerNote = Math.max(1, v); }

// --- UTILITIES ---
function foldNote(value) {
    var min = 21, max = 108;
    var current = value;
    while (current < min || current > max) {
        if (current > max) current = max - (current - max);
        else if (current < min) current = min + (min - current);
    }
    return Math.floor(current);
}

function updateMonitor() { outlet(1, totalActiveVoices); }

function applyPendingUpdates() {
    if (pendingIntervalList !== null) { intervalList = pendingIntervalList; pendingIntervalList = null; }
    if (pendingCoeffList !== null) { coeffList = pendingCoeffList; pendingCoeffList = null; }
    if (pendingBaseDelay !== null) { baseDelay = pendingBaseDelay; pendingBaseDelay = null; }
}

function panic() {
    activeSequences.forEach(function(s) { if(s.task) s.task.cancel(); });
    activeSequences = [];
    for (var n = 0; n <= 127; n++) outlet(0, n, 0);
    noteMemory = {};
    totalActiveVoices = 0;
    updateMonitor();
    post("PROBECHO PANIC\n");
}

// --- INTEGER INPUT HANDLING ---
function msg_int(v) {
    switch (inlet) {
        case 2: velMod = v; break; 
        case 3: pendingBaseDelay = Math.max(20, v); pendingCoeffList = [1]; break;
        case 4: feedback = Math.max(0, Math.min(v, 100)); break;
    }
}

// --- LIST HANDLING ---
function list() {
    var args = Array.prototype.slice.call(arguments);
    if (inlet === 1) {
        intervalList = args;
    } else if (inlet === 3) {
        pendingBaseDelay = Math.max(20, args[0]);
        pendingCoeffList = (args.length > 1) ? args.slice(1) : [1];
    } else if (inlet === 0) {
        processMidi(args);
    }
}

/**
 * REPETITION ENGINE (Autonomous Sequencer)
 */
function sequenceTick() {
    var self = arguments.callee.task.parent;
    applyPendingUpdates();

    if (totalActiveVoices >= MAX_POLYPHONY) {
        arguments.callee.task.schedule(baseDelay);
        return;
    }

    var pLen = intervalList.length;
    var cLen = coeffList.length;
    var pIdx, cIdx;
    
    // Probabilistic selection logic
    pIdx = (Math.random() * 100 < probValue) ? Math.floor(Math.random() * pLen) : self.stepCount % pLen;
    cIdx = (Math.random() * 100 < probValue) ? Math.floor(Math.random() * cLen) : self.stepCount % cLen;

    var outP = foldNote(self.originPitch + intervalList[pIdx]);
    var outV = Math.floor(self.currentVel);
    
    // Inverse Speed Logic (2 = 2x faster)
    var currentSpeed = Math.max(0.01, coeffList[cIdx]);
    var currentStepDelay = Math.max(SAFE_MIN_DELAY, baseDelay / currentSpeed);
    var currentStepGate = self.originalGate / currentSpeed;

    if (outV >= 1) {
        outlet(0, outP, outV);
        totalActiveVoices++;
        updateMonitor();

        var pToOff = outP;
        var offT = new Task(function() { 
            outlet(0, pToOff, 0); 
            totalActiveVoices = Math.max(0, totalActiveVoices - 1);
            updateMonitor();
        });
        offT.schedule(Math.min(currentStepGate, currentStepDelay - 2));
    }

    self.stepCount++;

    // Exponential feedback curve (0.7) for musical decay
    var exaggeratedFeedback = Math.pow(feedback / 100, 0.7); 
    self.currentVel = self.currentVel * exaggeratedFeedback;

    if (self.currentVel > 0.05 && self.stepCount < maxStepsPerNote) {
        arguments.callee.task.schedule(currentStepDelay);
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
 * LIVE MIDI RECEPTION
 */
function processMidi(args) {
    var p = args[0], v = args[1];
    var now = Date.now();

    if (v > 0) { // NOTE ON
        if (p === PANIC_NOTE) {
            if (now - lastPanicNoteTime < 250) { panic(); return; }
            lastPanicNoteTime = now;
        }
        noteMemory[p] = { vel: v, startTime: now };
    } else { // NOTE OFF
        if (noteMemory[p]) {
            applyPendingUpdates();
            var gateTime = now - noteMemory[p].startTime;
            var initialVel = Math.max(0.1, (noteMemory[p].vel + velMod));

            var newSeq = {
                id: Math.random(),
                originPitch: p,
                currentVel: initialVel,
                originalGate: gateTime,
                stepCount: 0 
            };
            
            newSeq.task = new Task(sequenceTick, newSeq);
            newSeq.task.parent = newSeq;
            activeSequences.push(newSeq);

            // First delay based on the first speed coefficient in the list
            var firstSpeed = Math.max(0.01, coeffList[0]);
            var firstDelay = Math.max(SAFE_MIN_DELAY, baseDelay / firstSpeed);
            newSeq.task.schedule(firstDelay); 
            
            delete noteMemory[p];
        }
    }
}