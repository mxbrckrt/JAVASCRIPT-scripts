mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;
outlets = 2; 

// --- ATTRIBUTS ET MÉTADONNÉES ---

// État (val)
var val = 0;
function set_val(v) { 
    val = v > 0 ? 1 : 0; 
    notifyclients(); // Important pour pattr
    outlet(0, val); 
    mgraphics.redraw(); 
}
function get_val() { return val; }
declareattribute("val", "get_val", "set_val", 1);

// Textes
var labelON = "ON";
function set_labelON(t) { labelON = t.toString(); mgraphics.redraw(); }
function get_labelON() { return labelON; }
declareattribute("labelON", "get_labelON", "set_labelON", 1);

var labelOFF = "OFF";
function set_labelOFF(t) { labelOFF = t.toString(); mgraphics.redraw(); }
function get_labelOFF() { return labelOFF; }
declareattribute("labelOFF", "get_labelOFF", "set_labelOFF", 1);

// Géométrie
var direction = 90;
function set_direction(v) { direction = v; mgraphics.redraw(); }
function get_direction() { return direction; }
declareattribute("direction", "get_direction", "set_direction", 1);

var lineOffset = 0;
function set_lineOffset(v) { lineOffset = v; mgraphics.redraw(); }
function get_lineOffset() { return lineOffset; }
declareattribute("lineOffset", "get_lineOffset", "set_lineOffset", 1);

var L_length = 200;
function set_L_length(v) { L_length = v; mgraphics.redraw(); }
function get_L_length() { return L_length; }
declareattribute("L_length", "get_L_length", "set_L_length", 1);

var L_thick = 2;
function set_L_thick(v) { L_thick = v; mgraphics.redraw(); }
function get_L_thick() { return L_thick; }
declareattribute("L_thick", "get_L_thick", "set_L_thick", 1);

var arrowSize = 8; // Taille de la flèche réduite
function set_arrowSize(v) { arrowSize = v; mgraphics.redraw(); }
function get_arrowSize() { return arrowSize; }
declareattribute("arrowSize", "get_arrowSize", "set_arrowSize", 1);

// Styling
var roundVal = 0;
function set_roundVal(v) { roundVal = v; mgraphics.redraw(); }
function get_roundVal() { return roundVal; }
declareattribute("roundVal", "get_roundVal", "set_roundVal", 1);

var myFontSize = 14;
function set_myFontSize(v) { myFontSize = v; mgraphics.redraw(); }
function get_myFontSize() { return myFontSize; }
declareattribute("myFontSize", "get_myFontSize", "set_myFontSize", 1);

var myFont = "Arial";
function set_myFont(v) { myFont = v.toString(); mgraphics.redraw(); }
function get_myFont() { return myFont; }
declareattribute("myFont", "get_myFont", "set_myFont", 1);

// Couleurs (Les getters retournent la liste)
var colorON = [0.0, 0.8, 0.0, 1.0];
function set_colorON() { colorON = arrayfromargs(arguments); mgraphics.redraw(); }
function get_colorON() { return colorON; }
declareattribute("colorON", "get_colorON", "set_colorON", 1);

var colorOFF = [0.5, 0.5, 0.5, 1.0];
function set_colorOFF() { colorOFF = arrayfromargs(arguments); mgraphics.redraw(); }
function get_colorOFF() { return colorOFF; }
declareattribute("colorOFF", "get_colorOFF", "set_colorOFF", 1);

var colorBG = [0.0, 0.0, 0.0, 1.0];
function set_colorBG() { colorBG = arrayfromargs(arguments); mgraphics.redraw(); }
function get_colorBG() { return colorBG; }
declareattribute("colorBG", "get_colorBG", "set_colorBG", 1);

var colorRect = [0.2, 0.2, 0.2, 1.0];
function set_colorRect() { colorRect = arrayfromargs(arguments); mgraphics.redraw(); }
function get_colorRect() { return colorRect; }
declareattribute("colorRect", "get_colorRect", "set_colorRect", 1);

// --- LOGIQUE ---

var cachedRectW = 50;
var cachedRectH = 20;

function msg_int(v) { set_val(v); }

function dump() {
    var attrs = ["val", "labelON", "labelOFF", "direction", "lineOffset", "L_length", "L_thick", "arrowSize", "roundVal", "myFontSize", "myFont", "colorON", "colorOFF", "colorBG", "colorRect"];
    for (var i=0; i<attrs.length; i++) {
        outlet(1, attrs[i], eval(attrs[i]));
    }
}

function drawRoundedRect(x, y, w, h, r) {
    if (r <= 0) { mgraphics.rectangle(x, y, w, h); return; }
    var degrees = Math.PI / 180;
    mgraphics.new_path();
    mgraphics.arc(x + r, y + r, r, 180 * degrees, 270 * degrees);
    mgraphics.arc(x + w - r, y + r, r, -90 * degrees, 0 * degrees);
    mgraphics.arc(x + w - r, y + h - r, r, 0 * degrees, 90 * degrees);
    mgraphics.arc(x + r, y + h - r, r, 90 * degrees, 180 * degrees);
    mgraphics.close_path();
}

function paint() {
    var w = mgraphics.size[0];
    var h = mgraphics.size[1];
    
    mgraphics.set_source_rgba(colorBG);
    mgraphics.rectangle(0, 0, w, h);
    mgraphics.fill();

    mgraphics.select_font_face(myFont);
    mgraphics.set_font_size(myFontSize);
    var currentLabel = (val === 1) ? labelON : labelOFF;
    var textMeas = mgraphics.text_measure(currentLabel);
    
    cachedRectW = textMeas[0] + 24; 
    cachedRectH = myFontSize + 16;
    var safeRound = Math.min(roundVal, cachedRectH/2);

    mgraphics.save();
    mgraphics.translate(w/2, h/2);
    
    // --- Ligne et Flèche (Offset) ---
    mgraphics.save();
    mgraphics.rotate((direction + lineOffset - 90) * Math.PI / 180);
    var currentColor = (val === 1) ? colorON : colorOFF;
    mgraphics.set_source_rgba(currentColor);
    mgraphics.set_line_width(L_thick);
    
    mgraphics.move_to(-L_length/2, 0);
    mgraphics.line_to(-cachedRectW/2, 0);
    mgraphics.stroke();
    mgraphics.move_to(cachedRectW/2, 0);
    mgraphics.line_to(L_length/2, 0);
    mgraphics.stroke();

    // Flèche (Taille réduite)
    mgraphics.move_to(L_length/2 - arrowSize, -arrowSize/1.2);
    mgraphics.line_to(L_length/2, 0);
    mgraphics.line_to(L_length/2 - arrowSize, arrowSize/1.2);
    mgraphics.stroke();
    mgraphics.restore();

    // --- Rectangle et Texte (Direction Générale) ---
    mgraphics.save();
    mgraphics.rotate((direction - 90) * Math.PI / 180);
    drawRoundedRect(-cachedRectW/2, -cachedRectH/2, cachedRectW, cachedRectH, safeRound);
    mgraphics.set_source_rgba(colorRect);
    mgraphics.fill();
    drawRoundedRect(-cachedRectW/2, -cachedRectH/2, cachedRectW, cachedRectH, safeRound);
    mgraphics.set_source_rgba(currentColor);
    mgraphics.set_line_width(1.5);
    mgraphics.stroke();
    mgraphics.move_to(-textMeas[0]/2, myFontSize/2.8);
    mgraphics.show_text(currentLabel);
    mgraphics.restore();

    mgraphics.restore();
}

function onclick(x, y) {
    var w = mgraphics.size[0];
    var h = mgraphics.size[1];
    var angleRad = (direction - 90) * Math.PI / 180;
    var dx = x - (w / 2);
    var dy = y - (h / 2);
    var rx = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
    var ry = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);
    
    if (rx >= -cachedRectW/2 && rx <= cachedRectW/2 && ry >= -cachedRectH/2 && ry <= cachedRectH/2) {
        set_val(1 - val);
    }
}

function onresize() { mgraphics.redraw(); }