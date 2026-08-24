# ALSSA Picture Call Trainer

Standalone browser drill for **WD / ABM** picture calls — Parrot Sour-style animated hostile and friendly tracks. No BVR AI, missiles, or TPS-75 feed simulation (see [`../simulator/`](../simulator/) for that).

## Quick start

1. Open [`index.html`](index.html) in Chrome, Edge, or Firefox.
2. Pick a **category** and **variation** (15 per category, or Random).
3. Watch tracks animate; use **Measure** to check lateral/depth separation.
4. Fill the **Student picture** form and **Submit & grade**, or **Reveal Answer** for self-check.

## Categories (15 variations each)

Random Picture, Azimuth, Range, Wall, Ladder, Champagne, Vic, Cap, Leading Edge, Waves, Packages, Threat, EA / Bogey Dope, Picture of the Day.

## Controls

| Control | Action |
|---------|--------|
| Scroll wheel | Zoom toward cursor |
| Left-drag (default) | Pan |
| Measure + drag | Bearing/range line between two points |
| Data trail | Motion history dots |
| Radar plots | Staggered snapshot markers (~4 s) |
| Anim speed | 0.5× – 4× (sim time only) |
| E/W vs N/S | Threat axis + blue CAP placement |

## Grading

- **Reveal:** verbatim `PictureGenerator` output from clustered hostile truth.
- **Graded:** field compare — group/wave count (exact), label (exact), dimensions ±2 nm, bulls ±5°/±3 nm, altitude bucket.

Special modes: **Threat** and **Bogey Dope** use BRAA from nearest blue fighter; **EA** drills MUSIC/STROBE labels.

## Blue air

Four-ship package (2× PAIR) on CAP racetracks — always visible (green circle). Hostiles = red diamond with **BULLS brg/rng** data tags.

## Knowledge base

- [`../kb/06_Summaries_And_Learning/WD_Picture_Summary.md`](../kb/06_Summaries_And_Learning/WD_Picture_Summary.md)
- [`../kb/03_Notes_And_Insights/Picture_Call_Logic.md`](../kb/03_Notes_And_Insights/Picture_Call_Logic.md)
- [`../kb/00_Home/Mastery_Map.md`](../kb/00_Home/Mastery_Map.md)

## Modules

| File | Role |
|------|------|
| `src/scope_renderer.js` | Canvas, pan/zoom, measure, grid |
| `src/animation_engine.js` | Ingress, CAP orbit, formation follow |
| `src/formation_generator.js` | Procedural ALSSA layouts + blue package |
| `src/scenario_bank.js` | 14×15 seeded variations |
| `src/picture_logic.js` | Picture call engine (RANGE, CAP, PACKAGE, LE, THREAT, EA) |
| `src/grading.js` | Reveal + structured score |
| `src/app.js` | UI wiring |
