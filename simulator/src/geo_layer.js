/**
 * Offline stylized geography layer for CRT scope (true north).
 * Loads GeoJSON via fetch; falls back to embedded copy for file://.
 */
class GeoLayer {
    constructor(projection) {
        this.projection = projection;
        this.geojson = null;
        this.ready = false;
        this.loading = false;
        this.loadError = null;
        this.source = null; // 'fetch' | 'fallback'
    }

    async load(url) {
        if (this.loading || this.ready) return this.ready;
        this.loading = true;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this.geojson = await res.json();
            this.source = 'fetch';
            this.ready = true;
            this.loadError = null;
        } catch (err) {
            this.geojson = GeoLayer.FALLBACK_GEO;
            this.source = 'fallback';
            this.ready = true;
            this.loadError = String(err && err.message ? err.message : err);
            console.warn('[GeoLayer] fetch failed, using embedded fallback:', this.loadError);
        } finally {
            this.loading = false;
        }
        return this.ready;
    }

    draw(ctx, opts = {}) {
        if (!this.ready || !this.geojson || !this.projection) return;
        const features = this.geojson.features || [];
        const dim = opts.dim != null ? opts.dim : 0.35;

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (const f of features) {
            const kind = (f.properties && f.properties.kind) || '';
            const g = f.geometry;
            if (!g) continue;

            if (kind === 'state' && g.type === 'Polygon') {
                this._drawPolygon(ctx, g.coordinates, {
                    stroke: `rgba(40, 180, 80, ${dim})`,
                    fill: `rgba(20, 80, 40, ${dim * 0.15})`,
                    width: 1.2
                });
            } else if (kind === 'coast' && g.type === 'LineString') {
                this._drawLine(ctx, g.coordinates, {
                    stroke: `rgba(50, 200, 100, ${Math.min(1, dim + 0.2)})`,
                    width: 1.5
                });
            } else if (kind === 'airfield' && g.type === 'Point') {
                this._drawAirfield(ctx, g.coordinates, f.properties, dim);
            }
            // bullseye marker skipped — scope already draws bulls
        }

        ctx.restore();
    }

    _drawPolygon(ctx, rings, style) {
        if (!rings || !rings.length) return;
        ctx.beginPath();
        for (let r = 0; r < rings.length; r++) {
            const ring = rings[r];
            for (let i = 0; i < ring.length; i++) {
                const [lon, lat] = ring[i];
                const p = this.projection.latLonToXY(lat, lon);
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
        }
        if (style.fill) {
            ctx.fillStyle = style.fill;
            ctx.fill();
        }
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.width || 1;
        ctx.stroke();
    }

    _drawLine(ctx, coords, style) {
        if (!coords || coords.length < 2) return;
        ctx.beginPath();
        for (let i = 0; i < coords.length; i++) {
            const [lon, lat] = coords[i];
            const p = this.projection.latLonToXY(lat, lon);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.width || 1;
        ctx.stroke();
    }

    _drawAirfield(ctx, coord, props, dim) {
        const [lon, lat] = coord;
        const p = this.projection.latLonToXY(lat, lon);
        const label = (props && (props.label || props.name)) || '';
        const a = Math.min(1, dim + 0.25);

        ctx.strokeStyle = `rgba(60, 220, 100, ${a})`;
        ctx.fillStyle = `rgba(40, 160, 70, ${a * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 4);
        ctx.lineTo(p.x + 3, p.y + 3);
        ctx.lineTo(p.x - 3, p.y + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (label) {
            ctx.font = '9px "Courier New", monospace';
            ctx.fillStyle = `rgba(80, 220, 120, ${a})`;
            ctx.fillText(label, p.x + 5, p.y - 2);
        }
    }
}

/** Minimal embedded copy of nellis_aor.json for file:// */
GeoLayer.FALLBACK_GEO = {
    type: 'FeatureCollection',
    name: 'nellis_aor_fallback',
    features: [
        {
            type: 'Feature',
            properties: { name: 'Pacific Coast', kind: 'coast' },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-124.4, 42.0], [-124.2, 41.0], [-124.1, 40.0], [-123.8, 39.0],
                    [-123.0, 38.0], [-122.5, 37.5], [-122.4, 37.0], [-122.0, 36.5],
                    [-121.5, 36.0], [-120.9, 35.3], [-120.6, 34.5], [-119.7, 34.2],
                    [-119.0, 34.0], [-118.5, 33.8], [-117.3, 32.7], [-117.1, 32.5]
                ]
            }
        },
        {
            type: 'Feature',
            properties: { name: 'California', kind: 'state' },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [-124.4, 42.0], [-120.0, 42.0], [-120.0, 39.0], [-114.13, 34.87],
                    [-114.5, 34.0], [-114.6, 32.7], [-117.1, 32.5], [-117.3, 32.7],
                    [-118.5, 33.8], [-119.0, 34.0], [-119.7, 34.2], [-120.6, 34.5],
                    [-120.9, 35.3], [-121.5, 36.0], [-122.0, 36.5], [-122.4, 37.0],
                    [-122.5, 37.5], [-123.0, 38.0], [-123.8, 39.0], [-124.1, 40.0],
                    [-124.2, 41.0], [-124.4, 42.0]
                ]]
            }
        },
        {
            type: 'Feature',
            properties: { name: 'Nevada', kind: 'state' },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [-120.0, 42.0], [-114.05, 42.0], [-114.05, 37.0], [-114.05, 36.0],
                    [-114.05, 35.0], [-114.6, 35.0], [-114.7, 35.2], [-114.8, 36.0],
                    [-114.13, 34.87], [-120.0, 39.0], [-120.0, 42.0]
                ]]
            }
        },
        {
            type: 'Feature',
            properties: { name: 'Arizona', kind: 'state' },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [-114.05, 37.0], [-109.05, 37.0], [-109.05, 31.35], [-111.0, 31.35],
                    [-114.8, 32.5], [-114.6, 32.7], [-114.5, 34.0], [-114.13, 34.87],
                    [-114.7, 35.2], [-114.6, 35.0], [-114.05, 35.0], [-114.05, 36.0],
                    [-114.05, 37.0]
                ]]
            }
        },
        {
            type: 'Feature',
            properties: { name: 'Utah', kind: 'state' },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [-114.05, 42.0], [-109.05, 42.0], [-109.05, 37.0], [-114.05, 37.0],
                    [-114.05, 42.0]
                ]]
            }
        },
        { type: 'Feature', properties: { name: 'KLSV', kind: 'airfield', label: 'NELLIS' }, geometry: { type: 'Point', coordinates: [-115.034, 36.236] } },
        { type: 'Feature', properties: { name: 'KTNX', kind: 'airfield', label: 'TONOPAH' }, geometry: { type: 'Point', coordinates: [-117.087, 38.060] } },
        { type: 'Feature', properties: { name: 'KINS', kind: 'airfield', label: 'CREECH' }, geometry: { type: 'Point', coordinates: [-115.672, 36.587] } },
        { type: 'Feature', properties: { name: 'KLAS', kind: 'airfield', label: 'LAS' }, geometry: { type: 'Point', coordinates: [-115.152, 36.080] } },
        { type: 'Feature', properties: { name: 'KNFL', kind: 'airfield', label: 'FALLON' }, geometry: { type: 'Point', coordinates: [-118.701, 39.417] } },
        { type: 'Feature', properties: { name: 'KNID', kind: 'airfield', label: 'CHINA LK' }, geometry: { type: 'Point', coordinates: [-117.685, 35.685] } },
        { type: 'Feature', properties: { name: 'KEDW', kind: 'airfield', label: 'EDWARDS' }, geometry: { type: 'Point', coordinates: [-117.884, 34.905] } },
        { type: 'Feature', properties: { name: 'KRNO', kind: 'airfield', label: 'RENO' }, geometry: { type: 'Point', coordinates: [-119.768, 39.499] } },
        { type: 'Feature', properties: { name: 'KSLC', kind: 'airfield', label: 'SLC' }, geometry: { type: 'Point', coordinates: [-111.978, 40.788] } },
        { type: 'Feature', properties: { name: 'KPHX', kind: 'airfield', label: 'PHX' }, geometry: { type: 'Point', coordinates: [-112.012, 33.434] } }
    ]
};

if (typeof window !== 'undefined') window.GeoLayer = GeoLayer;
