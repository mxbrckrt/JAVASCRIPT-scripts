/**
 * =================================================================
 * MIDI PROCESSOR: CYCLIC SEQUENCER
 * =================================================================.
 * Step Sequencer: Step-by-step looping progression.
 * =================================================================
 * * * FEATURES:
 * - Mode: 100% Wet (Original note is muted).
 * - Pitch Folding: Between 21 (A0) and 108 (C7).
 * - Auto-Panic: Note 108 (C7), double-tap < 250ms.
 * =================================================================
 * *** PARAMETERS:
 * - Inlet 1: MIDI Live [Pitch, Velocity].
 * - Inlet 2: Step List (Sequence).
 * - Inlet 3: Velocity Modulation.
 * =================================================================
 */

inlets = 3;
outlets = 1;

// --- GLOBAL VARIABLES ---
var intervals = [0];
var stepIndex = 0;
var velMod = 0;
var noteMemory = {};
var activeNoteCount = [];

// Panic Detection Variables (Note 108 / C7)
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

// Initialize MIDI instance counters
for (var k = 0; k < 128; k++) {
    activeNoteCount[k] = 0;
}

/**
 * PITCH FOLDING LOGIC
 */
function foldNote(value) {
    var min = 21;
    var max = 108;
    var current = value;
    while (current < min || current > max) {
        if (current > max) current = max - (current - max);
        else if (current < min) current = min + (min - current);
    }
    return Math.floor(current);
}

/**
 * RESET FUNCTION
 */
function reset() {
    stepIndex = 0;
    post("Sequencer reset to step 1.\n");
}

/**
 * PANIC FUNCTION
 * Sends velocity 0 to all 128 notes and resets memory.
 */
function panic() {
    for (var i = 0; i <= 127; i++) {
        outlet(0, i, 0);
        activeNoteCount[i] = 0;
    }
    noteMemory = {};
    stepIndex = 0;
    post("SEQ-FWD PANIC\n");
}

/**
 * HANDLE INTEGERS (Inlets 2 and 3)
 */
function msg_int(v) {
    if (inlet == 2) velMod = v;
    if (inlet == 1) {
        intervals = [v];
        stepIndex = 0;
    }
}

/**
 * HANDLE LIST MESSAGES (Inlets 1 and 2)
 */
function list() {
    // Update the sequence
    if (inlet == 1) {
        intervals = Array.prototype.slice.call(arguments);
        stepIndex = 0; 
    }
    
    // MIDI Live Input
    if (inlet == 0) {
        if (arguments.length >= 2) {
            var inputPitch = arguments[0];
            var inputVel = arguments[1];

            if (inputVel > 0) {
                // --- AUTO-PANIC DETECTION ---
                if (inputPitch === PANIC_NOTE) {
                    var currentTime = Date.now();
                    if (currentTime - lastPanicNoteTime < 250) {
                        panic();
                        return; // Stop execution to prevent note generation
                    }
                    lastPanicNoteTime = currentTime;
                }

                // --- SEQUENCER NOTE ON LOGIC ---
                var currentShift = intervals[stepIndex];
                var outputPitch = foldNote(inputPitch + currentShift);
                
                // Store output pitch for future Note Off
                noteMemory[inputPitch] = outputPitch;
                
                // Cyclic sequence increment
                stepIndex = (stepIndex + 1) % intervals.length;

                // Output handling with duplicate management
                if (activeNoteCount[outputPitch] === 0) {
                    var v = Math.max(1, Math.min(inputVel + velMod, 127));
                    outlet(0, outputPitch, v);
                }
                activeNoteCount[outputPitch]++;

            } else {
                // --- NOTE OFF LOGIC ---
                if (noteMemory[inputPitch] !== undefined) {
                    var outPitch = noteMemory[inputPitch];
                    activeNoteCount[outPitch]--;

                    // Only send real Note Off if no other instances are active
                    if (activeNoteCount[outPitch] <= 0) {
                        activeNoteCount[outPitch] = 0;
                        outlet(0, outPitch, 0);
                    }
                    delete noteMemory[inputPitch];
                }
            }
        }
    }
}