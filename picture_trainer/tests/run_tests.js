/**
 * Headless checks for the Picture Trainer: no dependencies:
 *
 *     node picture_trainer/tests/run_tests.js
 *
 * Loads the browser scripts into a VM with a stub canvas, then sweeps every
 * category x variation x orientation and asserts that the generated answer
 * matches what the generator intended, stays stable while tracks ingress,
 * and that a perfect student submission grades 100%.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
const SCRIPTS = [
    'orientation', 'clustering', 'alssa_format', 'picture_logic', 'formation_generator',
    'scenario_bank', 'track_kinematics', 'maneuvers', 'symbology', 'scope_renderer', 'animation_engine', 'grading'
];

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
        const file = path.join(SRC, `${name}.js`);
        vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    });
    // Top-level const/class declarations are not properties of the sandbox; pull them out.
    return vm.runInContext(`({
        Geo, getOrientation, PICTURE_RULES, PictureGenerator, TrackClusterer, PictureGrader,
        ScopeRenderer, AnimationEngine, SCENARIO_CATEGORIES, VARIATIONS_PER_CATEGORY,
        ANSWER_FAMILIES, categorySeed, generateScenario, alssaNumberToWords, alssaParseNumber,
        alssaParseAltitudeK, ManeuverDirector
    })`, sandbox);
}

const T = loadTrainer();
const failures = [];
let checks = 0;

function check(cond, where, msg) {
    checks += 1;
    if (!cond) failures.push(`${where}: ${msg}`);
}

const gen = new T.PictureGenerator({ callsign: 'WARRIOR' });
const clusterer = new T.TrackClusterer(T.PICTURE_RULES.groupNm, 1);
const grader = new T.PictureGrader(gen, clusterer);

/** Label each single-formation category must produce, every variation. */
const EXPECTED_LABEL = {
    azimuth: 'AZIMUTH', range: 'RANGE', wall: 'WALL', ladder: 'LADDER',
    champagne: 'CHAMPAGNE', vic: 'VIC', box: 'BOX'
};

/** A submission built straight from the key: must always score 100%. */
function perfectStudent(key) {
    const s = Object.assign({}, key.fields);
    if (key.anchors && key.family === 'maneuver') {
        s.splitBearing = key.anchors[0].bearing;
        s.splitRange = key.anchors[0].range;
    } else if (key.anchors) {
        s.bullsBearing = key.anchors[0].bearing;
        s.bullsRange = key.anchors[0].range;
        s.altitude = key.anchors[0].altitudeK;
    }
    Object.keys(s).forEach(k => { s[k] = s[k] == null ? '' : String(s[k]); });
    return s;
}

function simulate(scenario, seconds) {
    const scope = new T.ScopeRenderer('tacScope');
    const anim = new T.AnimationEngine(scope);
    scope.tracks = scenario.tracks;
    anim.reset(scope.tracks, scenario.motionScript);
    for (let t = 0; t < seconds * 20 && !anim.paused; t++) anim.update(0.05);
    return anim;
}

// ---------------------------------------------------------------- unit checks

(function formatting() {
    const cases = [[0, 'ZERO'], [7, 'SEVEN'], [21, 'TWENTY-ONE'], [45, 'FORTY-FIVE'], [98, 'NINETY-EIGHT'],
        [100, 'ONE HUNDRED'], [110, 'ONE HUNDRED TEN'], [137, 'ONE HUNDRED THIRTY-SEVEN']];
    cases.forEach(([n, words]) => {
        check(T.alssaNumberToWords(n) === words, 'format', `${n} -> ${T.alssaNumberToWords(n)}`);
        check(T.alssaParseNumber(words) === n, 'format', `parse "${words}" -> ${T.alssaParseNumber(words)}`);
    });
    check(T.alssaParseNumber('32') === 32, 'format', 'digits');
    check(isNaN(T.alssaParseNumber('')) && isNaN(T.alssaParseNumber('wall')), 'format', 'non-numbers are NaN');
    [['32', 32], ['32k', 32], ['32000', 32], ['32,000', 32], ['thirty-two thousand', 32], ['8', 8]]
        .forEach(([text, k]) => check(T.alssaParseAltitudeK(text) === k, 'format', `altitude "${text}"`));
})();

(function geometry() {
    const p = { bearing: 350, range: 80 };
    const back = T.Geo.enToBulls(T.Geo.bullsToEN(p));
    check(Math.abs(back.bearing - 350) < 1e-9 && Math.abs(back.range - 80) < 1e-9, 'geo', 'bulls <-> EN round trip');
    const br = T.Geo.bearingRange({ bearing: 180, range: 10 }, { bearing: 90, range: 10 });
    check(Math.abs(br.bearing - 45) < 1e-6, 'geo', `bearing S-point -> E-point should be 045, got ${br.bearing}`);
    check(T.Geo.angleDiff(358, 3) === 5, 'geo', 'angleDiff wraps through north');
    // Two contacts straddling north must centroid on north, not on 180.
    const g = clusterer.createGroup([{ bearing: 358, range: 80, hostile: true }, { bearing: 2, range: 80, hostile: true }]);
    check(T.Geo.angleDiff(g.centroid.bearing, 0) < 0.5, 'geo', `centroid across 360 -> ${g.centroid.bearing}`);
    ['EW', 'NS'].forEach(o => {
        const orient = T.getOrientation(o);
        const ax = T.Geo.toAxis(p, orient);
        const rt = T.Geo.fromAxis(ax, orient);
        check(T.Geo.angleDiff(rt.bearing, 350) < 1e-6 && Math.abs(rt.range - 80) < 1e-6, 'geo', `axis round trip ${o}`);
    });
})();

// ------------------------------------------------------------ scenario sweep

['EW', 'NS'].forEach(orientation => {
    T.SCENARIO_CATEGORIES.forEach(cat => {
        for (let v = 1; v <= T.VARIATIONS_PER_CATEGORY; v++) {
            const where = `${cat.id}/${orientation}/v${v}`;
            const seed = T.categorySeed(cat.id, v);
            let scenario;
            let answer;
            try {
                scenario = T.generateScenario({ category: cat.id, seed, orientation });
                answer = grader.buildAnswer(scenario.tracks, scenario.meta, orientation);
            } catch (e) {
                check(false, where, `threw ${e.stack}`);
                continue;
            }
            const key = answer.answerKey;
            const hostiles = scenario.tracks.filter(t => t.hostile);

            check(!/NaN|undefined|null|\[object/.test(answer.text), where, `bad text ${answer.text}`);
            check(key && T.ANSWER_FAMILIES[key.family], where, 'missing answer family');
            if (!key) continue;

            // The 3 nm rule applied to what is drawn must agree with the generator's groups.
            check(clusterer.cluster(hostiles).length === scenario.hostileGroupCount, where,
                `3 nm clustering sees ${clusterer.cluster(hostiles).length} groups, generator made ${scenario.hostileGroupCount}`);
            hostiles.forEach(t => check(t.bearing >= 0 && t.bearing < 360 && t.range > 0, where, `track ${t.id} bulls ${t.bearing}/${t.range}`));

            if (key.family === 'picture') {
                check(key.fields.groupCount === scenario.hostileGroupCount, where, `group count ${key.fields.groupCount}`);
            }
            if (EXPECTED_LABEL[cat.id]) {
                check(key.fields.label === EXPECTED_LABEL[cat.id], where, `label ${key.fields.label}: ${answer.text}`);
                check(key.fields.waveCount == null, where, 'single formation split into waves');
            }
            if (cat.id === 'waves' || cat.id === 'leading_edge') {
                check(key.fields.waveCount >= 2, where, `expected waves: ${answer.text}`);
                check(/LEADING EDGE/.test(answer.text), where, 'wave picture lacks LEADING EDGE');
            }
            if (cat.id === 'cap') {
                check(key.fields.track === 'CAP' && /CAP, HOSTILE/.test(answer.text), where, `cap: ${answer.text}`);
            }
            if (cat.id === 'packages') {
                check(key.family === 'packages' && key.fields.packageCount === 2, where, `packages: ${answer.text}`);
                check(key.anchors[0].bearing !== key.anchors[1].bearing || key.anchors[0].range !== key.anchors[1].range,
                    where, 'both packages anchored at the same point');
            }
            if (cat.id === 'threat') {
                check(key.family === 'braa' && /THREAT GROUP BRAA/.test(answer.text), where, answer.text);
                check(key.fields.braaRange >= 10 && key.fields.braaRange <= 35, where, `threat BRAA range ${key.fields.braaRange}`);
                check(key.fields.aspect === 'HOT', where, `threat pointed at fighter should be HOT, got ${key.fields.aspect}`);
            }
            if (cat.id === 'ea_bogey') {
                check(['braa', 'music', 'strobe'].includes(key.family) && !!answer.prompt, where, `ea/bogey: ${answer.text}`);
            }
            (key.anchors || []).forEach(a => check(a.bearing >= 0 && a.bearing < 360, where, `anchor bearing ${a.bearing}`));

            const perfect = grader.gradeStudent(perfectStudent(key), key);
            check(perfect.score === 100, where,
                `perfect answer scored ${perfect.score}: ${perfect.details.filter(d => !d.ok).map(d => d.field).join(', ')}`);
            const blank = grader.gradeStudent({}, key);
            check(blank.score < 70, where, `blank form scored ${blank.score}`);

            // 90 s of ingress must not change the structure of the answer or split a group.
            if (cat.id !== 'threat') {
                simulate(scenario, 90);
                const later = grader.buildAnswer(scenario.tracks, scenario.meta, orientation).answerKey;
                check(later.family === key.family, where, 'family changed in flight');
                ['groupCount', 'waveCount', 'label', 'packageCount'].forEach(f => {
                    check(later.fields[f] === key.fields[f], where, `${f} drifted ${key.fields[f]} -> ${later.fields[f]} after 90 s`);
                });
                if (cat.id !== 'cap') {
                    check(clusterer.cluster(scenario.tracks.filter(t => t.hostile)).length === scenario.hostileGroupCount,
                        where, 'a group split or merged under the 3 nm rule after 90 s');
                }
            }
        }
    });
});

// --------------------------------------------------------------- maneuvers

/** Step an existing animation; stops early on a pause or when `until` holds. */
function step(anim, seconds, until) {
    for (let t = 0; t < seconds * 20 && !anim.paused; t++) {
        anim.update(0.05);
        if (until && until()) return true;
    }
    return !!(until && until());
}

const PICTURE_LABELS = /\b(AZIMUTH|RANGE|WALL|LADDER|CHAMPAGNE|VIC|BOX|LEADING EDGE|WAVE|PACKAGES|WIDE|DEEP)\b/;

/**
 * Call the picture, then let the director maneuver groups: every maneuver must be
 * called by the name from that picture (or from an earlier split), never with a new
 * label, match the scripted maneuver, grade 100% when answered perfectly, and never
 * merge two groups. A SPLIT must add exactly one group.
 */
function runManeuvers(where, scenario, orientation, callAfterSec, stats) {
    const scope = new T.ScopeRenderer('tacScope');
    const anim = new T.AnimationEngine(scope);
    const director = new T.ManeuverDirector();
    anim.maneuvers = director;
    // A coarser sim step keeps the sweep fast; turns still integrate in < 0.5 degree steps.
    anim.fixedStep = 0.1;
    scope.tracks = scenario.tracks;
    anim.reset(scope.tracks, scenario.motionScript);
    director.reset(scenario.meta, true);

    step(anim, callAfterSec);
    const picture = grader.buildAnswer(scope.tracks, scenario.meta, orientation);
    check(director.commit(picture, anim.simTime), where, 'picture did not commit for maneuvers');
    anim.resumeRun();
    const names = new Set(picture.named.map(n => n.name));
    const hostiles = () => scope.tracks.filter(t => t.hostile);
    let groupCount = scenario.hostileGroupCount;

    while (director.phase === 'maneuvers') {
        const seen = step(anim, 120, () => !!director.pending(scope.tracks) || director.phase !== 'maneuvers');
        if (director.phase !== 'maneuvers') break;
        check(!anim.paused, where, `run froze at T+${Math.round(anim.simTime)} before maneuver ${director.called + 1}`);
        check(seen, where, 'scheduled maneuver never became visible');
        if (!seen) return;

        const m = director.pending(scope.tracks);
        const answer = grader.buildManeuverAnswer(scope.tracks, director);
        const key = answer.answerKey;
        check(key && key.family === 'maneuver', where, 'no maneuver answer key');
        check(names.has(key.fields.groupName), where, `maneuver names ${key.fields.groupName}, not a group from the picture`);
        check(!PICTURE_LABELS.test(answer.text.replace(key.fields.groupName, '')), where, `maneuver re-labels the picture: ${answer.text}`);
        check(key.fields.maneuver === m.type, where, `scripted ${m.type}, called ${key.fields.maneuver}: ${answer.text}`);
        check(grader.gradeStudent(perfectStudent(key), key).score === 100, where, `perfect maneuver call not 100%: ${answer.text}`);
        if (key.fields.direction) {
            const wrong = Object.assign(perfectStudent(key), { direction: T.Geo.cardinal8(key.heading + 180) });
            check(grader.gradeStudent(wrong, key).score < 100, where, 'reciprocal direction graded correct');
        }
        if (m.type === 'SPLIT') {
            groupCount += 1;
            check(key.anchors.length === 2 && key.anchors[0].name !== key.anchors[1].name, where, `split pieces ${answer.text}`);
            check(key.anchors.every(a => !names.has(a.name)), where, `split piece reuses a called name: ${answer.text}`);
            const second = Object.assign(perfectStudent(key), { splitBearing: String(key.anchors[1].bearing), splitRange: String(key.anchors[1].range) });
            check(grader.gradeStudent(second, key).score === 100, where, 'either split piece should be a valid anchor');
            const off = Object.assign(perfectStudent(key), { splitRange: String(key.anchors[0].range + 20) });
            check(grader.gradeStudent(off, key).score < 100, where, 'split BULLSEYE 20 nm off graded correct');
        } else {
            const stray = Object.assign(perfectStudent(key), { splitBearing: '270', splitRange: '80' });
            check(grader.gradeStudent(stray, key).score < 100, where, 'BULLSEYE on a track maneuver graded correct');
        }
        stats.maneuvers += 1;
        stats.types[m.type] = (stats.types[m.type] || 0) + 1;

        // Finish the turn and fly it out: the 3 nm rule must still see the same groups.
        for (let s = 0; s < 6; s++) {
            step(anim, 10);
            check(clusterer.cluster(hostiles()).length === groupCount, where,
                `3 nm rule sees ${clusterer.cluster(hostiles()).length} groups, expected ${groupCount}, ${s * 10 + 10} s into a ${m.type}`);
        }
        const settled = grader.buildManeuverAnswer(scope.tracks, director).answerKey;
        check(settled && settled.fields.maneuver === m.type, where, `${m.type} read as ${settled && settled.fields.maneuver} once settled`);
        if (m.type === 'SPLIT') settled.anchors.forEach(a => names.add(a.name));
        director.markCalled(anim.simTime, scope.tracks);
    }
    if (director.called) stats.scenarios += 1;
    stats.total += 1;
}

(function maneuverSweep() {
    const stats = { scenarios: 0, total: 0, maneuvers: 0, types: {} };
    ['EW', 'NS'].forEach(orientation => {
        T.SCENARIO_CATEGORIES.forEach(cat => {
            for (let v = 1; v <= T.VARIATIONS_PER_CATEGORY; v++) {
                const seed = T.categorySeed(cat.id, v);
                const scenario = T.generateScenario({ category: cat.id, seed, orientation });
                const where = `maneuver ${cat.id}/${orientation}/v${v}`;
                if (scenario.meta.mode != null) {
                    const d = new T.ManeuverDirector();
                    d.reset(scenario.meta, true);
                    check(!d.canCommit, where, 'BRAA / EA drill should not maneuver');
                    continue;
                }
                // Alternate an early call with one made after the run froze at the stop line.
                try {
                    runManeuvers(where, scenario, orientation, v % 3 === 0 ? 1200 : 20, stats);
                } catch (e) {
                    check(false, where, `threw ${e.stack}`);
                }
            }
        });
    });
    check(stats.scenarios >= stats.total * 0.9, 'maneuver', `only ${stats.scenarios} of ${stats.total} pictures got a maneuver`);
    ['HOT', 'FLANK', 'BEAM', 'DRAG', 'SPLIT'].forEach(t => check(stats.types[t] > 0, 'maneuver', `no ${t} maneuvers in the sweep`));
    console.log(`  maneuvers: ${stats.maneuvers} across ${stats.scenarios}/${stats.total} pictures`, JSON.stringify(stats.types));
})();

(function maneuverGrading() {
    const key = { family: 'maneuver', fields: { groupName: 'NORTH GROUP', maneuver: 'FLANK', direction: 'NORTH' },
        heading: 20, tolerances: T.PICTURE_RULES.tolerances };
    const grade = s => grader.gradeStudent(s, key).score;
    check(grade({ groupName: 'north group', maneuver: 'flank', direction: 'N' }) === 100, 'maneuver', 'abbreviated cardinal');
    check(grade({ groupName: 'NORTH', maneuver: 'FLANK NORTH', direction: 'NORTHEAST' }) === 100, 'maneuver', 'adjacent cardinal within 30 deg');
    check(grade({ groupName: 'SOUTH GROUP', maneuver: 'FLANK', direction: 'NORTH' }) < 100, 'maneuver', 'wrong group accepted');
    check(grade({ groupName: 'NORTH GROUP', maneuver: 'BEAM', direction: 'NORTH' }) < 100, 'maneuver', 'wrong aspect accepted');
    check(grade({ groupName: 'NORTH GROUP', maneuver: 'FLANK', direction: 'EAST' }) < 100, 'maneuver', 'direction 70 deg off accepted');
    const hot = { family: 'maneuver', fields: { groupName: 'GROUP', maneuver: 'HOT', direction: null }, heading: 90,
        tolerances: T.PICTURE_RULES.tolerances };
    check(grader.gradeStudent({ groupName: 'single group', maneuver: 'HOT', direction: '' }, hot).score === 100, 'maneuver', 'HOT single group');
})();

// ------------------------------------------------------------------ run end

(function runCompletes() {
    const scenario = T.generateScenario({ category: 'wall', seed: T.categorySeed('wall', 1), orientation: 'EW' });
    const anim = simulate(scenario, 1200);
    check(anim.runComplete && anim.paused, 'run', 'ingress never reached the stop line / did not freeze');
    const threat = T.generateScenario({ category: 'threat', seed: T.categorySeed('threat', 1), orientation: 'NS' });
    check(simulate(threat, 1200).runComplete, 'run', 'threat run never completed');
})();

if (failures.length) {
    console.error(`${failures.length} of ${checks} checks FAILED`);
    failures.slice(0, 60).forEach(f => console.error(`  - ${f}`));
    process.exit(1);
}
console.log(`All ${checks} checks passed`);
