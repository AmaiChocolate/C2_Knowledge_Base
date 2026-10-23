/**
 * ALSSA picture call engine for the Picture Trainer.
 * Templates: kb/03_Notes_And_Insights/Picture_Call_Logic.md
 *
 * All geometry is measured in the threat-axis frame (see orientation.js):
 * WIDE is separation across the axis, DEEP is separation along it, and the
 * group "closest to the fighters" is the one furthest along the axis.
 */

/**
 * Thresholds the labels hang on. The first four come from the ALSSA comm standard;
 * wave / package bounding distances are set in mission planning in the real world,
 * so the values here are trainer assumptions — tune them in one place.
 */
const PICTURE_RULES = {
    groupNm: 3,
    depthRuleNm: 5,
    anchorAzimuthNm: 10,
    strobeCorrelationDeg: 30,
    waveGapNm: 25,
    packageGapNm: 40,
    aspectDeg: { hot: 30, flank: 60, beam: 110 },
    tolerances: { bearingDeg: 5, rangeNm: 3, capRangeNm: 5, dimensionNm: 3, altitudeK: 1, directionDeg: 30 }
};

const ORDINALS = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH'];

class PictureGenerator {
    constructor(opts = {}) {
        this.callsign = opts.callsign || 'TANGO';
        this.rules = Object.assign({}, PICTURE_RULES, opts.rules || {});
        this.formationTypes = {
            AZIMUTH: 'AZIMUTH',
            RANGE: 'RANGE',
            WALL: 'WALL',
            LADDER: 'LADDER',
            VIC: 'VIC',
            CHAMPAGNE: 'CHAMPAGNE',
            BOX: 'BOX',
            NONE: ''
        };
    }

    /**
     * @param groups  hostile groups from TrackClusterer
     * @param bullseye unused — positions are already bullseye-relative
     * @param meta    { orientation | orient, mode, blues, requesterId }
     */
    generatePicture(groups, bullseye, meta = {}) {
        const orient = meta.orient || getOrientation(meta.orientation);
        if (!groups.length) {
            return { text: `"${this.callsign}, PICTURE CLEAN"`, prompt: null, groups, formation: null, answerKey: null };
        }
        groups.forEach(g => this.annotate(g, orient));

        if (meta.mode === 'threat') return this.generateThreatCall(groups, meta, orient);
        if (meta.mode === 'bogey_dope') return this.generateBogeyDope(groups, meta, orient);
        if (meta.mode === 'ea_music') return this.generateMusicResponse(groups, meta, orient);
        if (meta.mode === 'ea_strobe') return this.generateStrobeResponse(groups, meta, orient);

        const packages = this.detectPackages(groups);
        if (packages) return this.generatePackagePicture(packages, groups, orient);

        const waves = this.detectWaves(groups);
        if (waves.length > 1) return this.generateWavePicture(waves, groups, orient);
        return this.generateSinglePicture(groups, orient);
    }

    annotate(group, orient) {
        group.axis = Geo.toAxis(group.centroid, orient);
        group.track = group.isCap ? 'CAP' : Geo.cardinal8(group.heading != null ? group.heading : orient.threatHeading);
        return group;
    }

    // ---------------------------------------------------------------- pictures

    generateSinglePicture(groups, orient) {
        const formation = this.analyzeFormation(groups, orient);
        return {
            text: `"${this.callsign}, ${this.describeFormation(formation)}"`,
            prompt: null,
            groups,
            formation,
            named: this.callNames(formation.named),
            answerKey: this.buildPictureKey(groups, formation, null)
        };
    }

    /** Leading edge + follow-on waves: total count, LEADING EDGE label, then each wave's separation and label. */
    generateWavePicture(waves, groups, orient) {
        const formations = waves.map(w => this.analyzeFormation(w, orient));
        const parts = [
            `${this.callsign}, ${alssaFormatGroupCount(groups.length)}, LEADING EDGE ${this.describeFormation(formations[0])}`
        ];
        for (let i = 1; i < waves.length; i++) {
            const gap = Math.round(this.waveSeparation(waves[i - 1], waves[i]));
            parts.push(`${alssaWaveLabel(i)} SEPARATION ${alssaNumberToWords(gap)}, ${this.formationHeader(formations[i], false)}.`);
        }
        return {
            text: `"${parts.join(' ')}"`,
            prompt: null,
            groups,
            waves,
            formation: formations[0],
            named: this.callNames(formations[0].named),
            answerKey: this.buildPictureKey(groups, formations[0], waves)
        };
    }

    generatePackagePicture(packages, groups, orient) {
        const names = [orient.crossNames.neg, orient.crossNames.pos];
        const formations = packages.map(p => this.analyzeFormation(this.detectWaves(p)[0], orient));
        const anchors = formations.map(f => f.named[0].group);
        const separation = Math.round(Math.abs(this.mean(packages[1], 'cross') - this.mean(packages[0], 'cross')));

        let call = `${this.callsign}, TWO PACKAGES AZIMUTH ${alssaNumberToWords(separation)}, `
            + `${names[0]} PACKAGE ${alssaBullseye(anchors[0].centroid)}, `
            + `${names[1]} PACKAGE ${alssaBullseye(anchors[1].centroid)}.`;
        formations.forEach((f, i) => {
            call += ` ${names[i]} PACKAGE, ${this.describeFormation(f)}`;
        });

        return {
            text: `"${call}"`,
            prompt: null,
            groups,
            packages,
            formation: null,
            named: formations.flatMap((f, i) => (f.named.length === 1
                ? [{ group: f.named[0].group, name: `${names[i]} PACKAGE` }]
                : f.named.map(n => ({ group: n.group, name: `${names[i]} PACKAGE ${n.name}` })))),
            answerKey: {
                family: 'packages',
                fields: { packageCount: packages.length, width: separation },
                anchors: anchors.map((g, i) => this.anchorOf(g, `${names[i]} PACKAGE`)),
                tolerances: this.rules.tolerances
            }
        };
    }

    /** The names groups go by once the picture is called; a lone group is just GROUP. */
    callNames(named) {
        return named.map(n => ({ group: n.group, name: n.name === 'SINGLE GROUP' ? 'GROUP' : n.name }));
    }

    /**
     * A named group has changed track after the picture: call it by the name it already
     * has with the new aspect — never re-label the picture.
     * @param fighterRef point the aspect is measured from (the friendly fighters)
     */
    generateManeuverCall(group, maneuver, name, fighterRef) {
        const word = this.aspectWord(group.centroid, maneuver.heading, fighterRef);
        const direction = word === 'HOT' ? null : Geo.cardinal8(maneuver.heading);
        return {
            text: `"${this.callsign}, ${name}, ${direction ? `${word} ${direction}` : word}"`,
            prompt: null,
            groups: [group],
            formation: null,
            answerKey: {
                family: 'maneuver',
                fields: { groupName: name, maneuver: word, direction },
                heading: Math.round(maneuver.heading),
                tolerances: this.rules.tolerances
            }
        };
    }

    buildPictureKey(groups, formation, waves) {
        const called = formation.named.map(n => n.group);
        const tracks = [...new Set(called.map(g => g.track))];
        return {
            family: 'picture',
            fields: {
                groupCount: groups.length,
                waveCount: waves ? waves.length : null,
                leadingEdgeCount: waves ? waves[0].length : null,
                label: formation.type,
                width: formation.width,
                depth: formation.depth,
                weight: formation.weight,
                track: tracks.length === 1 ? tracks[0] : formation.named[0].group.track
            },
            // First entry is the priority anchor; any group in the called picture is an acceptable anchor.
            anchors: formation.named.map(n => this.anchorOf(n.group, n.name)),
            tolerances: this.rules.tolerances
        };
    }

    anchorOf(group, name) {
        return {
            name,
            bearing: Geo.roundBearing(group.centroid.bearing),
            range: Math.round(group.centroid.range),
            altitudeK: alssaAltitudeK(group.centroid.altitude),
            isCap: !!group.isCap
        };
    }

    // ------------------------------------------------------------ BRAA / EA calls

    generateThreatCall(groups, meta, orient) {
        const threat = groups.find(g => g.isThreat) || this.closestToFighters(groups);
        const blue = this.nearestBlue(meta.blues, threat);
        if (!blue) return this.generateSinglePicture(groups, orient);
        const braa = Geo.bearingRange(blue, threat.centroid);
        const aspect = this.aspect(threat, blue);
        return {
            text: `"${blue.callsign}, THREAT GROUP ${alssaBraa(braa)}, ${alssaFormatAltitude(threat.centroid.altitude)}, ${aspect}, HOSTILE"`,
            prompt: `Pop-up group meets THREAT criteria — call it to the closest fighter.`,
            groups,
            formation: null,
            answerKey: this.buildBraaKey(braa, threat, aspect, blue)
        };
    }

    generateBogeyDope(groups, meta, orient) {
        const blue = this.requester(meta);
        if (!blue) return this.generateSinglePicture(groups, orient);
        const target = groups.reduce((a, b) => (
            Geo.distance(blue, b.centroid) < Geo.distance(blue, a.centroid) ? b : a
        ));
        const braa = Geo.bearingRange(blue, target.centroid);
        const aspect = this.aspect(target, blue);
        return {
            text: `"${blue.callsign}, GROUP ${alssaBraa(braa)}, ${alssaFormatAltitude(target.centroid.altitude)}, ${aspect}, HOSTILE"`,
            prompt: `"${this.callsign}, ${blue.callsign}, BOGEY DOPE"`,
            groups,
            formation: null,
            answerKey: this.buildBraaKey(braa, target, aspect, blue)
        };
    }

    buildBraaKey(braa, group, aspect, blue) {
        return {
            family: 'braa',
            fields: {
                braaBearing: Geo.roundBearing(braa.bearing),
                braaRange: Math.round(braa.range),
                altitude: alssaAltitudeK(group.centroid.altitude),
                aspect: aspect.split(' ')[0]
            },
            fighter: blue.callsign,
            tolerances: this.rules.tolerances
        };
    }

    /** MUSIC: anchor the jamming group off bullseye with altitude, track, declaration. */
    generateMusicResponse(groups, meta, orient) {
        const blue = this.requester(meta);
        const formation = this.analyzeFormation(this.detectWaves(groups)[0], orient);
        const named = formation.named.find(n => n.group.isJammer) || formation.named[0];
        const g = named.group;
        const track = g.track === 'CAP' ? 'CAP' : `TRACK ${g.track}`;
        const parts = [
            `${named.name} ${alssaBullseye(g.centroid)}`,
            alssaFormatAltitude(g.centroid.altitude), track, 'HOSTILE', alssaContacts(g.count)
        ].filter(Boolean);
        return {
            text: `"${this.callsign}, ${parts.join(', ')}"`,
            prompt: `"${blue ? blue.callsign : 'FIGHTER'}, MUSIC ${named.name}"`,
            groups,
            formation,
            answerKey: {
                family: 'music',
                fields: { track: g.track },
                anchors: [this.anchorOf(g, named.name)],
                tolerances: this.rules.tolerances
            }
        };
    }

    /** STROBE: range, altitude, declaration and name of the closest group along the strobe bearing. */
    generateStrobeResponse(groups, meta, orient) {
        const blue = this.requester(meta);
        if (!blue) return this.generateSinglePicture(groups, orient);
        const formation = this.analyzeFormation(this.detectWaves(groups)[0], orient);
        const jammer = groups.find(g => g.isJammer) || this.closestToFighters(groups);
        const strobe = Geo.roundBearing(Geo.bearingRange(blue, jammer.centroid).bearing);
        const target = groups
            .filter(g => Geo.angleDiff(Geo.bearingRange(blue, g.centroid).bearing, strobe) <= this.rules.strobeCorrelationDeg)
            .reduce((a, b) => (Geo.distance(blue, b.centroid) < Geo.distance(blue, a.centroid) ? b : a));
        const range = Math.round(Geo.distance(blue, target.centroid));
        const named = formation.named.find(n => n.group === target);
        const parts = [
            `STROBE RANGE ${alssaNumberToWords(range)}`,
            alssaFormatAltitude(target.centroid.altitude), 'HOSTILE', named ? named.name : ''
        ].filter(Boolean);
        return {
            text: `"${blue.callsign}, ${parts.join(', ')}"`,
            prompt: `"${blue.callsign}, STROBE ${String(strobe).padStart(3, '0')}"`,
            groups,
            formation,
            answerKey: {
                family: 'strobe',
                fields: { strobeRange: range, altitude: alssaAltitudeK(target.centroid.altitude) },
                fighter: blue.callsign,
                tolerances: this.rules.tolerances
            }
        };
    }

    requester(meta) {
        const blues = meta.blues || [];
        return blues.find(b => b.id === meta.requesterId) || blues[0] || null;
    }

    nearestBlue(blues, group) {
        if (!blues || !blues.length) return null;
        return blues.reduce((a, b) => (
            Geo.distance(b, group.centroid) < Geo.distance(a, group.centroid) ? b : a
        ));
    }

    /** HOT / FLANK / BEAM / DRAG from target aspect; all but HOT carry the track direction. */
    aspect(group, fighter) {
        if (group.isCap) return 'CAP';
        const word = this.aspectWord(group.centroid, group.heading, fighter);
        return word === 'HOT' ? word : `${word} ${Geo.cardinal8(group.heading)}`;
    }

    /** Aspect band of a heading flown from `from`, as seen from `fighter`. */
    aspectWord(from, heading, fighter) {
        const toFighter = Geo.bearingRange(from, fighter).bearing;
        const ta = Geo.angleDiff(heading, toFighter);
        const a = this.rules.aspectDeg;
        if (ta <= a.hot) return 'HOT';
        return ta <= a.flank ? 'FLANK' : (ta <= a.beam ? 'BEAM' : 'DRAG');
    }

    // ------------------------------------------------------------- formation text

    /** Full block: header sentence plus each named group. */
    describeFormation(formation) {
        const named = formation.named;
        const tracks = [...new Set(named.map(n => n.group.track))];
        const commonTrack = tracks.length === 1 && tracks[0] !== 'CAP';

        const groupText = (n, forceAnchor) => {
            const g = n.group;
            const parts = [
                (n.anchored || forceAnchor) ? `${n.name} ${alssaBullseye(g.centroid)}` : n.name,
                alssaFormatAltitude(g.centroid.altitude)
            ];
            if (!commonTrack || named.length === 1) parts.push(g.track === 'CAP' ? 'CAP' : `TRACK ${g.track}`);
            parts.push('HOSTILE');
            const contacts = alssaContacts(g.count);
            if (contacts) parts.push(contacts);
            return parts.join(', ');
        };

        if (named.length === 1 && formation.count === 1) return `${groupText(named[0], true)}.`;
        return `${this.formationHeader(formation, commonTrack)}. ${named.map(n => groupText(n)).join('. ')}.`;
    }

    /** "THREE GROUP WALL, THIRTY WIDE, WEIGHTED NORTH, TRACK EAST" */
    formationHeader(formation, withTrack) {
        const T = this.formationTypes;
        const n = formation.count;
        let head = alssaLabelPhrase(n, formation.type);
        const wide = formation.width != null ? `${alssaNumberToWords(formation.width)} WIDE` : null;
        const deep = formation.depth != null ? `${alssaNumberToWords(formation.depth)} DEEP` : null;

        if (formation.type === T.AZIMUTH) head += ` ${alssaNumberToWords(formation.width)}`;
        else if (formation.type === T.RANGE) head += ` ${alssaNumberToWords(formation.depth)}`;
        else if (formation.type === T.VIC) head += `, ${deep}, ${wide}`;
        else if (formation.type === T.CHAMPAGNE || formation.type === T.BOX) head += `, ${wide}, ${deep}`;
        else if (wide) head += `, ${wide}`;
        else if (deep) head += `, ${deep}`;

        if (formation.weight) head += `, WEIGHTED ${formation.weight}`;
        if (withTrack) head += `, TRACK ${formation.named[0].group.track}`;
        return head;
    }

    // ---------------------------------------------------------- formation analysis

    /**
     * Label a set of groups. Returns { type, count, width, depth, weight, named[] } where
     * `named` is the voice order and `named[i].anchored` marks groups given a BULLSEYE.
     */
    analyzeFormation(groups, orient) {
        const T = this.formationTypes;
        const R = this.rules;
        const n = groups.length;
        const byAlong = [...groups].sort((a, b) => b.axis.along - a.axis.along || a.axis.cross - b.axis.cross);
        const byCross = [...groups].sort((a, b) => a.axis.cross - b.axis.cross);
        const depthOf = set => Math.max(...set.map(g => g.axis.along)) - Math.min(...set.map(g => g.axis.along));
        const widthOf = set => Math.max(...set.map(g => g.axis.cross)) - Math.min(...set.map(g => g.axis.cross));
        const result = (type, extra) => Object.assign({ type, count: n, width: null, depth: null, weight: null }, extra);
        const name = (group, label, anchored = false) => ({ group, name: label, anchored });
        /** Two groups abreast: anchor both only when they are outside 10 nm in azimuth. */
        const pair = (set, suffix) => {
            const ordered = [...set].sort((a, b) => b.axis.along - a.axis.along || a.axis.cross - b.axis.cross);
            const sidesOf = set[0].axis.cross <= set[1].axis.cross
                ? new Map([[set[0], orient.crossNames.neg], [set[1], orient.crossNames.pos]])
                : new Map([[set[1], orient.crossNames.neg], [set[0], orient.crossNames.pos]]);
            const both = widthOf(set) > R.anchorAzimuthNm;
            return ordered.map((g, i) => name(g, `${sidesOf.get(g)} ${suffix}`, i === 0 || both));
        };

        if (n === 1) {
            return result(T.NONE, { named: [name(groups[0], 'SINGLE GROUP', true)] });
        }

        const width = widthOf(groups);
        const depth = depthOf(groups);

        if (n === 2) {
            if (width >= depth) {
                return result(T.AZIMUTH, { width: Math.round(width), named: pair(groups, 'GROUP') });
            }
            return result(T.RANGE, {
                depth: Math.round(depth),
                named: [name(byAlong[0], 'LEAD GROUP', true), name(byAlong[1], 'TRAIL GROUP')]
            });
        }

        // WALL: three or more groups abreast, total depth inside the 5 nm rule.
        if (depth <= R.depthRuleNm) {
            const names = this.wallNames(n, orient);
            let order = byCross.map((g, i) => name(g, names[i], i === 0 || i === n - 1));
            if (byCross[n - 1].axis.along > byCross[0].axis.along) {
                order = order.reverse();
            }
            return result(T.WALL, {
                width: Math.round(width),
                weight: n === 3 ? this.wallWeight(byCross, orient) : null,
                named: order
            });
        }

        // LADDER: every group is deeper than it is wide from the one ahead of it.
        const inTrail = byAlong.every((g, i) => i === 0 || (
            byAlong[i - 1].axis.along - g.axis.along > Math.abs(byAlong[i - 1].axis.cross - g.axis.cross)
        ));
        if (inTrail) {
            const names = this.ladderNames(n);
            return result(T.LADDER, {
                depth: Math.round(depth),
                named: byAlong.map((g, i) => name(g, names[i], i === 0))
            });
        }

        const gap = i => byAlong[i].axis.along - byAlong[i + 1].axis.along;

        if (n === 3 && gap(0) <= R.depthRuleNm && gap(1) > R.depthRuleNm) {
            const lead = byAlong.slice(0, 2);
            return result(T.CHAMPAGNE, {
                width: Math.round(widthOf(lead)),
                depth: Math.round(depth),
                named: [...pair(lead, 'LEAD GROUP'), name(byAlong[2], 'TRAIL GROUP')]
            });
        }

        if (n === 3 && gap(0) > R.depthRuleNm && gap(1) <= R.depthRuleNm) {
            const trail = byAlong.slice(1);
            return result(T.VIC, {
                width: Math.round(widthOf(trail)),
                depth: Math.round(depth),
                named: [name(byAlong[0], 'LEAD GROUP', true), ...pair(trail, 'TRAIL GROUP').map(p => name(p.group, p.name))]
            });
        }

        if (n === 4 && gap(0) <= R.depthRuleNm && gap(1) > R.depthRuleNm && gap(2) <= R.depthRuleNm) {
            const lead = byAlong.slice(0, 2);
            const trail = byAlong.slice(2);
            return result(T.BOX, {
                width: Math.round(Math.max(widthOf(lead), widthOf(trail))),
                depth: Math.round(depth),
                named: [...pair(lead, 'LEAD GROUP'), ...pair(trail, 'TRAIL GROUP').map(p => name(p.group, p.name))]
            });
        }

        // No traditional label: core information on the three highest-priority (closest) groups.
        return result(T.NONE, {
            named: byAlong.slice(0, 3).map(g => name(g, 'GROUP', true))
        });
    }

    wallNames(n, orient) {
        const a = orient.crossNames.neg;
        const b = orient.crossNames.pos;
        if (n === 3) return [`${a} GROUP`, 'MIDDLE GROUP', `${b} GROUP`];
        if (n === 4) return [`${a} GROUP`, `${a} MIDDLE GROUP`, `${b} MIDDLE GROUP`, `${b} GROUP`];
        if (n === 5) return [`${a} GROUP`, `${a} MIDDLE GROUP`, 'MIDDLE GROUP', `${b} MIDDLE GROUP`, `${b} GROUP`];
        const names = [`${a} GROUP`];
        for (let i = 1; i < n - 1; i++) names.push(`${ORDINALS[i] || i + 1} GROUP`);
        names.push(`${b} GROUP`);
        return names;
    }

    ladderNames(n) {
        if (n === 3) return ['LEAD GROUP', 'MIDDLE GROUP', 'TRAIL GROUP'];
        const names = ['LEAD GROUP'];
        for (let i = 1; i < n - 1; i++) names.push(`${ORDINALS[i] || i + 1} GROUP`);
        names.push('TRAIL GROUP');
        return names;
    }

    /** Three-group wall is WEIGHTED when the middle group sits outside the middle third. */
    wallWeight(byCross, orient) {
        const lo = byCross[0].axis.cross;
        const hi = byCross[2].axis.cross;
        const mid = byCross[1].axis.cross;
        const third = (hi - lo) / 3;
        if (mid < lo + third) return orient.crossNames.neg;
        if (mid > hi - third) return orient.crossNames.pos;
        return null;
    }

    /** Split into waves wherever consecutive groups are separated in depth by more than the wave gap. */
    detectWaves(groups, threshold = this.rules.waveGapNm) {
        const sorted = [...groups].sort((a, b) => b.axis.along - a.axis.along);
        const waves = [[sorted[0]]];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i - 1].axis.along - sorted[i].axis.along > threshold) waves.push([]);
            waves[waves.length - 1].push(sorted[i]);
        }
        return waves;
    }

    /** Shortest distance along the threat axis between two waves. */
    waveSeparation(front, back) {
        return Math.min(...front.map(g => g.axis.along)) - Math.max(...back.map(g => g.axis.along));
    }

    /** Exactly two bodies of groups separated across the axis by more than the package gap, else null. */
    detectPackages(groups, threshold = this.rules.packageGapNm) {
        const sorted = [...groups].sort((a, b) => a.axis.cross - b.axis.cross);
        const packages = [[sorted[0]]];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].axis.cross - sorted[i - 1].axis.cross > threshold) packages.push([]);
            packages[packages.length - 1].push(sorted[i]);
        }
        return packages.length === 2 ? packages : null;
    }

    closestToFighters(groups) {
        return groups.reduce((a, b) => (b.axis.along > a.axis.along ? b : a));
    }

    mean(groups, key) {
        return groups.reduce((s, g) => s + g.axis[key], 0) / groups.length;
    }
}

if (typeof window !== 'undefined') {
    window.PICTURE_RULES = PICTURE_RULES;
    window.PictureGenerator = PictureGenerator;
}
