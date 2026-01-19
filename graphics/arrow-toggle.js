/**
 * @file arrow_toggle_pro_final.js
 * @description Professional JSUI Toggle with rotatable line/arrow and state-dependent styling.
 * Supports independent colors for background, border, and text for both ON/OFF states.
 * 
 * Author Max Bruckert
 */

mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;
outlets = 2; // Outlet 0: Toggle Value (0/1), Outlet 1: Parameter Dump

// --- ATTRIBUTES DECLARATION ---

// Toggle State
var val = 0;
function set_val(v) { 
    val = (v > 0) ? 1 : 0; 
    notifyclients(); 
    outlet(0, val); 
    mgraphics.redraw(); 
}
function get_val() { return val; }
declareattribute("val", "get_val", "set_val", 1, { category: "Interaction", label: "Value", type: "int" });

// Label Text
var labelON = "ON";
function set_labelON(t) { labelON = t.toString(); notifyclients(); mgraphics.redraw(); }
function get_labelON() { return labelON; }
declareattribute("labelON", "get_labelON", "set_labelON", 1, { category: "Labels", label: "Text ON" });

var labelOFF = "OFF";
function set_labelOFF(t) { labelOFF = t.toString(); notifyclients(); mgraphics.redraw(); }
function get_labelOFF() { return labelOFF; }
declareattribute("labelOFF", "get_labelOFF", "set_labelOFF", 1, { category: "Labels", label: "Text OFF" });

// Rotation Logic
var direction = 90;
function set_direction(v) { direction = v; notifyclients(); mgraphics.redraw(); }
function get_direction() { return direction; }
declareattribute("direction", "get_direction", "set_direction", 1, { category: "Geometry", label: "Global Rotation" });

var lineOffset = 0;
function set_lineOffset(v) { lineOffset = v; notifyclients(); mgraphics.redraw(); }
function get_lineOffset() { return lineOffset; }
declareattribute("lineOffset", "get_lineOffset", "set_lineOffset", 1, { category: "Geometry", label: "Line Angle Offset" });

// Line & Arrow Styling
var L_length = 200;
function set_L_length(v) { L_length = v; notifyclients(); mgraphics.redraw(); }
function get_L_length() { return L_length; }
declareattribute("L_length", "get_L_length", "set_L_length", 1, { category: "Geometry", label: "Line Length (px)" });

var L_thick = 2;
function set_L_thick(v) { L_thick = v; notifyclients(); mgraphics.redraw(); }
function get_L_thick() { return L_thick; }
declareattribute("L_thick", "get_L_thick", "set_L_thick", 1, { category: "Geometry", label: "Line Thickness" });

var arrowSize = 6;
function set_arrowSize(v) { arrowSize = v; notifyclients(); mgraphics.redraw(); }
function get_arrowSize() { return arrowSize; }
declareattribute("arrowSize", "get_arrowSize", "set_arrowSize", 1, { category: "Geometry", label: "Arrow Head Size" });

// Rectangle & Font Styling
var roundVal = 0;
function set_roundVal(v) { roundVal = v; notifyclients(); mgraphics.redraw(); }
function get_roundVal() { return roundVal; }
declareattribute("roundVal", "get_roundVal", "set_roundVal", 1, { category: "Styling", label: "Corner Roundness" });

var myFontSize = 14;
function set_myFontSize(v) { myFontSize = v; notifyclients(); mgraphics.redraw(); }
function get_myFontSize() { return myFontSize; }
declareattribute("myFontSize", "get_myFontSize", "set_myFontSize", 1, { category: "Styling", label: "Font Size" });

var myFont = "Arial";
function set_myFont(v) { myFont = v.toString(); notifyclients(); mgraphics.redraw(); }
function get_myFont() { return myFont; }
declareattribute("myFont", "get_myFont", "set_myFont", 1, { category: "Styling", label: "Font Name" });

// COLOR ATTRIBUTES

var colorON = [0.0, 0.8, 0.0, 1.0];
function set_colorON() { colorON = arrayfromargs(arguments); notifyclients(); mgraphics.redraw(); }
function get_colorON() { return colorON; }
declareattribute("colorON", "get_colorON", "set_colorON", 1, { category: "Colors", label: "Line/Stroke ON", type: "rgba" });

var colorOFF = [0.5, 0.5, 0.5, 1.0];
function set_colorOFF() { colorOFF = arrayfromargs(arguments); notifyclients(); mgraphics.redraw(); }
function get_colorOFF() { return colorOFF; }
declareattribute("colorOFF", "get_colorOFF", "set_colorOFF", 1, { category: "Colors", label: "Line/Stroke OFF", type: "rgba" });

var colorBG = [0.0, 0.0, 0.0, 1.0];
function set_colorBG() { colorBG = arrayfromargs(arguments); notifyclients(); mgraphics.redraw(); }
function get_colorBG() { return colorBG; }
declareattribute("colorBG", "get_colorBG", "set_colorBG", 1, { category: "Colors", label: "JSUI Background", type: "rgba" });

var colorRectON = [0.1, 0.3, 0.1, 1.0];
function set_colorRectON() { colorRectON = arrayfromargs(arguments); notifyclients(); mgraphics.redraw(); }
function get_colorRectON() { return colorRectON; }
declareattribute("colorRectON", "get_colorRectON", "set_colorRectON", 1, { category: "Colors", label: "Rect Fill ON", type: "rgba" });

var colorRectOFF = [0.2, 0.2, 0.2, 1.0];
function set_colorRectOFF() { colorRectOFF = arrayfromargs(arguments); notifyclients(); mgraphics.redraw(); }
function get_colorRectOFF() { return colorRectOFF; }
declareattribute("colorRectOFF", "get_colorRectOFF", "set_colorRectOFF", 1, { category: "Colors", label: "Rect Fill OFF", type: "rgba" });

var colorTextON = [1.0, 1.0, 1.0, 1.0];
function set_colorTextON() { colorTextON = arrayfromargs(arguments); notifyclients(); mgraphics.redraw(); }
function get_colorTextON() { return colorTextON; }
declareattribute("colorTextON", "get_colorTextON", "set_colorTextON", 1, { category: "Colors", label: "Text Color ON", type: "rgba" });

var colorTextOFF = [0.8, 0.8, 0.8, 1.0];
function set_colorTextOFF() { colorTextOFF = arrayfromargs(arguments); notifyclients(); mgraphics.redraw(); }
function get_colorTextOFF() { return colorTextOFF; }
declareattribute("colorTextOFF", "get_colorTextOFF", "set_colorTextOFF", 1, { category: "Colors", label: "Text Color OFF", type: "rgba" });

// --- INTERNAL LOGIC ---

var cachedRectW = 50;
var cachedRectH = 20;

function msg_int(v) { set_val(v); }

/** Export all current parameters */
function dump() {
    var attrs = ["val", "labelON", "labelOFF", "direction", "lineOffset", "L_length", "L_thick", "arrowSize", "roundVal", "myFontSize", "myFont", "colorON", "colorOFF", "colorBG", "colorRectON", "colorRectOFF", "colorTextON", "colorTextOFF"];
    for (var i=0; i<attrs.length; i++) {
        outlet(1, attrs[i], eval(attrs[i]));
    }
}

/** Pattr standard support */
function getvalueof() { return val; }
function setvalueof(v) { set_val(v); }

/** Rounded rectangle utility */
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

/** Paint Scene */
function paint() {
    var w = mgraphics.size[0];
    var h = mgraphics.size[1];
    
    // UI Background
    mgraphics.set_source_rgba(colorBG);
    mgraphics.rectangle(0, 0, w, h);
    mgraphics.fill();

    // Measurement
    mgraphics.select_font_face(myFont);
    mgraphics.set_font_size(myFontSize);
    var currentLabel = (val === 1) ? labelON : labelOFF;
    var textMeas = mgraphics.text_measure(currentLabel);
    
    cachedRectW = textMeas[0] + 24; 
    cachedRectH = myFontSize + 16;
    var safeRound = Math.min(roundVal, cachedRectH/2);

    mgraphics.save();
    mgraphics.translate(w/2, h/2);
    
    // State Colors
    var currentStroke = (val === 1) ? colorON : colorOFF;
    var currentFill = (val === 1) ? colorRectON : colorRectOFF;
    var currentTextColor = (val === 1) ? colorTextON : colorTextOFF;

    // --- Line & Arrow ---
    mgraphics.save();
    mgraphics.rotate((direction + lineOffset - 90) * Math.PI / 180);
    mgraphics.set_source_rgba(currentStroke);
    mgraphics.set_line_width(L_thick);
    
    mgraphics.move_to(-L_length/2, 0);
    mgraphics.line_to(-cachedRectW/2, 0);
    mgraphics.stroke();
    mgraphics.move_to(cachedRectW/2, 0);
    mgraphics.line_to(L_length/2, 0);
    mgraphics.stroke();

    mgraphics.move_to(L_length/2 - arrowSize, -arrowSize/1.2);
    mgraphics.line_to(L_length/2, 0);
    mgraphics.line_to(L_length/2 - arrowSize, arrowSize/1.2);
    mgraphics.stroke();
    mgraphics.restore();

    // --- Rectangle & Label ---
    mgraphics.save();
    mgraphics.rotate((direction - 90) * Math.PI / 180);
    
    // Rect Fill
    drawRoundedRect(-cachedRectW/2, -cachedRectH/2, cachedRectW, cachedRectH, safeRound);
    mgraphics.set_source_rgba(currentFill);
    mgraphics.fill();
    
    // Rect Stroke
    drawRoundedRect(-cachedRectW/2, -cachedRectH/2, cachedRectW, cachedRectH, safeRound);
    mgraphics.set_source_rgba(currentStroke);
    mgraphics.set_line_width(1.5);
    mgraphics.stroke();
    
    // Text Label
    mgraphics.set_source_rgba(currentTextColor);
    mgraphics.move_to(-textMeas[0]/2, myFontSize/2.8);
    mgraphics.show_text(currentLabel);
    mgraphics.restore();

    mgraphics.restore();
}

/** Click Handling */
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