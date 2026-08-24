/**
 * Track kinematics — turn-rate integration + CAP/orbit/formation steering.
 * Ported from BC3 Scope Trainer physics (no BVR AI).
 */
const TrackKinematics = {
    normalizeHeading(h) {
        return ((h % 360) + 360) % 360;
    },

    integrate(track, dt, scope) {
        if (!track.speed || track.heading === undefined) return;

        if (track.targetHeading !== undefined && track.targetHeading !== track.heading) {
            let turnRate = track.turnRate;
            if (turnRate == null) {
                if (track.orbitAnchor) turnRate = 4.0;
                else if (track.hostile) turnRate = 3.5;
                else turnRate = 3.5;
            }
            const turnAmount = turnRate * dt;
            let diff = (track.targetHeading - track.heading + 360) % 360;
            if (diff < turnAmount || diff > 360 - turnAmount) {
                track.heading = track.targetHeading;
            } else {
                track.heading = (track.heading + (diff > 180 ? -turnAmount : turnAmount) + 360) % 360;
            }
            track.currentSpeed = track.speed * 0.95;
        } else {
            track.currentSpeed = track.speed;
        }

        const nmPerSec = (track.currentSpeed || track.speed) / 3600;
        const distanceNM = nmPerSec * dt;
        const rad = (track.heading - 90) * (Math.PI / 180);
        const dx = distanceNM * Math.cos(rad);
        const dy = distanceNM * Math.sin(rad);

        const currentXY = scope.bearingRangeToXY(track.bearing, track.range);
        const newBR = scope.xyToBearingRange(
            currentXY.x + dx * scope.scale,
            currentXY.y + dy * scope.scale
        );
        track.bearing = newBR.bearing;
        track.range = newBR.range;
    },

    steerCap(track, scope, opts = {}) {
        const capReturnNm = opts.capReturnNm != null ? opts.capReturnNm : 5;
        const capLegHalfNm = track.capLegHalfNm != null ? track.capLegHalfNm : (opts.capLegHalfNm || 10);
        const cruise = track.cruiseSpeed || track.speed || 420;
        track.speed = cruise;

        const station = track.capStation;
        if (!station) {
            track.targetHeading = track.heading;
            return;
        }

        const toStation = scope.calculateBRAA(
            track.bearing, track.range, station.bearing, station.range
        );
        if (toStation.range > capReturnNm) {
            track.targetHeading = toStation.bearing;
            track.speed = Math.min(cruise + 100, 550);
            return;
        }

        const center = scope.bearingRangeToXY(station.bearing, station.range);
        const pos = scope.bearingRangeToXY(track.bearing, track.range);
        const scale = scope.scale;
        const along = (pos.x - center.x) / scale;
        const half = capLegHalfNm;

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
        track.speed = cruise;
    },

    steerOrbit(track, scope) {
        const anchor = track.orbitAnchor;
        if (!anchor) return;

        const legHdg = Number(anchor.legHeading != null ? anchor.legHeading : 90);
        const half = Number(anchor.legLength != null ? anchor.legLength : 20) / 2;
        const laneCross = anchor.laneCross != null ? anchor.laneCross : 5;

        const center = scope.bearingRangeToXY(Number(anchor.bearing), Number(anchor.range));
        const pos = scope.bearingRangeToXY(track.bearing, track.range);
        const rad = (legHdg - 90) * (Math.PI / 180);
        const ax = Math.cos(rad);
        const ay = Math.sin(rad);
        const cx = ay;
        const cy = -ax;

        const dxNm = (pos.x - center.x) / scope.scale;
        const dyNm = (pos.y - center.y) / scope.scale;
        const along = dxNm * ax + dyNm * ay;

        if (!track.orbitLeg) track.orbitLeg = 'EAST';
        if (track.orbitLeg === 'EAST' && along >= half) track.orbitLeg = 'WEST';
        if (track.orbitLeg === 'WEST' && along <= -half) track.orbitLeg = 'EAST';

        const look = 10;
        const targetAlong = track.orbitLeg === 'EAST'
            ? Math.min(along + look, half)
            : Math.max(along - look, -half);

        const tx = center.x + (targetAlong * ax + laneCross * cx) * scope.scale;
        const ty = center.y + (targetAlong * ay + laneCross * cy) * scope.scale;
        let hdg = Math.atan2(ty - pos.y, tx - pos.x) * (180 / Math.PI) + 90;
        if (hdg < 0) hdg += 360;
        track.targetHeading = hdg;
    },

    steerFormationWing(wing, lead, scope, opts = {}) {
        const cruise = wing.cruiseSpeed || wing.speed || (wing.hostile ? 480 : 420);
        const maxSep = wing.wingMaxSepNm || 5;
        wing.speed = cruise;

        const leadXY = scope.bearingRangeToXY(lead.bearing, lead.range);
        const scale = scope.scale;
        const tx = leadXY.x + (wing.offsetNmEast || 0) * scale;
        const ty = leadXY.y - (wing.offsetNmNorth || 0) * scale;
        const slot = scope.xyToBearingRange(tx, ty);
        const toSlot = scope.calculateBRAA(wing.bearing, wing.range, slot.bearing, slot.range);
        const toLead = scope.calculateBRAA(wing.bearing, wing.range, lead.bearing, lead.range);

        const catchUpBoost = wing.hostile ? 40 : 60;
        const slotBoost = wing.hostile ? 40 : 40;
        const maxSpeed = wing.hostile ? 540 : 520;

        if (toLead.range > maxSep) {
            wing.targetHeading = toLead.bearing;
            wing.speed = Math.min(cruise + catchUpBoost, maxSpeed);
            return;
        }

        if (toSlot.range > 2.5) {
            wing.targetHeading = toSlot.bearing;
            wing.speed = Math.min(cruise + slotBoost, maxSpeed);
        } else {
            wing.targetHeading = lead.heading != null ? lead.heading : wing.heading;
            wing.speed = lead.speed || cruise;
        }
    }
};

if (typeof window !== 'undefined') window.TrackKinematics = TrackKinematics;
