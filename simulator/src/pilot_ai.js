/**
 * Pilot AI — blue BVR + Su-30 Flanker-class red BVR (unclassified training proxies)
 * Blue: CAP → MELD → COMMITTED → WEZ/FOX3 → CRANK → SKOSH → CAP recover
 * Red:  INGRESS (formation) → COMMITTED → WEZ (R77/R27) → CRANK → SKOSH → REATTACK / PUSH_HVAA
 */

class BehaviorTree {
    constructor(root) {
        this.root = root;
    }

    tick(track, context) {
        return this.root.run(track, context);
    }
}

const BTStatus = { SUCCESS: 'SUCCESS', FAILURE: 'FAILURE', RUNNING: 'RUNNING' };

class Selector {
    constructor(children) { this.children = children; }
    run(track, context) {
        for (const child of this.children) {
            const status = child.run(track, context);
            if (status !== BTStatus.FAILURE) return status;
        }
        return BTStatus.FAILURE;
    }
}

class Sequence {
    constructor(children) { this.children = children; }
    run(track, context) {
        for (const child of this.children) {
            const status = child.run(track, context);
            if (status !== BTStatus.SUCCESS) return status;
        }
        return BTStatus.SUCCESS;
    }
}

class Condition {
    constructor(predicate) { this.predicate = predicate; }
    run(track, context) {
        return this.predicate(track, context) ? BTStatus.SUCCESS : BTStatus.FAILURE;
    }
}

class Action {
    constructor(perform) { this.perform = perform; }
    run(track, context) {
        return this.perform(track, context) ? BTStatus.SUCCESS : BTStatus.RUNNING;
    }
}

class PilotAI {
    constructor(scope) {
        this.scope = scope;
        // Blue AIM-120D-style NEZ (see F35_Defensive_Profile.md)
        this.wezNm = 40;
        this.foxCooldownSec = 8;
        this.skoshDelaySec = 12;
        this.crankOffsetDeg = 50;
        this.skoshDurationSec = 8;
        this.capLegHalfNm = 10;
        this.capReturnNm = 5;
        this.pursuitAbortBufferNm = 5;
        this.egressAbortSec = 10;
        // Flanker training proxies (see Flanker_Adversary_Profile.md)
        this.redDetectNm = 90;
        this.redCommitNm = 55;
        this.redR77WezNm = 22;
        this.redR27WezNm = 32;
        this.redCrankDeg = 45;
        this.redFoxCooldownSec = 10;
        // Blue SORT / multi-contact (ALSSA TARGETED + F-35 multi-target proxy)
        this.maxContactsPerShooter = 3;
        this.leakerCapNm = 35;
        this.leakerHvaaNm = 25;
        this._blueSortPlan = null;
        this._blueSortPlanKey = null;
        this._pictureHostileCount = 0;
        // Reorient fence: past this bullseye range on eastbound ingress, search back west
        this.redIngressMaxRangeNm = 95;
        this.tree = new BehaviorTree(this.buildBehaviorTree());
    }

    buildBehaviorTree() {
        return new Selector([
            new Sequence([
                new Condition((t) => !!t.orbitAnchor),
                new Action(() => true)
            ]),
            // DEFEND overrides offensive BVR when inbound missile detected
            new Sequence([
                new Condition((t) => this.shouldDefend(t)),
                new Action((t) => this.executeDefensive(t))
            ]),
            new Sequence([
                new Condition((t) => !t.hostile && t.type === 'fighter'),
                new Action((t) => this.executeBlueBvr(t))
            ]),
            new Sequence([
                new Condition((t) => t.hostile && t.type === 'fighter' && !t.isSplashed),
                new Action((t) => this.executeFlankerBvr(t))
            ])
        ]);
    }

    shouldDefend(track) {
        if (!track || track.type !== 'fighter' || track.isSplashed) return false;
        if (track.inboundMissileId) return true;
        const inbound = this.scope.getInboundMissiles
            ? this.scope.getInboundMissiles(track.id)
            : [];
        if (!inbound.length) {
            if (track.tacticalState === 'DEFEND') this.exitDefend(track);
            return false;
        }
        const profile = typeof getDefensiveProfile === 'function'
            ? getDefensiveProfile(track)
            : { detectSupportNm: 30 };
        const threat = this.scope.getInboundThreat
            ? this.scope.getInboundThreat(track)
            : null;
        if (!threat) return false;
        return threat.missile.state === 'ACTIVE'
            || threat.rangeNm <= (profile.detectSupportNm || 30);
    }

    exitDefend(track) {
        const restore = track.preDefendState;
        track.preDefendState = null;
        track.defendMode = null;
        track.defendChaffDeployed = false;
        track.defendBeamSince = null;
        track.defendBeamSinceSim = null;
        track.defendColdTimer = false;
        if (restore && restore !== 'DEFEND') {
            track.tacticalState = restore;
        } else if (track.hostile) {
            track.tacticalState = 'INGRESS';
        } else {
            track.tacticalState = 'CAP';
        }
    }

    executeDefensive(track) {
        if (typeof ensureAircraftStores === 'function') ensureAircraftStores(track);
        const profile = typeof getDefensiveProfile === 'function'
            ? getDefensiveProfile(track)
            : { breakNm: 12, chaffDurationSec: 4, coldSpeedFactor: 0.85 };

        if (track.tacticalState !== 'DEFEND') {
            track.preDefendState = (track.tacticalState && track.tacticalState !== 'DEFEND')
                ? track.tacticalState : (track.hostile ? 'INGRESS' : 'CAP');
            track.tacticalState = 'DEFEND';
            track.defendChaffDeployed = false;
        }

        const threat = this.scope.getInboundThreat
            ? this.scope.getInboundThreat(track)
            : null;
        if (!threat || !threat.missile) {
            this.exitDefend(track);
            return true;
        }

        const m = threat.missile;
        const rangeNm = threat.rangeNm;
        const inboundBrg = this.scope.calculateBRAA(
            track.bearing, track.range, m.bearing, m.range
        ).bearing;
        const side = track.crankSide === 'LEFT' ? -1 : 1;
        const sim = this.scope.simTimeSec != null ? this.scope.simTimeSec : Date.now() / 1000;

        // Mode selection (sim-time beam hold — not wall clock)
        if (rangeNm < (profile.breakNm || 12)) {
            track.defendMode = 'BREAK';
        } else if (track.inboundActive || track.inboundPitbull || m.state === 'ACTIVE') {
            track.defendMode = track.defendColdTimer ? 'COLD' : 'BEAM';
            if (track.defendMode === 'BEAM' && track.defendBeamSinceSim == null) {
                track.defendBeamSinceSim = sim;
            }
            if (track.defendBeamSinceSim != null && sim - track.defendBeamSinceSim > 5) {
                track.defendMode = 'COLD';
                track.defendColdTimer = true;
            }
        } else {
            track.defendMode = 'NOTCH';
            track.defendBeamSinceSim = null;
            track.defendColdTimer = false;
        }

        if (track.defendMode === 'BREAK') {
            track.targetHeading = this.normalizeHdg(inboundBrg + 180);
            track.speed = Math.min(
                (track.cruiseSpeed || track.speed || 450) + (profile.breakSpeedBoost || 200),
                profile.maxBreakSpeed || 1100
            );
        } else if (track.defendMode === 'COLD') {
            track.targetHeading = this.normalizeHdg(inboundBrg + 180);
            track.speed = Math.max(
                280,
                (track.cruiseSpeed || track.speed || 450) * (profile.coldSpeedFactor || 0.85)
            );
        } else {
            track.targetHeading = this.normalizeHdg(inboundBrg + side * 90);
            track.speed = track.cruiseSpeed || track.speed || 450;
        }

        // Chaff: terminal phase only (pitbull/ACTIVE + inside deploy range) — not on support NOTCH
        const pitbull = track.inboundActive || track.inboundPitbull || m.state === 'ACTIVE';
        const chaffDeployNm = profile.chaffDeployNm != null
            ? profile.chaffDeployNm
            : (profile.chaffEffectiveNm != null ? profile.chaffEffectiveNm : 12);
        const chaffRequiresActive = profile.chaffRequiresActive !== false;
        const inChaffDeployRange = rangeNm <= chaffDeployNm;
        const mayChaff = inChaffDeployRange
            && (!chaffRequiresActive || pitbull)
            && (
                track.defendMode === 'BEAM'
                || track.defendMode === 'BREAK'
                || track.defendMode === 'COLD'
                || (track.defendMode === 'NOTCH' && pitbull)
            );

        // Sim-time clouds so 16x does not stretch a 2.5s burst into ~40s of CM
        const dur = profile.chaffDurationSec || 3;
        const cloudExpired = track.chaffUntilSim == null || sim >= track.chaffUntilSim;
        const canOverlap = track.chaffUntilSim != null && sim >= track.chaffUntilSim - 0.5;
        const canDispense = cloudExpired || canOverlap;
        if (cloudExpired) track.defendChaffDeployed = false;

        if (
            mayChaff
            && canDispense
            && (track.chaffRemaining == null ? 0 : track.chaffRemaining) > 0
        ) {
            track.chaffRemaining -= 1;
            track.chaffUntilSim = sim + dur;
            track.chaffUntil = Date.now() + dur * 1000; // UI/legacy
            track.defendChaffDeployed = true;
            this.log('chaff', {
                trackId: track.id,
                callsign: track.callsign,
                remaining: track.chaffRemaining,
                mode: track.defendMode,
                rangeNm,
                pitbull: !!pitbull
            });
        }

        return true;
    }

    update(track) {
        if (!track || track.isSplashed || track.isDormant) return;
        this.tree.tick(track, { scope: this.scope });
    }

    worldTracks() {
        return (this.scope.truthTracks || []).filter(t => !t.isSplashed);
    }

    log(type, detail) {
        const tl = this.scope.timeline;
        if (tl && typeof tl.log === 'function') tl.log(type, detail);
    }

    normalizeHdg(h) {
        return ((h % 360) + 360) % 360;
    }

    braa(from, to) {
        return this.scope.calculateBRAA(from.bearing, from.range, to.bearing, to.range);
    }

    nearestHostileInfo(fighter) {
        return this.pickBlueTarget(fighter);
    }

    blueEmploymentProfile(track) {
        return typeof getBlueEmploymentProfile === 'function'
            ? getBlueEmploymentProfile(track)
            : {
                tacRangeNm: 60,
                blueMeldNm: 80,
                foxMinNm: 8,
                foxMaxNm: 40,
                foxMaxAspectDeg: 60,
                foxMaxAtaDeg: 40,
                foxOuterNm: 30,
                crankShootDeg: 50,
                requireHostileDeclaration: true,
                recommitNm: 50,
                minMissilesForRecommit: 2,
                redDetectVsNm: 40
            };
    }

    /** Degrees between shooter nose (heading) and LOS to target. */
    offBoresightDeg(shooter, target) {
        const braa = this.braa(shooter, target);
        let ata = Math.abs((braa.bearing - (shooter.heading || 0) + 360) % 360);
        if (ata > 180) ata = 360 - ata;
        return ata;
    }

    isRaptorFlight(track) {
        const cs = String(track.callsign || '').toUpperCase();
        if (/RAPTOR/.test(cs)) return true;
        if (/VIPER/.test(cs)) return false;
        return this.isEastCap(track);
    }

    isBlueWing(track) {
        return !!(track.formation && track.formation.role === 'WING');
    }

    isEastCap(track) {
        const name = String(
            (track.capStation && track.capStation.name) || track.callsign || ''
        ).toUpperCase();
        if (/RAPTOR|EAST|ELGIN|LEFT/.test(name)) return true;
        if (/VIPER|WEST|CALC|RIGHT/.test(name)) return false;
        return String(track.id || '').charCodeAt(0) % 2 === 0;
    }

    /** Alive hostile fighters in the active picture. */
    aliveHostileFighters() {
        return this.worldTracks().filter(h =>
            h.hostile && h.type === 'fighter' && !h.isDormant && !h.isSplashed
        );
    }

    isBlueFlightLead(track) {
        if (!track || track.hostile || track.type !== 'fighter') return false;
        if (this.isBlueWing(track)) return false;
        if (track.formation && track.formation.role === 'LEAD') return true;
        return !this.getBlueFlightLead(track);
    }

    blueFlightLeads() {
        return this.worldTracks().filter(t =>
            !t.hostile && t.type === 'fighter' && !t.isSplashed && this.isBlueFlightLead(t)
        );
    }

    pictureCentroid(hostiles) {
        if (!hostiles.length || !this.scope.bearingRangeToXY || !this.scope.xyToBearingRange) {
            return null;
        }
        let sx = 0;
        let sy = 0;
        hostiles.forEach((h) => {
            const p = this.scope.bearingRangeToXY(h.bearing, h.range);
            sx += p.x;
            sy += p.y;
        });
        return this.scope.xyToBearingRange(sx / hostiles.length, sy / hostiles.length);
    }

    rangeToPoint(track, point) {
        if (!point) return Infinity;
        return this.scope.calculateBRAA(
            track.bearing, track.range, point.bearing, point.range
        ).range;
    }

    /**
     * Package SORT: ceil(N/maxPer) flight leads; max 3 contacts each; rest CAP reserve.
     * ALSSA TARGETED ownership — no 4-ship pile-on onto a small picture.
     */
    buildBlueSortPlan(forceRebuild = false) {
        const hostiles = this.aliveHostileFighters()
            .slice()
            .sort((a, b) => a.bearing - b.bearing);
        const key = hostiles.map(h => String(h.id)).join('|');
        if (!hostiles.length) {
            this._pictureHostileCount = 0;
        }
        if (!forceRebuild && this._blueSortPlan && this._blueSortPlanKey === key) {
            return this._blueSortPlan;
        }

        const pictureGrew = hostiles.length > (this._pictureHostileCount || 0);
        this._pictureHostileCount = hostiles.length;

        const maxPer = this.maxContactsPerShooter || 3;
        const needed = hostiles.length === 0 ? 0 : Math.ceil(hostiles.length / maxPer);
        const centroid = this.pictureCentroid(hostiles);
        let leads = this.blueFlightLeads().slice().sort((a, b) =>
            this.rangeToPoint(a, centroid) - this.rangeToPoint(b, centroid)
        );

        const withAmmo = leads.filter(l => this.blueMissilesRemaining(l) > 0);
        if (withAmmo.length) {
            leads = withAmmo.concat(leads.filter(l => withAmmo.indexOf(l) < 0));
        }

        const assignedLeads = leads.slice(0, needed);
        const assignments = {};
        assignedLeads.forEach((l) => { assignments[String(l.id)] = []; });

        if (assignedLeads.length === 1) {
            assignments[String(assignedLeads[0].id)] = hostiles.map(h => String(h.id));
        } else if (assignedLeads.length > 1) {
            const chunk = Math.ceil(hostiles.length / assignedLeads.length);
            assignedLeads.forEach((lead, i) => {
                assignments[String(lead.id)] = hostiles
                    .slice(i * chunk, (i + 1) * chunk)
                    .map(h => String(h.id));
            });
        }

        const owned = new Set();
        Object.keys(assignments).forEach((sid) => {
            assignments[sid].forEach(id => owned.add(id));
        });
        const untargeted = hostiles
            .filter(h => !owned.has(String(h.id)))
            .map(h => String(h.id));

        const plan = {
            key,
            assignments,
            assignedLeadIds: assignedLeads.map(l => String(l.id)),
            hostileIds: hostiles.map(h => String(h.id)),
            untargeted
        };

        const prevKey = this._blueSortPlanKey;
        this._blueSortPlan = plan;
        this._blueSortPlanKey = key;

        if (key !== prevKey) {
            this.worldTracks().forEach((t) => {
                if (!t.hostile && t.type === 'fighter') {
                    t._lastWaveHoldAt = null;
                    t.winchesterLogged = false;
                }
            });
            if (pictureGrew) {
                this.log('picture_grow', {
                    hostileCount: hostiles.length,
                    shooters: assignedLeads.length,
                    callsigns: hostiles.map(h => h.callsign)
                });
            }
            assignedLeads.forEach((lead) => {
                this.log('sort_assign', {
                    trackId: lead.id,
                    callsign: lead.callsign,
                    targetIds: assignments[String(lead.id)],
                    pictureSize: hostiles.length,
                    shooters: assignedLeads.length
                });
            });
            untargeted.forEach((id) => {
                const h = hostiles.find(x => String(x.id) === id);
                this.log('untargeted', {
                    targetId: id,
                    targetCallsign: h ? h.callsign : null
                });
            });
        }

        return plan;
    }

    isSortAssignedShooter(track) {
        if (!track) return false;
        if (track.sortReleased || track.forceSortEngage) return true;
        const plan = this.buildBlueSortPlan();
        return plan.assignedLeadIds.indexOf(String(track.id)) >= 0;
    }

    ownedHostileIds(track) {
        const plan = this.buildBlueSortPlan();
        if (plan.assignments[String(track.id)]) {
            return plan.assignments[String(track.id)].slice();
        }
        if (track.sortReleased) {
            const lead = this.getBlueFlightLead(track);
            if (lead && plan.assignments[String(lead.id)]) {
                return plan.assignments[String(lead.id)].slice();
            }
            return plan.untargeted.slice();
        }
        return [];
    }

    unownedHostiles(hostiles) {
        const plan = this.buildBlueSortPlan();
        const owned = new Set();
        Object.keys(plan.assignments).forEach((sid) => {
            plan.assignments[sid].forEach(id => owned.add(id));
        });
        this.worldTracks().forEach((b) => {
            if (b.hostile || b.type !== 'fighter') return;
            if (b.assignedTargetId) owned.add(String(b.assignedTargetId));
        });
        return hostiles.filter(h => !owned.has(String(h.id)));
    }

    pickClosest(track, pool) {
        let best = null;
        let bestR = Infinity;
        pool.forEach((h) => {
            const r = this.braa(track, h).range;
            if (r < bestR) {
                bestR = r;
                best = h;
            }
        });
        return { target: best, range: bestR };
    }

    /** Advance to next owned contact after splash / lost target. */
    advanceOwnedTarget(track) {
        const hostiles = this.aliveHostileFighters();
        const ownedIds = this.ownedHostileIds(track);
        let pool = hostiles.filter(h =>
            ownedIds.indexOf(String(h.id)) >= 0
            && String(h.id) !== String(track.assignedTargetId)
        );
        if (!pool.length && track.sortReleased) {
            pool = this.unownedHostiles(hostiles);
        }
        if (!pool.length) {
            track.assignedTargetId = null;
            this.clearTargeting(track);
            return { target: null, range: Infinity };
        }
        const next = this.pickClosest(track, pool);
        track.assignedTargetId = next.target.id;
        track.hasTargeted = false;
        track.foxFiredForTarget = null;
        this.log('sort_retarget', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: next.target.id,
            targetCallsign: next.target.callsign,
            rangeNm: Math.round(next.range * 10) / 10
        });
        return next;
    }

    isHostileLeaker(hostile) {
        if (!hostile || hostile.isSplashed) return false;
        const blues = this.worldTracks().filter(t =>
            !t.hostile && t.type === 'fighter' && !t.isSplashed
        );
        for (let i = 0; i < blues.length; i++) {
            const station = blues[i].capStation;
            if (station) {
                const toCap = this.scope.calculateBRAA(
                    hostile.bearing, hostile.range, station.bearing, station.range
                );
                if (toCap.range <= (this.leakerCapNm || 35)) return true;
            }
        }
        const hvaa = this.worldTracks().filter(t =>
            !t.hostile
            && (t.type === 'tanker' || t.type === 'awacs' || t.type === 'isr')
            && !t.isSplashed
        );
        for (let i = 0; i < hvaa.length; i++) {
            if (this.braa(hostile, hvaa[i]).range <= (this.leakerHvaaNm || 25)) return true;
        }
        if (this.scope.dal) {
            const toDal = this.scope.calculateBRAA(
                hostile.bearing, hostile.range,
                this.scope.dal.bearing, this.scope.dal.range
            );
            if (toDal.range <= (this.leakerHvaaNm || 25)) return true;
        }
        return false;
    }

    /**
     * Sparse SORT pick — only assigned shooters (or released wings) get contacts.
     * No fallback pile-on onto already-owned hostiles.
     */
    pickBlueTarget(track) {
        this.buildBlueSortPlan();
        const hostiles = this.aliveHostileFighters();
        if (!hostiles.length) return { target: null, range: Infinity };

        if (track.assignedTargetId) {
            const assigned = hostiles.find(h =>
                String(h.id) === String(track.assignedTargetId)
            );
            if (assigned && !assigned.isSplashed) {
                return { target: assigned, range: this.braa(track, assigned).range };
            }
            if (this.isSortAssignedShooter(track) || track.sortReleased) {
                return this.advanceOwnedTarget(track);
            }
            track.assignedTargetId = null;
            return { target: null, range: Infinity };
        }

        if (!this.isSortAssignedShooter(track) && !track.forceSortEngage) {
            return { target: null, range: Infinity };
        }

        const ownedIds = this.ownedHostileIds(track);
        let pool = hostiles.filter(h => ownedIds.indexOf(String(h.id)) >= 0);
        if (!pool.length && (track.sortReleased || track.forceSortEngage)) {
            pool = this.unownedHostiles(hostiles);
            if (!pool.length) pool = hostiles.slice();
        }
        if (!pool.length) return { target: null, range: Infinity };
        return this.pickClosest(track, pool);
    }
    getTargetAspect(shooter, target) {
        if (typeof AspectCalculator !== 'undefined') {
            const ac = new AspectCalculator();
            return ac.calculateAspect(shooter, target);
        }
        const braa = this.braa(shooter, target);
        const BB = braa.bearing;
        const BR = ((target.heading || 0) + 180) % 360;
        let angle = Math.abs(BR - BB);
        if (angle > 180) angle = 360 - angle;
        let classification = 'FLANK';
        if (angle <= 20) classification = 'HOT';
        else if (angle <= 60) classification = 'FLANK';
        else if (angle <= 110) classification = 'BEAM';
        else if (angle <= 150) classification = 'DRAG';
        else classification = 'COLD';
        return { angle: Math.round(angle), classification, side: 'NEUTRAL' };
    }

    targetHasHostileDeclaration(target) {
        if (!target || !target.hostile) return false;
        const decl = String(target.declaration || '').toUpperCase();
        if (decl === 'HOSTILE' || decl === 'BANDIT') return true;
        if (target.affiliation === 'hostile' && decl !== 'BOGEY') return true;
        return false;
    }

    hasLiveMissileOnTarget(shooterId, targetId) {
        const missiles = this.scope.getShooterMissiles
            ? this.scope.getShooterMissiles(shooterId)
            : (this.scope.missiles || []).filter(m =>
                String(m.shooterId) === String(shooterId)
            );
        return missiles.some(m =>
            m.isAlive && m.isAlive()
            && String(m.targetId) === String(targetId)
        );
    }

    canTakeFoxShot(track, target, braa) {
        const emp = this.blueEmploymentProfile(track);
        const st = track.tacticalState;
        if (st !== 'COMMITTED' && st !== 'WEZ' && st !== 'MELD') {
            return { ok: false, reason: 'bad_state' };
        }
        if (!track.hasTargeted) {
            return { ok: false, reason: 'not_targeted' };
        }
        if (emp.requireHostileDeclaration && !this.targetHasHostileDeclaration(target)) {
            return { ok: false, reason: 'no_declaration' };
        }

        const range = braa.range;
        const foxMin = emp.foxMinNm != null ? emp.foxMinNm : 10;
        const foxMax = emp.foxMaxNm != null ? emp.foxMaxNm : this.wezNm;
        if (range < foxMin) return { ok: false, reason: 'inside_min_range' };
        if (range > foxMax) return { ok: false, reason: 'outside_wez' };

        // ARH (AIM-120): range + shooter ATA only. Rear-aspect / stern chase is valid —
        // do not require HOT/FLANK target aspect (that blocked trail shots).
        const aspect = this.getTargetAspect(track, target);

        // Shooter ATA: nose within employment cone of LOS
        const ata = this.offBoresightDeg(track, target);
        const maxAta = emp.foxMaxAtaDeg != null ? emp.foxMaxAtaDeg : 40;
        if (ata > maxAta) {
            return { ok: false, reason: 'ata_hold', ataDeg: Math.round(ata) };
        }

        if (this.hasLiveMissileOnTarget(track.id, target.id)) {
            return { ok: false, reason: 'missile_in_flight' };
        }
        if (
            String(track.foxFiredForTarget) === String(target.id)
            && this.scope.getShooterMissiles
            && this.scope.getShooterMissiles(track.id).length > 0
        ) {
            return { ok: false, reason: 'duplicate_target' };
        }

        const cooled = !track.lastFoxAt
            || (Date.now() - track.lastFoxAt) / 1000 >= this.foxCooldownSec;
        if (!cooled) return { ok: false, reason: 'cooldown' };

        const canFox = typeof canFireOrdnance === 'function'
            ? canFireOrdnance(track, 'FOX3')
            : true;
        if (!canFox) return { ok: false, reason: 'winchester' };

        return {
            ok: true,
            aspect: aspect.classification,
            aspectDeg: aspect.angle,
            ataDeg: Math.round(ata)
        };
    }

    logFoxHold(track, target, reason, braa) {
        const key = `${reason}_${target ? target.id : 'none'}`;
        const now = Date.now();
        if (
            track._lastFoxHoldKey === key
            && track._lastFoxHoldAt
            && now - track._lastFoxHoldAt < 5000
        ) return;
        track._lastFoxHoldKey = key;
        track._lastFoxHoldAt = now;
        track.lastFoxHoldReason = reason;
        this.log('fox_hold', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target ? target.id : null,
            targetCallsign: target ? target.callsign : null,
            reason,
            rangeNm: braa ? braa.range : null
        });
    }

    enterTargeted(track, target) {
        if (track.hasTargeted) return;
        track.hasTargeted = true;
        target.isTargeted = true;
        const aspect = this.getTargetAspect(track, target);
        this.log('targeted', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target.id,
            targetCallsign: target.callsign,
            aspect: aspect.classification,
            aspectDeg: aspect.angle
        });
    }

    maybeEnterTargeted(track, target, braa) {
        const emp = this.blueEmploymentProfile(track);
        const tac = emp.tacRangeNm != null ? emp.tacRangeNm : 60;
        if (braa.range <= tac && !track.hasTargeted) {
            this.enterTargeted(track, target);
        }
    }

    clearTargeting(track) {
        const tgt = this.getAssignedTarget(track);
        if (tgt && track.hasTargeted) tgt.isTargeted = false;
        track.hasTargeted = false;
    }

    getAssignedTarget(track) {
        if (!track.assignedTargetId) return null;
        return this.worldTracks().find(t => String(t.id) === String(track.assignedTargetId)) || null;
    }

    meldNm(track) {
        if (track) {
            const emp = this.blueEmploymentProfile(track);
            if (emp.blueMeldNm != null) return emp.blueMeldNm;
        }
        return this.scope.fighterMeldNm != null ? this.scope.fighterMeldNm : 70;
    }

    commitNm() {
        return this.scope.fighterCommitNm != null ? this.scope.fighterCommitNm : 50;
    }

    /** Hard ceiling for blue pursuit — meld + buffer (default 75 nm). */
    pursuitAbortNm(track) {
        return this.meldNm(track) + this.pursuitAbortBufferNm;
    }

    /**
     * Abort pursuit when bandit exceeds AOR ceiling or sustains egress beyond meld.
     * @returns {{ abort: boolean, reason?: string, rangeNm?: number }}
     */
    shouldAbortPursuit(track, target, braa, dt) {
        if (!target || target.isSplashed) {
            return { abort: false };
        }
        const rangeNm = braa.range;
        const abortNm = this.pursuitAbortNm(track);
        if (rangeNm >= abortNm) {
            return { abort: true, reason: 'out_of_aor', rangeNm };
        }

        const meld = this.meldNm(track);
        const step = dt != null ? dt : (this.scope.lastDt || 0.1);
        const last = track.pursuitLastRangeNm;
        track.pursuitLastRangeNm = rangeNm;

        if (rangeNm > meld && last != null && rangeNm > last + 0.002) {
            track.pursuitOpeningSec = (track.pursuitOpeningSec || 0) + step;
            if (track.pursuitOpeningSec >= this.egressAbortSec) {
                return { abort: true, reason: 'egress', rangeNm };
            }
        } else {
            track.pursuitOpeningSec = 0;
        }
        return { abort: false };
    }

    abortPursuit(track, target, detail) {
        track.pursuitLastRangeNm = null;
        track.pursuitOpeningSec = 0;
        this.clearTargeting(track);
        this.log('pursuit_abort', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target ? target.id : null,
            targetCallsign: target ? target.callsign : null,
            reason: detail.reason || 'egress',
            rangeNm: detail.rangeNm
        });
        this.recoverCap(track);
    }

    /** @returns {boolean} true if pursuit was aborted */
    checkPursuitAbort(track, target, dt) {
        if (!target) return false;
        const braa = this.braa(track, target);
        const verdict = this.shouldAbortPursuit(track, target, braa, dt);
        if (verdict.abort) {
            this.abortPursuit(track, target, verdict);
            return true;
        }
        return false;
    }

    enterCommit(track, target, forced = false) {
        track.tacticalState = 'COMMITTED';
        track.assignedTargetId = target.id;
        track.isManeuvering = false;
        track.foxFiredForTarget = null;
        track.missileActiveUntil = null;
        track.skoshUntil = null;
        track.pendingSkoshMissile = false;
        track.pursuitLastRangeNm = null;
        track.pursuitOpeningSec = 0;
        // TARGETED persists through commit (ALSSA)
        this.log('commit', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target.id,
            targetCallsign: target.callsign,
            forced: !!forced
        });
    }

    enterMeld(track, target) {
        track.tacticalState = 'MELD';
        track.assignedTargetId = target.id;
        this.log('meld', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target.id,
            targetCallsign: target.callsign
        });
    }

    forceCommit(track) {
        if (!track || track.hostile || track.type !== 'fighter') return false;
        track.forceSortEngage = true;
        track.sortReleased = true;
        this.buildBlueSortPlan(true);
        let { target } = this.pickBlueTarget(track);
        if (!target) {
            const hostiles = this.aliveHostileFighters();
            if (!hostiles.length) return false;
            target = this.pickClosest(track, hostiles).target;
            if (!target) return false;
        }
        this.enterCommit(track, target, true);
        return true;
    }

    getBlueFlightLead(track) {
        const f = track.formation;
        if (!f || f.role === 'LEAD' || !f.flightLead) return null;
        return this.worldTracks().find(t =>
            !t.hostile
            && t.type === 'fighter'
            && String(t.callsign || '').toUpperCase() === String(f.flightLead).toUpperCase()
        ) || null;
    }

    isBlueFormationHoldState(track) {
        if (track.tacticalState !== 'CAP') return false;
        const lead = this.getBlueFlightLead(track);
        if (lead && lead.tacticalState && lead.tacticalState !== 'CAP') return false;
        return true;
    }

    /**
     * Wings stay CAP unless released: leaker, lead Winchester, or lead DEFEND/down
     * with contacts still requiring coverage.
     */
    syncWingEngagement(wing) {
        if (!this.isBlueWing(wing)) return;
        const lead = this.getBlueFlightLead(wing);
        if (!lead) return;

        const combatStates = ['MELD', 'COMMITTED', 'WEZ', 'CRANK', 'SKOSH', 'DEFEND', 'MERGE', 'GUNS'];
        if (combatStates.includes(wing.tacticalState)) return;

        const prevPictureCount = this._pictureHostileCount || 0;
        this.buildBlueSortPlan();
        const hostiles = this.aliveHostileFighters();
        if (!hostiles.length) return;

        const pictureGrew = hostiles.length > prevPictureCount;

        const leadWinchester = this.blueMissilesRemaining(lead) <= 0;
        const leadDown = !!lead.isSplashed || lead.tacticalState === 'DEFEND';
        const leadEngaging = combatStates.includes(lead.tacticalState);
        const ownedIds = (this._blueSortPlan.assignments[String(lead.id)] || []);
        const ownedLive = hostiles.filter(h => ownedIds.indexOf(String(h.id)) >= 0);
        const unowned = this.unownedHostiles(hostiles);
        const leaker = ownedLive.some(h => this.isHostileLeaker(h))
            || unowned.some(h => this.isHostileLeaker(h));
        const needCoverage = unowned.length > 0
            || (leadWinchester && ownedLive.length > 0);

        const shouldRelease = leaker
            || (leadWinchester && needCoverage)
            || (leadDown && needCoverage)
            || (leadEngaging && leadWinchester && ownedLive.length > 0)
            || (pictureGrew && (unowned.length > 0 || ownedLive.length > 0));

        if (!shouldRelease) return;

        wing.sortReleased = true;
        const { target, range } = this.pickBlueTarget(wing);
        if (!target) return;

        const meldNm = this.meldNm(wing);
        const commitNm = this.commitNm();

        if (range <= commitNm) {
            this.enterCommit(wing, target, false);
            this.logWingCommit(wing, lead, 'commit_release');
        } else if (range <= meldNm) {
            this.enterMeld(wing, target);
            this.logWingCommit(wing, lead, 'meld_release');
        }
    }

    logWingCommit(wing, lead, phase) {
        const key = `${wing.id}_${phase}`;
        if (wing._lastWingCommitKey === key) return;
        wing._lastWingCommitKey = key;
        this.log('wing_commit', {
            trackId: wing.id,
            callsign: wing.callsign,
            leadCallsign: lead.callsign,
            phase
        });
    }

    blueMissilesRemaining(track) {
        return track.ordnance ? (track.ordnance.FOX3 || 0) : 0;
    }

    /** Hold CAP when Winchester/low ammo — but SORT shooters still react to new waves. */
    shouldHoldRecommit(track) {
        if (track.tacticalState !== 'CAP') return false;
        const hostiles = this.aliveHostileFighters();
        if (!hostiles.length) return false;

        const remaining = this.blueMissilesRemaining(track);

        // Assigned shooters must meld/commit (or WVR) against owned contacts — do not
        // sit on station while a later wave closes inside the meld ring.
        if (this.isSortAssignedShooter(track)) {
            const ownedIds = this.ownedHostileIds(track);
            const ownedLive = hostiles.filter(h =>
                ownedIds.indexOf(String(h.id)) >= 0
            );
            if (ownedLive.length) {
                const closest = this.pickClosest(track, ownedLive);
                if (closest.target) {
                    if (remaining > 0) return false;
                    if (closest.range <= this.meldNm(track) + 15) return false;
                }
            }
        }

        if (remaining === 0) {
            const now = Date.now();
            if (!track._lastWaveHoldAt || now - track._lastWaveHoldAt > 15000) {
                track._lastWaveHoldAt = now;
                this.log('wave_hold', {
                    trackId: track.id,
                    callsign: track.callsign,
                    missilesRemaining: 0,
                    hostilesActive: hostiles.length,
                    reason: 'winchester'
                });
            }
            return true;
        }

        const emp = this.blueEmploymentProfile(track);
        const minForRecommit = emp.minMissilesForRecommit != null ? emp.minMissilesForRecommit : 2;
        if (remaining >= minForRecommit) return false;

        if (hostiles.length > remaining) {
            const now = Date.now();
            if (!track._lastWaveHoldAt || now - track._lastWaveHoldAt > 15000) {
                track._lastWaveHoldAt = now;
                this.log('wave_hold', {
                    trackId: track.id,
                    callsign: track.callsign,
                    missilesRemaining: remaining,
                    hostilesActive: hostiles.length,
                    reason: 'low_ammo'
                });
            }
            return true;
        }
        return false;
    }

    /**
     * Pre-shot shaping: pure pursuit (nose on). Crank is post-FOX only (F-pole).
     */
    commitShapingHeading(track, target, braa) {
        return braa.bearing;
    }

  /**
     * Attempt FOX3; returns true if spawned.
     */
    tryFoxShot(track, target, braa, fromMeld) {
        const shot = this.canTakeFoxShot(track, target, braa);
        if (!shot.ok) {
            const emp = this.blueEmploymentProfile(track);
            const foxMax = emp.foxMaxNm != null ? emp.foxMaxNm : this.wezNm;
            if (braa.range <= foxMax && track.hasTargeted) {
                this.logFoxHold(track, target, shot.reason, braa);
                if (shot.reason === 'winchester' && !track.winchesterLogged) {
                    track.winchesterLogged = true;
                    this.log('winchester', {
                        trackId: track.id,
                        callsign: track.callsign,
                        type: 'FOX3'
                    });
                }
            }
            return false;
        }

        track.lastFoxAt = Date.now();
        track.foxFiredForTarget = target.id;
        track.crankSide = track.crankSide || 'LEFT';
        track.pendingSkoshMissile = true;

        const spawned = this.scope.spawnMissile
            ? this.scope.spawnMissile({ shooter: track, target, type: 'FOX3' })
            : null;

        if (!spawned) return false;

        const logType = fromMeld ? 'fox_from_meld' : 'fox3';
        const detail = {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target.id,
            targetCallsign: target.callsign,
            rangeNm: braa.range,
            aspect: shot.aspect,
            aspectDeg: shot.aspectDeg,
            ataDeg: shot.ataDeg,
            remaining: track.ordnance ? track.ordnance.FOX3 : null
        };
        this.log(logType, detail);
        if (!fromMeld) this.log('fox3', detail);

        track.tacticalState = 'CRANK';
        this.runCrank(track);
        return true;
    }

    holdBlueFormation(track) {
        const f = track.formation;
        const lead = this.getBlueFlightLead(track);
        track.speed = track.cruiseSpeed || track.speed || 420;
        const maxSep = track.wingMaxSepNm || 5;

        if (!f || !lead || f.role === 'LEAD') return;

        const leadXY = this.scope.bearingRangeToXY(lead.bearing, lead.range);
        const scale = this.scope.scale;
        const tx = leadXY.x + (f.offsetNmEast || 0) * scale;
        const ty = leadXY.y - (f.offsetNmNorth || 0) * scale;
        const slot = this.scope.xyToBearingRange(tx, ty);
        const toSlot = this.scope.calculateBRAA(track.bearing, track.range, slot.bearing, slot.range);
        const toLead = this.scope.calculateBRAA(track.bearing, track.range, lead.bearing, lead.range);

        if (toLead.range > maxSep) {
            track.targetHeading = toLead.bearing;
            track.speed = Math.min((track.cruiseSpeed || 420) + 60, 540);
            return;
        }

        if (toSlot.range > 2.5) {
            track.targetHeading = toSlot.bearing;
            track.speed = Math.min((track.cruiseSpeed || 420) + 40, 520);
        } else {
            track.targetHeading = lead.heading != null ? lead.heading : 90;
            track.speed = lead.speed || track.cruiseSpeed || 420;
        }
    }

    /** Resolve blue CAP station (own or nearest scope CAP). */
    resolveCapStation(track) {
        if (track && track.capStation) return track.capStation;
        const lead = track ? this.getBlueFlightLead(track) : null;
        if (lead && lead.capStation) return lead.capStation;
        const caps = this.scope.capPoints || this.scope.caps || [];
        if (!caps.length || !track) return null;
        let best = null;
        let bestR = Infinity;
        caps.forEach((c) => {
            const r = this.scope.calculateBRAA(
                track.bearing, track.range, c.bearing, c.range
            ).range;
            if (r < bestR) {
                bestR = r;
                best = c;
            }
        });
        return best;
    }

    /** Steer blue home — never bare east (90) with no return plan. */
    blueHomeHeading(track) {
        const station = this.resolveCapStation(track);
        if (station) {
            return this.scope.calculateBRAA(
                track.bearing, track.range, station.bearing, station.range
            ).bearing;
        }
        // Toward bullseye as last resort
        return this.normalizeHdg((track.bearing || 0) + 180);
    }

    rememberTargetCue(track, target) {
        if (!track || !target) return;
        const braa = this.braa(track, target);
        track.lastTargetBearing = braa.bearing;
        track.lastTargetRangeNm = braa.range;
        track.lastTargetAt = Date.now();
    }

    /**
     * Red search / reorient heading after lost SA.
     * Bare ingress 90 (east) is only for the initial push — not after overshoot.
     */
    redSearchHeading(track) {
        const perceived = this.pickRedTarget(track);
        if (perceived) {
            this.rememberTargetCue(track, perceived);
            return this.braa(track, perceived).bearing;
        }
        if (
            track.lastTargetBearing != null
            && track.lastTargetAt
            && Date.now() - track.lastTargetAt < 120000
        ) {
            return track.lastTargetBearing;
        }
        // Blue CAP / fighters centroid (training reorient — keeps package on picture)
        const blues = this.worldTracks().filter(t =>
            !t.hostile && t.type === 'fighter' && !t.isSplashed
        );
        if (blues.length) {
            let sx = 0;
            let sy = 0;
            let n = 0;
            blues.forEach((b) => {
                if (!this.scope.bearingRangeToXY) return;
                const p = this.scope.bearingRangeToXY(b.bearing, b.range);
                sx += p.x;
                sy += p.y;
                n += 1;
            });
            if (n && this.scope.xyToBearingRange) {
                const mid = this.scope.xyToBearingRange(sx / n, sy / n);
                return this.scope.calculateBRAA(
                    track.bearing, track.range, mid.bearing, mid.range
                ).bearing;
            }
        }
        // Default reorient west (threat axis for NTTR E–W stack)
        return 270;
    }

    shouldUseRedIngressHeading(track) {
        // After first commit / lost lock — never resume mindless 090 drone
        if (track.hadRedCommit) return false;
        const r = track.range || 0;
        const brg = ((track.bearing || 0) % 360 + 360) % 360;
        // Still outbound from the west (far from bullseye)
        if (r > (this.redIngressMaxRangeNm || 95)) return true;
        // Western sector, still approaching CAP belt
        const westSector = brg >= 200 && brg <= 340;
        if (westSector && r > 55) return true;
        // Inside/through the picture with no SA — search, don't continue east
        return false;
    }

    holdCap(track) {
        if (track.formation && track.formation.role === 'WING') {
            // Unreleased wing: hold CAP station / formation — do not chase lead into the fight
            if (!track.sortReleased && !track.forceSortEngage) {
                if (this.isBlueFormationHoldState(track)) {
                    this.holdBlueFormation(track);
                    return;
                }
                // Lead committed: wing stays on CAP station (reserve), not pure pursuit of lead
                const station = track.capStation
                    || (this.getBlueFlightLead(track) && this.getBlueFlightLead(track).capStation);
                if (station) {
                    const toStation = this.scope.calculateBRAA(
                        track.bearing, track.range, station.bearing, station.range
                    );
                    if (toStation.range > (this.capReturnNm || 5)) {
                        track.targetHeading = toStation.bearing;
                        track.speed = Math.min((track.cruiseSpeed || 420) + 80, 520);
                    } else {
                        this.holdBlueFormation(track);
                    }
                    return;
                }
            }
            if (this.isBlueFormationHoldState(track)) {
                this.holdBlueFormation(track);
                return;
            }
            const lead = this.getBlueFlightLead(track);
            if (lead) {
                track.targetHeading = lead.heading != null
                    ? lead.heading
                    : this.blueHomeHeading(track);
                track.speed = lead.speed || track.cruiseSpeed || 420;
            } else {
                track.targetHeading = this.blueHomeHeading(track);
            }
            return;
        }

        const station = this.resolveCapStation(track);
        if (station && !track.capStation) track.capStation = {
            name: station.name,
            bearing: station.bearing,
            range: station.range
        };
        track.speed = track.cruiseSpeed || track.speed || 420;

        if (!station) {
            track.targetHeading = this.blueHomeHeading(track);
            return;
        }

        const toStation = this.scope.calculateBRAA(
            track.bearing, track.range, station.bearing, station.range
        );
        if (toStation.range > this.capReturnNm) {
            track.targetHeading = toStation.bearing;
            track.speed = Math.min((track.cruiseSpeed || 420) + 100, 550);
            return;
        }

        const center = this.scope.bearingRangeToXY(station.bearing, station.range);
        const pos = this.scope.bearingRangeToXY(track.bearing, track.range);
        const scale = this.scope.scale;
        const along = (pos.x - center.x) / scale;
        const half = this.capLegHalfNm;

        if (!track.capOrbitLeg) track.capOrbitLeg = 'EAST';
        if (track.capOrbitLeg === 'EAST' && along >= half) track.capOrbitLeg = 'WEST';
        if (track.capOrbitLeg === 'WEST' && along <= -half) track.capOrbitLeg = 'EAST';

        const look = 8;
        const targetAlong = track.capOrbitLeg === 'EAST'
            ? Math.min(along + look, half)
            : Math.max(along - look, -half);
        const laneAlong = 1.5;

        const tx = center.x + (targetAlong + laneAlong) * scale;
        const ty = center.y;
        let hdg = Math.atan2(ty - pos.y, tx - pos.x) * (180 / Math.PI) + 90;
        if (hdg < 0) hdg += 360;
        track.targetHeading = hdg;
        track.speed = track.cruiseSpeed || 420;
    }

    runMeld(track) {
        const picked = this.pickBlueTarget(track);
        const target = this.getAssignedTarget(track) || picked.target;
        if (!target) {
            track.tacticalState = 'CAP';
            this.holdCap(track);
            return;
        }
        track.assignedTargetId = target.id;
        const braa = this.braa(track, target);
        if (this.checkPursuitAbort(track, target, this.scope.lastDt)) return;

        this.maybeEnterTargeted(track, target, braa);

        if (this.tryFoxShot(track, target, braa, true)) return;

        // MELD = leave CAP racetrack; pure pursuit until inside FOX envelope
        track.targetHeading = this.commitShapingHeading(track, target, braa);
        track.speed = Math.min((track.cruiseSpeed || 420) + 80, 520);
    }

    executeBlueBvr(track) {
        if (!track.tacticalState || track.tacticalState === 'DEFEND') {
            if (track.assignedTargetId) {
                const tgt = this.getAssignedTarget(track);
                if (tgt && !this.shouldAbortPursuit(
                    track, tgt, this.braa(track, tgt), this.scope.lastDt
                ).abort) {
                    track.tacticalState = 'COMMITTED';
                } else {
                    track.tacticalState = 'CAP';
                    track.assignedTargetId = null;
                    track.pursuitLastRangeNm = null;
                    track.pursuitOpeningSec = 0;
                }
            } else {
                track.tacticalState = 'CAP';
            }
        }
        if (!track.cruiseSpeed) track.cruiseSpeed = track.speed || 420;

        this.syncWingEngagement(track);

        if (this.shouldHoldRecommit(track)) {
            this.holdCap(track);
            return true;
        }

        this.buildBlueSortPlan();
        const plan = this._blueSortPlan;
        const hostiles = this.aliveHostileFighters();
        const maxPer = this.maxContactsPerShooter || 3;
        const needed = hostiles.length === 0 ? 0 : Math.ceil(hostiles.length / maxPer);
        if (plan && needed > (plan.assignedLeadIds || []).length) {
            this.buildBlueSortPlan(true);
        } else if (plan && plan.untargeted && plan.untargeted.length) {
            this.buildBlueSortPlan(true);
        }

        const { target, range } = this.pickBlueTarget(track);
        const commitNm = this.commitNm();
        const meldNm = this.meldNm(track);
        const mayEngage = this.isSortAssignedShooter(track) || !!track.forceSortEngage;

        if (
            mayEngage
            && target
            && (track.tacticalState === 'CAP' || track.tacticalState === 'MELD')
        ) {
            if (range <= commitNm) {
                this.enterCommit(track, target, false);
            } else if (range <= meldNm && track.tacticalState === 'CAP') {
                this.enterMeld(track, target);
            }
        }

        switch (track.tacticalState) {
            case 'CAP':
                this.holdCap(track);
                break;
            case 'MELD':
                if (target && range <= commitNm) {
                    this.enterCommit(track, target, false);
                    this.runCommitted(track);
                } else {
                    this.runMeld(track);
                }
                break;
            case 'COMMITTED':
            case 'WEZ':
                this.runCommitted(track);
                break;
            case 'CRANK':
                this.runCrank(track);
                break;
            case 'SKOSH':
                this.runSkosh(track);
                break;
            case 'MERGE':
            case 'GUNS':
                this.runMerge(track, this.scope.lastDt || 0.1);
                break;
            default:
                this.holdCap(track);
        }

        if (track.isSpiked && track.tacticalState !== 'CRANK' && track.tacticalState !== 'WEZ' && track.tacticalState !== 'DEFEND' && track.tacticalState !== 'MERGE' && track.tacticalState !== 'GUNS') {
            this.applySpikeBias(track);
        }

        return true;
    }

    applySpikeBias(track) {
        const threat = this.findClosestThreat(track);
        if (!threat) return;
        const braa = this.braa(track, threat);
        if (braa.range < 15) {
            track.targetHeading = this.normalizeHdg(braa.bearing + 110);
            track.speed = Math.min((track.cruiseSpeed || track.speed || 420) + 200, 1100);
        } else if (braa.range < 25 && track.tacticalState === 'CAP') {
            track.targetHeading = this.normalizeHdg(braa.bearing + 90);
        }
    }

    runCommitted(track) {
        let target = this.getAssignedTarget(track);
        if (target && target.isSplashed) {
            this.clearTargeting(track);
            const adv = this.advanceOwnedTarget(track);
            target = adv.target;
            if (!target) {
                this.recoverCap(track);
                return;
            }
        }
        if (!target) {
            const n = this.pickBlueTarget(track);
            if (!n.target) {
                this.recoverCap(track);
                return;
            }
            track.assignedTargetId = n.target.id;
            target = n.target;
        }

        const braa = this.braa(track, target);
        if (this.checkPursuitAbort(track, target, this.scope.lastDt)) return;

        track.speed = Math.min((track.cruiseSpeed || 420) + 200, 900);

        // Shoot when nose-on (ATA gate), then crank — pure pursuit until employment cone
        this.maybeEnterTargeted(track, target, braa);

        const emp = this.blueEmploymentProfile(track);
        const foxMax = emp.foxMaxNm != null ? emp.foxMaxNm : this.wezNm;
        if (braa.range <= foxMax) {
            track.tacticalState = 'WEZ';
        }

        if (this.tryFoxShot(track, target, braa, false)) return;

        track.targetHeading = this.commitShapingHeading(track, target, braa);

        const shot = this.canTakeFoxShot(track, target, braa);
        const foxMin = emp.foxMinNm != null ? emp.foxMinNm : 8;
        const insideMin = shot.reason === 'inside_min_range' || braa.range < foxMin;
        if (
            target.type === 'fighter'
            && (shot.reason === 'winchester' || insideMin)
            && this.canEnterMerge(track, target)
        ) {
            this.enterMerge(track, target);
            return;
        }

        const hasAmmo = typeof hasBvrOrdnance === 'function'
            ? hasBvrOrdnance(track)
            : true;
        if (
            target.type === 'fighter'
            && (!hasAmmo || insideMin)
            && this.canEnterMerge(track, target)
        ) {
            this.enterMerge(track, target);
        }
    }

    runCrank(track) {
        const target = this.getAssignedTarget(track);
        if (!target) {
            this.recoverCap(track);
            return;
        }

        const braa = this.braa(track, target);
        if (this.checkPursuitAbort(track, target, this.scope.lastDt)) return;

        const side = track.crankSide === 'RIGHT' ? 1 : -1;
        track.targetHeading = this.normalizeHdg(braa.bearing + side * this.crankOffsetDeg);
        track.speed = Math.min((track.cruiseSpeed || 420) + 150, 850);

        const live = this.scope.getShooterMissiles
            ? this.scope.getShooterMissiles(track.id)
            : [];
        if (track.tacticalState === 'SKOSH') {
            this.runSkosh(track);
            return;
        }
        if (track.pendingSkoshMissile && live.length === 0) {
            track.pendingSkoshMissile = false;
            track.tacticalState = 'SKOSH';
            track.skoshUntil = Date.now() + this.skoshDurationSec * 1000;
            this.runSkosh(track);
        }
    }

    runSkosh(track) {
        const target = this.getAssignedTarget(track);
        if (target && !target.isSplashed) {
            const braa = this.braa(track, target);
            if (this.checkPursuitAbort(track, target, this.scope.lastDt)) return;
            track.targetHeading = this.normalizeHdg(braa.bearing + 90);
        } else {
            track.targetHeading = this.blueHomeHeading(track);
        }
        track.speed = track.cruiseSpeed || 420;
        track.pendingSkoshMissile = false;

        if (track.skoshUntil && Date.now() >= track.skoshUntil) {
            const still = this.getAssignedTarget(track);
            const hasAmmo = typeof hasBvrOrdnance === 'function'
                ? hasBvrOrdnance(track)
                : true;
            if (still && !still.isSplashed && hasAmmo) {
                const r = this.braa(track, still).range;
                const recommit = this.blueEmploymentProfile(track).recommitNm || 50;
                if (r <= recommit) {
                    track.tacticalState = 'COMMITTED';
                    track.foxFiredForTarget = null;
                    track.skoshUntil = null;
                    return;
                }
            }
            if (still && !still.isSplashed && still.type === 'fighter' && this.canEnterMerge(track, still)) {
                track.skoshUntil = null;
                this.enterMerge(track, still);
                return;
            }
            // Sequential SORT: next owned contact before CAP recover
            if (hasAmmo) {
                const adv = this.advanceOwnedTarget(track);
                if (adv.target) {
                    track.skoshUntil = null;
                    track.tacticalState = 'COMMITTED';
                    track.foxFiredForTarget = null;
                    return;
                }
            }
            this.recoverCap(track);
        }
    }

    recoverCap(track) {
        this.clearTargeting(track);
        track.tacticalState = 'CAP';
        track.assignedTargetId = null;
        track.skoshUntil = null;
        track.foxFiredForTarget = null;
        track.pendingSkoshMissile = false;
        track.gunSolutionSec = 0;
        track.pursuitLastRangeNm = null;
        track.pursuitOpeningSec = 0;
        track._lastWingCommitKey = null;
        track.sortReleased = false;
        track.forceSortEngage = false;
        this.log('cap_recover', { trackId: track.id, callsign: track.callsign });
        this.holdCap(track);
    }

    wvrProfile(track) {
        return typeof getDefensiveProfile === 'function'
            ? getDefensiveProfile(track)
            : { mergeNm: 8, gunMaxNm: 0.45, gunAspectDeg: 30, gunTrackSec: 2.0 };
    }

    /** Nearest enemy fighter (blue→hostile, red→friendly). Never self or same-side. */
    nearestHostileFighter(track) {
        let best = null;
        let bestR = Infinity;
        this.worldTracks().forEach((h) => {
            if (!h || h.type !== 'fighter' || h.isSplashed) return;
            if (String(h.id) === String(track.id)) return;
            if (!!h.hostile === !!track.hostile) return;
            const r = this.braa(track, h).range;
            if (r < bestR) {
                bestR = r;
                best = h;
            }
        });
        return best ? { target: best, range: bestR } : { target: null, range: Infinity };
    }

    /**
     * Gun cone = shooter ATA (nose toward bandit), NOT target HOT/COLD aspect.
     * Stern chase is aspect~180 in BRAA terms but is the correct guns geometry.
     */
    gunAspectDeg(shooter, target) {
        return this.offBoresightDeg(shooter, target);
    }

    /**
     * Enter WVR when inside merge bubble. Allowed with BVR left if inside FOX min
     * (otherwise trail + AIM-120 remaining left fighters stuck doing nothing).
     */
    canEnterMerge(track, target) {
        if (!target || target.type !== 'fighter' || target.isSplashed) return false;
        const profile = this.wvrProfile(track);
        const mergeNm = profile.mergeNm != null ? profile.mergeNm : 8;
        const range = this.braa(track, target).range;
        if (range > mergeNm) return false;

        const hasAmmo = typeof hasBvrOrdnance === 'function'
            ? hasBvrOrdnance(track)
            : true;
        if (!hasAmmo) return true;

        const emp = this.blueEmploymentProfile(track);
        const foxMin = emp.foxMinNm != null ? emp.foxMinNm : 8;
        // Inside AIM-120 min → convert to guns even with FOX3 remaining
        return range < foxMin;
    }

    enterMerge(track, target) {
        track.tacticalState = 'MERGE';
        track.assignedTargetId = target.id;
        track.gunSolutionSec = 0;
        this.log('merge', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target.id,
            targetCallsign: target.callsign
        });
    }

    tryGunKill(track, target, dt) {
        const profile = this.wvrProfile(track);
        const gunMax = profile.gunMaxNm != null ? profile.gunMaxNm : 0.45;
        const gunAspect = profile.gunAspectDeg != null ? profile.gunAspectDeg : 30;
        const gunTrack = profile.gunTrackSec != null ? profile.gunTrackSec : 2.0;
        const braa = this.braa(track, target);
        const aspect = this.gunAspectDeg(track, target);

        if (braa.range > gunMax || aspect > gunAspect) {
            track.gunSolutionSec = Math.max(0, (track.gunSolutionSec || 0) - (dt || 0.1) * 0.5);
            if (track.tacticalState === 'GUNS') track.tacticalState = 'MERGE';
            return false;
        }

        track.tacticalState = 'GUNS';
        track.gunSolutionSec = (track.gunSolutionSec || 0) + (dt || 0.1);
        if (track.gunSolutionSec < gunTrack) return false;

        const ev = this.scope.applyGunKill
            ? this.scope.applyGunKill(track, target)
            : null;
        if (ev) {
            this.log('gun_kill', ev);
            track.gunSolutionSec = 0;
            if (track.hostile) {
                const still = this.nearestHostileFighter(track);
                if (still.target && this.canEnterMerge(track, still.target)) {
                    this.enterMerge(track, still.target);
                } else {
                    track.tacticalState = 'PUSH_HVAA';
                }
            } else {
                this.recoverCap(track);
            }
            return true;
        }
        return false;
    }

    runMerge(track, dt) {
        let target = this.getAssignedTarget(track);
        if (!target || target.isSplashed || target.type !== 'fighter') {
            const n = this.nearestHostileFighter(track);
            if (!n.target) {
                if (track.hostile) {
                    track.tacticalState = 'PUSH_HVAA';
                    this.runRedPushHvaa(track);
                } else {
                    this.recoverCap(track);
                }
                return;
            }
            target = n.target;
            track.assignedTargetId = target.id;
        }

        const profile = this.wvrProfile(track);
        const mergeNm = profile.mergeNm != null ? profile.mergeNm : 8;
        const braa = this.braa(track, target);
        if (braa.range > mergeNm + 2) {
            track.gunSolutionSec = 0;
            if (track.hostile) {
                track.tacticalState = 'PUSH_HVAA';
                this.runRedPushHvaa(track);
            } else {
                this.recoverCap(track);
            }
            return;
        }

        track.targetHeading = braa.bearing;
        track.speed = Math.min((track.cruiseSpeed || track.speed || 450) + 250, 1100);
        this.tryGunKill(track, target, dt);
    }

    // --- Flanker / red BVR -------------------------------------------------

    /** True if track currently perceives targetId (no god-mode). */
    redPerceives(track, targetId) {
        if (!track || targetId == null) return false;
        const ids = track.perceivedTracks || [];
        return ids.some(id => String(id) === String(targetId));
    }

    /**
     * Red target pick — fighters/HVAA only from perceivedTracks (VLO honesty).
     * World tanker fallback only for PUSH_HVAA when nothing is perceived.
     */
    pickRedTarget(track) {
        const ids = track.perceivedTracks || [];
        const world = this.worldTracks();
        const perceived = ids
            .map(id => world.find(t => String(t.id) === String(id)))
            .filter(Boolean);

        const fighters = perceived.filter(t => !t.hostile && t.type === 'fighter');
        const hvaa = perceived.filter(t =>
            !t.hostile && (t.type === 'tanker' || t.type === 'awacs' || t.type === 'isr')
        );

        const forward = (t) => {
            const braa = this.braa(track, t);
            let rel = (braa.bearing - (track.heading || 90) + 360) % 360;
            if (rel > 180) rel -= 360;
            return { t, braa, forward: Math.abs(rel) <= 110 };
        };

        const scored = fighters.map(forward).sort((a, b) => a.braa.range - b.braa.range);
        const fwdHit = scored.find(s => s.forward);
        if (fwdHit) return fwdHit.t;
        if (scored.length) return scored[0].t;

        if (hvaa.length) {
            return hvaa.slice().sort((a, b) => this.braa(track, a).range - this.braa(track, b).range)[0];
        }

        // No god-mode fighter fallback — VLO means unseen blues stay unseen.
        // Tanker-only world fallback for PUSH_HVAA when radar is empty.
        return world.find(t => !t.hostile && t.type === 'tanker' && !t.isSplashed) || null;
    }

    getFormationLead(track) {
        const f = track.formation;
        if (!f || f.role === 'LEAD' || !f.leadCallsign) return null;
        return this.worldTracks().find(t =>
            t.hostile
            && String(t.callsign || '').toUpperCase() === String(f.leadCallsign).toUpperCase()
        ) || null;
    }

    holdFormation(track) {
        const f = track.formation;
        const lead = this.getFormationLead(track);
        track.speed = track.cruiseSpeed || track.speed || 480;

        if (!f || !lead || f.role === 'LEAD') {
            if (this.shouldUseRedIngressHeading(track)) {
                track.targetHeading = track.ingressHeading != null ? track.ingressHeading : 90;
            } else {
                track.targetHeading = this.redSearchHeading(track);
            }
            return;
        }

        const leadXY = this.scope.bearingRangeToXY(lead.bearing, lead.range);
        const scale = this.scope.scale;
        const tx = leadXY.x + (f.offsetNmEast || 0) * scale;
        const ty = leadXY.y - (f.offsetNmNorth || 0) * scale;
        const slot = this.scope.xyToBearingRange(tx, ty);
        const toSlot = this.scope.calculateBRAA(track.bearing, track.range, slot.bearing, slot.range);

        if (toSlot.range > 2.5) {
            track.targetHeading = toSlot.bearing;
            track.speed = Math.min((track.cruiseSpeed || 480) + 40, 540);
        } else {
            track.targetHeading = lead.heading != null
                ? lead.heading
                : this.redSearchHeading(track);
            track.speed = lead.speed || track.cruiseSpeed || 480;
        }
    }

    enterRedCommit(track, target) {
        track.tacticalState = 'COMMITTED';
        track.assignedTargetId = target.id;
        track.hadRedCommit = true;
        track.foxFiredForTarget = null;
        track.pendingSkoshMissile = false;
        track.skoshUntil = null;
        this.rememberTargetCue(track, target);
        this.log('red_commit', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target.id,
            targetCallsign: target.callsign
        });
    }

    executeFlankerBvr(track) {
        if (!track.tacticalState) track.tacticalState = 'INGRESS';
        if (!track.cruiseSpeed) track.cruiseSpeed = track.speed || 480;
        if (!track.crankSide) track.crankSide = 'RIGHT';
        if (track.adversaryProfile == null) track.adversaryProfile = 'flanker';

        const target = this.pickRedTarget(track);
        const range = target ? this.braa(track, target).range : Infinity;
        const isFighterTgt = target && target.type === 'fighter';
        const isHvaaTgt = target && (target.type === 'tanker' || target.type === 'awacs' || target.type === 'isr');

        if (
            isFighterTgt
            && this.redPerceives(track, target.id)
            && range <= this.redCommitNm
            && (track.tacticalState === 'INGRESS' || track.tacticalState === 'PUSH_HVAA')
        ) {
            this.enterRedCommit(track, target);
        }

        if (
            (!isFighterTgt || range > this.redCommitNm + 15)
            && isHvaaTgt
            && track.tacticalState !== 'CRANK'
            && track.tacticalState !== 'WEZ'
            && track.tacticalState !== 'SKOSH'
        ) {
            if (track.tacticalState === 'INGRESS' || track.tacticalState === 'COMMITTED') {
                track.tacticalState = 'PUSH_HVAA';
                track.assignedTargetId = target.id;
            }
        }

        switch (track.tacticalState) {
            case 'INGRESS':
                this.holdFormation(track);
                if (isFighterTgt && range <= this.redDetectNm) {
                    const braa = this.braa(track, target);
                    if (!track.formation || track.formation.role === 'LEAD') {
                        track.targetHeading = braa.bearing;
                    }
                }
                break;
            case 'COMMITTED':
            case 'WEZ':
                this.runRedCommitted(track);
                break;
            case 'CRANK':
                this.runRedCrank(track);
                break;
            case 'SKOSH':
                this.runRedSkosh(track);
                break;
            case 'PUSH_HVAA':
                this.runRedPushHvaa(track);
                break;
            case 'REATTACK':
                track.tacticalState = 'COMMITTED';
                this.runRedCommitted(track);
                break;
            case 'MERGE':
            case 'GUNS':
                this.runMerge(track, this.scope.lastDt || 0.1);
                break;
            default:
                this.holdFormation(track);
        }

        if (
            track.isSpiked
            && track.tacticalState !== 'CRANK'
            && track.tacticalState !== 'WEZ'
            && track.tacticalState !== 'DEFEND'
            && track.tacticalState !== 'MERGE'
            && track.tacticalState !== 'GUNS'
        ) {
            const threat = this.findClosestThreat(track);
            if (threat) {
                const b = this.braa(track, threat);
                if (b.range < 15) {
                    track.targetHeading = this.normalizeHdg(b.bearing + 110);
                    track.speed = Math.min((track.cruiseSpeed || 480) + 180, 1000);
                } else if (b.range <= 25) {
                    track.targetHeading = this.normalizeHdg(b.bearing + 90);
                }
            }
        }

        return true;
    }

    runRedCommitted(track) {
        let target = this.getAssignedTarget(track) || this.pickRedTarget(track);
        // Drop assigned fighter if no longer perceived (VLO / break lock)
        if (target && target.type === 'fighter' && !this.redPerceives(track, target.id)) {
            track.assignedTargetId = null;
            target = this.pickRedTarget(track);
        }
        if (!target || (target.type === 'fighter' && !this.redPerceives(track, target.id))) {
            track.assignedTargetId = null;
            track.tacticalState = 'INGRESS';
            track.targetHeading = this.redSearchHeading(track);
            track.speed = track.cruiseSpeed || 480;
            this.holdFormation(track);
            return;
        }
        track.assignedTargetId = target.id;
        const braa = this.braa(track, target);
        this.rememberTargetCue(track, target);
        track.speed = Math.min((track.cruiseSpeed || 480) + 180, 920);
        track.targetHeading = braa.bearing;

        const cooled = !track.lastFoxAt
            || (Date.now() - track.lastFoxAt) / 1000 >= this.redFoxCooldownSec;
        const alreadyFlying = this.scope.getShooterMissiles
            && this.scope.getShooterMissiles(track.id).length > 0;

        // Only shoot fighters we currently perceive
        const mayShoot = target.type !== 'fighter' || this.redPerceives(track, target.id);

        if (cooled && !alreadyFlying && mayShoot) {
            const canR77 = typeof canFireOrdnance === 'function'
                ? canFireOrdnance(track, 'R77')
                : true;
            const canR27 = typeof canFireOrdnance === 'function'
                ? canFireOrdnance(track, 'R27')
                : true;

            const empGate = this.canTakeRedShot(track, target, braa);
            if (!empGate.ok) {
                if (braa.range <= this.redR27WezNm) {
                    this.logFoxHold(track, target, empGate.reason, braa);
                }
            } else if (braa.range <= this.redR77WezNm && canR77) {
                this.fireRedMissile(track, target, 'R77', braa.range);
            } else if (
                braa.range <= this.redR27WezNm
                && braa.range > this.redR77WezNm
                && canR27
            ) {
                this.fireRedMissile(track, target, 'R27', braa.range);
            } else if (!canR77 && !canR27) {
                if (!track.winchesterLogged) {
                    track.winchesterLogged = true;
                    this.log('winchester', {
                        trackId: track.id,
                        callsign: track.callsign,
                        type: 'BVR'
                    });
                }
                if (target.type === 'fighter' && this.canEnterMerge(track, target)) {
                    this.enterMerge(track, target);
                } else {
                    track.tacticalState = 'PUSH_HVAA';
                    this.runRedPushHvaa(track);
                }
            }
        }
    }

    /**
     * Red employment: nose within ATA cone + target HOT/FLANK (same training proxy as blue).
     */
    canTakeRedShot(track, target, braa) {
        const ata = this.offBoresightDeg(track, target);
        const maxAta = 40;
        if (ata > maxAta) {
            return { ok: false, reason: 'ata_hold', ataDeg: Math.round(ata) };
        }
        const aspect = this.getTargetAspect(track, target);
        if (aspect.angle > 60) {
            return { ok: false, reason: 'aspect_' + aspect.classification.toLowerCase() };
        }
        return {
            ok: true,
            aspect: aspect.classification,
            aspectDeg: aspect.angle,
            ataDeg: Math.round(ata)
        };
    }

    fireRedMissile(track, target, type, rangeNm) {
        const canFire = typeof canFireOrdnance === 'function'
            ? canFireOrdnance(track, type)
            : true;
        if (!canFire) return false;

        track.tacticalState = 'WEZ';
        track.lastFoxAt = Date.now();
        track.foxFiredForTarget = target.id;
        track.pendingSkoshMissile = true;
        track.crankSide = track.crankSide || 'RIGHT';

        const spawned = this.scope.spawnMissile
            ? this.scope.spawnMissile({ shooter: track, target, type })
            : null;
        if (!spawned) return false;

        const key = typeof ordnanceKey === 'function' ? ordnanceKey(type) : type;
        this.log(type === 'R27' ? 'fox1' : 'fox3', {
            trackId: track.id,
            callsign: track.callsign,
            targetId: target.id,
            targetCallsign: target.callsign,
            rangeNm,
            type,
            adversary: 'flanker',
            ataDeg: Math.round(this.offBoresightDeg(track, target)),
            aspect: this.getTargetAspect(track, target).classification,
            remaining: track.ordnance ? track.ordnance[key] : null
        });

        track.tacticalState = 'CRANK';
        this.runRedCrank(track);
        return true;
    }

    runRedCrank(track) {
        const target = this.getAssignedTarget(track);
        if (!target) {
            track.tacticalState = 'PUSH_HVAA';
            this.runRedPushHvaa(track);
            return;
        }
        const braa = this.braa(track, target);
        const side = track.crankSide === 'LEFT' ? -1 : 1;
        track.targetHeading = this.normalizeHdg(braa.bearing + side * this.redCrankDeg);
        track.speed = Math.min((track.cruiseSpeed || 480) + 120, 880);

        const live = this.scope.getShooterMissiles
            ? this.scope.getShooterMissiles(track.id)
            : [];
        if (track.tacticalState === 'SKOSH') {
            this.runRedSkosh(track);
            return;
        }
        if (track.pendingSkoshMissile && live.length === 0) {
            track.pendingSkoshMissile = false;
            track.tacticalState = 'SKOSH';
            track.skoshUntil = Date.now() + this.skoshDurationSec * 1000;
            this.runRedSkosh(track);
        }
    }

    runRedSkosh(track) {
        const target = this.getAssignedTarget(track);
        if (target && !target.isSplashed) {
            const braa = this.braa(track, target);
            track.targetHeading = this.normalizeHdg(braa.bearing + 95);
        } else {
            track.targetHeading = this.redSearchHeading(track);
        }
        track.speed = track.cruiseSpeed || 480;
        track.pendingSkoshMissile = false;

        if (track.skoshUntil && Date.now() >= track.skoshUntil) {
            const still = this.getAssignedTarget(track);
            const hasAmmo = typeof hasBvrOrdnance === 'function'
                ? hasBvrOrdnance(track)
                : true;
            if (still && !still.isSplashed && still.type === 'fighter' && hasAmmo) {
                const r = this.braa(track, still).range;
                if (r <= this.redCommitNm + 10) {
                    track.tacticalState = 'REATTACK';
                    track.foxFiredForTarget = null;
                    track.skoshUntil = null;
                    return;
                }
            }
            if (still && !still.isSplashed && still.type === 'fighter' && this.canEnterMerge(track, still)) {
                track.skoshUntil = null;
                this.enterMerge(track, still);
                return;
            }
            track.tacticalState = 'PUSH_HVAA';
            track.skoshUntil = null;
            this.runRedPushHvaa(track);
        }
    }

    runRedPushHvaa(track) {
        const fighterInfo = this.nearestHostileFighter(track);
        if (fighterInfo.target && this.canEnterMerge(track, fighterInfo.target)) {
            this.enterMerge(track, fighterInfo.target);
            return;
        }

        const world = this.worldTracks();
        let target = this.getAssignedTarget(track);
        if (!target || target.type === 'fighter') {
            target = world.find(t => !t.hostile && t.type === 'tanker')
                || world.find(t => !t.hostile && (t.type === 'awacs' || t.type === 'isr'));
        }
        if (!target && this.scope.dal) {
            const toDal = this.scope.calculateBRAA(
                track.bearing, track.range, this.scope.dal.bearing, this.scope.dal.range
            );
            track.targetHeading = toDal.bearing;
            track.speed = Math.min((track.cruiseSpeed || 480) + 100, 600);
            return;
        }
        if (!target) {
            track.targetHeading = this.redSearchHeading(track);
            track.speed = track.cruiseSpeed || 480;
            return;
        }
        track.assignedTargetId = target.id;
        const braa = this.braa(track, target);
        this.rememberTargetCue(track, target);
        track.targetHeading = braa.bearing;
        track.speed = Math.min((track.cruiseSpeed || 480) + 120, 700);

        const cooled = !track.lastFoxAt
            || (Date.now() - track.lastFoxAt) / 1000 >= this.redFoxCooldownSec;
        const alreadyFlying = this.scope.getShooterMissiles
            && this.scope.getShooterMissiles(track.id).length > 0;
        const canR77 = typeof canFireOrdnance === 'function'
            ? canFireOrdnance(track, 'R77')
            : true;
        if (cooled && !alreadyFlying && canR77 && braa.range <= this.redR77WezNm) {
            const empGate = this.canTakeRedShot(track, target, braa);
            if (empGate.ok) {
                this.fireRedMissile(track, target, 'R77', braa.range);
            } else {
                this.logFoxHold(track, target, empGate.reason, braa);
            }
        }

        const fighter = this.pickRedTarget(track);
        if (fighter && fighter.type === 'fighter') {
            const fr = this.braa(track, fighter).range;
            if (fr <= this.redCommitNm) {
                this.enterRedCommit(track, fighter);
            }
        }
    }

    findClosestThreat(track) {
        return this.worldTracks()
            .filter(t => t.id !== track.id && !!t.hostile !== !!track.hostile)
            .reduce((prev, curr) => {
                const dist = this.braa(track, curr).range;
                if (!prev || dist < prev.dist) return { track: curr, dist };
                return prev;
            }, null)?.track;
    }
}

window.PilotAI = PilotAI;
