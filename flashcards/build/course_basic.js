/**
 * WD from Zero, modules 0-4: reading the scope, brevity and call format, single group,
 * two groups, three or more.
 */
const { T, R, grader, pad3, pictureMeasurements } = require('./harness');
const C = require('./course_content');
const {
    CARDINALS, ASPECTS, TOL, LABEL_RULES, LADDER_ALIASES, PICTURE_CATS,
    rngFor, shuffle, pick, strip, words, cardinalOf, reciprocal,
    addScene, add, choice, fullCallChoice, errorSpot, orderQuestion, soloCall, anchorField, eachRun, pictureRun, namesOf
} = require('./course_lib');

// ------------------------------------------------------------------ module 0

function buildM0() {
    eachRun(PICTURE_CATS, 8, ({ run, tracks, groups, rng, id }) => {
        const sc = addScene(`m0-${id}`, run.orient, tracks, run.recorder, null, false);
        const leads = groups.map(g => g.lead);
        const tag = t => T.alssaBearingRange(t);
        const altK = t => Math.round(t.altitude / 1000);
        const L = pick(rng, leads);
        const g = groups.find(x => x.lead === L);
        const base = (s, n) => ({ id: `m0-${id}-${n}`, m: 'm0', s, sc });

        choice(rng, Object.assign(base('guided', 'alt'), {
            prompt: `What altitude is ${L.callsign} at?`,
            why: `Read the end of ${L.callsign}'s tag: ${tag(L)}  ${altK(L)}k, meaning ${words(altK(L))} THOUSAND feet.`
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
                why: `${blue.callsign} is a green circle, so friendly. Red diamonds are hostile.`
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
    eachRun(PICTURE_CATS, 6, ({ o, run, tracks, groups, rng, id }) => {
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
        const strength = g.count === 1 ? 'Nothing (one contact is assumed)' : g.count === 2 ? 'TWO CONTACTS' : 'HEAVY';
        choice(rng, Object.assign(base('guided', 'strength'), {
            prompt: 'Which strength fill-in goes at the end of this call?', view: 'raid',
            why: `The group has ${g.count} contact${g.count > 1 ? 's' : ''}. One is assumed; two is TWO CONTACTS; three or more is HEAVY.`
        }), strength, ['Nothing (one contact is assumed)', 'TWO CONTACTS', 'HEAVY', 'PAIR']);

        const a0 = key.anchors[0];
        add(Object.assign(base('build', 'fields'), {
            t: 'fields', prompt: 'Build the single group call.',
            fields: [
                anchorField(key, 'Group BULLSEYE'),
                { k: 'track', kind: 'select', label: 'Track', options: CARDINALS.map(c => `TRACK ${c}`).concat(['CAP']), v: isCap ? 'CAP' : `TRACK ${trackCardinal}` },
                { k: 'strength', kind: 'select', label: 'Strength', options: ['(none: one contact)', 'TWO CONTACTS', 'HEAVY'], v: g.count === 1 ? '(none: one contact)' : g.count === 2 ? 'TWO CONTACTS' : 'HEAVY' }
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

function buildM3() {
    pictureRun('m3', ['azimuth', 'range', 'random'], 15, key => key.family === 'picture' && key.fields.groupCount === 2 && !key.fields.waveCount, ({ rng, base, f, text, named, o }) => {
        const orient = T.getOrientation(o);
        const label = f.label;
        const dim = f.width != null ? f.width : f.depth;
        choice(rng, Object.assign(base('guided', 'label'), {
            prompt: 'Two groups. Which label?',
            why: `Compare the brackets: ${label === 'AZIMUTH' ? 'wider than deep, so AZIMUTH' : 'deeper than wide, so RANGE'}.`
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
        }), anchored === 2 ? both : first, [both, first, `Only ${named[1].name}`, 'Neither, the label is enough']);
    });
}

function buildM4() {
    const LABELS = ['WALL', 'LADDER', 'CHAMPAGNE', 'VIC'];
    pictureRun('m4', LABELS.map(l => l.toLowerCase()), 15, key => key.family === 'picture' && LABELS.includes(key.fields.label) && !key.fields.waveCount, ({ rng, base, f, text, named, groups }) => {
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

module.exports = { buildM0, buildM1, buildM2, buildM3, buildM4 };
