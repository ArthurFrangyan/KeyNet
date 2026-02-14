const fs = require('fs');
const path = require('path');

// --- Configuration ---
const keymapPath = path.join(__dirname, 'keymaps', 'default', 'keymap.c');
const qwertyPath = path.join(__dirname, 'assets', 'layouts', 'source', 'Qwerty.js');
const outputDir = path.join(__dirname, 'assets', 'layouts', 'source');

// --- Helper: Parse KLE Data ---
function parseKLE(content) {
    const safeContent = `[${content.trim()}]`;
    try {
        return new Function(`return ${safeContent}`)();
    } catch (e) {
        console.error("Error parsing Qwerty.js:", e);
        process.exit(1);
    }
}

// --- Helper: Stringify KLE Data (Unquoted keys) ---
function stringifyKLE(rows) {
    const formatValue = (v) => {
        if (typeof v === 'string') return JSON.stringify(v);
        if (Array.isArray(v)) return `[${v.join(',')}]`;
        return v;
    };
    
    const formatObj = (obj) => {
        const props = Object.entries(obj).map(([k, v]) => `${k}:${formatValue(v)}`).join(',');
        return `{${props}}`;
    };

    return rows.map(row => {
        const items = row.map(item => {
            if (typeof item === 'string') return JSON.stringify(item);
            return formatObj(item);
        });
        return `[${items.join(',')}]`;
    }).join(',\n');
}

// --- Helper: Parse Keymap.c Layers ---
function parseKeymap(rawContent) {
    const layers = {};
    const content = rawContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); 
    const cleanContent = content.replace(/\r\n/g, '\n');

    const startRegex = /\[_(\w+)\]\s*=\s*LAYOUT\s*\(/g;
    let match;
    while ((match = startRegex.exec(cleanContent)) !== null) {
        const layerName = match[1];
        const startIndex = match.index + match[0].length;
        let parenDepth = 1;
        let i = startIndex;
        let currentKey = '';
        const keys = [];
        let keyParenDepth = 0; 
        while (i < cleanContent.length && parenDepth > 0) {
            const char = cleanContent[i];
            if (char === '(') { parenDepth++; keyParenDepth++; currentKey += char; }
            else if (char === ')') {
                parenDepth--;
                if (parenDepth === 0) { if (currentKey.trim()) keys.push(currentKey.trim()); break; }
                keyParenDepth--;
                currentKey += char;
            } else if (char === ',' && keyParenDepth === 0) {
                if (currentKey.trim()) keys.push(currentKey.trim());
                currentKey = '';
            } else { currentKey += char; }
            i++;
        }
        layers[layerName] = keys.filter(k => k);
    }
    return layers;
}

// --- Helper: Normalize Visual Label for Mapping ---
function normalizeVisual(str) {
    if (!str) return "TRNS"; 
    
    // Explicit overrides
    if (str === 'Qwerty' || str === 'Layer') return 'LAYER_LABEL';

    if (str.includes('🔘') && str.includes('Vertical')) return 'KNOB_0';
    if (str.includes('🔘') && str.includes('Horizontal')) return 'KNOB_1';

    if (str.includes('Arrows-Up') && str.includes('Z')) return 'Z';
    if (str.includes('Arrows-Up') && str.includes('X')) return 'X';
    
    if (str.includes('Arrows-Down') && str.includes('Space')) return 'SPC';
    if (str.includes('Arrows-Up') && str.includes('Space')) return 'SPC';
    if (str.includes('BackSpace') || str.includes('DeleteLeft')) return 'BSPC';
    
    if (str.includes('Arrows-Down') && str.includes(',')) return 'COMM';
    if (str.includes('Arrows-Up') && str.includes('.')) return 'DOT';
    if (str.includes('Arrows-Down') && str.includes('C')) return 'C'; 
    
    if (str.includes("'") && str.includes('"')) return 'QUOT';
    if (str === '= +') return 'EQL';
    
    if (str.includes('3') && str.includes('#')) return '3';
    if (str.includes('8') && str.includes('*')) return '8';
    if (str.includes('2') && str.includes('@')) return '2';
    if (str.includes('9') && str.includes('(')) return '9';
    if (str.includes('4') && str.includes('$')) return '4';
    if (str.includes('7') && str.includes('&')) return '7';
    if (str.includes('5') && str.includes('%')) return '5';
    if (str.includes('6') && str.includes('^')) return '6';
    if (str.includes('1') && str.includes('!')) return '1';
    if (str.includes('0') && str.includes(')')) return '0';
    if (str.includes('`') && str.includes('~')) return 'GRV';
    if (str.includes('-') && str.includes('_')) return 'MINS';
    
    if (str.includes('[') && str.includes('{')) return 'LBRC';
    if (str.includes(']') && str.includes('}')) return 'RBRC';
    if (str.includes(';') && str.includes(':')) return 'SCLN';
    if (str.includes("'") && str.includes('"')) return 'QUOT';
    if (str.includes(',') && str.includes('<')) return 'COMM';
    if (str.includes('.') && str.includes('>')) return 'DOT';
    if (str.includes('/') && str.includes('?')) return 'SLSH';
    if (str.includes('\\') && str.includes('|')) return 'BSLS';
    
    if (str.includes('LShift') && str.includes('F')) return 'F';
    if (str.includes('RShift') && str.includes('J')) return 'J';
    if (str.includes('LCtrl') && str.includes('D')) return 'D';
    if (str.includes('RCtrl') && str.includes('K')) return 'K';
    if (str.includes('LAlt') && str.includes('S')) return 'S';
    if (str.includes('RAlt') && str.includes('L')) return 'L';
    if (str.includes('LWin') && str.includes('A')) return 'A';
    if (str.includes('RWin') && (str.includes(':') || str.includes(';'))) return 'SCLN';
    if (str.includes('Fn') && str.includes('V')) return 'V';
    if (str.includes('Set') && str.includes('Tab')) return 'TAB';
    if (str.includes('Shift') && str.includes('Del')) return 'DEL';
    
    if (str.includes('Swap') && str.includes('Enter')) return 'ENT';
    if (str.includes('RRez') && str.includes('Bksp')) return 'BSPC';
    if (str.includes('C-Left')) return 'C_LEFT';
    if (str.includes('C-Right')) return 'C_RGHT';
    
    if (str.includes('Caps')) return 'CAPS';
    if (str.includes('Tab')) return 'TAB';
    if (str.includes('Del')) return 'DEL';
    if (str.includes('Esc')) return 'ESC';
    if (str.includes('Enter')) return 'ENT';
    if (str.includes('Menu R')) return 'MENU_R';
    if (str.includes('Menu')) return 'MENU';
    if (str.includes('LShift')) return 'LSFT';
    if (str.includes('RShift')) return 'RSFT';
    if (str.includes('LAlt')) return 'LALT';
    if (str.includes('RAlt')) return 'RALT';
    if (str.includes('LCtrl')) return 'LCTL';
    if (str.includes('RCtrl')) return 'RCTL';
    if (str.includes('LWin')) return 'LWIN';
    if (str.includes('RWin')) return 'RWIN';
    
    if (str.includes('Adj') && str.includes('C')) return 'C';
    
    return str.split('(')[0].trim().replace('_T', '').replace(/_/g, '');
}

// --- Helper: Get Base Keycode for Mapping Logic ---
function getKeycodeBase(kc) {
    let s = kc.replace(/^KC_/, '').replace('KC_', '');
    if (s === 'ESC_M_') return 'ESC';
    if (s.endsWith('_')) return s.slice(0, -1); 
    if (s === 'TAB_SET') return 'TAB';
    if (s === 'SPC_LOW') return 'SPC';
    if (s === 'SPC_REZ') return 'SPC';
    if (s === 'ENT_SWP') return 'ENT';
    if (s === 'BSPC_RREZ') return 'BSPC';
    if (s === 'DEL_RSFT') return 'DEL';
    if (s === 'C_LEFT') return 'C_LEFT';
    if (s === 'C_RGHT') return 'C_RGHT';
    if (s === 'MKC_00') return 'MKC_00';
    if (s === 'C_') return 'C';
    if (s === 'Z_') return 'Z';
    if (s === 'X_') return 'X';
    if (s === 'V_') return 'V';
    if (s === 'QUOT_') return 'QUOT';
    if (s === 'SCLN_') return 'SCLN';
    
    if (s === 'D_') return 'D';
    if (s === 'K_') return 'K';
    if (s === 'S_') return 'S';
    if (s === 'L_') return 'L';
    if (s === 'F_') return 'F';
    if (s === 'J_') return 'J';
    if (s === 'A_') return 'A';
    
    if (s === 'XXXXXXX' || s === '_______') return 'TRNS';
    if (s.includes('(')) {
        const parts = s.split('(');
        const args = parts[1].replace(')', '').split(',').map(x=>x.trim());
        if (args.length > 0) return args[args.length-1].replace(/^KC_/, '');
    }
    return s;
}

// --- Helper: Check if Keycode is "Shifted" (for visual placement) ---
function isShiftedKey(keycode) {
    let s = keycode.trim().replace(/^KC_/, '');
    const shifted = [
        'TILD', 'EXLM', 'AT', 'HASH', 'DLR', 'PERC', 'CIRC', 'AMPR', 'ASTR', 
        'LPRN', 'RPRN', 'UNDS', 'PLUS', 'LCBR', 'RCBR', 'PIPE', 'COLN', 
        'DQUO', 'QUES', 'LT', 'GT'
    ];
    if (s === 'PAST' || s === 'PPLS') return false; 
    return shifted.includes(s);
}

// --- Helper: Format Label for Output (Friendly Names) ---
function getFriendlyName(keycode) {
    let label = keycode.trim();
    if (label === '_______' || label === 'XXXXXXX') return "";
    
    label = label.replace(/^KC_/, '').replace(/_KC_/, '_').replace(/KC_/g, '');
    
    if (label.includes('(')) {
         const match = label.match(/^(\w+)\((.+)\)$/);
        if (match) {
             const args = match[2].split(',').map(s => s.trim());
             return getFriendlyName(args[args.length-1]);
        }
    }
    
    if (label.endsWith('_')) label = label.slice(0, -1);

    const replacements = {
        'LCTL': 'LCtrl', 'RCTL': 'RCtrl', 'LSFT': 'LShift', 'RSFT': 'RShift',
        'LALT': 'LAlt', 'RALT': 'RAlt', 'LWIN': 'LWin', 'RWIN': 'RWin',
        'BSPC': 'Bksp', 'DEL': 'Del', 'ESC': 'Esc', 'ENT': 'Enter', 'SPC': 'Space',
        'MINS': '-', 'EQL': '=', 'LBRC': '[', 'RBRC': ']', 'BSLS': '\\',
        'SCLN': ';', 'QUOT': "'", 'GRV': '`', 'COMM': ',', 'DOT': '.', 'SLSH': '/',
        'LEFT': "<i class='fa fa-arrow-left'></i>", 
        'RGHT': "<i class='fa fa-arrow-right'></i>", 
        'UP': "<i class='fa fa-arrow-up'></i>", 
        'DOWN': "<i class='fa fa-arrow-down'></i>",
        'C_LEFT': 'Ctrl+←', 'C_RGHT': 'Ctrl+→',
        'PGUP': 'PgUp', 'PGDN': 'PgDn', 'HOME': 'Home', 'END': 'End', 'INS': 'Ins', 'PSCR': 'PrtSc',
        'EXLM': '!', 'AT': '@', 'HASH': '#', 'DLR': '$', 'PERC': '%',
        'CIRC': '^', 'AMPR': '&', 'ASTR': '*', 'LPRN': '(', 'RPRN': ')',
        'UNDS': '_', 'PLUS': '+', 'LCBR': '{', 'RCBR': '}', 'PIPE': '|',
        'TILD': '~', 'COLN': ':', 'DQUO': '"', 'QUES': '?',
        'NO': '', 'TRNS': '',
        'MPLY': 'Play', 'MUTE': 'Mute', 'VOLU': 'Vol+', 'VOLD': 'Vol-',
        '00': '00', 'PDOT': '.', 'TAB': 'Tab', 'CAPS': 'Caps', 'MENU': 'Menu',
        'TAB_SET': 'Tab', 'SPC_LOW': 'Space', 'ENT_SWP': 'Enter', 'BSPC_RREZ': 'Bksp', 'SPC_REZ': 'Space', 'DEL_RSFT': 'Del', 'ESC_M': 'Esc',
        'PMNS': '-', 'PPLS': '+', 'PAST': '*', 'PSLS': '/', 'PENT': 'Enter',
        'P1': '1', 'P2': '2', 'P3': '3', 'P4': '4', 'P5': '5', 
        'P6': '6', 'P7': '7', 'P8': '8', 'P9': '9', 'P0': '0', 'PCMM': ',',
        'MKC_00': '00', 'M00': '00',
        'CngLngU': 'Change Lang ↑', 'CngLngD': 'Change Lang ↓', 'CngLngG': 'Change Lang Global',
        'NUMPAD': 'Num Pad', 'GEMINI': 'Gemini', 'QWERTY': 'Qwerty', 'GAME': 'Game',
        'BRUSH': 'Brush', 'LOWER_F': 'Lower', 'RAISE_F': 'Raise',
        'GAME_R': 'Game R', 'GAME_2': 'Game 2', 'GAME_X': 'Game X', 'PAD': 'Pad',
        'QK_BOOT': 'Boot',
        // Preserving Original Keycodes
        'EC_NORM': 'EC_NORM', 'EC_SWAP': 'EC_SWAP', 
        'NK_OFF': 'NK_OFF', 'NK_ON': 'NK_ON'
    };
    
    if (replacements[label]) {
        let res = replacements[label];
        if (res === 'Bksp') return "<i class='kb kb-Unicode-BackSpace-DeleteLeft-Big'></i>";
        return res;
    }
    
    let result = label.startsWith('_') ? label.substring(1) : label;
    
    // Sanitize - and _ for generic names
    if (result !== '-' && result !== '_') {
        result = result.replace(/-/g, ' ').replace(/_/g, ' ');
    }
    
    return result;
}

// --- Helper: Get Shifted Symbol for Primary Key ---
function getShiftedSymbol(primaryKey) {
    const map = {
        '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
        '-': '_', '=': '+',
        '[': '{', ']': '}', '\\': '|',
        ';': ':', "'": '"',
        ',': '<', '.': '>', '/': '?',
        '`': '~'
    };
    return map[primaryKey];
}

// --- Helper: Convert Label to Icon if Applicable ---
function toIconOrLabel(label) {
    if (label.toLowerCase() === 'lower') return "<i class='kb kb-Arrows-Down-Circle-Filled'></i>";
    if (label.toLowerCase() === 'raise') return "<i class='kb kb-Arrows-Up-Circle-Filled'></i>";
    if (label.toLowerCase() === 'adjust') return "<i class='kb kb-Arrows-Up-Circle-Filled'></i>+<i class='kb kb-Arrows-Down-Circle-Filled'></i>";
    return label;
}

// --- Helper: Get Hold Legend Color ---
function getHoldColor(holdLabel) {
    const lower = holdLabel.toLowerCase();
    if (lower === 'lower') return '#3b93c5'; 
    if (lower === 'raise') return '#b81b24'; 
    if (lower === 'menu') return '#147745';  
    return '#0000ff'; // Default Blue
}

// --- Helper: Get Knob Function String ---
function getKnobFunction(knobIndex, layerName) {
    const layer = layerName.toUpperCase();
    if (knobIndex === 0) { // Left (Vertical)
        if (layer === 'LOWER') return 'Up/Down';
        if (layer === 'RAISE') return 'Bri+/Bri-';
        if (layer === 'MENU') return 'Vol+/Vol-';
        return 'Vertical Scroll';
    } else { // Right (Horizontal)
        if (layer === 'LOWER') return 'Right/Left';
        if (layer === 'MENU') return 'Bri+/Bri-';
        return 'Horizontal Scroll';
    }
}

// --- Helper: Analyze Keycode for Hold/Tap ---
function analyzeKeycode(keycode) {
    let kc = keycode.trim();
    
    if (kc === '_______' || kc === 'XXXXXXX') {
        return { tap: "", hold: null };
    }

    if (kc === 'QUOT_' || kc === 'BSPC_RREZ') {
        return { tap: getFriendlyName(kc), hold: null };
    }

    const holdMacros = {
        'SPC_LOW': { tap: 'Space', hold: 'Lower' },
        'ENT_SWP': { tap: 'Enter', hold: 'Shift' }, 
        'TAB_SET': { tap: 'Tab', hold: 'Set' },
        'SPC_REZ': { tap: 'Space', hold: 'Raise' },
        'SPC_RSFT': { tap: 'Space', hold: 'RShift' },
        'DEL_RSFT': { tap: 'Del', hold: 'Shift' },
        'BSPC_RREZ': { tap: 'Bksp', hold: 'RRez' },
        'BSPC_REZ': { tap: 'Bksp', hold: 'Raise' },
        'F_': { tap: 'F', hold: 'LShift' },
        'D_': { tap: 'D', hold: 'LCtrl' },
        'S_': { tap: 'S', hold: 'LAlt' },
        'A_': { tap: 'A', hold: 'LWin' },
        'J_': { tap: 'J', hold: 'RShift' },
        'K_': { tap: 'K', hold: 'RCtrl' },
        'L_': { tap: 'L', hold: 'RAlt' },
        'SCLN_': { tap: ';', hold: 'RWin' },
        'ESC_M_': { tap: 'Esc', hold: 'Menu' },
        'QUOT_': { tap: "'", hold: 'Menu' },
        'PENT_M': { tap: 'Enter', hold: 'Menu' }, 
        'BSPC_M': { tap: 'Bksp', hold: 'Menu' },
        'V_': { tap: 'V', hold: 'Fn' },
        'Z_': { tap: 'Z', hold: 'Adjust' },
        'X_': { tap: 'X', hold: 'Raise' },
        'C_': { tap: 'C', hold: 'Lower' }, 
        'DOT_': { tap: '.', hold: 'Raise' },
        'COMM_': { tap: ',', hold: 'Lower' },
        'TAB_ALT': { tap: 'Tab', hold: 'LAlt' },
        'BSPC_LALT': { tap: 'Bksp', hold: 'LAlt' }
    };

    if (holdMacros[kc]) return holdMacros[kc];

    if (kc.includes('(')) {
        const match = kc.match(/^(\w+)\((.+)\)$/);
        if (match) {
            const func = match[1];
            const args = match[2].split(',').map(s => s.trim());
            
            if (func === 'LT') {
                const layer = args[0].replace(/^_/, ''); 
                const key = getFriendlyName(args[1]);
                return { tap: key, hold: layer };
            }
            
            if (func === 'MT' || func.endsWith('_T')) {
                let mod = func.endsWith('_T') ? func.replace('_T', '') : args[0];
                let keyArg = func.endsWith('_T') ? args[0] : args[1];
                const niceMod = getFriendlyName(mod).replace('KC_', '');
                const niceKey = getFriendlyName(keyArg);
                return { tap: niceKey, hold: niceMod };
            }
            
            if (func === 'C' || func === 'S' || func === 'A' || func === 'G') {
                 if (kc === 'C(KC_LEFT)') return { tap: 'Ctrl+←', hold: null };
                 if (kc === 'C(KC_RGHT)') return { tap: 'Ctrl+→', hold: null };
            }
        }
    }

    return { tap: getFriendlyName(kc), hold: null };
}

// --- Main ---
function generate() {
    console.log("Reading files...");
    const qwertyRaw = fs.readFileSync(qwertyPath, 'utf8');
    const keymapRaw = fs.readFileSync(keymapPath, 'utf8');
    
    const visualRows = parseKLE(qwertyRaw);
    const layers = parseKeymap(keymapRaw);
    
    // Explicitly add EMPTY layer to generate Empty.js
    layers['EMPTY'] = [];
    
    const sourceLayerName = 'QWERTY';
    if (!layers[sourceLayerName]) { console.error("Missing QWERTY layer"); return; }
    
    const visualKeys = [];
    visualRows.forEach((row, r) => {
        row.forEach((item, c) => {
            if (typeof item === 'string') {
                const norm = normalizeVisual(item);
                let type = 'KEY';
                if (norm === 'KNOB_0') type = 'KNOB_0';
                if (norm === 'KNOB_1') type = 'KNOB_1';
                if (norm === 'LAYER_LABEL') type = 'LAYER_LABEL';
                visualKeys.push({ r, c, label: item, norm, type });
            }
        });
    });
    
    const qwertyLayer = layers[sourceLayerName];
    
    const visualToLayoutMap = new Array(visualKeys.length).fill(-1);
    const usedLayout = new Set();
    
    visualKeys.forEach((v, i) => {
        if (v.type.startsWith('KNOB') || v.type === 'LAYER_LABEL') return; 
        for (let j = 0; j < qwertyLayer.length; j++) {
            if (usedLayout.has(j)) continue;
            const lBase = getKeycodeBase(qwertyLayer[j]);
            if (lBase === v.norm) {
                visualToLayoutMap[i] = j;
                usedLayout.add(j);
                break;
            }
        }
    });
    
    let unmappedCount = 0;
    visualKeys.forEach((v, i) => {
        if (v.type === 'KEY' && visualToLayoutMap[i] === -1) {
            console.log(`Unmapped Visual [${i}]: ${JSON.stringify(v.label)} Norm: ${v.norm}`);
            unmappedCount++;
        }
    });
    
    console.log(`Mapped ${visualKeys.length - unmappedCount} / ${visualKeys.length} keys.`);
    
    for (const [layerName, keycodes] of Object.entries(layers)) {
        const newRows = JSON.parse(JSON.stringify(visualRows));
        
        let flatIndex = 0;
        for (let r = 0; r < newRows.length; r++) {
            for (let c = 0; c < newRows[r].length; c++) {
                if (typeof newRows[r][c] === 'string') {
                    const vKey = visualKeys[flatIndex];
                    let text = "";
                    
                    if (vKey.type === 'LAYER_LABEL') {
                        let niceName = getFriendlyName(layerName);
                        if (niceName === layerName) {
                             niceName = niceName.charAt(0).toUpperCase() + niceName.slice(1).toLowerCase();
                        }
                        text = niceName;
                        newRows[r][c] = text;
                    }
                    else if (vKey.type.startsWith('KNOB')) {
                        const index = vKey.type === 'KNOB_0' ? 0 : 1;
                        const func = getKnobFunction(index, layerName);
                        text = `🔘\n${func}`;
                        
                        let propObj = null;
                        if (c > 0 && typeof newRows[r][c-1] === 'object') {
                            propObj = newRows[r][c-1];
                        } else {
                            propObj = {};
                            newRows[r].splice(c, 0, propObj);
                            c++; 
                        }
                        
                        propObj.fa = [9];
                        newRows[r][c] = text;
                    }
                    else {
                        const layoutIdx = visualToLayoutMap[flatIndex];
                        if (layoutIdx !== -1 && layoutIdx < keycodes.length) {
                            const code = keycodes[layoutIdx];
                            const analysis = analyzeKeycode(code);
                            
                            let propObj = null;
                            if (c > 0 && typeof newRows[r][c-1] === 'object') {
                                propObj = newRows[r][c-1];
                            } else {
                                propObj = {};
                                newRows[r].splice(c, 0, propObj);
                                c++; 
                            }

                            let isColoredBg = false;
                            if (propObj.c) {
                                const cVal = propObj.c.toLowerCase();
                                if (cVal !== '#cccccc' && cVal !== '#ffffff' && cVal !== '#d6d6d6') {
                                    isColoredBg = true;
                                }
                            }

                            const originalLabel = vKey.label;
                            const wasHoldTap = originalLabel.includes('\n');

                            if (layerName === 'QWERTY') {
                                if (analysis.hold) {
                                    let tapLabel = analysis.tap;
                                    const shifted = getShiftedSymbol(tapLabel);
                                    if (shifted) tapLabel = `${tapLabel} ${shifted}`;
                                    
                                    const holdLabel = toIconOrLabel(analysis.hold);
                                    text = `\n\n\n${holdLabel}\n\n\n\n\n${tapLabel}`;
                                } else {
                                    const shifted = getShiftedSymbol(analysis.tap);
                                    if (shifted) {
                                        text = `${analysis.tap} ${shifted}`;
                                    } else {
                                        text = analysis.tap;
                                    }
                                }
                            } else {
                                if (analysis.hold) {
                                    const holdLabel = toIconOrLabel(analysis.hold);
                                    const holdColor = getHoldColor(analysis.hold);
                                    text = `\n\n\n${holdLabel}\n\n\n\n\n${analysis.tap}`;
                                    
                                    if (isColoredBg) {
                                        propObj.t = "#000000";
                                    } else {
                                        propObj.t = `#000000\n\n\n${holdColor}`;
                                    }
                                    propObj.a = 4;
                                } else {
                                    text = analysis.tap;
                                    
                                    if (wasHoldTap) {
                                        if (propObj.t) propObj.t = "#000000"; 
                                        propObj.a = 5;
                                    } else if (propObj.t && (propObj.t.includes("#0000ff") || propObj.t.includes("#3b93c5"))) {
                                        propObj.t = "#000000";
                                    }
                                }
                            }
                        }
                        newRows[r][c] = text;
                    }
                    flatIndex++;
                }
            }
        }
        
        let fileName = layerName;
        if (fileName === 'QWERTY') fileName = 'Qwerty_Gemini';
        else if (fileName === 'LOWER') fileName = 'Lower';
        else if (fileName === 'RAISE') fileName = 'Raise';
        else if (fileName === 'GEMINI') fileName = 'Gemini';
        else if (fileName === 'GAME') fileName = 'Game';
        else if (fileName === 'NUMPAD') fileName = 'Numpad';
        else if (fileName === 'ADJUST') fileName = 'Adjust';
        else if (fileName === 'BRUSH') fileName = 'Brush';
        else if (fileName === 'MENU') fileName = 'Menu';
        else if (fileName === 'GAME_N') fileName = 'Game_N';
        else if (fileName === 'GAME_R') fileName = 'Game_R';
        else if (fileName === 'GAME_2') fileName = 'Game_2';
        else if (fileName === 'FN') fileName = 'Fn';
        else if (fileName === 'RREZ') fileName = 'Rrez';
        else if (fileName === 'SET') fileName = 'Set';
        else {
             fileName = fileName.charAt(0).toUpperCase() + fileName.slice(1).toLowerCase();
        }

        const outPath = path.join(outputDir, `${fileName}.js`);
        
        const output = stringifyKLE(newRows);
        
        fs.writeFileSync(outPath, output);
        console.log(`Generated ${fileName}.js`);
    }
}

generate();
