# BC3 Scope Workflows

**Source:** CRC Aircrew Aid / AFMAN 13-1CRCv3 (paraphrase); MQF MSO items cross-checked 2026-08-13  
**Last Reviewed:** 2026-08-13  
**Tags:** `#systems` `#bc3` `#mso` `#wd`

## What BC3 is (for this vault)
The crew tactical display/session environment. In the browser trainer, the **scope UI is BC3-style**: overlays, tracks, data blocks, picture work. It is not a pixel-perfect classified build.

## Typical setup order (training memory aid)
1. Open BC3 on the scope.
2. Next: **Scope Profile** (MQF MSO #36 — answer C).
3. Establish **bullseye** / reference.
4. Load overlays: BMA, CAP, safe passages, tactical lines as briefed.
5. Confirm radios / nets per checklist (crew aid).
6. Verify radar/Link picture quality with MSO — what you see depends on **TPS-75** feed health ([[TPS75_Radar_Feed]]).

## Operator habits
- Data blocks: altitude, bullseye, declaration, tags (LEAKER, etc.).
- Picture discipline: [[../03_Notes_And_Insights/Picture_Call_Logic|Picture_Call_Logic]].
- Degraded ops: when radar feed drops quality, expect missing/late tracks — train manual SA and voice correlation (sim: scenario `sc-03-degraded-radar`).

## Crew interfaces
| Position | Expectation on BC3 |
|----------|-------------------|
| MSO | Session/profile/radar feed awareness |
| WD | Picture, BRAA, commits |
| ABM | Sector SA, contracts, ROE |
| EPT | EP on TPS-75 (not WD) — MQF MSO #39 |

## Sim mapping
`D:\C2_Knowledge_Base\simulator\` — load scenarios sharing IDs with `04_Scenarios_And_CaseStudies`.

→ [[../00_Home/Systems_Index|Systems_Index]]
