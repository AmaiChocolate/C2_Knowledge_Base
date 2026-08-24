/**
 * AN/TPS-75 radar feed model (logic only — no console UI).
 * Truth tracks in → what the BC3 scope displays out.
 */
class RadarModel {
    constructor() {
        // Study envelope (MQF MSO #54): 240 NM / 95,500 ft
        this.maxRangeNm = 240;
        this.maxAltitudeFt = 95500;
        this.modes = {
            NORMAL: 'normal',
            EMCON: 'emcon',
            DEGRADED: 'degraded',
            OFFLINE: 'offline'
        };
        this.mode = this.modes.NORMAL;
        this.updateHz = 1.5;
        this._accum = 0;
        this._lastFeed = [];
    }

    setMode(mode) {
        if (Object.values(this.modes).includes(mode)) {
            this.mode = mode;
        }
    }

    /**
     * @param {Array} truthTracks - full simulation truth
     * @param {number} dt - seconds
     * @returns {Array} tracks visible on BC3 scope
     */
    process(truthTracks, dt = 0) {
        this._accum += dt;
        const interval = 1 / this.updateHz;
        const refresh = this._accum >= interval || this._lastFeed.length === 0;
        if (refresh) this._accum = 0;

        if (this.mode === this.modes.OFFLINE) {
            this._lastFeed = [];
            return [];
        }

        let maxR = this.maxRangeNm;
        let dropProb = 0;
        let rangeJitter = 0;

        if (this.mode === this.modes.EMCON) {
            maxR = Math.min(maxR, 120);
        } else if (this.mode === this.modes.DEGRADED) {
            // Outer DCA picture (~155–180) drops; near threat (~155) can still paint intermittently
            maxR = Math.min(maxR, 160);
            dropProb = 0.35;
            rangeJitter = 3;
        }

        if (!refresh && this.mode === this.modes.DEGRADED) {
            // Hold last feed briefly to simulate delay/stale plots
            return this._lastFeed.map(t => ({ ...t, stale: true }));
        }

        const fed = [];
        for (const t of truthTracks) {
            if (t.isSplashed) continue;
            if (t.isDormant) continue;
            if (t.range > maxR) continue;
            if (t.altitude > this.maxAltitudeFt) continue;
            if (dropProb > 0 && Math.random() < dropProb && t.range > 40) continue;

            const copy = { ...t };
            if (rangeJitter) {
                copy.range = Math.max(1, t.range + (Math.random() - 0.5) * 2 * rangeJitter);
            }
            copy.fromRadar = true;
            copy.stale = false;
            fed.push(copy);
        }

        this._lastFeed = fed;
        return fed;
    }

    statusLabel() {
        const labels = {
            normal: 'TPS-75 FEED: NORMAL',
            emcon: 'TPS-75 FEED: EMCON (RANGE LIMITED)',
            degraded: 'TPS-75 FEED: DEGRADED',
            offline: 'TPS-75 FEED: OFFLINE'
        };
        return labels[this.mode] || this.mode;
    }
}

if (typeof window !== 'undefined') window.RadarModel = RadarModel;
