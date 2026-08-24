# sc-01 — DCA Single Group Commit

**Scenario ID:** `sc-01-single-commit`  
**Last Reviewed:** 2026-08-22  
**Tags:** `#scenario` `#wd` `#dca`  
**Simulator file:** `simulator/scenarios/sc-01-single-commit.json`

## Standard overlay (NTTR E–W)
| Element | Position |
|---------|----------|
| Threat axis | **WEST** ingress |
| MLL | **130 nm** |
| CAP EAST-L / EAST-R | **133/36** & **119/30** |
| Fighter MELD / COMMIT | **70 / 50 nm** (logic only) |
| DAL | 156/70 |
| Tanker SHELL 1 | racetrack **152/80** |
| SLIDE / SCRAM | **25 / 15 nm** around tanker |

## Blue force
- **RAPTOR11** + **RAPTOR12** (PAIR, ≤5 nm on CAP)
- **VIPER21** + **VIPER22** (PAIR, ≤5 nm on CAP)

## Red waves
| Wave | Formation | Range | Release |
|------|-----------|-------|---------|
| FIRST | PAIR (2) | ~125 nm | T+0 |
| SECOND | PAIR (2) | ~155 nm (+30 depth) | T+90 s or Wave 1 destroyed |

## Training goals
- Clean pair picture; wave language when second wave activates
- Commit decision as first wave closes meld/commit
- BRAA from CAP fighters, not only bullseye

## Debrief prompts
- Was leading edge outside MLL when first called?
- Did you identify second wave ingress timing vs picture?

Related: [[../03_Notes_And_Insights/DCA_Mission_Timeline|DCA timeline]] · [[sc-02-wall-ladder]]
