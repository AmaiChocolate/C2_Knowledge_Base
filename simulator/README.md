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

Hard refresh the page (`Ctrl+F5`) after updates so the browser does not keep an old `scope_engine.js`.

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

Standard overlay: CAP NORTH-L/R at 350/65 & 010/65, EMCON 90, meld/commit/retro 70/50/30, DAL 180/5, tanker SHELL 180/40. Red air north of meld, track south.

JSON copies live in `scenarios/`; embedded bank in `src/scenarios_data.js` for `file://` loads. Trainer auto-loads `sc-01` on open.

## Modules (`src/`)
| File | Role |
|------|------|
| `scope_engine.js` | Canvas scope, truth physics |
| `radar_model.js` | TPS-75 feed filter |
| `picture_logic.js` / `clustering.js` | Picture suggestions |
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
