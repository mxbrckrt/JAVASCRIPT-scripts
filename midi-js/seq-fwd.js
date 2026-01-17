/**
 * =================================================================
 * PROCESSEUR MIDI : SÉQUENCEUR CYCLIQUE
 * =================================================================.
 * Step Sequencer : Avancement pas à pas en boucle.
 * =================================================================
 * * * FONCTIONNALITÉS :
 * - Mode : 100% Wet (Note originale muette)
 * - Folding Pitch : Entre 21 (La 0) et 108 (Do 7).
 * - Auto-Panic : Note 108 (C7), double-frappe < 250ms.
 * =================================================================
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
var stepIndex = 0;
var velMod = 0;
var noteMemory = {};
var activeNoteCount = [];

// Variables pour la détection du Panic (Note 108 / C7)
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

// Initialisation des compteurs d'instances MIDI
for (var k = 0; k < 128; k++) {
    activeNoteCount[k] = 0;
}

/**
 * FONCTION DE REPLIEMENT (FOLDING)
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
 * FONCTION RESET
 */
function reset() {
    stepIndex = 0;
    post("Séquenceur réinitialisé au pas 1.\n");
}

/**
 * FONCTION PANIC
 * Envoie vélocité 0 aux 128 notes et réinitialise la mémoire.
 */
function panic() {
    for (var i = 0; i <= 127; i++) {
        outlet(0, i, 0);
        activeNoteCount[i] = 0;
    }
    noteMemory = {};
    stepIndex = 0;
    post("SEQ-FWD PANIC");
}

/**
 * GESTION DES ENTIERS (Inlets 2 et 3)
 */
function msg_int(v) {
    if (inlet == 2) velMod = v;
    if (inlet == 1) {
        intervals = [v];
        stepIndex = 0;
    }
}

/**
 * GESTION DES MESSAGES LISTES (Inlets 1 et 2)
 */
function list() {
    // Mise à jour de la séquence
    if (inlet == 1) {
        intervals = Array.prototype.slice.call(arguments);
        stepIndex = 0; 
    }
    
    // Entrée MIDI Live
    if (inlet == 0) {
        if (arguments.length >= 2) {
            var inputPitch = arguments[0];
            var inputVel = arguments[1];

            if (inputVel > 0) {
                // --- DÉTECTION AUTO-PANIC (C8 / 120 répétée) ---
                if (inputPitch === PANIC_NOTE) {
                    var currentTime = Date.now();
                    if (currentTime - lastPanicNoteTime < 250) {
                        panic();
                        return; // On stoppe l'exécution pour ne pas générer de note
                    }
                    lastPanicNoteTime = currentTime;
                }

                // --- LOGIQUE NOTE ON SÉQUENCEUR ---
                var currentShift = intervals[stepIndex];
                var outputPitch = foldNote(inputPitch + currentShift);
                
                // Mémorisation du pitch de sortie pour le futur Note Off
                noteMemory[inputPitch] = outputPitch;
                
                // Incrément cyclique de la séquence
                stepIndex = (stepIndex + 1) % intervals.length;

                // Sortie avec gestion des doublons
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

                    // On n'envoie le Note Off réel que si aucune autre instance n'est active
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