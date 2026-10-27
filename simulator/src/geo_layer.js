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
            this.geojson = window.NELLIS_AOR_DATA || { features: [] };
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

            if (kind === 'graticule' && g.type === 'LineString') {
                this._drawGraticuleLine(ctx, g.coordinates, f.properties, opts);
            } else if (kind === 'state' && g.type === 'Polygon') {
                this._drawPolygon(ctx, g.coordinates, {
                    stroke: `rgba(40, 180, 80, ${dim})`,
                    fill: `rgba(20, 80, 40, ${dim * 0.15})`,
                    width: 1.2 / Math.max(opts.viewScale || 1, 0.5)
                });
            } else if (kind === 'coast' && g.type === 'LineString') {
                this._drawLine(ctx, g.coordinates, {
                    stroke: `rgba(50, 200, 100, ${Math.min(1, dim + 0.2)})`,
                    width: 1.5
                });
            } else if (kind === 'airfield' && g.type === 'Point') {
                this._drawAirfield(ctx, g.coordinates, f.properties, dim);
            }
            // bullseye marker skipped: scope already draws bulls
        }

        ctx.restore();
    }

    /** Whole-degree parallels / meridians, labelled where they cross the bullseye axes. */
    _drawGraticuleLine(ctx, coords, props, opts) {
        const inv = 1 / Math.max(opts.viewScale || 1, 0.5);
        this._drawLine(ctx, coords, { stroke: 'rgba(60, 170, 110, 0.28)', width: 0.8 * inv });
        const at = props.labelAt;
        if (!at) return;
        const p = this.projection.latLonToXY(at[1], at[0]);
        ctx.font = `${9 * inv}px "Courier New", monospace`;
        ctx.fillStyle = 'rgba(90, 200, 140, 0.6)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(props.label, p.x + 3 * inv, p.y - 2 * inv);
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

if (typeof window !== 'undefined') window.GeoLayer = GeoLayer;
