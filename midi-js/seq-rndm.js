/**
 * =================================================================
 * MIDI PROCESSOR: RANDOM SEQUENCER
 * =================================================================
 * Step Sequencer: Randomized step progression with possible repetitions.
 * =================================================================
 * * * FEATURES:
 * - Mode: 100% Wet (Original note is muted).
 * - Pitch Folding: Between 21 (A0) and 108 (C7).
 * - Auto-Panic: Note 108 (C7), double-tap < 250ms.
 * =================================================================
 * *** PARAMETERS:
 * - Inlet 1: MIDI Live [Pitch, Velocity].
 * - Inlet 2: Step List (Sequence pool).
 * - Inlet 3: Velocity Modulation.
 * =================================================================
 */

inlets = 3;
outlets = 1;

// --- GLOBAL VARIABLES ---
var intervals = [0];    
var velMod = 0;         
var noteMemory = {};    
var activeNoteCount = []; 

// Panic Detection Variables (Note 108 / C7)
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

// Initialize MIDI instance counters (0-127)
for (var k = 0; k < 128; k++) {
    activeNoteCount[k] = 0;
}

/**
 * PITCH FOLDING LOGIC
 * Bound between 21 (low) and 108 (high).
 */
function foldNote(value) {
    var min = 21;
    var max = 108;
    var current = value;
    
    while (current < min || current > max) {
        if (current > max) {
            current = max - (current - max);
        } else if (current < min) {
            current = min + (min - current);
        }
    }
    return Math.floor(current);
}

/**
 * PANIC FUNCTION: Mutes all notes and clears memory
 */
function panic() {
    for (var i = 0; i <= 127; i++) {
        outlet(0, i, 0);
        activeNoteCount[i] = 0;
    }
    noteMemory = {};
    post("SEQ-RNDM PANIC\n");
}

/**
 * HANDLE INTEGERS
 */
function msg_int(v) {
    if (inlet == 2) velMod = v;
    if (inlet == 1) intervals = [v];
}

/**
 * HANDLE LIST MESSAGES
 */
function list() {
    // Update the interval pool
    if (inlet == 1) {
        intervals = Array.prototype.slice.call(arguments);
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
                        return; 
                    }
                    lastPanicNoteTime = currentTime;
                }

                // --- RANDOM NOTE ON LOGIC ---
                var randomIndex = Math.floor(Math.random() * intervals.length);
                var chosenInterval = intervals[randomIndex];
                
                // Apply folding logic
                var outputPitch = foldNote(inputPitch + chosenInterval);
                
                // Store output pitch for correct Note Off mapping
                noteMemory[inputPitch] = outputPitch;

                // Handle duplicates to prevent hung notes
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

                    // Only send Note Off if no other instances of this pitch are active
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