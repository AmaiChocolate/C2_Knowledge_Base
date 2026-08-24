# sc-03 — DCA Degraded Radar Feed

**Scenario ID:** `sc-03-degraded-radar`  
**Last Reviewed:** 2026-08-22  
**Tags:** `#scenario` `#mso` `#wd` `#tps75` `#dca`  
**Simulator file:** `simulator/scenarios/sc-03-degraded-radar.json`

## Overlay
Same standard NTTR E–W DCA stack as [[sc-01-single-commit]].

## Blue force
- **RAPTOR11** + **RAPTOR12**, **VIPER21** + **VIPER22** (PAIR wingmen)

## Red waves
| Wave | Formation | Range | Release |
|------|-----------|-------|---------|
| FIRST | **LADDER** (2) | ~95 nm | T+0 |
| SECOND | **LADDER** (3) | ~125–130 nm | T+90 s or Wave 1 destroyed |

Near wave may paint intermittently under degraded feed; far wave often dropped/stale until closer.

## Training goals
- Scope ≠ truth; prioritize closest painted threats
- MSO narrates feed health; WD avoids inventing SA
- Protect DAL / HVAA (scram circle) even with incomplete outer picture

## Debrief prompts
- Which groups were truth-only vs displayed?
- Did WD still protect DAL/HVAA with incomplete outer picture?
- Wave 2 ingress under degraded feed — did you miss dormant-to-active transition?

Related: [[../07_Systems/TPS75_Radar_Feed|TPS75_Radar_Feed]]
