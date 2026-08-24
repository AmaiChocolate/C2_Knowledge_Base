/**
 * Symbology — aligned with BC3 Scope Trainer (milsymbol optional polish)
 */

class SymbologyRenderer {
    constructor() {
        this.useMilsymbol = typeof ms !== 'undefined';
        this.symbolCache = new Map();
    }

    getLetterSIDC(track) {
        const host = track.hostile ? 'H' : (track.affiliation === 'unknown' ? 'U' : 'F');
        return `S${host}APMF------`;
    }

    /** Core marker always drawn so tracks never disappear */
    drawCoreMarker(ctx, track, selected) {
        const color = track.hostile ? '#ff3344' : (track.affiliation === 'unknown' || track.declaration === 'BOGEY' ? '#ffee33' : '#33ff88');
        ctx.fillStyle = color;
        ctx.strokeStyle = selected ? '#ffffff' : color;
        ctx.lineWidth = selected ? 2.5 : 1.75;

        ctx.beginPath();
        if (track.hostile || track.declaration === 'BANDIT' || track.declaration === 'HOSTILE') {
            // Hostile/Bandit: diamond (standard air picture cue)
            ctx.moveTo(0, -11);
            ctx.lineTo(11, 0);
            ctx.lineTo(0, 11);
            ctx.lineTo(-11, 0);
            ctx.closePath();
        } else if (track.affiliation === 'unknown' || track.declaration === 'BOGEY') {
            // Bogey: triangle
            ctx.moveTo(0, -10);
            ctx.lineTo(10, 10);
            ctx.lineTo(-10, 10);
            ctx.closePath();
        } else if (track.type === 'tanker' || track.type === 'isr' || track.type === 'awacs') {
            // HVAA: rectangle
            ctx.rect(-9, -7, 18, 14);
        } else {
            // Friend fighter: circle
            ctx.arc(0, 0, 9, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();

        // Heading tick
        if (track.heading !== undefined) {
            ctx.save();
            ctx.rotate((track.heading - 90) * Math.PI / 180);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(22, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(16, -4);
            ctx.lineTo(22, 0);
            ctx.lineTo(16, 4);
            ctx.stroke();
            ctx.restore();
        }

        return { width: 28, height: 28 };
    }

    renderSymbol(ctx, track, x, y, selected = false, viewScale = 1.0) {
        const invScale = 1 / Math.max(viewScale, 0.35);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(invScale, invScale);

        let isFlashing = false;
        if (track.isThreat && !track.isTargeted) {
            isFlashing = Math.floor(Date.now() / 250) % 2 === 0;
        }

        let size = { width: 28, height: 28 };
        if (!isFlashing) {
            size = this.drawCoreMarker(ctx, track, selected);

            // Optional milsymbol ghost behind/over if available (non-fatal)
            if (this.useMilsymbol) {
                try {
                    const sidc = this.getLetterSIDC(track);
                    const cacheKey = sidc + (selected ? 's' : '');
                    if (!this.symbolCache.has(cacheKey)) {
                        this.symbolCache.set(cacheKey, new ms.Symbol(sidc, { size: 26, fill: true, frame: true }));
                    }
                    const canvas = this.symbolCache.get(cacheKey).asCanvas();
                    ctx.globalAlpha = 0.35;
                    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
                    ctx.globalAlpha = 1;
                } catch (_) { /* ignore */ }
            }
        }

        if (selected) {
            ctx.strokeStyle = '#ffff66';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (track.stale) {
            ctx.fillStyle = 'rgba(255,220,0,0.85)';
            ctx.font = '9px monospace';
            ctx.fillText('STALE', 12, -14);
        }

        ctx.restore();
        return { width: size.width * invScale, height: size.height * invScale };
    }

    renderDataBlock(ctx, track, x, y, symbolWidth, viewScale = 1.0) {
        const invScale = 1 / Math.max(viewScale, 0.35);
        const offsetX = 14;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(invScale, invScale);

        const color = track.hostile ? '#ff6677' : '#66ffaa';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(offsetX - 2, -16, 78, 34);

        ctx.fillStyle = color;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(track.callsign, offsetX, -5);

        const alt = `${(track.altitude / 1000).toFixed(0)}`;
        const bulls = `${Math.round(track.bearing)}/${Math.round(track.range)}`;
        ctx.font = '10px monospace';
        ctx.fillText(`${bulls}  ${alt}k`, offsetX, 8);

        ctx.restore();
    }

    renderMotionTrail(ctx, track) {
        if (!track.history || track.history.length < 2) return;
        for (let i = 0; i < track.history.length; i++) {
            const pos = track.history[i];
            const opacity = (i + 1) / track.history.length;
            ctx.fillStyle = track.hostile
                ? `rgba(255,50,50,${opacity * 0.55})`
                : `rgba(50,255,120,${opacity * 0.55})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderRadarPlots(ctx, track) {
        if (!track.radarPlots) return;
        track.radarPlots.forEach((p, i) => {
            const o = 0.3 + (i / track.radarPlots.length) * 0.5;
            ctx.fillStyle = track.hostile
                ? `rgba(255,200,80,${o})`
                : `rgba(120,255,180,${o})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    static getTrackType(classification) {
        const types = {
            FIGHTER: 'fighter', BOMBER: 'bomber', TANKER: 'tanker',
            ISR: 'isr', AWACS: 'awacs', SAM: 'sam', UNKNOWN: 'fighter'
        };
        return types[classification] || 'fighter';
    }
}

if (typeof window !== 'undefined') window.SymbologyRenderer = SymbologyRenderer;
