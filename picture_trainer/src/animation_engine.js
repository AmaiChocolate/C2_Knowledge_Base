/**
 * Smooth track animation — ingress, CAP racetrack, formation hold.
 */
class AnimationEngine {
    constructor(scope) {
        this.scope = scope;
        this.animSpeed = 1;
        this.simTime = 0;
        this.plotIntervalSec = 4;
        this.lastPlotTime = 0;
    }

    setSpeed(mult) {
        this.animSpeed = Math.max(0.25, Math.min(8, mult));
    }

    reset(tracks) {
        this.simTime = 0;
        this.lastPlotTime = 0;
        (tracks || []).forEach(t => {
            t.history = [];
            t.radarPlots = [];
            t._animState = t.capStation ? 'cap' : (t.hostile ? 'ingress' : 'cap');
            t._capAlong = 0;
            t._capLeg = t.capOrbitLeg || 'EAST';
            if (t._spawnBearing == null) {
                t._spawnBearing = t.bearing;
                t._spawnRange = t.range;
                t._spawnHeading = t.heading;
            }
        });
    }

    update(dt) {
        const scaled = dt * this.animSpeed;
        this.simTime += scaled;
        const tracks = this.scope.tracks || [];

        tracks.forEach(t => this.updateTrack(t, scaled));

        if (this.scope.showPlots && this.simTime - this.lastPlotTime >= this.plotIntervalSec) {
            this.lastPlotTime = this.simTime;
            tracks.forEach(t => {
                if (!t.radarPlots) t.radarPlots = [];
                const pos = this.scope.bearingRangeToXY(t.bearing, t.range);
                t.radarPlots.push({ x: pos.x, y: pos.y, age: this.simTime });
                if (t.radarPlots.length > 12) t.radarPlots.shift();
            });
        }
    }

    updateTrack(track, dt) {
        if (track.formationAnchor) {
            this.followFormationAnchor(track, dt);
        } else if (track.capStation || track.capLegHalfNm != null) {
            this.updateCapOrbit(track, dt);
        } else if (track.hostile && track.ingress) {
            this.updateIngress(track, dt);
        } else if (track.isCapOrbit) {
            this.updateHostileCap(track, dt);
        }

        if (this.scope.showTrail) {
            const pos = this.scope.bearingRangeToXY(track.bearing, track.range);
            if (!track.history) track.history = [];
            const last = track.history[track.history.length - 1];
            if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) > 3) {
                track.history.push({ x: pos.x, y: pos.y });
                if (track.history.length > 20) track.history.shift();
            }
        }
    }

    followFormationAnchor(track, dt) {
        const lead = (this.scope.tracks || []).find(t => t.id === track.formationAnchor);
        if (!lead) return;
        const scale = this.scope.scale;
        const leadXY = this.scope.bearingRangeToXY(lead.bearing, lead.range);
        const tx = leadXY.x + (track.offsetNmEast || 0) * scale;
        const ty = leadXY.y - (track.offsetNmNorth || 0) * scale;
        const slot = this.scope.xyToBearingRange(tx, ty);
        track.bearing = slot.bearing;
        track.range = slot.range;
        track.heading = lead.heading;
        track.speed = lead.speed;
    }

    updateIngress(track, dt) {
        const nm = (track.speed || 480) / 3600 * dt;
        const h = track.heading != null ? track.heading : 90;
        const rad = (h - 90) * Math.PI / 180;
        const c = this.scope.bearingRangeToXY(track.bearing, track.range);
        const br = this.scope.xyToBearingRange(
            c.x + nm * this.scope.scale * Math.cos(rad),
            c.y + nm * this.scope.scale * Math.sin(rad)
        );
        track.bearing = br.bearing;
        track.range = br.range;
        if (track.range < 55) track.ingress = false;
    }

    updateCapOrbit(track, dt) {
        const st = track.capStation || { bearing: track.bearing, range: track.range };
        const half = track.capLegHalfNm != null ? track.capLegHalfNm : 8;
        const center = this.scope.bearingRangeToXY(st.bearing, st.range);
        const scale = this.scope.scale;
        const nm = (track.speed || 420) / 3600 * dt;

        if (track._capAlong == null) track._capAlong = 0;
        if (!track._capLeg) track._capLeg = 'EAST';

        track._capAlong += (track._capLeg === 'EAST' ? 1 : -1) * nm;
        if (track._capAlong >= half) {
            track._capAlong = half;
            track._capLeg = 'WEST';
        } else if (track._capAlong <= -half) {
            track._capAlong = -half;
            track._capLeg = 'EAST';
        }

        const lane = 1.5 * scale;
        const tx = center.x + track._capAlong * scale;
        const ty = center.y - lane;
        const br = this.scope.xyToBearingRange(tx, ty);
        track.bearing = br.bearing;
        track.range = br.range;
        track.heading = track._capLeg === 'EAST' ? 270 : 90;
    }

    updateHostileCap(track, dt) {
        track.heading = (track.heading + 30 * dt) % 360;
        const nm = (track.speed || 400) / 3600 * dt;
        const rad = (track.heading - 90) * Math.PI / 180;
        const c = this.scope.bearingRangeToXY(track.bearing, track.range);
        const br = this.scope.xyToBearingRange(
            c.x + nm * this.scope.scale * Math.cos(rad),
            c.y + nm * this.scope.scale * Math.sin(rad)
        );
        track.bearing = br.bearing;
        track.range = br.range;
    }
}

if (typeof window !== 'undefined') window.AnimationEngine = AnimationEngine;
