/**
 * NTTR airspace overlay (CRT). Stroke-only except R-4808 ROZ fill.
 * Loads geo/nttr_airspace.json; falls back to embedded copy for file://.
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
            this.geojson = AirspaceLayer.FALLBACK_AIRSPACE;
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

        // Draw order: moa → restricted → ROZ → delta → AAR
        const order = { moa: 0, sector: 0, corridor: 1, restricted: 2, roz: 3, delta: 4, aar: 5, aar_point: 6 };
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
                // Figure A.3-1 magenta MOA — stroke only
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
                // Figure A.3-1 light-blue restricted — CRT cyan stroke only
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
                // Chart 4808A — only fill
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

AirspaceLayer.FALLBACK_AIRSPACE = {
  "type": "FeatureCollection",
  "name": "nttr_airspace",
  "crs": {
    "type": "name",
    "properties": {
      "name": "EPSG:4326"
    }
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "AIRSPACE DELTA",
        "kind": "delta",
        "label": "NTTR"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -117.094722,
              37.55
            ],
            [
              -117.075833,
              37.441667
            ],
            [
              -116.450833,
              36.683333
            ],
            [
              -115.384167,
              36.433333
            ],
            [
              -115.300833,
              36.433333
            ],
            [
              -114.25,
              36.45
            ],
            [
              -113.9,
              36.7
            ],
            [
              -113.9,
              38.15
            ],
            [
              -117.05,
              38.15
            ],
            [
              -117.094722,
              37.883333
            ],
            [
              -117.094722,
              37.55
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "ECS",
        "kind": "restricted",
        "label": "ECS"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -117.05,
              36.45
            ],
            [
              -116.55,
              36.45
            ],
            [
              -116.55,
              36.95
            ],
            [
              -117.05,
              36.95
            ],
            [
              -117.05,
              36.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "4808S",
        "kind": "restricted",
        "label": "4808S"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.55,
              36.45
            ],
            [
              -116.2,
              36.45
            ],
            [
              -116.2,
              36.7
            ],
            [
              -116.55,
              36.7
            ],
            [
              -116.55,
              36.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "65D",
        "kind": "restricted",
        "label": "65D"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.2,
              36.45
            ],
            [
              -115.85,
              36.45
            ],
            [
              -115.85,
              36.7
            ],
            [
              -116.2,
              36.7
            ],
            [
              -116.2,
              36.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "64F",
        "kind": "restricted",
        "label": "64F"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.85,
              36.45
            ],
            [
              -115.5,
              36.45
            ],
            [
              -115.5,
              36.7
            ],
            [
              -115.85,
              36.7
            ],
            [
              -115.85,
              36.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "63C",
        "kind": "restricted",
        "label": "63C"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.5,
              36.45
            ],
            [
              -115.15,
              36.45
            ],
            [
              -115.15,
              36.7
            ],
            [
              -115.5,
              36.7
            ],
            [
              -115.5,
              36.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "62B",
        "kind": "restricted",
        "label": "62B"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.15,
              36.45
            ],
            [
              -114.7,
              36.45
            ],
            [
              -114.7,
              36.7
            ],
            [
              -115.15,
              36.7
            ],
            [
              -115.15,
              36.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "ELGIN",
        "kind": "moa",
        "label": "ELGIN"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -114.7,
              36.45
            ],
            [
              -113.9,
              36.45
            ],
            [
              -113.9,
              36.95
            ],
            [
              -114.7,
              36.95
            ],
            [
              -114.7,
              36.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "4808E",
        "kind": "restricted",
        "label": "4808E"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.55,
              36.7
            ],
            [
              -116.2,
              36.7
            ],
            [
              -116.2,
              36.95
            ],
            [
              -116.55,
              36.95
            ],
            [
              -116.55,
              36.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "65C",
        "kind": "restricted",
        "label": "65C"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.2,
              36.7
            ],
            [
              -115.85,
              36.7
            ],
            [
              -115.85,
              36.95
            ],
            [
              -116.2,
              36.95
            ],
            [
              -116.2,
              36.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "64D",
        "kind": "restricted",
        "label": "64D"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.85,
              36.7
            ],
            [
              -115.5,
              36.7
            ],
            [
              -115.5,
              36.95
            ],
            [
              -115.85,
              36.95
            ],
            [
              -115.85,
              36.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "63B",
        "kind": "restricted",
        "label": "63B"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.5,
              36.7
            ],
            [
              -115.15,
              36.7
            ],
            [
              -115.15,
              36.95
            ],
            [
              -115.5,
              36.95
            ],
            [
              -115.5,
              36.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "62A",
        "kind": "restricted",
        "label": "62A"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.15,
              36.7
            ],
            [
              -114.7,
              36.7
            ],
            [
              -114.7,
              36.95
            ],
            [
              -115.15,
              36.95
            ],
            [
              -115.15,
              36.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "76",
        "kind": "restricted",
        "label": "76"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -117.05,
              36.95
            ],
            [
              -116.55,
              36.95
            ],
            [
              -116.55,
              37.2
            ],
            [
              -117.05,
              37.2
            ],
            [
              -117.05,
              36.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "4808B",
        "kind": "restricted",
        "label": "4808B"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.55,
              36.95
            ],
            [
              -116.2,
              36.95
            ],
            [
              -116.2,
              37.2
            ],
            [
              -116.55,
              37.2
            ],
            [
              -116.55,
              36.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "65B",
        "kind": "restricted",
        "label": "65B"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.85,
              36.95
            ],
            [
              -115.5,
              36.95
            ],
            [
              -115.5,
              37.2
            ],
            [
              -115.85,
              37.2
            ],
            [
              -115.85,
              36.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "64C",
        "kind": "restricted",
        "label": "64C"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.5,
              36.95
            ],
            [
              -115.15,
              36.95
            ],
            [
              -115.15,
              37.2
            ],
            [
              -115.5,
              37.2
            ],
            [
              -115.5,
              36.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "61B",
        "kind": "restricted",
        "label": "61B"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.15,
              36.95
            ],
            [
              -114.7,
              36.95
            ],
            [
              -114.7,
              37.2
            ],
            [
              -115.15,
              37.2
            ],
            [
              -115.15,
              36.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "SALLY",
        "kind": "moa",
        "label": "SALLY"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -114.7,
              36.95
            ],
            [
              -114.25,
              36.95
            ],
            [
              -114.25,
              37.2
            ],
            [
              -114.7,
              37.2
            ],
            [
              -114.7,
              36.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "ELGIN",
        "kind": "moa",
        "label": "ELGIN"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -114.25,
              36.95
            ],
            [
              -113.9,
              36.95
            ],
            [
              -113.9,
              37.2
            ],
            [
              -114.25,
              37.2
            ],
            [
              -114.25,
              36.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "75W",
        "kind": "restricted",
        "label": "75W"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -117.05,
              37.2
            ],
            [
              -116.55,
              37.2
            ],
            [
              -116.55,
              37.45
            ],
            [
              -117.05,
              37.45
            ],
            [
              -117.05,
              37.2
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "4808D",
        "kind": "restricted",
        "label": "4808D"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.55,
              37.2
            ],
            [
              -116.2,
              37.2
            ],
            [
              -116.2,
              37.45
            ],
            [
              -116.55,
              37.45
            ],
            [
              -116.55,
              37.2
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "65A",
        "kind": "restricted",
        "label": "65A"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.85,
              37.2
            ],
            [
              -115.5,
              37.2
            ],
            [
              -115.5,
              37.45
            ],
            [
              -115.85,
              37.45
            ],
            [
              -115.85,
              37.2
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "64B",
        "kind": "restricted",
        "label": "64B"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.5,
              37.2
            ],
            [
              -115.15,
              37.2
            ],
            [
              -115.15,
              37.45
            ],
            [
              -115.5,
              37.45
            ],
            [
              -115.5,
              37.2
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "61A",
        "kind": "restricted",
        "label": "61A"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.15,
              37.2
            ],
            [
              -114.7,
              37.2
            ],
            [
              -114.7,
              37.45
            ],
            [
              -115.15,
              37.45
            ],
            [
              -115.15,
              37.2
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "ALAMOC",
        "kind": "restricted",
        "label": "ALAMOC"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -114.7,
              37.2
            ],
            [
              -114.25,
              37.2
            ],
            [
              -114.25,
              37.45
            ],
            [
              -114.7,
              37.45
            ],
            [
              -114.7,
              37.2
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "CALC",
        "kind": "moa",
        "label": "CALC"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -114.25,
              37.2
            ],
            [
              -113.9,
              37.2
            ],
            [
              -113.9,
              37.7
            ],
            [
              -114.25,
              37.7
            ],
            [
              -114.25,
              37.2
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "75E",
        "kind": "restricted",
        "label": "75E"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -117.05,
              37.45
            ],
            [
              -116.55,
              37.45
            ],
            [
              -116.55,
              37.7
            ],
            [
              -117.05,
              37.7
            ],
            [
              -117.05,
              37.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "74A",
        "kind": "restricted",
        "label": "74A"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.55,
              37.45
            ],
            [
              -116.2,
              37.45
            ],
            [
              -116.2,
              37.7
            ],
            [
              -116.55,
              37.7
            ],
            [
              -116.55,
              37.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "ECW",
        "kind": "restricted",
        "label": "ECW"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.2,
              37.45
            ],
            [
              -115.85,
              37.45
            ],
            [
              -115.85,
              37.7
            ],
            [
              -116.2,
              37.7
            ],
            [
              -116.2,
              37.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "COYA",
        "kind": "moa",
        "label": "COYA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.85,
              37.45
            ],
            [
              -115.5,
              37.45
            ],
            [
              -115.5,
              37.7
            ],
            [
              -115.85,
              37.7
            ],
            [
              -115.85,
              37.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "CALA",
        "kind": "moa",
        "label": "CALA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.5,
              37.45
            ],
            [
              -115.15,
              37.45
            ],
            [
              -115.15,
              37.7
            ],
            [
              -115.5,
              37.7
            ],
            [
              -115.5,
              37.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "CALB",
        "kind": "moa",
        "label": "CALB"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.15,
              37.45
            ],
            [
              -114.7,
              37.45
            ],
            [
              -114.7,
              37.7
            ],
            [
              -115.15,
              37.7
            ],
            [
              -115.15,
              37.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "CALC",
        "kind": "moa",
        "label": "CALC"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -114.7,
              37.45
            ],
            [
              -114.25,
              37.45
            ],
            [
              -114.25,
              37.7
            ],
            [
              -114.7,
              37.7
            ],
            [
              -114.7,
              37.45
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "71S",
        "kind": "restricted",
        "label": "71S"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -117.05,
              37.7
            ],
            [
              -116.55,
              37.7
            ],
            [
              -116.55,
              37.95
            ],
            [
              -117.05,
              37.95
            ],
            [
              -117.05,
              37.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "74B",
        "kind": "restricted",
        "label": "74B"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.55,
              37.7
            ],
            [
              -116.2,
              37.7
            ],
            [
              -116.2,
              37.95
            ],
            [
              -116.55,
              37.95
            ],
            [
              -116.55,
              37.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "ECE",
        "kind": "restricted",
        "label": "ECE"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.2,
              37.7
            ],
            [
              -115.85,
              37.7
            ],
            [
              -115.85,
              37.95
            ],
            [
              -116.2,
              37.95
            ],
            [
              -116.2,
              37.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "COYD",
        "kind": "moa",
        "label": "COYD"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.85,
              37.7
            ],
            [
              -115.5,
              37.7
            ],
            [
              -115.5,
              37.95
            ],
            [
              -115.85,
              37.95
            ],
            [
              -115.85,
              37.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "COYC",
        "kind": "moa",
        "label": "COYC"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.5,
              37.7
            ],
            [
              -115.15,
              37.7
            ],
            [
              -115.15,
              37.95
            ],
            [
              -115.5,
              37.95
            ],
            [
              -115.5,
              37.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "COYB",
        "kind": "moa",
        "label": "COYB"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.15,
              37.7
            ],
            [
              -114.7,
              37.7
            ],
            [
              -114.7,
              37.95
            ],
            [
              -115.15,
              37.95
            ],
            [
              -115.15,
              37.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "REV SOUTH",
        "kind": "moa",
        "label": "REV S"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -114.7,
              37.7
            ],
            [
              -113.9,
              37.7
            ],
            [
              -113.9,
              37.95
            ],
            [
              -114.7,
              37.95
            ],
            [
              -114.7,
              37.7
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "REV NORTH",
        "kind": "moa",
        "label": "REV N"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -117.05,
              37.95
            ],
            [
              -113.9,
              37.95
            ],
            [
              -113.9,
              38.15
            ],
            [
              -117.05,
              38.15
            ],
            [
              -117.05,
              37.95
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "R-4806E",
        "kind": "restricted",
        "label": "R-4806E"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.300833,
              37.283333
            ],
            [
              -115.184444,
              37.283333
            ],
            [
              -115.1175,
              37.2
            ],
            [
              -115.117778,
              36.8
            ],
            [
              -115.300833,
              36.633333
            ],
            [
              -115.300833,
              37.283333
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "R-4806W",
        "kind": "restricted",
        "label": "R-4806W"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.300833,
              37.283333
            ],
            [
              -115.300833,
              36.433333
            ],
            [
              -115.384167,
              36.433333
            ],
            [
              -115.6175,
              36.583333
            ],
            [
              -115.884167,
              36.583333
            ],
            [
              -115.934167,
              36.6
            ],
            [
              -115.934167,
              37.1
            ],
            [
              -115.584167,
              37.1
            ],
            [
              -115.584167,
              37.283333
            ],
            [
              -115.300833,
              37.283333
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "R-4807A",
        "kind": "restricted",
        "label": "R-4807A"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.559167,
              36.85
            ],
            [
              -117.075833,
              37.441667
            ],
            [
              -117.094722,
              37.55
            ],
            [
              -117.094722,
              37.883333
            ],
            [
              -116.9175,
              37.883333
            ],
            [
              -116.9175,
              37.783333
            ],
            [
              -116.7175,
              37.55
            ],
            [
              -116.434167,
              37.55
            ],
            [
              -116.434167,
              37.883333
            ],
            [
              -116.184167,
              37.883333
            ],
            [
              -116.184167,
              37.7
            ],
            [
              -115.884167,
              37.7
            ],
            [
              -115.884167,
              37.55
            ],
            [
              -115.800833,
              37.55
            ],
            [
              -115.800833,
              37.466667
            ],
            [
              -116.000833,
              37.466667
            ],
            [
              -116.000833,
              37.266667
            ],
            [
              -116.184167,
              37.266667
            ],
            [
              -116.184167,
              37.333333
            ],
            [
              -116.284167,
              37.383333
            ],
            [
              -116.3675,
              37.383333
            ],
            [
              -116.450833,
              37.35
            ],
            [
              -116.5675,
              37.35
            ],
            [
              -116.5175,
              37.266667
            ],
            [
              -116.450833,
              37.133333
            ],
            [
              -116.450833,
              36.916667
            ],
            [
              -116.559167,
              36.916667
            ],
            [
              -116.559167,
              36.85
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "R-4807B",
        "kind": "restricted",
        "label": "R-4807B"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.184167,
              37.266667
            ],
            [
              -116.5175,
              37.266667
            ],
            [
              -116.5675,
              37.35
            ],
            [
              -116.450833,
              37.35
            ],
            [
              -116.3675,
              37.383333
            ],
            [
              -116.284167,
              37.383333
            ],
            [
              -116.184167,
              37.333333
            ],
            [
              -116.184167,
              37.266667
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "R-4808S",
        "kind": "restricted",
        "label": "R-4808S"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.450833,
              36.766667
            ],
            [
              -116.250833,
              36.683333
            ],
            [
              -116.450833,
              36.683333
            ],
            [
              -116.450833,
              36.766667
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "R-4809",
        "kind": "restricted",
        "label": "R-4809"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -116.434167,
              37.883333
            ],
            [
              -116.434167,
              37.55
            ],
            [
              -116.7175,
              37.55
            ],
            [
              -116.9175,
              37.783333
            ],
            [
              -116.9175,
              37.883333
            ],
            [
              -116.434167,
              37.883333
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "R-4808A",
        "kind": "roz",
        "label": "4808A",
        "fill": true
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -115.934167,
              36.683333
            ],
            [
              -116.246667,
              36.683333
            ],
            [
              -116.4425,
              36.766667
            ],
            [
              -116.4425,
              36.85
            ],
            [
              -116.559167,
              36.85
            ],
            [
              -116.559167,
              36.916667
            ],
            [
              -116.450833,
              36.916667
            ],
            [
              -116.450833,
              37.133333
            ],
            [
              -116.5175,
              37.266667
            ],
            [
              -116.000833,
              37.266667
            ],
            [
              -116.000833,
              37.466667
            ],
            [
              -115.584167,
              37.466667
            ],
            [
              -115.584167,
              37.1
            ],
            [
              -115.934167,
              37.1
            ],
            [
              -115.934167,
              36.683333
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "SHELL AAR",
        "kind": "aar",
        "label": "SHELL AAR"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -114.4,
              37.516667
            ],
            [
              -114.683333,
              37.166667
            ],
            [
              -114.433333,
              37.033333
            ],
            [
              -114.15,
              37.383333
            ],
            [
              -114.4,
              37.516667
            ]
          ]
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "SHELL IP",
        "kind": "aar_point",
        "label": "IP"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [
          -114.4,
          37.116667
        ]
      }
    },
    {
      "type": "Feature",
      "properties": {
        "name": "SHELL CP",
        "kind": "aar_point",
        "label": "CP"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [
          -114.2,
          37.35
        ]
      }
    }
  ]
};
if (typeof window !== 'undefined') window.AirspaceLayer = AirspaceLayer;
