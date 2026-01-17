/**
 * =================================================================
 * PROCESSEUR MIDI : DELAY ET FEEDBACK
 * =================================================================
 * * * FONCTIONNALITÉS :
 * - Mode : 100% Wet (Note originale muette)
 * - Folding Pitch : Entre 21 (La 0) et 107 (Sib 6).
 * - Auto-Panic : Si la note 108 (C7) est jouée 2 fois en moins de 250ms.
 * - Premier écho : Toujours présent si Delay Time > 20ms.
 * - Feedback : Contrôle les répétitions suivant le premier écho.
 * - Cycle Temporel : Le calcul et le déclenchement de la première répétition 
 * sont consécutifs au Note Off de la note entrante. La durée de chaque 
 * répétition est égale à la durée de la note originale.
 * =================================================================
 *** PARAMETRES :
 * - Inlet 1 : MIDI Live, Note & Vélocité. Déclenche le cycle de délai.
 * - Inlet 2 : Pitch Shift, Transposition de la note (appliquée avant le premier écho).
 * - Inlet 3 : Vel Modulation, Correction de gain sur la vélocité initiale.
 * - Inlet 4 : Delay Time, Temps d'attente. Sécurité matérielle fixée à 20ms minimum.
 * - Inlet 5 : Feedback, 0% = 1 seule répétition. >0% = répétitions multiples.
 * =================================================================
 */

inlets = 5;
outlets = 1;

// --- PARAMÈTRES PAR DÉFAUT ---
var shiftPitch = 0;
var velMod = 0;
var delayTime = 100; // ms
var feedback = 0;    // %

// --- SYSTÈME ---
var noteMemory = {};  // Stocke le pitch transformé
var startTime = {};   // Stocke le moment du Note On pour calculer la durée
var activeTasks = []; 
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

function foldNote(value) {
    var min = 21, max = 107;
    var current = value;
    while (current < min || current > max) {
        if (current > max) current = max - (current - max);
        else if (current < min) current = min + (min - current);
    }
    return Math.floor(current);
}

function panic() {
    activeTasks.forEach(function(t) { if(t) t.cancel(); });
    activeTasks = [];
    for (var n = 0; n <= 127; n++) outlet(0, n, 0);
    noteMemory = {};
    startTime = {};
    post("SHIFTDELAY PANIC\n");
}

function msg_int(v) {
    switch (inlet) {
        case 1: shiftPitch = v; break;
        case 2: velMod = v; break;
        case 3: delayTime = Math.max(20, v); break;
        case 4: feedback = Math.max(0, Math.min(v, 100)); break;
    }
}

/**
 * MOTEUR D'ÉCHO RÉCURSIF
 * p : pitch, v : vélocité, d : durée originale en ms
 */
function runEcho(p, v, d) {
    // ÉMISSION NOTE ON
    outlet(0, p, v);

    // ÉMISSION NOTE OFF (après la durée exacte d)
    var offTask = new Task(function() {
        outlet(0, p, 0);
    });
    offTask.schedule(d);
    activeTasks.push(offTask);

    // CALCUL DU PROCHAIN ÉCHO
    var nextVel = Math.floor(v * (feedback / 100));

    // On continue tant que la vélocité est significative
    if (nextVel > 2) {
        var nextEchoTask = new Task(function() {
            runEcho(p, nextVel, d);
        });
        nextEchoTask.schedule(delayTime);
        activeTasks.push(nextEchoTask);
    }
}

/**
 * RÉCEPTION MIDI
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

                // On mémorise le début de la note et sa transformation
                startTime[p] = Date.now();
                noteMemory[p] = {
                    pitch: foldNote(p + shiftPitch),
                    velocity: Math.max(1, Math.min(v + velMod, 127))
                };

            } else {
                // --- NOTE OFF ---
                if (startTime[p] !== undefined) {
                    // Calcul de la durée de pression
                    var duration = Date.now() - startTime[p];
                    var m = noteMemory[p];

                    // Déclenchement de la cascade d'échos après le Note Off
                    if (delayTime >= 20) {
                        var firstEchoTask = new Task(function() {
                            runEcho(m.pitch, m.velocity, duration);
                        });
                        firstEchoTask.schedule(delayTime);
                        activeTasks.push(firstEchoTask);
                    }

                    // Nettoyage
                    delete startTime[p];
                    delete noteMemory[p];
                }
            }
        }
    }
}