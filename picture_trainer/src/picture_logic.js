/**
 * ALSSA picture call engine — extended for Picture Trainer.
 * Templates: kb/03_Notes_And_Insights/Picture_Call_Logic.md
 */
class PictureGenerator {
    constructor(opts = {}) {
        this.callsign = opts.callsign || 'TANGO';
        this.formationTypes = {
            WALL: 'WALL',
            LADDER: 'LADDER',
            VIC: 'VIC',
            CHAMPAGNE: 'CHAMPAGNE',
            BOX: 'BOX',
            AZIMUTH: 'AZIMUTH',
            CAP: 'CAP',
            PACKAGE: 'PACKAGE',
            UNKNOWN: 'UNKNOWN'
        };
    }

    generatePicture(groups, bullseye, meta = {}) {
        if (meta.mode === 'packages') return this.generatePackagePicture(groups, meta);
        if (meta.mode === 'threat') return this.generateThreatPicture(groups, meta);
        if (meta.mode === 'leading_edge') return this.generateLeadingEdgePicture(groups, bullseye, meta);
        if (meta.mode === 'bogey_dope') return this.generateBogeyDopeAnswer(groups, meta);
        if (meta.mode === 'ea') return this.generateEaPicture(groups, meta);

        if (groups.length === 0) {
            return { text: '"PICTURE CLEAN"', groups: [], answerKey: {} };
        }

        const capGroups = groups.filter(g => g.isCap || (g.tracks && g.tracks.some(t => t.isCapOrbit)));
        if (capGroups.length === groups.length && groups.length >= 1) {
            return this.generateCapPicture(groups, bullseye, meta);
        }

        const waves = this.detectWaves(groups);
        if (waves && waves.length > 1) {
            return this.generateWavePicture(waves, bullseye, meta);
        }
        return this.generateSinglePicture(groups, bullseye, meta);
    }

    trackFillIn(meta) {
        return meta.trackFillIn
            || (meta.orientation && getOrientation(meta.orientation).trackFillIn)
            || 'TRACK EAST';
    }

    fillIns(meta, declaration) {
        return alssaFormatFillIns(this.trackFillIn(meta), declaration || 'HOSTILE');
    }

    generateSinglePicture(groups, bullseye, meta = {}) {
        const leadingEdge = this.findLeadingEdge(groups);
        const formation = this.analyzeFormation(groups);
        const alt = alssaFormatAltitude(leadingEdge.centroid.altitude, false);
        const fillIns = this.fillIns(meta);

        const parts = [this.callsign, alssaFormatGroupCount(groups.length, formation.type)];

        if (groups.length >= 3 && formation.type !== this.formationTypes.UNKNOWN) {
            parts.push(formation.type);
            if (formation.dimension) parts.push(alssaFormatDimension(formation.dimension));
            if (formation.weight) parts.push(formation.weight);
        } else if (groups.length === 2 && formation.type === this.formationTypes.UNKNOWN && formation.dimension) {
            parts.push(alssaFormatDimension(formation.dimension));
        } else if (groups.length === 2 && formation.dimension) {
            parts.push(alssaFormatDimension(formation.dimension));
        }

        parts.push(alssaFormatLocation(formation.type, leadingEdge.centroid));
        parts.push(alt, fillIns);

        const pictureCall = `"${parts.join(', ')}"`;

        return {
            text: pictureCall,
            groups,
            formation,
            answerKey: this.buildAnswerKey(groups, formation, leadingEdge, alt, null, null, meta)
        };
    }

    generateWavePicture(waves, bullseye, meta = {}) {
        const totalGroups = waves.flat().length;
        const waveCountPhrase = `${alssaNumberToWords(waves.length)} WAVES`;
        let pictureCall = `"${this.callsign}, ${alssaFormatGroupCount(totalGroups)}, ${waveCountPhrase}. `;

        waves.forEach((wave, idx) => {
            const formation = this.analyzeFormation(wave);
            const leadingEdge = this.findLeadingEdge(wave);
            const alt = alssaFormatAltitude(leadingEdge.centroid.altitude, true);
            const fillIns = this.fillIns(meta);
            const useLE = alssaUsesLeadingEdgeLocation(formation.type);

            let clause = alssaWaveLabel(idx);
            clause += `, ${alssaFormatGroupCount(wave.length, formation.type)}`;

            if (wave.length >= 3 && formation.type !== this.formationTypes.UNKNOWN) {
                clause += `, ${formation.type}`;
                if (formation.dimension) clause += `, ${alssaFormatDimension(formation.dimension)}`;
            } else if (wave.length === 2 && formation.dimension) {
                clause += `, ${alssaFormatDimension(formation.dimension)}`;
            }

            clause += `, ${alssaFormatLocation(formation.type, leadingEdge.centroid, { useLeadingEdge: useLE })}`;
            clause += `, ${alt}, ${fillIns}`;
            pictureCall += clause;
            if (idx < waves.length - 1) pictureCall += '. ';
        });
        pictureCall += '"';

        const leadingEdge = this.findLeadingEdge(waves.flat());
        const formation = this.analyzeFormation(waves[0]);
        const alt = alssaFormatAltitude(leadingEdge.centroid.altitude, true);
        return {
            text: pictureCall,
            groups: waves.flat(),
            waves,
            formation: null,
            answerKey: this.buildAnswerKey(waves.flat(), formation, leadingEdge, alt, waves.length, null, meta)
        };
    }

    generateCapPicture(groups, bullseye, meta = {}) {
        const g = groups[0];
        const alt = alssaFormatAltitude(g.centroid.altitude, true);
        const fillIns = this.fillIns(meta);
        const text = `"${this.callsign}, ${alssaFormatGroupCount(groups.length)}, CAP BULLSEYE ${g.centroid.bearing}/${g.centroid.range}, ${alt}, ${fillIns}"`;
        return {
            text,
            groups,
            formation: { type: this.formationTypes.CAP },
            answerKey: this.buildAnswerKey(groups, { type: 'CAP' }, g, alt, null, null, meta)
        };
    }

    generateLeadingEdgePicture(groups, bullseye, meta) {
        const leCount = meta.leadingEdgeCount || 3;
        const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);
        const leGroups = sorted.slice(0, leCount);
        const formation = this.analyzeFormation(leGroups);
        const leadingEdge = this.findLeadingEdge(leGroups);
        const alt = alssaFormatAltitude(leadingEdge.centroid.altitude, true);
        const fillIns = this.fillIns(meta);

        const parts = [
            this.callsign,
            alssaFormatGroupCount(groups.length),
            `LEADING EDGE ${alssaFormatGroupCount(leGroups.length)}`
        ];
        if (formation.type !== this.formationTypes.UNKNOWN) {
            parts.push(formation.type);
            if (formation.dimension) parts.push(alssaFormatDimension(formation.dimension));
        }
        parts.push(alssaFormatLocation(formation.type, leadingEdge.centroid, { useLeadingEdge: true }));
        parts.push(alt, fillIns);

        return {
            text: `"${parts.join(', ')}"`,
            groups,
            formation,
            answerKey: this.buildAnswerKey(groups, formation, leadingEdge, alt, null, leGroups.length, meta)
        };
    }

    generatePackagePicture(groups, meta) {
        const north = groups.filter(g => g.packageId === 'NORTH' || g.centroid.bearing < 180);
        const south = groups.filter(g => g.packageId === 'SOUTH' || g.centroid.bearing >= 180);
        const nLe = north.length ? this.findLeadingEdge(north) : null;
        const sLe = south.length ? this.findLeadingEdge(south) : null;
        const width = meta.packageWidth || 60;
        let call = `"${this.callsign}, TWO PACKAGES AZIMUTH ${alssaNumberToWords(width)}, `;
        if (nLe) {
            call += `NORTH PACKAGE BULLSEYE ${nLe.centroid.bearing}/${nLe.centroid.range}, ${alssaFormatAltitude(nLe.centroid.altitude, true)}, ${this.fillIns(meta)}. `;
        }
        if (sLe) {
            call += `SOUTH PACKAGE BULLSEYE ${sLe.centroid.bearing}/${sLe.centroid.range}, ${alssaFormatAltitude(sLe.centroid.altitude, true)}, ${this.fillIns(meta)}"`;
        } else {
            call = call.trim() + '"';
        }
        return {
            text: call,
            groups,
            formation: { type: this.formationTypes.PACKAGE },
            answerKey: {
                groupCount: groups.length,
                waveCount: null,
                label: 'PACKAGE',
                dimensions: `${width} WIDE`,
                dimensionNm: width,
                bullsBearing: nLe ? nLe.centroid.bearing : null,
                bullsRange: nLe ? nLe.centroid.range : null,
                altitudeBlock: nLe ? alssaFormatAltitude(nLe.centroid.altitude, true) : 'HIGH',
                fillIns: this.fillIns(meta),
                mode: 'packages'
            }
        };
    }

    generateThreatPicture(groups, meta) {
        const threatGroup = groups.find(g => g.isThreat) || this.findLeadingEdge(groups);
        const blue = meta.nearestBlue;
        const braa = meta.braa || (blue ? this.calcBraa(blue, threatGroup.centroid) : null);
        const alt = alssaFormatAltitude(threatGroup.centroid.altitude, true);
        let call;
        if (blue && braa) {
            call = `"THREAT, ${blue.callsign}, BULLS ${braa.bearing}/${braa.range}, ${alt}, HOT"`;
        } else {
            call = `"THREAT, ${this.callsign}, BULLSEYE ${threatGroup.centroid.bearing}/${threatGroup.centroid.range}, ${alt}, HOT"`;
        }
        return {
            text: call,
            groups,
            formation: { type: 'THREAT' },
            answerKey: {
                groupCount: groups.length,
                label: 'THREAT',
                mode: 'threat',
                braaBearing: braa ? braa.bearing : threatGroup.centroid.bearing,
                braaRange: braa ? braa.range : threatGroup.centroid.range,
                altitudeBlock: alt,
                altitudeFt: threatGroup.centroid.altitude,
                fillIns: 'HOT'
            }
        };
    }

    generateBogeyDopeAnswer(groups, meta) {
        const target = meta.targetGroup || this.findLeadingEdge(groups);
        const blue = meta.nearestBlue;
        const braa = meta.braa || (blue ? this.calcBraa(blue, target.centroid) : null);
        const alt = alssaFormatAltitude(target.centroid.altitude, true);
        const cs = blue ? blue.callsign : this.callsign;
        let call;
        if (braa) {
            call = `"${cs}, BULLS ${braa.bearing}/${braa.range}, ${alt}, HOT"`;
        } else {
            call = `"${cs}, BULLSEYE ${target.centroid.bearing}/${target.centroid.range}, ${alt}, HOT"`;
        }
        return {
            text: call,
            groups,
            formation: null,
            answerKey: {
                mode: 'bogey_dope',
                braaBearing: braa ? braa.bearing : target.centroid.bearing,
                braaRange: braa ? braa.range : target.centroid.range,
                altitudeBlock: alt,
                altitudeFt: target.centroid.altitude,
                fillIns: 'HOT'
            }
        };
    }

    generateEaPicture(groups, meta) {
        const eaType = meta.eaType || 'MUSIC';
        const g = this.findLeadingEdge(groups);
        const alt = alssaFormatAltitude(g.centroid.altitude, true);
        const call = `"${this.callsign}, ${eaType} FROM GROUP BULLSEYE ${g.centroid.bearing}/${g.centroid.range}, ${alt}, ${this.fillIns(meta)}"`;
        return {
            text: call,
            groups,
            formation: { type: 'EA' },
            answerKey: {
                mode: 'ea',
                label: eaType,
                bullsBearing: g.centroid.bearing,
                bullsRange: g.centroid.range,
                altitudeBlock: alt,
                fillIns: this.fillIns(meta)
            }
        };
    }

    buildAnswerKey(groups, formation, leadingEdge, altBlock, waveCount = null, leCount = null, meta = {}) {
        const dimMatch = formation && formation.dimension
            ? formation.dimension.match(/(\d+)/) : null;
        return {
            groupCount: groups.length,
            waveCount: waveCount,
            leadingEdgeCount: leCount,
            label: formation ? formation.type : 'UNKNOWN',
            dimensions: formation && formation.dimension ? alssaFormatDimension(formation.dimension) : '',
            dimensionNm: dimMatch ? parseInt(dimMatch[1], 10) : null,
            bullsBearing: leadingEdge.centroid.bearing,
            bullsRange: leadingEdge.centroid.range,
            altitudeBlock: altBlock,
            altitudeFt: leadingEdge.centroid.altitude,
            fillIns: this.fillIns(meta),
            trackFillIn: this.trackFillIn(meta),
            weight: formation ? formation.weight : null
        };
    }

    analyzeFormation(groups) {
        if (groups.length < 2) return { type: this.formationTypes.UNKNOWN };

        if (groups.length === 4) {
            const box = this.detectBox(groups);
            if (box) return box;
        }

        const bearings = groups.map(g => g.centroid.bearing);
        const ranges = groups.map(g => g.centroid.range);
        const bearingSpread = Math.max(...bearings) - Math.min(...bearings);
        const rangeSpread = Math.max(...ranges) - Math.min(...ranges);

        if (groups.length === 3) {
            const vc = this.detectVicOrChampagne(groups);
            if (vc.type !== this.formationTypes.UNKNOWN) return vc;
        }

        if (groups.length >= 3 && bearingSpread > rangeSpread && bearingSpread > 20) {
            return {
                type: this.formationTypes.WALL,
                dimension: `${this.calculateWidth(groups)} WIDE`,
                weight: this.calculateWeight(groups)
            };
        }

        if (groups.length >= 3 && rangeSpread > bearingSpread && rangeSpread > 15) {
            return {
                type: this.formationTypes.LADDER,
                dimension: `${Math.round(rangeSpread)} DEEP`
            };
        }

        if (groups.length === 2 && bearingSpread > rangeSpread) {
            return {
                type: this.formationTypes.AZIMUTH,
                dimension: `${this.calculateWidth(groups)} WIDE`
            };
        }

        if (groups.length === 2 && rangeSpread > bearingSpread) {
            return {
                type: this.formationTypes.UNKNOWN,
                dimension: `${Math.round(rangeSpread)} DEEP`
            };
        }

        return { type: this.formationTypes.UNKNOWN };
    }

    detectBox(groups) {
        if (groups.length !== 4) return null;
        const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);
        const front = sorted.slice(0, 2);
        const back = sorted.slice(2);
        const frontSpread = Math.max(...front.map(g => g.centroid.bearing))
            - Math.min(...front.map(g => g.centroid.bearing));
        const backSpread = Math.max(...back.map(g => g.centroid.bearing))
            - Math.min(...back.map(g => g.centroid.bearing));
        const depthGap = back[0].centroid.range - front[1].centroid.range;
        if (depthGap >= 10 && frontSpread >= 8 && backSpread >= 8) {
            return {
                type: this.formationTypes.BOX,
                dimension: `${Math.round(Math.max(frontSpread, backSpread) * front[0].centroid.range * Math.PI / 180)} WIDE`
            };
        }
        return null;
    }

    detectVicOrChampagne(groups) {
        if (groups.length !== 3) return { type: this.formationTypes.UNKNOWN };
        const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);
        const leadToMid = sorted[1].centroid.range - sorted[0].centroid.range;
        const midToTrail = sorted[2].centroid.range - sorted[1].centroid.range;
        if (leadToMid > 15 && midToTrail < 10) return { type: this.formationTypes.VIC };
        if (leadToMid < 10 && midToTrail > 15) return { type: this.formationTypes.CHAMPAGNE };
        return { type: this.formationTypes.UNKNOWN };
    }

    calculateWidth(groups) {
        const bearings = groups.map(g => g.centroid.bearing);
        const ranges = groups.map(g => g.centroid.range);
        const spread = Math.max(...bearings) - Math.min(...bearings);
        const avgR = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        return Math.round((spread * Math.PI / 180) * avgR);
    }

    calculateWeight(groups) {
        if (groups.length < 3) return null;
        const bearings = groups.map(g => g.centroid.bearing);
        const minB = Math.min(...bearings);
        const maxB = Math.max(...bearings);
        const third = (maxB - minB) / 3;
        const mStart = minB + third;
        const mEnd = maxB - third;
        let n = 0;
        let s = 0;
        groups.forEach(g => {
            if (g.centroid.bearing < mStart) n++;
            else if (g.centroid.bearing > mEnd) s++;
        });
        if (n > s) return 'HEAVY NORTH';
        if (s > n) return 'HEAVY SOUTH';
        return null;
    }

    detectWaves(groups, threshold = 20) {
        if (groups.length < 2) return null;
        const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);
        const waves = [];
        let current = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].centroid.range - sorted[i - 1].centroid.range > threshold) {
                waves.push(current);
                current = [sorted[i]];
            } else {
                current.push(sorted[i]);
            }
        }
        waves.push(current);
        return waves.length > 1 ? waves : null;
    }

    findLeadingEdge(groups) {
        return groups.reduce((a, b) => (b.centroid.range < a.centroid.range ? b : a));
    }

    getAltitudeBlock(altitude) {
        return alssaFormatAltitude(altitude, true);
    }

    calcBraa(fromTrack, toCentroid) {
        const dx = toCentroid.range * Math.cos(toCentroid.bearing * Math.PI / 180)
            - fromTrack.range * Math.cos(fromTrack.bearing * Math.PI / 180);
        const dy = toCentroid.range * Math.sin(toCentroid.bearing * Math.PI / 180)
            - fromTrack.range * Math.sin(fromTrack.bearing * Math.PI / 180);
        const range = Math.round(Math.sqrt(dx * dx + dy * dy));
        let bearing = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        if (bearing < 0) bearing += 360;
        return { bearing: Math.round(bearing), range };
    }
}

if (typeof window !== 'undefined') window.PictureGenerator = PictureGenerator;
