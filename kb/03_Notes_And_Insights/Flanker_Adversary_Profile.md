# Flanker Adversary Profile (Training Proxy)

**Last Reviewed:** 2026-08-22  
**Tags:** `#red-air` `#flanker` `#bvr` `#training`  
**Related:** [[../05_Tools_And_CrossReferences/AI_Pilot_Architecture|AI Pilot Architecture]] · Crew Aid FLANKER / R-27 / R-77 nomenclature

## Purpose

Unclassified **Su-30-class Flanker** training profile for the BC3 scope trainer. Numbers are **open training proxies** for WD timeline practice — not classified WEZ, radar, or employment data.

Crew Aid provides **ID / emitter / missile names only** (FLANKER, SLOTBACK/Bars/Irbis-E labels, RS-AA-10 ALAMO / R-27, RS-AA-12 ADDER / R-77). This note supplies the sim’s behavioral geometry so red air pressures blue CAP and HVAA realistically.

## Mission objective (NTTR E–W)

1. Ingress from the **west**, hold formation until commit.
2. Sort / commit on blue fighters.
3. Employ **R-77** (primary) or **R-27** (secondary SARH), then crank.
4. Reattack or **push east** toward SHELL / DAL (HVAA).

## Fighter-relative gates (sim defaults)

| Gate | Nm | Role |
|------|-----|------|
| Detect / sort | **90** | Fill `perceivedTracks` (wide search cone) |
| Commit | **55** | Leave INGRESS; pure pursuit |
| R-77 WEZ (FOX3 / ADDER) | **22** | Primary active shot |
| R-27 WEZ (FOX1 / ALAMO) | **32** | Secondary SARH; breaks if shooter notches hard / dies |
| Crank | **±45°** | Post-shot F-pole |
| Notch / beam | **15–25** if spiked | Defensive bias |

Blue WD meld/commit (**70 / 50**) stays separate and fighter-relative for friendlies.

## Formations

| Type | Geometry | Scenarios |
|------|----------|-----------|
| **PAIR** | Wing ~**10 nm** north of lead | sc-01 BANDIT1/2 |
| **WALL** | Wings ±**10 nm** lateral of lead | sc-02 H1–H3 |
| **LADDER** | Trail **−15 / −30 nm** east of lead (behind eastbound ingress) | sc-02 H4–H5; sc-03 FAR1/2 |

Formation hold applies in **INGRESS** only; after commit, free pursuit for shots.

## State machine (red)

`INGRESS` → `COMMITTED` → `WEZ` → `CRANK` → `SKOSH` → `REATTACK` or `PUSH_HVAA`

Implemented in `simulator/src/pilot_ai.js` (`executeFlankerBvr`). Perception for hostiles is in `scope_engine.updatePerception`.

## Defensive (when targeted)

When inbound missile detected, **DEFEND** overrides offensive BVR (same framework as blue; see [[F35_Defensive_Profile]] for blue comparison).

| Capability | Su-30 proxy |
|------------|-------------|
| Launch detect | ~**25 nm** (L-band RWR proxy) |
| Chaff bundles | **3** |
| ECM | **Weak** vs ARH |
| BREAK | &lt; **15 nm** inbound |
| ARH defeat sustain | ~**3.0 s** notch + chaff/ECM |
| SARH (R-27) defeat | ~**2.0 s** notch |

Maneuvers: **NOTCH → BEAM → COLD → BREAK**; chaff on first beam per salvo (stops at 0).

## Ordnance (adversary load)

| Missile | Count |
|---------|-------|
| R-77 (ADDER / FOX3) | **4** |
| R-27 (ALAMO / FOX1) | **2** |
| Chaff | **3** |

When both R-77 and R-27 are exhausted, logs **Winchester** and transitions to **PUSH_HVAA** (no further FOX).

## ALSSA note

COMMIT criteria remain **mission-planned** (range, location, threat, weapons employment). This profile is the red-side training stand-in so blue WDs see early pressure, not dumb eastbound kinematics.
