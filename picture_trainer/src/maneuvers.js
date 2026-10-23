/**
 * Group maneuvers after the initial picture.
 *
 * Once the student has called the picture, the group names are locked: a wall that
 * starts flanking is still NORTH / MIDDLE / SOUTH GROUP, and the controller calls the
 * maneuver ("NORTH GROUP, FLANK NORTH") instead of building a new picture.
 *
 * The director picks a named group, turns it to a HOT / FLANK / BEAM / DRAG heading
 * relative to the friendly fighters — or splits a contact off it — waits for the
 * student to call it, then may schedule another. Everything runs on sim time from a
 * per-scenario seed.
 */
const MANEUVER_RULES = {
    firstDelaySec: [8, 18],        // after the picture is called
    nextDelaySec: [10, 20],        // after the previous maneuver is called
    countRange: [1, 2],            // maneuvers per scenario
    visibleTurnDeg: 20,            // turn that makes a maneuver callable on the scope
    clearanceNm: 8,                // keep groups this far apart (never below their current spacing)
    lookAheadSec: 150,
    stopLineShiftNm: 35,           // once the picture is called the raid may press this much closer
    stayOutsideStopSec: 60,        // a maneuvering group must not reach the stop line this soon
    // Target aspect for each maneuver, centred in its PICTURE_RULES.aspectDeg band.
    targetAspectDeg: { HOT: 0, FLANK: 45, BEAM: 90, DRAG: 165 },
    splitChance: 0.35,             // how often a group that can split is made to
    splitTurnDeg: [50, 70],        // the departing contact's turn off the group's track
    splitVisibleNm: 4.5            // contacts this far apart read as two groups (3 nm rule + margin)
};

class ManeuverDirector {
    constructor(rules = {}) {
        this.rules = Object.assign({}, MANEUVER_RULES, rules);
        this.reset({ seed: 1, mode: 'none' }, false);
    }

    /** Maneuvers apply to standard pictures only — not to the BRAA / EA drills. */
    reset(meta, enabled = true) {
        this.allowed = !!meta && meta.mode == null;
        this.enabled = enabled;
        this.rng = mulberry32(((meta && meta.seed) || 1) ^ 0x5bd1e995);
        this.orient = getOrientation(meta && meta.orientation);
        this.phase = 'picture';
        this.names = new Map();
        this.planned = randInt(this.rng, this.rules.countRange[0], this.rules.countRange[1]);
        this.called = 0;
        this.active = null;
        this.nextAt = null;
        this.maneuvered = new Set();
    }

    get canCommit() {
        return this.allowed && this.enabled && this.phase === 'picture';
    }

    /** How much closer than its own stop line the raid flies once the picture is called. */
    get stopLineShiftNm() {
        return this.phase === 'picture' ? 0 : this.rules.stopLineShiftNm;
    }

    stopLineOf(track) {
        return (track.ingressStopNm != null ? track.ingressStopNm : 55) - this.stopLineShiftNm;
    }

    /**
     * Lock the names from the picture the student just called and schedule the first
     * maneuver. Returns false when there is nothing to maneuver.
     */
    commit(answer, simTime) {
        if (!this.canCommit || !answer || !answer.named) return false;
        const counts = new Map();
        answer.named.forEach(n => counts.set(n.name, (counts.get(n.name) || 0) + 1));
        // A name used twice ("GROUP" in a core-information picture) cannot identify a group.
        answer.named.forEach(n => {
            if (counts.get(n.name) === 1) this.names.set(n.group.lead.groupId, n.name);
        });
        if (!this.names.size) return false;
        this.phase = 'maneuvers';
        this.nextAt = simTime + this.delay(this.rules.firstDelaySec);
        return true;
    }

    update(tracks, simTime) {
        if (this.phase !== 'maneuvers' || this.active || this.nextAt == null || simTime < this.nextAt) return;
        this.nextAt = null;
        const plan = this.plan(tracks);
        if (!plan) {
            this.phase = 'done';
            return;
        }
        this.apply(plan, tracks);
        this.active = plan;
    }

    /** The maneuver awaiting a call, once the turn (or the split) shows on the scope. */
    pending(tracks) {
        const m = this.active;
        if (!m) return null;
        const lead = tracks.find(t => t.id === m.leadId);
        if (!lead) return null;
        if (m.type === 'SPLIT') {
            const parent = tracks.find(t => t.id === m.parentLeadId);
            return parent && Geo.distance(lead, parent) >= this.rules.splitVisibleNm ? m : null;
        }
        const turned = Geo.angleDiff(lead.heading, m.fromHeading);
        return turned >= this.rules.visibleTurnDeg || Geo.angleDiff(lead.heading, m.heading) < 1 ? m : null;
    }

    markCalled(simTime, tracks) {
        if (!this.active) return;
        // The pieces of a split go by their new names from here on.
        if (this.active.type === 'SPLIT' && tracks) {
            this.splitPieces(tracks).forEach(p => this.names.set(p.groupId, p.name));
        }
        this.called += 1;
        this.active = null;
        if (this.called >= this.planned) {
            this.phase = 'done';
        } else {
            this.nextAt = simTime + this.delay(this.rules.nextDelaySec);
        }
    }

    /**
     * The two groups a split leaves, named by their side across the threat axis in
     * front of the parent's name: LEAD GROUP -> NORTH LEAD GROUP / SOUTH LEAD GROUP.
     * In a packages picture the side goes after the package name.
     */
    splitPieces(tracks) {
        const m = this.active;
        if (!m || m.type !== 'SPLIT') return [];
        const pieces = [m.parentGroupId, m.groupId].map(id => {
            const members = tracks.filter(t => t.hostile && t.groupId === id);
            const lead = members.find(t => !t.formationAnchor) || members[0];
            return { groupId: id, lead, cross: Geo.toAxis(lead, this.orient).cross };
        });
        pieces.sort((a, b) => a.cross - b.cross);
        const sides = [this.orient.crossNames.neg, this.orient.crossNames.pos];
        return pieces.map((p, i) => Object.assign(p, { name: this.pieceName(m.name, sides[i]) }));
    }

    pieceName(parent, side) {
        const pkg = parent.match(/^(\w+ PACKAGE)(?: (.*))?$/);
        if (pkg) return `${pkg[1]} ${side} ${pkg[2] || 'GROUP'}`;
        return `${side} ${parent}`;
    }

    /** Point the aspect is measured against: the middle of the friendly CAP stations. */
    fighterReference(tracks) {
        const stations = tracks.filter(t => !t.hostile && t.capStation && !t.formationAnchor).map(t => t.capStation);
        const points = stations.length ? stations : tracks.filter(t => !t.hostile);
        if (!points.length) return { bearing: 0, range: 0 };
        let e = 0;
        let n = 0;
        points.forEach(p => {
            const en = Geo.bullsToEN(p);
            e += en.e;
            n += en.n;
        });
        return Geo.enToBulls({ e: e / points.length, n: n / points.length });
    }

    // ------------------------------------------------------------------ planning

    plan(tracks) {
        const R = this.rules;
        const groups = this.groupsOf(tracks);
        const ref = this.fighterReference(tracks);
        const candidates = [];

        groups.forEach(g => {
            if (!this.names.has(g.id)) return;
            const toFighter = Geo.bearingRange(g.lead, ref).bearing;
            const types = this.maneuvered.has(g.id) ? ['HOT', 'FLANK', 'BEAM'] : ['FLANK', 'BEAM', 'DRAG'];
            types.forEach(type => {
                const sides = type === 'HOT' ? [0] : [-1, 1];
                sides.forEach(side => {
                    const heading = Geo.norm360(toFighter + side * R.targetAspectDeg[type]);
                    // Must read as a maneuver: a real change from the track the group is on.
                    if (Geo.angleDiff(heading, g.lead.heading) < 2 * R.visibleTurnDeg) return;
                    if (!this.isClear(g, heading, groups)) return;
                    candidates.push({ groupId: g.id, type, heading, side, prior: this.maneuvered.has(g.id) });
                });
            });
        });
        const splits = this.planSplits(groups);
        if (!candidates.length && !splits.length) return null;

        // A group that has already turned away usually comes back HOT next.
        const recommit = candidates.filter(c => c.type === 'HOT');
        let pool = candidates;
        if (splits.length && (!candidates.length || this.rng() < R.splitChance)) pool = splits;
        else if (recommit.length && this.rng() < 0.6) pool = recommit;
        const choice = pool[Math.floor(this.rng() * pool.length)];
        if (choice.type === 'SPLIT') return choice;
        const group = groups.find(g => g.id === choice.groupId);
        return Object.assign(choice, {
            leadId: group.lead.id,
            fromHeading: group.lead.heading,
            name: this.names.get(choice.groupId)
        });
    }

    /**
     * SPLIT: one contact of a named, still-ingressing group of two or more turns off
     * its track and becomes a group of its own. The rest carry on as they were.
     */
    planSplits(groups) {
        const R = this.rules;
        const out = [];
        const nextId = Math.max(...groups.map(g => g.id)) + 1;
        const taken = new Set(this.names.values());
        const sides = [this.orient.crossNames.neg, this.orient.crossNames.pos];
        groups.forEach(g => {
            if (!this.names.has(g.id) || this.maneuvered.has(g.id) || g.tracks.length < 2) return;
            if (!g.lead.ingress || g.lead.orbitAnchor) return;
            // A five-group wall already has a NORTH MIDDLE GROUP: its MIDDLE GROUP cannot split.
            if (sides.some(side => taken.has(this.pieceName(this.names.get(g.id), side)))) return;
            const leaver = g.tracks[g.tracks.length - 1];
            const turn = R.splitTurnDeg[0] + this.rng() * (R.splitTurnDeg[1] - R.splitTurnDeg[0]);
            [-1, 1].forEach(side => {
                const heading = Geo.norm360(g.lead.heading + side * turn);
                if (!this.isClear(leaver, heading, groups)) return;
                out.push({
                    type: 'SPLIT',
                    groupId: nextId,
                    parentGroupId: g.id,
                    parentLeadId: g.lead.id,
                    leadId: leaver.id,
                    heading,
                    fromHeading: leaver.heading,
                    name: this.names.get(g.id)
                });
            });
        });
        return out;
    }

    apply(plan, tracks) {
        if (plan.type === 'SPLIT') {
            const leaver = tracks.find(t => t.id === plan.leadId);
            leaver.groupId = plan.groupId;
            leaver.formationAnchor = null;
        }
        this.maneuvered.add(plan.groupId);
        tracks.filter(t => t.hostile && t.groupId === plan.groupId).forEach(t => {
            // A CAP or holding group leaves its orbit to maneuver.
            t.isCapOrbit = false;
            if (t.formationAnchor) return;
            t.orbitAnchor = null;
            t.ingress = false;
            t.motionState = 'MANEUVER';
            t.maneuverHeading = plan.heading;
            // A group already inside the stop line (holding) may maneuver from where it is.
            t.maneuverFloorNm = Math.min(this.stopLineOf(t), t.range) - 2;
        });
    }

    /**
     * Look-ahead: fly the turn and the new heading against the other groups on their
     * current tracks. The maneuvering group (or the contact splitting off) must not close
     * on another group or reach the stop line while the student is still calling it.
     * `mover` is a group, or a single track splitting off its group.
     */
    isClear(mover, heading, groups) {
        const R = this.rules;
        const lead = mover.lead || mover;
        const stopNm = this.stopLineOf(lead);
        const vel = (hdg, speed) => ({
            e: Math.sin(hdg * Math.PI / 180) * speed / 3600,
            n: Math.cos(hdg * Math.PI / 180) * speed / 3600
        });
        const me = Geo.bullsToEN(lead);
        const speed = lead.cruiseSpeed || lead.speed || 480;
        const turnRate = lead.turnRate != null ? lead.turnRate : 3.5;
        let hdg = lead.heading;
        const others = groups.filter(o => o !== mover).map(o => {
            const p = Geo.bullsToEN(o.lead);
            const d0 = Math.hypot(p.e - me.e, p.n - me.n);
            return { p, v: this.currentVelocity(o.lead, vel), min: Math.min(R.clearanceNm, d0) - 0.5 };
        });
        const floor = Math.min(stopNm, lead.range) - 2;

        for (let t = 1; t <= R.lookAheadSec; t++) {
            const left = Geo.norm360(heading - hdg);
            const turn = Math.min(turnRate, Math.min(left, 360 - left));
            hdg = Geo.norm360(hdg + (left > 180 ? -turn : turn));
            const v = vel(hdg, speed);
            me.e += v.e;
            me.n += v.n;
            if (t <= R.stayOutsideStopSec && Math.hypot(me.e, me.n) < floor) return false;
            for (const o of others) {
                if (Math.hypot(o.p.e + o.v.e * t - me.e, o.p.n + o.v.n * t - me.n) < o.min) return false;
            }
        }
        return true;
    }

    currentVelocity(lead, vel) {
        const speed = lead.cruiseSpeed || lead.speed || 480;
        if (lead.maneuverHeading != null) return vel(lead.maneuverHeading, speed);
        if (lead.ingress && !lead.orbitAnchor) {
            return vel(lead.ingressHeading != null ? lead.ingressHeading : lead.heading, speed);
        }
        return { e: 0, n: 0 };
    }

    groupsOf(tracks) {
        const byId = new Map();
        tracks.forEach(t => {
            if (!t.hostile || t.isDormant) return;
            if (!byId.has(t.groupId)) byId.set(t.groupId, { id: t.groupId, tracks: [] });
            byId.get(t.groupId).tracks.push(t);
        });
        return [...byId.values()].map(g => Object.assign(g, {
            lead: g.tracks.find(t => !t.formationAnchor) || g.tracks[0]
        }));
    }

    delay([lo, hi]) {
        return lo + this.rng() * (hi - lo);
    }
}

if (typeof window !== 'undefined') {
    window.MANEUVER_RULES = MANEUVER_RULES;
    window.ManeuverDirector = ManeuverDirector;
}
