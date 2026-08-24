/**
 * ALSSA picture-call formatting helpers (word numbers, location phrasing, parsing).
 * Canonical templates: kb/03_Notes_And_Insights/Picture_Call_Logic.md
 */
const ALSSA_WORDS = {
    0: 'ZERO', 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE',
    6: 'SIX', 7: 'SEVEN', 8: 'EIGHT', 9: 'NINE', 10: 'TEN',
    11: 'ELEVEN', 12: 'TWELVE', 13: 'THIRTEEN', 14: 'FOURTEEN', 15: 'FIFTEEN',
    16: 'SIXTEEN', 17: 'SEVENTEEN', 18: 'EIGHTEEN', 19: 'NINETEEN', 20: 'TWENTY',
    21: 'TWENTY-ONE', 22: 'TWENTY-TWO', 23: 'TWENTY-THREE', 24: 'TWENTY-FOUR',
    25: 'TWENTY-FIVE', 26: 'TWENTY-SIX', 27: 'TWENTY-SEVEN', 28: 'TWENTY-EIGHT',
    29: 'TWENTY-NINE', 30: 'THIRTY', 31: 'THIRTY-ONE', 32: 'THIRTY-TWO',
    33: 'THIRTY-THREE', 34: 'THIRTY-FOUR', 35: 'THIRTY-FIVE', 36: 'THIRTY-SIX',
    37: 'THIRTY-SEVEN', 38: 'THIRTY-EIGHT', 39: 'THIRTY-NINE', 40: 'FORTY',
    45: 'FORTY-FIVE', 50: 'FIFTY', 60: 'SIXTY', 70: 'SEVENTY', 80: 'EIGHTY', 90: 'NINETY'
};

const ALSSA_WORD_TO_NUM = Object.fromEntries(
    Object.entries(ALSSA_WORDS).map(([k, v]) => [v, Number(k)])
);

function alssaNumberToWords(n) {
    n = Math.round(Number(n));
    if (ALSSA_WORDS[n]) return ALSSA_WORDS[n];
    if (n > 20 && n < 100) {
        const tens = Math.floor(n / 10) * 10;
        const ones = n % 10;
        if (ones === 0 && ALSSA_WORDS[tens]) return ALSSA_WORDS[tens];
        if (ALSSA_WORDS[tens] && ALSSA_WORDS[ones]) return `${ALSSA_WORDS[tens]}-${ALSSA_WORDS[ones]}`;
    }
    return String(n);
}

function alssaParseNumber(val) {
    if (val == null || val === '') return NaN;
    const direct = parseInt(String(val).trim(), 10);
    if (!isNaN(direct)) return direct;

    const normalized = String(val).trim().toUpperCase().replace(/\s+/g, '-');
    if (normalized === 'SINGLE') return 1;
    if (ALSSA_WORD_TO_NUM[normalized] != null) return ALSSA_WORD_TO_NUM[normalized];

    const parts = normalized.split('-').filter(Boolean);
    if (parts.length === 2 && ALSSA_WORD_TO_NUM[parts[0]] != null && ALSSA_WORD_TO_NUM[parts[1]] != null) {
        return ALSSA_WORD_TO_NUM[parts[0]] + ALSSA_WORD_TO_NUM[parts[1]];
    }
    if (parts.length === 1 && ALSSA_WORD_TO_NUM[parts[0]] != null) return ALSSA_WORD_TO_NUM[parts[0]];
    return NaN;
}

function alssaFormatGroupCount(n, labelType) {
    const count = Math.round(Number(n));
    const base = count === 1 ? 'SINGLE GROUP' : `${alssaNumberToWords(count)} GROUPS`;
    if (count === 2 && labelType && labelType !== 'UNKNOWN') {
        return `${base} ${labelType}`;
    }
    return base;
}

function alssaWaveLabel(idx) {
    if (idx === 0) return 'FIRST WAVE';
    if (idx === 1) return 'SECOND WAVE';
    if (idx === 2) return 'THIRD WAVE';
    return `WAVE ${idx + 1}`;
}

function alssaFormatDimension(dimensionStr) {
    if (!dimensionStr) return '';
    const m = String(dimensionStr).match(/(\d+)\s*(WIDE|DEEP)/i);
    if (!m) return dimensionStr.toUpperCase();
    return `${alssaNumberToWords(parseInt(m[1], 10))} ${m[2].toUpperCase()}`;
}

function alssaFormatAltitude(altitude, preferBlock) {
    if (preferBlock) {
        if (altitude >= 30000) return 'HIGH';
        if (altitude >= 15000) return 'MEDIUM';
        return 'LOW';
    }
    const k = Math.round(Number(altitude) / 1000);
    if (k <= 0) return 'LOW';
    return `${alssaNumberToWords(k)} THOUSAND`;
}

function alssaFormatLocation(formationType, centroid, opts = {}) {
    const br = `${Math.round(centroid.bearing)}/${Math.round(centroid.range)}`;
    if (formationType === 'VIC') return `LEAD GROUP BULLSEYE ${br}`;
    if (formationType === 'CHAMPAGNE') return `LEAD GROUPS BULLSEYE ${br}`;
    if (formationType === 'BOX') return `NORTH LEAD BULLSEYE ${br}`;
    if (formationType === 'CAP') return `CAP BULLSEYE ${br}`;
    if (opts.useLeadingEdge) return `LEADING EDGE BULLSEYE ${br}`;
    return `BULLSEYE ${br}`;
}

function alssaUsesLeadingEdgeLocation(formationType) {
    return formationType === 'LADDER';
}

function alssaFormatFillIns(trackFillIn, declaration) {
    const track = trackFillIn || 'TRACK EAST';
    const id = declaration || 'HOSTILE';
    return `${track}, ${id}`;
}

function alssaParseDimensionNm(text) {
    if (!text) return NaN;
    const digit = parseInt(String(text).replace(/\D/g, ''), 10);
    if (!isNaN(digit) && digit > 0) return digit;
    const m = String(text).toUpperCase().match(/([A-Z-]+)\s*(WIDE|DEEP)/);
    if (!m) return NaN;
    return alssaParseNumber(m[1]);
}

if (typeof window !== 'undefined') {
    window.alssaNumberToWords = alssaNumberToWords;
    window.alssaParseNumber = alssaParseNumber;
    window.alssaFormatGroupCount = alssaFormatGroupCount;
    window.alssaWaveLabel = alssaWaveLabel;
    window.alssaFormatDimension = alssaFormatDimension;
    window.alssaFormatAltitude = alssaFormatAltitude;
    window.alssaFormatLocation = alssaFormatLocation;
    window.alssaUsesLeadingEdgeLocation = alssaUsesLeadingEdgeLocation;
    window.alssaFormatFillIns = alssaFormatFillIns;
    window.alssaParseDimensionNm = alssaParseDimensionNm;
}
