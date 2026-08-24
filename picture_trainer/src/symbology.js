/**
 * Symbology — bulls B/R tags on all tracks.
 */
class SymbologyRenderer {
    drawCoreMarker(ctx, track, selected) {
        const color = track.hostile ? '#ff3344' : '#33ff88';
        ctx.fillStyle = color;
        ctx.strokeStyle = selected ? '#ffffff' : color;
        ctx.lineWidth = selected ? 2.5 : 1.75;
        ctx.beginPath();
        if (track.hostile) {
            ctx.moveTo(0, -11);
            ctx.lineTo(11, 0);
            ctx.lineTo(0, 11);
            ctx.lineTo(-11, 0);
            ctx.closePath();
        } else {
            ctx.arc(0, 0, 9, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
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

    renderSymbol(ctx, track, x, y, selected, viewScale) {
        const inv = 1 / Math.max(viewScale, 0.35);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(inv, inv);
        const size = this.drawCoreMarker(ctx, track, selected);
        ctx.restore();
        return { width: size.width * inv, height: size.height * inv };
    }

    renderDataBlock(ctx, track, x, y, viewScale) {
        const inv = 1 / Math.max(viewScale, 0.35);
        const ox = 14;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(inv, inv);
        const color = track.hostile ? '#ff6677' : '#66ffaa';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(ox - 2, -18, 92, 38);
        ctx.fillStyle = color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(track.callsign, ox, -6);
        ctx.font = '9px monospace';
        const brg = Math.round(track.bearing).toString().padStart(3, '0');
        const rng = Math.round(track.range);
        ctx.fillText(`BULLS ${brg}/${rng}`, ox, 6);
        ctx.fillText(`${(track.altitude / 1000).toFixed(0)}k ft`, ox, 16);
        ctx.restore();
    }

    renderMotionTrail(ctx, track) {
        if (!track.history || track.history.length < 2) return;
        for (let i = 0; i < track.history.length; i++) {
            const p = track.history[i];
            const o = (i + 1) / track.history.length;
            ctx.fillStyle = track.hostile
                ? `rgba(255,50,50,${o * 0.5})`
                : `rgba(50,255,120,${o * 0.5})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
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
}

if (typeof window !== 'undefined') window.SymbologyRenderer = SymbologyRenderer;
