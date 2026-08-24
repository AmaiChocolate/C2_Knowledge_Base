/**
 * Smooth track animation — BC3-style kinematics with deterministic sim time.
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

    update(dt) {
        const scaled = dt * this.animSpeed;
        this.accumulator += scaled;
        while (this.accumulator >= this.fixedStep) {
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

            const stopNm = track.ingressStopNm != null ? track.ingressStopNm : 55;
            if (track.range < stopNm) {
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
            const braa = this.scope.calculateBRAA(track.bearing, track.range, target.bearing, target.range);
            track.targetHeading = braa.bearing;
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
