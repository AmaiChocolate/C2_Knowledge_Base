/**
 * DBSCAN Clustering Algorithm
 * Groups tracks within 3 NM of each other into tactical groups
 */

class TrackClusterer {
    constructor(epsilon = 3, minPoints = 1) {
        this.epsilon = epsilon; // 3 NM grouping distance
        this.minPoints = minPoints;
    }

    /**
     * Cluster tracks using DBSCAN
     * Returns array of groups, each containing tracks and centroid
     */
    cluster(tracks) {
        if (tracks.length === 0) return [];

        const visited = new Set();
        const clusters = [];

        tracks.forEach((track, idx) => {
            if (visited.has(idx)) return;

            visited.add(idx);
            const neighbors = this.getNeighbors(track, tracks, idx);

            if (neighbors.length >= this.minPoints) {
                const cluster = this.expandCluster(track, neighbors, tracks, visited);
                clusters.push(this.createGroup(cluster));
            } else {
                // Single track is its own group
                clusters.push(this.createGroup([track]));
            }
        });

        return clusters;
    }

    getNeighbors(track, tracks, excludeIdx) {
        const neighbors = [];

        tracks.forEach((other, idx) => {
            if (idx === excludeIdx) return;

            const distance = this.calculateDistance(track, other);
            if (distance <= this.epsilon) {
                neighbors.push({ track: other, index: idx });
            }
        });

        return neighbors;
    }

    expandCluster(seedTrack, neighbors, allTracks, visited) {
        const cluster = [seedTrack];
        const queue = [...neighbors];

        while (queue.length > 0) {
            const { track: currentTrack, index: currentIdx } = queue.shift();

            if (visited.has(currentIdx)) continue;
            visited.add(currentIdx);

            cluster.push(currentTrack);

            const currentNeighbors = this.getNeighbors(currentTrack, allTracks, currentIdx);
            if (currentNeighbors.length >= this.minPoints) {
                queue.push(...currentNeighbors);
            }
        }

        return cluster;
    }

    calculateDistance(track1, track2) {
        // Calculate Euclidean distance in NM
        // Using bearing-range coordinates
        const dx = track2.range * Math.cos(track2.bearing * Math.PI / 180) -
            track1.range * Math.cos(track1.bearing * Math.PI / 180);
        const dy = track2.range * Math.sin(track2.bearing * Math.PI / 180) -
            track1.range * Math.sin(track1.bearing * Math.PI / 180);

        return Math.sqrt(dx * dx + dy * dy);
    }

    createGroup(tracks) {
        const centroid = this.calculateCentroid(tracks);
        const leadTrack = this.findLeadTrack(tracks);

        return {
            tracks,
            count: tracks.length,
            centroid,
            lead: leadTrack,
            hostile: tracks[0].hostile // Assume all in group have same hostility
        };
    }

    calculateCentroid(tracks) {
        let totalBearing = 0;
        let totalRange = 0;
        let totalAltitude = 0;

        tracks.forEach(track => {
            totalBearing += track.bearing;
            totalRange += track.range;
            totalAltitude += track.altitude;
        });

        const count = tracks.length;

        return {
            bearing: Math.round(totalBearing / count),
            range: Math.round(totalRange / count),
            altitude: Math.round(totalAltitude / count)
        };
    }

    findLeadTrack(tracks) {
        // Lead is the closest track in the group
        return tracks.reduce((closest, track) => {
            return track.range < closest.range ? track : closest;
        });
    }
}

window.TrackClusterer = TrackClusterer;
