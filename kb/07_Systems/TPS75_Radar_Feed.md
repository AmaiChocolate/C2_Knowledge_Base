# TPS-75 Radar Feed

**Source:** AFTTP 3-3.CRC / CRC Aircrew Aid (paraphrase); MQF MSO cross-check 2026-08-13  
**Last Reviewed:** 2026-08-13  
**Tags:** `#systems` `#tps75` `#mso` `#radar`

## Role in the kill chain of attention
AN/TPS-75 is the **radar**. It does **not** need its own panels in the training simulator. The simulator is the **BC3 scope**; TPS-75 is modeled as the **track feed** (what gets painted, delayed, or dropped).

## Envelope (MQF MSO #54 — answer C)
- Max range: **240 NM**
- Max altitude: **95,500 ft**

Treat as study figures; always defer to current TO/TTP for ops.

## EMCON (MQF MSO #42 — answer A)
For EMCON planning, max frequencies enabled at one time on TPS-75: **16**.

## Electronic protection
EPT recognizes/controls EA effects using TPS-75 displays, EP functions, and switch actions (MQF MSO #39 — answer A). WD/ABM see the **result** on BC3 (noisy, thin, or clean picture).

## What the scope sees when radar state changes

| Radar condition | Scope effect (training model) |
|-----------------|-------------------------------|
| Normal | Tracks within envelope update ~1–2 Hz |
| Reduced range / EMCON | Outer tracks drop or freeze |
| EA / degraded | Tracks flicker, delayed, or lost; ID harder |
| Offline | No new radar tracks; Link/manual only (future) |

## Sim implementation
`simulator/src/radar_model.js` — truth tracks in → displayed tracks out based on mode.

Related: [[BC3_Scope_Workflows]] · case study [[../04_Scenarios_And_CaseStudies/sc-03-degraded-radar|sc-03-degraded-radar]]

→ [[../00_Home/Systems_Index|Systems_Index]]
