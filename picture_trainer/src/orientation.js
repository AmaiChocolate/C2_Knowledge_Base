/**
 * Threat-axis orientation — E/W (west ingress) vs N/S (north ingress).
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
        trackFillIn: 'TRACK EAST'
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
        trackFillIn: 'TRACK SOUTH'
    }
};

function getOrientation(id) {
    return ORIENTATIONS[id] || ORIENTATIONS.EW;
}

/** Rotate a bearing offset around threat axis shift. */
function rotateBearing(bearing, fromOrient, toOrient) {
    if (fromOrient === toOrient) return ((bearing % 360) + 360) % 360;
    const shift = getOrientation(toOrient).threatBearingCenter
        - getOrientation(fromOrient).threatBearingCenter;
    return ((bearing + shift) % 360 + 360) % 360;
}

if (typeof window !== 'undefined') {
    window.ORIENTATIONS = ORIENTATIONS;
    window.getOrientation = getOrientation;
    window.rotateBearing = rotateBearing;
}
