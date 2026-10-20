/**
 * Headless checks for the Picture Trainer — no dependencies:
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
    'scenario_bank', 'track_kinematics', 'symbology', 'scope_renderer', 'animation_engine', 'grading'
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
        alssaParseAltitudeK
    })`, sandbox);
}

const T = loadTrainer();
const failures = [];
let checks = 0;

function check(cond, where, msg) {
    checks += 1;
    if (!cond) failures.push(`${where}: ${msg}`);
}

const gen = new T.PictureGenerator({ callsign: 'TANGO' });
const clusterer = new T.TrackClusterer(T.PICTURE_RULES.groupNm, 1);
const grader = new T.PictureGrader(gen, clusterer);

/** Label each single-formation category must produce, every variation. */
const EXPECTED_LABEL = {
    azimuth: 'AZIMUTH', range: 'RANGE', wall: 'WALL', ladder: 'LADDER',
    champagne: 'CHAMPAGNE', vic: 'VIC', box: 'BOX'
};

/** A submission built straight from the key — must always score 100%. */
function perfectStudent(key) {
    const s = Object.assign({}, key.fields);
    if (key.anchors) {
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
                check(key.fields.label === EXPECTED_LABEL[cat.id], where, `label ${key.fields.label} — ${answer.text}`);
                check(key.fields.waveCount == null, where, 'single formation split into waves');
            }
            if (cat.id === 'waves' || cat.id === 'leading_edge') {
                check(key.fields.waveCount >= 2, where, `expected waves — ${answer.text}`);
                check(/LEADING EDGE/.test(answer.text), where, 'wave picture lacks LEADING EDGE');
            }
            if (cat.id === 'cap') {
                check(key.fields.track === 'CAP' && /CAP, HOSTILE/.test(answer.text), where, `cap — ${answer.text}`);
            }
            if (cat.id === 'packages') {
                check(key.family === 'packages' && key.fields.packageCount === 2, where, `packages — ${answer.text}`);
                check(key.anchors[0].bearing !== key.anchors[1].bearing || key.anchors[0].range !== key.anchors[1].range,
                    where, 'both packages anchored at the same point');
            }
            if (cat.id === 'threat') {
                check(key.family === 'braa' && /THREAT GROUP BRAA/.test(answer.text), where, answer.text);
                check(key.fields.braaRange >= 10 && key.fields.braaRange <= 35, where, `threat BRAA range ${key.fields.braaRange}`);
                check(key.fields.aspect === 'HOT', where, `threat pointed at fighter should be HOT, got ${key.fields.aspect}`);
            }
            if (cat.id === 'ea_bogey') {
                check(['braa', 'music', 'strobe'].includes(key.family) && !!answer.prompt, where, `ea/bogey — ${answer.text}`);
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
