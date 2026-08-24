# F-35 Defensive Profile (Training Proxy)

**Last Reviewed:** 2026-08-22  
**Tags:** `#f35` `#defensive` `#bvr` `#training`  
**Related:** [[Flanker_Adversary_Profile]] · [[../05_Tools_And_CrossReferences/AI_Pilot_Architecture|AI Pilot Architecture]]

## Purpose

Unclassified **F-35** BVR defensive training geometry for blue fighters (RAPTOR/VIPER) in the scope trainer. Not classified Pk or sensor performance — open numbers for WD timeline practice.

## Sensors (proxy)

| Cue | Range / behavior |
|-----|------------------|
| Blue meld (fusion) | **80 nm** (earlier than generic 70 nm fighter meld) |
| Launch detect (SUPPORT) | ~**40 nm** (fusion RWR/DAS proxy) |
| Pitbull (ACTIVE) | Immediate when missile goes active |
| Red detect vs F-35 | Flanker **~40 nm** (VLO training proxy; tanker still ~90 nm) |

## Offensive employment (NEZ)

| Parameter | Value |
|-----------|-------|
| TAC RANGE (TARGETED) | **60 nm** |
| FOX min / max | **8 / 40 nm** (AIM-120D NEZ proxy — outranges R-77 @ 22 nm) |
| FOX aspect gate | None for ARH — stern/trail shots allowed (ATA + range only) |
| FOX ATA gate | Shooter nose ≤**40°** of LOS (no beam/cold launches) |
| FOX min / guns | Inside **8 nm** → no FOX3; convert to **MERGE/guns** even with AIM-120 remaining |
| Post-shot crank | F-pole ±**50°** after FOX (not before) |
| FOX from MELD | Allowed when TARGETED + ATA gate passes |
| AIM-120 terminal | Pitbull **8 nm**, turn rate **16°/s** (vs R-77 10 nm / 14°/s) |
| TARGETED through commit | Persists (not cleared on commit) |
| Min missiles for recommit | **2** (hold CAP / `wave_hold` if Winchester or outnumbered) |
| SORT / TARGETED | Flight lead owns up to **3** contacts; `ceil(N/3)` leads commit; other flight CAP reserve |
| Wing engage | Not auto with lead — release on leaker / lead Winchester / lead down |

## Ordnance (DCA load)

| CM | Training value |
|----|----------------|
| Chaff bundles | **4** per sortie |
| Chaff duration | ~**3 s** per dispense (terminal only); re-dispense allowed within **0.5 s** of expiry (overlap) |
| Chaff deploy | **PITBULL/ACTIVE** and inside **~14 nm** — BEAM/BREAK/**COLD**, and **NOTCH once ACTIVE** |
| Chaff defeat | Only effective inside **12 nm** when missile is **ACTIVE**; timer **resets** if cloud drops |
| ECM | **Assist-only** vs ARH — notch bleed without chaff; **does not** solo-defeat AIM-120 / R-77 |
| Red detect vs F-35 | Flanker **~40 nm** (VLO training proxy; tanker still ~90 nm) |

## Ordnance (DCA load)

| Missile | Count |
|---------|-------|
| AIM-120 (FOX3) | **4** |

When AIM-120 count reaches zero, fighter logs **Winchester** and holds CAP (`wave_hold`) if hostiles remain.

## Countermeasures

Priority when inbound missile detected:

1. **NOTCH/BEAM** — heading 70–110° to inbound missile bearing (Doppler notch)
2. **BEAM** — after pitbull; hold beam ~5 s
3. **COLD** — drag away from threat (reduced speed)
4. **BREAK** — inside **12 nm** inbound; max-performance turn away + speed boost

Deploy chaff on **BEAM/BREAK/COLD**, and on **NOTCH once pitbull/ACTIVE**, inside ~14 nm — not on early support NOTCH. Multiple bundles may be expended: a new dispense is allowed when the cloud expires or within **0.5 s** of expiry (overlap) so sustained CM can bridge defeat timers.

## Missile defeat (sim logic)

| Threat | Defeat condition |
|--------|------------------|
| FOX3 / R-77 (ARH) SUPPORT | Notch widens lead only — **no defeat** |
| FOX3 / R-77 (ARH) ACTIVE | Inside chaff range: **unbroken** notch + chaff ~**2.5 s** (F-35) / **5.0 s** (Su-30) |
| FOX3 / R-77 (ARH) ACTIVE + ECM only | Notch + ECM **bleed lead only** — **no solo defeat** (`ecmAssistOnly`) |
| R-27 / FOX1 (SARH) | Sustained notch ~**2.0 s** (no chaff required) |

Chaff effective inside ~**12 nm** (F-35) / **8 nm** (Su-30). Su-30 must overlap ~2 chaff clouds to defeat AIM-120; a single 2.5 s burst is not enough. Dropping the cloud **resets** the ARH defeat timer.

Offensive post-shot SKOSH (crank after blue fires) is separate from defensive **DEFEND**.

## WD calls (reference)

- **SKOSH / PITBULL** — missile active on friendly (timeline `pitbull` event)
- **NOTCH** — beam perpendicular to threat
- **BREAK** — immediate max turn (THREAT inside break range)

*Sources: Tactical_Range_Calls.md, AI_Pilot_Architecture.md, simulator `defensive_profiles.js`*
