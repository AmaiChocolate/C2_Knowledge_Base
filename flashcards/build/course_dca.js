/**
 * WD from Zero, module 8: the DCA flow, from the BC3 Scope Trainer.
 *
 * Each scenario is flown headlessly with the WD seat on and no WD calls, so the flights
 * hold CAP until the trainee would commit them (or until they commit themselves inside
 * the self-commit range). Stills every FRAME_SEC become questions graded by the seat's
 * own standards (WD_STANDARDS in simulator/src/wd_seat.js):
 *   COMMIT     on time with the nearest hostile 95 to 50 nm from the flight lead
 *   TARGETING  every group before it is within 45 nm of a fighter, closest first
 *   THREAT     an untargeted hostile within 15 nm of a fighter, in BRAA to that fighter
 * Those numbers are mission-planned in the real world; the course says so.
 *
 * Seeds only change missile outcomes, so runs are identical until the first shots:
 * seed 1 gives the whole run, the other seeds only the fight after MERGE_SEC.
 * sc-03 (degraded radar) is left out: its scope can hide hostiles the seat still counts.
 */
const { loadSimulator } = require('../../simulator/tests/headless');
const { round1, pad3 } = require('./harness');
const { rngFor, pick, shuffle, addSceneData, add, choice, soloCall } = require('./course_lib');

const SCENARIOS = ['sc-01-single-commit', 'sc-02-wall-ladder'];
const SEEDS = [1, 2, 3];
const FRAME_SEC = 15;          // a still every 15 s on the way in
const MERGE_FRAME_SEC = 5;     // and every 5 s once the fight starts
const MERGE_SEC = 760;         // about when the first shots go (both scenarios)
const RUN_SEC = 1150;
const PLOT_SEC = 4;
const PLOTS_KEPT = 8;
const EDGE_NM = 3;            // no commit question this close to a window edge

function buildM8() {
    SCENARIOS.forEach(scenarioId => SEEDS.forEach(seed => flyScenario(scenarioId, seed)));
}

function flyScenario(scenarioId, seed) {
    const sim = loadSimulator({ seed });
    sim.load(scenarioId);
    const scope = sim.scope;
    const seat = scope.wdSeat;
    seat.setEnabled(true);
    const G = sim.sandbox;
    const S = seat.standards;
    const commitNm = scope.fighterCommitNm != null ? scope.fighterCommitNm : 50;
    const commitChoices = [
        `Hold at CAP: nearest hostile beyond ${S.commitEarlyNm} nm`,
        `COMMIT: nearest hostile between ${S.commitEarlyNm} and ${commitNm} nm`,
        `COMMIT now, late: nearest hostile already inside ${commitNm} nm`
    ];
    const trails = new Map();
    const tag = `${scenarioId.slice(0, 5)}-s${seed}`;
    const rng = rngFor(tag);

    for (let t = 0; t <= RUN_SEC; t += PLOT_SEC) {
        if (t > 0) sim.run(PLOT_SEC);
        visible(scope).forEach(tr => {
            const list = trails.get(tr.id) || [];
            list.push(en(tr));
            if (list.length > PLOTS_KEPT) list.shift();
            trails.set(tr.id, list);
        });
        const every = t >= MERGE_SEC ? MERGE_FRAME_SEC : FRAME_SEC;
        if (t % every !== 0 || t < FRAME_SEC || (seed > 1 && t < MERGE_SEC)) continue;

        const hostiles = seat.aliveHostiles();
        const leads = seat.flightLeads();
        const { groups } = seat.scopeGroups();
        // Refer to groups by their tagged lead: the seat's picture names are not always readable
        // out of context (a wave picture's lead group comes out as SINGLE GROUP).
        groups.forEach(g => { g.label = `${(g.lead || g.tracks[0]).callsign}'s group (BULLSEYE ${G.alssaBearingRange(g.centroid)})`; });
        if (!hostiles.length) break;
        if (!groups.length || !leads.length) continue;

        const near = leads.map(lead => {
            let best = null;
            hostiles.forEach(h => {
                const r = G.Geo.distance(lead, h);
                if (!best || r < best.r) best = { h, r };
            });
            const r = seat.nearestHostileNm(lead);
            const group = seat.groupOfTrack(best.h.id);
            return { lead, r, group, committed: !!seat.commits[String(lead.id)] };
        });
        const blues = seat.blueFighters();
        const threats = [];
        blues.forEach(b => hostiles.forEach(h => {
            const r = G.Geo.distance(b, h);
            if (r <= S.threatNm) threats.push({ b, h, r });
        }));
        threats.sort((a, b) => a.r - b.r);

        const sceneId = `m8-${tag}-t${t}`;
        const ms = {
            title: 'Each flight to its nearest group',
            rows: near.map(x => `${x.lead.callsign.padEnd(9)} ${String(Math.round(x.r)).padStart(3)} nm${x.committed ? '  committed' : ''}`),
            lines: near.filter(x => x.group).map(x => ({ a: en(x.lead), b: en(x.group.centroid) }))
        };
        addSceneData(sceneId, { axis: 270, tracks: snapshot(scope, groups, trails, G), ms });
        const clock = `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        const base = (s, k) => ({ id: `${sceneId}-${k}`, m: 'm8', s, sc: sceneId, info: `${clock}. Trainer standards: commit ${S.commitEarlyNm} to ${commitNm} nm, target before ${S.targetingRangeNm} nm, THREAT inside ${S.threatNm} nm.` });

        // COMMIT: one uncommitted flight per still, away from the window edges.
        const waiting = near.filter(x => !x.committed && Math.abs(x.r - S.commitEarlyNm) > EDGE_NM && Math.abs(x.r - commitNm) > EDGE_NM);
        const farOut = waiting.every(x => x.r > S.commitEarlyNm + 20);
        if (waiting.length && (!farOut || rng() < 0.35)) {
            const x = pick(rng, waiting);
            const ans = x.r > S.commitEarlyNm ? 0 : x.r >= commitNm ? 1 : 2;
            add(Object.assign(base('guided', `commit-${x.lead.callsign}`), {
                t: 'choice', choices: commitChoices, a: ans,
                prompt: `Should you commit ${x.lead.callsign}?`,
                why: `${x.lead.callsign}'s nearest hostile is ${Math.round(x.r)} nm (readout). The trainer's commit window is ${S.commitEarlyNm} to ${commitNm} nm: `
                    + ['beyond it, hold at CAP.', `inside it: "${x.lead.callsign}, COMMIT".`, `inside ${commitNm} nm is late; commit now. Inside ${S.selfCommitNm} nm the fighters commit themselves.`][ans]
            }));
        }

        // TARGETING: the group closest to any fighter goes first.
        const byGroup = groups.map(g => {
            let best = null;
            blues.forEach(b => {
                const r = G.Geo.distance(b, g.centroid);
                if (!best || r < best.r) best = { b, r };
            });
            return { g, r: best.r, b: best.b };
        }).sort((a, b) => a.r - b.r);
        if (byGroup.length > 1 && byGroup[1].r - byGroup[0].r > EDGE_NM && byGroup[0].r < 110) {
            const first = byGroup[0];
            choice(rng, Object.assign(base('guided', 'target'), {
                prompt: 'Which group do you target first?',
                why: `Every group must be targeted before it is within ${S.targetingRangeNm} nm of a fighter (trainer standard). ${first.g.label} is closest: ${Math.round(first.r)} nm from ${first.b.callsign}.`
            }), first.g.label, byGroup.slice(1, 4).map(x => x.g.label));
        }

        // THREAT: an untargeted hostile inside the threat range of a fighter.
        let threatCall = null;
        const closest = Math.min(...threats.map(x => x.r), ...near.map(x => x.r));
        if (threats.length) {
            const { b, h } = threats[0];
            const group = seat.groupOfTrack(h.id);
            if (group) {
                const key = seat.threatKey(b, group);
                const aspect = seat.pictureGen.aspect(group, b);
                const call = `${b.callsign}, THREAT GROUP BRAA ${pad3(key.fields.braaBearing)}/${key.fields.braaRange}, ${G.alssaFormatAltitude(group.centroid.altitude)}, ${aspect}, HOSTILE`;
                threatCall = call;
                const tb = Object.assign(base('guided', 'threat'), { call });
                choice(rng, Object.assign(tb, {
                    prompt: 'Is a THREAT call due? To whom?',
                    why: `An untargeted hostile is ${Math.round(threats[0].r)} nm from ${b.callsign}: inside ${S.threatNm} nm, so ${b.callsign} gets a THREAT call (due within ${S.threatDueSec} s).`
                }), `THREAT call to ${b.callsign}`, shuffle(rng, blues.filter(x => x !== b).map(x => `THREAT call to ${x.callsign}`)).slice(0, 2).concat(['No THREAT call needed']));
                add(Object.assign(base('build', 'threat-braa'), {
                    call, t: 'fields', prompt: `Build the THREAT call to ${b.callsign}.`,
                    fields: [
                        { k: 'brg', kind: 'bearing', label: `BRAA bearing from ${b.callsign}`, v: key.fields.braaBearing, tol: key.tolerances.bearingDeg },
                        { k: 'rng', kind: 'num', label: 'BRAA range (nm)', v: key.fields.braaRange, tol: key.tolerances.rangeNm },
                        { k: 'alt', kind: 'num', label: 'Altitude (thousands of ft)', v: key.fields.altitude, tol: key.tolerances.altitudeK },
                        { k: 'aspect', kind: 'select', label: 'Aspect', options: ['HOT', 'FLANK', 'BEAM', 'DRAG'], v: key.fields.aspect }
                    ],
                    why: 'THREAT: to the threatened fighter, BRAA from that fighter, altitude, aspect, declaration.'
                }));
            }
        } else if (closest < S.threatNm + 25 && rng() < 0.5) {
            choice(rng, Object.assign(base('guided', 'threat'), {
                prompt: 'Is a THREAT call due? To whom?',
                why: `No hostile is inside ${S.threatNm} nm of a fighter yet (closest ${Math.round(closest)} nm), so no THREAT call.`
            }), 'No THREAT call needed', shuffle(rng, blues.map(x => `THREAT call to ${x.callsign}`)).slice(0, 3));
        }

        // SOLO: everything due right now.
        const due = [];
        near.filter(x => !x.committed && x.r <= S.commitEarlyNm).forEach(x => {
            due.push(`${x.lead.callsign}, COMMIT.${x.r < commitNm ? ' (late: inside 50 nm)' : ''}`);
        });
        byGroup.filter(x => x.r <= S.targetingRangeNm + 15).slice(0, 2).forEach(x => {
            due.push(x.r > S.targetingRangeNm
                ? `Target ${x.g.label} (${Math.round(x.r)} nm from ${x.b.callsign}) before ${S.targetingRangeNm} nm.`
                : `Target ${x.g.label} now, late: already ${Math.round(x.r)} nm from ${x.b.callsign}.`);
        });
        if (threatCall) due.push(`${threatCall}.`);
        if (!due.length) due.push(`Nothing due: hold at CAP. Nearest hostile ${Math.round(Math.min(...near.map(x => x.r)))} nm, outside the ${S.commitEarlyNm} nm commit window.`);
        soloCall(base('solo', 'solo'), due.join(' '), 'What do you call now? Commit, targeting, THREAT, or nothing yet.');
    }
}

function visible(scope) {
    return (scope.tracks || []).filter(t => !t.isSplashed && !t.isDormant);
}

function en(p) {
    const rad = p.bearing * Math.PI / 180;
    return [round1(p.range * Math.sin(rad)), round1(p.range * Math.cos(rad))];
}

/** Still in card format: hostile group leads, every friendly and the tanker tagged. */
function snapshot(scope, groups, trails, G) {
    const leads = new Set(groups.map(g => (g.lead || g.tracks[0]).id));
    return visible(scope).map(t => {
        const [e, n] = en(t);
        const s = { e, n, h: Math.round(t.heading), f: t.hostile ? 'H' : 'F' };
        if (t.hostile && !leads.has(t.id)) {
            s.w = 1;
        } else {
            s.c = t.callsign;
            s.b = G.alssaBearingRange(t);
            s.a = Math.round(t.altitude / 1000);
            const tr = trails.get(t.id);
            if (tr && tr.length > 1) s.tr = tr.slice(0, -1);
        }
        return s;
    });
}

module.exports = { buildM8 };
