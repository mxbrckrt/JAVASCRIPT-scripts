/**
 * =================================================================
 * PROCESSEUR MIDI : ARPÉGIATEUR COMPLEXE
 * =================================================================.
 * Arpegiateur complexe avec un modèle a rebonds, avancement pas à pas en boucle, delay, feedback et repartition de dynamique de delais dans le temps.
 * =================================================================
 * * * FONCTIONNALITÉS :
 * - Mode : 100% Wet (Note originale muette)
 * - Folding Pitch : Entre 21 (La 0) et 108 (Do 7).
 * - Auto-Panic : Note 108 (C7), double-frappe < 250ms.
 * =================================================================. 
 *** PARAMETRES :
 * - Inlet 1 : MIDI Live,Note & Vélocité. Déclenche le cycle de délai.
 * - Inlet 2 : liste d'intervalles appliquée a la note (appliquée avant le premier écho).
 * - Inlet 3 : Vel Modulation,Correction de gain sur la vélocité initiale.
 * - Inlet 4 : Delay Time,Temps d'attente. Sécurité matérielle fixée à 20ms minimum.
 * - Inlet 5 : Feedback,0% = 1 seule répétition. >0% = répétitions multiples.
 * - Outlet 2 : nombre de voies de polyphonies utilisées.
 * - Message [spread] : repartition des delais : -100 a 0 = ritardandos, 0 = delais inchangés, 0 a 100 = accelerandos.
 * =================================================================
 */

inlets = 5;
outlets = 2;

// --- PARAMÈTRES ---
var intervalList = [0];   
var velMod = 0;
var delayTime = 100;      
var feedback = 0; 
var spreadValue = 0;      
var MAX_SEQUENCES = 16;   
var MAX_POLYPHONY = 64;   

// --- SYSTÈME ---
var activeSequences = []; 
var noteMemory = {};
var totalActiveVoices = 0; 
var lastPanicNoteTime = 0;
var PANIC_NOTE = 108;

function foldNote(value) {
    var min = 21, max = 108;
    var current = value;
    while (current < min || current > max) {
        if (current > max) current = max - (current - max);
        else if (current < min) current = min + (min - current);
    }
    return Math.floor(current);
}

function spread(v) { spreadValue = Math.max(-100, Math.min(100, v)); }

function updateMonitor() { 
    outlet(1, totalActiveVoices); 
}

function msg_int(v) {
    switch (inlet) {
        case 2: velMod = v; break;
        case 3: delayTime = Math.max(20, v); break;
        case 4: feedback = Math.max(0, Math.min(v, 100)); break;
    }
}

function list() {
    if (inlet === 1) intervalList = Array.prototype.slice.call(arguments);
    else if (inlet === 0) processMidi(arguments);
}

function panic() {
    activeSequences.forEach(function(s) { if(s.task) s.task.cancel(); });
    activeSequences = [];
    for (var n = 0; n <= 127; n++) outlet(0, n, 0);
    noteMemory = {};
    totalActiveVoices = 0;
    updateMonitor();
    
    // Ajout du print dans la Max Window
    post("ARPECHO PANIC\n");
}

/**
 * MOTEUR DE SÉQUENCE (CORRIGÉ)
 */
function sequenceTick() {
    var self = arguments.callee.task.parent;
    
    // Protection polyphonie
    if (totalActiveVoices >= MAX_POLYPHONY) {
        self.index++;
        arguments.callee.task.schedule(self.currentDelay);
        return;
    }

    var idx = self.index % intervalList.length;
    var outP = foldNote(self.originPitch + intervalList[idx]);
    var outV = Math.max(1, Math.min(self.currentVel + velMod, 127));

    // Note ON
    outlet(0, outP, outV);
    totalActiveVoices++;
    updateMonitor();

    // Stockage pour le Note Off
    var pToOff = outP;

    // Task de Note Off
    var offT = new Task(function() { 
        outlet(0, pToOff, 0); 
        totalActiveVoices = Math.max(0, totalActiveVoices - 1);
        updateMonitor();
    });
    offT.schedule(self.currentDelay * 0.8);

    // Évolution
    self.index++;
    var stepChange = (delayTime * (spreadValue / 500));
    self.currentDelay = Math.max(20, Math.min(3000, self.currentDelay - stepChange));

    if (self.index % intervalList.length === 0) {
        self.currentVel = Math.floor(self.currentVel * (feedback / 100));
    }

    if (self.currentVel > 2) {
        arguments.callee.task.schedule(self.currentDelay);
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

function processMidi(args) {
    var p = args[0], v = args[1];
    if (v > 0) {
        if (p === PANIC_NOTE) {
            var ct = Date.now();
            if (ct - lastPanicNoteTime < 250) { panic(); return; }
            lastPanicNoteTime = ct;
        }

        while (activeSequences.length >= MAX_SEQUENCES) {
            var old = activeSequences.shift();
            old.task.cancel();
        }

        var newSeq = {
            id: Math.random(),
            originPitch: p,
            currentVel: v,
            currentDelay: delayTime,
            index: 0
        };
        
        newSeq.task = new Task(sequenceTick, newSeq);
        newSeq.task.parent = newSeq;
        activeSequences.push(newSeq);
        newSeq.task.schedule(delayTime);
    } else {
        // Note Off manuel : On envoie juste le 0 sur le pitch d'origine
        outlet(0, p, 0); 
    }
}