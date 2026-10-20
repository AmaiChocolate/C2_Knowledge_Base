/**
 * Threat-axis orientation — E/W (west ingress) vs N/S (north ingress) —
 * plus the shared bullseye / threat-axis geometry every other module uses.
 *
 * Frames:
 *   bulls  { bearing (deg true, 0-360), range (nm) } from bullseye
 *   EN     { e, n } nm east / north of bullseye
 *   axis   { along, cross } nm; `along` grows in the direction hostiles fly
 *          (toward the fighters), `cross` is perpendicular to the threat axis.
 */
const ORIENTATIONS = {
    EW: {
        id: 'EW',
        label: 'E/W (West threat)',
        threatHeading: 90,
        friendlyCapBearing: 133,
        friendlyCapRange: 36,
        friendlyCapBearing2: 119,
        friendlyCapRange2: 30,
        threatBearingCenter: 270,
        trackFillIn: 'TRACK EAST',
        // Cardinal names for the two sides of the threat axis (cross < 0 / cross > 0).
        crossNames: { neg: 'NORTH', pos: 'SOUTH' }
    },
    NS: {
        id: 'NS',
        label: 'N/S (North threat)',
        threatHeading: 180,
        friendlyCapBearing: 163,
        friendlyCapRange: 36,
        friendlyCapBearing2: 197,
        friendlyCapRange2: 30,
        threatBearingCenter: 0,
        trackFillIn: 'TRACK SOUTH',
        crossNames: { neg: 'EAST', pos: 'WEST' }
    }
};

function getOrientation(id) {
    return ORIENTATIONS[id] || ORIENTATIONS.EW;
}

/**
 * Orientation for an arbitrary raid: threat axis snapped to the nearest cardinal of the
 * hostiles' mean heading. Lets other tools (BC3 Scope Trainer) reuse the picture engine.
 */
function orientationFromTracks(tracks) {
    let e = 0;
    let n = 0;
    tracks.forEach(t => {
        const h = (t.heading || 0) * Math.PI / 180;
        e += Math.sin(h);
        n += Math.cos(h);
    });
    const mean = ((Math.atan2(e, n) * 180 / Math.PI) + 360) % 360;
    const threatHeading = (Math.round(mean / 90) % 4) * 90;
    const sides = { 0: ['WEST', 'EAST'], 90: ['NORTH', 'SOUTH'], 180: ['EAST', 'WEST'], 270: ['SOUTH', 'NORTH'] }[threatHeading];
    return {
        id: `HDG${threatHeading}`,
        threatHeading,
        threatBearingCenter: (threatHeading + 180) % 360,
        crossNames: { neg: sides[0], pos: sides[1] }
    };
}

/** Rotate a bearing offset around threat axis shift. */
function rotateBearing(bearing, fromOrient, toOrient) {
    if (fromOrient === toOrient) return ((bearing % 360) + 360) % 360;
    const shift = getOrientation(toOrient).threatBearingCenter
        - getOrientation(fromOrient).threatBearingCenter;
    return ((bearing + shift) % 360 + 360) % 360;
}

const DEG = Math.PI / 180;
const CARDINALS_8 = ['NORTH', 'NORTHEAST', 'EAST', 'SOUTHEAST', 'SOUTH', 'SOUTHWEST', 'WEST', 'NORTHWEST'];

const Geo = {
    norm360(deg) {
        return ((deg % 360) + 360) % 360;
    },

    /** Smallest absolute difference between two bearings (0-180). */
    angleDiff(a, b) {
        const d = Math.abs(Geo.norm360(a) - Geo.norm360(b));
        return d > 180 ? 360 - d : d;
    },

    bullsToEN(p) {
        return {
            e: p.range * Math.sin(p.bearing * DEG),
            n: p.range * Math.cos(p.bearing * DEG)
        };
    },

    enToBulls(en) {
        return {
            bearing: Geo.norm360(Math.atan2(en.e, en.n) / DEG),
            range: Math.hypot(en.e, en.n)
        };
    },

    /** Unrounded bearing/range from one bulls position to another. */
    bearingRange(from, to) {
        const a = Geo.bullsToEN(from);
        const b = Geo.bullsToEN(to);
        return Geo.enToBulls({ e: b.e - a.e, n: b.n - a.n });
    },

    distance(a, b) {
        return Geo.bearingRange(a, b).range;
    },

    /** Bulls bearing rounded for voice: whole degrees, 360 reads as 000. */
    roundBearing(deg) {
        return Math.round(Geo.norm360(deg)) % 360;
    },

    toAxis(p, orient) {
        const en = Geo.bullsToEN(p);
        const h = orient.threatHeading * DEG;
        return {
            along: en.e * Math.sin(h) + en.n * Math.cos(h),
            cross: en.e * Math.cos(h) - en.n * Math.sin(h)
        };
    },

    fromAxis(ax, orient) {
        const h = orient.threatHeading * DEG;
        return Geo.enToBulls({
            e: ax.along * Math.sin(h) + ax.cross * Math.cos(h),
            n: ax.along * Math.cos(h) - ax.cross * Math.sin(h)
        });
    },

    /** Convert a threat-axis offset to east/north nm. */
    axisOffsetToEN(along, cross, orient) {
        const h = orient.threatHeading * DEG;
        return {
            e: along * Math.sin(h) + cross * Math.cos(h),
            n: along * Math.cos(h) - cross * Math.sin(h)
        };
    },

    cardinal8(heading) {
        return CARDINALS_8[Math.round(Geo.norm360(heading) / 45) % 8];
    }
};

if (typeof window !== 'undefined') {
    window.ORIENTATIONS = ORIENTATIONS;
    window.getOrientation = getOrientation;
    window.orientationFromTracks = orientationFromTracks;
    window.rotateBearing = rotateBearing;
    window.Geo = Geo;
}
