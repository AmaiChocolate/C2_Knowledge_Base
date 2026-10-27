/**
 * Smooth track animation: BC3-style kinematics with deterministic sim time.
 */
class AnimationEngine {
    constructor(scope) {
        this.scope = scope;
        this.animSpeed = 1;
        this.simTime = 0;
        this.fixedStep = 1 / 60;
        this.accumulator = 0;
        this.plotIntervalSec = 4;
        this.lastPlotTime = 0;
        this.motionScript = null;
        this.releasedWaveIds = new Set();
        this.paused = false;
        // Optional ManeuverDirector: turns groups after the picture is called.
        this.maneuvers = null;
        // Set once when the raid reaches its stop line (or a threat reaches its target).
        this.runComplete = false;
    }

    setSpeed(mult) {
        this.animSpeed = Math.max(0.25, Math.min(8, mult));
    }

    reset(tracks, motionScript) {
        this.simTime = 0;
        this.accumulator = 0;
        this.lastPlotTime = 0;
        this.motionScript = motionScript || null;
        this.releasedWaveIds = new Set();
        this.paused = false;
        this.runComplete = false;

        (tracks || []).forEach(t => {
            t.history = [];
            t.radarPlots = [];
            t.currentSpeed = t.speed;
            if (t.targetHeading == null) t.targetHeading = t.heading;
            if (t._spawnBearing == null) {
                t._spawnBearing = t.bearing;
                t._spawnRange = t.range;
                t._spawnHeading = t.heading;
            }
            if (!t.isDormant && t.waveId) {
                this.releasedWaveIds.add(t.waveId);
            }
        });
    }

    /** Stop line for an ingressing track: pulled in once the picture is called and maneuvers start. */
    stopLineOf(track) {
        const base = track.ingressStopNm != null ? track.ingressStopNm : 55;
        return this.maneuvers ? this.maneuvers.stopLineOf(track) : base;
    }

    /**
     * Unfreeze a run that stopped at the stop line: groups that were holding there
     * ingress again, on to the pulled-in stop line.
     */
    resumeRun() {
        if (!this.runComplete) return;
        this.runComplete = false;
        this.paused = false;
        (this.scope.tracks || []).forEach(t => {
            if (!t.hostile || t.motionState !== 'HOLD' || t.isCapOrbit) return;
            t.motionState = null;
            t.orbitAnchor = null;
            t.ingress = true;
        });
    }

    /** The picture stops being a clean ingress here, so freeze once and let the student finish. */
    completeRun() {
        if (this.runComplete) return;
        this.runComplete = true;
        this.paused = true;
    }

    update(dt) {
        if (this.paused) return;
        const scaled = dt * this.animSpeed;
        this.accumulator += scaled;
        while (this.accumulator >= this.fixedStep && !this.paused) {
            this.simTime += this.fixedStep;
            this.fixedUpdate(this.fixedStep);
            this.accumulator -= this.fixedStep;
        }

        if (this.scope.showPlots && this.simTime - this.lastPlotTime >= this.plotIntervalSec) {
            this.lastPlotTime = this.simTime;
            (this.scope.tracks || []).forEach(t => {
                if (t.isDormant) return;
                if (!t.radarPlots) t.radarPlots = [];
                const pos = this.scope.bearingRangeToXY(t.bearing, t.range);
                t.radarPlots.push({ x: pos.x, y: pos.y, age: this.simTime });
                if (t.radarPlots.length > 12) t.radarPlots.shift();
            });
        }
    }

    fixedUpdate(dt) {
        this.updateWaves();
        const tracks = this.scope.tracks || [];
        if (this.maneuvers) this.maneuvers.update(tracks, this.simTime);

        tracks.forEach(t => {
            if (t.isDormant) return;
            this.setTrackIntent(t);
        });
        tracks.forEach(t => {
            if (t.isDormant) return;
            TrackKinematics.integrate(t, dt, this.scope);
            this.updateTrail(t);
        });
    }

    updateWaves() {
        const waves = this.motionScript && this.motionScript.waves;
        if (!waves || !waves.length) return;

        waves.forEach(w => {
            if (this.releasedWaveIds.has(w.id)) return;
            if (this.simTime < (w.releaseAtSec || 0)) return;

            this.releasedWaveIds.add(w.id);
            (this.scope.tracks || []).forEach(t => {
                if (t.waveId !== w.id) return;
                t.isDormant = false;
                if (t.hostile && !t.isCapOrbit && !t.orbitAnchor) {
                    t.ingress = true;
                    t.targetHeading = t.ingressHeading != null ? t.ingressHeading : t.heading;
                }
            });
        });
    }

    setTrackIntent(track) {
        if (track.formationAnchor) {
            const lead = (this.scope.tracks || []).find(t => t.id === track.formationAnchor);
            if (lead && !lead.isDormant) {
                TrackKinematics.steerFormationWing(track, lead, this.scope);
            }
            return;
        }

        if (track.hostile && track.maneuverHeading != null) {
            this.steerManeuver(track);
            return;
        }

        if (!track.hostile && (track.capStation || track.capLegHalfNm != null)) {
            TrackKinematics.steerCap(track, this.scope);
            return;
        }

        if (track.orbitAnchor || track.isCapOrbit) {
            TrackKinematics.steerOrbit(track, this.scope);
            return;
        }

        if (track.hostile && track.isThreat) {
            this.steerThreatIngress(track);
            return;
        }

        if (track.hostile && track.ingress) {
            track.targetHeading = track.ingressHeading != null ? track.ingressHeading : track.heading;
            track.speed = track.cruiseSpeed || track.speed || 480;

            if (track.range < this.stopLineOf(track)) {
                this.completeRun();
                track.ingress = false;
                track.motionState = 'HOLD';
                if (!track.orbitAnchor) {
                    track.orbitAnchor = {
                        bearing: track._holdBearing != null ? track._holdBearing : track.bearing,
                        range: track._holdRange != null ? track._holdRange : track.range,
                        legLength: track.holdLegLength || 18,
                        legHeading: track.ingressHeading != null ? track.ingressHeading : track.heading,
                        laneCross: 4
                    };
                    track.orbitLeg = track.holdOrbitLeg || 'EAST';
                }
            }
            return;
        }

        if (track.motionState === 'HOLD' && track.orbitAnchor) {
            TrackKinematics.steerOrbit(track, this.scope);
        }
    }

    /** Fly the maneuver heading; the stop line (or inside it, if it started there) ends the run. */
    steerManeuver(track) {
        track.targetHeading = track.maneuverHeading;
        track.speed = track.cruiseSpeed || track.speed || 480;
        const floorNm = track.maneuverFloorNm != null ? track.maneuverFloorNm : this.stopLineOf(track);
        if (track.range >= floorNm) return;
        this.completeRun();
        track.maneuverHeading = null;
        track.motionState = 'HOLD';
        track.orbitAnchor = {
            bearing: track.bearing,
            range: track.range,
            legLength: track.holdLegLength || 18,
            legHeading: track.heading,
            laneCross: 4
        };
        track.orbitLeg = track.holdOrbitLeg || 'EAST';
    }

    steerThreatIngress(track) {
        const blues = (this.scope.tracks || []).filter(t => !t.hostile && !t.isDormant && t.capStation);
        let target = blues[0];
        if (blues.length > 1) {
            let bestR = Infinity;
            blues.forEach(b => {
                const braa = this.scope.calculateBRAA(track.bearing, track.range, b.bearing, b.range);
                if (braa.range < bestR) {
                    bestR = braa.range;
                    target = b;
                }
            });
        }
        if (target) {
            const braa = Geo.bearingRange(track, target);
            track.targetHeading = braa.bearing;
            if (braa.range < 5) this.completeRun();
        } else {
            track.targetHeading = track.ingressHeading != null ? track.ingressHeading : track.heading;
        }
        track.speed = track.cruiseSpeed || track.speed || 520;
    }

    updateTrail(track) {
        if (!this.scope.showTrail) return;
        const pos = this.scope.bearingRangeToXY(track.bearing, track.range);
        if (!track.history) track.history = [];
        const last = track.history[track.history.length - 1];
        if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) > 3) {
            track.history.push({ x: pos.x, y: pos.y });
            if (track.history.length > 20) track.history.shift();
        }
    }
}

if (typeof window !== 'undefined') window.AnimationEngine = AnimationEngine;
