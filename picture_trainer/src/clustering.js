/**
 * DBSCAN — 3 NM group rule (ALSSA).
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
        const dx = t2.range * Math.cos(t2.bearing * Math.PI / 180)
            - t1.range * Math.cos(t1.bearing * Math.PI / 180);
        const dy = t2.range * Math.sin(t2.bearing * Math.PI / 180)
            - t1.range * Math.sin(t1.bearing * Math.PI / 180);
        return Math.sqrt(dx * dx + dy * dy);
    }

    createGroup(tracks) {
        let tb = 0;
        let tr = 0;
        let ta = 0;
        tracks.forEach(t => {
            tb += t.bearing;
            tr += t.range;
            ta += t.altitude || 28000;
        });
        const n = tracks.length;
        const lead = tracks.reduce((a, b) => (b.range < a.range ? b : a), tracks[0]);
        return {
            tracks,
            count: n,
            centroid: {
                bearing: Math.round(tb / n),
                range: Math.round(tr / n),
                altitude: Math.round(ta / n)
            },
            lead,
            hostile: tracks[0].hostile,
            isCap: tracks.some(t => t.isCapOrbit),
            isThreat: tracks.some(t => t.isThreat),
            packageId: tracks[0].packageId || null
        };
    }
}

if (typeof window !== 'undefined') window.TrackClusterer = TrackClusterer;
