/**
 * Builds the flash-card deck from the Picture Trainer's own scenario and answer engine:
 *
 *     node flashcards/build/build_cards.js           # write flashcards/cards_data.js
 *     node flashcards/build/build_cards.js --check   # fail if cards_data.js is stale or a card is bad
 *
 * Every category x variation x orientation is flown headlessly. The picture card is a
 * still of the scope part-way into the ingress, with the call computed from that same
 * moment. The picture is then "called" and the run continues, so each maneuver the
 * trainer would have flown becomes its own card, captured once the turn has settled.
 *
 * The browser only ever draws one still SVG per card, nothing animates, so the deck
 * stays usable on slow machines. Re-run this after changing anything in picture_trainer/src.
 */
const path = require('path');
const {
    ROOT, SNAPSHOT, T, R, grader, fly, snapshotTracks, startRun, writeOrCheck,
    pictureMeasurements, maneuverMeasurements
} = require('./harness');

const OUT = path.join(ROOT, 'flashcards', 'cards_data.js');

/** Study notes shown on the back of a card, keyed by label / drill / maneuver. */
const TIPS = {
    'SINGLE GROUP': 'One known group: BULLSEYE, altitude, track, declaration.',
    AZIMUTH: 'Two groups wider than deep. Voice the azimuth; name them by cardinal (NORTH / SOUTH GROUP).',
    RANGE: 'Two groups deeper than wide. Voice the range; name them LEAD / TRAIL GROUP.',
    WALL: `Three or more groups abreast, depth ${R.depthRuleNm} nm or less. Voice WIDE; outer groups by cardinal, inner groups MIDDLE.`,
    LADDER: 'Three or more groups in trail. Voice the total DEEP; LEAD, MIDDLE / SECOND, THIRD …, TRAIL.',
    CHAMPAGNE: `Two groups abreast in front, one in trail, deeper than ${R.depthRuleNm} nm. WIDE then DEEP.`,
    VIC: `One group in front, two abreast in trail, deeper than ${R.depthRuleNm} nm. DEEP then WIDE.`,
    BOX: 'Two groups abreast in front, two abreast behind. WIDE then DEEP.',
    waves: `Total groups, then LEADING EDGE + its label. Each follow-on wave (more than ${R.waveGapNm} nm back in this trainer) gets its SEPARATION along the threat axis and its own label.`,
    packages: `Groups more than ${R.packageGapNm} nm apart (trainer value) are PACKAGES: count and separation first, a BULLSEYE for each, then each package's own picture.`,
    CAP: 'An orbiting group: CAP replaces the track direction.',
    threat: 'THREAT calls go in BRAA from the threatened fighter: bearing / range, altitude, aspect, declaration.',
    braa: 'BOGEY DOPE is answered in BRAA from the requesting fighter, not BULLSEYE.',
    music: 'MUSIC: anchor the named group off BULLSEYE with altitude and track.',
    strobe: `STROBE: range and altitude of the closest group within ${R.strobeCorrelationDeg}° of the fighter's strobe bearing.`,
    maneuver: `The picture is already called: keep its group names, do not re-label. Aspect off the fighters: HOT within ${R.aspectDeg.hot}°, FLANK to ${R.aspectDeg.flank}°, BEAM to ${R.aspectDeg.beam}°, DRAG beyond. Then give the cardinal it is tracking.`,
    SPLIT: 'Name the group that split, then each new group with BULLSEYE, altitude, track and declaration.'
};

function tipsFor(card, key) {
    const out = [];
    const f = key.fields;
    if (key.family === 'maneuver') {
        out.push(TIPS.maneuver);
        if (f.maneuver === 'SPLIT') out.push(TIPS.SPLIT);
        return out;
    }
    if (card.cat === 'threat') return [TIPS.threat];
    if (key.family === 'braa' || key.family === 'music' || key.family === 'strobe') return [TIPS[key.family]];
    if (key.family === 'packages') return [TIPS.packages];
    if (f.waveCount) out.push(TIPS.waves);
    if (TIPS[f.label]) out.push(TIPS[f.label]);
    else if (f.groupCount === 1) out.push(TIPS['SINGLE GROUP']);
    if (f.track === 'CAP') out.push(TIPS.CAP);
    return out;
}

function keyFor(answer) {
    const key = answer.answerKey;
    const fields = {};
    Object.keys(key.fields).forEach(k => {
        if (key.fields[k] != null && key.fields[k] !== '') fields[k] = key.fields[k];
    });
    const out = { family: key.family, fields };
    if (key.anchors) {
        out.anchors = key.anchors.map(a => {
            const o = { name: a.name, b: `${String(a.bearing).padStart(3, '0')}/${a.range}` };
            if (a.altitudeK != null) o.a = a.altitudeK;
            return o;
        });
    }
    return out;
}

function makeCard(base, kind, answer, tracks, recorder, extra) {
    const key = keyFor(answer);
    const card = Object.assign({}, base, { id: base.id, kind }, extra || {});
    card.prompt = answer.prompt || card.prompt || null;
    card.answer = answer.text.replace(/^"|"$/g, '');
    card.key = key;
    card.tips = tipsFor(card, answer.answerKey);
    // BRAA, THREAT and STROBE calls go to a named fighter, wingmen included.
    card.tracks = snapshotTracks(tracks, recorder, ['braa', 'strobe'].includes(key.family));
    if (!card.ms) delete card.ms;
    return card;
}

function buildScenarioCards(cat, variation, orientation, stats) {
    const { scenario, scope, anim, director, recorder, orient } = startRun(cat.id, variation, orientation);

    const base = {
        cat: cat.id,
        v: variation,
        o: orientation,
        axis: orient.threatBearingCenter
    };
    const cards = [];

    fly(anim, recorder, SNAPSHOT.pictureAtSec);
    const picture = grader.buildAnswer(scope.tracks, scenario.meta, orientation);
    if (!picture.answerKey) throw new Error(`${cat.id}/${orientation}/v${variation}: no picture answer`);
    cards.push(makeCard(Object.assign({ id: `${cat.id}-${orientation}-${variation}` }, base), 'picture', picture, scope.tracks, recorder,
        { ms: pictureMeasurements(picture, scenario.meta, orient, scope.tracks) }));

    if (!director.commit(picture, anim.simTime)) return cards;
    anim.resumeRun();
    const history = [picture.text.replace(/^"|"$/g, '')];

    while (director.phase === 'maneuvers') {
        const seen = fly(anim, recorder, 240, () => !!director.pending(scope.tracks) || director.phase !== 'maneuvers');
        if (!seen || director.phase !== 'maneuvers') break;
        const m = director.pending(scope.tracks);
        // Let the turn (or the split) play out so the still shows where the group is going.
        let answer = null;
        for (let waited = 0; waited < SNAPSHOT.settleMaxSec; waited += 5) {
            if (waited >= SNAPSHOT.settleSec) {
                answer = grader.buildManeuverAnswer(scope.tracks, director);
                if (answer.answerKey && answer.answerKey.fields.maneuver === m.type) break;
                answer = null;
            }
            if (anim.paused) break;
            fly(anim, recorder, 5);
        }
        if (!answer) answer = grader.buildManeuverAnswer(scope.tracks, director);
        if (!answer.answerKey || answer.answerKey.fields.maneuver !== m.type) {
            stats.skippedManeuvers += 1;
            break;
        }
        const n = director.called + 1;
        cards.push(makeCard(Object.assign({ id: `${cat.id}-${orientation}-${variation}-m${n}` }, base), 'maneuver', answer,
            scope.tracks, recorder, { context: history.slice(), ms: maneuverMeasurements(scope.tracks, director) }));
        history.push(answer.text.replace(/^"|"$/g, ''));
        director.markCalled(anim.simTime, scope.tracks);
        if (anim.paused) break;
    }
    return cards;
}

function build() {
    const stats = { skippedManeuvers: 0 };
    const cards = [];
    T.SCENARIO_CATEGORIES.forEach(cat => {
        ['EW', 'NS'].forEach(orientation => {
            for (let v = 1; v <= T.VARIATIONS_PER_CATEGORY; v++) {
                cards.push(...buildScenarioCards(cat, v, orientation, stats));
            }
        });
    });
    const deck = {
        categories: T.SCENARIO_CATEGORIES.map(c => ({ id: c.id, label: c.label })),
        cards
    };
    return { deck, stats };
}

/** Anything a reader would see as garbage on a card. */
function validate(deck) {
    const problems = [];
    const ids = new Set();
    deck.cards.forEach(c => {
        if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`);
        ids.add(c.id);
        const text = [c.answer, c.prompt || '', ...(c.context || []), ...c.tracks.map(t => `${t.b || ''} ${t.c || ''}`)].join(' ');
        if (/NaN|undefined|null|\[object/.test(text)) problems.push(`${c.id}: bad text`);
        if (!c.tracks.some(t => t.f === 'H')) problems.push(`${c.id}: no hostiles on the scope`);
        if (!c.tracks.every(t => Number.isFinite(t.e) && Number.isFinite(t.n) && Number.isFinite(t.h))) problems.push(`${c.id}: bad position`);
        const ms = c.ms || { lines: [], rows: [] };
        if (/NaN|undefined|null/.test([ms.title || '', ...(ms.rows || []), ...ms.lines.map(l => l.t || '')].join(' '))) problems.push(`${c.id}: bad measurement text`);
        if (!ms.lines.every(l => [...l.a, ...l.b].every(Number.isFinite))) problems.push(`${c.id}: bad measurement line`);
        if (c.kind === 'picture' && c.key.family === 'picture' && c.key.fields.groupCount > 1 && !ms.lines.length) problems.push(`${c.id}: no measurements`);
    });
    return problems;
}

function serialize(deck) {
    return '/* Generated by flashcards/build/build_cards.js from picture_trainer/src. Do not edit. */\n'
        + `window.FLASHCARD_DECK = ${JSON.stringify(deck)};\n`;
}

const { deck, stats } = build();
const problems = validate(deck);
const pictures = deck.cards.filter(c => c.kind === 'picture').length;
const summary = `${deck.cards.length} cards (${pictures} pictures, ${deck.cards.length - pictures} maneuvers)`;
if (problems.length) {
    console.error(`${problems.length} bad cards:`);
    problems.slice(0, 40).forEach(p => console.error(`  - ${p}`));
    process.exit(1);
}
const text = serialize(deck);

writeOrCheck(OUT, text, summary
    + (stats.skippedManeuvers ? `; ${stats.skippedManeuvers} maneuvers skipped (never settled)` : ''),
'node flashcards/build/build_cards.js');
