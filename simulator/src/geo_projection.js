/**
 * Azimuthal-equidistant projection centred on bullseye. Every point is drawn at its
 * true great-circle bearing and distance from bullseye, so the map, the airspace and
 * anything placed by bullseye bearing/range share one geometry by construction.
 * Canvas: north = −Y (matches existing BR polar math).
 */
const EARTH_RADIUS_NM = 3440.065;

class GeoProjection {
    constructor(opts = {}) {
        this.lat0 = opts.lat != null ? opts.lat : 38.0;
        this.lon0 = opts.lon != null ? opts.lon : -115.0;
        this.pxPerNm = opts.pxPerNm != null ? opts.pxPerNm : 2;
        this.bullseyeCanvas = opts.bullseyeCanvas || { x: 400, y: 400 };
    }

    setBullseyeGeo(lat, lon) {
        this.lat0 = lat;
        this.lon0 = lon;
    }

    /** { lat, lon } from a sheet/DMS string or a { lat, lon } object. */
    static toLatLon(ref) {
        if (ref == null) return null;
        if (typeof ref === 'string') return GeoProjection.parseDms(ref);
        return (ref.lat != null && ref.lon != null) ? { lat: ref.lat, lon: ref.lon } : null;
    }

    /**
     * Give a scenario object its bullseye bearing/range from a geographic reference, so
     * overlay items pinned to real coordinates cannot drift from the airspace drawing.
     *   { geo: "N37 07 W114 24" }                    → bearing, range
     *   { ip: "...", cp: "...", laneHalfNm? }        → racetrack whose outbound leg is the
     *                                                  IP→CP track (left-hand pattern)
     */
    resolveGeoRef(obj) {
        if (!obj) return obj;
        const ip = GeoProjection.toLatLon(obj.ip);
        const cp = GeoProjection.toLatLon(obj.cp);
        if (ip && cp) {
            const a = this.latLonToNm(ip.lat, ip.lon);
            const b = this.latLonToNm(cp.lat, cp.lon);
            const dx = b.xNm - a.xNm;
            const dy = b.yNm - a.yNm;
            const len = Math.hypot(dx, dy);
            const lane = obj.laneHalfNm != null ? obj.laneHalfNm : 5;
            // Centre sits one lane-width left of the published track.
            const cx = (a.xNm + b.xNm) / 2 - (dy / len) * lane;
            const cy = (a.yNm + b.yNm) / 2 + (dx / len) * lane;
            obj.legHeading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
            obj.legLength = len;
            obj.laneHalfNm = lane;
            obj.range = Math.hypot(cx, cy);
            obj.bearing = (Math.atan2(cx, cy) * 180 / Math.PI + 360) % 360;
            return obj;
        }
        const p = GeoProjection.toLatLon(obj.geo);
        if (p) {
            const br = this.latLonToBearingRange(p.lat, p.lon);
            obj.bearing = br.bearing;
            obj.range = br.range;
        }
        return obj;
    }

    setPxPerNm(px) {
        this.pxPerNm = px;
    }

    setBullseyeCanvas(x, y) {
        this.bullseyeCanvas = { x, y };
    }

    /** Degrees lat/lon → nm east / nm north of bulls */
    latLonToNm(lat, lon) {
        const br = this.latLonToBearingRange(lat, lon);
        const rad = br.bearing * Math.PI / 180;
        return { xNm: br.range * Math.sin(rad), yNm: br.range * Math.cos(rad) };
    }

    /** Nm east/north of bulls → lat/lon */
    nmToLatLon(xNm, yNm) {
        const bearing = Math.atan2(xNm, yNm) * 180 / Math.PI;
        return this.bearingRangeToLatLon(bearing, Math.hypot(xNm, yNm));
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

    /** Bullseye bearing (true) / range (nm) → lat/lon along the great circle. */
    bearingRangeToLatLon(bearing, rangeNm) {
        const d2r = Math.PI / 180;
        const lat0 = this.lat0 * d2r;
        const brg = bearing * d2r;
        const c = rangeNm / EARTH_RADIUS_NM;
        const lat = Math.asin(Math.sin(lat0) * Math.cos(c) + Math.cos(lat0) * Math.sin(c) * Math.cos(brg));
        const lon = this.lon0 * d2r + Math.atan2(
            Math.sin(brg) * Math.sin(c) * Math.cos(lat0),
            Math.cos(c) - Math.sin(lat0) * Math.sin(lat)
        );
        return { lat: lat / d2r, lon: lon / d2r };
    }

    /** Lat/lon → bullseye bearing (true) / great-circle range (nm). */
    latLonToBearingRange(lat, lon) {
        const d2r = Math.PI / 180;
        const lat0 = this.lat0 * d2r;
        const lat1 = lat * d2r;
        const dLon = (lon - this.lon0) * d2r;
        const h = Math.sin((lat1 - lat0) / 2) ** 2
            + Math.cos(lat0) * Math.cos(lat1) * Math.sin(dLon / 2) ** 2;
        const range = 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
        let bearing = Math.atan2(
            Math.sin(dLon) * Math.cos(lat1),
            Math.cos(lat0) * Math.sin(lat1) - Math.sin(lat0) * Math.cos(lat1) * Math.cos(dLon)
        ) / d2r;
        bearing = ((bearing % 360) + 360) % 360;
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
