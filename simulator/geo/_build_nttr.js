/**
 * Build the simulator's geography + NTTR airspace data.
 *
 *     node simulator/geo/_build_nttr.js
 *
 * Inputs
 *   faa_sua_nttr.json  FAA Special Use Airspace (official open-data service) — the
 *                      real Desert / Reveille MOA and R-48xx boundaries. Refresh with:
 *     curl -G "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query" \
 *       --data-urlencode "where=NAME LIKE '%DESERT MOA%' OR NAME LIKE 'R-480%' OR NAME LIKE '%REVEILLE%'" \
 *       --data-urlencode "outFields=*" --data-urlencode "outSR=4326" \
 *       --data-urlencode "geometryPrecision=5" --data-urlencode "f=geojson" -o faa_sua_nttr.json
 *   us_states_10m.json US state boundaries (us-atlas 3.0.1, from US Census Bureau
 *                      cartographic boundary files). Refresh with:
 *     curl -L "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json" -o us_states_10m.json
 *   AAR_TRACKS below   Tanker tracks from the range sheet (IP / CP / protected box).
 *
 * Outputs (never edit by hand)
 *   nttr_airspace.json, nellis_aor.json   fetched when served over http
 *   ../src/geo_data.js                    same data embedded for file:// loads
 *
 * Only published boundaries are drawn. NTTR's internal sub-areas (Coyote, Caliente,
 * Elgin, Sally Corridor, numbered ranges) are not in FAA data, so they appear as
 * approximate text labels with no invented border. To draw one for real, add its
 * surveyed ring to SUBAREAS.
 */
const fs = require('fs');
const path = require('path');

const NTTR_NAMES = /^(DESERT MOA|REVEILLE (NORTH|SOUTH) MOA|R-480[6-9][A-Z]?)$/;

function parseSheet(s) {
  const m = s.match(/([NS])\s*(\d+)\s+(\d+)\s+([EW])\s*(\d+)\s+(\d+)/i);
  if (!m) throw new Error('bad sheet coordinate: ' + s);
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

function feat(name, kind, geometry, extra = {}) {
  return {
    type: 'Feature',
    properties: Object.assign({ name, kind, label: name }, extra),
    geometry
  };
}

const point = coord => ({ type: 'Point', coordinates: coord });
const polygon = ring => ({ type: 'Polygon', coordinates: [ring] });

/**
 * Air refueling tracks. `ip` / `cp` are the single source of truth for where the
 * tanker flies: scenarios reference these same sheet coordinates (see
 * DCA_STANDARD_OVERLAY.hvaaAnchors in src/scenarios_data.js).
 */
const AAR_TRACKS = [
  {
    name: 'SHELL',
    ip: 'N37 07 W114 24',
    cp: 'N37 21 W114 12',
    box: ['N37 31 W114 24', 'N37 10 W114 41', 'N37 02 W114 26', 'N37 23 W114 09']
  }
];

/** Approximate label positions for NTTR sub-areas with no published boundary. */
const SUBAREA_LABELS = [
  ['COYOTE', -115.35, 37.72],
  ['CALIENTE', -114.25, 37.65],
  ['ELGIN', -114.25, 36.85],
  ['SALLY', -114.95, 37.05]
];

/** Surveyed sub-area rings, if you have them: { name, kind: 'sector', ring: [[lon, lat], ...] } */
const SUBAREAS = [];

// ------------------------------------------------------------------ airspace

const faa = JSON.parse(fs.readFileSync(path.join(__dirname, 'faa_sua_nttr.json'), 'utf8'));
const airspace = [];

faa.features
  .filter(f => NTTR_NAMES.test(f.properties.NAME))
  .forEach(f => {
    const p = f.properties;
    const isExclusion = /EXCLUSION/.test(p.SECTOR || '');
    const kind = isExclusion ? 'exclusion' : (p.TYPE_CODE === 'MOA' ? 'moa' : 'restricted');
    const label = p.NAME.replace(/ MOA$/, '').replace('REVEILLE NORTH', 'REVEILLE N').replace('REVEILLE SOUTH', 'REVEILLE S');
    const rings = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map(c => c[0]) : [f.geometry.coordinates[0]];
    rings.forEach(ring => {
      airspace.push(feat(p.NAME, kind, polygon(close(ring.map(c => [+c[0].toFixed(5), +c[1].toFixed(5)]))), {
        label: isExclusion ? '' : label,
        source: 'FAA SUA'
      }));
    });
  });

SUBAREAS.forEach(s => airspace.push(feat(s.name, s.kind || 'sector', polygon(close(s.ring)), { source: 'range sheet' })));
SUBAREA_LABELS.forEach(([name, lon, lat]) => airspace.push(feat(name, 'label', point([lon, lat]), { approx: true })));

AAR_TRACKS.forEach(t => {
  const ip = parseSheet(t.ip);
  const cp = parseSheet(t.cp);
  airspace.push(feat(`${t.name} AAR`, 'aar', polygon(close(t.box.map(parseSheet))), { label: t.name, source: 'range sheet' }));
  airspace.push(feat(`${t.name} TRACK`, 'aar_track', { type: 'LineString', coordinates: [ip, cp] }, { label: '' }));
  airspace.push(feat(`${t.name} IP`, 'aar_point', point(ip), { label: 'IP' }));
  airspace.push(feat(`${t.name} CP`, 'aar_point', point(cp), { label: 'CP' }));
});

// ----------------------------------------------------------------- geography

/** Decode one TopoJSON geometry into GeoJSON-style polygons ([ [ring, ...], ... ]). */
function topoPolygons(topo, geometry) {
    const [sx, sy] = topo.transform.scale;
    const [tx, ty] = topo.transform.translate;
    const arcs = topo.arcs.map((arc) => {
        let x = 0, y = 0;
        return arc.map(([dx, dy]) => {
            x += dx; y += dy;
            return [+(x * sx + tx).toFixed(4), +(y * sy + ty).toFixed(4)];
        });
    });
    const ring = (indexes) => {
        const pts = [];
        indexes.forEach((i) => {
            const arc = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
            arc.forEach((p, k) => { if (k > 0 || !pts.length) pts.push(p); });
        });
        return pts;
    };
    const polys = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs;
    return polys.map(poly => poly.map(ring));
}

// States that can appear on the scope around the Nellis theatre.
const STATE_NAMES = ['Nevada', 'California', 'Utah', 'Arizona', 'Oregon', 'Idaho', 'Wyoming', 'Colorado', 'New Mexico'];
const topo = JSON.parse(fs.readFileSync(path.join(__dirname, 'us_states_10m.json'), 'utf8'));
const stateFeatures = [];
topo.objects.states.geometries
  .filter(g => STATE_NAMES.includes(g.properties.name))
  .forEach((g) => {
    topoPolygons(topo, g).forEach((rings) => {
      stateFeatures.push(feat(g.properties.name, 'state', { type: 'Polygon', coordinates: rings }, { source: 'US Census' }));
    });
  });

/** Whole-degree graticule over the theatre, labelled along the bullseye meridian / parallel. */
const BULLSEYE = { lat: 38, lon: -115 };
const graticule = [];
for (let lat = 32; lat <= 44; lat++) {
  const line = [];
  for (let lon = -124; lon <= -106; lon += 0.5) line.push([lon, lat]);
  graticule.push(feat(`lat${lat}`, 'graticule', { type: 'LineString', coordinates: line },
    { label: `N${lat}`, labelAt: lat === BULLSEYE.lat ? null : [BULLSEYE.lon, lat] }));
}
for (let lon = -124; lon <= -106; lon++) {
  const line = [];
  for (let lat = 32; lat <= 44; lat += 0.5) line.push([lon, lat]);
  graticule.push(feat(`lon${lon}`, 'graticule', { type: 'LineString', coordinates: line },
    { label: `W${-lon}`, labelAt: lon === BULLSEYE.lon ? null : [lon, BULLSEYE.lat] }));
}

const AIRFIELDS = [
  ['KLSV', 'NELLIS', -115.034, 36.236], ['KTNX', 'TONOPAH', -116.781, 37.799], ['KINS', 'CREECH', -115.672, 36.587],
  ['KLAS', 'LAS', -115.152, 36.080], ['KNFL', 'FALLON', -118.701, 39.417], ['KNID', 'CHINA LK', -117.685, 35.685],
  ['KEDW', 'EDWARDS', -117.884, 34.905], ['KRNO', 'RENO', -119.768, 39.499], ['KSLC', 'SLC', -111.978, 40.788],
  ['KPHX', 'PHX', -112.012, 33.434]
];

const aor = [
  ...graticule,
  ...stateFeatures,
  ...AIRFIELDS.map(([name, label, lon, lat]) => feat(name, 'airfield', point([lon, lat]), { label }))
];

// -------------------------------------------------------------------- output

const collection = (name, features) => ({
  type: 'FeatureCollection',
  name,
  crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  features
});

const airspaceFc = collection('nttr_airspace', airspace);
const aorFc = collection('nellis_aor', aor);

fs.writeFileSync(path.join(__dirname, 'nttr_airspace.json'), JSON.stringify(airspaceFc));
fs.writeFileSync(path.join(__dirname, 'nellis_aor.json'), JSON.stringify(aorFc));
fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'geo_data.js'),
  '/** Generated by geo/_build_nttr.js — do not edit. Embedded copy for file:// loads. */\n'
  + `window.NTTR_AIRSPACE_DATA = ${JSON.stringify(airspaceFc)};\n`
  + `window.NELLIS_AOR_DATA = ${JSON.stringify(aorFc)};\n`
);

const counts = {};
airspace.forEach(f => { counts[f.properties.kind] = (counts[f.properties.kind] || 0) + 1; });
console.log('airspace features', counts, '| aor features', aor.length);
