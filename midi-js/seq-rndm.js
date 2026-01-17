/**
 * =================================================================
 * PROCESSEUR MIDI : SÉQUENCEUR ALÉATOIRE
 * =================================================================
 * Step Sequencer : Avancement random pas à pas en boucle avec repetitions possibles.
 * =================================================================
 * * * FONCTIONNALITÉS :
 * - Mode : 100% Wet (Note originale muette)
 * - Folding Pitch : Entre 21 (La 0) et 108 (Do 7).
 * - Auto-Panic : Note 108 (C7), double-frappe < 250ms.
 * =================================================================.
 *** PARAMETRES :
 * - Inlet 1 : MIDI Live [Pitch, Velocity].
 * - Inlet 2 : Liste de pas (Séquence).
 * - Inlet 3 : Modulation Vélocité.
 * =================================================================
 */

inlets = 3;
outlets = 1;

// --- VARIABLES GLOBALES ---
var intervals = [0];    
var velMod = 0;         
var noteMemory = {};    
var activeNoteCount = []; 

// Variables pour la détection du Panic (Note 108 / C7)
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

// Initialisation du compteur pour les 128 notes MIDI
for (var k = 0; k < 128; k++) {
    activeNoteCount[k] = 0;
}

/**
 * FONCTION DE REPLIEMENT (FOLDING)
 * Ajustée pour les bornes 21 (bas) et 108 (haut).
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
 * FONCTION PANIC
 */
function panic() {
    for (var i = 0; i <= 127; i++) {
        outlet(0, i, 0);
        activeNoteCount[i] = 0;
    }
    noteMemory = {};
    post("SEQ-RNDM PANIC");
}

/**
 * GESTION DES ENTIERS
 */
function msg_int(v) {
    if (inlet == 2) velMod = v;
    if (inlet == 1) intervals = [v];
}

/**
 * GESTION DES MESSAGES LISTES
 */
function list() {
    if (inlet == 1) {
        intervals = Array.prototype.slice.call(arguments);
    }
    
    if (inlet == 0) {
        if (arguments.length >= 2) {
            var inputPitch = arguments[0];
            var inputVel = arguments[1];

            if (inputVel > 0) {
                // --- DÉTECTION AUTO-PANIC ---
                if (inputPitch === PANIC_NOTE) {
                    var currentTime = Date.now();
                    if (currentTime - lastPanicNoteTime < 250) {
                        panic();
                        return; 
                    }
                    lastPanicNoteTime = currentTime;
                }

                // --- LOGIQUE NOTE ON ---
                var randomIndex = Math.floor(Math.random() * intervals.length);
                var chosenInterval = intervals[randomIndex];
                
                // Application du repliement entre 21 et 108
                var outputPitch = foldNote(inputPitch + chosenInterval);
                
                noteMemory[inputPitch] = outputPitch;

                if (activeNoteCount[outputPitch] === 0) {
                    var v = Math.max(1, Math.min(inputVel + velMod, 127));
                    outlet(0, outputPitch, v);
                }
                activeNoteCount[outputPitch]++; 

            } else {
                // --- LOGIQUE NOTE OFF ---
                if (noteMemory[inputPitch] !== undefined) {
                    var outPitch = noteMemory[inputPitch];
                    
                    activeNoteCount[outPitch]--;

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