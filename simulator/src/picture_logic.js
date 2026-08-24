/**
 * Picture Call Logic Engine
 * Analyzes groups to generate tactical picture calls
 */

class PictureGenerator {
    constructor() {
        this.formationTypes = {
            WALL: 'WALL',
            LADDER: 'LADDER',
            VIC: 'VIC',
            CHAMPAGNE: 'CHAMPAGNE',
            BOX: 'BOX',
            AZIMUTH: 'AZIMUTH',
            UNKNOWN: 'UNKNOWN'
        };
    }

    /**
     * Generate complete picture call from groups
     */
    generatePicture(groups, bullseye) {
        if (groups.length === 0) {
            return { text: '"PICTURE CLEAN"', groups: [] };
        }

        // Separate waves if applicable
        const waves = this.detectWaves(groups);

        if (waves && waves.length > 1) {
            return this.generateWavePicture(waves, bullseye);
        }

        return this.generateSinglePicture(groups, bullseye);
    }

    generateSinglePicture(groups, bullseye) {
        const leadingEdge = this.findLeadingEdge(groups);
        const altitudeBlock = this.getAltitudeBlock(leadingEdge.centroid.altitude);

        let pictureCall = `"TANGO, ${groups.length === 1 ? 'SINGLE GROUP' : groups.length + ' GROUPS'}`;

        // Detect formation
        if (groups.length >= 3) {
            const formation = this.analyzeFormation(groups);
            if (formation.type !== this.formationTypes.UNKNOWN) {
                pictureCall += `, ${formation.type}`;

                if (formation.dimension) {
                    pictureCall += `, ${formation.dimension}`;
                }

                if (formation.weight) {
                    pictureCall += `, ${formation.weight}`;
                }
            }
        }

        pictureCall += `, LEADING EDGE BULLSEYE ${leadingEdge.centroid.bearing}/${leadingEdge.centroid.range}`;
        pictureCall += `, ${altitudeBlock}, HOSTILE"`;

        return { text: pictureCall, groups, formation: this.analyzeFormation(groups) };
    }

    generateWavePicture(waves, bullseye) {
        const totalGroups = waves.flat().length;
        let pictureCall = `"TANGO, ${totalGroups} GROUPS, ${waves.length} WAVES. `;

        waves.forEach((wave, idx) => {
            const waveNum = idx + 1;
            const waveLabel = waveNum === 1 ? 'FIRST WAVE' : `WAVE ${waveNum}`;

            const formation = this.analyzeFormation(wave);
            const leadingEdge = this.findLeadingEdge(wave);

            pictureCall += `${waveLabel}, ${wave.length} ${wave.length === 1 ? 'GROUP' : 'GROUPS'}`;

            if (formation.type !== this.formationTypes.UNKNOWN) {
                pictureCall += `, ${formation.type}`;
                if (formation.dimension) {
                    pictureCall += `, ${formation.dimension}`;
                }
            }

            pictureCall += `, LEADING EDGE BULLSEYE ${leadingEdge.centroid.bearing}/${leadingEdge.centroid.range}`;
            pictureCall += `, ${this.getAltitudeBlock(leadingEdge.centroid.altitude)}, HOSTILE`;

            if (idx < waves.length - 1) pictureCall += '. ';
        });

        pictureCall += '"';

        return { text: pictureCall, groups: waves.flat(), waves, formation: null };
    }

    /**
     * Analyze formation of groups
     */
    analyzeFormation(groups) {
        if (groups.length < 2) return { type: this.formationTypes.UNKNOWN };

        // Get bearing and range spreads
        const bearings = groups.map(g => g.centroid.bearing);
        const ranges = groups.map(g => g.centroid.range);

        const bearingSpread = Math.max(...bearings) - Math.min(...bearings);
        const rangeSpread = Math.max(...ranges) - Math.min(...ranges);

        // Check for specific formations
        if (groups.length === 3) {
            const vicOrChamp = this.detectVicOrChampagne(groups);
            if (vicOrChamp.type !== this.formationTypes.UNKNOWN) {
                return vicOrChamp;
            }
        }

        // Check for Wall
        if (groups.length >= 3 && bearingSpread > rangeSpread && bearingSpread > 20) {
            const width = this.calculateWidth(groups);
            const weight = this.calculateWeight(groups);

            return {
                type: this.formationTypes.WALL,
                dimension: `${width} WIDE`,
                weight
            };
        }

        // Check for Ladder
        if (groups.length >= 3 && rangeSpread > bearingSpread && rangeSpread > 15) {
            return {
                type: this.formationTypes.LADDER,
                dimension: `${Math.round(rangeSpread)} DEEP`
            };
        }

        // Check for Azimuth (2 groups lateral)
        if (groups.length === 2 && bearingSpread > rangeSpread) {
            const width = this.calculateWidth(groups);
            return {
                type: this.formationTypes.AZIMUTH,
                dimension: `${width} WIDE`
            };
        }

        return { type: this.formationTypes.UNKNOWN };
    }

    detectVicOrChampagne(groups) {
        if (groups.length !== 3) return { type: this.formationTypes.UNKNOWN };

        // Sort by range
        const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);

        const leadRange = sorted[0].centroid.range;
        const midRange = sorted[1].centroid.range;
        const trailRange = sorted[2].centroid.range;

        const leadToMidGap = midRange - leadRange;
        const midToTrailGap = trailRange - midRange;

        // VIC: 1 lead, 2 trail (big gap then small gap)
        if (leadToMidGap > 15 && midToTrailGap < 10) {
            return { type: this.formationTypes.VIC };
        }

        // CHAMPAGNE: 2 lead, 1 trail (small gap then big gap)
        if (leadToMidGap < 10 && midToTrailGap > 15) {
            return { type: this.formationTypes.CHAMPAGNE };
        }

        return { type: this.formationTypes.UNKNOWN };
    }

    calculateWidth(groups) {
        const bearings = groups.map(g => g.centroid.bearing);
        const ranges = groups.map(g => g.centroid.range);

        const bearingSpread = Math.max(...bearings) - Math.min(...bearings);
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;

        // Convert angular separation to linear distance
        const width = Math.round((bearingSpread * Math.PI / 180) * avgRange);
        return width;
    }

    calculateWeight(groups) {
        if (groups.length < 3) return null;

        const bearings = groups.map(g => g.centroid.bearing);
        const minBearing = Math.min(...bearings);
        const maxBearing = Math.max(...bearings);
        const totalWidth = maxBearing - minBearing;

        const thirdWidth = totalWidth / 3;
        const middleStart = minBearing + thirdWidth;
        const middleEnd = maxBearing - thirdWidth;

        let northCount = 0, centerCount = 0, southCount = 0;

        groups.forEach(group => {
            if (group.centroid.bearing < middleStart) northCount++;
            else if (group.centroid.bearing > middleEnd) southCount++;
            else centerCount++;
        });

        if (northCount > southCount && northCount > centerCount) return 'HEAVY NORTH';
        if (southCount > northCount && southCount > centerCount) return 'HEAVY SOUTH';

        return null;
    }

    detectWaves(groups, threshold = 20) {
        if (groups.length < 2) return null;

        const sorted = [...groups].sort((a, b) => a.centroid.range - b.centroid.range);
        const waves = [];
        let currentWave = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const rangeGap = sorted[i].centroid.range - sorted[i - 1].centroid.range;

            if (rangeGap > threshold) {
                waves.push(currentWave);
                currentWave = [sorted[i]];
            } else {
                currentWave.push(sorted[i]);
            }
        }

        waves.push(currentWave);

        return waves.length > 1 ? waves : null;
    }

    findLeadingEdge(groups) {
        return groups.reduce((closest, group) => {
            return group.centroid.range < closest.centroid.range ? group : closest;
        });
    }

    getAltitudeBlock(altitude) {
        if (altitude >= 30000) return 'HIGH';
        if (altitude >= 15000) return 'MEDIUM';
        return 'LOW';
    }
}

window.PictureGenerator = PictureGenerator;
