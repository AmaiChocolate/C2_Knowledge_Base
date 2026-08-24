/**
 * Trainer missile kinematics (2D scope).
 * FOX3 / R77: SUPPORT → ACTIVE (pitbull/SKOSH) → HIT | MISS
 * FOX1 / R27: SARH SUPPORT until kill or support break (no early ACTIVE)
 * Defeat: ARH ACTIVE + range + chaff/ECM; SARH sustained notch
 */
class MissileModel {
    static nextId = 1;

    constructor(opts) {
        const shooter = opts.shooter;
        const target = opts.target;
        this.id = `M${MissileModel.nextId++}_${Date.now()}`;
        this.type = opts.type || 'FOX3';
        this.guidance = opts.guidance || (this.isSarhType() ? 'SARH' : 'ACTIVE');
        this.shooterId = shooter.id;
        this.targetId = target.id;
        this.shooterHostile = !!shooter.hostile;
        this.shooterCallsign = shooter.callsign;
        this.targetCallsign = target.callsign;

        this.bearing = shooter.bearing;
        this.range = shooter.range;
        this.launchHeading = opts.launchHeading != null
            ? opts.launchHeading
            : (shooter.heading != null ? shooter.heading : 0);
        this.heading = this.launchHeading;
        this.speedKts = opts.speedKts != null ? opts.speedKts : 1800;
        this.boostSec = opts.boostSec != null ? opts.boostSec : 1.0;

        this.state = 'SUPPORT';
        this.activeNm = opts.activeNm != null
            ? opts.activeNm
            : (this.guidance === 'SARH' ? 0 : 8);
        this.killNm = opts.killNm != null ? opts.killNm : 1.5;
        this.maxFlightSec = opts.maxFlightSec != null
            ? opts.maxFlightSec
            : (this.guidance === 'SARH' ? 55 : 45);
        this.turnRateDeg = opts.turnRateDeg != null ? opts.turnRateDeg : 14;
        this.supportTurnRateDeg = opts.supportTurnRateDeg != null ? opts.supportTurnRateDeg : 8;
        this.leadSec = opts.leadSec != null ? opts.leadSec : 3;
        this.sarhBreakDeg = opts.sarhBreakDeg != null ? opts.sarhBreakDeg : 60;
        this.sarhBreakSec = opts.sarhBreakSec != null ? opts.sarhBreakSec : 3;

        this.flightAge = 0;
        this.sarhBreakTimer = 0;
        this.defeatTimer = 0;
        this.history = [];
        this.rangeToTarget = Infinity;
        this.skoshEmitted = false;
        this.splashEmitted = false;
        this.defeatEmitted = false;
        this.endedAt = null;
        this.lingerSec = 2.5;
        this.hitFlashUntil = 0;
    }

    isSarhType() {
        const t = String(this.type || '').toUpperCase();
        return t === 'FOX1' || t === 'R27';
    }

    isAlive() {
        return this.state === 'SUPPORT' || this.state === 'ACTIVE';
    }

    isVisible() {
        if (this.isAlive()) return true;
        if (!this.endedAt) return false;
        return (Date.now() - this.endedAt) / 1000 < this.lingerSec;
    }

    normalizeHdg(h) {
        return ((h % 360) + 360) % 360;
    }

    /** Bearing from target to this missile (inbound threat direction). */
    inboundBearingToTarget(scope, target) {
        return scope.calculateBRAA(
            target.bearing, target.range, this.bearing, this.range
        ).bearing;
    }

    /** True if target heading is beam/notch (~70–110°) to inbound missile. */
    targetInNotch(scope, target, profile) {
        const inbound = this.inboundBearingToTarget(scope, target);
        let aspect = Math.abs(((target.heading || 0) - inbound + 360) % 360);
        if (aspect > 180) aspect = 360 - aspect;
        const min = profile.notchMinDeg != null ? profile.notchMinDeg : 70;
        const max = profile.notchMaxDeg != null ? profile.notchMaxDeg : 110;
        return aspect >= min && aspect <= max;
    }

    /** Sim clock (seconds) — preferred so timeScale does not stretch wall-clock CM. */
    simNow(scope) {
        if (scope && scope.simTimeSec != null) return scope.simTimeSec;
        return Date.now() / 1000;
    }

    chaffActive(scope, target) {
        const sim = this.simNow(scope);
        let until = target.chaffUntilSim;
        if (until == null && target.chaffUntil) {
            // Legacy wall-clock ms → treat as absolute Date
            if (Date.now() >= target.chaffUntil) return false;
            until = sim + 1; // still active this frame
        }
        if (until == null || sim >= until) return false;
        // Chaff cloud only counts inside terminal range (proximity fuse proxy)
        if (this.rangeToTarget > (this._chaffEffNm || 12)) return false;
        return true;
    }

    /**
     * Evaluate defender notch/chaff/ECM defeat before hit check.
     * SUPPORT midcourse: datalink still closes — notch must NOT poison lead from 25 nm.
     * ACTIVE terminal: notch + chaff can defeat; mild lead bleed only inside CM envelope.
     */
    evaluateDefeat(scope, target, dt) {
        const events = {};
        if (!this.isAlive() || !target) return events;

        const profileFn = typeof getDefensiveProfile === 'function'
            ? getDefensiveProfile
            : () => ({ notchMinDeg: 70, notchMaxDeg: 110, arhDefeatSec: 2.5, sarhDefeatSec: 2, ecmStrength: 0.2 });
        const profile = profileFn(target);
        const inNotch = this.targetInNotch(scope, target, profile);
        this._chaffEffNm = profile.chaffEffectiveNm != null ? profile.chaffEffectiveNm : 12;
        const chaff = this.chaffActive(scope, target);

        if (this.guidance === 'SARH') {
            if (inNotch) {
                this.defeatTimer += dt;
                if (this.defeatTimer >= (profile.sarhDefeatSec || 2)) {
                    this.state = 'MISS';
                    this.endedAt = Date.now();
                    this.missReason = 'sarh_notch';
                    if (!this.defeatEmitted) {
                        this.defeatEmitted = true;
                        events.missile_defeat = {
                            missileId: this.id,
                            targetId: target.id,
                            targetCallsign: target.callsign,
                            reason: 'sarh_notch',
                            type: this.type
                        };
                    }
                }
            } else {
                this.defeatTimer = Math.max(0, this.defeatTimer - dt * 0.5);
            }
            return events;
        }

        // ARH defeat: ACTIVE + inside chaff envelope + continuous notch/chaff
        // ecmAssistOnly: ECM alone cannot defeat ARH
        if (this.state === 'ACTIVE') {
            const effNm = this._chaffEffNm;
            const inRange = this.rangeToTarget <= effNm;
            const ecmOk = (profile.ecmStrength || 0) > 0.1;
            const ecmAssistOnly = profile.ecmAssistOnly !== false;
            let need = null;
            let reason = null;
            if (inRange && inNotch) {
                if (chaff) {
                    need = profile.arhDefeatSecActive != null ? profile.arhDefeatSecActive : 3.0;
                    reason = 'chaff_notch';
                } else if (ecmOk && !ecmAssistOnly) {
                    need = profile.arhDefeatSecEcm != null ? profile.arhDefeatSecEcm : 5.0;
                    reason = 'ecm_notch';
                }
            }
            if (need != null) {
                this.defeatTimer += dt;
                if (this.defeatTimer >= need) {
                    this.state = 'MISS';
                    this.endedAt = Date.now();
                    this.missReason = reason;
                    if (!this.defeatEmitted) {
                        this.defeatEmitted = true;
                        events.missile_defeat = {
                            missileId: this.id,
                            targetId: target.id,
                            targetCallsign: target.callsign,
                            reason,
                            type: this.type,
                            rangeNm: this.rangeToTarget
                        };
                    }
                }
            } else if (ecmAssistOnly) {
                this.defeatTimer = 0;
            } else {
                this.defeatTimer = Math.max(0, this.defeatTimer - dt * 0.5);
            }

            // Terminal-only lead bleed — never during SUPPORT midcourse
            if (inNotch && this.rangeToTarget <= effNm * 1.25) {
                const ecmBleed = (profile.ecmStrength || 0) > 0.1 && !chaff ? 0.12 : 0.08;
                const maxLead = profile.maxLeadBleedSec != null ? profile.maxLeadBleedSec : 4.0;
                this.leadSec = Math.min(maxLead, (this.leadSec || 3) + dt * ecmBleed);
            }
        } else {
            this.defeatTimer = Math.max(0, this.defeatTimer - dt * 0.5);
        }

        return events;
    }

    update(scope, dt) {
        const events = {};
        if (!this.isAlive()) return events;

        this.flightAge += dt;
        const target = (scope.truthTracks || []).find(t =>
            String(t.id) === String(this.targetId) && !t.isSplashed
        );
        const shooter = (scope.truthTracks || []).find(t =>
            String(t.id) === String(this.shooterId)
        );

        if (!target) {
            this.state = 'MISS';
            this.endedAt = Date.now();
            return events;
        }

        if (this.flightAge >= this.maxFlightSec) {
            this.state = 'MISS';
            this.endedAt = Date.now();
            this.missReason = 'timeout';
            return events;
        }

        if (this.guidance === 'SARH') {
            if (!shooter || shooter.isSplashed) {
                this.state = 'MISS';
                this.endedAt = Date.now();
                return events;
            }
            const shootBraa = scope.calculateBRAA(
                shooter.bearing, shooter.range, target.bearing, target.range
            );
            let offBoresight = (shootBraa.bearing - (shooter.heading || 0) + 360) % 360;
            if (offBoresight > 180) offBoresight -= 360;
            if (Math.abs(offBoresight) > this.sarhBreakDeg) {
                this.sarhBreakTimer += dt;
                if (this.sarhBreakTimer >= this.sarhBreakSec) {
                    this.state = 'MISS';
                    this.endedAt = Date.now();
                    return events;
                }
            } else {
                this.sarhBreakTimer = 0;
            }
        }

        const tgtPos = scope.bearingRangeToXY(target.bearing, target.range);
        const toTgt = scope.calculateBRAA(this.bearing, this.range, target.bearing, target.range);
        this.rangeToTarget = toTgt.range;

        // Terminal: pure pursuit inside ~4 nm (lead point causes beam flybys)
        const useLead = this.rangeToTarget > 4 && this.flightAge >= this.boostSec;
        let desired;
        if (this.flightAge < this.boostSec) {
            desired = this.launchHeading;
        } else if (!useLead) {
            desired = toTgt.bearing;
        } else {
            const leadNm = (target.speed || 450) / 3600 * this.leadSec;
            const trad = ((target.heading || 0) - 90) * Math.PI / 180;
            const leadX = tgtPos.x + leadNm * scope.scale * Math.cos(trad);
            const leadY = tgtPos.y + leadNm * scope.scale * Math.sin(trad);
            const leadBR = scope.xyToBearingRange(leadX, leadY);
            desired = scope.calculateBRAA(
                this.bearing, this.range, leadBR.bearing, leadBR.range
            ).bearing;
        }
        let diff = (desired - this.heading + 360) % 360;
        if (diff > 180) diff -= 360;
        const rate = (this.guidance === 'SARH' || this.state === 'SUPPORT')
            ? this.supportTurnRateDeg
            : this.turnRateDeg;
        const maxTurn = rate * dt;
        if (Math.abs(diff) <= maxTurn) this.heading = desired;
        else this.heading = this.normalizeHdg(this.heading + Math.sign(diff) * maxTurn);

        const nmPerSec = this.speedKts / 3600;
        const dist = nmPerSec * dt;
        const rad = (this.heading - 90) * Math.PI / 180;
        const cur = scope.bearingRangeToXY(this.bearing, this.range);
        const next = scope.xyToBearingRange(
            cur.x + dist * scope.scale * Math.cos(rad),
            cur.y + dist * scope.scale * Math.sin(rad)
        );
        this.bearing = next.bearing;
        this.range = next.range;

        const pos = scope.bearingRangeToXY(this.bearing, this.range);
        this.history.push({ x: pos.x, y: pos.y });
        if (this.history.length > 8) this.history.shift();

        const after = scope.calculateBRAA(this.bearing, this.range, target.bearing, target.range);
        this.rangeToTarget = after.range;

        if (
            this.guidance !== 'SARH'
            && this.activeNm > 0
            && this.state === 'SUPPORT'
            && this.rangeToTarget <= this.activeNm
        ) {
            this.state = 'ACTIVE';
            if (!this.skoshEmitted) {
                this.skoshEmitted = true;
                events.skosh = {
                    missileId: this.id,
                    trackId: this.shooterId,
                    callsign: this.shooterCallsign,
                    targetId: this.targetId,
                    targetCallsign: this.targetCallsign,
                    rangeNm: this.rangeToTarget,
                    type: this.type,
                    pitbull: true
                };
            }
        }

        if (
            this.guidance === 'SARH'
            && this.state === 'SUPPORT'
            && this.rangeToTarget <= 4
            && !this.skoshEmitted
        ) {
            this.skoshEmitted = true;
            events.skosh = {
                missileId: this.id,
                trackId: this.shooterId,
                callsign: this.shooterCallsign,
                targetId: this.targetId,
                targetCallsign: this.targetCallsign,
                rangeNm: this.rangeToTarget,
                type: this.type
            };
        }

        // Defender defeat before hit
        const defeatEv = this.evaluateDefeat(scope, target, dt);
        if (defeatEv.missile_defeat) {
            events.missile_defeat = defeatEv.missile_defeat;
            return events;
        }

        if (this.rangeToTarget <= this.killNm) {
            this.state = 'HIT';
            this.endedAt = Date.now();
            this.hitFlashUntil = Date.now() + 800;
            target.isSplashed = true;
            target.isTargeted = false;
            if (!this.splashEmitted) {
                this.splashEmitted = true;
                events.splash = {
                    missileId: this.id,
                    trackId: this.shooterId,
                    callsign: this.shooterCallsign,
                    shooterHostile: !!this.shooterHostile,
                    targetId: this.targetId,
                    targetCallsign: target.callsign,
                    rangeNm: this.rangeToTarget,
                    type: this.type
                };
            }
        }

        return events;
    }
}

if (typeof window !== 'undefined') window.MissileModel = MissileModel;
