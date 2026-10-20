# BC3 Scope Trainer

Browser training scope for **ABM / WD** (with MSO radar-feed awareness).

## Identity
- The UI is a **BC3-style tactical scope**.
- **AN/TPS-75** is modeled only as the **radar track feed** (`src/radar_model.js`) — no radar console panels.
- Scenario IDs match `kb/04_Scenarios_And_CaseStudies/`.

## Controls
| Input | Action |
|-------|--------|
| **Scroll wheel** | Zoom toward cursor |
| **Zoom + / Zoom −** | Zoom center |
| **Middle-drag / Right-drag / Alt-drag** | Pan |
| **Pan** button | Left-drag pans while active |
| **Click** | Select track |
| **Reset View** | 1x, centered |

Hard refresh the page (`Ctrl+F5`) after updates. Every `<script>` tag in `index.html` carries the same `?v=` number — bump them all together when you change any source file, or the browser will mix old and new scripts.

## Quick start
1. Open `index.html` in Chrome / Edge / Firefox (double-click is fine).
2. Load a scenario from the sidebar, or use free-play sample tracks.
3. Change **Radar Feed** mode to see tracks drop/stale under EMCON/degraded/offline.
4. Use **Log Picture / Log Commit / Export Timeline** for light debrief data.

## Scenarios
| ID | Focus |
|----|--------|
| `sc-01-single-commit` | North-threat DCA — single group commit |
| `sc-02-wall-ladder` | Same overlay — WALL then LADDER inbound |
| `sc-03-degraded-radar` | Same overlay — degraded TPS-75 feed |

Standard overlay (NTTR E–W, bullseye N38°00' W115°00'): CAP EAST-L/R at 133/36 & 119/30, EMCON 90, meld/commit/retro 70/50/30, DAL 156/70, tanker on the published SHELL track. Red air ingresses from the west, tracking east.

The scenario bank is `src/scenarios_data.js` (what the trainer loads, including over `file://`). `scenarios/*.json` are generated copies — run `node simulator/scenarios/_build.js` after editing the bank. Trainer auto-loads `sc-01` on open.

## WD seat (trainee in the loop)

Tick **You are the WD** in the sidebar. The live picture answer is hidden and blue fighters wait on you.

| Call | How | What happens | Graded on |
|------|-----|--------------|-----------|
| **PICTURE…** | Fill the form (same fields as the Picture Trainer) and Transmit | — | Accuracy against scope truth (best of when you opened the form and when you sent it), and how long after a new group appeared (standard 45 s) |
| **COMMIT** | Pick the flight, press COMMIT | The flight leaves CAP once a hostile is inside meld. Uncommitted flights hold CAP and commit themselves at 40 nm | On time (95–50 nm to the nearest hostile), early, late, or fighter-initiated |
| **TARGET group** | Click a hostile track, pick the flight, press TARGET | That flight engages only what it is targeted on. An untargeted flight sorts itself at 45 nm | Each hostile targeted before it is within 45 nm of a fighter |
| **THREAT…** | Click the hostile, choose the fighter, fill the BRAA form | — | BRAA accuracy; required within 20 s when an untargeted hostile is inside 15 nm of a fighter |

**Auto commit / Auto targeting** hand that task back to the fighters (and drop it from the score) so a new WD can take on one job at a time.

**End mission & debrief** freezes the sim and shows an overall score with a section per task, the truth call beside each picture and exactly which fields were wrong. Click any row, or drag the slider, to put the scope back to that moment (truth positions every 2 s).

Standards and weights are `WD_STANDARDS` at the top of `src/wd_seat.js`; a scenario can override them with a `wdStandards` object. They are training defaults — set them to your unit's commit and targeting criteria.

Not in yet: fighter-initiated requests (check-in, BOGEY DOPE, DECLARE, SPIKED), declarations/ROE, and voice — calls are made with buttons and forms.

## Geography and overlays

- **Airspace is real.** Desert MOA, Reveille North/South MOA and R-4806E/W, R-4807A/B, R-4808N/S, R-4809 are the published FAA Special Use Airspace shapes (`geo/faa_sua_nttr.json`). NTTR's internal sub-areas (Coyote, Caliente, Elgin, Sally Corridor, numbered ranges) are not published, so they are name labels at approximate positions with no border; add a surveyed ring to `SUBAREAS` in `geo/_build_nttr.js` to draw one.
- **One source per position.** `node simulator/geo/_build_nttr.js` builds `geo/*.json` and the embedded `src/geo_data.js` from the FAA file plus the sheet coordinates for AAR tracks. Do not edit the outputs.
- **Pin scenario items to coordinates, not bearings.** Any overlay item or track in the scenario bank may carry `geo: "N37 07 W114 24"` (or `{lat, lon}`), and an orbit may carry `ip` / `cp`; bullseye bearing/range is derived at load. SHELL uses this: the tanker flies the published IP→CP track outbound and a left-hand racetrack inside the drawn AAR box.
- **Background map is real.** State borders and coastline are US Census boundaries (`geo/us_states_10m.json`), with a whole-degree lat/long graticule.
- **Everything is on one scale.** The projection is azimuthal-equidistant about bullseye, so every point sits at its true great-circle bearing and range from bullseye, and the map, airspace, rings, CAP legs, AAR racetrack and tracks all use the same px/nm. The nm scale bar (bottom right) and the 20 nm grid follow zoom. Bearings are true.
- **Symbols vs. shapes.** Rings, the MLL, CAP legs (dashed), the AAR racetrack, slide/scram circles and safe passages are drawn to scale. Track symbols, CAP/DAL markers and labels are fixed-size symbols.

## Fighter and HVAA logic

All AI timers run on the sim clock, so a fight plays out the same at 1× and 16×.

| Topic | Behaviour |
|-------|-----------|
| Shot range | Computed each tick from the missile's reach (`MISSILE_PROFILES` in `defensive_profiles.js`): no-escape range plus a fraction of the way to max aero range (`shotAggression` / `r27Aggression` / `r77Aggression`), capped at the briefed WEZ (FOX3 40, R-27 32, R-77 22). A target that turns cold pulls the launch range in. |
| Deconfliction | One blue missile per contact at a time; a released wingman takes a contact lead is not on. |
| SORT | Ownership is sticky — a flight lead keeps its contacts until one side dies; only new or orphaned contacts are assigned. |
| Wing | Reserve at CAP unless: two or more contacts in the element's lane, a leaker, or lead Winchester / defensive / down. |
| Defence | SARH → NOTCH. ARH that can be outrun → OUT (turn tail). Otherwise NOTCH, then BEAM + chaff from pitbull. |
| Red SA | A contact stays in the red track file 10 s after leaving the radar cone; a red wingman sorts off lead's target when another is about as close. |
| Tanker | SLIDE away from a hostile fighter inside the slide ring, SCRAM inside the scram ring, rejoin the track when clear. |

## Tests

```bash
node simulator/tests/run_tests.js
```

No dependencies. Loads the real scripts headlessly (`tests/headless.js`), then checks the geography (SHELL orbit inside its AAR box, real airspace present, map to scale), the missile envelope the pilots use, HVAA retrograde, all three scenarios flown to completion on the sim clock, and the WD seat (a silent WD scores low and fighters fend for themselves; a WD who makes every call on time scores high and the fighters fight who they were targeted on).

## Modules (`src/`)
| File | Role |
|------|------|
| `scope_engine.js` | Canvas scope, truth physics, perception, missiles |
| `pilot_ai.js` / `defensive_profiles.js` / `missile_model.js` / `wave_manager.js` | Blue + red BVR, aircraft and missile profiles, fly-out, staged waves |
| `wd_seat.js` / `wd_panel.js` | WD seat: commit / targeting gates, call grading, recorder, debrief scoring; and its panel |
| `geo_projection.js` / `geo_layer.js` / `airspace_layer.js` / `geo_data.js` | Projection, geography and airspace overlays (data generated by `geo/_build_nttr.js`) |
| `radar_model.js` | TPS-75 feed filter |
| `../picture_trainer/src/` `orientation.js`, `clustering.js`, `alssa_format.js`, `picture_logic.js` | Picture suggestions — shared engine, loaded from the Picture Trainer (keep the two folders side by side) |
| `aspect_calculator.js` | Fighter-relative BRAA / aspect |
| `symbology.js` | milsymbol + fallback |
| `trainer.js` | Brevity / systems / tactics quiz |
| `timeline.js` | Event log export |

## Knowledge base
Study notes: `../kb/00_Home/Mastery_Map.md`  
MQF app (separate): `D:\MQF_dev`

## Related trainer
**Picture calls only (no BVR):** [`../picture_trainer/`](../picture_trainer/) — Parrot Sour-style animated ALSSA formations with reveal + graded drill modes.

## Non-goals (near term)
- Separate TPS-75 console UI
- Full ATO parser / voice ASR / AF Form 4146 digitization
