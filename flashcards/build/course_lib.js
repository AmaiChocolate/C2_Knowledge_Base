/**
 * Shared question machinery for the WD from Zero course builds: scenes, question
 * types (choice, error, order, fields, solo call), the rule breakers that make wrong
 * options, and scenario runs on the course's single threat axis.
 */
const {
    SNAPSHOT, T, R, grader, fly, snapshotTracks, startRun, pictureMeasurements
} = require('./harness');

const CARDINALS = ['NORTH', 'NORTHEAST', 'EAST', 'SOUTHEAST', 'SOUTH', 'SOUTHWEST', 'WEST', 'NORTHWEST'];
const ASPECTS = ['HOT', 'FLANK', 'BEAM', 'DRAG'];
const MAX_ERROR_PARTS = 14;
const TOL = R.tolerances;

const LABEL_RULES = {
    AZIMUTH: 'two groups wider than deep',
    RANGE: 'two groups deeper than wide',
    WALL: `three or more groups abreast within ${R.depthRuleNm} nm of depth`,
    LADDER: 'three or more groups in trail',
    CHAMPAGNE: 'two groups abreast in front, one in trail',
    VIC: 'one group in front, two abreast in trail'
};
const LABEL_SWAP = { AZIMUTH: 'RANGE', RANGE: 'AZIMUTH', WALL: 'LADDER', LADDER: 'WALL', CHAMPAGNE: 'VIC', VIC: 'CHAMPAGNE' };
// The note gives a ladder's inner groups as "MIDDLE / SECOND": never offer one as wrong when the other is right.
const LADDER_ALIASES = { 'MIDDLE GROUP': ['SECOND GROUP'], 'SECOND GROUP': ['MIDDLE GROUP'] };
const COUNT_WORDS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'];

// ------------------------------------------------------------------ helpers

function rngFor(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    let a = h >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(rng, list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const strip = text => text.replace(/^"|"$/g, '');
const words = n => T.alssaNumberToWords(n);
const cardinalOf = h => T.Geo.cardinal8(h);
const reciprocal = c => CARDINALS[(CARDINALS.indexOf(c) + 4) % 8];

/** A call's pieces, as a controller would chunk it: split at commas and full stops. */
function splitCall(text) {
    return text.split(/[,.]\s+/).map(p => p.replace(/\.$/, '').trim()).filter(Boolean);
}

const scenes = {};
const questions = [];

function addScene(id, orient, tracks, recorder, ms, tagWings) {
    scenes[id] = { axis: orient.threatBearingCenter, tracks: snapshotTracks(tracks, recorder, tagWings) };
    if (ms) scenes[id].ms = ms;
    return id;
}

/** A still that did not come from the Picture Trainer (the BC3 sim), already in card format. */
function addSceneData(id, scene) {
    scenes[id] = scene;
    return id;
}

function add(q) {
    questions.push(q);
    return q;
}

/** Multiple choice: `right` plus distinct distractors, shuffled unless `ordered`. */
function choice(rng, base, right, wrong, opts = {}) {
    const seen = new Set([right]);
    const distractors = [];
    wrong.forEach(w => {
        if (w != null && !seen.has(w) && distractors.length < (opts.max || 3)) {
            seen.add(w);
            distractors.push(w);
        }
    });
    if (!distractors.length) return null;
    const choices = opts.ordered ? [right, ...distractors].sort(opts.ordered) : shuffle(rng, [right, ...distractors]);
    return add(Object.assign({ t: 'choice', choices, a: choices.indexOf(right) }, base));
}

// ------------------------------------------------------------- rule breakers
//
// Each takes the correct call and returns it with one rule broken, plus why that is
// wrong, or null when the rule does not apply to this call.

function breakers(ctx) {
    const f = ctx.fields || {};
    return [
        text => (/BULLSEYE /.test(text) ? {
            text: text.replace('BULLSEYE ', 'BULLS '), why: 'BULLSEYE is never shortened to BULLS because it gets heard as BRAA.'
        } : null),
        text => {
            const m = text.match(/\b([A-Z]+(?:-[A-Z]+)? THOUSAND)\b/);
            return m ? { text: text.replace(m[1], 'HIGH'), why: `Altitude goes to the nearest thousand feet (${m[1]}), never HIGH or LOW.` } : null;
        },
        text => {
            const m = text.match(/TRACK (NORTHEAST|NORTHWEST|SOUTHEAST|SOUTHWEST|NORTH|SOUTH|EAST|WEST)\b/);
            return m ? {
                text: text.replace(m[0], `TRACK ${reciprocal(m[1])}`),
                why: `The heading arrows point ${m[1]}: TRACK ${m[1]}.`
            } : null;
        },
        text => {
            const m = text.match(/\b(GROUPS? )(AZIMUTH|RANGE|WALL|LADDER|CHAMPAGNE|VIC)\b/);
            return m ? {
                text: text.replace(m[0], `${m[1]}${LABEL_SWAP[m[2]]}`),
                why: `This is ${m[2]}: ${LABEL_RULES[m[2]]}.`
            } : null;
        },
        text => {
            const m = text.match(/\b(TWO|THREE|FOUR|FIVE|SIX) (GROUPS?)\b/);
            if (!m) return null;
            const n = COUNT_WORDS.indexOf(m[1]) + 1;
            return { text: text.replace(m[0], `${COUNT_WORDS[n]} ${m[2]}`), why: `Count the groups with the 3 nm rule: there are ${m[1]}.` };
        },
        text => (/TWO CONTACTS/.test(text) ? {
            text: text.replace('TWO CONTACTS', 'HEAVY'), why: 'HEAVY is three or more contacts; this group has two: TWO CONTACTS.'
        } : null),
        text => (/GROUP BRAA /.test(text) ? {
            text: text.replace('GROUP BRAA ', 'GROUP BULLSEYE '), why: 'BOGEY DOPE is answered in BRAA from the fighter, not BULLSEYE.'
        } : null),
        text => {
            const m = text.match(/, (HOT|FLANK [A-Z]+|BEAM [A-Z]+|DRAG [A-Z]+), HOSTILE/);
            if (!m) return null;
            const swap = m[1] === 'HOT' ? `DRAG ${ctx.trackCardinal || 'WEST'}` : 'HOT';
            return { text: text.replace(m[0], `, ${swap}, HOSTILE`), why: `The group's aspect to the fighter is ${m[1]}.` };
        },
        // Maneuver calls: "WARRIOR, NORTH GROUP, BEAM NORTH" / "WARRIOR, NORTH GROUP, HOT".
        text => {
            const m = text.match(/, (FLANK|BEAM|DRAG) ([A-Z]+)$/);
            if (!m) return null;
            const other = { FLANK: 'BEAM', BEAM: 'DRAG', DRAG: 'FLANK' }[m[1]];
            return {
                text: text.replace(m[0], `, ${other} ${m[2]}`),
                why: ctx.offDeg != null ? `The group is ${ctx.offDeg}° off the fighters: ${m[1]}.` : `Its aspect off the fighters is ${m[1]}.`
            };
        },
        text => {
            const m = text.match(/, (FLANK|BEAM|DRAG) ([A-Z]+)$/);
            return m ? { text: text.replace(m[0], `, ${m[1]} ${reciprocal(m[2])}`), why: `The group now tracks ${m[2]}.` } : null;
        },
        text => (/, HOT$/.test(text) && ctx.trackCardinal ? {
            text: text.replace(/, HOT$/, `, HOT ${ctx.trackCardinal}`), why: 'HOT stands alone: no direction after it.'
        } : null),
        text => (ctx.groupName && ctx.otherName && text.includes(`, ${ctx.groupName}, `) ? {
            text: text.replace(`, ${ctx.groupName}, `, `, ${ctx.otherName}, `),
            why: `${ctx.groupName} is the group that changed track. Keep the names from the picture.`
        } : null),
        text => {
            const dim = f.width != null ? ['WIDE', f.width] : null;
            if (f.label === 'AZIMUTH' || f.label === 'RANGE') {
                const v = f.width != null ? f.width : f.depth;
                const from = `${f.label} ${words(v)}`;
                return text.includes(from) ? { text: text.replace(from, `${f.label} ${words(v + 10)}`), why: `The measurement is ${v} nm: ${from}.` } : null;
            }
            if (!dim) return null;
            const from = `${words(dim[1])} WIDE`;
            return text.includes(from) ? { text: text.replace(from, `${words(dim[1] + 10)} WIDE`), why: `The WIDE bracket reads ${dim[1]} nm.` } : null;
        }
    ];
}

function brokenCalls(text, ctx, rng) {
    return shuffle(rng, breakers(ctx)).map(b => b(text)).filter(r => r && r.text !== text);
}

/** "Which is the correct call?": the right call and three with one rule broken each. */
function fullCallChoice(rng, base, text, ctx) {
    const broken = brokenCalls(text, ctx, rng);
    if (broken.length < 2) return null;
    const q = choice(rng, Object.assign({ prompt: 'Which call is correct?' }, base), text, broken.map(b => b.text));
    if (q) q.why = `Correct. The others break a rule: ${broken.slice(0, 3).map(b => b.why).join(' ')}`;
    if (q) q.long = 1;
    return q;
}

/** "One part of this call is wrong": the student picks the part. */
function errorSpot(rng, base, text, ctx) {
    const broken = brokenCalls(text, ctx, rng);
    const right = splitCall(text);
    for (const b of broken) {
        const parts = splitCall(b.text);
        if (parts.length !== right.length || parts.length > MAX_ERROR_PARTS) continue;
        const bad = parts.findIndex((p, i) => p !== right[i]);
        if (bad < 0) continue;
        return add(Object.assign({ t: 'error', prompt: 'One part of this call is wrong. Which?', parts, a: bad, why: b.why }, base));
    }
    return null;
}

function orderQuestion(base, text) {
    const parts = splitCall(text);
    if (parts.length < 3 || parts.length > 8 || new Set(parts).size !== parts.length) return null;
    return add(Object.assign({
        t: 'order', prompt: 'Put this call in order.', parts,
        why: 'Callsign first, then core information: groups and location, altitude, track / aspect, declaration, fill-ins.'
    }, base));
}

function soloCall(base, text, prompt) {
    return add(Object.assign({ t: 'call', prompt, noMs: 1 }, base, { call: text }));
}

/** Any anchored group is an acceptable anchor (as in the trainer). */
function anchorField(key, label) {
    return {
        k: 'anchor', kind: 'anchor', label: label || 'BULLSEYE of an anchored group',
        anchors: key.anchors.map(a => ({ name: a.name, b: a.bearing, r: a.range, a: a.altitudeK, cap: a.isCap ? 1 : 0 })),
        tolB: TOL.bearingDeg, tolR: TOL.rangeNm, tolCapR: TOL.capRangeNm, tolA: TOL.altitudeK
    };
}

// ------------------------------------------------------------- scenario runs

const PICTURE_CATS = ['azimuth', 'range', 'wall', 'ladder', 'champagne', 'vic', 'cap', 'random'];
// One threat axis for the whole course: west threat, raids tracking east.
const COURSE_AXIS = 'EW';

function eachRun(categories, variations, fn) {
    categories.forEach(cat => [COURSE_AXIS].forEach(o => {
        for (let v = 1; v <= variations; v++) {
            const run = startRun(cat, v, o);
            fly(run.anim, run.recorder, SNAPSHOT.pictureAtSec);
            const tracks = run.scope.tracks.filter(t => !t.isDormant);
            const hostiles = tracks.filter(t => t.hostile);
            const groups = grader.clusterer.groupByTruth(hostiles);
            fn({ cat, v, o, run, tracks, hostiles, groups, rng: rngFor(`${cat}-${o}-${v}`), id: `${cat}-${o}-${v}` });
        }
    }));
}

/**
 * A question set per picture scenario: full-call choice and spot-the-error, whatever
 * `extra` adds, a build stage (`fieldsFor`, default the WALL / LADDER fields) and a solo call.
 * `keep(key)` filters on the answer key.
 */
function pictureRun(module, cats, variations, keep, extra, fieldsFor) {
    eachRun(cats, variations, ({ o, run, tracks, groups, rng, id }) => {
        const pic = grader.buildAnswer(tracks, { mode: null }, o);
        const key = pic.answerKey;
        if (!key || !keep(key)) return;
        const text = strip(pic.text);
        const ms = pictureMeasurements(pic, { mode: null }, run.orient, tracks);
        const sc = addScene(`${module}-${id}`, run.orient, tracks, run.recorder, ms, false);
        const f = key.fields;
        const ctx = { fields: f, trackCardinal: f.track };
        // Zoomed on the raid, where the WIDE / DEEP brackets are readable; tags still give BULLSEYE.
        const base = (s, n) => ({ id: `${module}-${id}-${n}`, m: module, s, sc, call: text, view: 'raid' });
        const named = pic.named;

        fullCallChoice(rng, base('guided', 'call'), text, ctx);
        errorSpot(rng, base('guided', 'err'), text, ctx);
        extra({ rng, base, key, f, text, named, groups, o, run });

        const track = f.track === 'CAP' ? 'CAP' : `TRACK ${f.track}`;
        const fields = fieldsFor ? fieldsFor(f, key) : module === 'm3'
            ? [
                { k: 'label', kind: 'select', label: 'Label', options: ['AZIMUTH', 'RANGE'], v: f.label },
                { k: 'dim', kind: 'num', label: f.label === 'AZIMUTH' ? 'Azimuth (nm)' : 'Range (nm)', hint: 'the dimension you voice', v: f.width != null ? f.width : f.depth, tol: TOL.dimensionNm }
            ]
            : [
                { k: 'groups', kind: 'num', label: 'Total groups', v: f.groupCount, tol: 0 },
                { k: 'label', kind: 'select', label: 'Label', options: ['WALL', 'LADDER', 'CHAMPAGNE', 'VIC'], v: f.label },
                { k: 'wide', kind: 'num', label: 'WIDE (nm, blank if not voiced)', v: f.width != null ? f.width : null, tol: TOL.dimensionNm },
                { k: 'deep', kind: 'num', label: 'DEEP (nm, blank if not voiced)', v: f.depth != null ? f.depth : null, tol: TOL.dimensionNm }
            ];
        if (!fieldsFor) fields.push(anchorField(key, 'BULLSEYE of any group'));
        if (!fieldsFor) fields.push({ k: 'track', kind: 'select', label: 'Track', options: CARDINALS.map(c => `TRACK ${c}`).concat(['CAP']), v: track });
        add(Object.assign(base('build', 'fields'), {
            t: 'fields', prompt: 'Build the picture.', fields,
            why: `Any group's BULLSEYE is accepted as the anchor (±${TOL.bearingDeg}° / ±${TOL.rangeNm} nm / ±${TOL.altitudeK}k), as in the Picture Trainer. Dimensions are ±${TOL.dimensionNm} nm.`
        }));
        soloCall(base('solo', 'solo'), text, 'Call the picture.');
    });
}

function namesOf(named) {
    return named.map(n => n.name).join(' and ');
}

module.exports = {
    CARDINALS, ASPECTS, TOL, LABEL_RULES, LADDER_ALIASES, COUNT_WORDS, PICTURE_CATS, COURSE_AXIS,
    rngFor, shuffle, pick, strip, words, cardinalOf, reciprocal, splitCall,
    scenes, questions, addScene, addSceneData, add, choice, breakers, brokenCalls, fullCallChoice, errorSpot,
    orderQuestion, soloCall, anchorField, eachRun, pictureRun, namesOf
};
