/**
 * NTTR airspace overlay (CRT), stroke only. Boundaries are the published FAA
 * shapes built by geo/_build_nttr.js. Loads geo/nttr_airspace.json; falls back to
 * the embedded copy in geo_data.js for file://.
 * Projection px/nm must match ScopeEngine.scale so rings and map share nm truth.
 */
class AirspaceLayer {
    constructor(projection) {
        this.projection = projection;
        this.geojson = null;
        this.ready = false;
        this.loading = false;
        this.loadError = null;
        this.source = null;
        this.viewScale = 1;
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
            this.geojson = window.NTTR_AIRSPACE_DATA || { features: [] };
            this.source = 'fallback';
            this.ready = true;
            this.loadError = String(err && err.message ? err.message : err);
            console.warn('[AirspaceLayer] fetch failed, using embedded fallback:', this.loadError);
        } finally {
            this.loading = false;
        }
        return this.ready;
    }

    draw(ctx, opts = {}) {
        if (!this.ready || !this.geojson || !this.projection) return;
        // Lock geo nm scale to scope px/nm (must match range rings)
        if (opts.pxPerNm != null) this.projection.setPxPerNm(opts.pxPerNm);
        const features = this.geojson.features || [];
        this.viewScale = opts.viewScale != null ? opts.viewScale : 1;
        const inv = 1 / Math.max(this.viewScale, 0.5);
        const showLabels = this.viewScale >= 0.55;

        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Draw order: moa → restricted → ROZ → delta → AAR → labels
        const order = { moa: 0, sector: 0, exclusion: 0, corridor: 1, restricted: 2, roz: 3, delta: 4, aar: 5, aar_track: 6, aar_point: 7, label: 8 };
        const sorted = features.slice().sort((a, b) => {
            const ka = (a.properties && a.properties.kind) || '';
            const kb = (b.properties && b.properties.kind) || '';
            return (order[ka] != null ? order[ka] : 9) - (order[kb] != null ? order[kb] : 9);
        });

        for (const f of sorted) {
            const kind = (f.properties && f.properties.kind) || '';
            const g = f.geometry;
            if (!g) continue;
            const props = f.properties || {};

            if (kind === 'delta' && g.type === 'Polygon') {
                this._strokePolygon(ctx, g.coordinates, {
                    stroke: 'rgba(255, 50, 50, 1)',
                    width: 4.0 * inv
                });
                if (showLabels) this._labelCentroid(ctx, g.coordinates[0], 'NTTR', {
                    fill: 'rgba(255, 90, 90, 1)',
                    inv,
                    fontPx: 14
                });
                this._labelExtentCorners(ctx, g.coordinates[0], inv);
            } else if ((kind === 'moa' || kind === 'sector') && g.type === 'Polygon') {
                // Figure A.3-1 magenta MOA: stroke only
                this._strokePolygon(ctx, g.coordinates, {
                    stroke: 'rgba(255, 100, 200, 0.75)',
                    width: 1.3 * inv
                });
                if (showLabels && this.viewScale >= 0.85) {
                    this._labelCentroid(ctx, g.coordinates[0], props.label || props.name, {
                        fill: 'rgba(255, 140, 210, 0.85)',
                        inv,
                        fontPx: 9
                    });
                }
            } else if (kind === 'restricted' && g.type === 'Polygon') {
                // Figure A.3-1 light-blue restricted: CRT cyan stroke only
                this._strokePolygon(ctx, g.coordinates, {
                    stroke: 'rgba(80, 200, 255, 0.7)',
                    width: 1.4 * inv
                });
                if (showLabels && this.viewScale >= 0.9) {
                    this._labelCentroid(ctx, g.coordinates[0], props.label || props.name, {
                        fill: 'rgba(120, 220, 255, 0.8)',
                        inv,
                        fontPx: 8
                    });
                }
            } else if (kind === 'corridor' && g.type === 'Polygon') {
                ctx.save();
                ctx.setLineDash([6 * inv, 4 * inv]);
                this._strokePolygon(ctx, g.coordinates, {
                    stroke: 'rgba(80, 220, 240, 0.8)',
                    width: 1.4 * inv
                });
                ctx.restore();
                if (showLabels) this._labelCentroid(ctx, g.coordinates[0], props.label || 'SALLY', {
                    fill: 'rgba(120, 240, 255, 0.9)',
                    inv,
                    fontPx: 8
                });
            } else if (kind === 'roz' && g.type === 'Polygon') {
                // Chart 4808A: only fill
                this._fillStrokePolygon(ctx, g.coordinates, {
                    fill: 'rgba(100, 160, 220, 0.2)',
                    stroke: 'rgba(120, 200, 255, 0.95)',
                    width: 2.2 * inv
                });
                if (showLabels) this._labelCentroid(ctx, g.coordinates[0], props.label || '4808A', {
                    fill: 'rgba(160, 220, 255, 0.95)',
                    inv,
                    fontPx: 10
                });
            } else if (kind === 'aar' && g.type === 'Polygon') {
                this._strokePolygon(ctx, g.coordinates, {
                    stroke: 'rgba(255, 200, 60, 0.95)',
                    width: 2.0 * inv
                });
                if (showLabels) this._labelCentroid(ctx, g.coordinates[0], props.label || 'SHELL AAR', {
                    fill: 'rgba(255, 210, 80, 0.95)',
                    inv,
                    fontPx: 10
                });
            } else if (kind === 'aar_point' && g.type === 'Point') {
                this._drawPoint(ctx, g.coordinates, props, inv);
            } else if (kind === 'aar_track' && g.type === 'LineString') {
                // Published IP → CP track; the tanker's outbound leg flies this line.
                const a = this.projection.latLonToXY(g.coordinates[0][1], g.coordinates[0][0]);
                const b = this.projection.latLonToXY(g.coordinates[1][1], g.coordinates[1][0]);
                ctx.save();
                ctx.setLineDash([5 * inv, 4 * inv]);
                ctx.strokeStyle = 'rgba(255, 200, 60, 0.8)';
                ctx.lineWidth = 1.2 * inv;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.restore();
            } else if (kind === 'exclusion' && g.type === 'Polygon') {
                // Low-altitude exclusion inside the MOA
                ctx.save();
                ctx.setLineDash([3 * inv, 3 * inv]);
                this._strokePolygon(ctx, g.coordinates, { stroke: 'rgba(255, 100, 200, 0.5)', width: 1.0 * inv });
                ctx.restore();
            } else if (kind === 'label' && g.type === 'Point') {
                // Sub-area with no published boundary: name only, position approximate
                if (showLabels && this.viewScale >= 0.85) {
                    const p = this.projection.latLonToXY(g.coordinates[1], g.coordinates[0]);
                    ctx.font = `italic ${9 * inv}px "Courier New", monospace`;
                    ctx.fillStyle = 'rgba(255, 140, 210, 0.6)';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(props.label || props.name), p.x, p.y);
                }
            }
        }

        ctx.restore();
    }

    _strokePolygon(ctx, rings, style) {
        if (!rings || !rings.length) return;
        ctx.beginPath();
        this._pathRings(ctx, rings);
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.width || 1;
        ctx.stroke();
    }

    _fillStrokePolygon(ctx, rings, style) {
        if (!rings || !rings.length) return;
        ctx.beginPath();
        this._pathRings(ctx, rings);
        if (style.fill) {
            ctx.fillStyle = style.fill;
            ctx.fill();
        }
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.width || 1;
        ctx.stroke();
    }

    _pathRings(ctx, rings) {
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
    }

    _labelCentroid(ctx, ring, text, opts) {
        if (!text || !ring || ring.length < 3) return;
        let sx = 0, sy = 0, n = 0;
        for (let i = 0; i < ring.length - 1; i++) {
            sx += ring[i][0];
            sy += ring[i][1];
            n++;
        }
        if (!n) return;
        const p = this.projection.latLonToXY(sy / n, sx / n);
        const inv = opts.inv || 1;
        const fontPx = (opts.fontPx || 9) * inv;
        ctx.font = `${fontPx}px "Courier New", monospace`;
        ctx.fillStyle = opts.fill || 'rgba(0, 255, 100, 0.8)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(text), p.x, p.y);
    }

    /** Corner BR callouts so NTTR size vs rings is obvious */
    _labelExtentCorners(ctx, ring, inv) {
        if (!ring || !this.projection || !this.projection.latLonToBearingRange) return;
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        for (let i = 0; i < ring.length; i++) {
            const lon = ring[i][0], lat = ring[i][1];
            minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
            minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
        }
        const corners = [
            { lat: maxLat, lon: minLon, tag: 'NW' },
            { lat: minLat, lon: minLon, tag: 'SW' },
            { lat: minLat, lon: maxLon, tag: 'SE' }
        ];
        ctx.font = `${10 * inv}px "Courier New", monospace`;
        ctx.fillStyle = 'rgba(255, 120, 120, 0.95)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        for (const c of corners) {
            const br = this.projection.latLonToBearingRange(c.lat, c.lon);
            const p = this.projection.latLonToXY(c.lat, c.lon);
            ctx.fillText(
                `${c.tag} ${br.bearing.toFixed(0)}/${br.range.toFixed(0)}`,
                p.x + 4 * inv,
                p.y - 2 * inv
            );
        }
    }

    _drawPoint(ctx, coord, props, inv) {
        const [lon, lat] = coord;
        const p = this.projection.latLonToXY(lat, lon);
        ctx.strokeStyle = 'rgba(255, 200, 60, 0.95)';
        ctx.fillStyle = 'rgba(255, 180, 40, 0.5)';
        ctx.lineWidth = 1.2 * inv;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5 * inv, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const label = props.label || props.name || '';
        if (label) {
            ctx.font = `${9 * inv}px "Courier New", monospace`;
            ctx.fillStyle = 'rgba(255, 210, 80, 0.95)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(label, p.x + 5 * inv, p.y - 2 * inv);
        }
    }
}

if (typeof window !== 'undefined') window.AirspaceLayer = AirspaceLayer;
