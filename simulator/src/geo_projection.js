/**
 * Local equirectangular projection centered on bullseye lat/lon.
 * Suitable for ~1000nm AOR at mid-latitudes (Nellis theater).
 * Canvas: north = −Y (matches existing BR polar math).
 */
class GeoProjection {
    constructor(opts = {}) {
        this.lat0 = opts.lat != null ? opts.lat : 38.0;
        this.lon0 = opts.lon != null ? opts.lon : -115.0;
        this.pxPerNm = opts.pxPerNm != null ? opts.pxPerNm : 2;
        this.bullseyeCanvas = opts.bullseyeCanvas || { x: 400, y: 400 };
        this._cosLat0 = Math.cos(this.lat0 * Math.PI / 180);
    }

    setBullseyeGeo(lat, lon) {
        this.lat0 = lat;
        this.lon0 = lon;
        this._cosLat0 = Math.cos(this.lat0 * Math.PI / 180);
    }

    setPxPerNm(px) {
        this.pxPerNm = px;
    }

    setBullseyeCanvas(x, y) {
        this.bullseyeCanvas = { x, y };
    }

    /** Degrees lat/lon → nm east / nm north of bulls */
    latLonToNm(lat, lon) {
        return {
            xNm: (lon - this.lon0) * 60 * this._cosLat0,
            yNm: (lat - this.lat0) * 60
        };
    }

    /** Nm east/north of bulls → lat/lon */
    nmToLatLon(xNm, yNm) {
        return {
            lat: this.lat0 + yNm / 60,
            lon: this.lon0 + xNm / (60 * this._cosLat0)
        };
    }

    /** Lat/lon → canvas XY (same space as bearingRangeToXY) */
    latLonToXY(lat, lon) {
        // Prefer scope BR→XY so geo/airspace cannot drift from range rings
        if (typeof this._brToXY === 'function') {
            const br = this.latLonToBearingRange(lat, lon);
            return this._brToXY(br.bearing, br.range);
        }
        const { xNm, yNm } = this.latLonToNm(lat, lon);
        return {
            x: this.bullseyeCanvas.x + xNm * this.pxPerNm,
            y: this.bullseyeCanvas.y - yNm * this.pxPerNm
        };
    }

    /** Canvas XY → lat/lon */
    xyToLatLon(x, y) {
        const xNm = (x - this.bullseyeCanvas.x) / this.pxPerNm;
        const yNm = (this.bullseyeCanvas.y - y) / this.pxPerNm;
        return this.nmToLatLon(xNm, yNm);
    }

    /**
     * Bullseye BR → lat/lon.
     * Matches ScopeEngine.bearingRangeToXY: rad = (brg-90)*π/180,
     * dx = range*cos(rad), dy = range*sin(rad).
     */
    bearingRangeToLatLon(bearing, rangeNm) {
        const rad = (bearing - 90) * Math.PI / 180;
        const eastNm = rangeNm * Math.cos(rad);
        const northNm = -rangeNm * Math.sin(rad);
        return this.nmToLatLon(eastNm, northNm);
    }

    /** Lat/lon → bullseye BR */
    latLonToBearingRange(lat, lon) {
        const { xNm, yNm } = this.latLonToNm(lat, lon);
        const range = Math.sqrt(xNm * xNm + yNm * yNm);
        let bearing = Math.atan2(-yNm, xNm) * (180 / Math.PI) + 90;
        if (bearing < 0) bearing += 360;
        if (bearing >= 360) bearing -= 360;
        return { bearing, range };
    }

    formatLatLon(lat, lon, digits = 2) {
        const ns = lat >= 0 ? 'N' : 'S';
        const ew = lon >= 0 ? 'E' : 'W';
        return `${ns}${Math.abs(lat).toFixed(digits)} ${ew}${Math.abs(lon).toFixed(digits)}`;
    }

    /**
     * Parse sheet / FLIP DMS into { lat, lon }.
     * Accepts: "N37°07' W114°24'", "N37 07 W114 24", "N3707 W11424", "N371700 W1151803".
     */
    static parseDms(text) {
        if (text == null) return null;
        const s = String(text).trim().replace(/[′’]/g, "'").replace(/[″”]/g, '"');

        // Compact DDMMSS DDDMMS: N371700 W1151803
        let m = s.match(/^([NS])\s*(\d{2})(\d{2})(\d{2})\s+([EW])\s*(\d{3})(\d{2})(\d{2})$/i);
        if (m) {
            let lat = (+m[2]) + (+m[3]) / 60 + (+m[4]) / 3600;
            if (m[1].toUpperCase() === 'S') lat = -lat;
            let lon = (+m[6]) + (+m[7]) / 60 + (+m[8]) / 3600;
            if (m[5].toUpperCase() === 'W') lon = -lon;
            return { lat, lon };
        }

        // Compact DDMM DDDMM: N3707 W11424
        m = s.match(/^([NS])\s*(\d{2})(\d{2})\s+([EW])\s*(\d{3})(\d{2})$/i);
        if (m) {
            let lat = (+m[2]) + (+m[3]) / 60;
            if (m[1].toUpperCase() === 'S') lat = -lat;
            let lon = (+m[5]) + (+m[6]) / 60;
            if (m[4].toUpperCase() === 'W') lon = -lon;
            return { lat, lon };
        }

        // Sheet: N37°07' W114°24' or N37 07 W114 24
        m = s.match(/([NS])\s*(\d{1,2})\s*[°\s]\s*(\d{1,2})\s*'?\s*([EW])\s*(\d{1,3})\s*[°\s]\s*(\d{1,2})\s*'?/i);
        if (m) {
            let lat = (+m[2]) + (+m[3]) / 60;
            if (m[1].toUpperCase() === 'S') lat = -lat;
            let lon = (+m[5]) + (+m[6]) / 60;
            if (m[4].toUpperCase() === 'W') lon = -lon;
            return { lat, lon };
        }

        return null;
    }

    /** Convenience: DMS string → [lon, lat] GeoJSON order */
    static dmsToLonLat(text) {
        const p = GeoProjection.parseDms(text);
        return p ? [p.lon, p.lat] : null;
    }
}

if (typeof window !== 'undefined') window.GeoProjection = GeoProjection;
