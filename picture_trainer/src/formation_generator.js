/**
 * Seeded PRNG for reproducible scenario variations.
 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Formation layouts are built in the threat-axis frame, in nm:
 *   back  — distance behind the formation's front (0 = closest to the fighters)
 *   cross — offset across the threat axis
 * Group centres stay at least 7 nm apart so wingmen (slotted < 2 nm from lead)
 * can never bridge two groups under the 3 nm rule, and every dimension is chosen
 * to land clearly on one side of the PICTURE_RULES thresholds.
 */
const Layouts = {
    single() {
        return [{ back: 0, cross: 0 }];
    },

    azimuth(rng) {
        const w = randInt(rng, 8, 25);
        const stagger = randInt(rng, 0, 3);
        const lead = pick(rng, [-1, 1]);
        return [
            { back: 0, cross: lead * w / 2 },
            { back: stagger, cross: -lead * w / 2 }
        ];
    },

    range(rng) {
        return [
            { back: 0, cross: 0 },
            { back: randInt(rng, 8, 22), cross: randInt(rng, -3, 3) }
        ];
    },

    wall(rng, n = randInt(rng, 3, 5)) {
        const spacing = randInt(rng, 7, 12);
        const groups = [];
        for (let i = 0; i < n; i++) {
            groups.push({ back: randInt(rng, 0, 4), cross: (i - (n - 1) / 2) * spacing });
        }
        return groups;
    },

    /** Three-group wall with the middle group pushed into an outer third. */
    weightedWall(rng) {
        const span = randInt(rng, 24, 32);
        const offset = randInt(rng, 7, Math.floor(span / 3) - 1);
        const side = pick(rng, [-1, 1]);
        return [
            { back: randInt(rng, 0, 4), cross: -span / 2 },
            { back: randInt(rng, 0, 4), cross: side * (span / 2 - offset) },
            { back: randInt(rng, 0, 4), cross: span / 2 }
        ];
    },

    ladder(rng, n = randInt(rng, 3, 5)) {
        const groups = [{ back: 0, cross: 0 }];
        for (let i = 1; i < n; i++) {
            const prev = groups[i - 1];
            groups.push({ back: prev.back + randInt(rng, 7, 12), cross: prev.cross + randInt(rng, -2, 2) });
        }
        return groups;
    },

    champagne(rng) {
        const w = randInt(rng, 10, 24);
        const stagger = randInt(rng, 0, 3);
        return [
            { back: 0, cross: -w / 2 },
            { back: stagger, cross: w / 2 },
            { back: stagger + randInt(rng, 8, 20), cross: randInt(rng, -2, 2) }
        ];
    },

    vic(rng) {
        const w = randInt(rng, 10, 24);
        const d = randInt(rng, 8, 20);
        return [
            { back: 0, cross: randInt(rng, -2, 2) },
            { back: d, cross: -w / 2 },
            { back: d + randInt(rng, 0, 3), cross: w / 2 }
        ];
    },

    box(rng) {
        const w = randInt(rng, 10, 24);
        const stagger = randInt(rng, 0, 3);
        const d = stagger + randInt(rng, 8, 20);
        return [
            { back: 0, cross: -w / 2 },
            { back: stagger, cross: w / 2 },
            { back: d, cross: -w / 2 },
            { back: d + randInt(rng, 0, 3), cross: w / 2 }
        ];
    }
};

const TRADITIONAL = ['azimuth', 'range', 'wall', 'ladder', 'champagne', 'vic', 'box'];
const SHALLOW = ['single', 'azimuth', 'wall'];

function shift(layout, back, cross = 0, extra = {}) {
    return layout.map(g => Object.assign({}, g, extra, { back: g.back + back, cross: g.cross + cross }));
}

function depthOf(layout) {
    return Math.max(...layout.map(g => g.back));
}

/** Stack formations in depth, each one a wave gap (30-36 nm) behind the last. */
function stackWaves(rng, kinds) {
    let groups = [];
    let back = 0;
    kinds.forEach((kind, i) => {
        const layout = Layouts[kind](rng);
        if (i > 0) back += randInt(rng, 30, 36);
        groups = groups.concat(shift(layout, back, randInt(rng, -6, 6)));
        back += depthOf(layout);
    });
    return groups;
}

/**
 * Build hostile groups + tracks for a category.
 * Returns { tracks, meta } where tracks include blue + red.
 */
function generateScenario(params) {
    const { category, seed, orientation = 'EW' } = params;

    const rng = mulberry32(seed);
    const orient = getOrientation(orientation);
    const meta = {
        category,
        seed,
        orientation,
        // null = standard picture; otherwise threat | bogey_dope | ea_music | ea_strobe
        mode: null,
        requesterId: null
    };

    let layout;
    let frontRange = randInt(rng, 75, 110);

    switch (category) {
        case 'random':
            layout = Layouts[pick(rng, TRADITIONAL)](rng);
            break;
        case 'azimuth':
        case 'range':
        case 'wall':
        case 'ladder':
        case 'champagne':
        case 'vic':
        case 'box':
            layout = Layouts[category](rng);
            break;
        case 'cap':
            layout = shift(Layouts[pick(rng, ['single', 'single', 'azimuth', 'range'])](rng), 0, 0, { isCapOrbit: true });
            frontRange = randInt(rng, 60, 90);
            break;
        case 'leading_edge':
            layout = stackWaves(rng, [pick(rng, TRADITIONAL), 'wall', pick(rng, SHALLOW)]);
            frontRange = randInt(rng, 65, 75);
            break;
        case 'waves':
            layout = generateWaves(rng);
            frontRange = randInt(rng, 65, 80);
            break;
        case 'packages':
            layout = generatePackages(rng);
            break;
        case 'threat':
            meta.mode = 'threat';
            layout = Layouts[pick(rng, ['azimuth', 'range', 'wall'])](rng);
            frontRange = randInt(rng, 90, 115);
            break;
        case 'ea_bogey':
            meta.mode = pick(rng, ['ea_music', 'ea_strobe', 'bogey_dope']);
            meta.requesterId = pick(rng, ['B1L', 'B2L']);
            layout = Layouts[pick(rng, ['azimuth', 'range', 'wall', 'vic'])](rng);
            layout[randInt(rng, 0, layout.length - 1)].isJammer = meta.mode !== 'bogey_dope';
            break;
        case 'potd':
            layout = generatePotd(rng);
            frontRange = randInt(rng, 65, 80);
            break;
        default:
            layout = Layouts.wall(rng);
    }

    const hostileGroups = placeGroups(layout, orient, rng, frontRange);
    if (meta.mode === 'threat') hostileGroups.push(buildThreatGroup(orient, rng));

    const speed = randInt(rng, 450, 510);
    const hostileTracks = groupsToTracks(hostileGroups, orient, rng, speed);
    const blueTracks = buildBluePackage(orient, rng);

    return {
        tracks: [...blueTracks, ...hostileTracks],
        meta,
        motionScript: null,
        hostileGroupCount: hostileGroups.length
    };
}

function generateWaves(rng) {
    if (rng() < 0.4) {
        return stackWaves(rng, [pick(rng, TRADITIONAL), pick(rng, SHALLOW), pick(rng, SHALLOW)]);
    }
    return stackWaves(rng, [pick(rng, TRADITIONAL), pick(rng, ['single', ...TRADITIONAL])]);
}

/** Two bodies of groups split across the axis by more than the package gap. */
function generatePackages(rng) {
    const sep = randInt(rng, 60, 80);
    const small = () => {
        const kind = pick(rng, ['single', 'azimuth', 'range']);
        if (kind !== 'azimuth') return Layouts[kind](rng);
        const w = randInt(rng, 8, 12);
        return [{ back: 0, cross: -w / 2 }, { back: randInt(rng, 0, 3), cross: w / 2 }];
    };
    return [
        ...shift(small(), randInt(rng, 0, 10), -sep / 2),
        ...shift(small(), randInt(rng, 0, 10), sep / 2)
    ];
}

/** Picture of the Day — the harder presentations. */
function generatePotd(rng) {
    const kind = pick(rng, ['leading_edge', 'three_waves', 'packages', 'weighted', 'box', 'ladder5', 'wall5']);
    if (kind === 'leading_edge') return stackWaves(rng, [pick(rng, TRADITIONAL), 'wall', 'wall']);
    if (kind === 'three_waves') return stackWaves(rng, [pick(rng, ['vic', 'champagne', 'box']), 'azimuth', 'single']);
    if (kind === 'packages') return generatePackages(rng);
    if (kind === 'weighted') return Layouts.weightedWall(rng);
    if (kind === 'box') return Layouts.box(rng);
    if (kind === 'ladder5') return Layouts.ladder(rng, 5);
    return Layouts.wall(rng, 5);
}

/** Turn a threat-axis layout into bullseye-referenced groups with altitude and strength. */
function placeGroups(layout, orient, rng, frontRange) {
    const front = Geo.toAxis(
        { bearing: orient.threatBearingCenter + randInt(rng, -10, 10), range: frontRange },
        orient
    );
    const baseAlt = pick(rng, [18, 22, 25, 28, 30, 32, 35, 38]);
    return layout.map(g => {
        const pos = Geo.fromAxis({ along: front.along - g.back, cross: front.cross + g.cross }, orient);
        const altK = Math.max(5, baseAlt + pick(rng, [-6, -3, 0, 0, 0, 0, 3]));
        return {
            centroid: { bearing: pos.bearing, range: pos.range, altitude: altK * 1000 },
            tracksPerGroup: pick(rng, [1, 1, 1, 1, 2, 2, 2, 2, 2, 3]),
            isCapOrbit: !!g.isCapOrbit,
            isJammer: !!g.isJammer
        };
    });
}

/** Low pop-up group 18-28 nm from a blue CAP station, pointed at the nearest one. */
function buildThreatGroup(orient, rng) {
    const stations = [
        { bearing: orient.friendlyCapBearing, range: orient.friendlyCapRange },
        { bearing: orient.friendlyCapBearing2, range: orient.friendlyCapRange2 }
    ];
    const station = Geo.bullsToEN(pick(rng, stations));
    const from = (orient.threatBearingCenter + randInt(rng, -40, 40)) * Math.PI / 180;
    const dist = randInt(rng, 18, 28);
    const pos = Geo.enToBulls({
        e: station.e + dist * Math.sin(from),
        n: station.n + dist * Math.cos(from)
    });
    const nearest = stations.reduce((a, b) => (Geo.distance(pos, b) < Geo.distance(pos, a) ? b : a));
    return {
        centroid: { bearing: pos.bearing, range: pos.range, altitude: randInt(rng, 1, 9) * 1000 },
        tracksPerGroup: randInt(rng, 1, 2),
        heading: Geo.bearingRange(pos, nearest).bearing,
        isThreat: true
    };
}

function groupsToTracks(groups, orient, rng, speed) {
    const tracks = [];
    // Wing slots behind and either side of lead, in the threat-axis frame.
    const slots = [{ along: -1.0, cross: 1.3 }, { along: -1.0, cross: -1.3 }];
    groups.forEach((grp, i) => {
        const gIdx = i + 1;
        const n = grp.tracksPerGroup || 1;
        const leadId = `H${gIdx}L`;
        const leadEN = Geo.bullsToEN(grp.centroid);
        for (let t = 0; t < n; t++) {
            const isLead = t === 0;
            const slot = isLead ? { e: 0, n: 0 } : Geo.axisOffsetToEN(slots[t - 1].along, slots[t - 1].cross, orient);
            const pos = Geo.enToBulls({ e: leadEN.e + slot.e, n: leadEN.n + slot.n });
            const track = {
                id: isLead ? leadId : `H${gIdx}W${t}`,
                callsign: isLead ? `BANDIT${gIdx}` : `BANDIT${gIdx}-${t}`,
                hostile: true,
                affiliation: 'hostile',
                type: 'fighter',
                bearing: pos.bearing,
                range: pos.range,
                altitude: grp.centroid.altitude,
                heading: grp.heading != null ? grp.heading : orient.threatHeading,
                ingressHeading: orient.threatHeading,
                // One speed for the whole raid keeps the formation rigid while it ingresses.
                speed,
                cruiseSpeed: speed,
                groupId: gIdx,
                waveId: null,
                isDormant: false,
                isCapOrbit: !!grp.isCapOrbit,
                isThreat: !!grp.isThreat,
                isJammer: !!grp.isJammer,
                formationAnchor: isLead ? null : leadId,
                offsetNmEast: slot.e,
                offsetNmNorth: slot.n,
                ingress: !grp.isCapOrbit,
                ingressStopNm: 55,
                holdOrbitLeg: rng() > 0.5 ? 'EAST' : 'WEST',
                holdLegLength: randInt(rng, 10, 14)
            };

            if (grp.isCapOrbit && isLead) {
                track.orbitAnchor = {
                    bearing: grp.centroid.bearing,
                    range: grp.centroid.range,
                    legLength: randInt(rng, 10, 14),
                    legHeading: orient.threatHeading,
                    laneCross: 3
                };
                track.orbitLeg = rng() > 0.5 ? 'EAST' : 'WEST';
            }

            if (grp.isThreat) {
                track.speed = speed + 40;
                track.cruiseSpeed = track.speed;
            }

            tracks.push(track);
        }
    });
    return tracks;
}

function buildBluePackage(orient, rng) {
    const caps = [
        { cs: 'RAPTOR11', csW: 'RAPTOR12', b: orient.friendlyCapBearing, r: orient.friendlyCapRange },
        { cs: 'VIPER21', csW: 'VIPER22', b: orient.friendlyCapBearing2, r: orient.friendlyCapRange2 }
    ];
    const tracks = [];
    caps.forEach((cap, fi) => {
        const leadId = `B${fi + 1}L`;
        tracks.push({
            id: leadId,
            callsign: cap.cs,
            hostile: false,
            affiliation: 'friendly',
            type: 'fighter',
            bearing: cap.b,
            range: cap.r,
            altitude: 28000,
            heading: orient.threatHeading + 180,
            targetHeading: orient.threatHeading + 180,
            speed: 420,
            cruiseSpeed: 420,
            capStation: { bearing: cap.b, range: cap.r, name: cap.cs },
            capOrbitLeg: 'EAST',
            capLegHalfNm: 10
        });
        tracks.push({
            id: `B${fi + 1}W`,
            callsign: cap.csW,
            hostile: false,
            affiliation: 'friendly',
            type: 'fighter',
            bearing: cap.b + 2,
            range: cap.r - 2,
            altitude: 28000,
            heading: orient.threatHeading + 180,
            targetHeading: orient.threatHeading + 180,
            speed: 420,
            cruiseSpeed: 420,
            formationAnchor: leadId,
            offsetNmEast: 2,
            offsetNmNorth: -2,
            capStation: { bearing: cap.b, range: cap.r, name: cap.cs },
            capLegHalfNm: 10
        });
    });
    return tracks;
}

if (typeof window !== 'undefined') {
    window.mulberry32 = mulberry32;
    window.generateScenario = generateScenario;
    window.Layouts = Layouts;
}
