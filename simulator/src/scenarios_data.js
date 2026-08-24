/** NTTR E–W training picture: blue from east (ELGIN/CALC), red Flanker ingress from west */
window.DCA_STANDARD_OVERLAY = {
  bullseyeLabel: "BULLSEYE: N38°00' W115°00' (NTTR E–W)",
  bullseyeGeo: { lat: 38.0, lon: -115.0 },
  tacticalLines: { meld: 70, commit: 50, retrograde: 30 },
  fighterMeldNm: 70,
  fighterCommitNm: 50,
  mllNm: 130,
  emconLineNm: 90,
  bmaNm: 120,
  dal: { name: "DAL", bearing: 156, range: 70 },
  capPoints: [
    { name: "CAP EAST-L", bearing: 133, range: 36, radius: 8 },
    { name: "CAP EAST-R", bearing: 119, range: 30, radius: 8 }
  ],
  hvaaAnchors: [
    {
      name: "SHELL 1",
      type: "tanker",
      bearing: 152,
      range: 80,
      legLength: 25,
      legHeading: 90,
      slideNm: 25,
      scramNm: 15
    }
  ],
  safePassages: [
    {
      start: { bearing: 170, range: 95 },
      end: { bearing: 150, range: 75 },
      width: 15
    }
  ]
};

function cloneDcaOverlay() {
  return JSON.parse(JSON.stringify(window.DCA_STANDARD_OVERLAY));
}

function buildDcaScenario(id, name, radarMode, tracks, waves) {
  const s = Object.assign(cloneDcaOverlay(), { id: id, name: name, radarMode: radarMode, tracks: tracks });
  if (waves) s.waves = waves;
  return s;
}

function f35(track, formation) {
  return Object.assign({}, track, {
    airframe: "F35",
    formation: formation
  });
}

function flanker(track, formation) {
  return Object.assign({}, track, {
    airframe: "SU30",
    adversaryProfile: "flanker",
    formation: formation
  });
}

function flankerWave(track, formation, waveId, dormant) {
  return flanker(
    Object.assign({}, track, { waveId: waveId, isDormant: dormant }),
    formation
  );
}

window.SCENARIO_BANK = {
  "sc-01-single-commit": buildDcaScenario(
    "sc-01-single-commit",
    "NTTR E–W — Single Group Commit",
    "normal",
    [
      f35(
        { bearing: 133, range: 36, altitude: 28000, callsign: "RAPTOR11", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "LEAD", flightLead: "RAPTOR11" }
      ),
      f35(
        { bearing: 135, range: 34, altitude: 28000, callsign: "RAPTOR12", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "WING", flightLead: "RAPTOR11", offsetNmEast: 2, offsetNmNorth: -2 }
      ),
      f35(
        { bearing: 119, range: 30, altitude: 28000, callsign: "VIPER21", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "LEAD", flightLead: "VIPER21" }
      ),
      f35(
        { bearing: 121, range: 28, altitude: 28000, callsign: "VIPER22", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "WING", flightLead: "VIPER21", offsetNmEast: 2, offsetNmNorth: -2 }
      ),
      flankerWave(
        { bearing: 270, range: 125, altitude: 32000, callsign: "BANDIT1", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "PAIR", role: "LEAD", leadCallsign: "BANDIT1" },
        1,
        false
      ),
      flankerWave(
        { bearing: 268, range: 128, altitude: 32000, callsign: "BANDIT2", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "PAIR", role: "WING", leadCallsign: "BANDIT1", offsetNmEast: 0, offsetNmNorth: 10 },
        1,
        false
      ),
      flankerWave(
        { bearing: 270, range: 155, altitude: 32000, callsign: "BANDIT3", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "PAIR", role: "LEAD", leadCallsign: "BANDIT3" },
        2,
        true
      ),
      flankerWave(
        { bearing: 268, range: 158, altitude: 32000, callsign: "BANDIT4", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "PAIR", role: "WING", leadCallsign: "BANDIT3", offsetNmEast: 0, offsetNmNorth: 10 },
        2,
        true
      ),
      { bearing: 158, range: 75, altitude: 24000, callsign: "SHELL1", hostile: false, type: "tanker", heading: 90, speed: 320, orbit: "SHELL 1" }
    ],
    [
      { id: 1, label: "FIRST", formation: "PAIR", releaseAtSec: 0, trackIds: ["BANDIT1", "BANDIT2"] },
      { id: 2, label: "SECOND", formation: "PAIR", releaseAtSec: 90, trackIds: ["BANDIT3", "BANDIT4"], releaseIfPriorWaveDestroyed: true }
    ]
  ),
  "sc-02-wall-ladder": buildDcaScenario(
    "sc-02-wall-ladder",
    "NTTR E–W — WALL / LADDER Picture",
    "normal",
    [
      f35(
        { bearing: 133, range: 36, altitude: 28000, callsign: "RAPTOR11", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "LEAD", flightLead: "RAPTOR11" }
      ),
      f35(
        { bearing: 135, range: 34, altitude: 28000, callsign: "RAPTOR12", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "WING", flightLead: "RAPTOR11", offsetNmEast: 2, offsetNmNorth: -2 }
      ),
      f35(
        { bearing: 119, range: 30, altitude: 28000, callsign: "VIPER21", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "LEAD", flightLead: "VIPER21" }
      ),
      f35(
        { bearing: 121, range: 28, altitude: 28000, callsign: "VIPER22", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "WING", flightLead: "VIPER21", offsetNmEast: 2, offsetNmNorth: -2 }
      ),
      flankerWave(
        { bearing: 265, range: 120, altitude: 30000, callsign: "H1", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "WALL", role: "WING", leadCallsign: "H2", offsetNmEast: 0, offsetNmNorth: 10 },
        1,
        false
      ),
      flankerWave(
        { bearing: 270, range: 122, altitude: 30000, callsign: "H2", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "WALL", role: "LEAD", leadCallsign: "H2" },
        1,
        false
      ),
      flankerWave(
        { bearing: 275, range: 120, altitude: 31000, callsign: "H3", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "WALL", role: "WING", leadCallsign: "H2", offsetNmEast: 0, offsetNmNorth: -10 },
        1,
        false
      ),
      flankerWave(
        { bearing: 262, range: 145, altitude: 33000, callsign: "H4", hostile: true, type: "fighter", heading: 90, speed: 490 },
        { type: "LADDER", role: "WING", leadCallsign: "H2", offsetNmEast: -15, offsetNmNorth: 0 },
        2,
        true
      ),
      flankerWave(
        { bearing: 272, range: 147, altitude: 33000, callsign: "H5", hostile: true, type: "fighter", heading: 90, speed: 490 },
        { type: "LADDER", role: "WING", leadCallsign: "H2", offsetNmEast: -30, offsetNmNorth: 0 },
        2,
        true
      ),
      flankerWave(
        { bearing: 270, range: 170, altitude: 32000, callsign: "H6", hostile: true, type: "fighter", heading: 90, speed: 490 },
        { type: "PAIR", role: "LEAD", leadCallsign: "H6" },
        3,
        true
      ),
      flankerWave(
        { bearing: 268, range: 173, altitude: 32000, callsign: "H7", hostile: true, type: "fighter", heading: 90, speed: 490 },
        { type: "PAIR", role: "WING", leadCallsign: "H6", offsetNmEast: 0, offsetNmNorth: 10 },
        3,
        true
      ),
      { bearing: 158, range: 75, altitude: 24000, callsign: "SHELL1", hostile: false, type: "tanker", heading: 90, speed: 320, orbit: "SHELL 1" }
    ],
    [
      { id: 1, label: "FIRST", formation: "WALL", releaseAtSec: 0, trackIds: ["H1", "H2", "H3"] },
      { id: 2, label: "SECOND", formation: "LADDER", releaseAtSec: 90, trackIds: ["H4", "H5"], releaseIfPriorWaveDestroyed: true },
      { id: 3, label: "THIRD", formation: "PAIR", releaseAtSec: 180, trackIds: ["H6", "H7"], releaseIfPriorWaveDestroyed: true }
    ]
  ),
  "sc-03-degraded-radar": buildDcaScenario(
    "sc-03-degraded-radar",
    "NTTR E–W — Degraded Radar Feed",
    "degraded",
    [
      f35(
        { bearing: 133, range: 36, altitude: 28000, callsign: "RAPTOR11", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "LEAD", flightLead: "RAPTOR11" }
      ),
      f35(
        { bearing: 135, range: 34, altitude: 28000, callsign: "RAPTOR12", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "WING", flightLead: "RAPTOR11", offsetNmEast: 2, offsetNmNorth: -2 }
      ),
      f35(
        { bearing: 119, range: 30, altitude: 28000, callsign: "VIPER21", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "LEAD", flightLead: "VIPER21" }
      ),
      f35(
        { bearing: 121, range: 28, altitude: 28000, callsign: "VIPER22", hostile: false, type: "fighter", heading: 270, speed: 420 },
        { type: "PAIR", role: "WING", flightLead: "VIPER21", offsetNmEast: 2, offsetNmNorth: -2 }
      ),
      flankerWave(
        { bearing: 270, range: 95, altitude: 30000, callsign: "NEAR1", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "LADDER", role: "LEAD", leadCallsign: "NEAR1" },
        1,
        false
      ),
      flankerWave(
        { bearing: 268, range: 97, altitude: 30000, callsign: "NEAR2", hostile: true, type: "fighter", heading: 90, speed: 500 },
        { type: "LADDER", role: "WING", leadCallsign: "NEAR1", offsetNmEast: -15, offsetNmNorth: 0 },
        1,
        false
      ),
      flankerWave(
        { bearing: 270, range: 125, altitude: 32000, callsign: "FAR1", hostile: true, type: "fighter", heading: 90, speed: 490 },
        { type: "LADDER", role: "LEAD", leadCallsign: "FAR1" },
        2,
        true
      ),
      flankerWave(
        { bearing: 275, range: 127, altitude: 33000, callsign: "FAR2", hostile: true, type: "fighter", heading: 90, speed: 490 },
        { type: "LADDER", role: "WING", leadCallsign: "FAR1", offsetNmEast: -15, offsetNmNorth: 5 },
        2,
        true
      ),
      flankerWave(
        { bearing: 262, range: 130, altitude: 33000, callsign: "FAR3", hostile: true, type: "fighter", heading: 90, speed: 490 },
        { type: "LADDER", role: "WING", leadCallsign: "FAR1", offsetNmEast: -30, offsetNmNorth: -5 },
        2,
        true
      ),
      { bearing: 158, range: 75, altitude: 24000, callsign: "SHELL1", hostile: false, type: "tanker", heading: 90, speed: 320, orbit: "SHELL 1" }
    ],
    [
      { id: 1, label: "FIRST", formation: "LADDER", releaseAtSec: 0, trackIds: ["NEAR1", "NEAR2"] },
      { id: 2, label: "SECOND", formation: "LADDER", releaseAtSec: 90, trackIds: ["FAR1", "FAR2", "FAR3"], releaseIfPriorWaveDestroyed: true }
    ]
  )
};
