/**
 * Headless checks for the BC3 Scope Trainer: no dependencies:
 *
 *     node simulator/tests/run_tests.js
 *
 * Covers the geography (overlays pinned to real coordinates), the missile envelope the
 * pilots shoot and defend by, and whole engagements run on the sim clock.
 */
const fs = require('fs');
const path = require('path');
const { loadSimulator } = require('./headless');

const failures = [];
let checks = 0;
function check(cond, where, msg) {
    checks += 1;
    if (!cond) failures.push(`${where}: ${msg}`);
}

const count = (events, type, pred) => events.filter(e => e.type === type && (!pred || pred(e))).length;

function inPolygon(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

// ------------------------------------------------------------------ geography

(function geography() {
    const airspace = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'geo', 'nttr_airspace.json'), 'utf8'));
    const byName = name => airspace.features.find(f => f.properties.name === name);

    ['DESERT MOA', 'REVEILLE NORTH MOA', 'REVEILLE SOUTH MOA', 'R-4806E', 'R-4806W', 'R-4807A',
        'R-4807B', 'R-4808N', 'R-4808S', 'R-4809', 'SHELL AAR', 'SHELL IP', 'SHELL CP']
        .forEach(name => check(!!byName(name), 'geo', `missing airspace feature ${name}`));
    airspace.features
        .filter(f => f.properties.kind === 'moa' || f.properties.kind === 'restricted')
        .forEach(f => check(f.properties.source === 'FAA SUA', 'geo', `${f.properties.name} is not from published data`));

    const sim = loadSimulator();
    sim.load('sc-01-single-commit');
    const p = sim.scope.geoProjection;

    // Bullseye is N38 W115; Nellis AFB is ~106 nm due south of it.
    const nellis = p.latLonToBearingRange(36.236, -115.034);
    check(Math.abs(nellis.bearing - 181) < 1.5 && Math.abs(nellis.range - 105.9) < 0.6, 'geo',
        `Nellis from bullseye ${nellis.bearing.toFixed(1)}/${nellis.range.toFixed(1)}`);
    const rt = p.bearingRangeToLatLon(nellis.bearing, nellis.range);
    check(Math.abs(rt.lat - 36.236) < 1e-3 && Math.abs(rt.lon + 115.034) < 1e-3, 'geo', 'bearing/range <-> lat/lon round trip');

    // To scale everywhere, not just along bullseye radials: canvas distance between any
    // two real places, divided by px/nm, must equal the great-circle distance.
    const places = {
        nellis: [36.2362, -115.0343], creech: [36.5872, -115.6734], tonopahTestRange: [37.7988, -116.7806],
        lasVegas: [36.0801, -115.1522], fallon: [39.4166, -118.7011], saltLake: [40.7884, -111.9778]
    };
    const haversineNm = (a, b) => {
        const r = Math.PI / 180;
        const h = Math.sin((b[0] - a[0]) * r / 2) ** 2
            + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2;
        return 2 * 3440.065 * Math.asin(Math.sqrt(h));
    };
    sim.scope.syncGeoProjection();
    const names = Object.keys(places);
    names.forEach((a, i) => names.slice(i + 1).forEach((b) => {
        const pa = p.latLonToXY(places[a][0], places[a][1]);
        const pb = p.latLonToXY(places[b][0], places[b][1]);
        const drawn = Math.hypot(pa.x - pb.x, pa.y - pb.y) / sim.scope.scale;
        const real = haversineNm(places[a], places[b]);
        check(Math.abs(drawn - real) / real < 0.005, 'scale', `${a}-${b} drawn ${drawn.toFixed(1)} nm, real ${real.toFixed(1)} nm`);
    }));
    // Sanity anchor for the reference maths itself: Nellis to Creech is roughly 37 nm.
    check(Math.abs(haversineNm(places.nellis, places.creech) - 37.3) < 1, 'scale', 'Nellis-Creech reference distance');

    // Background map is real boundary data, and lines up with known border coordinates.
    const aor = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'geo', 'nellis_aor.json'), 'utf8'));
    const nevada = aor.features.find(f => f.properties.name === 'Nevada');
    check(nevada && nevada.properties.source === 'US Census' && nevada.geometry.coordinates[0].length > 50, 'scale', 'Nevada outline is not real boundary data');
    const nvRing = nevada.geometry.coordinates[0];
    const near = (lon, lat) => nvRing.some(c => Math.abs(c[0] - lon) < 0.03 && Math.abs(c[1] - lat) < 0.03);
    check(near(-114.04, 37.0), 'scale', 'Nevada outline misses the NV/UT/AZ corner (N37 W114.04)');
    check(near(-120.0, 39.0), 'scale', 'Nevada outline misses the Lake Tahoe corner (N39 W120)');
    check(near(-120.0, 42.0) && near(-114.04, 42.0), 'scale', 'Nevada outline misses its northern corners');

    // The tanker's orbit must be the published SHELL track, inside the drawn AAR box.
    const box = byName('SHELL AAR').geometry.coordinates[0];
    const ip = byName('SHELL IP').geometry.coordinates;
    const anchor = sim.scope.hvaaAnchors[0];
    const centre = p.bearingRangeToLatLon(anchor.bearing, anchor.range);
    check(inPolygon(centre.lon, centre.lat, box), 'geo', 'SHELL orbit centre is outside the SHELL AAR box');
    const tanker = sim.tracks().find(t => t.type === 'tanker');
    const ipBr = p.latLonToBearingRange(ip[1], ip[0]);
    const start = sim.scope.calculateBRAA(tanker.bearing, tanker.range, ipBr.bearing, ipBr.range);
    check(start.range <= 1, 'geo', `tanker starts ${start.range} nm from the SHELL IP`);

    let outside = 0;
    sim.run(420, (scope) => {
        const ll = p.bearingRangeToLatLon(tanker.bearing, tanker.range);
        if (!inPolygon(ll.lon, ll.lat, box)) outside += 1;
    });
    check(outside === 0, 'geo', `tanker left the SHELL AAR box on ${outside} steps of its racetrack`);
    check(tanker.hvaaState === 'ORBIT', 'geo', 'tanker should still be on its orbit with no threat near');
})();

// ----------------------------------------------------------- missile envelope

/** One shooter, one target, pilots off: does a shot from `rangeNm` connect? */
function flyShot(weapon, rangeNm, targetRuns) {
    const sim = loadSimulator();
    const s = sim.scope;
    s.clearAllTracks();
    s.disablePilotAI = true;
    const hostileShooter = weapon !== 'FOX3';
    const shooter = s.addTrack(90, 10, 28000, 'SHOOTER', hostileShooter, 'fighter', 270, 450);
    const target = s.addTrack(270, rangeNm - 10, 28000, 'TARGET', !hostileShooter, 'fighter', 90, 450);
    [shooter, target].forEach(t => { t.airframe = t.hostile ? 'SU30' : 'F35'; sim.sandbox.initAircraftStores(t); });
    const perf = sim.sandbox.escapePerformance(target);
    s.spawnMissile({ shooter, target, type: weapon });
    sim.run(90, () => {
        if (targetRuns) {
            target.tacticalState = 'DEFEND';
            target.targetHeading = 270;
            target.speed = perf.dashKts;
        }
    });
    return { hit: !!target.isSplashed, env: sim.sandbox.missileEnvelope(weapon, { speed: 450, type: 'fighter', hostile: target.hostile, airframe: target.airframe }, 0) };
}

['FOX3', 'R77'].forEach((weapon) => {
    const { env } = flyShot(weapon, 20, false);
    check(env.rneNm < env.raeroNm, weapon, `no-escape ${env.rneNm} should be inside max range ${env.raeroNm}`);
    check(flyShot(weapon, env.rneNm - 2, true).hit, weapon, `shot inside no-escape range (${(env.rneNm - 2).toFixed(1)} nm) was outrun`);
    check(!flyShot(weapon, env.rneNm + 5, true).hit, weapon, `target could not outrun a shot from beyond no-escape range (${(env.rneNm + 5).toFixed(1)} nm)`);
    check(flyShot(weapon, env.raeroNm - 3, false).hit, weapon, `shot inside max range (${(env.raeroNm - 3).toFixed(1)} nm) fell short of a non-manoeuvring target`);
    check(!flyShot(weapon, env.raeroNm + 5, false).hit, weapon, `shot from beyond max range (${(env.raeroNm + 5).toFixed(1)} nm) still connected`);
});

// ---------------------------------------------------------------- engagements

function fly(id, seconds, dt) {
    const sim = loadSimulator();
    sim.load(id);
    sim.run(seconds, null, dt);
    const events = sim.events();
    const fighters = sim.tracks().filter(t => t.type === 'fighter');
    return {
        sim,
        events,
        blueLost: fighters.filter(t => !t.hostile && t.isSplashed).length,
        redLost: fighters.filter(t => t.hostile && t.isSplashed).length,
        reds: fighters.filter(t => t.hostile).length
    };
}

['sc-01-single-commit', 'sc-02-wall-ladder', 'sc-03-degraded-radar'].forEach((id) => {
    const r = fly(id, 1800, 0.1);
    const ev = r.events;

    // Debrief counters depend on these event names surviving (weapon goes in `weapon`).
    check(count(ev, 'splash') === r.blueLost + r.redLost - count(ev, 'gun_kill'), id, 'splash events do not match aircraft lost');
    check(count(ev, 'pitbull') > 0 && count(ev, 'missile_defeat') > 0, id, 'missile events lost their type');

    // Tactics outcome: the DCA holds and trades well.
    check(r.redLost > r.blueLost, id, `blue lost the exchange ${r.redLost} kills for ${r.blueLost} losses`);
    check(r.blueLost <= 1, id, `${r.blueLost} blue fighters lost`);
    check(!r.sim.tracks().find(t => t.type === 'tanker').isSplashed, id, 'tanker lost');

    // Missile economy: no hosing, at most three AIM-120s per kill.
    const blueShots = count(ev, 'fox3', e => e.weapon == null) + count(ev, 'fox_from_meld');
    check(blueShots <= 3 * Math.max(1, r.redLost), id, `${blueShots} AIM-120s for ${r.redLost} kills`);

    // Blue never shoots from outside max aero range; red never beyond its briefed WEZ caps.
    ev.filter(e => e.type === 'fox3' && e.weapon == null)
        .forEach(e => check(e.rangeNm <= e.raeroNm + 1, id, `${e.callsign} shot from ${e.rangeNm} nm, max range ${e.raeroNm}`));
    ev.filter(e => e.weapon === 'R77' && e.type === 'fox3').forEach(e => check(e.rangeNm <= 22, id, `R-77 shot at ${e.rangeNm}`));
    ev.filter(e => e.type === 'fox1').forEach(e => check(e.rangeNm <= 32, id, `R-27 shot at ${e.rangeNm}`));

    // No state flapping or targeting thrash.
    check(count(ev, 'red_commit') <= 3 * r.reds, id, `${count(ev, 'red_commit')} red_commit events for ${r.reds} reds`);
    check(count(ev, 'sort_assign') <= 6 * r.reds, id, `${count(ev, 'sort_assign')} sort_assign events`);
});

// Same fight at coarse steps (what 16x time compression produces) must still be won:
// AI timers run on the sim clock, not the wall clock.
(function timeCompression() {
    const r = fly('sc-01-single-commit', 1800, 0.3);
    check(r.redLost > r.blueLost && r.redLost >= 3, 'time-compression', `coarse-step fight went ${r.redLost}-${r.blueLost}`);
    const waves = r.events.filter(e => e.type === 'wave_release');
    check(waves.length === 2 && Math.abs(waves[1].simT - 90) < 1, 'time-compression', 'second wave must release at 90 sim seconds');
})();

// ------------------------------------------------------------- HVAA retrograde

(function hvaa() {
    const sim = loadSimulator();
    sim.load('sc-01-single-commit');
    const s = sim.scope;
    const tanker = sim.tracks().find(t => t.type === 'tanker');
    const leaker = s.addTrack(tanker.bearing, tanker.range + 12, 20000, 'LEAKER', true, 'fighter', 0, 480);
    leaker.airframe = 'SU30';
    sim.sandbox.initAircraftStores(leaker);
    leaker.ordnance = { FOX3: 0, R77: 0, R27: 0 };
    sim.run(5);
    check(tanker.hvaaState === 'SCRAM', 'hvaa', `tanker state ${tanker.hvaaState} with a bandit at 12 nm`);
    check(count(sim.events(), 'hvaa_scram') === 1, 'hvaa', 'hvaa_scram not logged exactly once');
    const away = s.calculateBRAA(leaker.bearing, leaker.range, tanker.bearing, tanker.range).bearing;
    const off = Math.abs(((tanker.targetHeading - away + 540) % 360) - 180);
    check(off < 15, 'hvaa', `tanker steering ${Math.round(tanker.targetHeading)} is not away from the threat (${Math.round(away)})`);
})();

// -------------------------------------------------------------------- WD seat

function perfectStudent(key) {
    const s = Object.assign({}, key.fields);
    if (key.anchors) {
        s.bullsBearing = key.anchors[0].bearing;
        s.bullsRange = key.anchors[0].range;
        s.altitude = key.anchors[0].altitudeK;
    }
    Object.keys(s).forEach((k) => { s[k] = s[k] == null ? '' : String(s[k]); });
    return s;
}

// A WD who says nothing: fighters must hold CAP, then look after themselves, and the debrief must say so.
(function silentWd() {
    const sim = loadSimulator();
    sim.load('sc-01-single-commit');
    const wd = sim.scope.wdSeat;
    wd.setEnabled(true);
    const blues = () => sim.tracks().filter(t => !t.hostile && t.type === 'fighter');

    sim.run(520);
    check(blues().every(b => b.tacticalState === 'CAP'), 'wd-silent',
        `fighters left CAP without a commit: ${blues().map(b => b.tacticalState).join(',')}`);
    sim.run(1280);
    const d = wd.debrief();
    check(Object.values(wd.commits).some(c => c.verdict === 'fighter-initiated'), 'wd-silent', 'no fighter-initiated commit recorded');
    check(d.sections.commit.score === 0, 'wd-silent', `commit scored ${d.sections.commit.score}`);
    check(d.sections.targeting.score === 0, 'wd-silent', `targeting scored ${d.sections.targeting.score}`);
    check(d.sections.picture.score === 0 && d.sections.picture.items.length >= 2, 'wd-silent', 'missing pictures not charged');
    check(d.overall != null && d.overall < 35, 'wd-silent', `silent WD scored ${d.overall}%`);
    check(wd.frames.length > 100 && wd.frameAt(300).simT <= 300, 'wd-silent', 'replay frames not recorded');
})();

// A WD who does the job on time: pictures on each new group, commit inside the window, every group targeted.
(function workingWd() {
    const sim = loadSimulator();
    sim.load('sc-01-single-commit');
    const wd = sim.scope.wdSeat;
    wd.setEnabled(true);
    const leads = wd.flightLeads();
    const viper = leads.find(l => /VIPER/.test(l.callsign));
    const raptor = leads.find(l => /RAPTOR/.test(l.callsign));
    let picturesMade = 0;

    sim.run(1800, () => {
        // Picture 10 s after each new group appears.
        if (wd.pictureTriggers.length > picturesMade
            && wd.now() - wd.pictureTriggers[picturesMade].simT >= 10) {
            const answer = wd.openPicture();
            wd.submitPicture(perfectStudent(answer.answerKey));
            picturesMade += 1;
        }
        // Target: first two bandits to VIPER, the rest to RAPTOR, as soon as they are on scope.
        wd.scopeGroups().groups.forEach((g) => {
            if (g.ids.every(id => wd.hostiles[id] && wd.hostiles[id].targetedT != null)) return;
            const firstWave = g.tracks.every(t => /BANDIT[12]$/.test(t.callsign));
            wd.target(firstWave ? viper.id : raptor.id, g);
        });
        // Commit each flight when its nearest hostile is inside 85 nm.
        [viper, raptor].forEach((lead) => {
            if (!wd.commits[String(lead.id)] && wd.nearestHostileNm(lead) <= 85) wd.commit(lead.id);
        });
    });

    const d = wd.debrief();
    const fighters = sim.tracks().filter(t => t.type === 'fighter');
    check(d.sections.picture.score >= 95, 'wd-working', `picture ${d.sections.picture.score}: ${JSON.stringify(d.sections.picture.items.map(i => i.verdict + (i.misses || []).join(';')))}`);
    check(d.sections.commit.items.length === 2 && d.sections.commit.score === 100, 'wd-working', `commit ${JSON.stringify(d.sections.commit.items)}`);
    check(d.sections.targeting.items.length === 4 && d.sections.targeting.score === 100, 'wd-working', `targeting ${JSON.stringify(d.sections.targeting.items)}`);
    check(d.overall >= 85, 'wd-working', `working WD scored ${d.overall}%`);
    check(fighters.filter(f => f.hostile).every(f => f.isSplashed), 'wd-working', 'hostiles survived a well-controlled fight');
    check(fighters.filter(f => !f.hostile && f.isSplashed).length <= 1, 'wd-working', 'blue losses under good control');
    // Fighters fought who they were targeted on.
    const kills = sim.events().filter(e => e.type === 'splash' && e.shooterHostile === false);
    check(kills.filter(k => /BANDIT[12]$/.test(k.targetCallsign)).every(k => /VIPER/.test(k.callsign)), 'wd-working',
        `first wave was targeted to VIPER but killed by ${kills.map(k => k.callsign + '>' + k.targetCallsign).join(', ')}`);

    // A THREAT call is graded as BRAA from the named fighter.
    const sim2 = loadSimulator();
    sim2.load('sc-01-single-commit');
    const wd2 = sim2.scope.wdSeat;
    wd2.setEnabled(true);
    sim2.run(5);
    const group = wd2.scopeGroups().groups[0];
    const blue = wd2.blueFighters()[0];
    const good = wd2.submitThreat(blue.id, group, perfectStudent(wd2.threatKey(blue, group)));
    check(good.score === 100, 'wd-threat', `correct BRAA scored ${good.score}`);
    const bad = wd2.submitThreat(blue.id, group, { braaBearing: '090', braaRange: '5', altitude: '1', aspect: 'DRAG' });
    check(bad.score === 0, 'wd-threat', `wrong BRAA scored ${bad.score}`);
})();

// Seat off: nothing about the fight changes (covered by the scenario runs above), and auto switches hand tasks back.
(function autoSwitches() {
    const sim = loadSimulator();
    sim.load('sc-01-single-commit');
    const wd = sim.scope.wdSeat;
    wd.setEnabled(true);
    wd.auto.commit = true;
    wd.auto.targeting = true;
    sim.run(1800);
    const d = wd.debrief();
    const fighters = sim.tracks().filter(t => t.type === 'fighter');
    check(fighters.filter(f => f.hostile).every(f => f.isSplashed), 'wd-auto', 'fight changed with commit and targeting on auto');
    check(d.sections.commit.items.length === 0 && d.sections.targeting.items.length === 0, 'wd-auto', 'auto functions were graded');
})();

if (failures.length) {
    console.error(`${failures.length} of ${checks} checks FAILED`);
    failures.slice(0, 50).forEach(f => console.error(`  - ${f}`));
    process.exit(1);
}
console.log(`All ${checks} checks passed`);
