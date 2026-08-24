/**
 * BC3 Tactical Scope Engine
 * Core rendering and calculation engine for 2D scope (radar feed via RadarModel)
 */

class ScopeEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Bullseye reference point (center of scope)
        this.bullseye = { x: 400, y: 400 };
        this.scale = 2; // 2 pixels = 1 nautical mile

        // Truth vs displayed tracks (TPS-75 feed filters display)
        this.truthTracks = [];
        this.tracks = []; // displayed on scope (radar feed output)
        this.radar = typeof RadarModel !== 'undefined' ? new RadarModel() : null;
        this.selectedTrack = null;
        this.showGrid = true;
        this.showBMA = false; // optional — off by default (less mid-scope clutter)
        this.showCAP = true;
        this.showSafePassage = false;
        this.showDAL = true;
        this.showEmcon = false;
        this.showMLL = true;
        this.showHvaaCircles = true;
        this.showGeography = true;
        this.showAirspace = true;
        this.showRangeRings = false; // bulls is a reference — no PPI rings from bulls

        // Theater geo (true north, equirectangular around bulls)
        this.bullseyeGeo = { lat: 38.0, lon: -115.0 };
        this.geoProjection = typeof GeoProjection !== 'undefined'
            ? new GeoProjection({
                lat: this.bullseyeGeo.lat,
                lon: this.bullseyeGeo.lon,
                pxPerNm: this.scale,
                bullseyeCanvas: this.bullseye
            })
            : null;
        this.geoLayer = typeof GeoLayer !== 'undefined' && this.geoProjection
            ? new GeoLayer(this.geoProjection)
            : null;
        this.airspaceLayer = typeof AirspaceLayer !== 'undefined' && this.geoProjection
            ? new AirspaceLayer(this.geoProjection)
            : null;

        // NTTR E–W: blue east CAPs, red from west
        this.bma = { center: this.bullseye, radius: 240 }; // 120nm
        this.capPoints = [
            { name: "CAP EAST-L", bearing: 133, range: 36, radius: 8 },
            { name: "CAP EAST-R", bearing: 119, range: 30, radius: 8 }
        ];
        this.safePassages = [
            { start: { bearing: 170, range: 95 }, end: { bearing: 150, range: 75 }, width: 15 }
        ];

        this.tacticalLines = { meld: 70, commit: 50, retrograde: 30 };
        this.fighterMeldNm = 70;
        this.fighterCommitNm = 50;
        this.mllNm = 130;
        this.emconLineNm = 90;
        this.dal = { name: "DAL", bearing: 156, range: 70 }; // ELGIN/CALC (E MOA)

        this.sectors = [
            { name: "WEST", startAngle: 225, endAngle: 315, label: "THREAT AXIS" },
            { name: "NORTH", startAngle: 315, endAngle: 45, label: "" },
            { name: "EAST", startAngle: 45, endAngle: 135, label: "FRIENDLY" },
            { name: "SOUTH", startAngle: 135, endAngle: 225, label: "" }
        ];

        this.hvaaAnchors = [
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
        ];

        // Zoom and Viewport State
        this.viewScale = 1.0;
        this.viewOffset = { x: 0, y: 0 };
        this.zoomLevels = [0.5, 1.0, 2.0, 4.0, 8.0];
        this.isPanning = false;
        this.panMode = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.sweepAngle = 0;
        this.showSweep = false; // bulls is a reference point, not a radar site
        this.showTacticalLines = false; // bulls meld/commit/retro NOT drawn by default
        this.showSectors = false;

        // Measurement Tool State
        this.measureModeActive = false;
        this.isDraggingMeasure = false;
        this.measurementStart = null;
        this.mousePos = { x: 0, y: 0 };

        // Initialize symbology renderer
        this.symbologyRenderer = new SymbologyRenderer();

        // Initialize AI Cognition (lazy-retry in updateSimulation if class loads late)
        this.pilotAI = (typeof PilotAI !== 'undefined') ? new PilotAI(this) : null;
        this.disablePilotAI = false;
        this._lastPilotError = null;
        this.timeScale = 1;
        this.timeScaleOptions = [1, 2, 4, 8, 16];
        this.missiles = [];

        // Simulation state
        this.lastUpdateTime = Date.now();
        // Accumulated sim seconds (respects timeScale) — CM / defend timers use this
        this.simTimeSec = 0;

        this.init();
    }

    init() {
        this.ensureGeoLoaded();
        this.ensureAirspaceLoaded();
        this.render();
        this.bindPointerNav();
        requestAnimationFrame(() => this.tick());
    }

    ensureGeoLoaded() {
        if (!this.geoLayer || this.geoLayer.ready || this.geoLayer.loading) return;
        // Cache-bust GeoJSON (same bust as script tags)
        this.geoLayer.load('geo/nellis_aor.json?v=34').then(() => this.render()).catch(() => {});
    }

    ensureAirspaceLoaded() {
        if (!this.airspaceLayer || this.airspaceLayer.ready || this.airspaceLayer.loading) return;
        this.airspaceLayer.load('geo/nttr_airspace.json?v=34').then(() => this.render()).catch(() => {});
    }

    setBullseyeGeo(lat, lon) {
        this.bullseyeGeo = { lat, lon };
        if (this.geoProjection) {
            this.geoProjection.setBullseyeGeo(lat, lon);
            this.geoProjection.setPxPerNm(this.scale);
            this.geoProjection.setBullseyeCanvas(this.bullseye.x, this.bullseye.y);
        }
    }

    syncGeoProjection() {
        if (!this.geoProjection) return;
        this.geoProjection.setPxPerNm(this.scale);
        this.geoProjection.setBullseyeCanvas(this.bullseye.x, this.bullseye.y);
        if (this.bullseyeGeo) {
            this.geoProjection.setBullseyeGeo(this.bullseyeGeo.lat, this.bullseyeGeo.lon);
        }
        // Single pixel path with tracks / range rings
        this.geoProjection._brToXY = (bearing, range) => this.bearingRangeToXY(bearing, range);
    }

    /**
     * Pointer-capture pan/zoom — left-drag pans, wheel zooms, click selects.
     * Previous handlers required Alt/middle button; that felt broken.
     */
    bindPointerNav() {
        const el = this.canvas;
        el.style.touchAction = 'none'; // prevent browser pan/zoom gestures

        this._ptr = {
            down: false,
            id: null,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            moved: false,
            panning: false
        };

        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pos = this.getMousePos(e);
            // Stronger steps so zoom is obvious
            const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
            this.setZoomAt(pos.screenX, pos.screenY, this.viewScale * factor);
        }, { passive: false });

        el.addEventListener('contextmenu', (e) => e.preventDefault());

        el.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;

            const mouse = this.getMousePos(e);

            if (this.measureModeActive && e.button === 0) {
                this.measurementStart = this.xyToBearingRange(mouse.x, mouse.y);
                this.isDraggingMeasure = true;
                el.setPointerCapture(e.pointerId);
                this._ptr.down = true;
                this._ptr.id = e.pointerId;
                return;
            }

            // Left / middle / right: prepare pan (left-drag = pan)
            this._ptr.down = true;
            this._ptr.id = e.pointerId;
            this._ptr.startX = e.clientX;
            this._ptr.startY = e.clientY;
            this._ptr.lastX = e.clientX;
            this._ptr.lastY = e.clientY;
            this._ptr.moved = false;
            this._ptr.panning = false;
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
        });

        el.addEventListener('pointermove', (e) => {
            this.mousePos = this.getMousePos(e);

            if (!this._ptr.down || this._ptr.id !== e.pointerId) return;

            if (this.measureModeActive && this.isDraggingMeasure) {
                return; // measurement drawn from mousePos each frame
            }

            const dxClient = e.clientX - this._ptr.lastX;
            const dyClient = e.clientY - this._ptr.lastY;
            const dist = Math.hypot(e.clientX - this._ptr.startX, e.clientY - this._ptr.startY);

            // Threshold before treating as pan (keeps click-to-select)
            if (!this._ptr.panning && dist > 4) {
                this._ptr.panning = true;
                this._ptr.moved = true;
                el.style.cursor = 'grabbing';
            }

            if (this._ptr.panning) {
                const { sx, sy } = this.canvasScale();
                this.viewOffset.x += dxClient * sx;
                this.viewOffset.y += dyClient * sy;
                this._ptr.lastX = e.clientX;
                this._ptr.lastY = e.clientY;
            }
        });

        const endPtr = (e) => {
            if (!this._ptr.down || (e.pointerId != null && this._ptr.id !== e.pointerId)) return;

            const wasPan = this._ptr.panning || this._ptr.moved;
            const measuring = this.measureModeActive && this.isDraggingMeasure;

            this._ptr.down = false;
            this.isDraggingMeasure = false;
            try { el.releasePointerCapture(e.pointerId); } catch (_) {}
            el.style.cursor = this.panMode ? 'grab' : 'crosshair';

            if (measuring) return;

            // Click without drag → select track
            if (!wasPan && e.button === 0) {
                this.selectAtClient(e.clientX, e.clientY);
            }
        };

        el.addEventListener('pointerup', endPtr);
        el.addEventListener('pointercancel', endPtr);
        el.addEventListener('lostpointercapture', () => {
            this._ptr.down = false;
            this.isDraggingMeasure = false;
        });
    }

    selectAtClient(clientX, clientY) {
        const fake = { clientX, clientY };
        const pos = this.getMousePos(fake);
        const hitSlop = 18 / Math.max(this.viewScale, 0.5);
        let clicked = false;
        for (const track of this.tracks) {
            const tp = this.bearingRangeToXY(track.bearing, track.range);
            const distance = Math.hypot(pos.x - tp.x, pos.y - tp.y);
            if (distance < hitSlop) {
                this.selectedTrack = track;
                clicked = true;
                break;
            }
        }
        if (!clicked) this.selectedTrack = null;
        this.updateUI();
    }

    canvasScale() {
        const rect = this.canvas.getBoundingClientRect();
        return {
            sx: this.canvas.width / Math.max(rect.width, 1),
            sy: this.canvas.height / Math.max(rect.height, 1),
            rect
        };
    }

    getMousePos(event) {
        const { sx, sy, rect } = this.canvasScale();
        const screenX = (event.clientX - rect.left) * sx;
        const screenY = (event.clientY - rect.top) * sy;
        const worldX = (screenX - this.viewOffset.x) / this.viewScale;
        const worldY = (screenY - this.viewOffset.y) / this.viewScale;
        return { x: worldX, y: worldY, screenX, screenY };
    }

    setZoomAt(screenX, screenY, newScale) {
        newScale = Math.max(0.25, Math.min(12, newScale));
        const old = this.viewScale || 1;
        this.viewOffset.x = screenX - (screenX - this.viewOffset.x) * (newScale / old);
        this.viewOffset.y = screenY - (screenY - this.viewOffset.y) * (newScale / old);
        this.viewScale = newScale;
    }

    zoomBy(factor) {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        this.setZoomAt(cx, cy, this.viewScale * factor);
    }

    resetView() {
        this.viewScale = 1.0;
        this.viewOffset = { x: 0, y: 0 };
    }

    // Legacy no-ops kept so old listeners do not throw if referenced
    handleWheel() {}
    handleMouseDown() {}
    handleMouseMove(event) { this.mousePos = this.getMousePos(event); }
    handleMouseUp() {}
    handleClick() {}

    tick() {
        const now = Date.now();
        const rawDt = Math.min(0.05, (now - (this.lastUpdateTime || now)) / 1000);
        this.lastUpdateTime = now;
        const scale = this.timeScale > 0 ? this.timeScale : 1;
        // Cap scaled step so huge jumps don't skip orbit/WEZ gates entirely
        const deltaTime = Math.min(0.35, rawDt * scale);

        try {
            this.updateSimulation(deltaTime, now);
        } catch (e) {
            console.error('SIM update error:', e);
            this._lastSimError = String(e && e.message ? e.message : e);
        }

        try {
            this.sweepAngle = (this.sweepAngle + deltaTime * 90) % 360;
            this.render();
            this.drawDiagnostics();
        } catch (e) {
            console.error('SIM render error:', e);
            this._lastRenderError = String(e && e.message ? e.message : e);
        }

        requestAnimationFrame(() => this.tick());
    }

    setTimeScale(scale) {
        const opts = this.timeScaleOptions || [1, 2, 4, 8, 16];
        const n = Number(scale);
        this.timeScale = opts.includes(n) ? n : 1;
        return this.timeScale;
    }

    cycleTimeScale() {
        const opts = this.timeScaleOptions || [1, 2, 4, 8, 16];
        const i = opts.indexOf(this.timeScale);
        this.timeScale = opts[(i + 1) % opts.length];
        return this.timeScale;
    }

    drawDiagnostics() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = 'rgba(0, 255, 100, 0.9)';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
            `ZOOM ${this.viewScale.toFixed(2)}x  |  Drag=pan  ·  Wheel=zoom  ·  Click=select  ·  Buttons/keys +/- arrows`,
            10,
            this.canvas.height - 10
        );
        const feed = this.radar ? this.radar.statusLabel() : 'FEED: N/A';
        const aiOn = !!(this.pilotAI && !this.disablePilotAI);
        const spd = this.timeScale != null ? this.timeScale : 1;
        const msl = (this.missiles || []).filter(m => m.isAlive && m.isAlive()).length;
        let line2 = `TRUTH ${this.truthTracks.length}  SCOPE ${this.tracks.length}  |  ${feed}  |  AI ${aiOn ? 'on' : 'off'}  |  SPD ${spd}x  |  MSL ${msl}`;
        if (this._lastSimError) line2 += `  |  ERR: ${this._lastSimError}`;
        if (this._lastPilotError) line2 += `  |  AI: ${this._lastPilotError}`;
        this.ctx.fillText(line2, 10, this.canvas.height - 26);

        if (this.showGeography && this.geoProjection && this.mousePos) {
            const ll = this.geoProjection.xyToLatLon(this.mousePos.x, this.mousePos.y);
            let geoLine = `GEO ${this.geoProjection.formatLatLon(ll.lat, ll.lon)} (true)`;
            if (this.selectedTrack) {
                const tll = this.geoProjection.bearingRangeToLatLon(
                    this.selectedTrack.bearing, this.selectedTrack.range
                );
                geoLine += `  |  SEL ${this.geoProjection.formatLatLon(tll.lat, tll.lon)}`;
            }
            // Scale check: Tonopah must sit on ~100nm ring if rings and geo share nm
            const tonopah = this.geoProjection.latLonToBearingRange(38.060, -117.087);
            geoLine += `  |  KTNX ${tonopah.bearing.toFixed(0)}/${tonopah.range.toFixed(0)} (expect ~272/99)`;
            this.ctx.fillText(geoLine, 10, this.canvas.height - 42);
        }
    }

    ensurePilotAI() {
        if (!this.pilotAI && typeof PilotAI !== 'undefined') {
            try {
                this.pilotAI = new PilotAI(this);
                this.disablePilotAI = false;
                this._lastPilotError = null;
            } catch (e) {
                this._lastPilotError = String(e && e.message ? e.message : e);
            }
        }
    }

    updateSimulation(dt, now) {
        this.lastDt = dt;
        this.simTimeSec = (this.simTimeSec || 0) + dt;

        if (typeof WaveManager !== 'undefined' && WaveManager.update) {
            try { WaveManager.update(this); } catch (e) { /* ignore */ }
        }

        // 1) Perception before AI
        try {
            this.updatePerception();
        } catch (e) { /* ignore */ }

        // 1b) Inbound missile threat flags (from last frame missile state)
        try {
            this.updateMissileThreats();
        } catch (e) { /* ignore */ }

        // 2) Pilot AI sets targetHeading this frame
        this.ensurePilotAI();
        if (this.pilotAI && !this.disablePilotAI) {
            this.truthTracks.forEach(track => {
                try {
                    this.pilotAI.update(track);
                    this._lastPilotError = null;
                } catch (e) {
                    this._lastPilotError = String(e && e.message ? e.message : e);
                    console.warn('PilotAI track error', track && track.callsign, e);
                }
            });
        }

        // 3) Physics integrate
        this.truthTracks.forEach(track => {
            if (track.isDormant) return;
            if (!track.history) track.history = [];

            if (track.speed && track.heading !== undefined) {
                if (track.orbitAnchor) {
                    try { this.updateOrbitLogic(track, dt); } catch (e) { /* keep sim alive */ }
                }

                if (track.targetHeading !== undefined && track.targetHeading !== track.heading) {
                    let turnRate = 1.5;
                    if (track.orbitAnchor) turnRate = 4.0;
                    else if (track.type === 'fighter') {
                        const st = track.tacticalState;
                        if (st === 'DEFEND') {
                            const prof = typeof getDefensiveProfile === 'function'
                                ? getDefensiveProfile(track) : null;
                            turnRate = prof && prof.turnRateDefend ? prof.turnRateDefend : 6.5;
                        } else {
                            turnRate = (st === 'CRANK' || st === 'COMMITTED' || st === 'WEZ' || st === 'MELD')
                                ? 5.0 : 3.5;
                        }
                    }
                    const turnAmount = turnRate * dt;

                    let diff = (track.targetHeading - track.heading + 360) % 360;
                    if (diff < turnAmount || diff > 360 - turnAmount) {
                        track.heading = track.targetHeading;
                    } else {
                        track.heading = (track.heading + (diff > 180 ? -turnAmount : turnAmount) + 360) % 360;
                    }
                    track.currentSpeed = track.speed * 0.95;
                } else {
                    track.currentSpeed = track.speed;
                }

                const nmPerSec = (track.currentSpeed || track.speed) / 3600;
                const distanceNM = nmPerSec * dt;
                const rad = (track.heading - 90) * (Math.PI / 180);
                const dx = distanceNM * Math.cos(rad);
                const dy = distanceNM * Math.sin(rad);

                const currentXY = this.bearingRangeToXY(track.bearing, track.range);
                const newBR = this.xyToBearingRange(
                    currentXY.x + dx * this.scale,
                    currentXY.y + dy * this.scale
                );
                track.bearing = newBR.bearing;
                track.range = newBR.range;

                if (!track.lastHistoryUpdate || now - track.lastHistoryUpdate > 2000) {
                    const pos = this.bearingRangeToXY(track.bearing, track.range);
                    track.history.push({ x: pos.x, y: pos.y });
                    if (track.history.length > 5) track.history.shift();
                    track.lastHistoryUpdate = now;
                }
            }
        });

        // 4) Missiles after tracks move
        this.updateMissiles(dt);

        if (this.radar) {
            const fed = this.radar.process(this.truthTracks, dt);
            const selId = this.selectedTrack ? this.selectedTrack.id : null;
            this.tracks = fed;
            if (selId != null) {
                this.selectedTrack = this.tracks.find(t => String(t.id) === String(selId)) || null;
            }
        } else {
            this.tracks = this.truthTracks;
        }
    }

    updatePerception() {
        // Reset perception / spike each tick
        this.truthTracks.forEach(t => {
            t.isPerceivedByFriendlies = false;
            t.perceivedTracks = [];
            t.isSpiked = false;
        });

        const alive = this.truthTracks.filter(t => !t.isSplashed && !t.isDormant);
        const friendlies = alive.filter(t => !t.hostile);
        const hostiles = alive.filter(t => t.hostile && !t.isDormant);

        friendlies.forEach(f => {
            f.perceivedTracks = [];

            alive.forEach(target => {
                if (f === target) return;

                const braa = this.calculateBRAA(f.bearing, f.range, target.bearing, target.range);
                if (!braa || f.heading === undefined || f.heading === null) return;

                let relativeBearing = (braa.bearing - f.heading + 360) % 360;
                if (relativeBearing > 180) relativeBearing -= 360;

                const withinCone = Math.abs(relativeBearing) <= 60;
                const withinRange = braa.range <= 80;

                if (withinCone && withinRange) {
                    f.perceivedTracks.push(target.id);
                    if (target.hostile) target.isPerceivedByFriendlies = true;
                }
            });
        });

        // Flanker-class search: hostiles perceive blue fighters + HVAA (~90nm default, ~40nm vs F-35 VLO proxy)
        const redDetectNmDefault = 90;
        const redDetectVsF35Nm = 40;
        const redConeDeg = 90;
        hostiles.forEach(h => {
            if (h.type !== 'fighter') return;
            h.perceivedTracks = [];
            friendlies.forEach(f => {
                if (f.type !== 'fighter' && f.type !== 'tanker' && f.type !== 'awacs' && f.type !== 'isr') {
                    return;
                }
                const braa = this.calculateBRAA(h.bearing, h.range, f.bearing, f.range);
                if (!braa || h.heading === undefined || h.heading === null) return;
                let relativeBearing = (braa.bearing - h.heading + 360) % 360;
                if (relativeBearing > 180) relativeBearing -= 360;
                let detectNm = redDetectNmDefault;
                if (f.type === 'fighter') {
                    const af = String(f.airframe || '').toUpperCase();
                    if (af === 'F35' || af === 'F-35') detectNm = redDetectVsF35Nm;
                }
                if (Math.abs(relativeBearing) <= redConeDeg && braa.range <= detectNm) {
                    h.perceivedTracks.push(f.id);
                }
            });
        });

        // Mutual spike cues (defense bias for both sides)
        hostiles.forEach(h => {
            friendlies.forEach(f => {
                if (f.type !== 'fighter') return;
                const braa = this.calculateBRAA(h.bearing, h.range, f.bearing, f.range);
                if (!braa || h.heading === undefined || h.heading === null) return;
                let relativeBearing = (braa.bearing - h.heading + 360) % 360;
                if (relativeBearing > 180) relativeBearing -= 360;
                if (Math.abs(relativeBearing) <= 60 && braa.range <= 40) {
                    f.isSpiked = true;
                }
            });
        });
        friendlies.forEach(f => {
            if (f.type !== 'fighter') return;
            hostiles.forEach(h => {
                if (h.type !== 'fighter') return;
                const braa = this.calculateBRAA(f.bearing, f.range, h.bearing, h.range);
                if (!braa || f.heading === undefined || f.heading === null) return;
                let relativeBearing = (braa.bearing - f.heading + 360) % 360;
                if (relativeBearing > 180) relativeBearing -= 360;
                if (Math.abs(relativeBearing) <= 60 && braa.range <= 40) {
                    h.isSpiked = true;
                }
            });
        });
    }

    /**
     * Horizontal racetrack (default legs 090/270). Chase a look-ahead point on the
     * northern lane so SHELL stays E–W and does not drift toward the threat.
     */
    updateOrbitLogic(track, dt) {
        const anchor = track.orbitAnchor;
        if (!anchor) return;

        track.isManeuvering = false;

        const legHdg = Number(anchor.legHeading != null ? anchor.legHeading : 90);
        const half = Number(anchor.legLength != null ? anchor.legLength : 25) / 2;
        const laneCross = 5; // nm north of orbit center (toward bulls)

        const center = this.bearingRangeToXY(Number(anchor.bearing), Number(anchor.range));
        const pos = this.bearingRangeToXY(track.bearing, track.range);
        const rad = (legHdg - 90) * (Math.PI / 180);
        const ax = Math.cos(rad);
        const ay = Math.sin(rad);
        // Left of eastbound = north (toward bulls)
        const cx = ay;
        const cy = -ax;

        const dxNm = (pos.x - center.x) / this.scale;
        const dyNm = (pos.y - center.y) / this.scale;
        const along = dxNm * ax + dyNm * ay;

        if (!track.orbitLeg) track.orbitLeg = 'EAST';

        if (track.orbitLeg === 'EAST' && along >= half) track.orbitLeg = 'WEST';
        if (track.orbitLeg === 'WEST' && along <= -half) track.orbitLeg = 'EAST';

        const look = 10;
        const targetAlong = track.orbitLeg === 'EAST'
            ? Math.min(along + look, half)
            : Math.max(along - look, -half);

        const tx = center.x + (targetAlong * ax + laneCross * cx) * this.scale;
        const ty = center.y + (targetAlong * ay + laneCross * cy) * this.scale;
        let hdg = Math.atan2(ty - pos.y, tx - pos.x) * (180 / Math.PI) + 90;
        if (hdg < 0) hdg += 360;
        track.targetHeading = hdg;
    }

    /** Live tanker (or HVAA) for an orbit anchor — skips splashed tracks. */
    findOrbitTrack(anchor) {
        const alive = (t) => !t.isSplashed;
        const truth = (this.truthTracks || []).filter(alive);
        const byAnchor = truth.find(t => t.orbitAnchor && (
            t.orbitAnchor === anchor
            || (anchor && t.orbitAnchor.name === anchor.name)
        ));
        if (byAnchor) return byAnchor;
        if (!anchor || anchor.type === 'tanker' || !anchor.type) {
            return truth.find(t => !t.hostile && t.type === 'tanker') || null;
        }
        return truth.find(t => !t.hostile && t.type === anchor.type) || null;
    }

    /** WVR gun kill — splash target and return timeline detail. */
    applyGunKill(shooter, target) {
        if (!shooter || !target || target.isSplashed) return null;
        target.isSplashed = true;
        target.isTargeted = false;
        shooter.gunSolutionSec = 0;
        return {
            trackId: shooter.id,
            callsign: shooter.callsign,
            targetId: target.id,
            targetCallsign: target.callsign,
            weapon: 'gun'
        };
    }

    render() {
        this.clearCanvas();

        this.ctx.save();
        try {
            this.ctx.translate(this.viewOffset.x, this.viewOffset.y);
            this.ctx.scale(this.viewScale, this.viewScale);

            this.drawScopeBackdrop();
            this.syncGeoProjection();
            if (this.showGeography && this.geoLayer) this.geoLayer.draw(this.ctx);
            if (this.showAirspace && this.airspaceLayer) {
                this.airspaceLayer.draw(this.ctx, {
                    viewScale: this.viewScale,
                    pxPerNm: this.scale
                });
            }
            if (this.showSectors) this.drawSectors();
            if (this.showGrid) this.drawGrid();
            if (this.showRangeRings) this.drawRangeRings();
            this.drawBearingTicks();
            if (this.showEmcon) this.drawEmconLine();
            if (this.showBMA) this.drawBMA();
            if (this.showMLL) this.drawMLL();
            if (this.showCAP) this.drawCAPPoints();
            if (this.showSafePassage) this.drawSafePassages();
            if (this.showTacticalLines) this.drawTacticalLines();
            this.drawHvaaAnchors();
            if (this.showDAL) this.drawDAL();
            if (this.showSweep) this.drawRadarSweep();
            this.drawBullseye();
            this.drawTracks();
            this.drawMissiles();
            this.drawMeasurement();
        } catch (e) {
            console.error("Render error:", e);
        } finally {
            this.ctx.restore();
        }
    }

    clearCanvas() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // CRT / tactical display black-green
        const g = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 40,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.7
        );
        g.addColorStop(0, '#041208');
        g.addColorStop(0.7, '#020805');
        g.addColorStop(1, '#010302');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawScopeBackdrop() {
        // Soft phosphor vignette in world space around bullseye
        const grd = this.ctx.createRadialGradient(
            this.bullseye.x, this.bullseye.y, 20,
            this.bullseye.x, this.bullseye.y, 420
        );
        grd.addColorStop(0, 'rgba(0, 40, 18, 0.35)');
        grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = grd;
        this.ctx.beginPath();
        this.ctx.arc(this.bullseye.x, this.bullseye.y, 420, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawRadarSweep() {
        const radius = 220;
        const rad = (this.sweepAngle - 90) * Math.PI / 180;
        const x = this.bullseye.x + radius * Math.cos(rad);
        const y = this.bullseye.y + radius * Math.sin(rad);

        const sweep = this.ctx.createRadialGradient(
            this.bullseye.x, this.bullseye.y, 0,
            this.bullseye.x, this.bullseye.y, radius
        );
        // wedge via clipped path
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(this.bullseye.x, this.bullseye.y);
        this.ctx.arc(this.bullseye.x, this.bullseye.y, radius, rad - 0.35, rad);
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(0, 255, 80, 0.06)';
        this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.45)';
        this.ctx.lineWidth = 1.5 / Math.max(this.viewScale, 0.5);
        this.ctx.beginPath();
        this.ctx.moveTo(this.bullseye.x, this.bullseye.y);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawGrid() {
        if (!this.showGrid) return;

        this.ctx.strokeStyle = 'rgba(0, 80, 40, 0.25)';
        this.ctx.lineWidth = 0.5 / Math.max(this.viewScale, 0.5);

        for (let x = 0; x <= this.canvas.width; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.canvas.height; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawBearingTicks() {
        const maxR = 250; // 125nm at scale 2
        this.ctx.strokeStyle = 'rgba(0, 180, 90, 0.55)';
        this.ctx.fillStyle = 'rgba(0, 220, 110, 0.85)';
        this.ctx.font = `${11 / Math.max(this.viewScale, 0.7)}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let brg = 0; brg < 360; brg += 30) {
            const rad = (brg - 90) * Math.PI / 180;
            const inner = maxR - (brg % 90 === 0 ? 12 : 6);
            const x0 = this.bullseye.x + inner * Math.cos(rad);
            const y0 = this.bullseye.y + inner * Math.sin(rad);
            const x1 = this.bullseye.x + maxR * Math.cos(rad);
            const y1 = this.bullseye.y + maxR * Math.sin(rad);

            this.ctx.lineWidth = (brg % 90 === 0 ? 1.5 : 1) / Math.max(this.viewScale, 0.5);
            this.ctx.beginPath();
            this.ctx.moveTo(x0, y0);
            this.ctx.lineTo(x1, y1);
            this.ctx.stroke();

            if (brg % 90 === 0) {
                const lx = this.bullseye.x + (maxR + 14) * Math.cos(rad);
                const ly = this.bullseye.y + (maxR + 14) * Math.sin(rad);
                const label = brg === 0 ? 'N 000' : String(brg).padStart(3, '0');
                this.ctx.fillText(label, lx, ly);
            }
        }
    }

    drawSectors() {
        this.ctx.strokeStyle = 'rgba(40, 70, 90, 0.5)';
        this.ctx.lineWidth = 1 / Math.max(this.viewScale, 0.5);
        this.ctx.setLineDash([8, 6]);

        this.sectors.forEach(sector => {
            const startRad = (sector.startAngle - 90) * (Math.PI / 180);
            this.ctx.beginPath();
            this.ctx.moveTo(this.bullseye.x, this.bullseye.y);
            this.ctx.lineTo(
                this.bullseye.x + 400 * Math.cos(startRad),
                this.bullseye.y + 400 * Math.sin(startRad)
            );
            this.ctx.stroke();

            let span = sector.endAngle - sector.startAngle;
            if (span < 0) span += 360;
            const mid = (sector.startAngle + span / 2 - 90) * (Math.PI / 180);
            const labelX = this.bullseye.x + 170 * Math.cos(mid);
            const labelY = this.bullseye.y + 170 * Math.sin(mid);
            this.ctx.fillStyle = 'rgba(0, 120, 160, 0.7)';
            this.ctx.font = '9px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(sector.name, labelX, labelY);
            this.ctx.fillText(sector.label, labelX, labelY + 11);
        });

        this.ctx.setLineDash([]);
    }

    drawTacticalLines() {
        // Debug-only bulls-centric meld/commit/retro (off by default)
        const rings = [
            { range: this.tacticalLines.meld, color: 'rgba(220, 200, 40, 0.55)', label: 'MELD' },
            { range: this.tacticalLines.commit, color: 'rgba(255, 140, 0, 0.55)', label: 'COMMIT' },
            { range: this.tacticalLines.retrograde, color: 'rgba(255, 60, 60, 0.5)', label: 'RETRO' }
        ];

        rings.forEach(line => {
            const radius = line.range * this.scale;
            this.ctx.strokeStyle = line.color;
            this.ctx.lineWidth = 1 / Math.max(this.viewScale, 0.5);
            this.ctx.setLineDash([4, 8]);
            this.ctx.beginPath();
            this.ctx.arc(this.bullseye.x, this.bullseye.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.fillStyle = line.color;
            this.ctx.font = '9px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(line.label, this.bullseye.x + radius + 3, this.bullseye.y - 4);
        });
        this.ctx.setLineDash([]);
    }

    drawMLL() {
        if (!this.mllNm) return;
        const radius = this.mllNm * this.scale;
        const inv = 1 / Math.max(this.viewScale, 0.5);
        this.ctx.strokeStyle = 'rgba(0, 220, 255, 0.75)';
        this.ctx.lineWidth = 1.6 * inv;
        this.ctx.setLineDash([12, 6]);
        this.ctx.beginPath();
        this.ctx.arc(this.bullseye.x, this.bullseye.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(0, 230, 255, 0.95)';
        this.ctx.font = `bold ${10 * inv}px monospace`;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`MLL ${this.mllNm}nm`, this.bullseye.x + radius + 4, this.bullseye.y - 6);
    }

    drawHvaaAnchors() {
        this.hvaaAnchors.forEach(anchor => {
            const anchorPos = this.bearingRangeToXY(anchor.bearing, anchor.range);
            const inv = 1 / Math.max(this.viewScale, 0.5);
            const legHdg = anchor.legHeading != null ? anchor.legHeading : 90;
            const half = ((anchor.legLength || 25) / 2) * this.scale;
            const halfW = 5 * this.scale;

            // Slide/scram ALWAYS on live tanker position (truth), not the orbit box
            if (this.showHvaaCircles) {
                const live = this.findOrbitTrack(anchor);
                if (live && !live.isSplashed) {
                    const circlePos = this.bearingRangeToXY(live.bearing, live.range);
                    const slideNm = anchor.slideNm != null ? anchor.slideNm : 25;
                    const scramNm = anchor.scramNm != null ? anchor.scramNm : 15;

                    this.ctx.setLineDash([8, 5]);
                    this.ctx.strokeStyle = 'rgba(255, 200, 60, 0.7)';
                    this.ctx.lineWidth = 1.4 * inv;
                    this.ctx.beginPath();
                    this.ctx.arc(circlePos.x, circlePos.y, slideNm * this.scale, 0, Math.PI * 2);
                    this.ctx.stroke();

                    this.ctx.setLineDash([4, 4]);
                    this.ctx.strokeStyle = 'rgba(255, 70, 70, 0.75)';
                    this.ctx.beginPath();
                    this.ctx.arc(circlePos.x, circlePos.y, scramNm * this.scale, 0, Math.PI * 2);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);

                    this.ctx.fillStyle = 'rgba(255, 200, 60, 0.9)';
                    this.ctx.font = `${9 * inv}px monospace`;
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText('SLIDE', circlePos.x + slideNm * this.scale + 3, circlePos.y - 4);
                    this.ctx.fillStyle = 'rgba(255, 90, 90, 0.95)';
                    this.ctx.fillText('SCRAM', circlePos.x + scramNm * this.scale + 3, circlePos.y + 12);
                }
            }

            // Planned racetrack box at anchor (E–W when legHeading=090)
            this.ctx.save();
            this.ctx.translate(anchorPos.x, anchorPos.y);
            this.ctx.rotate((legHdg - 90) * Math.PI / 180);
            this.ctx.strokeStyle = 'rgba(180, 180, 180, 0.85)';
            this.ctx.lineWidth = 1.2 * inv;
            this.ctx.beginPath();
            this.ctx.moveTo(-half, -halfW);
            this.ctx.lineTo(half, -halfW);
            this.ctx.arc(half, 0, halfW, -Math.PI / 2, Math.PI / 2, false);
            this.ctx.lineTo(-half, halfW);
            this.ctx.arc(-half, 0, halfW, Math.PI / 2, -Math.PI / 2, false);
            this.ctx.stroke();
            this.ctx.restore();

            this.ctx.fillStyle = '#cccccc';
            this.ctx.font = `bold ${10 * inv}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(anchor.name, anchorPos.x, anchorPos.y - halfW - 14 * inv);
        });
    }

    drawMeasurement() {
        if (!this.measureModeActive || !this.isDraggingMeasure || !this.measurementStart) return;

        const start = this.bearingRangeToXY(this.measurementStart.bearing, this.measurementStart.range);
        const end = this.mousePos;

        // Calculate Range (Euclidean distance * scaleFactor)
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const range = Math.sqrt(dx * dx + dy * dy) / this.scale;

        // Calculate Bearing (Magnetic North where Up = 000)
        let radians = Math.atan2(dx, start.y - end.y);
        let degrees = radians * (180 / Math.PI);
        let bearing = Math.round((degrees + 360) % 360);

        // Tactical Color Integration
        let tacticalColor = '#00ff00'; // Green: > 45 NM
        if (range < 15) {
            tacticalColor = '#ff0000'; // Red: < 15 NM (Threat)
        } else if (range < 45) {
            tacticalColor = '#ffff00'; // Yellow: 15-45 NM (Inside Meld)
        }

        // Render Vector Line
        this.ctx.strokeStyle = tacticalColor;
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Render Data Block with background for readability
        const label = `${bearing.toString().padStart(3, '0')}°(M) / ${range.toFixed(1)} NM`;
        const textWidth = this.ctx.measureText(label).width;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(end.x + 10, end.y + 5, textWidth + 10, 20);

        this.ctx.fillStyle = tacticalColor;
        this.ctx.font = 'bold 11px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(label, end.x + 15, end.y + 19);
    }

    drawBullseye() {
        // Bullseye as distinct reference, not another random circle
        this.ctx.strokeStyle = '#00ff66';
        this.ctx.fillStyle = '#00ff66';
        this.ctx.lineWidth = 1.5 / Math.max(this.viewScale, 0.5);

        this.ctx.beginPath();
        this.ctx.arc(this.bullseye.x, this.bullseye.y, 4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.moveTo(this.bullseye.x - 14, this.bullseye.y);
        this.ctx.lineTo(this.bullseye.x + 14, this.bullseye.y);
        this.ctx.moveTo(this.bullseye.x, this.bullseye.y - 14);
        this.ctx.lineTo(this.bullseye.x, this.bullseye.y + 14);
        this.ctx.stroke();

        this.ctx.font = '9px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('BULLS', this.bullseye.x + 16, this.bullseye.y - 6);
    }

    drawRangeRings() {
        // Primary PPI rings — thin green, labeled in NM (outer rings when zoomed out for AOR)
        let ringsNm = [25, 50, 75, 100, 125, 150, 175];
        if (this.viewScale < 0.85) ringsNm = ringsNm.concat([200, 250, 300]);
        if (this.viewScale < 0.55) ringsNm = ringsNm.concat([400, 500, 600]);
        this.ctx.setLineDash([]);

        ringsNm.forEach((nm, i) => {
            const radius = nm * this.scale;
            const outer = i === ringsNm.length - 1;
            this.ctx.strokeStyle = outer
                ? 'rgba(0, 200, 90, 0.55)'
                : 'rgba(0, 160, 70, 0.35)';
            this.ctx.lineWidth = (outer ? 1.4 : 1) / Math.max(this.viewScale, 0.5);
            this.ctx.beginPath();
            this.ctx.arc(this.bullseye.x, this.bullseye.y, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.fillStyle = 'rgba(0, 210, 100, 0.75)';
            this.ctx.font = '10px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${nm}nm`, this.bullseye.x + radius + 4, this.bullseye.y + 3);
        });
    }

    drawBMA() {
        this.ctx.strokeStyle = 'rgba(255, 120, 40, 0.65)';
        this.ctx.lineWidth = 1.5 / Math.max(this.viewScale, 0.5);
        this.ctx.setLineDash([6, 4]);
        this.ctx.beginPath();
        this.ctx.arc(this.bma.center.x, this.bma.center.y, this.bma.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(255, 120, 40, 0.8)';
        this.ctx.font = '11px monospace';
        this.ctx.fillText('BMA', this.bma.center.x - 12, this.bma.center.y - this.bma.radius - 8);
    }

    drawEmconLine() {
        if (!this.emconLineNm) return;
        const radius = this.emconLineNm * this.scale;
        this.ctx.strokeStyle = 'rgba(180, 100, 255, 0.7)';
        this.ctx.lineWidth = 1.5 / Math.max(this.viewScale, 0.5);
        this.ctx.setLineDash([10, 6]);
        this.ctx.beginPath();
        this.ctx.arc(this.bullseye.x, this.bullseye.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(200, 140, 255, 0.9)';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('EMCON', this.bullseye.x + radius + 3, this.bullseye.y + 12);
    }

    drawDAL() {
        if (!this.dal) return;
        const pos = this.bearingRangeToXY(this.dal.bearing, this.dal.range);
        const inv = 1 / Math.max(this.viewScale, 0.5);

        this.ctx.save();
        this.ctx.translate(pos.x, pos.y);
        this.ctx.strokeStyle = '#ffcc00';
        this.ctx.fillStyle = 'rgba(255, 200, 0, 0.25)';
        this.ctx.lineWidth = 2 * inv;
        this.ctx.beginPath();
        this.ctx.rect(-10 * inv, -10 * inv, 20 * inv, 20 * inv);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.font = `bold ${11 * inv}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.dal.name || 'DAL', 0, -14 * inv);
        this.ctx.restore();
    }

    drawCAPPoints() {
        this.capPoints.forEach(cap => {
            const pos = this.bearingRangeToXY(cap.bearing, cap.range);
            const inv = 1 / Math.max(this.viewScale, 0.5);
            // Small station marker only (not a large mid-scope disc)
            const r = Math.max(5, Math.min(cap.radius || 8, 10)) * inv;

            this.ctx.strokeStyle = '#00aaff';
            this.ctx.lineWidth = 1.4 * inv;
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(pos.x - 5 * inv, pos.y);
            this.ctx.lineTo(pos.x + 5 * inv, pos.y);
            this.ctx.moveTo(pos.x, pos.y - 5 * inv);
            this.ctx.lineTo(pos.x, pos.y + 5 * inv);
            this.ctx.stroke();

            this.ctx.fillStyle = '#00aaff';
            this.ctx.font = `bold ${9 * inv}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(cap.name, pos.x, pos.y - r - 8 * inv);
        });
    }

    drawSafePassages() {
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
        this.ctx.lineWidth = 1;

        this.safePassages.forEach(passage => {
            const start = this.bearingRangeToXY(passage.start.bearing, passage.start.range);
            const end = this.bearingRangeToXY(passage.end.bearing, passage.end.range);

            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const angle = Math.atan2(dy, dx);
            const w = (passage.width / 2) * this.scale;

            // Draw corridor polygon
            this.ctx.beginPath();
            this.ctx.moveTo(start.x + w * Math.cos(angle - Math.PI / 2), start.y + w * Math.sin(angle - Math.PI / 2));
            this.ctx.lineTo(end.x + w * Math.cos(angle - Math.PI / 2), end.y + w * Math.sin(angle - Math.PI / 2));
            this.ctx.lineTo(end.x + w * Math.cos(angle + Math.PI / 2), end.y + w * Math.sin(angle + Math.PI / 2));
            this.ctx.lineTo(start.x + w * Math.cos(angle + Math.PI / 2), start.y + w * Math.sin(angle + Math.PI / 2));
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.fill();
        });
    }

    drawTracks() {
        this.tracks.forEach(track => {
            // Scope shows radar feed tracks — do NOT hide hostiles behind fighter perception
            const pos = this.bearingRangeToXY(track.bearing, track.range);

            if (track.history && track.history.length > 1) {
                this.symbologyRenderer.renderMotionTrail(this.ctx, track);
            }

            const isSelected = this.selectedTrack && String(this.selectedTrack.id) === String(track.id);
            const symbolSize = this.symbologyRenderer.renderSymbol(
                this.ctx,
                track,
                pos.x,
                pos.y,
                isSelected,
                this.viewScale
            );

            this.symbologyRenderer.renderDataBlock(
                this.ctx,
                track,
                pos.x,
                pos.y,
                symbolSize.width,
                this.viewScale
            );

            if (track.chaffUntilSim != null && this.simTimeSec < track.chaffUntilSim) {
                const inv = 1 / Math.max(this.viewScale, 0.5);
                this.ctx.save();
                this.ctx.font = `${9 * inv}px monospace`;
                this.ctx.fillStyle = 'rgba(255, 220, 80, 0.95)';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('CHAFF', pos.x, pos.y - 18 * inv);
                this.ctx.restore();
            } else if (track.chaffUntil && Date.now() < track.chaffUntil) {
                const inv = 1 / Math.max(this.viewScale, 0.5);
                this.ctx.save();
                this.ctx.font = `${9 * inv}px monospace`;
                this.ctx.fillStyle = 'rgba(255, 220, 80, 0.95)';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('CHAFF', pos.x, pos.y - 18 * inv);
                this.ctx.restore();
            }
        });
    }

    addTrack(bearing, range, altitude, callsign, hostile = false, type = 'fighter', heading = 180, speed = 350) {
        const track = {
            id: `T${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
            bearing,
            range,
            altitude,
            callsign,
            hostile,
            affiliation: hostile ? 'hostile' : 'friendly',
            type, // fighter, bomber, tanker, isr, awacs, sam
            heading,
            speed,
            history: [] // For motion trails
        };
        this.truthTracks.push(track);
        if (this.radar) {
            this.radar._accum = 999;
            this.tracks = this.radar.process(this.truthTracks, 0);
        } else {
            this.tracks = this.truthTracks;
        }
        this.render();
        return track;
    }

    removeTrack(trackId) {
        const id = String(trackId);
        this.truthTracks = this.truthTracks.filter(t => String(t.id) !== id);
        this.tracks = this.tracks.filter(t => String(t.id) !== id);
        if (this.selectedTrack && String(this.selectedTrack.id) === id) {
            this.selectedTrack = null;
        }
        this.render();
    }

    clearAllTracks() {
        this.truthTracks = [];
        this.tracks = [];
        this.missiles = [];
        this.selectedTrack = null;
        this.scenarioWaves = [];
        this.releasedWaveIds = new Set();
        this.simTimeSec = 0;
        if (this.radar) {
            this.radar._lastFeed = [];
            this.radar._accum = 0;
        }
        this.render();
    }

    /**
     * Spawn FOX3 (or similar) from shooter toward target.
     * @returns {MissileModel|null}
     */
    spawnMissile({ shooter, target, type = 'FOX3' }) {
        if (typeof MissileModel === 'undefined' || !shooter || !target) return null;

        const canFire = typeof canFireOrdnance === 'function'
            ? canFireOrdnance(shooter, type)
            : true;
        if (!canFire) {
            const tl = this.timeline;
            if (tl) {
                tl.log('ordnance_empty', {
                    trackId: shooter.id,
                    callsign: shooter.callsign,
                    type: typeof ordnanceKey === 'function' ? ordnanceKey(type) : type
                });
            }
            return null;
        }

        const opts = { shooter, target, type };
        const t = String(type || 'FOX3').toUpperCase();
        if (t === 'FOX1' || t === 'R27') {
            opts.type = 'FOX1';
            opts.guidance = 'SARH';
            opts.activeNm = 0;
            opts.maxFlightSec = 55;
            opts.sarhBreakDeg = 60;
            opts.sarhBreakSec = 3;
        } else if (t === 'R77' || t === 'FOX3') {
            // Training proxy: AIM-120 earlier pitbull + slightly hotter terminal vs R-77
            // (do not reduce red WEZ range — only terminal geometry)
            if (t === 'FOX3') {
                opts.type = 'FOX3';
                opts.guidance = 'ACTIVE';
                opts.activeNm = 8;
                opts.turnRateDeg = 16;
                opts.maxFlightSec = 70;
                opts.killNm = 1.2;
            } else {
                opts.type = 'R77';
                opts.guidance = 'ACTIVE';
                opts.activeNm = 10;
                opts.turnRateDeg = 14;
                opts.maxFlightSec = 50;
                opts.killNm = 1.5;
            }
        }

        const consumed = typeof consumeOrdnance === 'function'
            ? consumeOrdnance(shooter, type)
            : { ok: true, low: false };
        if (!consumed.ok) return null;

        const tl = this.timeline;
        if (consumed.low && tl) {
            tl.log('ordnance_low', {
                trackId: shooter.id,
                callsign: shooter.callsign,
                type: consumed.key,
                remaining: consumed.remaining
            });
        }

        const braa = this.calculateBRAA(shooter.bearing, shooter.range, target.bearing, target.range);
        const launchHeading = shooter.heading != null ? shooter.heading : 0;
        opts.launchHeading = launchHeading;
        let offBore = (braa.bearing - launchHeading + 360) % 360;
        if (offBore > 180) offBore -= 360;
        opts.boostSec = Math.abs(offBore) > 45 ? 1.5 : 1.0;

        const m = new MissileModel(opts);
        m.bearing = shooter.bearing;
        m.range = shooter.range;
        const spawnPos = this.bearingRangeToXY(shooter.bearing, shooter.range);
        m.history.push({ x: spawnPos.x, y: spawnPos.y });
        this.missiles.push(m);
        return m;
    }

    updateMissiles(dt) {
        if (!this.missiles || !this.missiles.length) return;
        const tl = this.timeline;
        this.missiles.forEach(m => {
            try {
                const ev = m.update(this, dt) || {};
                if (ev.skosh) {
                    if (tl) tl.log('skosh', ev.skosh);
                    const shooter = this.truthTracks.find(t => String(t.id) === String(m.shooterId));
                    if (shooter && shooter.type === 'fighter') {
                        if (shooter.tacticalState === 'CRANK' || shooter.tacticalState === 'WEZ') {
                            shooter.tacticalState = 'SKOSH';
                            shooter.skoshUntil = Date.now() + 8000;
                            shooter.pendingSkoshMissile = false;
                        }
                    }
                    if (ev.skosh.pitbull) {
                        const target = this.truthTracks.find(t =>
                            String(t.id) === String(m.targetId)
                        );
                        if (target) {
                            target.inboundPitbull = true;
                            target.inboundActive = true;
                            if (tl) {
                                tl.log('pitbull', {
                                    targetId: target.id,
                                    targetCallsign: target.callsign,
                                    missileId: m.id,
                                    type: m.type,
                                    rangeNm: ev.skosh.rangeNm
                                });
                            }
                        }
                    }
                }
                if (ev.missile_defeat && tl) {
                    tl.log('missile_defeat', ev.missile_defeat);
                }
                if (ev.splash && tl) tl.log('splash', ev.splash);
            } catch (e) {
                console.warn('Missile update error', e);
            }
        });
        this.missiles = this.missiles.filter(m => m.isVisible());
    }

    /** Alive missiles inbound to a track. */
    getInboundMissiles(trackId) {
        return (this.missiles || []).filter(m =>
            m.isAlive()
            && String(m.targetId) === String(trackId)
        );
    }

    /** Nearest inbound threat for fighters (detect range from profile). */
    getInboundThreat(track) {
        const inbound = this.getInboundMissiles(track.id);
        if (!inbound.length) return null;
        let best = null;
        let bestR = Infinity;
        inbound.forEach(m => {
            const r = m.rangeToTarget != null ? m.rangeToTarget : Infinity;
            if (r < bestR) {
                bestR = r;
                best = m;
            }
        });
        return best ? { missile: best, rangeNm: bestR } : null;
    }

    /** Set per-fighter inbound flags for pilot AI / UI. */
    updateMissileThreats() {
        const fighters = (this.truthTracks || []).filter(t =>
            t.type === 'fighter' && !t.isSplashed
        );
        fighters.forEach(t => {
            t.inboundMissileId = null;
            t.inboundRangeNm = null;
            t.inboundActive = false;
            t.inboundType = null;
            t.inboundPitbull = false;
        });

        fighters.forEach(t => {
            const profileFn = typeof getDefensiveProfile === 'function'
                ? getDefensiveProfile : () => ({ detectSupportNm: 30 });
            const profile = profileFn(t);
            const threat = this.getInboundThreat(t);
            if (!threat) return;

            const m = threat.missile;
            const detectNm = profile.detectSupportNm || 30;
            const canDetect = m.state === 'ACTIVE'
                || threat.rangeNm <= detectNm;

            if (!canDetect) return;

            t.inboundMissileId = m.id;
            t.inboundRangeNm = threat.rangeNm;
            t.inboundType = m.type;
            t.inboundActive = m.state === 'ACTIVE';
            if (m.state === 'ACTIVE') t.inboundPitbull = true;
        });
    }

    /** Live missiles for a shooter (SUPPORT or ACTIVE). */
    getShooterMissiles(shooterId) {
        return (this.missiles || []).filter(m =>
            String(m.shooterId) === String(shooterId) && m.isAlive()
        );
    }

    drawMissiles() {
        if (!this.missiles || !this.missiles.length) return;
        const inv = 1 / Math.max(this.viewScale, 0.5);

        this.missiles.forEach(m => {
            if (!m.isVisible()) return;
            const pos = this.bearingRangeToXY(m.bearing, m.range);
            const friendly = !m.shooterHostile;
            const color = friendly ? '#66ccff' : '#ff6666';
            const alpha = m.isAlive() ? 1 : Math.max(0.15, 1 - (Date.now() - (m.endedAt || Date.now())) / (m.lingerSec * 1000));

            this.ctx.save();
            this.ctx.globalAlpha = alpha;

            // Support dashed line shooter → missile
            if (m.state === 'SUPPORT') {
                const shooter = this.truthTracks.find(t => String(t.id) === String(m.shooterId));
                if (shooter) {
                    const sp = this.bearingRangeToXY(shooter.bearing, shooter.range);
                    this.ctx.strokeStyle = color;
                    this.ctx.lineWidth = 1 * inv;
                    this.ctx.setLineDash([4 * inv, 4 * inv]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(sp.x, sp.y);
                    this.ctx.lineTo(pos.x, pos.y);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                }
            }

            // Trail
            if (m.history && m.history.length > 1) {
                for (let i = 0; i < m.history.length; i++) {
                    const p = m.history[i];
                    const o = (i + 1) / m.history.length;
                    this.ctx.fillStyle = friendly
                        ? `rgba(100,200,255,${o * 0.55})`
                        : `rgba(255,80,80,${o * 0.55})`;
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, 1.5 * inv, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }

            // Chevron / velocity tick
            this.ctx.translate(pos.x, pos.y);
            this.ctx.rotate((m.heading - 90) * Math.PI / 180);
            this.ctx.strokeStyle = color;
            this.ctx.fillStyle = color;
            this.ctx.lineWidth = 1.6 * inv;
            this.ctx.beginPath();
            this.ctx.moveTo(10 * inv, 0);
            this.ctx.lineTo(-6 * inv, -5 * inv);
            this.ctx.lineTo(-3 * inv, 0);
            this.ctx.lineTo(-6 * inv, 5 * inv);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(14 * inv, 0);
            this.ctx.stroke();
            this.ctx.rotate(-(m.heading - 90) * Math.PI / 180);
            this.ctx.translate(-pos.x, -pos.y);

            // HIT flash
            if (m.state === 'HIT' && Date.now() < (m.hitFlashUntil || 0)) {
                this.ctx.strokeStyle = '#ffff66';
                this.ctx.lineWidth = 2 * inv;
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 12 * inv, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            // Label
            const st = m.state === 'SUPPORT' ? 'SUP' : (m.state === 'ACTIVE' ? 'ACT' : m.state);
            const rtt = Number.isFinite(m.rangeToTarget) ? Math.round(m.rangeToTarget) : '—';
            this.ctx.fillStyle = color;
            this.ctx.font = `bold ${9 * inv}px monospace`;
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`${m.type} ${st} ${rtt}nm`, pos.x + 10 * inv, pos.y - 8 * inv);

            this.ctx.restore();
        });
    }

    updateUI() {
        // Will be called from app.js to update info panel
        const event = new CustomEvent('trackSelected', { detail: this.selectedTrack });
        window.dispatchEvent(event);
    }

    // Utility: Convert bearing/range to canvas X/Y
    bearingRangeToXY(bearing, range) {
        const radian = (bearing - 90) * (Math.PI / 180); // 0° = North
        const x = this.bullseye.x + (range * this.scale) * Math.cos(radian);
        const y = this.bullseye.y + (range * this.scale) * Math.sin(radian);
        return { x, y };
    }

    // Utility: Convert canvas X/Y to bearing/range (floats for simulation accuracy)
    xyToBearingRange(x, y) {
        const dx = x - this.bullseye.x;
        const dy = y - this.bullseye.y;
        const range = Math.sqrt(dx * dx + dy * dy) / this.scale;
        let bearing = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (bearing < 0) bearing += 360;
        return { bearing: bearing, range: range };
    }

    // Calculate BRAA from one point to another
    calculateBRAA(fromBearing, fromRange, toBearing, toRange) {
        const from = this.bearingRangeToXY(fromBearing, fromRange);
        const to = this.bearingRangeToXY(toBearing, toRange);

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const range = Math.sqrt(dx * dx + dy * dy) / this.scale;
        let bearing = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (bearing < 0) bearing += 360;

        return {
            bearing: Math.round(bearing),
            range: Math.round(range)
        };
    }
}
