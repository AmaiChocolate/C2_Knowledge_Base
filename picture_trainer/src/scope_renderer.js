/**
 * Picture Trainer scope — render, pan/zoom, measure (no BVR sim).
 */
class ScopeRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.bullseye = { x: 400, y: 400 };
        this.scale = 2;
        this.tracks = [];
        this.viewScale = 1;
        this.viewOffset = { x: 0, y: 0 };
        this.orientation = 'EW';
        this.showGrid = true;
        this.showTrail = false;
        this.showPlots = false;
        this.symbology = new SymbologyRenderer();
        this.measureModeActive = false;
        this.isDraggingMeasure = false;
        this.measurementStart = null;
        this.mousePos = { x: 0, y: 0 };
        this.selectedTrack = null;
        this.lastFrame = performance.now();
        this.anim = null;
        this.bindPointer();
        requestAnimationFrame(() => this.loop());
    }

    setAnimationEngine(anim) {
        this.anim = anim;
    }

    bindPointer() {
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const pos = this.getMousePos(e);
            this.setZoomAt(pos.x, pos.y, this.viewScale * (e.deltaY < 0 ? 1.12 : 0.88));
        }, { passive: false });
        this.canvas.addEventListener('mousedown', (e) => {
            const pos = this.getMousePos(e);
            if (this.measureModeActive && e.button === 0) {
                this.isDraggingMeasure = true;
                this.measurementStart = this.xyToBearingRange(pos.x, pos.y);
                return;
            }
            if (e.button === 0 || e.button === 1) {
                this._panning = true;
                this._panStart = { x: e.clientX, y: e.clientY, ox: this.viewOffset.x, oy: this.viewOffset.y };
            }
        });
        window.addEventListener('mousemove', (e) => {
            this.mousePos = this.getMousePos(e);
            if (this._panning && this._panStart) {
                const sx = this.canvas.clientWidth / this.canvas.width;
                const sy = this.canvas.clientHeight / this.canvas.height;
                this.viewOffset.x = this._panStart.ox + (e.clientX - this._panStart.x) / sx;
                this.viewOffset.y = this._panStart.oy + (e.clientY - this._panStart.y) / sy;
            }
        });
        window.addEventListener('mouseup', () => {
            this._panning = false;
            this.isDraggingMeasure = false;
        });
        this.canvas.addEventListener('click', (e) => {
            if (this.measureModeActive) return;
            const pos = this.getMousePos(e);
            const hit = this.hitTest(pos.x, pos.y);
            this.selectedTrack = hit;
            if (window.onTrackSelected) window.onTrackSelected(hit);
        });
    }

    getMousePos(e) {
        const r = this.canvas.getBoundingClientRect();
        const sx = this.canvas.width / r.width;
        const sy = this.canvas.height / r.height;
        const cx = (e.clientX - r.left) * sx;
        const cy = (e.clientY - r.top) * sy;
        return {
            x: (cx - this.viewOffset.x) / this.viewScale,
            y: (cy - this.viewOffset.y) / this.viewScale
        };
    }

    setZoomAt(sx, sy, newScale) {
        newScale = Math.max(0.35, Math.min(8, newScale));
        const old = this.viewScale;
        this.viewOffset.x = sx - (sx - this.viewOffset.x) * (newScale / old);
        this.viewOffset.y = sy - (sy - this.viewOffset.y) * (newScale / old);
        this.viewScale = newScale;
    }

    resetView() {
        this.viewScale = 1;
        this.viewOffset = { x: 0, y: 0 };
    }

    bearingRangeToXY(bearing, range) {
        const rad = (bearing - 90) * Math.PI / 180;
        return {
            x: this.bullseye.x + range * this.scale * Math.cos(rad),
            y: this.bullseye.y + range * this.scale * Math.sin(rad)
        };
    }

    xyToBearingRange(x, y) {
        const dx = x - this.bullseye.x;
        const dy = y - this.bullseye.y;
        const range = Math.sqrt(dx * dx + dy * dy) / this.scale;
        let bearing = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        if (bearing < 0) bearing += 360;
        return { bearing, range };
    }

    hitTest(wx, wy) {
        const slop = 18 / Math.max(this.viewScale, 0.5);
        for (let i = this.tracks.length - 1; i >= 0; i--) {
            const t = this.tracks[i];
            const p = this.bearingRangeToXY(t.bearing, t.range);
            if (Math.hypot(p.x - wx, p.y - wy) <= slop) return t;
        }
        return null;
    }

    loop() {
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
        this.lastFrame = now;
        if (this.anim) this.anim.update(dt);
        this.render();
        requestAnimationFrame(() => this.loop());
    }

    render() {
        const ctx = this.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const g = ctx.createRadialGradient(400, 400, 40, 400, 400, 500);
        g.addColorStop(0, '#041208');
        g.addColorStop(1, '#010302');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(this.viewOffset.x, this.viewOffset.y);
        ctx.scale(this.viewScale, this.viewScale);

        this.drawBackdrop();
        if (this.showGrid) this.drawGrid();
        this.drawRangeRings();
        this.drawBearingTicks();
        this.drawThreatAxis();
        this.drawBullseye();
        this.drawTracks();
        this.drawMeasurement();
        ctx.restore();
    }

    drawBackdrop() {
        const grd = this.ctx.createRadialGradient(
            this.bullseye.x, this.bullseye.y, 20,
            this.bullseye.x, this.bullseye.y, 420
        );
        grd.addColorStop(0, 'rgba(0,40,18,0.35)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        this.ctx.fillStyle = grd;
        this.ctx.beginPath();
        this.ctx.arc(this.bullseye.x, this.bullseye.y, 420, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0,80,40,0.2)';
        this.ctx.lineWidth = 0.5 / Math.max(this.viewScale, 0.5);
        for (let x = 0; x <= 800; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, 800);
            this.ctx.stroke();
        }
        for (let y = 0; y <= 800; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(800, y);
            this.ctx.stroke();
        }
    }

    drawRangeRings() {
        const rings = [25, 50, 75, 100, 125];
        this.ctx.setLineDash([4, 6]);
        rings.forEach(nm => {
            this.ctx.strokeStyle = 'rgba(0,160,80,0.35)';
            this.ctx.lineWidth = 1 / Math.max(this.viewScale, 0.5);
            this.ctx.beginPath();
            this.ctx.arc(this.bullseye.x, this.bullseye.y, nm * this.scale, 0, Math.PI * 2);
            this.ctx.stroke();
        });
        this.ctx.setLineDash([]);
    }

    drawBearingTicks() {
        const maxR = 250;
        this.ctx.strokeStyle = 'rgba(0,180,90,0.5)';
        this.ctx.fillStyle = 'rgba(0,220,110,0.85)';
        this.ctx.font = `${10 / Math.max(this.viewScale, 0.7)}px monospace`;
        this.ctx.textAlign = 'center';
        for (let brg = 0; brg < 360; brg += 30) {
            const rad = (brg - 90) * Math.PI / 180;
            const x0 = this.bullseye.x + (maxR - 8) * Math.cos(rad);
            const y0 = this.bullseye.y + (maxR - 8) * Math.sin(rad);
            const x1 = this.bullseye.x + maxR * Math.cos(rad);
            const y1 = this.bullseye.y + maxR * Math.sin(rad);
            this.ctx.lineWidth = (brg % 90 === 0 ? 1.5 : 1) / Math.max(this.viewScale, 0.5);
            this.ctx.beginPath();
            this.ctx.moveTo(x0, y0);
            this.ctx.lineTo(x1, y1);
            this.ctx.stroke();
            if (brg % 90 === 0) {
                const lx = this.bullseye.x + (maxR + 12) * Math.cos(rad);
                const ly = this.bullseye.y + (maxR + 12) * Math.sin(rad);
                this.ctx.fillText(brg === 0 ? 'N' : String(brg).padStart(3, '0'), lx, ly);
            }
        }
    }

    drawThreatAxis() {
        const o = getOrientation(this.orientation);
        const rad = (o.threatBearingCenter - 90) * Math.PI / 180;
        this.ctx.strokeStyle = 'rgba(255,80,80,0.4)';
        this.ctx.lineWidth = 1.2 / Math.max(this.viewScale, 0.5);
        this.ctx.setLineDash([8, 8]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.bullseye.x, this.bullseye.y);
        this.ctx.lineTo(
            this.bullseye.x + 280 * Math.cos(rad),
            this.bullseye.y + 280 * Math.sin(rad)
        );
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        const inv = 1 / Math.max(this.viewScale, 0.5);
        this.ctx.fillStyle = 'rgba(255,100,100,0.8)';
        this.ctx.font = `${9 * inv}px monospace`;
        this.ctx.fillText('THREAT AXIS', this.bullseye.x + 60 * inv, this.bullseye.y - 20 * inv);
    }

    drawBullseye() {
        const inv = 1 / Math.max(this.viewScale, 0.5);
        this.ctx.strokeStyle = '#00ff66';
        this.ctx.fillStyle = '#00ff66';
        this.ctx.lineWidth = 1.5 * inv;
        this.ctx.beginPath();
        this.ctx.arc(this.bullseye.x, this.bullseye.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.font = `bold ${10 * inv}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText('BULLSEYE', this.bullseye.x, this.bullseye.y - 12 * inv);
    }

    drawTracks() {
        this.tracks.forEach(track => {
            const pos = this.bearingRangeToXY(track.bearing, track.range);
            if (this.showTrail) this.symbology.renderMotionTrail(this.ctx, track);
            if (this.showPlots) this.symbology.renderRadarPlots(this.ctx, track);
            const sel = this.selectedTrack && String(this.selectedTrack.id) === String(track.id);
            const symbolSize = this.symbology.renderSymbol(this.ctx, track, pos.x, pos.y, sel, this.viewScale);
            this.symbology.renderDataBlock(this.ctx, track, pos.x, pos.y, symbolSize.width, this.viewScale);
        });
    }

    drawMeasurement() {
        if (!this.measureModeActive || !this.isDraggingMeasure || !this.measurementStart) return;
        const start = this.bearingRangeToXY(this.measurementStart.bearing, this.measurementStart.range);
        const end = this.mousePos;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const range = Math.sqrt(dx * dx + dy * dy) / this.scale;
        let bearing = Math.round((Math.atan2(dx, start.y - end.y) * 180 / Math.PI + 360) % 360);
        let color = '#00ff00';
        if (range < 15) color = '#ff0000';
        else if (range < 45) color = '#ffff00';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        const label = `${String(bearing).padStart(3, '0')}° / ${range.toFixed(1)} NM`;
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(end.x + 8, end.y + 4, 100, 18);
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 11px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(label, end.x + 12, end.y + 17);
    }
}

if (typeof window !== 'undefined') window.ScopeRenderer = ScopeRenderer;
