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

function randFloat(rng, min, max) {
    return min + rng() * (max - min);
}

/** Group centroid in bulls BR. */
function groupCentroid(bearing, range, alt = 32000) {
    return { bearing: Math.round(bearing), range: Math.round(range), altitude: alt };
}

/**
 * Build hostile group centroids + tracks for a category.
 * Returns { tracks, meta } where tracks include blue + red.
 */
function generateScenario(params) {
    const {
        category,
        seed,
        orientation = 'EW',
        bullsBearing = 0,
        bullsRange = 0
    } = params;

    const rng = mulberry32(seed);
    const orient = getOrientation(orientation);
    const meta = {
        category,
        seed,
        orientation,
        mode: null,
        leadingEdgeCount: null,
        packageWidth: null,
        eaType: null,
        isCapOrbit: false
    };

    let hostileGroups = [];

    switch (category) {
        case 'random':
            hostileGroups = generateRandom(rng, orient);
            break;
        case 'azimuth':
            hostileGroups = generateAzimuth(rng, orient);
            break;
        case 'range':
            hostileGroups = generateRange(rng, orient);
            break;
        case 'wall':
            hostileGroups = generateWall(rng, orient);
            break;
        case 'ladder':
            hostileGroups = generateLadder(rng, orient);
            break;
        case 'champagne':
            hostileGroups = generateChampagne(rng, orient);
            break;
        case 'vic':
            hostileGroups = generateVic(rng, orient);
            break;
        case 'cap':
            meta.mode = 'cap';
            meta.isCapOrbit = true;
            hostileGroups = generateCap(rng, orient);
            break;
        case 'leading_edge':
            meta.mode = 'leading_edge';
            hostileGroups = generateLeadingEdge(rng, orient, meta);
            break;
        case 'waves':
            hostileGroups = generateWaves(rng, orient);
            break;
        case 'packages':
            meta.mode = 'packages';
            meta.packageWidth = randInt(rng, 50, 70);
            hostileGroups = generatePackages(rng, orient, meta);
            break;
        case 'threat':
            meta.mode = 'threat';
            hostileGroups = generateThreat(rng, orient, meta);
            break;
        case 'ea_bogey':
            meta.mode = rng() > 0.5 ? 'ea' : 'bogey_dope';
            meta.eaType = pick(rng, ['MUSIC', 'STROBE', 'METALLICA']);
            hostileGroups = generateEaBogey(rng, orient);
            break;
        case 'potd':
            hostileGroups = generatePotd(seed, orient, meta);
            break;
        default:
            hostileGroups = generateWall(rng, orient);
    }

    const hostileTracks = groupsToTracks(hostileGroups, orient, rng, true);
    const blueTracks = buildBluePackage(orient, rng);
    const tracks = [...blueTracks, ...hostileTracks];
    const motionScript = buildMotionScript(hostileGroups, rng);

    return {
        tracks,
        meta,
        motionScript,
        bulls: { bearing: bullsBearing, range: bullsRange },
        hostileGroupCount: hostileGroups.length
    };
}

/** Seeded wave release schedule — same seed always yields same timing. */
function buildMotionScript(groups, rng) {
    const waveIds = [...new Set(groups.map(g => g.waveId).filter(Boolean))].sort((a, b) => a - b);
    if (!waveIds.length) return { waves: [] };

    const waves = waveIds.map((id, idx) => {
        if (idx === 0) return { id, releaseAtSec: 0 };
        const base = 75 * idx;
        return { id, releaseAtSec: base + randInt(rng, 0, 30) };
    });
    return { waves };
}

function generateRandom(rng, orient) {
    const type = pick(rng, ['wall', 'ladder', 'azimuth', 'vic', 'champagne']);
    if (type === 'wall') return generateWall(rng, orient);
    if (type === 'ladder') return generateLadder(rng, orient);
    if (type === 'azimuth') return generateAzimuth(rng, orient);
    if (type === 'vic') return generateVic(rng, orient);
    return generateChampagne(rng, orient);
}

function generateAzimuth(rng, orient) {
    const baseR = randInt(rng, 80, 120);
    const baseB = orient.threatBearingCenter + randInt(rng, -15, 15);
    const width = randInt(rng, 10, 25);
    return [
        { centroid: groupCentroid(baseB - width / 2, baseR), tracksPerGroup: randInt(rng, 1, 2) },
        { centroid: groupCentroid(baseB + width / 2, baseR + randInt(rng, -3, 3)), tracksPerGroup: randInt(rng, 1, 2) }
    ];
}

function generateRange(rng, orient) {
    const baseB = orient.threatBearingCenter + randInt(rng, -8, 8);
    const leadR = randInt(rng, 70, 90);
    const depth = randInt(rng, 15, 30);
    return [
        { centroid: groupCentroid(baseB, leadR), tracksPerGroup: randInt(rng, 1, 2) },
        { centroid: groupCentroid(baseB + randInt(rng, -5, 5), leadR + depth), tracksPerGroup: randInt(rng, 1, 2) }
    ];
}

function generateWall(rng, orient) {
    const n = randInt(rng, 3, 5);
    const baseR = randInt(rng, 85, 115);
    const baseB = orient.threatBearingCenter;
    const spacing = randInt(rng, 8, 14);
    const groups = [];
    for (let i = 0; i < n; i++) {
        const offset = (i - (n - 1) / 2) * spacing;
        groups.push({
            centroid: groupCentroid(baseB + offset, baseR + randInt(rng, -4, 4)),
            tracksPerGroup: randInt(rng, 1, 2)
        });
    }
    return groups;
}

function generateLadder(rng, orient) {
    const n = randInt(rng, 3, 5);
    const baseB = orient.threatBearingCenter + randInt(rng, -10, 10);
    const startR = randInt(rng, 75, 95);
    const step = randInt(rng, 12, 18);
    const groups = [];
    for (let i = 0; i < n; i++) {
        groups.push({
            centroid: groupCentroid(baseB + randInt(rng, -3, 3), startR + i * step),
            tracksPerGroup: randInt(rng, 1, 2)
        });
    }
    return groups;
}

function generateChampagne(rng, orient) {
    const baseB = orient.threatBearingCenter;
    const leadR = randInt(rng, 80, 100);
    const trailR = leadR + randInt(rng, 18, 28);
    const lat = randInt(rng, 8, 14);
    return [
        { centroid: groupCentroid(baseB - lat, leadR), tracksPerGroup: 2 },
        { centroid: groupCentroid(baseB + lat, leadR), tracksPerGroup: 2 },
        { centroid: groupCentroid(baseB, trailR), tracksPerGroup: 2 }
    ];
}

function generateVic(rng, orient) {
    const baseB = orient.threatBearingCenter;
    const leadR = randInt(rng, 75, 90);
    const trailR = leadR + randInt(rng, 20, 30);
    const lat = randInt(rng, 10, 16);
    return [
        { centroid: groupCentroid(baseB, leadR), tracksPerGroup: 2 },
        { centroid: groupCentroid(baseB - lat, trailR), tracksPerGroup: 2 },
        { centroid: groupCentroid(baseB + lat, trailR), tracksPerGroup: 2 }
    ];
}

function generateCap(rng, orient) {
    const n = randInt(rng, 1, 2);
    const groups = [];
    for (let i = 0; i < n; i++) {
        groups.push({
            centroid: groupCentroid(
                orient.threatBearingCenter + randInt(rng, -20, 20),
                randInt(rng, 60, 90)
            ),
            tracksPerGroup: 2,
            isCapOrbit: true
        });
    }
    return groups;
}

function generateLeadingEdge(rng, orient, meta) {
    const total = randInt(rng, 6, 10);
    meta.leadingEdgeCount = randInt(rng, 3, 4);
    const baseB = orient.threatBearingCenter;
    const groups = [];
    for (let i = 0; i < total; i++) {
        const isLe = i < meta.leadingEdgeCount;
        groups.push({
            centroid: groupCentroid(
                baseB + randInt(rng, -25, 25),
                isLe ? randInt(rng, 70, 95) : randInt(rng, 110, 140)
            ),
            tracksPerGroup: 1
        });
    }
    return groups;
}

function generateWaves(rng, orient) {
    const waveCount = randInt(rng, 2, 3);
    const groups = [];
    let r = randInt(rng, 70, 85);
    for (let w = 0; w < waveCount; w++) {
        const perWave = randInt(rng, 2, 3);
        for (let g = 0; g < perWave; g++) {
            groups.push({
                centroid: groupCentroid(
                    orient.threatBearingCenter + randInt(rng, -15, 15) + g * randInt(rng, 6, 10),
                    r + g * randInt(rng, 3, 8)
                ),
                tracksPerGroup: randInt(rng, 1, 2),
                waveId: w + 1
            });
        }
        r += randInt(rng, 22, 30);
    }
    return groups;
}

function generatePackages(rng, orient, meta) {
    const groups = [];
    const northB = orient.threatBearingCenter - 30 + randInt(rng, -10, 10);
    const southB = orient.threatBearingCenter + 30 + randInt(rng, -10, 10);
    const r1 = randInt(rng, 80, 100);
    const r2 = randInt(rng, 85, 105);
    groups.push(
        { centroid: groupCentroid(northB, r1), tracksPerGroup: 2, packageId: 'NORTH' },
        { centroid: groupCentroid(northB + 12, r1 + 5), tracksPerGroup: 1, packageId: 'NORTH' },
        { centroid: groupCentroid(southB, r2), tracksPerGroup: 2, packageId: 'SOUTH' },
        { centroid: groupCentroid(southB - 10, r2 + 8), tracksPerGroup: 1, packageId: 'SOUTH' }
    );
    return groups;
}

function generateThreat(rng, orient, meta) {
    const groups = generateWall(rng, orient).slice(0, 3);
    groups.push({
        centroid: groupCentroid(
            orient.friendlyCapBearing + randInt(rng, -15, 15),
            randInt(rng, 25, 34)
        ),
        tracksPerGroup: 2,
        isThreat: true
    });
    meta.threatGroupIndex = groups.length - 1;
    return groups;
}

function generateEaBogey(rng, orient) {
    return generateAzimuth(rng, orient);
}

/** 15 curated hard seeds — multi-wave / weighted layouts. */
function generatePotd(seed, orient, meta) {
    const idx = seed % 15;
    meta.mode = idx % 3 === 0 ? 'leading_edge' : null;
    if (meta.mode === 'leading_edge') meta.leadingEdgeCount = 4;
    if (idx % 5 === 0) {
        meta.mode = 'waves';
        return generateWaves(mulberry32(seed + 1000), orient);
    }
    if (idx % 7 === 0) {
        meta.mode = 'packages';
        meta.packageWidth = 60;
        return generatePackages(mulberry32(seed + 2000), orient, meta);
    }
    const layouts = [
        () => generateWall(mulberry32(seed), orient),
        () => generateLadder(mulberry32(seed + 1), orient),
        () => generateChampagne(mulberry32(seed + 2), orient),
        () => generateVic(mulberry32(seed + 3), orient),
        () => generateWaves(mulberry32(seed + 4), orient)
    ];
    return layouts[idx % layouts.length]();
}

function groupsToTracks(groups, orient, rng, hostile) {
    const tracks = [];
    let gIdx = 0;
    groups.forEach((grp) => {
        gIdx += 1;
        const n = grp.tracksPerGroup || 1;
        const leadId = `H${gIdx}L`;
        for (let t = 0; t < n; t++) {
            const isLead = t === 0;
            const offsetB = isLead ? 0 : randFloat(rng, -1.5, 1.5);
            const offsetR = isLead ? 0 : randFloat(rng, -1.5, 1.5);
            const id = isLead ? leadId : `H${gIdx}W${t}`;
            const speed = 480 + randInt(rng, -15, 15);
            const track = {
                id,
                callsign: isLead ? `BANDIT${gIdx}` : `BANDIT${gIdx}-${t}`,
                hostile: true,
                affiliation: 'hostile',
                type: 'fighter',
                bearing: grp.centroid.bearing + offsetB,
                range: grp.centroid.range + offsetR,
                altitude: grp.centroid.altitude || 32000,
                heading: orient.threatHeading,
                ingressHeading: orient.threatHeading,
                speed,
                cruiseSpeed: speed,
                groupId: gIdx,
                packageId: grp.packageId || null,
                waveId: grp.waveId || null,
                isDormant: !!(grp.waveId && grp.waveId > 1),
                isCapOrbit: !!grp.isCapOrbit,
                isThreat: !!grp.isThreat,
                formationAnchor: isLead ? null : leadId,
                offsetNmEast: isLead ? 0 : randFloat(rng, -1, 1),
                offsetNmNorth: isLead ? 0 : randFloat(rng, 1.5, 2.5),
                ingress: !grp.isCapOrbit && !(grp.waveId && grp.waveId > 1),
                ingressStopNm: 55,
                holdOrbitLeg: rng() > 0.5 ? 'EAST' : 'WEST',
                holdLegLength: randInt(rng, 14, 20)
            };

            if (grp.isCapOrbit && isLead) {
                track.orbitAnchor = {
                    bearing: grp.centroid.bearing,
                    range: grp.centroid.range,
                    legLength: randInt(rng, 16, 22),
                    legHeading: orient.threatHeading,
                    laneCross: 4
                };
                track.orbitLeg = rng() > 0.5 ? 'EAST' : 'WEST';
                track.ingress = false;
            }

            if (grp.isThreat && isLead) {
                track.speed = 520 + randInt(rng, 0, 20);
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
}
