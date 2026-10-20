/**
 * ALSSA picture-call formatting helpers (word numbers, location phrasing, parsing).
 * Canonical templates: kb/03_Notes_And_Insights/Picture_Call_Logic.md
 */
const ALSSA_WORDS = {
    0: 'ZERO', 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE',
    6: 'SIX', 7: 'SEVEN', 8: 'EIGHT', 9: 'NINE', 10: 'TEN',
    11: 'ELEVEN', 12: 'TWELVE', 13: 'THIRTEEN', 14: 'FOURTEEN', 15: 'FIFTEEN',
    16: 'SIXTEEN', 17: 'SEVENTEEN', 18: 'EIGHTEEN', 19: 'NINETEEN', 20: 'TWENTY',
    30: 'THIRTY', 40: 'FORTY', 50: 'FIFTY', 60: 'SIXTY', 70: 'SEVENTY', 80: 'EIGHTY', 90: 'NINETY'
};

const ALSSA_WORD_TO_NUM = Object.fromEntries(
    Object.entries(ALSSA_WORDS).map(([k, v]) => [v, Number(k)])
);

function alssaNumberToWords(n) {
    n = Math.round(Number(n));
    if (!isFinite(n) || n < 0) return String(n);
    if (ALSSA_WORDS[n]) return ALSSA_WORDS[n];
    if (n < 100) return `${ALSSA_WORDS[Math.floor(n / 10) * 10]}-${ALSSA_WORDS[n % 10]}`;
    if (n < 1000) {
        const rest = n % 100;
        const hundreds = `${ALSSA_WORDS[Math.floor(n / 100)]} HUNDRED`;
        return rest ? `${hundreds} ${alssaNumberToWords(rest)}` : hundreds;
    }
    return String(n);
}

/** Parse digits ("32") or words ("THIRTY-TWO", "one hundred ten", "SINGLE"). NaN when unparseable. */
function alssaParseNumber(val) {
    if (val == null || val === '') return NaN;
    if (typeof val === 'number') return val;
    const text = String(val).trim().toUpperCase();
    if (/^-?\d+(\.\d+)?$/.test(text)) return Math.round(parseFloat(text));

    const words = text.split(/[\s-]+/).filter(w => w && w !== 'AND');
    if (!words.length) return NaN;
    let total = 0;
    let current = 0;
    for (const w of words) {
        if (w === 'SINGLE') current += 1;
        else if (w === 'HUNDRED') current = (current || 1) * 100;
        else if (ALSSA_WORD_TO_NUM[w] != null) current += ALSSA_WORD_TO_NUM[w];
        else return NaN;
    }
    total += current;
    return total;
}

/** Altitude in thousands of feet from "32", "32K", "32000" or "THIRTY-TWO THOUSAND". */
function alssaParseAltitudeK(val) {
    if (val == null || val === '') return NaN;
    const text = String(val).trim().toUpperCase().replace(/,/g, '');
    const n = alssaParseNumber(text.replace(/\s*(THOUSAND|K|FT|FEET)\b.*$/, ''));
    if (isNaN(n)) return NaN;
    return n >= 1000 ? Math.round(n / 1000) : n;
}

function alssaAltitudeK(altitudeFt) {
    return Math.round(Number(altitudeFt) / 1000);
}

/** Altitude is voiced to the nearest thousand feet — never as HIGH / MEDIUM / LOW. */
function alssaFormatAltitude(altitudeFt) {
    return `${alssaNumberToWords(Math.max(1, alssaAltitudeK(altitudeFt)))} THOUSAND`;
}

function alssaBearingRange(pos) {
    return `${String(Geo.roundBearing(pos.bearing)).padStart(3, '0')}/${Math.round(pos.range)}`;
}

/** BULLSEYE is never shortened to "BULLS" on the radio (it is mistaken for BRAA). */
function alssaBullseye(pos) {
    return `BULLSEYE ${alssaBearingRange(pos)}`;
}

function alssaBraa(pos) {
    return `BRAA ${alssaBearingRange(pos)}`;
}

function alssaFormatGroupCount(n) {
    const count = Math.round(Number(n));
    return count === 1 ? 'SINGLE GROUP' : `${alssaNumberToWords(count)} GROUPS`;
}

/** "TWO GROUPS AZIMUTH", "THREE GROUP WALL", or the bare count when there is no label. */
function alssaLabelPhrase(n, label) {
    if (!label || n < 2) return alssaFormatGroupCount(n);
    if (n === 2) return `TWO GROUPS ${label}`;
    return `${alssaNumberToWords(n)} GROUP ${label}`;
}

/** Strength fill-in: single contact is assumed, three or more is HEAVY. */
function alssaContacts(n) {
    if (n <= 1) return '';
    const phrase = `${alssaNumberToWords(n)} CONTACTS`;
    return n >= 3 ? `HEAVY, ${phrase}` : phrase;
}

function alssaWaveLabel(idx) {
    const names = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH'];
    return `${names[idx] || alssaNumberToWords(idx + 1)} WAVE`;
}

if (typeof window !== 'undefined') {
    window.alssaNumberToWords = alssaNumberToWords;
    window.alssaParseNumber = alssaParseNumber;
    window.alssaParseAltitudeK = alssaParseAltitudeK;
    window.alssaAltitudeK = alssaAltitudeK;
    window.alssaFormatAltitude = alssaFormatAltitude;
    window.alssaBearingRange = alssaBearingRange;
    window.alssaBullseye = alssaBullseye;
    window.alssaBraa = alssaBraa;
    window.alssaFormatGroupCount = alssaFormatGroupCount;
    window.alssaLabelPhrase = alssaLabelPhrase;
    window.alssaContacts = alssaContacts;
    window.alssaWaveLabel = alssaWaveLabel;
}
