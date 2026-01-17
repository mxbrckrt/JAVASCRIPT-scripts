/**
 * =================================================================
 * PROCESSEUR MIDI : ACCORDS DYNAMIQUES.
 * =================================================================
 * Genere des accords en rapport avec une note fondamentale.
 * =================================================================
 * * * FONCTIONNALITÉS :
 * - Mode : 100% Wet (Note originale muette)
 * - Folding Pitch : Entre 21 (La 0) et 108 (Do 7).
 * - Auto-Panic : Si la note 108 (C7) est jouée 2 fois en moins de 250ms.
 * =================================================================
 *** PARAMETRES :
 * - Inlet 1 : MIDI Live,Note & Vélocité. Déclenche l'accord.
 * - Inlet 2 : liste d'intervalles appliquée a la note. Recalculée dynamiquement selon le nombre valeurs.
 * - Inlet 3 : Vel Modulation, Correction de gain sur la vélocité initiale.
 * =================================================================
 */

inlets = 3;
outlets = 1;

// --- VARIABLES GLOBALES ---
var intervals = [0];
var velMod = 0;
var noteMemory = {};    
var activeNoteCount = []; 
var globalVoiceStack = []; // Pour le Voice Stealing (suit l'ordre d'activation)
var MAX_TOTAL_VOICES = 32; // Limite physique de polyphonie

var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

for (var k = 0; k < 128; k++) {
    activeNoteCount[k] = 0;
}

function fold(value, min, max) {
    var current = value;
    while (current < min || current > max) {
        if (current > max) current = max - (current - max);
        if (current < min) current = min + (min - current);
    }
    return Math.floor(current);
}

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
    if (inlet == 1) {
        intervals = Array.prototype.slice.call(arguments);
    }
    
    if (inlet == 0) {
        if (arguments.length >= 2) {
            var basePitch = arguments[0];
            var baseVel = arguments[1];

            if (baseVel > 0) {
                // --- DÉTECTION AUTO-PANIC ---
                if (basePitch === PANIC_NOTE) {
                    var currentTime = Date.now();
                    if (currentTime - lastPanicNoteTime < 250) {
                        panic();
                        return; 
                    }
                    lastPanicNoteTime = currentTime;
                }

                // --- LOGIQUE NOTE ON ---
                var output = [];
                var currentChord = [];

                for (var i = 0; i < intervals.length; i++) {
                    var p = fold(basePitch + intervals[i], 21, 108);
                    var v = fold(baseVel + velMod, 1, 127);
                    
                    currentChord.push(p);

                    // VOICE STEALING
                    // Si on dépasse la polyphonie, on éteint la note la plus ancienne du stack
                    if (activeNoteCount[p] === 0) {
                        while (globalVoiceStack.length >= MAX_TOTAL_VOICES) {
                            var oldestNote = globalVoiceStack.shift();
                            if (activeNoteCount[oldestNote] > 0) {
                                outlet(0, [oldestNote, 0]);
                                activeNoteCount[oldestNote] = 0;
                            }
                        }
                        
                        output.push(p, v);
                        globalVoiceStack.push(p); // Ajoute au stack des notes actives
                    }
                    activeNoteCount[p]++;
                }
                
                noteMemory[basePitch] = currentChord;
                if (output.length > 0) outlet(0, output);

            } else {
                // --- LOGIQUE NOTE OFF ---
                if (noteMemory[basePitch] !== undefined) {
                    var notesToOff = noteMemory[basePitch];
                    var offOutput = [];

                    for (var j = 0; j < notesToOff.length; j++) {
                        var pOff = notesToOff[j];
                        
                        if (activeNoteCount[pOff] > 0) {
                            activeNoteCount[pOff]--;

                            if (activeNoteCount[pOff] <= 0) {
                                activeNoteCount[pOff] = 0; 
                                offOutput.push(pOff, 0);
                                
                                // Retirer de la pile globalVoiceStack
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