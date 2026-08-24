/**
 * Build simulator/geo/nttr_airspace.json from NTTR Figure A.3-1 layout.
 * Restricted rings: published FAA DMS (true nm). MOA/sector tiles: non-overlapping
 * jigsaw matching chart names (training-accurate vs sheet, not a legal FLIP).
 * Scale bar on chart ~140–160 mi E–W ≈ 120–140 nm — envelope sized to R-areas + MOA.
 * Fill: R-4808A / R-4808N square ROZ only.
 */
const fs = require('fs');
const path = require('path');

function parseCompact(p) {
  const m = p.match(/^([NS])(\d{2})(\d{2})(\d{2})\s+([EW])(\d{3})(\d{2})(\d{2})$/i);
  if (!m) throw new Error('bad compact: ' + p);
  let lat = (+m[2]) + (+m[3]) / 60 + (+m[4]) / 3600;
  if (m[1].toUpperCase() === 'S') lat = -lat;
  let lon = (+m[6]) + (+m[7]) / 60 + (+m[8]) / 3600;
  if (m[5].toUpperCase() === 'W') lon = -lon;
  return [+lon.toFixed(6), +lat.toFixed(6)];
}

function parseSheet(s) {
  const m = s.match(/([NS])\s*(\d+)\s+(\d+)\s+([EW])\s*(\d+)\s+(\d+)/i);
  if (!m) throw new Error('bad sheet: ' + s);
  let lat = +m[2] + +m[3] / 60;
  if (m[1].toUpperCase() === 'S') lat = -lat;
  let lon = +m[5] + +m[6] / 60;
  if (m[4].toUpperCase() === 'W') lon = -lon;
  return [+lon.toFixed(6), +lat.toFixed(6)];
}

function close(ring) {
  const r = ring.slice();
  const a = r[0], b = r[r.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) r.push([a[0], a[1]]);
  return r;
}

/** Inclusive W/S, exclusive E/N — shared edges, zero area overlap */
function cell(w, s, e, n) {
  return close([[w, s], [e, s], [e, n], [w, n]]);
}

function feat(name, kind, geometry, extra = {}) {
  return {
    type: 'Feature',
    properties: { name, kind, label: extra.label != null ? extra.label : name, ...extra },
    geometry
  };
}

function point(coord) {
  return { type: 'Point', coordinates: coord };
}

function ringFrom(points) {
  return close(points.map(parseCompact));
}

// --- Published restricted rings (authoritative nm) ---
const R4806E = ringFrom([
  'N371700 W1151803', 'N371700 W1151104', 'N371200 W1150703',
  'N364800 W1150704', 'N363800 W1151803'
]);
const R4806W = ringFrom([
  'N371700 W1151803', 'N362600 W1151803', 'N362600 W1152303', 'N363500 W1153703',
  'N363500 W1155303', 'N363600 W1155603', 'N370600 W1155603', 'N370600 W1153503',
  'N371700 W1153503'
]);
const R4807A = ringFrom([
  'N365100 W1163333', 'N372630 W1170433', 'N373300 W1170541', 'N375300 W1170541',
  'N375300 W1165503', 'N374700 W1165503', 'N373300 W1164303', 'N373300 W1162603',
  'N375300 W1162603', 'N375300 W1161103', 'N374200 W1161103', 'N374200 W1155303',
  'N373300 W1155303', 'N373300 W1154803', 'N372800 W1154803', 'N372800 W1160003',
  'N371600 W1160003', 'N371600 W1161103', 'N372000 W1161103', 'N372300 W1161703',
  'N372300 W1162203', 'N372100 W1162703', 'N372100 W1163403', 'N371600 W1163103',
  'N370800 W1162703', 'N365500 W1162703', 'N365500 W1163333'
]);
const R4807B = ringFrom([
  'N371600 W1161103', 'N371600 W1163103', 'N372100 W1163403', 'N372100 W1162703',
  'N372300 W1162203', 'N372300 W1161703', 'N372000 W1161103'
]);
const R4808N = ringFrom([
  'N364100 W1155603', 'N364100 W1161448', 'N364600 W1162633', 'N365100 W1162633',
  'N365100 W1163333', 'N365500 W1163333', 'N365500 W1162703', 'N370800 W1162703',
  'N371600 W1163103', 'N371600 W1160003', 'N372800 W1160003', 'N372800 W1153503',
  'N370600 W1153503', 'N370600 W1155603'
]);
const R4808S = ringFrom([
  'N364600 W1162703', 'N364100 W1161503', 'N364100 W1162703'
]);
const R4809 = ringFrom([
  'N375300 W1162603', 'N373300 W1162603', 'N373300 W1164303',
  'N374700 W1165503', 'N375300 W1165503'
]);

const shellIP = parseSheet('N37 07 W114 24');
const shellCP = parseSheet('N37 21 W114 12');
const shellPoly = close([
  parseSheet('N37 31 W114 24'),
  parseSheet('N37 10 W114 41'),
  parseSheet('N37 02 W114 26'),
  parseSheet('N37 23 W114 09')
]);

/**
 * Figure A.3-1 style jigsaw (lon/lat cuts). Half-open cells — no area overlaps.
 * Anchored to R-area lon grids (~117 / 116 / 115) and chart topology.
 *
 *   LON: 0:-117.05 1:-116.55 2:-116.20 3:-115.85 4:-115.50 5:-115.15 6:-114.70 7:-114.25 8:-113.90
 *   LAT: 0:36.45 1:36.70 2:36.95 3:37.20 4:37.45 5:37.70 6:37.95 7:38.15
 */
const LON = [-117.05, -116.55, -116.20, -115.85, -115.50, -115.15, -114.70, -114.25, -113.90];
const LAT = [36.45, 36.70, 36.95, 37.20, 37.45, 37.70, 37.95, 38.15];

/**
 * Each cell: [kind, name, label]
 * kind: moa | restricted | null (covered by published R-poly / hole)
 * Chart names abbreviated to match Figure A.3-1.
 */
const GRID = [
  // lat0 36.45–36.70 (south)
  [
    ['restricted', 'ECS', 'ECS'],
    ['restricted', '4808S', '4808S'],
    ['restricted', '65D', '65D'],
    ['restricted', '64F', '64F'],
    ['restricted', '63C', '63C'],
    ['restricted', '62B', '62B'],
    ['moa', 'ELGIN', 'ELGIN'],
    ['moa', 'ELGIN', 'ELGIN']
  ],
  // lat1 36.70–36.95
  [
    ['restricted', 'ECS', 'ECS'],
    ['restricted', '4808E', '4808E'],
    ['restricted', '65C', '65C'],
    ['restricted', '64D', '64D'],
    ['restricted', '63B', '63B'],
    ['restricted', '62A', '62A'],
    ['moa', 'ELGIN', 'ELGIN'],
    ['moa', 'ELGIN', 'ELGIN']
  ],
  // lat2 36.95–37.20
  [
    ['restricted', '76', '76'],
    ['restricted', '4808B', '4808B'],
    ['restricted', '4808A', '4808A'],
    ['restricted', '65B', '65B'],
    ['restricted', '64C', '64C'],
    ['restricted', '61B', '61B'],
    ['moa', 'SALLY', 'SALLY'],
    ['moa', 'ELGIN', 'ELGIN']
  ],
  // lat3 37.20–37.45
  [
    ['restricted', '75W', '75W'],
    ['restricted', '4808D', '4808D'],
    ['restricted', '4808A', '4808A'],
    ['restricted', '65A', '65A'],
    ['restricted', '64B', '64B'],
    ['restricted', '61A', '61A'],
    ['restricted', 'ALAMOC', 'ALAMOC'],
    ['moa', 'CALC', 'CALC']
  ],
  // lat4 37.45–37.70
  [
    ['restricted', '75E', '75E'],
    ['restricted', '74A', '74A'],
    ['restricted', 'PAHUTEA', 'PAHUTEA'],
    ['restricted', '64A', '64A'],
    ['restricted', 'ALAMOB', 'ALAMOB'],
    ['restricted', 'ALAMOA', 'ALAMOA'],
    ['moa', 'CALB', 'CALB'],
    ['moa', 'CALC', 'CALC']
  ],
  // lat5 37.70–37.95
  [
    ['restricted', '71S', '71S'],
    ['restricted', '74B', '74B'],
    ['restricted', 'PAHUTEB', 'PAHUTEB'],
    ['moa', 'COYA', 'COYA'],
    ['moa', 'CALA', 'CALA'],
    ['moa', 'CALB', 'CALB'],
    ['moa', 'CALC', 'CALC'],
    ['moa', 'CALC', 'CALC']
  ],
  // lat6 37.95–38.15 (north)
  [
    ['restricted', '71N', '71N'],
    ['restricted', '4809A', '4809A'],
    ['moa', 'COYD', 'COYD'],
    ['moa', 'COYC', 'COYC'],
    ['moa', 'COYB', 'COYB'],
    ['moa', 'REV SOUTH', 'REV S'],
    ['moa', 'REV SOUTH', 'REV S'],
    ['moa', 'REV NORTH', 'REV N']
  ]
];

// Fix north row: REV NORTH should be full top strip; REV SOUTH below.
// Override lat6 for clearer chart match — split differently using merge names.
GRID[6] = [
  ['moa', 'REV NORTH', 'REV N'],
  ['moa', 'REV NORTH', 'REV N'],
  ['moa', 'REV NORTH', 'REV N'],
  ['moa', 'REV NORTH', 'REV N'],
  ['moa', 'REV NORTH', 'REV N'],
  ['moa', 'REV NORTH', 'REV N'],
  ['moa', 'REV NORTH', 'REV N'],
  ['moa', 'REV NORTH', 'REV N']
];
// Insert REV SOUTH by shrinking lat5 east into REV SOUTH / coyote
GRID[5] = [
  ['restricted', '71S', '71S'],
  ['restricted', '74B', '74B'],
  ['restricted', 'ECE', 'ECE'],
  ['moa', 'COYD', 'COYD'],
  ['moa', 'COYC', 'COYC'],
  ['moa', 'COYB', 'COYB'],
  ['moa', 'REV SOUTH', 'REV S'],
  ['moa', 'REV SOUTH', 'REV S']
];
GRID[4] = [
  ['restricted', '75E', '75E'],
  ['restricted', '74A', '74A'],
  ['restricted', 'ECW', 'ECW'],
  ['moa', 'COYA', 'COYA'],
  ['moa', 'CALA', 'CALA'],
  ['moa', 'CALB', 'CALB'],
  ['moa', 'CALC', 'CALC'],
  ['moa', 'CALC', 'CALC']
];

function buildMergedTiles() {
  const h = GRID.length;
  const w = GRID[0].length;
  const seen = Array.from({ length: h }, () => Array(w).fill(false));
  const out = [];

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (seen[j][i] || !GRID[j][i]) continue;
      const [kind, name, label] = GRID[j][i];
      let i1 = i;
      while (
        i1 + 1 < w &&
        GRID[j][i1 + 1] &&
        GRID[j][i1 + 1][0] === kind &&
        GRID[j][i1 + 1][1] === name &&
        !seen[j][i1 + 1]
      ) i1++;
      let j1 = j;
      outer: while (j1 + 1 < h) {
        for (let x = i; x <= i1; x++) {
          const c = GRID[j1 + 1][x];
          if (!c || c[0] !== kind || c[1] !== name || seen[j1 + 1][x]) break outer;
        }
        j1++;
      }
      for (let yy = j; yy <= j1; yy++) {
        for (let xx = i; xx <= i1; xx++) seen[yy][xx] = true;
      }
      out.push({
        kind,
        name,
        label,
        ring: cell(LON[i], LAT[j], LON[i1 + 1], LAT[j1 + 1])
      });
    }
  }
  return out;
}

function envelopeFromRings(rings) {
  const pts = [];
  for (const ring of rings) for (const p of ring) pts.push(p);
  // Chart MOA lobes (Reveille north, Caliente/Elgin east)
  pts.push([-117.05, 38.15], [-113.90, 38.15], [-113.90, 36.70], [-114.25, 36.45]);
  const uniq = Array.from(new Map(pts.map(p => [p[0].toFixed(5) + ',' + p[1].toFixed(5), p])).values());
  uniq.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of uniq) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    const p = uniq[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return close(lower.concat(upper));
}

const DELTA = envelopeFromRings([R4806E, R4806W, R4807A, R4807B, R4808N, R4808S, R4809]);

const features = [];
features.push(feat('AIRSPACE DELTA', 'delta', { type: 'Polygon', coordinates: [DELTA] }, { label: 'NTTR' }));

const tiles = buildMergedTiles();
for (const t of tiles) {
  // Skip 4808A tile — published R-4808N used as filled ROZ
  if (t.name === '4808A') continue;
  features.push(feat(t.name, t.kind, { type: 'Polygon', coordinates: [t.ring] }, { label: t.label }));
}

// Published restricted outlines (true geometry)
for (const [name, ring] of [
  ['R-4806E', R4806E],
  ['R-4806W', R4806W],
  ['R-4807A', R4807A],
  ['R-4807B', R4807B],
  ['R-4808S', R4808S],
  ['R-4809', R4809]
]) {
  features.push(feat(name, 'restricted', { type: 'Polygon', coordinates: [ring] }, { label: name }));
}

// Square ROZ fill = R-4808N (chart 4808A block)
features.push(feat('R-4808A', 'roz', { type: 'Polygon', coordinates: [R4808N] }, {
  label: '4808A',
  fill: true
}));

features.push(feat('SHELL AAR', 'aar', { type: 'Polygon', coordinates: [shellPoly] }, { label: 'SHELL' }));
features.push(feat('SHELL IP', 'aar_point', point(shellIP), { label: 'IP' }));
features.push(feat('SHELL CP', 'aar_point', point(shellCP), { label: 'CP' }));

// Overlap check among moa+restricted tiles (not vs published rings)
function bbox(ring) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  return { minLon, maxLon, minLat, maxLat };
}
function areaOverlap(a, b) {
  const A = bbox(a), B = bbox(b);
  const w = Math.max(0, Math.min(A.maxLon, B.maxLon) - Math.max(A.minLon, B.minLon));
  const h = Math.max(0, Math.min(A.maxLat, B.maxLat) - Math.max(A.minLat, B.minLat));
  return w > 1e-9 && h > 1e-9 ? w * h : 0;
}
const tileRings = features.filter(f => f.properties.kind === 'moa' || f.properties.kind === 'restricted')
  .filter(f => !/^R-480/.test(f.properties.name))
  .map(f => ({ name: f.properties.name, ring: f.geometry.coordinates[0] }));
let overlaps = 0;
for (let i = 0; i < tileRings.length; i++) {
  for (let j = i + 1; j < tileRings.length; j++) {
    if (areaOverlap(tileRings[i].ring, tileRings[j].ring) > 0) {
      overlaps++;
      console.warn('OVERLAP', tileRings[i].name, tileRings[j].name);
    }
  }
}
const cos38 = Math.cos(38 * Math.PI / 180);
const db = bbox(DELTA);
console.log(
  'Delta ~',
  ((db.maxLon - db.minLon) * 60 * cos38).toFixed(1), 'nm E-W x',
  ((db.maxLat - db.minLat) * 60).toFixed(1), 'nm N-S'
);
console.log('tiles', tiles.length, 'features', features.length, 'tile-overlaps', overlaps);

const fc = {
  type: 'FeatureCollection',
  name: 'nttr_airspace',
  crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  features
};
fs.writeFileSync(path.join(__dirname, 'nttr_airspace.json'), JSON.stringify(fc, null, 2));
if (overlaps) process.exitCode = 1;
