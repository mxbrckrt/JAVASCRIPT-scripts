/**
 * =================================================================
 * MIDI PROCESSOR: DYNAMIC CHORDS
 * =================================================================
 * Generates chords based on a root fundamental note.
 * =================================================================
 * * * FEATURES:
 * - Mode: 100% Wet (Original note is muted)
 * - Pitch Folding: Between 21 (A0) and 108 (C7).
 * - Auto-Panic: Triggers if note 108 (C7) is played twice in < 250ms.
 * =================================================================
 * *** PARAMETERS:
 * - Inlet 1: MIDI Live (Note & Velocity). Triggers the chord.
 * - Inlet 2: Interval list applied to the note. Recalculated dynamically.
 * - Inlet 3: Vel Modulation, gain correction on the initial velocity.
 * =================================================================
 */

inlets = 3;
outlets = 1;

// --- GLOBAL VARIABLES ---
var intervals = [0];
var velMod = 0;
var noteMemory = {};      // Maps input note to its specific generated chord
var activeNoteCount = [];  // Instance counter for each MIDI note (0-127)
var globalVoiceStack = []; // For Voice Stealing (tracks activation order)
var MAX_TOTAL_VOICES = 32; // Physical polyphony limit

var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

// Initialize counter for all 128 MIDI notes
for (var k = 0; k < 128; k++) {
    activeNoteCount[k] = 0;
}

/**
 * Pitch Folding Function
 */
function fold(value, min, max) {
    var current = value;
    while (current < min || current > max) {
        if (current > max) current = max - (current - max);
        if (current < min) current = min + (min - current);
    }
    return Math.floor(current);
}

/**
 * Panic Function: Mutes all notes and resets counters
 */
function panic() {
    for (var i = 0; i <= 127; i++) {
        outlet(0, i, 0);
        activeNoteCount[i] = 0;
    }
    noteMemory = {};
    globalVoiceStack = [];
    post("FRACTALS PANIC\n");
}

function msg_int(v) {
    if (inlet == 2) velMod = v;
}

function list() {
    // Handle Interval List input
    if (inlet == 1) {
        intervals = Array.prototype.slice.call(arguments);
    }
    
    // Handle MIDI input (Note/Vel)
    if (inlet == 0) {
        if (arguments.length >= 2) {
            var basePitch = arguments[0];
            var baseVel = arguments[1];

            if (baseVel > 0) {
                // --- AUTO-PANIC DETECTION ---
                if (basePitch === PANIC_NOTE) {
                    var currentTime = Date.now();
                    if (currentTime - lastPanicNoteTime < 250) {
                        panic();
                        return; 
                    }
                    lastPanicNoteTime = currentTime;
                }

                // --- NOTE ON LOGIC ---
                var output = [];
                var currentChord = [];

                for (var i = 0; i < intervals.length; i++) {
                    // Apply folding between 21 and 108 for pitch
                    var p = fold(basePitch + intervals[i], 21, 108);
                    // Apply velocity modulation and fold between 1 and 127
                    var v = fold(baseVel + velMod, 1, 127);
                    
                    currentChord.push(p);

                    // VOICE STEALING
                    // If polyphony limit reached, kill the oldest note in the stack
                    if (activeNoteCount[p] === 0) {
                        while (globalVoiceStack.length >= MAX_TOTAL_VOICES) {
                            var oldestNote = globalVoiceStack.shift();
                            if (activeNoteCount[oldestNote] > 0) {
                                outlet(0, [oldestNote, 0]);
                                activeNoteCount[oldestNote] = 0;
                            }
                        }
                        
                        output.push(p, v);
                        globalVoiceStack.push(p); // Add to active voice stack
                    }
                    activeNoteCount[p]++;
                }
                
                noteMemory[basePitch] = currentChord;
                // Output the chord as a list for [zl iter 2]
                if (output.length > 0) outlet(0, output);

            } else {
                // --- NOTE OFF LOGIC ---
                if (noteMemory[basePitch] !== undefined) {
                    var notesToOff = noteMemory[basePitch];
                    var offOutput = [];

                    for (var j = 0; j < notesToOff.length; j++) {
                        var pOff = notesToOff[j];
                        
                        if (activeNoteCount[pOff] > 0) {
                            activeNoteCount[pOff]--;

                            // Only send Note Off if all instances of this pitch are released
                            if (activeNoteCount[pOff] <= 0) {
                                activeNoteCount[pOff] = 0; 
                                offOutput.push(pOff, 0);
                                
                                // Remove from the globalVoiceStack tracking
                                var idx = globalVoiceStack.indexOf(pOff);
                                if (idx !== -1) globalVoiceStack.splice(idx, 1);
                            }
                        }
                    }

                    if (offOutput.length > 0) outlet(0, offOutput);
                    delete noteMemory[basePitch];
                }
            }
        }
    }
}