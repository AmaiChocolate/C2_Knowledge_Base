/**
 * DBSCAN: 3 NM group rule (ALSSA).
 */
class TrackClusterer {
    constructor(epsilon = 3, minPoints = 1) {
        this.epsilon = epsilon;
        this.minPoints = minPoints;
    }

    cluster(tracks) {
        if (tracks.length === 0) return [];
        const visited = new Set();
        const clusters = [];
        tracks.forEach((track, idx) => {
            if (visited.has(idx)) return;
            visited.add(idx);
            const neighbors = this.getNeighbors(track, tracks, idx);
            if (neighbors.length >= this.minPoints) {
                clusters.push(this.createGroup(
                    this.expandCluster(track, neighbors, tracks, visited)
                ));
            } else {
                clusters.push(this.createGroup([track]));
            }
        });
        return clusters;
    }

    /** Group by generator truth (`groupId`) instead of proximity. */
    groupByTruth(tracks) {
        const byId = new Map();
        tracks.forEach(t => {
            if (!byId.has(t.groupId)) byId.set(t.groupId, []);
            byId.get(t.groupId).push(t);
        });
        return [...byId.values()].map(g => this.createGroup(g));
    }

    getNeighbors(track, tracks, excludeIdx) {
        const neighbors = [];
        tracks.forEach((other, idx) => {
            if (idx === excludeIdx) return;
            if (this.calculateDistance(track, other) <= this.epsilon) {
                neighbors.push({ track: other, index: idx });
            }
        });
        return neighbors;
    }

    expandCluster(seedTrack, neighbors, allTracks, visited) {
        const cluster = [seedTrack];
        const queue = [...neighbors];
        while (queue.length) {
            const { track: currentTrack, index: currentIdx } = queue.shift();
            if (visited.has(currentIdx)) continue;
            visited.add(currentIdx);
            cluster.push(currentTrack);
            const n = this.getNeighbors(currentTrack, allTracks, currentIdx);
            if (n.length >= this.minPoints) queue.push(...n);
        }
        return cluster;
    }

    calculateDistance(t1, t2) {
        return Geo.distance(t1, t2);
    }

    createGroup(tracks) {
        // Average in east/north space: averaging raw bearings breaks across 360/000.
        let e = 0;
        let n = 0;
        let alt = 0;
        tracks.forEach(t => {
            const en = Geo.bullsToEN(t);
            e += en.e;
            n += en.n;
            alt += t.altitude || 28000;
        });
        const count = tracks.length;
        const lead = tracks.find(t => !t.formationAnchor) || tracks[0];
        const orbiting = !!(lead.orbitAnchor || tracks.some(t => t.isCapOrbit));
        // A CAP is reported where it is anchored, not where the jet is on the racetrack.
        const position = orbiting && lead.orbitAnchor
            ? { bearing: lead.orbitAnchor.bearing, range: lead.orbitAnchor.range }
            : Geo.enToBulls({ e: e / count, n: n / count });
        return {
            tracks,
            count,
            centroid: {
                bearing: Geo.norm360(position.bearing),
                range: position.range,
                altitude: Math.round(alt / count)
            },
            lead,
            heading: lead.heading,
            hostile: tracks[0].hostile,
            isCap: orbiting,
            isThreat: tracks.some(t => t.isThreat),
            isJammer: tracks.some(t => t.isJammer),
            packageId: tracks[0].packageId || null
        };
    }
}

if (typeof window !== 'undefined') window.TrackClusterer = TrackClusterer;
