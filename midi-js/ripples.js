/**
 * =================================================================
 * MIDI PROCESSOR: RIPPLES (SYMMETRICAL WAVES)
 * =================================================================
 * * * FEATURES:
 * - Mode: 100% Wet.
 * - Concept: The original note acts as a pivot. With each echo, two notes 
 * expand outwards (one up, one down) by one semitone.
 * - Rebound: Uses Pitch Folding between 21 (A0) and 107 (Bb6).
 * - Auto-Panic: If note 108 (C7) is played twice in < 250ms.
 * - Cycle: Triggering is consecutive to the original note's Note Off.
 * =================================================================
 *** PARAMETERS:
 * - Inlet 1: MIDI Live (Note & Vel). Defines pivot and duration.
 * - Inlet 2: Vel Modulation, initial gain correction.
 * - Inlet 3: Delay Time, wave propagation speed (ms).
 * - Inlet 4: Feedback, wave persistence/distance (%).
 * =================================================================
 */

inlets = 4;
outlets = 1;

// --- PARAMETERS ---
var velMod = 0;
var delayTime = 100; 
var feedback = 0;    

// --- SYSTEM ---
var startTime = {};   
var noteMemory = {};  
var activeTasks = []; 
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

/**
 * Pitch Folding Logic
 */
function foldNote(value) {
    var min = 21, max = 107;
    var current = value;
    while (current < min || current > max) {
        if (current > max) current = max - (current - max);
        else if (current < min) current = min + (min - current);
    }
    return Math.floor(current);
}

/**
 * Panic Function: Clears all tasks and mutes all MIDI notes
 */
function panic() {
    activeTasks.forEach(function(t) { if(t) t.cancel(); });
    activeTasks = [];
    for (var n = 0; n <= 127; n++) outlet(0, n, 0);
    startTime = {};
    noteMemory = {};
    post("RIPPLES PANIC\n");
}

function msg_int(v) {
    switch (inlet) {
        case 1: velMod = v; break;
        case 2: delayTime = Math.max(20, v); break;
        case 3: feedback = Math.max(0, Math.min(v, 100)); break;
    }
}

/**
 * RIPPLE ENGINE
 * pivot: center note, step: distance from pivot, v: velocity, d: duration
 */
function runRipple(pivot, step, v, d) {
    // Calculate symmetrical expansion
    var noteUp = foldNote(pivot + step);
    var noteDown = foldNote(pivot - step);

    // Emit note pair
    outlet(0, noteUp, v);
    outlet(0, noteDown, v);

    // Grouped Note Off after the memorized duration (d)
    var offTask = new Task(function() {
        outlet(0, noteUp, 0);
        outlet(0, noteDown, 0);
    });
    offTask.schedule(d);
    activeTasks.push(offTask);

    // Persistence calculation (Feedback)
    var nextVel = Math.floor(v * (feedback / 100));

    if (nextVel > 2) {
        var nextStepTask = new Task(function() {
            // Expand by one additional semitone in the next cycle
            runRipple(pivot, step + 1, nextVel, d);
        });
        nextStepTask.schedule(delayTime);
        activeTasks.push(nextStepTask);
    }
}

/**
 * MIDI INPUT HANDLING
 */
function list() {
    if (inlet == 0) {
        if (arguments.length >= 2) {
            var p = arguments[0];
            var v = arguments[1];
            
            if (v > 0) {
                // --- NOTE ON ---
                if (p === PANIC_NOTE) {
                    var ct = Date.now();
                    if (ct - lastPanicNoteTime < 250) { panic(); return; }
                    lastPanicNoteTime = ct;
                }
                // Store pivot timing and initial velocity
                startTime[p] = Date.now();
                noteMemory[p] = Math.max(1, Math.min(v + velMod, 127));

            } else {
                // --- NOTE OFF ---
                if (startTime[p] !== undefined) {
                    // Calculate press duration
                    var duration = Date.now() - startTime[p];
                    var initialVel = noteMemory[p];

                    if (delayTime >= 20) {
                        // Wave starts after Note Off, at the first step
                        var firstRippleTask = new Task(function() {
                            runRipple(p, 1, initialVel, duration);
                        });
                        firstRippleTask.schedule(delayTime);
                        activeTasks.push(firstRippleTask);
                    }
                    
                    delete startTime[p];
                    delete noteMemory[p];
                }
            }
        }
    }
}