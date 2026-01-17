/**
 * =================================================================
 * PROCESSEUR MIDI : RIPPLES (ONDES SYMÉTRIQUES)
 * =================================================================
 * * * FONCTIONNALITÉS :
 * - Mode : 100% Wet.
 * - Concept : La note originale est le pivot. À chaque écho, deux notes
 * s'éloignent (l'une monte, l'autre descend) d'un demi-ton.
 * - Rebond : Utilise le Folding entre 21 (La 0) et 107 (Sib 6).
 * - Auto-Panic : Si la note 108 (C7) est jouée 2 fois en moins de 250ms.
 * - Cycle : Le déclenchement est consécutif au Note Off de l'originale.
 * =================================================================
 *** PARAMETRES :
 * - Inlet 1 : MIDI Live (Note & Vel). Définit le pivot et la durée.
 * - Inlet 2 : Vel Modulation, Correction de gain initiale.
 * - Inlet 3 : Delay Time, Vitesse de propagation de l'onde (ms).
 * - Inlet 4 : Feedback, Persistance de l'onde (%).
 * =================================================================
 */

inlets = 4;
outlets = 1;

// --- PARAMÈTRES ---
var velMod = 0;
var delayTime = 100; 
var feedback = 0;    

// --- SYSTÈME ---
var startTime = {};   
var noteMemory = {};  
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
 * MOTEUR D'ONDE (RIPPLE)
 */
function runRipple(pivot, step, v, d) {
    // Calcul de l'expansion symétrique
    var noteUp = foldNote(pivot + step);
    var noteDown = foldNote(pivot - step);

    // Émission du couple de notes
    outlet(0, noteUp, v);
    outlet(0, noteDown, v);

    // Note Off groupé après la durée mémorisée
    var offTask = new Task(function() {
        outlet(0, noteUp, 0);
        outlet(0, noteDown, 0);
    });
    offTask.schedule(d);
    activeTasks.push(offTask);

    // Calcul de la persistance (Feedback)
    var nextVel = Math.floor(v * (feedback / 100));

    if (nextVel > 2) {
        var nextStepTask = new Task(function() {
            // Expansion d'un demi-ton supplémentaire au prochain cycle
            runRipple(pivot, step + 1, nextVel, d);
        });
        nextStepTask.schedule(delayTime);
        activeTasks.push(nextStepTask);
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
                // Enregistrement du pivot
                startTime[p] = Date.now();
                noteMemory[p] = Math.max(1, Math.min(v + velMod, 127));

            } else {
                // --- NOTE OFF ---
                if (startTime[p] !== undefined) {
                    var duration = Date.now() - startTime[p];
                    var initialVel = noteMemory[p];

                    if (delayTime >= 20) {
                        // L'onde démarre après le Note Off, au premier palier (step 1)
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