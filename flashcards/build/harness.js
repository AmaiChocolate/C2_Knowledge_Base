/**
 * Shared harness for the flash-card and course builds: loads the Picture Trainer's
 * browser scripts into a VM, flies scenarios headlessly, and turns the scope at a
 * moment into still-card data (tracks, radar-plot trails, drawn measurements).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const TRAINER_SRC = path.join(ROOT, 'picture_trainer', 'src');

const SCRIPTS = [
    'orientation', 'clustering', 'alssa_format', 'picture_logic', 'formation_generator',
    'scenario_bank', 'track_kinematics', 'maneuvers', 'symbology', 'scope_renderer', 'animation_engine', 'grading'
];

const SNAPSHOT = {
    pictureAtSec: 32,       // the picture card is taken this far into the ingress
    plotEverySec: 4,        // radar-plot trail spacing
    plotsKept: 8,           // trail length (8 x 4 s = 32 s of history)
    settleSec: 20,          // a maneuver card is taken this long after the turn becomes visible
    settleMaxSec: 60,
    stepSec: 0.1,
    orbitPrerollSec: 360,   // CAPs fly this long before the run, so their plots show a whole lap
    orbitPlotsKept: 90      // 90 x 4 s = 6 min of plots for an orbiting group
};

function loadTrainer() {
    const noop = () => {};
    const ctx2d = new Proxy({}, { get: () => () => ({ addColorStop: noop }), set: () => true });
    const canvas = {
        width: 800, height: 800, clientWidth: 800, clientHeight: 800,
        getContext: () => ctx2d,
        addEventListener: noop,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 })
    };
    const sandbox = {
        console,
        document: { getElementById: () => canvas },
        addEventListener: noop,
        requestAnimationFrame: noop,
        performance: { now: () => 0 }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    SCRIPTS.forEach(name => {
        const file = path.join(TRAINER_SRC, `${name}.js`);
        vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    });
    return vm.runInContext(`({
        Geo, getOrientation, PICTURE_RULES, PictureGenerator, TrackClusterer, PictureGrader,
        ScopeRenderer, AnimationEngine, ManeuverDirector, SCENARIO_CATEGORIES,
        VARIATIONS_PER_CATEGORY, categorySeed, generateScenario, alssaBearingRange, alssaNumberToWords
    })`, sandbox);
}

const T = loadTrainer();
const R = T.PICTURE_RULES;
const grader = new T.PictureGrader(new T.PictureGenerator({ callsign: 'WARRIOR' }), new T.TrackClusterer(R.groupNm, 1));
const round1 = x => Math.round(x * 10) / 10;
/** Records a radar-plot trail for every visible track while the run flies. */
class PlotRecorder {
    constructor() {
        this.trails = new Map();
        this.lastAt = -Infinity;
    }

    sample(tracks, simTime) {
        if (simTime - this.lastAt < SNAPSHOT.plotEverySec) return;
        this.lastAt = simTime;
        tracks.forEach(t => {
            if (t.isDormant) return;
            const en = T.Geo.bullsToEN(t);
            const trail = this.trails.get(t.id) || [];
            trail.push([round1(en.e), round1(en.n)]);
            if (trail.length > (isOrbiting(t) ? SNAPSHOT.orbitPlotsKept : SNAPSHOT.plotsKept)) trail.shift();
            this.trails.set(t.id, trail);
        });
    }
}

/** Fly until `seconds` pass, the run freezes, or `until` holds. */
function fly(anim, recorder, seconds, until) {
    const steps = Math.round(seconds / SNAPSHOT.stepSec);
    for (let i = 0; i < steps && !anim.paused; i++) {
        anim.update(SNAPSHOT.stepSec);
        recorder.sample(anim.scope.tracks, anim.simTime);
        if (until && until()) return true;
    }
    return !!(until && until());
}

/**
 * The scope as drawn: positions in nm east / north of BULLSEYE. Leads carry a tag and
 * a trail; wingmen (inside 2 nm of lead) only get a tag when `tagFriendlyWings` is set.
 */
function snapshotTracks(tracks, recorder, tagFriendlyWings) {
    return tracks.filter(t => !t.isDormant).map(t => {
        const en = T.Geo.bullsToEN(t);
        const s = {
            e: round1(en.e),
            n: round1(en.n),
            h: Math.round(t.heading),
            f: t.hostile ? 'H' : 'F'
        };
        if (t.formationAnchor) s.w = 1;
        if (!t.formationAnchor || (tagFriendlyWings && !t.hostile)) {
            s.c = t.callsign;
            s.b = T.alssaBearingRange(t);
            s.a = Math.round(t.altitude / 1000);
        }
        let trail = t.formationAnchor ? null : recorder.trails.get(t.id);
        // An orbit keeps a whole lap of plots; every other one is plenty to read the racetrack.
        if (trail && isOrbiting(t)) trail = trail.filter((_, i) => (trail.length - 1 - i) % 2 === 0);
        if (trail && trail.length > 1) s.tr = trail.slice(0, -1);
        return s;
    });
}

const isOrbiting = t => t.hostile && !t.formationAnchor && !!(t.orbitAnchor || t.isCapOrbit);

/**
 * A CAP racetrack takes minutes to fly, so ~30 s of plots only shows a straight
 * stretch and the group reads as tracking NE / NW. Before the run starts, fly each
 * orbiting group on its own for a few minutes and start the run from there, with
 * that flight as its plot history. The group's answer does not move: a CAP is
 * anchored at its orbit point, not at where the lead happens to be.
 */
function prerollOrbits(tracks, recorder) {
    tracks.filter(t => !t.isDormant && isOrbiting(t)).forEach(lead => {
        const group = tracks.filter(t => t === lead || t.formationAnchor === lead.id);
        const clones = group.map(t => JSON.parse(JSON.stringify(t)));
        const scope = new T.ScopeRenderer('tacScope');
        const anim = new T.AnimationEngine(scope);
        anim.fixedStep = SNAPSHOT.stepSec;
        scope.tracks = clones;
        anim.reset(clones, null);
        const copy = clones[group.indexOf(lead)];
        const trail = [];
        const steps = Math.round(SNAPSHOT.plotEverySec / SNAPSHOT.stepSec);
        for (let sec = 0; sec < SNAPSHOT.orbitPrerollSec; sec += SNAPSHOT.plotEverySec) {
            for (let i = 0; i < steps; i++) anim.fixedUpdate(SNAPSHOT.stepSec);
            const en = T.Geo.bullsToEN(copy);
            trail.push([round1(en.e), round1(en.n)]);
        }
        group.forEach((t, i) => Object.assign(t, clones[i], { history: [], radarPlots: [] }));
        recorder.trails.set(lead.id, trail.slice(-SNAPSHOT.orbitPlotsKept));
    });
}

// ------------------------------------------------------------- measurements
//
// Flash cards drill the call, not the ruler work, so each card carries the
// measurements a controller would read off the scope, taken with the answer
// engine's own geometry so the numbers agree with the key:
//   pictures : WIDE / DEEP brackets per formation, wave and package separation
//   BRAA / EA: bearing / range from the fighter(s) to the groups
//   maneuvers: each group's heading and angle off the fighters (sets the aspect)

const gen = grader.pictureGen;
const BRACKET_OFFSET_NM = 4;
const MAX_READOUT_ROWS = 8;
const pad3 = b => String(T.Geo.roundBearing(b)).padStart(3, '0');

function enOf(pos) {
    const en = T.Geo.bullsToEN(pos);
    return [round1(en.e), round1(en.n)];
}

function axisPoint(along, cross, orient) {
    return enOf(T.Geo.fromAxis({ along, cross }, orient));
}

const extent = (set, key) => [Math.min(...set.map(g => g.axis[key])), Math.max(...set.map(g => g.axis[key]))];

/** The groups a formation's voiced WIDE is measured across. */
function widthSet(set, formation) {
    const byAlong = [...set].sort((a, b) => b.axis.along - a.axis.along);
    const span = s => extent(s, 'cross')[1] - extent(s, 'cross')[0];
    if (formation.type === 'CHAMPAGNE') return byAlong.slice(0, 2);
    if (formation.type === 'VIC') return byAlong.slice(1);
    if (formation.type === 'BOX') {
        const lead = byAlong.slice(0, 2);
        const trail = byAlong.slice(2);
        return span(lead) >= span(trail) ? lead : trail;
    }
    return set;
}

/** WIDE across the threat axis, just ahead of the formation; DEEP along it, just off its side. */
function formationBrackets(set, orient) {
    if (set.length < 2) return [];
    const formation = gen.analyzeFormation(set, orient);
    const lines = [];
    const ws = widthSet(set, formation);
    const [c0, c1] = extent(ws, 'cross');
    const front = extent(ws, 'along')[1] + BRACKET_OFFSET_NM;
    const wide = formation.width != null ? formation.width : Math.round(c1 - c0);
    if (wide >= 1) lines.push({ a: axisPoint(front, c0, orient), b: axisPoint(front, c1, orient), t: `${wide} WIDE` });
    const [a0, a1] = extent(set, 'along');
    const side = extent(set, 'cross')[1] + BRACKET_OFFSET_NM;
    const deep = formation.depth != null ? formation.depth : Math.round(a1 - a0);
    if (deep >= 1) lines.push({ a: axisPoint(a0, side, orient), b: axisPoint(a1, side, orient), t: `${deep} DEEP` });
    return lines;
}

function braaRows(from, groups, limit) {
    return groups
        .map(g => ({ g, braa: T.Geo.bearingRange(from, g.centroid) }))
        .sort((x, y) => x.braa.range - y.braa.range)
        .slice(0, limit);
}

function pictureMeasurements(answer, meta, orient, tracks) {
    const groups = answer.groups || [];
    const blues = tracks.filter(t => !t.hostile && !t.isDormant && t.type === 'fighter');
    const requester = blues.find(b => b.id === meta.requesterId) || blues[0];

    if (meta.mode === 'threat') {
        const threat = groups.find(g => g.isThreat) || groups[0];
        const rows = blues
            .map(b => ({ b, braa: T.Geo.bearingRange(b, threat.centroid) }))
            .sort((x, y) => x.braa.range - y.braa.range);
        return {
            title: `BRAA to ${threat.lead.callsign}`,
            rows: rows.map(r => `${r.b.callsign.padEnd(9)} ${pad3(r.braa.bearing)}/${Math.round(r.braa.range)}`),
            lines: rows.map(r => ({ a: enOf(r.b), b: enOf(threat.centroid) }))
        };
    }
    if (meta.mode === 'bogey_dope' || meta.mode === 'ea_strobe') {
        if (!requester) return null;
        const rows = braaRows(requester, groups, 5);
        return {
            title: `BRAA from ${requester.callsign}`,
            rows: rows.map(r => `${r.g.lead.callsign.padEnd(9)} ${pad3(r.braa.bearing)}/${Math.round(r.braa.range)}`),
            lines: rows.map(r => ({ a: enOf(requester), b: enOf(r.g.centroid) }))
        };
    }
    if (meta.mode === 'ea_music') return null;

    const lines = [];
    if (answer.packages) {
        answer.packages.forEach(p => lines.push(...formationBrackets(gen.detectWaves(p)[0], orient)));
        const mid = (gen.mean(answer.packages[0], 'along') + gen.mean(answer.packages[1], 'along')) / 2;
        lines.push({
            a: axisPoint(mid, gen.mean(answer.packages[0], 'cross'), orient),
            b: axisPoint(mid, gen.mean(answer.packages[1], 'cross'), orient),
            t: `${answer.answerKey.fields.width} AZIMUTH`
        });
    } else if (answer.waves) {
        answer.waves.forEach((w, i) => {
            lines.push(...formationBrackets(w, orient));
            if (i === 0) return;
            const front = answer.waves[i - 1];
            const cross = gen.mean(front, 'cross');
            lines.push({
                a: axisPoint(extent(front, 'along')[0], cross, orient),
                b: axisPoint(extent(w, 'along')[1], cross, orient),
                t: `SEP ${Math.round(gen.waveSeparation(front, w))}`
            });
        });
    } else {
        lines.push(...formationBrackets(groups, orient));
    }
    return lines.length ? { lines } : null;
}

/** Heading and angle off the fighters for every hostile group: 0° is HOT. */
function maneuverMeasurements(tracks, director) {
    const ref = director.fighterReference(tracks);
    const hostiles = tracks.filter(t => t.hostile && !t.isDormant);
    const groups = grader.clusterer.groupByTruth(hostiles);
    const rows = groups.map(g => {
        const off = T.Geo.angleDiff(g.heading, T.Geo.bearingRange(g.centroid, ref).bearing);
        return { g, off };
    }).sort((x, y) => y.off - x.off).slice(0, MAX_READOUT_ROWS);
    return {
        title: 'Track vs fighters (0° = HOT)',
        rows: rows.map(r => `${r.g.lead.callsign.padEnd(9)} HDG ${pad3(r.g.heading)}  ${String(Math.round(r.off)).padStart(3)}°`),
        lines: []
    };
}

/**
 * A scenario ready to fly: scope, animation, maneuver director and plot recorder.
 * The coarse 0.1 s step matches the trainer's test sweep (turns integrate in < 0.5° steps).
 */
function startRun(categoryId, variation, orientation) {
    const seed = T.categorySeed(categoryId, variation);
    const scenario = T.generateScenario({ category: categoryId, seed, orientation });
    const scope = new T.ScopeRenderer('tacScope');
    const anim = new T.AnimationEngine(scope);
    const director = new T.ManeuverDirector();
    anim.maneuvers = director;
    anim.fixedStep = SNAPSHOT.stepSec;
    scope.tracks = scenario.tracks;
    anim.reset(scope.tracks, scenario.motionScript);
    director.reset(scenario.meta, true);
    const recorder = new PlotRecorder();
    prerollOrbits(scope.tracks, recorder);
    recorder.sample(scope.tracks, 0);
    return { scenario, scope, anim, director, recorder, orient: T.getOrientation(orientation) };
}

/** Write a generated file, or with --check fail when the committed copy differs. */
function writeOrCheck(out, text, summary, buildCmd) {
    const rel = path.relative(ROOT, out);
    if (process.argv.includes('--check')) {
        const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
        if (current !== text) {
            console.error(`${rel} is out of date. Run: ${buildCmd}`);
            process.exit(1);
        }
        console.log(`${rel} is current: ${summary}`);
    } else {
        fs.writeFileSync(out, text);
        console.log(`Wrote ${rel}: ${summary}, ${(text.length / 1024).toFixed(0)} KB`);
    }
}

module.exports = {
    ROOT, SNAPSHOT, T, R, grader, gen, round1, pad3, enOf,
    PlotRecorder, fly, snapshotTracks, startRun, writeOrCheck,
    pictureMeasurements, maneuverMeasurements
};
