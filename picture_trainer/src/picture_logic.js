/**
 * ALSSA picture call engine — extended for Picture Trainer.
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
            RANGE: 'RANGE',
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
            return this.generateCapPicture(groups, bullseye);
        }

        const waves = this.detectWaves(groups);
        if (waves && waves.length > 1) {
            return this.generateWavePicture(waves, bullseye);
        }
        return this.generateSinglePicture(groups, bullseye);
    }

    generateSinglePicture(groups, bullseye) {
        const leadingEdge = this.findLeadingEdge(groups);
        const altitudeBlock = this.getAltitudeBlock(leadingEdge.centroid.altitude);
        const formation = this.analyzeFormation(groups);

        let pictureCall = `"${this.callsign}, ${groups.length === 1 ? 'SINGLE GROUP' : groups.length + ' GROUPS'}`;

        if (groups.length === 2) {
            if (formation.type !== this.formationTypes.UNKNOWN) {
                pictureCall += ` ${formation.type}`;
                if (formation.dimension) pictureCall += `, ${formation.dimension}`;
            }
        } else if (groups.length >= 3 && formation.type !== this.formationTypes.UNKNOWN) {
            pictureCall += `, ${formation.type}`;
            if (formation.dimension) pictureCall += `, ${formation.dimension}`;
            if (formation.weight) pictureCall += `, ${formation.weight}`;
        }

        pictureCall += `, LEADING EDGE BULLSEYE ${leadingEdge.centroid.bearing}/${leadingEdge.centroid.range}`;
        pictureCall += `, ${altitudeBlock}, HOSTILE"`;

        return {
            text: pictureCall,
            groups,
            formation,
            answerKey: this.buildAnswerKey(groups, formation, leadingEdge, altitudeBlock)
        };
    }

    generateWavePicture(waves, bullseye) {
        const totalGroups = waves.flat().length;
        let pictureCall = `"${this.callsign}, ${totalGroups} GROUPS, ${waves.length} WAVES. `;

        waves.forEach((wave, idx) => {
            const waveNum = idx + 1;
            const waveLabel = waveNum === 1 ? 'FIRST WAVE' : `WAVE ${waveNum}`;
            const formation = this.analyzeFormation(wave);
            const leadingEdge = this.findLeadingEdge(wave);
            pictureCall += `${waveLabel}, ${wave.length} ${wave.length === 1 ? 'GROUP' : 'GROUPS'}`;
            if (formation.type !== this.formationTypes.UNKNOWN) {
                pictureCall += `, ${formation.type}`;
                if (formation.dimension) pictureCall += `, ${formation.dimension}`;
            }
            pictureCall += `, LEADING EDGE BULLSEYE ${leadingEdge.centroid.bearing}/${leadingEdge.centroid.range}`;
            pictureCall += `, ${this.getAltitudeBlock(leadingEdge.centroid.altitude)}, HOSTILE`;
            if (idx < waves.length - 1) pictureCall += '. ';
        });
        pictureCall += '"';

        const leadingEdge = this.findLeadingEdge(waves.flat());
        const formation = this.analyzeFormation(waves[0]);
        return {
            text: pictureCall,
            groups: waves.flat(),
            waves,
            formation: null,
            answerKey: this.buildAnswerKey(waves.flat(), formation, leadingEdge,
                this.getAltitudeBlock(leadingEdge.centroid.altitude), waves.length)
        };
    }

    generateCapPicture(groups, bullseye) {
        const g = groups[0];
        const alt = this.getAltitudeBlock(g.centroid.altitude);
        const text = `"${this.callsign}, ${groups.length === 1 ? 'SINGLE GROUP' : groups.length + ' GROUPS'}, CAP BULLSEYE ${g.centroid.bearing}/${g.centroid.range}, ${alt}, HOSTILE"`;
        return {
            text,
            groups,
            formation: { type: this.formationTypes.CAP },
            answerKey: this.buildAnswerKey(groups, { type: 'CAP' }, g, alt)
        };
    }

    generateLeadingEdgePicture(groups, bullseye, meta) {
        const leCount = meta.leadingEdgeCount || 3;
        const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);
        const leGroups = sorted.slice(0, leCount);
        const formation = this.analyzeFormation(leGroups);
        const leadingEdge = this.findLeadingEdge(leGroups);
        const alt = this.getAltitudeBlock(leadingEdge.centroid.altitude);

        let call = `"${this.callsign}, ${groups.length} GROUPS, LEADING EDGE ${leGroups.length} GROUP`;
        if (formation.type !== this.formationTypes.UNKNOWN) {
            call += ` ${formation.type}`;
            if (formation.dimension) call += `, ${formation.dimension}`;
        }
        call += `, BULLSEYE ${leadingEdge.centroid.bearing}/${leadingEdge.centroid.range}, ${alt}, HOSTILE"`;
        return {
            text: call,
            groups,
            formation,
            answerKey: this.buildAnswerKey(groups, formation, leadingEdge, alt, null, leGroups.length)
        };
    }

    generatePackagePicture(groups, meta) {
        const north = groups.filter(g => g.packageId === 'NORTH' || g.centroid.bearing < 180);
        const south = groups.filter(g => g.packageId === 'SOUTH' || g.centroid.bearing >= 180);
        const nLe = north.length ? this.findLeadingEdge(north) : null;
        const sLe = south.length ? this.findLeadingEdge(south) : null;
        let call = `"${this.callsign}, TWO PACKAGES AZIMUTH ${meta.packageWidth || 60}, `;
        if (nLe) {
            call += `NORTH PACKAGE BULLSEYE ${nLe.centroid.bearing}/${nLe.centroid.range}, ${this.getAltitudeBlock(nLe.centroid.altitude)}, HOSTILE. `;
        }
        if (sLe) {
            call += `SOUTH PACKAGE BULLSEYE ${sLe.centroid.bearing}/${sLe.centroid.range}, ${this.getAltitudeBlock(sLe.centroid.altitude)}, HOSTILE"`;
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
                dimensions: `${meta.packageWidth || 60} WIDE`,
                bullsBearing: nLe ? nLe.centroid.bearing : null,
                bullsRange: nLe ? nLe.centroid.range : null,
                altitudeBlock: nLe ? this.getAltitudeBlock(nLe.centroid.altitude) : 'HIGH',
                fillIns: 'HOSTILE',
                mode: 'packages'
            }
        };
    }

    generateThreatPicture(groups, meta) {
        const threatGroup = groups.find(g => g.isThreat) || this.findLeadingEdge(groups);
        const blue = meta.nearestBlue;
        let call;
        if (blue && threatGroup) {
            const braa = meta.braa || this.calcBraa(blue, threatGroup.centroid);
            call = `"${blue.callsign}, ${threatGroup.tracks[0].callsign || 'LEAD GROUP'}, THREAT BRAA ${braa.bearing}/${braa.range}, ${this.getAltitudeBlock(threatGroup.centroid.altitude)}, HOT, HOSTILE"`;
        } else {
            call = `"${this.callsign}, THREAT GROUP BULLSEYE ${threatGroup.centroid.bearing}/${threatGroup.centroid.range}, HOSTILE"`;
        }
        return {
            text: call,
            groups,
            formation: { type: 'THREAT' },
            answerKey: {
                groupCount: groups.length,
                label: 'THREAT',
                mode: 'threat',
                braaBearing: meta.braa ? meta.braa.bearing : null,
                braaRange: meta.braa ? meta.braa.range : null,
                altitudeBlock: this.getAltitudeBlock(threatGroup.centroid.altitude),
                fillIns: 'HOT, HOSTILE'
            }
        };
    }

    generateBogeyDopeAnswer(groups, meta) {
        const target = meta.targetGroup || this.findLeadingEdge(groups);
        const blue = meta.nearestBlue;
        const braa = meta.braa || (blue ? this.calcBraa(blue, target.centroid) : null);
        const orient = meta.trackFillIn || 'TRACK EAST';
        let call = `"${blue ? blue.callsign : this.callsign}, BOGEY DOPE `;
        if (braa) {
            call += `BRAA ${braa.bearing}/${braa.range}, ${this.getAltitudeBlock(target.centroid.altitude)}, ${orient}, HOSTILE"`;
        } else {
            call += `BULLSEYE ${target.centroid.bearing}/${target.centroid.range}, ${this.getAltitudeBlock(target.centroid.altitude)}, ${orient}, BOGEY"`;
        }
        return {
            text: call,
            groups,
            formation: null,
            answerKey: {
                mode: 'bogey_dope',
                braaBearing: braa ? braa.bearing : target.centroid.bearing,
                braaRange: braa ? braa.range : target.centroid.range,
                altitudeBlock: this.getAltitudeBlock(target.centroid.altitude),
                fillIns: `${orient}, HOSTILE`
            }
        };
    }

    generateEaPicture(groups, meta) {
        const eaType = meta.eaType || 'MUSIC';
        const g = this.findLeadingEdge(groups);
        const call = `"${this.callsign}, ${eaType} FROM GROUP BULLSEYE ${g.centroid.bearing}/${g.centroid.range}, ${this.getAltitudeBlock(g.centroid.altitude)}, HOSTILE"`;
        return {
            text: call,
            groups,
            formation: { type: 'EA' },
            answerKey: {
                mode: 'ea',
                label: eaType,
                bullsBearing: g.centroid.bearing,
                bullsRange: g.centroid.range,
                altitudeBlock: this.getAltitudeBlock(g.centroid.altitude),
                fillIns: 'HOSTILE'
            }
        };
    }

    buildAnswerKey(groups, formation, leadingEdge, altBlock, waveCount = null, leCount = null) {
        const dimMatch = formation && formation.dimension
            ? formation.dimension.match(/(\d+)/) : null;
        return {
            groupCount: groups.length,
            waveCount: waveCount,
            leadingEdgeCount: leCount,
            label: formation ? formation.type : 'UNKNOWN',
            dimensions: formation ? formation.dimension : '',
            dimensionNm: dimMatch ? parseInt(dimMatch[1], 10) : null,
            bullsBearing: leadingEdge.centroid.bearing,
            bullsRange: leadingEdge.centroid.range,
            altitudeBlock: altBlock,
            fillIns: 'HOSTILE',
            weight: formation ? formation.weight : null
        };
    }

    analyzeFormation(groups) {
        if (groups.length < 2) return { type: this.formationTypes.UNKNOWN };
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
                type: this.formationTypes.RANGE,
                dimension: `${Math.round(rangeSpread)} DEEP`
            };
        }

        return { type: this.formationTypes.UNKNOWN };
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
        if (altitude >= 30000) return 'HIGH';
        if (altitude >= 15000) return 'MEDIUM';
        return 'LOW';
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
