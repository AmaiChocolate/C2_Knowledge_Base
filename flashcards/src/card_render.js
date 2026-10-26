/**
 * Draws one flash card's scope as a still SVG string — no canvas, no animation loop.
 *
 * Positions on a card are nm east / north of BULLSEYE. Two views:
 *   'scope' — BULLSEYE, the friendly fighters and the raid together
 *   'raid'  — zoomed to the hostiles, close enough to count contacts
 * Symbols, tags and text stay a fixed pixel size; only distances scale.
 */
const CardRender = (function () {
    const COLORS = {
        bg: '#020a05',
        grid: 'rgba(0,140,70,0.22)',
        gridLabel: 'rgba(0,200,100,0.55)',
        bullseye: '#00ff66',
        axis: 'rgba(255,90,90,0.45)',
        hostile: '#ff3344',
        hostileTag: '#ff8090',
        friendly: '#33ff88',
        friendlyTag: '#80ffb8',
        tagBg: 'rgba(0,0,0,0.6)',
        measure: '#ffee55',
        given: '#5ad1ff',
        givenBg: 'rgba(0,16,28,0.85)'
    };
    const NICE_STEPS = [2, 5, 10, 20, 25, 50, 100];
    const TAG_W = 84;
    const TAG_H = 28;

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function fmt(x) {
        return Math.round(x * 10) / 10;
    }

    /** World (nm east / north) -> pixel transform that fits the chosen points. */
    function fitView(card, view, width, height) {
        const pts = card.tracks
            .filter(t => view === 'scope' || t.f === 'H')
            .flatMap(t => [[t.e, t.n]].concat(t.tr || []));
        if (view === 'scope') pts.push([0, 0]);
        let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
        pts.forEach(([e, n]) => {
            minE = Math.min(minE, e); maxE = Math.max(maxE, e);
            minN = Math.min(minN, n); maxN = Math.max(maxN, n);
        });
        // A raid view never zooms in past ~30 nm across, so spacing still reads true.
        const minSpan = view === 'raid' ? 30 : 60;
        const spanE = Math.max(maxE - minE, minSpan);
        const spanN = Math.max(maxN - minN, minSpan);
        const pad = view === 'raid' ? 70 : 60;
        const scale = Math.min((width - 2 * pad - TAG_W) / spanE, (height - 2 * pad) / spanN);
        return {
            scale,
            ce: (minE + maxE) / 2,
            cn: (minN + maxN) / 2,
            cx: (width - TAG_W) / 2 + 10,
            cy: height / 2,
            width,
            height
        };
    }

    function toPx(v, e, n) {
        return { x: v.cx + (e - v.ce) * v.scale, y: v.cy - (n - v.cn) * v.scale };
    }

    function toWorld(v, x, y) {
        return { e: v.ce + (x - v.cx) / v.scale, n: v.cn - (y - v.cy) / v.scale };
    }

    function gridStep(scale) {
        return NICE_STEPS.find(s => s * scale >= 45) || 100;
    }

    function drawGrid(v) {
        const step = gridStep(v.scale);
        const tl = toWorld(v, 0, 0);
        const br = toWorld(v, v.width, v.height);
        const out = [];
        for (let e = Math.ceil(tl.e / step) * step; e <= br.e; e += step) {
            const x = fmt(toPx(v, e, 0).x);
            out.push(`<line x1="${x}" y1="0" x2="${x}" y2="${v.height}"/>`);
        }
        for (let n = Math.ceil(br.n / step) * step; n <= tl.n; n += step) {
            const y = fmt(toPx(v, 0, n).y);
            out.push(`<line x1="0" y1="${y}" x2="${v.width}" y2="${y}"/>`);
        }
        return `<g stroke="${COLORS.grid}" stroke-width="1">${out.join('')}</g>`;
    }

    function drawScaleBar(v) {
        const step = gridStep(v.scale);
        const len = fmt(step * v.scale);
        const x = v.width - 20 - len;
        const y = v.height - 18;
        return `<g stroke="${COLORS.gridLabel}" fill="${COLORS.gridLabel}" font-size="11">`
            + `<path d="M${x} ${y - 5}V${y}H${x + len}V${y - 5}" fill="none" stroke-width="1.5"/>`
            + `<text x="${x + len / 2}" y="${y - 8}" text-anchor="middle" stroke="none">${step} NM grid</text></g>`;
    }

    function drawNorthArrow(v) {
        const x = 26;
        const y = 34;
        return `<g fill="${COLORS.gridLabel}" stroke="${COLORS.gridLabel}">`
            + `<path d="M${x} ${y - 16}l-6 14h12z" stroke="none"/>`
            + `<line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + 8}" stroke-width="1.5"/>`
            + `<text x="${x}" y="${y + 22}" text-anchor="middle" font-size="11" stroke="none">N</text></g>`;
    }

    function drawThreatAxis(v, card) {
        const rad = card.axis * Math.PI / 180;
        const a = toPx(v, 0, 0);
        const b = toPx(v, 400 * Math.sin(rad), 400 * Math.cos(rad));
        return `<line x1="${fmt(a.x)}" y1="${fmt(a.y)}" x2="${fmt(b.x)}" y2="${fmt(b.y)}" stroke="${COLORS.axis}" stroke-width="1.2" stroke-dasharray="8 8"/>`;
    }

    function drawBullseye(v) {
        const p = toPx(v, 0, 0);
        if (p.x < -20 || p.y < -20 || p.x > v.width + 20 || p.y > v.height + 20) return '';
        const x = fmt(p.x);
        const y = fmt(p.y);
        return `<g stroke="${COLORS.bullseye}" fill="none" stroke-width="1.5">`
            + `<circle cx="${x}" cy="${y}" r="9"/><circle cx="${x}" cy="${y}" r="3" fill="${COLORS.bullseye}"/>`
            + `<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}"/><line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y + 14}"/>`
            + `<text x="${x}" y="${y - 18}" text-anchor="middle" fill="${COLORS.bullseye}" stroke="none" font-size="11" font-weight="bold">BULLSEYE</text></g>`;
    }

    function symbolPath(t) {
        return t.f === 'H' ? 'M0 -6L6 0L0 6L-6 0Z' : 'M5 0A5 5 0 1 1 -5 0A5 5 0 1 1 5 0Z';
    }

    function drawTrail(v, t) {
        if (!t.tr) return '';
        const color = t.f === 'H' ? COLORS.hostile : COLORS.friendly;
        return t.tr.map((pt, i) => {
            const p = toPx(v, pt[0], pt[1]);
            const o = fmt(0.2 + 0.5 * (i + 1) / t.tr.length);
            return `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="2" fill="${color}" fill-opacity="${o}"/>`;
        }).join('');
    }

    function drawSymbol(v, t) {
        const p = toPx(v, t.e, t.n);
        const color = t.f === 'H' ? COLORS.hostile : COLORS.friendly;
        return `<g transform="translate(${fmt(p.x)} ${fmt(p.y)})" fill="${color}" stroke="${color}" stroke-width="1.25">`
            + `<path d="${symbolPath(t)}"/>`
            + `<g transform="rotate(${t.h - 90})" fill="none"><path d="M0 0H15M11 -3L15 0L11 3"/></g></g>`;
    }

    function overlaps(a, b) {
        return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    }

    /** Leads' tags, nudged so a tight formation does not stack them on top of each other. */
    function drawTags(v, leads, symbols) {
        const placed = [];
        const out = [];
        leads.forEach(t => {
            const p = toPx(v, t.e, t.n);
            if (p.x < 0 || p.y < 0 || p.x > v.width || p.y > v.height) return;
            const tries = [[12, -18], [-12 - TAG_W, -18], [12, 6], [-12 - TAG_W, 6], [12, -42], [-12 - TAG_W, -42], [12, 30], [-12 - TAG_W, 30]];
            let box = null;
            for (const [dx, dy] of tries) {
                const b = { x: p.x + dx, y: p.y + dy, w: TAG_W, h: TAG_H };
                if (b.x < 2 || b.x + b.w > v.width - 2 || b.y < 2 || b.y + b.h > v.height - 2) continue;
                if (!placed.some(o => overlaps(o, b)) && !symbols.some(s => overlaps(s, b))) {
                    box = b;
                    break;
                }
            }
            if (!box) box = { x: Math.min(p.x + 12, v.width - TAG_W - 2), y: Math.max(p.y - 18, 2), w: TAG_W, h: TAG_H };
            placed.push(box);
            const color = t.f === 'H' ? COLORS.hostileTag : COLORS.friendlyTag;
            const x = fmt(box.x);
            const y = fmt(box.y);
            const leader = (box.x > p.x ? box.x : box.x + TAG_W);
            out.push(`<line x1="${fmt(p.x)}" y1="${fmt(p.y)}" x2="${fmt(leader)}" y2="${fmt(box.y + TAG_H / 2)}" stroke="${color}" stroke-opacity="0.35"/>`
                + `<rect x="${x}" y="${y}" width="${TAG_W}" height="${TAG_H}" fill="${COLORS.tagBg}"/>`
                + `<text x="${x + 4}" y="${y + 12}" fill="${color}" font-size="11" font-weight="bold">${esc(t.c)}</text>`
                + `<text x="${x + 4}" y="${y + 24}" fill="${color}" font-size="10">${esc(t.b)}  ${t.a}k</text>`);
        });
        return out.join('');
    }

    function labelBox(v, l) {
        const pa = toPx(v, l.a[0], l.a[1]);
        const pb = toPx(v, l.b[0], l.b[1]);
        const w = l.t.length * 7 + 8;
        return { x: (pa.x + pb.x) / 2 - w / 2, y: (pa.y + pb.y) / 2 - 9, w, h: 16 };
    }

    /** A dimension line with end ticks and its value in a box at the middle. */
    function drawDimension(v, l) {
        const pa = toPx(v, l.a[0], l.a[1]);
        const pb = toPx(v, l.b[0], l.b[1]);
        const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
        const nx = -(pb.y - pa.y) / len * 5;
        const ny = (pb.x - pa.x) / len * 5;
        const tick = p => `<line x1="${fmt(p.x - nx)}" y1="${fmt(p.y - ny)}" x2="${fmt(p.x + nx)}" y2="${fmt(p.y + ny)}"/>`;
        let out = `<g stroke="${COLORS.given}" stroke-width="1.4">`
            + `<line x1="${fmt(pa.x)}" y1="${fmt(pa.y)}" x2="${fmt(pb.x)}" y2="${fmt(pb.y)}"/>${tick(pa)}${tick(pb)}</g>`;
        if (l.t) {
            const w = l.t.length * 7 + 8;
            const mx = (pa.x + pb.x) / 2;
            const my = (pa.y + pb.y) / 2;
            out += `<rect x="${fmt(mx - w / 2)}" y="${fmt(my - 9)}" width="${w}" height="16" rx="3" fill="${COLORS.givenBg}" stroke="${COLORS.given}" stroke-width="0.8"/>`
                + `<text x="${fmt(mx)}" y="${fmt(my + 3)}" text-anchor="middle" fill="${COLORS.given}" font-size="11" font-weight="bold">${esc(l.t)}</text>`;
        }
        return out;
    }

    /** BRAA lines are unlabeled (they would pile up at the fighters); the readout box carries the numbers. */
    function drawRay(v, l) {
        const pa = toPx(v, l.a[0], l.a[1]);
        const pb = toPx(v, l.b[0], l.b[1]);
        return `<line x1="${fmt(pa.x)}" y1="${fmt(pa.y)}" x2="${fmt(pb.x)}" y2="${fmt(pb.y)}" stroke="${COLORS.given}" stroke-opacity="0.55" stroke-width="1.2" stroke-dasharray="6 4"/>`;
    }

    /** The readout sits in whichever corner covers the fewest tracks (bottom-right holds the scale bar). */
    function readoutBox(v, ms, symbols) {
        if (!ms || !ms.rows || !ms.rows.length) return null;
        const lines = [ms.title].concat(ms.rows);
        const w = Math.max(...lines.map(t => t.length)) * 6.8 + 16;
        const h = lines.length * 15 + 10;
        const corners = [[v.width - w - 8, 8], [v.width - w - 8, v.height - h - 40], [8, v.height - h - 8], [50, 8]];
        let best = null;
        corners.forEach(([x, y]) => {
            const box = { x, y, w, h };
            const hits = symbols.filter(sb => overlaps(sb, box)).length;
            if (!best || hits < best.hits) best = { box, hits };
        });
        return Object.assign(best.box, { lines });
    }

    function drawReadout(box) {
        if (!box) return '';
        const { x, y, w, h, lines } = box;
        return `<g font-size="11"><rect x="${fmt(x)}" y="${y}" width="${fmt(w)}" height="${h}" rx="4" fill="${COLORS.givenBg}" stroke="${COLORS.given}" stroke-width="0.8"/>`
            + lines.map((t, i) => `<text x="${fmt(x + 8)}" y="${y + 18 + i * 15}" fill="${COLORS.given}" xml:space="preserve"${i === 0 ? ' font-weight="bold"' : ''}>${esc(t)}</text>`).join('')
            + '</g>';
    }

    /**
     * opts.measurements (default true) draws the card's given measurements.
     * @returns {{ svg: string, view: object }} — `view` maps pixels back to nm for the measure tool.
     */
    function render(card, opts = {}) {
        const width = opts.width || 800;
        const height = opts.height || 560;
        const viewName = opts.view === 'raid' ? 'raid' : 'scope';
        const v = fitView(card, viewName, width, height);
        // Leads carry tags; a wingman does only when the card names it (a BRAA call to RAPTOR12).
        const leads = card.tracks.filter(t => !t.w || t.c);
        const symbols = card.tracks.map(t => {
            const p = toPx(v, t.e, t.n);
            return { x: p.x - 7, y: p.y - 7, w: 14, h: 14 };
        });
        const given = opts.measurements !== false && !!card.ms;
        const dims = given ? card.ms.lines.filter(l => l.t) : [];
        const readout = given ? readoutBox(v, card.ms, symbols) : null;
        const givenBoxes = dims.map(l => labelBox(v, l)).concat(readout ? [readout] : []);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" `
            + `font-family="Consolas, 'Courier New', monospace" role="img" aria-label="Scope snapshot">`
            + `<rect width="${width}" height="${height}" fill="${COLORS.bg}"/>`
            + drawGrid(v)
            + drawThreatAxis(v, card)
            + drawBullseye(v)
            + (given ? card.ms.lines.filter(l => !l.t).map(l => drawRay(v, l)).join('') : '')
            + card.tracks.map(t => drawTrail(v, t)).join('')
            + card.tracks.map(t => drawSymbol(v, t)).join('')
            + (opts.tags === false ? '' : drawTags(v, leads, symbols.concat(given ? givenBoxes : [])))
            + (given ? dims.map(l => drawDimension(v, l)).join('') + drawReadout(readout) : '')
            + drawNorthArrow(v)
            + drawScaleBar(v)
            + '<g class="measure-layer"></g>'
            + '</svg>';
        return { svg, view: v };
    }

    /** Bearing / range between two world points, as the scope's measure tool reads it. */
    function measure(a, b) {
        const de = b.e - a.e;
        const dn = b.n - a.n;
        const range = Math.hypot(de, dn);
        const bearing = (Math.round(Math.atan2(de, dn) * 180 / Math.PI) + 360) % 360;
        return { bearing, range };
    }

    function measureSvg(v, a, b) {
        const pa = toPx(v, a.e, a.n);
        const pb = toPx(v, b.e, b.n);
        const m = measure(a, b);
        const label = `${String(m.bearing).padStart(3, '0')}° / ${m.range.toFixed(1)} NM`;
        const lx = Math.min(pb.x + 10, v.width - 130);
        const ly = Math.max(pb.y - 8, 16);
        return `<line x1="${fmt(pa.x)}" y1="${fmt(pa.y)}" x2="${fmt(pb.x)}" y2="${fmt(pb.y)}" stroke="${COLORS.measure}" stroke-width="1.5" stroke-dasharray="5 4"/>`
            + `<circle cx="${fmt(pa.x)}" cy="${fmt(pa.y)}" r="3" fill="${COLORS.measure}"/>`
            + `<rect x="${fmt(lx - 4)}" y="${fmt(ly - 13)}" width="124" height="18" fill="rgba(0,0,0,0.75)"/>`
            + `<text x="${fmt(lx)}" y="${fmt(ly)}" fill="${COLORS.measure}" font-size="12" font-weight="bold">${label}</text>`;
    }

    function pointSvg(v, a) {
        const p = toPx(v, a.e, a.n);
        return `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="4" fill="none" stroke="${COLORS.measure}" stroke-width="1.5"/>`;
    }

    return { render, toWorld, measure, measureSvg, pointSvg };
})();

if (typeof module !== 'undefined') module.exports = CardRender;
