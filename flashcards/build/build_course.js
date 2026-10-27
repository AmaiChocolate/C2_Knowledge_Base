/**
 * Builds the WD from Zero course from the Picture Trainer's scenarios and answer engine
 * plus the hand-written content in course_content.js:
 *
 *     node flashcards/build/build_course.js           # write flashcards/course_data.js
 *     node flashcards/build/build_course.js --check   # fail if course_data.js is stale or a question is bad
 *
 * Each module has stages that take support away step by step:
 *   guided — multiple choice, measurements drawn on the scope
 *   build  — type the pieces of the call (graded with the trainer's tolerances)
 *   solo   — make the whole call, measurements off, then self-mark against the answer
 * Wrong options and "spot the error" calls are the correct call with one rule broken,
 * so every distractor teaches a specific rule.
 */
const path = require('path');
const {
    ROOT, SNAPSHOT, T, R, grader, pad3, fly, snapshotTracks, startRun, writeOrCheck, pictureMeasurements
} = require('./harness');
const C = require('./course_content');

const OUT = path.join(ROOT, 'flashcards', 'course_data.js');
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
            text: text.replace('BULLSEYE ', 'BULLS '), why: 'BULLSEYE is never shortened to BULLS — it gets heard as BRAA.'
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

/** "Which is the correct call?" — the right call and three with one rule broken each. */
function fullCallChoice(rng, base, text, ctx) {
    const broken = brokenCalls(text, ctx, rng);
    if (broken.length < 2) return null;
    const q = choice(rng, Object.assign({ prompt: 'Which call is correct?' }, base), text, broken.map(b => b.text));
    if (q) q.why = `Correct. The others break a rule: ${broken.slice(0, 3).map(b => b.why).join(' ')}`;
    if (q) q.long = 1;
    return q;
}

/** "One part of this call is wrong" — the student picks the part. */
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

function eachRun(categories, variations, fn) {
    categories.forEach(cat => ['EW', 'NS'].forEach(o => {
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

// ------------------------------------------------------------------ module 0

function buildM0() {
    eachRun(PICTURE_CATS, 4, ({ run, tracks, groups, rng, id }) => {
        const sc = addScene(`m0-${id}`, run.orient, tracks, run.recorder, null, false);
        const leads = groups.map(g => g.lead);
        const tag = t => T.alssaBearingRange(t);
        const altK = t => Math.round(t.altitude / 1000);
        const L = pick(rng, leads);
        const g = groups.find(x => x.lead === L);
        const base = (s, n) => ({ id: `m0-${id}-${n}`, m: 'm0', s, sc });

        choice(rng, Object.assign(base('guided', 'alt'), {
            prompt: `What altitude is ${L.callsign} at?`,
            why: `Read the end of ${L.callsign}'s tag: ${tag(L)}  ${altK(L)}k — ${words(altK(L))} THOUSAND feet.`
        }), `${altK(L)},000 ft`, [...leads.filter(x => x !== L).map(x => `${altK(x)},000 ft`), `${altK(L) + 3},000 ft`, `${altK(L) - 4},000 ft`, `${altK(L) + 7},000 ft`]);

        const brg = Math.round(L.bearing) % 360;
        choice(rng, Object.assign(base('guided', 'bulls'), {
            prompt: `What is ${L.callsign}'s BULLSEYE position (bearing / range)?`,
            why: `The second line of the tag is the BULLSEYE bearing / range: ${tag(L)}.`
        }), tag(L), [...shuffle(rng, leads.filter(x => x !== L)).map(tag), `${pad3(brg + 180)}/${Math.round(L.range)}`, `${pad3(brg)}/${Math.round(L.range) + 15}`]);

        if (!g.isCap) {
            const c = cardinalOf(L.heading);
            choice(rng, Object.assign(base('guided', 'track'), {
                prompt: `Which way is ${L.callsign} tracking?`,
                why: `The heading arrow points ${c}, and the radar plots trail behind it.`
            }), c, [reciprocal(c), CARDINALS[(CARDINALS.indexOf(c) + 2) % 8], CARDINALS[(CARDINALS.indexOf(c) + 6) % 8]]);
        }

        const multi = groups.filter(x => x.count > 1);
        const G = multi.length && rng() < 0.7 ? pick(rng, multi) : g;
        choice(rng, Object.assign(base('guided', 'contacts'), {
            prompt: `How many contacts are in ${G.lead.callsign}'s group?`, view: 'raid',
            why: `Zoom in (Raid close-up): ${G.count} contact${G.count > 1 ? 's' : ''} within 2 nm of ${G.lead.callsign}.`
                + (G.count === 2 ? ' On the radio: TWO CONTACTS.' : G.count > 2 ? ' On the radio: HEAVY.' : '')
        }), String(G.count), ['1', '2', '3', '4'], { ordered: (a, b) => a - b });

        const n = groups.length;
        choice(rng, Object.assign(base('guided', 'groups'), {
            prompt: 'How many hostile groups are on the scope?', view: 'raid',
            why: `Contacts within 3 nm are one group. Each group has one tagged lead: ${n} group${n > 1 ? 's' : ''}.`
        }), String(n), [n - 1, n + 1, n + 2].filter(x => x > 0).map(String), { ordered: (a, b) => a - b });

        const blue = tracks.find(t => !t.hostile && !t.formationAnchor);
        if (blue && leads.length >= 2 && rng() < 0.5) {
            choice(rng, Object.assign(base('guided', 'friend'), {
                prompt: 'Which callsign is a friendly fighter?',
                why: `${blue.callsign} is a green circle — friendly. Red diamonds are hostile.`
            }), blue.callsign, leads.map(x => x.callsign));
        }

        const fields = [
            { k: 'alt', kind: 'num', label: `${L.callsign} altitude (thousands of ft)`, v: altK(L), tol: 0 },
            { k: 'brg', kind: 'bearing', label: `${L.callsign} BULLSEYE bearing`, v: brg, tol: 1 },
            { k: 'rng', kind: 'num', label: `${L.callsign} BULLSEYE range (nm)`, v: Math.round(L.range), tol: 1 },
            { k: 'groups', kind: 'num', label: 'Hostile groups on the scope', v: n, tol: 0 },
            { k: 'contacts', kind: 'num', label: `Contacts in ${G.lead.callsign}'s group`, v: G.count, tol: 0 }
        ];
        add(Object.assign(base('check', 'read'), {
            t: 'fields', prompt: 'Read the scope.', fields,
            why: `${L.callsign}: ${tag(L)}, ${altK(L)}k. ${n} groups; ${G.lead.callsign} has ${G.count} contact${G.count > 1 ? 's' : ''}.`
        }));
    });
}

// ------------------------------------------------------------------ module 1

function buildM1() {
    const src = C.PCL;
    C.M1_CHOICE.forEach((q, i) => {
        const rng = rngFor(`m1-c-${i}`);
        const right = q.choices[q.a];
        choice(rng, { id: `m1-c${i + 1}`, m: 'm1', s: 'guided', prompt: q.q, why: q.why, src }, right, q.choices.filter((_, j) => j !== q.a));
    });
    C.M1_ORDER.forEach((q, i) => add({ id: `m1-o${i + 1}`, m: 'm1', s: 'build', t: 'order', prompt: q.q, parts: q.parts, why: q.why, src }));
    C.M1_ERROR.forEach((q, i) => add({
        id: `m1-e${i + 1}`, m: 'm1', s: 'build', t: 'error', src,
        prompt: `One part of this call is wrong. Which?${q.context ? ` (${q.context})` : ''}`,
        parts: q.parts, a: q.bad, why: q.why
    }));
}

// ------------------------------------------------------------------ module 2

function buildM2() {
    eachRun(PICTURE_CATS, 5, ({ o, run, tracks, groups, rng, id }) => {
        const blues = tracks.filter(t => !t.hostile);
        const ordered = shuffle(rng, groups);
        const meta = { mode: null };

        // Single group picture off BULLSEYE.
        const g = ordered[0];
        const solo = blues.concat(g.tracks);
        const pic = grader.buildAnswer(solo, meta, o);
        const text = strip(pic.text);
        const key = pic.answerKey;
        const sc = addScene(`m2-${id}-b`, run.orient, solo, run.recorder, null, false);
        const isCap = key.fields.track === 'CAP';
        const trackCardinal = isCap ? null : key.fields.track;
        const ctx = { fields: key.fields, trackCardinal };
        const base = (s, n) => ({ id: `m2-${id}-b-${n}`, m: 'm2', s, sc, call: text });

        fullCallChoice(rng, base('guided', 'call'), text, ctx);
        errorSpot(rng, base('guided', 'err'), text, ctx);
        const alt = key.anchors[0].altitudeK;
        choice(rng, Object.assign(base('guided', 'alt'), {
            prompt: `How is ${g.lead.callsign}'s altitude called?`,
            why: `${alt}k to the nearest thousand: ${words(alt)} THOUSAND. Never HIGH or LOW.`
        }), `${words(alt)} THOUSAND`, ['HIGH', `${words(alt + 1)} THOUSAND`, `${words(alt - 2)} THOUSAND`]);
        if (!isCap) {
            choice(rng, Object.assign(base('guided', 'track'), {
                prompt: 'What goes in the track slot of this BULLSEYE call?',
                why: `BULLSEYE calls give TRACK + cardinal. The arrow points ${trackCardinal}. HOT / FLANK / BEAM / DRAG belong to BRAA calls.`
            }), `TRACK ${trackCardinal}`, ['HOT', `TRACK ${reciprocal(trackCardinal)}`, `TRACK ${CARDINALS[(CARDINALS.indexOf(trackCardinal) + 2) % 8]}`]);
        } else {
            choice(rng, Object.assign(base('guided', 'track'), {
                prompt: 'The radar plots curve round: the group is orbiting. What goes in the track slot?',
                why: 'An orbiting group: CAP replaces the track.'
            }), 'CAP', ['TRACK EAST', 'ORBIT', 'HOT']);
        }
        const strength = g.count === 1 ? 'Nothing — one contact is assumed' : g.count === 2 ? 'TWO CONTACTS' : 'HEAVY';
        choice(rng, Object.assign(base('guided', 'strength'), {
            prompt: 'Which strength fill-in goes at the end of this call?', view: 'raid',
            why: `The group has ${g.count} contact${g.count > 1 ? 's' : ''}. One is assumed; two is TWO CONTACTS; three or more is HEAVY.`
        }), strength, ['Nothing — one contact is assumed', 'TWO CONTACTS', 'HEAVY', 'PAIR']);

        const a0 = key.anchors[0];
        add(Object.assign(base('build', 'fields'), {
            t: 'fields', prompt: 'Build the single group call.',
            fields: [
                anchorField(key, 'Group BULLSEYE'),
                { k: 'track', kind: 'select', label: 'Track', options: CARDINALS.map(c => `TRACK ${c}`).concat(['CAP']), v: isCap ? 'CAP' : `TRACK ${trackCardinal}` },
                { k: 'strength', kind: 'select', label: 'Strength', options: ['(none — one contact)', 'TWO CONTACTS', 'HEAVY'], v: g.count === 1 ? '(none — one contact)' : g.count === 2 ? 'TWO CONTACTS' : 'HEAVY' }
            ],
            why: `BULLSEYE ${pad3(a0.bearing)}/${a0.range}, ${a0.altitudeK}k (±${TOL.bearingDeg}° / ±${isCap ? TOL.capRangeNm : TOL.rangeNm} nm / ±${TOL.altitudeK}k).`
        }));
        orderQuestion(base('build', 'order'), text);
        soloCall(base('solo', 'solo'), text, 'Call the picture.');

        // BOGEY DOPE in BRAA, from a random fighter (wingmen too).
        const g2 = ordered[1] || ordered[0];
        const fighters = blues.filter(t => t.type === 'fighter');
        const asker = pick(rng, fighters);
        const set = blues.concat(g2.tracks);
        const braaMeta = { mode: 'bogey_dope', requesterId: asker.id };
        const braa = grader.buildAnswer(set, braaMeta, o);
        const btext = strip(braa.text);
        const bkey = braa.answerKey;
        const ms = pictureMeasurements(braa, braaMeta, run.orient, set);
        const bsc = addScene(`m2-${id}-r`, run.orient, set, run.recorder, ms, true);
        const req = strip(braa.prompt);
        const bctx = { fields: bkey.fields, trackCardinal: g2.isCap ? 'WEST' : cardinalOf(g2.heading) };
        const bbase = (s, n) => ({ id: `m2-${id}-r-${n}`, m: 'm2', s, sc: bsc, req, call: btext });
        const other = fighters.find(f => f !== asker && !f.formationAnchor) || fighters.find(f => f !== asker);

        fullCallChoice(rng, bbase('guided', 'call'), btext, bctx);
        errorSpot(rng, bbase('guided', 'err'), btext, bctx);
        choice(rng, Object.assign(bbase('guided', 'format'), {
            prompt: `${asker.callsign} asks for BOGEY DOPE. How do you give the group's position?`,
            why: `BOGEY DOPE is answered in BRAA from the fighter that asked: ${asker.callsign}.`
        }), `BRAA from ${asker.callsign}`, ['BULLSEYE', other ? `BRAA from ${other.callsign}` : null, 'BRAA from BULLSEYE']);
        const aspectPart = (btext.match(/, (HOT|CAP|FLANK [A-Z]+|BEAM [A-Z]+|DRAG [A-Z]+), HOSTILE/) || [])[1];
        if (aspectPart && aspectPart !== 'CAP') {
            const c = cardinalOf(g2.heading);
            choice(rng, Object.assign(bbase('guided', 'aspect'), {
                prompt: `What is the group's aspect to ${asker.callsign}?`,
                why: `The group's track is ${c}; relative to ${asker.callsign} that is ${aspectPart}. HOT points at the fighter; FLANK, BEAM and DRAG turn progressively away and carry the cardinal.`
            }), aspectPart, ['HOT', `FLANK ${c}`, `BEAM ${c}`, `DRAG ${c}`, `TRACK ${c}`]);
        }
        add(Object.assign(bbase('build', 'fields'), {
            t: 'fields', prompt: 'Build the BOGEY DOPE answer.',
            fields: [
                { k: 'brg', kind: 'bearing', label: `BRAA bearing from ${asker.callsign}`, v: bkey.fields.braaBearing, tol: TOL.bearingDeg },
                { k: 'rng', kind: 'num', label: 'BRAA range (nm)', v: bkey.fields.braaRange, tol: TOL.rangeNm },
                { k: 'alt', kind: 'num', label: 'Altitude (thousands of ft)', v: bkey.fields.altitude, tol: TOL.altitudeK },
                { k: 'aspect', kind: 'select', label: 'Aspect', options: ASPECTS.concat(['CAP']), v: bkey.fields.aspect }
            ],
            why: `BRAA is bearing / range from ${asker.callsign} to the group (the measurement box), altitude to the nearest thousand, aspect from the group's heading relative to ${asker.callsign}.`
        }));
        orderQuestion(bbase('build', 'order'), btext);
        soloCall(bbase('solo', 'solo'), btext, 'Answer the fighter.');
    });
}

// ------------------------------------------------------------- modules 3 and 4

function pictureRun(module, cats, variations, keep, extra) {
    eachRun(cats, variations, ({ o, run, tracks, groups, rng, id }) => {
        const pic = grader.buildAnswer(tracks, { mode: null }, o);
        const key = pic.answerKey;
        if (!key || key.family !== 'picture' || !keep(key.fields)) return;
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
        const fields = module === 'm3'
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
        fields.push(anchorField(key, 'BULLSEYE of any group'));
        fields.push({ k: 'track', kind: 'select', label: 'Track', options: CARDINALS.map(c => `TRACK ${c}`).concat(['CAP']), v: track });
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

function buildM3() {
    pictureRun('m3', ['azimuth', 'range', 'random'], 15, f => f.groupCount === 2 && !f.waveCount, ({ rng, base, f, text, named, o }) => {
        const orient = T.getOrientation(o);
        const label = f.label;
        const dim = f.width != null ? f.width : f.depth;
        choice(rng, Object.assign(base('guided', 'label'), {
            prompt: 'Two groups. Which label?',
            why: `Compare the brackets: ${label === 'AZIMUTH' ? 'wider than deep — AZIMUTH' : 'deeper than wide — RANGE'}.`
        }), label, ['AZIMUTH', 'RANGE', 'WALL', 'LADDER'], { ordered: (a, b) => ['AZIMUTH', 'RANGE', 'WALL', 'LADDER'].indexOf(a) - ['AZIMUTH', 'RANGE', 'WALL', 'LADDER'].indexOf(b) });

        const side = `${orient.crossNames.pos} GROUP and ${orient.crossNames.neg} GROUP`;
        const sideRev = `${orient.crossNames.neg} GROUP and ${orient.crossNames.pos} GROUP`;
        const right = namesOf(named);
        const wrongSide = o === 'EW' ? 'EAST GROUP and WEST GROUP' : 'NORTH GROUP and SOUTH GROUP';
        choice(rng, Object.assign(base('guided', 'names'), {
            prompt: 'What are the two groups called, in the order they are voiced?',
            why: label === 'AZIMUTH'
                ? `AZIMUTH groups are named by side across the threat axis (${orient.crossNames.neg} / ${orient.crossNames.pos}); the one closest to the fighters is voiced first.`
                : 'RANGE groups are LEAD GROUP (closest to the fighters) and TRAIL GROUP.'
        }), right, [right === side ? sideRev : side, 'LEAD GROUP and TRAIL GROUP', 'TRAIL GROUP and LEAD GROUP', wrongSide, 'GROUP ONE and GROUP TWO']);

        const other = label === 'AZIMUTH' ? 'RANGE' : 'AZIMUTH';
        choice(rng, Object.assign(base('guided', 'dim'), {
            prompt: 'Which label and dimension are voiced?',
            why: `${label} ${words(dim)}: the label's dimension, from the ${label === 'AZIMUTH' ? 'WIDE' : 'DEEP'} bracket.`
        }), `TWO GROUPS ${label} ${words(dim)}`, [`TWO GROUPS ${label} ${words(dim + 10)}`, `TWO GROUPS ${other} ${words(dim)}`, `TWO GROUPS ${label}, ${words(dim)} ${label === 'AZIMUTH' ? 'DEEP' : 'WIDE'}`]);

        const anchored = (text.match(/BULLSEYE/g) || []).length;
        const both = 'Both groups';
        const first = `Only ${named[0].name}`;
        choice(rng, Object.assign(base('guided', 'anchors'), {
            prompt: 'Which groups get a BULLSEYE?',
            why: label === 'RANGE'
                ? 'RANGE: only the LEAD GROUP is anchored; the trail group takes its position from the lead and the range.'
                : `AZIMUTH: both are anchored only when more than ${R.anchorAzimuthNm} nm apart. These are ${dim} nm apart.`
        }), anchored === 2 ? both : first, [both, first, `Only ${named[1].name}`, 'Neither — the label is enough']);
    });
}

function buildM4() {
    const LABELS = ['WALL', 'LADDER', 'CHAMPAGNE', 'VIC'];
    pictureRun('m4', LABELS.map(l => l.toLowerCase()), 15, f => LABELS.includes(f.label) && !f.waveCount, ({ rng, base, f, text, named, groups }) => {
        choice(rng, Object.assign(base('guided', 'label'), {
            prompt: 'Which label?',
            why: `${f.label}: ${LABEL_RULES[f.label]}.` + (f.label === 'WALL' ? '' : ` Depth is more than ${R.depthRuleNm} nm, so not a WALL.`)
        }), f.label, LABELS, { ordered: (a, b) => LABELS.indexOf(a) - LABELS.indexOf(b) });

        const n = f.groupCount;
        choice(rng, Object.assign(base('guided', 'count'), {
            prompt: 'How many groups?', view: 'raid',
            why: `Each tagged lead is a group (contacts within 3 nm): ${words(n)} GROUP ${f.label}.`
        }), String(n), [n - 1, n + 1, n + 2].filter(x => x > 1).map(String), { ordered: (a, b) => a - b });

        const wi = text.indexOf(' WIDE');
        const di = text.indexOf(' DEEP');
        const voiced = wi > 0 && di > 0 ? (wi < di ? 'WIDE, then DEEP' : 'DEEP, then WIDE') : wi > 0 ? 'WIDE only' : 'DEEP only';
        choice(rng, Object.assign(base('guided', 'dims'), {
            prompt: `A ${f.label}: which dimensions are voiced, in what order?`,
            why: { WALL: 'WALL: WIDE only.', LADDER: 'LADDER: the total DEEP only.', CHAMPAGNE: 'CHAMPAGNE: WIDE, then DEEP.', VIC: 'VIC: DEEP, then WIDE.' }[f.label]
        }), voiced, ['WIDE only', 'DEEP only', 'WIDE, then DEEP', 'DEEP, then WIDE'], { ordered: (a, b) => a.localeCompare(b) });

        const target = pick(rng, named);
        const lead = target.group.lead.callsign;
        const pool = Array.from(new Set(named.map(x => x.name).concat(['MIDDLE GROUP', 'LEAD GROUP', 'TRAIL GROUP', 'NORTH GROUP', 'SOUTH GROUP', 'SECOND GROUP'])));
        choice(rng, Object.assign(base('guided', 'name'), {
            prompt: `In this ${f.label}, what is ${lead}'s group called?`,
            why: { WALL: 'WALL: outer groups by side, inner groups MIDDLE.', LADDER: 'LADDER: LEAD (closest to the fighters), then MIDDLE / SECOND, THIRD…, TRAIL.',
                CHAMPAGNE: 'CHAMPAGNE: NORTH / SOUTH LEAD GROUP abreast in front, TRAIL GROUP behind.', VIC: 'VIC: LEAD GROUP in front, NORTH / SOUTH TRAIL GROUP behind.' }[f.label]
                + ` ${lead} is ${target.name}.`
        }), target.name, shuffle(rng, pool.filter(x => x !== target.name && !(LADDER_ALIASES[target.name] || []).includes(x))));
    });
}

// ----------------------------------------------------------------- assemble

function validate() {
    const problems = [];
    const ids = new Set();
    const bank = {};
    questions.forEach(q => {
        if (ids.has(q.id)) problems.push(`${q.id}: duplicate id`);
        ids.add(q.id);
        bank[`${q.m}.${q.s}`] = (bank[`${q.m}.${q.s}`] || 0) + 1;
        const shown = [q.prompt, q.req, q.why, q.call, ...(q.choices || []), ...(q.parts || []),
            ...(q.fields || []).flatMap(f => [f.label, ...(f.options || [])])].filter(x => x != null);
        if (shown.some(x => /NaN|undefined|\bnull\b|\[object/.test(String(x)))) problems.push(`${q.id}: bad text`);
        if (!q.prompt || !q.why && q.t !== 'call') problems.push(`${q.id}: missing prompt or explanation`);
        if (q.sc && !scenes[q.sc]) problems.push(`${q.id}: missing scene ${q.sc}`);
        if (q.t === 'choice' && !(q.a >= 0 && q.a < q.choices.length && q.choices.length >= 2)) problems.push(`${q.id}: bad choice answer`);
        if (q.t === 'error' && !(q.a >= 0 && q.a < q.parts.length)) problems.push(`${q.id}: bad error answer`);
        if (q.t === 'fields') {
            q.fields.forEach(f => {
                if (f.kind === 'select' && !f.options.includes(f.v)) problems.push(`${q.id}: ${f.k} answer ${f.v} not an option`);
                if ((f.kind === 'num' || f.kind === 'bearing') && f.v !== null && !Number.isFinite(f.v)) problems.push(`${q.id}: ${f.k} not a number`);
                if (f.kind === 'anchor' && !f.anchors.every(a => [a.b, a.r, a.a].every(Number.isFinite))) problems.push(`${q.id}: bad anchor`);
            });
        }
    });
    C.MODULES.forEach(m => m.stages.forEach(s => {
        if ((bank[`${m.id}.${s}`] || 0) < 10) problems.push(`${m.id}.${s}: only ${bank[`${m.id}.${s}`] || 0} questions`);
    }));
    return { problems, bank };
}

buildM0();
buildM1();
buildM2();
buildM3();
buildM4();

const { problems, bank } = validate();
if (problems.length) {
    console.error(`${problems.length} bad questions:`);
    problems.slice(0, 40).forEach(p => console.error(`  - ${p}`));
    process.exit(1);
}
const course = {
    modules: C.MODULES.map(m => Object.assign({}, m, {
        stages: m.stages.map(s => Object.assign({ id: s }, C.STAGES[s]))
    })),
    upcoming: C.UPCOMING,
    reviewSource: C.PCL,
    scenes,
    questions
};
const text = '/* Generated by flashcards/build/build_course.js — do not edit. */\n'
    + `window.WD_COURSE = ${JSON.stringify(course)};\n`;
const summary = `${questions.length} questions, ${Object.keys(scenes).length} scenes (`
    + Object.keys(bank).sort().map(k => `${k} ${bank[k]}`).join(', ') + ')';
writeOrCheck(OUT, text, summary, 'node flashcards/build/build_course.js');
