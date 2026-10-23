# ALSSA Picture Call Trainer

Standalone browser drill for **WD / ABM** picture calls — Parrot Sour-style animated hostile and friendly tracks. No BVR AI, missiles, or TPS-75 feed simulation (see [`../simulator/`](../simulator/) for that).

## Quick start

1. Open [`index.html`](index.html) in Chrome, Edge, or Firefox.
2. Pick a **category** and **variation** (15 per category, or Random within the category).
3. Watch tracks animate; **Pause** and use **Measure** to check width / depth.
4. Fill the **Student picture** form and **Submit & grade**, or **Reveal Answer** for self-check.
5. After the picture is called, groups **maneuver**. Call each one by the name you gave it (see below).

## Categories (15 variations each)

Random Picture, Azimuth, Range, Wall, Ladder, Champagne, Vic, Box, Cap, Leading Edge, Waves, Packages, Threat, EA / Bogey Dope, Picture of the Day.

## Controls

| Control | Action |
|---------|--------|
| Scroll wheel | Zoom toward cursor |
| Left-drag (default) | Pan |
| Pause / Resume | Freeze track motion (the run also freezes itself when the raid reaches the 55 nm stop line, 20 nm once the picture is called) |
| Measure + drag | Bearing/range line between two points |
| Data trail | Motion history dots |
| Radar plots | Staggered snapshot markers (~4 s) |
| Anim speed | 0.5× – 4× (sim time only) |
| E/W vs N/S | Threat axis + blue CAP placement |

## How answers are produced

Truth moves, so the answer is computed **from the scope as it is at the moment you reveal or submit** — pause first if you are still measuring.

`PictureGenerator` works in the threat-axis frame (WIDE = across the axis, DEEP = along it) and applies the rules in [`Picture_Call_Logic.md`](../kb/03_Notes_And_Insights/Picture_Call_Logic.md): 3 nm groups, the 5 nm depth rule (WALL vs CHAMPAGNE / VIC), 10 nm azimuth anchoring, LEADING EDGE + waves, packages. Every threshold lives in `PICTURE_RULES` at the top of `src/picture_logic.js`; the wave (25 nm) and package (40 nm) breaks are trainer assumptions because the real values are mission-planned.

## Maneuvers

With **Maneuvers after the picture** checked (default), submitting or revealing the picture locks its group names. A few seconds later a named group either turns to a HOT, FLANK, BEAM or DRAG heading relative to the friendly fighters, or **splits**: one contact of a group of two or more breaks off on its own heading. The form switches to a maneuver call: the group's name, the maneuver, the direction (blank for HOT and SPLIT), and for a SPLIT the BULLSEYE of either new group. The pieces of a split take new names (`NORTH LEAD GROUP` / `SOUTH LEAD GROUP`), which the revealed or graded call shows, and later maneuvers use them. Do not re-label the picture: a wall that starts flanking is still NORTH / MIDDLE / SOUTH GROUP. Each run has one or two maneuvers. A group that has turned away often comes back HOT. Groups with no unique name (follow-on waves, core-information `GROUP`s) do not maneuver. The BRAA and EA drills have no maneuvers.

Once the picture is called, the stop line moves 35 nm closer (to 20 nm) so the maneuvers have room. Calling the picture after the run has frozen resumes it. The run freezes again when a group reaches the new line. The director lives in `src/maneuvers.js` (`MANEUVER_RULES` for timings and target aspects). It only turns a group when a straight-line look-ahead keeps it clear of the other groups and the stop line.

## Grading

Field compare against the live answer key:

| Field | Tolerance |
|-------|-----------|
| Group / wave / leading-edge / package counts | exact (leave blank when not applicable) |
| Label | exact word (blank for single group or no traditional label) |
| Wide / deep | ±3 nm |
| Bullseye or BRAA bearing / range | ±5° / ±3 nm (±5 nm for a CAP) — any group in the called picture is accepted as the anchor |
| Altitude | ±1 thousand ft of the anchored group — digits or words |
| Track / aspect | word match (`EAST`, `CAP`, `HOT`, `FLANK …`) |
| Maneuver group / aspect | the name from your picture; HOT / FLANK / BEAM / DRAG |
| Maneuver direction | any cardinal within 30° of the new heading (`N` / `NORTH`); blank for HOT and SPLIT |
| SPLIT BULLSEYE | either new group, ±5° / ±3 nm; blank for track maneuvers |

Special drills show the fighter's request above the form: **Threat** and **Bogey Dope** are answered in BRAA from the named fighter; **EA** drills the controller response to `MUSIC` (anchor the group) and `STROBE` (range to the closest group along the bearing).

Not modelled yet: OPENING / CLOSING, ECHELON, altitude STACKs, altitude maneuvers, weighted-wall separation calls, mixed declarations (everything is HOSTILE), voice input.

## Tests

```bash
node picture_trainer/tests/run_tests.js
```

No dependencies. Sweeps every category × variation × orientation headlessly and checks that the answer matches what the generator built, survives 90 s of ingress unchanged, and that a perfect submission scores 100%. Run it after touching anything in `src/` — the GitHub Pages workflow runs it before deploying.

## Blue air

Four-ship package (2× PAIR) on CAP racetracks — always visible (green circle). Hostiles = red diamond with **bullseye brg/rng** data tags (lead only; click a wingman to see its tag).

## Knowledge base

- [`../kb/06_Summaries_And_Learning/WD_Picture_Summary.md`](../kb/06_Summaries_And_Learning/WD_Picture_Summary.md)
- [`../kb/03_Notes_And_Insights/Picture_Call_Logic.md`](../kb/03_Notes_And_Insights/Picture_Call_Logic.md)
- [`../kb/00_Home/Mastery_Map.md`](../kb/00_Home/Mastery_Map.md)

## Modules

| File | Role |
|------|------|
| `src/orientation.js` | Threat-axis orientations + shared `Geo` helpers (bullseye ↔ east/north ↔ axis frame) |
| `src/clustering.js` | 3 nm grouping, group centroid / CAP anchor |
| `src/alssa_format.js` | Number words, BULLSEYE / BRAA / altitude phrasing, input parsing |
| `src/picture_logic.js` | Picture call engine + `PICTURE_RULES` (also loaded by `../simulator/`) |
| `src/formation_generator.js` | Seeded layouts in the axis frame + blue package |
| `src/scenario_bank.js` | 15×15 seeded variations |
| `src/track_kinematics.js` / `src/animation_engine.js` | Ingress, CAP orbit, wing station-keeping, pause / run end |
| `src/maneuvers.js` | Post-picture maneuvers and splits: locked group names, planning, scheduling |
| `src/scope_renderer.js` / `src/symbology.js` | Canvas, pan/zoom, measure, symbols |
| `src/grading.js` | Answer families, form field definitions, scoring |
| `src/app.js` | UI wiring |

### Extending

- **New formation / category** — add a layout to `Layouts` in `formation_generator.js`, a `case` in `generateScenario`, an entry in `SCENARIO_CATEGORIES`, and an expectation in `tests/run_tests.js`.
- **New drill type** — emit a new answer-key `family` from `PictureGenerator`, list its fields in `ANSWER_FAMILIES` (`grading.js`) and add a hint in `app.js`; the form builds itself from those.
