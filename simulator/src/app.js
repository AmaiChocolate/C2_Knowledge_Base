/**
 * BC3 Scope Trainer — UI wiring
 */

let scope;
let addingTrack = false;
let clusterer;
let pictureGen;
let aspectCalc;
let trainer;
let timeline;
let currentScenarioId = null;

window.addEventListener('DOMContentLoaded', () => {
    timeline = new MissionTimeline();
    timeline.start(null);

    scope = new ScopeEngine('tacScope');
    window.scope = scope;
    scope.timeline = timeline; // PilotAI event logging
    clusterer = new TrackClusterer(3, 1);
    pictureGen = new PictureGenerator();
    aspectCalc = new AspectCalculator();
    trainer = new BrevityTrainer();

    initializeControls();
    initializeTabs();

    // Always start on standard DCA geometry
    if (window.SCENARIO_BANK && window.SCENARIO_BANK['sc-01-single-commit']) {
        applyScenario(window.SCENARIO_BANK['sc-01-single-commit']);
        const sel = document.getElementById('scenarioSelect');
        if (sel) sel.value = 'sc-01-single-commit';
    }

    setInterval(() => {
        updateTacticalState();
        refreshRadarStatus();
        refreshTimelineSummary();
        if (scope && scope.selectedTrack) {
            const id = scope.selectedTrack.id;
            const live = scope.tracks.find(t => String(t.id) === String(id))
                || scope.truthTracks.find(t => String(t.id) === String(id));
            if (live) updateTrackInfo(live);
        }
    }, 1000);
});

function initializeTabs() {
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
            if (tab.dataset.tab === 'simulator') scope.render();
        });
    });
}

function initializeControls() {
    document.getElementById('addTrackBtn').addEventListener('click', () => {
        addingTrack = !addingTrack;
        document.getElementById('addTrackBtn').classList.toggle('active', addingTrack);
        if (addingTrack) {
            scope.canvas.style.cursor = 'cell';
            scope.canvas.addEventListener('click', handleTrackPlacement);
        } else {
            scope.canvas.style.cursor = 'crosshair';
            scope.canvas.removeEventListener('click', handleTrackPlacement);
        }
    });

    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Clear all tracks?')) {
            scope.clearAllTracks();
            updateTrackList();
            updatePictureSuggestion();
        }
    });

    document.getElementById('gridBtn').addEventListener('click', () => {
        scope.showGrid = !scope.showGrid;
        scope.render();
    });

    document.getElementById('resetViewBtn').addEventListener('click', () => {
        scope.resetView();
    });

    document.getElementById('zoomInBtn').addEventListener('click', () => {
        scope.zoomBy(1.35);
        updateZoomReadout();
    });
    document.getElementById('zoomOutBtn').addEventListener('click', () => {
        scope.zoomBy(1 / 1.35);
        updateZoomReadout();
    });

    function updateZoomReadout() {
        const el = document.getElementById('zoomReadout');
        if (el) el.textContent = scope.viewScale.toFixed(2) + 'x';
    }
    function updateSpeedReadout() {
        const el = document.getElementById('speedReadout');
        if (el) el.textContent = (scope.timeScale || 1) + 'x';
        document.querySelectorAll('.speedBtn').forEach(btn => {
            const s = Number(btn.getAttribute('data-speed'));
            btn.classList.toggle('active', s === scope.timeScale);
        });
    }
    setInterval(updateZoomReadout, 200);
    setInterval(updateSpeedReadout, 200);

    document.querySelectorAll('.speedBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            scope.setTimeScale(btn.getAttribute('data-speed'));
            updateSpeedReadout();
        });
    });

    // Keyboard zoom/pan fallback + sim speed
    window.addEventListener('keydown', (e) => {
        if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
        if (e.key === '=' || e.key === '+') { e.preventDefault(); scope.zoomBy(1.2); }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); scope.zoomBy(1 / 1.2); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); scope.viewOffset.x += 40; }
        if (e.key === 'ArrowRight') { e.preventDefault(); scope.viewOffset.x -= 40; }
        if (e.key === 'ArrowUp') { e.preventDefault(); scope.viewOffset.y += 40; }
        if (e.key === 'ArrowDown') { e.preventDefault(); scope.viewOffset.y -= 40; }
        if (e.key === '0') { e.preventDefault(); scope.resetView(); }
        if (e.key === ']' || e.key === '.') {
            e.preventDefault();
            scope.cycleTimeScale();
            updateSpeedReadout();
        }
        if (e.key === '[' || e.key === ',') {
            e.preventDefault();
            const opts = scope.timeScaleOptions || [1, 2, 4, 8, 16];
            const i = opts.indexOf(scope.timeScale);
            scope.timeScale = opts[i <= 0 ? opts.length - 1 : i - 1];
            updateSpeedReadout();
        }
        updateZoomReadout();
    });

    document.getElementById('panBtn').addEventListener('click', () => {
        scope.panMode = !scope.panMode;
        document.getElementById('panBtn').classList.toggle('active', scope.panMode);
        scope.canvas.style.cursor = scope.panMode ? 'grab' : 'crosshair';
    });

    document.getElementById('showBMA').addEventListener('change', (e) => {
        scope.showBMA = e.target.checked;
        scope.render();
    });
    document.getElementById('showCAP').addEventListener('change', (e) => {
        scope.showCAP = e.target.checked;
        scope.render();
    });
    document.getElementById('showSafePassage').addEventListener('change', (e) => {
        scope.showSafePassage = e.target.checked;
        scope.render();
    });

    const bindOverlay = (id, prop) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', (e) => {
            scope[prop] = e.target.checked;
            scope.render();
        });
    };
    bindOverlay('showTacticalLines', 'showTacticalLines');
    bindOverlay('showSweep', 'showSweep');
    bindOverlay('showSectors', 'showSectors');
    bindOverlay('showDAL', 'showDAL');
    bindOverlay('showEmcon', 'showEmcon');
    bindOverlay('showMLL', 'showMLL');
    bindOverlay('showHvaaCircles', 'showHvaaCircles');
    bindOverlay('showGeography', 'showGeography');
    bindOverlay('showAirspace', 'showAirspace');

    document.getElementById('measureBtn').addEventListener('click', () => {
        scope.measureModeActive = !scope.measureModeActive;
        document.getElementById('measureBtn').classList.toggle('active', scope.measureModeActive);
        scope.canvas.style.cursor = scope.measureModeActive ? 'crosshair' : 'default';
        if (!scope.measureModeActive) scope.measurementStart = null;
    });

    document.getElementById('radarModeSelect').addEventListener('change', (e) => {
        if (scope.radar) {
            scope.radar.setMode(e.target.value);
            timeline.logRadarMode(e.target.value);
            refreshRadarStatus();
        }
    });

    document.getElementById('loadScenarioBtn').addEventListener('click', () => {
        const id = document.getElementById('scenarioSelect').value;
        if (id) loadScenario(id);
    });

    document.getElementById('logPictureBtn').addEventListener('click', () => {
        const text = document.getElementById('pictureSuggestion').innerText;
        timeline.logPicture(text);
        refreshTimelineSummary();
    });

    document.getElementById('commitBtn').addEventListener('click', () => {
        const t = scope.selectedTrack;
        if (!t) {
            alert('Select a blue fighter to force commit');
            return;
        }
        const truth = scope.truthTracks.find(x => String(x.id) === String(t.id)) || t;
        if (truth.hostile || truth.type !== 'fighter') {
            alert('Select a friendly fighter to force commit');
            return;
        }
        if (scope.pilotAI && scope.pilotAI.forceCommit(truth)) {
            timeline.logCommit(truth.id, truth.callsign);
            updateTrackInfo(scope.tracks.find(x => String(x.id) === String(truth.id)) || truth);
            refreshTimelineSummary();
            scope.render();
        } else {
            alert('No hostile available to commit against');
        }
    });

    document.getElementById('exportTimelineBtn').addEventListener('click', () => {
        timeline.download(`timeline-${currentScenarioId || 'freeplay'}.json`);
    });

    window.addEventListener('trackSelected', (e) => {
        updateTrackInfo(e.detail);
        updatePictureSuggestion();
    });

    // Declaration / delete / list select via delegation (reliable vs inline onclick)
    const trackInfo = document.getElementById('trackInfo');
    if (trackInfo) {
        trackInfo.addEventListener('click', (e) => {
            const declareBtn = e.target.closest('[data-declare]');
            if (declareBtn) {
                e.preventDefault();
                declareTrack(declareBtn.getAttribute('data-declare'));
                return;
            }
            if (e.target.closest('[data-delete-track]')) {
                e.preventDefault();
                deleteSelectedTrack();
            }
        });
    }
    const trackList = document.getElementById('trackList');
    if (trackList) {
        trackList.addEventListener('click', (e) => {
            const row = e.target.closest('[data-select-track]');
            if (row) selectTrack(row.getAttribute('data-select-track'));
        });
    }
}

function refreshRadarStatus() {
    const el = document.getElementById('radar-status');
    if (el && scope.radar) el.textContent = scope.radar.statusLabel();
}

function refreshTimelineSummary() {
    const el = document.getElementById('timelineSummary');
    if (el) el.innerHTML = timeline.summaryHtml();
}

async function loadScenario(id) {
    if (window.SCENARIO_BANK && window.SCENARIO_BANK[id]) {
        applyScenario(window.SCENARIO_BANK[id]);
        return;
    }
    try {
        const res = await fetch(`scenarios/${id}.json`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        applyScenario(data);
    } catch (err) {
        console.error(err);
        alert('Could not load scenario: ' + err.message);
    }
}

function applyScenario(data) {
    currentScenarioId = data.id;
    scope.clearAllTracks();
    timeline.start(data.id);

    if (data.bullseyeLabel) {
        document.getElementById('bullseye-ref').textContent = data.bullseyeLabel;
    }
    if (data.bullseyeGeo && scope.setBullseyeGeo) {
        scope.setBullseyeGeo(data.bullseyeGeo.lat, data.bullseyeGeo.lon);
    }

    if (data.capPoints) {
        scope.capPoints = JSON.parse(JSON.stringify(data.capPoints));
    }
    if (data.hvaaAnchors) {
        scope.hvaaAnchors = JSON.parse(JSON.stringify(data.hvaaAnchors));
    }
    if (data.safePassages) {
        scope.safePassages = JSON.parse(JSON.stringify(data.safePassages));
    }
    if (data.tacticalLines) {
        scope.tacticalLines = Object.assign({}, data.tacticalLines);
    }
    if (data.fighterMeldNm != null) scope.fighterMeldNm = data.fighterMeldNm;
    if (data.fighterCommitNm != null) scope.fighterCommitNm = data.fighterCommitNm;
    if (data.mllNm != null) scope.mllNm = data.mllNm;
    if (data.emconLineNm != null) {
        scope.emconLineNm = data.emconLineNm;
    }
    if (data.dal) {
        scope.dal = JSON.parse(JSON.stringify(data.dal));
    }
    if (data.bmaNm != null) {
        scope.bma = { center: scope.bullseye, radius: data.bmaNm * scope.scale };
    }

    if (data.radarMode && scope.radar) {
        scope.radar.setMode(data.radarMode);
        const modeSel = document.getElementById('radarModeSelect');
        if (modeSel) modeSel.value = data.radarMode;
        timeline.logRadarMode(data.radarMode);
    }

    (data.tracks || []).forEach(t => {
        const track = scope.addTrack(
            t.bearing, t.range, t.altitude, t.callsign,
            !!t.hostile, t.type || 'fighter',
            t.heading != null ? t.heading : 180,
            t.speed != null ? t.speed : 450
        );
        if (t.orbit && scope.hvaaAnchors) {
            const byName = scope.hvaaAnchors.find(a => a.name === t.orbit);
            if (byName) track.orbitAnchor = byName;
        }
        if (!track.orbitAnchor && (t.type === 'tanker' || t.orbit) && scope.hvaaAnchors.length) {
            track.orbitAnchor = scope.hvaaAnchors[0];
        }
        if (track.orbitAnchor) {
            track.orbitLeg = 'EAST';
            track.isManeuvering = false;
        }
        if (t.hostile && t.type === 'fighter') {
            track.airframe = t.airframe || 'SU30';
            track.adversaryProfile = t.adversaryProfile || 'flanker';
            track.ingressHeading = t.heading != null ? t.heading : 90;
            if (t.formation) {
                track.formation = JSON.parse(JSON.stringify(t.formation));
            }
            if (t.waveId != null) track.waveId = t.waveId;
            track.isDormant = t.isDormant === true;
        } else if (!t.hostile && t.type === 'fighter') {
            track.airframe = t.airframe || 'F35';
            if (t.formation) {
                track.formation = JSON.parse(JSON.stringify(t.formation));
            }
        }
        if (t.type === 'fighter' && typeof initAircraftStores === 'function') {
            initAircraftStores(track);
        }
    });

    assignBlueFlights();
    assignBlueCapStations();
    assignRedFlankerFormations(data.id);

    if (typeof WaveManager !== 'undefined') {
        WaveManager.initScenario(scope, data.waves);
        WaveManager.update(scope);
    }

    if (scope.pilotAI) {
        scope.pilotAI._blueSortPlan = null;
        scope.pilotAI._blueSortPlanKey = null;
        scope.pilotAI._pictureHostileCount = 0;
    }

    if (scope.radar) {
        scope.radar._accum = 999;
        scope.tracks = scope.radar.process(scope.truthTracks, 0);
    }

    updateTrackList();
    updatePictureSuggestion();
    refreshRadarStatus();
    refreshTimelineSummary();
}

/** Stamp blue PAIR formation + wing separation limits. */
function assignBlueFlights() {
    const blues = scope.truthTracks.filter(t => !t.hostile && t.type === 'fighter');
    const byCs = (name) => blues.find(t =>
        String(t.callsign || '').toUpperCase() === String(name).toUpperCase()
    );

    const applyLead = (cs) => {
        const t = byCs(cs);
        if (!t) return;
        t.formation = { type: 'PAIR', role: 'LEAD', flightLead: cs };
    };

    const applyWing = (cs, leadCs, offsetEast, offsetNorth) => {
        const t = byCs(cs);
        if (!t) return;
        t.formation = {
            type: 'PAIR',
            role: 'WING',
            flightLead: leadCs,
            offsetNmEast: offsetEast,
            offsetNmNorth: offsetNorth
        };
        t.wingMaxSepNm = 5;
    };

    applyLead('RAPTOR11');
    applyWing('RAPTOR12', 'RAPTOR11', 2, -2);
    applyLead('VIPER21');
    applyWing('VIPER22', 'VIPER21', 2, -2);
}

/** Map blue fighters to CAP stations and init BVR state. */
function assignBlueCapStations() {
    const caps = scope.capPoints || [];
    const blues = scope.truthTracks.filter(t => !t.hostile && t.type === 'fighter');
    blues.forEach((track, i) => {
        if (track.formation && track.formation.role === 'WING') {
            track.tacticalState = 'CAP';
            track.crankSide = 'RIGHT';
            track.assignedTargetId = null;
            track.cruiseSpeed = track.speed || 420;
            track.airframe = track.airframe || 'F35';
            track.isManeuvering = false;
            if (typeof initAircraftStores === 'function') initAircraftStores(track);
            return;
        }

        const cs = String(track.callsign || '').toUpperCase();
        let station = null;
        if (/RAPTOR/.test(cs)) {
            station = caps.find(c => /EAST-L|LEFT|-L\b|ELGIN/i.test(c.name)) || caps[0];
        } else if (/VIPER/.test(cs)) {
            station = caps.find(c => /EAST-R|RIGHT|-R\b|CALC/i.test(c.name)) || caps[1] || caps[0];
        } else {
            station = caps[i % Math.max(caps.length, 1)] || null;
        }
        if (station) {
            track.capStation = {
                name: station.name,
                bearing: station.bearing,
                range: station.range
            };
        }
        track.tacticalState = 'CAP';
        track.crankSide = (i % 2 === 0) ? 'LEFT' : 'RIGHT';
        track.assignedTargetId = null;
        track.cruiseSpeed = track.speed || 420;
        track.airframe = track.airframe || 'F35';
        track.isManeuvering = false;
        if (typeof initAircraftStores === 'function') initAircraftStores(track);
    });
}

/**
 * Format ordnance remaining for track panel.
 */
function formatOrdnanceLine(track) {
    if (!track || !track.ordnance) return '';
    const o = track.ordnance;
    const m = track.ordnanceMax || o;
    const parts = [];
    if ((m.FOX3 || 0) > 0) parts.push(`AIM-120: ${o.FOX3}/${m.FOX3}`);
    if ((m.R77 || 0) > 0) parts.push(`R-77: ${o.R77}/${m.R77}`);
    if ((m.R27 || 0) > 0) parts.push(`R-27: ${o.R27}/${m.R27}`);
    if (track.gunRoundsRemaining != null && track.gunRoundsRemaining > 0) {
        parts.push(`gun: ${track.gunRoundsRemaining}`);
    }
    const chaff = track.chaffRemaining != null
        ? ` · chaff ${track.chaffRemaining}${track.chaffMax ? '/' + track.chaffMax : ''}`
        : '';
    return parts.length ? parts.join(' · ') + chaff : chaff.trim();
}

/**
 * Init Flanker INGRESS + WALL/LADDER/PAIR offsets (scenario metadata or defaults).
 */
function assignRedFlankerFormations(scenarioId) {
    const reds = scope.truthTracks.filter(t => t.hostile && t.type === 'fighter');
    if (!reds.length) return;

    const byCs = (name) => reds.find(t =>
        String(t.callsign || '').toUpperCase() === String(name).toUpperCase()
    );

    const apply = (track, formation) => {
        if (!track) return;
        track.formation = formation;
        if (track.isDormant) {
            track.tacticalState = 'DORMANT';
        } else {
            track.tacticalState = 'INGRESS';
        }
        track.adversaryProfile = track.adversaryProfile || 'flanker';
        track.airframe = track.airframe || 'SU30';
        track.cruiseSpeed = track.speed || 500;
        track.crankSide = formation.role === 'LEAD' ? 'RIGHT' : 'LEFT';
        track.assignedTargetId = null;
        track.isManeuvering = false;
        if (track.ingressHeading == null) track.ingressHeading = track.heading || 90;
        if (typeof initAircraftStores === 'function') initAircraftStores(track);
    };

    // Prefer explicit formation from scenario JSON
    const needDefaults = reds.some(t => !t.formation);
    if (!needDefaults) {
        reds.forEach(t => {
            apply(t, t.formation);
        });
        return;
    }

    if (scenarioId === 'sc-01-single-commit' || byCs('BANDIT1')) {
        const lead = byCs('BANDIT1') || reds[0];
        const wing = byCs('BANDIT2') || reds[1];
        apply(lead, { type: 'PAIR', role: 'LEAD', leadCallsign: lead.callsign });
        if (wing) {
            apply(wing, {
                type: 'PAIR',
                role: 'WING',
                leadCallsign: lead.callsign,
                offsetNmEast: 0,
                offsetNmNorth: 10
            });
        }
        const lead2 = byCs('BANDIT3');
        const wing2 = byCs('BANDIT4');
        if (lead2) {
            apply(lead2, { type: 'PAIR', role: 'LEAD', leadCallsign: lead2.callsign });
        }
        if (wing2) {
            apply(wing2, {
                type: 'PAIR',
                role: 'WING',
                leadCallsign: lead2 ? lead2.callsign : 'BANDIT3',
                offsetNmEast: 0,
                offsetNmNorth: 10
            });
        }
        return;
    }

    if (scenarioId === 'sc-02-wall-ladder' || byCs('H2')) {
        const lead = byCs('H2') || reds[0];
        apply(lead, { type: 'WALL', role: 'LEAD', leadCallsign: lead.callsign });
        apply(byCs('H1'), {
            type: 'WALL', role: 'WING', leadCallsign: lead.callsign,
            offsetNmEast: 0, offsetNmNorth: 10
        });
        apply(byCs('H3'), {
            type: 'WALL', role: 'WING', leadCallsign: lead.callsign,
            offsetNmEast: 0, offsetNmNorth: -10
        });
        apply(byCs('H4'), {
            type: 'LADDER', role: 'WING', leadCallsign: lead.callsign,
            offsetNmEast: -15, offsetNmNorth: 0
        });
        apply(byCs('H5'), {
            type: 'LADDER', role: 'WING', leadCallsign: lead.callsign,
            offsetNmEast: -30, offsetNmNorth: 0
        });
        const h6 = byCs('H6');
        const h7 = byCs('H7');
        if (h6) apply(h6, { type: 'PAIR', role: 'LEAD', leadCallsign: h6.callsign });
        if (h7) {
            apply(h7, {
                type: 'PAIR', role: 'WING', leadCallsign: h6 ? h6.callsign : 'H6',
                offsetNmEast: 0, offsetNmNorth: 10
            });
        }
        return;
    }

    if (scenarioId === 'sc-03-degraded-radar' || byCs('NEAR1')) {
        const lead = byCs('NEAR1') || reds[0];
        apply(lead, { type: 'LADDER', role: 'LEAD', leadCallsign: lead.callsign });
        apply(byCs('NEAR2'), {
            type: 'LADDER', role: 'WING', leadCallsign: lead.callsign,
            offsetNmEast: -15, offsetNmNorth: 0
        });
        const farLead = byCs('FAR1');
        if (farLead) {
            apply(farLead, { type: 'LADDER', role: 'LEAD', leadCallsign: farLead.callsign });
        }
        apply(byCs('FAR2'), {
            type: 'LADDER', role: 'WING', leadCallsign: farLead ? farLead.callsign : 'FAR1',
            offsetNmEast: -15, offsetNmNorth: 5
        });
        apply(byCs('FAR3'), {
            type: 'LADDER', role: 'WING', leadCallsign: farLead ? farLead.callsign : 'FAR1',
            offsetNmEast: -30, offsetNmNorth: -5
        });
        return;
    }

    // default: NEAR1 lead, FARs ladder trail
    const lead = byCs('NEAR1') || reds[0];
    apply(lead, { type: 'LADDER', role: 'LEAD', leadCallsign: lead.callsign });
    const trail = reds.filter(t => t !== lead);
    trail.forEach((t, i) => {
        apply(t, {
            type: 'LADDER',
            role: 'WING',
            leadCallsign: lead.callsign,
            offsetNmEast: -(15 + i * 15),
            offsetNmNorth: i === 0 ? 5 : -5
        });
    });
}

function handleTrackPlacement(event) {
    const pos = scope.getMousePos(event);
    const { bearing, range } = scope.xyToBearingRange(pos.x, pos.y);

    const callsign = prompt('Enter callsign:', `TRK${scope.truthTracks.length + 1}`);
    if (!callsign) return;
    const altitude = prompt('Enter altitude (thousands):', '35');
    if (!altitude) return;
    const hostile = confirm('Is this track HOSTILE?');
    const typeChoice = prompt('Type: 1 Fighter 2 Bomber 3 Tanker 4 ISR 5 AWACS', '1');
    const types = ['fighter', 'fighter', 'bomber', 'tanker', 'isr', 'awacs'];
    const type = types[parseInt(typeChoice) || 1];
    const heading = prompt('Heading (000-359):', '180');
    const speed = prompt('Speed (knots):', '450');

    scope.addTrack(
        bearing, range, parseInt(altitude) * 1000, callsign, hostile, type,
        parseInt(heading) || 180, parseInt(speed) || 450
    );
    updateTrackList();
    updatePictureSuggestion();
}

function nearestFriendly(track) {
    const friendlies = scope.truthTracks.filter(t =>
        !t.hostile && t.type === 'fighter' && String(t.id) !== String(track.id)
    );
    if (!friendlies.length) return null;
    let best = null;
    let bestR = Infinity;
    friendlies.forEach(f => {
        const r = scope.calculateBRAA(f.bearing, f.range, track.bearing, track.range).range;
        if (r < bestR) {
            bestR = r;
            best = f;
        }
    });
    return best;
}

function nearestHostile(track) {
    const hostiles = scope.truthTracks.filter(t => t.hostile && !t.isSplashed);
    if (!hostiles.length) return null;
    let best = null;
    let bestR = Infinity;
    hostiles.forEach(h => {
        const r = scope.calculateBRAA(track.bearing, track.range, h.bearing, h.range).range;
        if (r < bestR) {
            bestR = r;
            best = h;
        }
    });
    return best;
}

/** Per-fighter meld/commit vs a threat (logic only — not drawn). */
function fighterMeldCommitStatus(fighter, threat) {
    if (!fighter || !threat) return null;
    const r = scope.calculateBRAA(fighter.bearing, fighter.range, threat.bearing, threat.range).range;
    const meldNm = scope.fighterMeldNm != null ? scope.fighterMeldNm : 70;
    const commitNm = scope.fighterCommitNm != null ? scope.fighterCommitNm : 50;
    return {
        rangeNm: r,
        meld: r <= meldNm ? 'IN RANGE' : 'OUT',
        commit: r <= commitNm ? 'IN RANGE' : 'OUT',
        meldNm,
        commitNm
    };
}

function updateTrackInfo(track) {
    const infoDiv = document.getElementById('trackInfo');
    if (!track) {
        infoDiv.innerHTML = '<p>Click a track to view details</p>';
        return;
    }

    const bulls = `${Math.round(track.bearing)}° / ${Math.round(track.range)}nm`;
    const fighter = nearestFriendly(track);
    let braaHtml = '<p><strong>BRAA:</strong> (no friendly fighter for reference)</p>';
    let aspectHtml = '';
    let meldCommitHtml = '';

    if (fighter) {
        const braa = aspectCalc.calculateBRAA(fighter, {
            centroid: { bearing: track.bearing, range: track.range, altitude: track.altitude },
            lead: track
        });
        braaHtml = `<p><strong>BRAA from ${fighter.callsign}:</strong> ${aspectCalc.formatBRAA(braa)}</p>`;
        const aspect = aspectCalc.calculateAspect(fighter, track);
        aspectHtml = `<p><strong>ASPECT:</strong> <span style="color:${aspect.classification === 'HOT' ? '#ff0000' : '#00ff00'}">${aspect.classification}</span> (${aspect.angle}° ${aspect.side})</p>`;
    } else {
        const aspect = aspectCalc.calculateAspect({ bearing: 0, range: 0, heading: 0 }, track);
        aspectHtml = `<p><strong>ASPECT (vs bulls):</strong> ${aspect.classification} (${aspect.angle}°)</p>`;
    }

    // Logic-only meld/commit: fighter vs threat (not bulls rings)
    if (!track.hostile && track.type === 'fighter') {
        const threat = nearestHostile(track);
        const st = fighterMeldCommitStatus(track, threat);
        if (st && threat) {
            const cColor = st.commit === 'IN RANGE' ? '#ff8800' : '#88aa88';
            const mColor = st.meld === 'IN RANGE' ? '#dddd00' : '#88aa88';
            meldCommitHtml = `
                <p><strong>vs ${threat.callsign} (${st.rangeNm}nm):</strong></p>
                <p>MELD (${st.meldNm}nm): <span style="color:${mColor}">${st.meld}</span>
                · COMMIT (${st.commitNm}nm): <span style="color:${cColor}">${st.commit}</span></p>`;
        } else {
            meldCommitHtml = '<p><em>MELD/COMMIT: no hostile for reference</em></p>';
        }
    } else if (track.hostile && fighter) {
        const st = fighterMeldCommitStatus(fighter, track);
        if (st) {
            const cColor = st.commit === 'IN RANGE' ? '#ff8800' : '#88aa88';
            const mColor = st.meld === 'IN RANGE' ? '#dddd00' : '#88aa88';
            meldCommitHtml = `
                <p><strong>${fighter.callsign} engagement (logic):</strong></p>
                <p>MELD: <span style="color:${mColor}">${st.meld}</span>
                · COMMIT: <span style="color:${cColor}">${st.commit}</span></p>`;
        }
    }

    // Prefer truth track for live BVR state
    const truth = scope.truthTracks.find(t => String(t.id) === String(track.id)) || track;
    let stateHtml = '';
    if (truth.type === 'fighter') {
        const tgt = truth.assignedTargetId
            ? scope.truthTracks.find(t => String(t.id) === String(truth.assignedTargetId))
            : null;
        const stLabel = truth.tacticalState || (truth.hostile ? 'INGRESS' : 'CAP');
        const capName = truth.capStation ? truth.capStation.name : '—';
        const hdgAim = (truth.targetHeading != null && Math.abs(truth.targetHeading - (truth.heading || 0)) > 2)
            ? ` → aim ${Math.round(truth.targetHeading)}°`
            : '';
        const defendExtra = truth.tacticalState === 'DEFEND'
            ? ` <span style="color:#ffaa44">(${truth.defendMode || 'DEFEND'})</span>`
            : '';
        const mergeTag = (truth.tacticalState === 'MERGE' || truth.tacticalState === 'GUNS')
            ? ` <span style="color:#ff9944">${truth.tacticalState}${truth.gunSolutionSec > 0 ? ` ${truth.gunSolutionSec.toFixed(1)}s` : ''}</span>`
            : '';
        const targetedTag = truth.hasTargeted
            ? ' <span style="color:#88ccff">TARGETED</span>' : '';
        const foxHoldTag = truth.lastFoxHoldReason
            ? ` <span style="color:#aa9966">HOLD:${truth.lastFoxHoldReason}</span>` : '';
        const pitbullTag = truth.inboundPitbull || truth.inboundActive
            ? ' <span style="color:#ff4444">PITBULL</span>' : '';
        const inboundTag = truth.inboundRangeNm != null
            ? ` <span style="color:#ff8888">MSL ${truth.inboundRangeNm.toFixed(0)}nm ${truth.inboundType || ''}</span>`
            : '';
        const ordnanceLine = formatOrdnanceLine(truth);
        const chaffTag = !ordnanceLine && truth.chaffRemaining != null
            ? ` · chaff ${truth.chaffRemaining}${truth.chaffMax ? '/' + truth.chaffMax : ''}`
            : '';
        stateHtml = `<p><strong>STATE:</strong> <span style="color:#66ffcc">${stLabel}</span>${defendExtra}${mergeTag}${targetedTag}${foxHoldTag}
            ${tgt ? ` → ${tgt.callsign}${tgt.isSplashed ? ' (SPLASH)' : ''}` : ''}
            ${truth.isSpiked ? ' <span style="color:#ff6666">SPIKED</span>' : ''}${pitbullTag}${inboundTag}</p>`;
        if (ordnanceLine) {
            stateHtml += `<p><strong>ORD:</strong> ${ordnanceLine}</p>`;
        }
        if (!truth.hostile) {
            stateHtml += `<p><strong>CAP:</strong> ${capName} · crank ${truth.crankSide || 'LEFT'}${chaffTag}</p>`;
        } else if (!ordnanceLine) {
            stateHtml += `<p><strong>AF:</strong> ${truth.airframe || 'SU30'}${chaffTag}</p>`;
        }
        stateHtml += `<p><strong>HDG cmd:</strong> ${Math.round(truth.heading || 0)}°${hdgAim}</p>`;
    }

    infoDiv.innerHTML = `
        <p><strong>CALLSIGN:</strong> ${track.callsign}</p>
        <p><strong>BULLSEYE:</strong> ${bulls}</p>
        ${stateHtml}
        ${braaHtml}
        ${aspectHtml}
        ${meldCommitHtml}
        <p><strong>ALTITUDE:</strong> ${(track.altitude / 1000).toFixed(0)},000 ft</p>
        <p><strong>HDG/SPD:</strong> ${Math.round(track.heading || 0)}° / ${track.speed || '—'} kts</p>
        <p><strong>STATUS:</strong> ${track.declaration || (track.hostile ? 'HOSTILE' : (track.affiliation === 'unknown' ? 'BOGEY' : 'FRIENDLY'))}</p>
        <p><strong>TAGS:</strong> ${track.isLeaker ? '<span style="color:red;">LEAKER</span>' : 'NONE'}${track.stale ? ' STALE' : ''}${truth.isSplashed ? ' SPLASH' : ''}</p>
        <hr style="border-color: #00ff00; margin: 10px 0;">
        <div style="display:flex; gap:5px; margin-bottom:10px;">
            <button type="button" data-declare="BOGEY" style="flex:1; font-size:10px;">BOGEY</button>
            <button type="button" data-declare="BANDIT" style="flex:1; font-size:10px;">BANDIT</button>
            <button type="button" data-declare="HOSTILE" style="flex:1; font-size:10px;">HOSTILE</button>
        </div>
        <button type="button" data-delete-track style="width:100%;">Delete Track</button>
    `;
}

function formatBraa(braa) {
    if (!braa) return '—';
    if (braa.text) return braa.text;
    return `${braa.bearing}/${braa.range}/${braa.altitude || '?'} ${braa.aspect || ''}`.trim();
}

function declareTrack(status) {
    if (!scope || !scope.selectedTrack) {
        alert('Select a track first');
        return;
    }
    const id = scope.selectedTrack.id;
    const truth = scope.truthTracks.find(t => String(t.id) === String(id));
    if (!truth) {
        console.warn('declareTrack: truth track not found', id);
        return;
    }

    truth.declaration = status;
    if (status === 'BOGEY') {
        truth.hostile = false;
        truth.affiliation = 'unknown';
        truth.isTargeted = false;
    } else if (status === 'BANDIT' || status === 'HOSTILE') {
        // Both are enemy for symbology; HOSTILE also marks weapons-free / targeted
        truth.hostile = true;
        truth.affiliation = 'hostile';
        if (status === 'HOSTILE') truth.isTargeted = true;
    }

    // Push into radar feed immediately so diamond/color update this frame
    if (scope.radar) {
        scope.radar._accum = 999;
        scope.tracks = scope.radar.process(scope.truthTracks, 0);
    } else {
        scope.tracks = scope.truthTracks;
    }
    scope.selectedTrack = scope.tracks.find(t => String(t.id) === String(id)) || truth;

    if (timeline) timeline.logDeclaration(id, status);
    updateTrackInfo(scope.selectedTrack);
    updateTrackList();
    refreshTimelineSummary();
    scope.render();
}

function deleteSelectedTrack() {
    if (scope.selectedTrack) {
        scope.removeTrack(scope.selectedTrack.id);
        updateTrackList();
        updatePictureSuggestion();
        updateTrackInfo(null);
    }
}

function updateTrackList() {
    const listEl = document.getElementById('trackList');
    if (scope.tracks.length === 0) {
        listEl.innerHTML = '<li style="border-left-color: #666;">No tracks on scope</li>';
        return;
    }
    listEl.innerHTML = scope.tracks.map(track => `
        <li data-select-track="${track.id}" style="border-left-color: ${track.hostile ? '#ff0000' : (track.affiliation === 'unknown' ? '#cccc00' : '#00ff00')}; cursor:pointer;">
            ${track.callsign} - BULLS ${Math.round(track.bearing)}/${Math.round(track.range)} - ${(track.altitude / 1000).toFixed(0)}K
            ${track.declaration || (track.hostile ? 'HOSTILE' : (track.affiliation === 'unknown' ? 'BOGEY' : 'FRIENDLY'))}${track.stale ? ' [STALE]' : ''}
        </li>
    `).join('');
}

function selectTrack(trackId) {
    scope.selectedTrack = scope.tracks.find(t => String(t.id) === String(trackId))
        || scope.truthTracks.find(t => String(t.id) === String(trackId))
        || null;
    scope.render();
    if (scope.updateUI) scope.updateUI();
    updateTrackInfo(scope.selectedTrack);
}

// Inline onclick + data-attribute fallbacks
window.declareTrack = declareTrack;
window.deleteSelectedTrack = deleteSelectedTrack;
window.selectTrack = selectTrack;

function updatePictureSuggestion() {
    const suggestionDiv = document.getElementById('pictureSuggestion');
    const hostileTracks = scope.tracks.filter(t => t.hostile);

    if (hostileTracks.length === 0) {
        suggestionDiv.innerHTML = '<p><em>PICTURE CLEAN</em></p>';
        return;
    }

    const groups = clusterer.cluster(hostileTracks);
    const result = pictureGen.generatePicture(groups, scope.bullseye);
    suggestionDiv.innerHTML = `<p>${result.text}</p>`;

    let details = '<div style="font-size: 11px; color: #00ff00; margin-top: 8px; border-top: 1px dashed #004400; padding-top: 5px;">';
    details += `<strong>BREAKDOWN:</strong> ${groups.length} Groups`;
    if (result.waves) details += ` / ${result.waves.length} Waves`;
    if (result.formation && result.formation.type !== 'UNKNOWN') {
        details += `<br>Formation: ${result.formation.type}`;
        if (result.formation.dimension) details += ` (${result.formation.dimension})`;
    }
    details += '</div>';
    suggestionDiv.innerHTML += details;
}

function updateTacticalState() {
    const friendlies = scope.truthTracks.filter(t => !t.hostile);
    const hostiles = scope.truthTracks.filter(t => t.hostile && !t.isSplashed);
    const tankerAnchor = (scope.hvaaAnchors || []).find(a => a.type === 'tanker') || (scope.hvaaAnchors || [])[0];
    const scramNm = tankerAnchor && tankerAnchor.scramNm != null ? tankerAnchor.scramNm : 15;
    const liveTanker = tankerAnchor && scope.findOrbitTrack
        ? scope.findOrbitTrack(tankerAnchor)
        : (scope.truthTracks || []).find(t => !t.hostile && t.type === 'tanker');

    hostiles.forEach(h => {
        let isThreat = false;
        friendlies.forEach(f => {
            const dist = scope.calculateBRAA(f.bearing, f.range, h.bearing, h.range).range;
            if (dist < 15) isThreat = true;
        });
        h.isThreat = isThreat;

        // Leaker / HVAA threat: scram around live tanker (or DAL) — not bulls commit ring
        let isLeaker = false;
        if (liveTanker) {
            const toTanker = scope.calculateBRAA(
                liveTanker.bearing, liveTanker.range, h.bearing, h.range
            ).range;
            if (toTanker < scramNm) isLeaker = true;
        } else if (tankerAnchor) {
            const toTanker = scope.calculateBRAA(
                tankerAnchor.bearing, tankerAnchor.range, h.bearing, h.range
            ).range;
            if (toTanker < scramNm) isLeaker = true;
        }
        if (scope.dal) {
            const toDal = scope.calculateBRAA(
                scope.dal.bearing, scope.dal.range, h.bearing, h.range
            ).range;
            if (toDal < 20) isLeaker = true;
        }
        h.isLeaker = isLeaker;
        if (h.isLeaker) h.isTargeted = true;
    });

    updateTrackList();
    updatePictureSuggestion();
}

setInterval(() => {
    const now = new Date();
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const el = document.getElementById('clock');
    if (el) el.textContent = `TIME: ${hours}${minutes}Z`;
}, 1000);
