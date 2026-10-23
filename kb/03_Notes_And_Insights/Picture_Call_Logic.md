# Picture Call Logic and Formation Labels

**Last Reviewed:** 2026-08-13  
**Updated:** 2026-10-13 — re-aligned to the ALSSA comm-standard extract (`05_Tools_And_CrossReferences/sources/alssa_utf8.txt`, air-to-air chapter); **needs your re-review**  
**Updated:** 2026-10-23 — added *Maneuvers (after the picture)* and *SPLIT* for the Picture Trainer; **needs your re-review**  
**Tags:** `#wd` `#picture` `#brevity`  
**Related:** [[../06_Summaries_And_Learning/WD_Picture_Summary|WD_Picture_Summary]] · sim `sc-02-wall-ladder` · [[../../picture_trainer/README|Picture Trainer]] (its answer engine implements this note)

## Building blocks

- **GROUP** — contacts within **3 nm** in azimuth and range of each other. Single contact is assumed; say `TWO CONTACTS`, or `HEAVY` (+ count if known) for three or more.
- **Core information order** — total groups → location → altitude → track / aspect → declaration → fill-ins.
- **Location** — `BULLSEYE 045/60` (never shortened to "bulls" — it gets heard as BRAA). `BRAA` is used when the call is for one specific fighter: BRAA requests, BOGEY DOPE, SNAPLOCK, and THREAT calls.
- **Altitude** — nearest thousand feet (`THIRTY-TWO THOUSAND`). Controllers do **not** substitute HIGH / LOW for the altitude.
- **Track** — cardinal / sub-cardinal with bullseye calls (`TRACK EAST`); HOT / FLANK / BEAM / DRAG with BRAA calls. `CAP` may replace track or aspect for an orbiting group. When every group in the picture tracks the same way, say it once after the label.
- **Declaration** — BOGEY / FRIENDLY / NEUTRAL / BANDIT / HOSTILE; required with a bullseye or BRAA call.

## Five ways to communicate a picture

1. Core information (pre-commit, or nothing else fits — with four or more groups give the total, then only the three highest-priority groups)
2. Traditional labels
3. LEADING EDGE
4. WAVES
5. PACKAGES

## Traditional labels

Measure **WIDE** across the threat axis and **DEEP** along it. The "lead" group is the one closest to the fighters.

| Groups | Label | Rule of thumb | Dimensions voiced | Group names |
|--------|-------|---------------|-------------------|-------------|
| 1 | SINGLE GROUP | only one known group in the area | — | — |
| 2 | AZIMUTH | wider than deep | `TWO GROUPS AZIMUTH TWENTY` | cardinal (NORTH / SOUTH GROUP) |
| 2 | RANGE | deeper than wide | `TWO GROUPS RANGE THIRTY` | LEAD / TRAIL GROUP |
| 3+ | WALL | depth **≤ 5 nm** | `… WIDE` | outer = cardinal, inner = MIDDLE (cardinal-MIDDLE when several) |
| 3+ | LADDER | separated in range | `… DEEP` (total) | LEAD, MIDDLE / SECOND, THIRD…, TRAIL |
| 3 | CHAMPAGNE | two closest abreast, third in trail (depth > 5 nm) | WIDE then DEEP | cardinal LEAD GROUPs, TRAIL GROUP |
| 3 | VIC | one closest, two in trail abreast (depth > 5 nm) | DEEP then WIDE | LEAD GROUP, cardinal TRAIL GROUPs |
| 4 | BOX | two abreast in front, two abreast behind | WIDE then DEEP | cardinal LEAD / TRAIL GROUPs |

**The 5 nm depth rule** decides WALL versus CHAMPAGNE / VIC.

### Examples (trainer format)

```
"TANGO, THREE GROUP WALL, THIRTY WIDE, TRACK EAST. NORTH GROUP BULLSEYE 285/92, THIRTY-TWO THOUSAND, HOSTILE.
 MIDDLE GROUP, THIRTY THOUSAND, HOSTILE. SOUTH GROUP BULLSEYE 255/90, THIRTY-TWO THOUSAND, HOSTILE, TWO CONTACTS."

"TANGO, THREE GROUP VIC, FIFTEEN DEEP, TWENTY WIDE, TRACK EAST. LEAD GROUP BULLSEYE 270/80, TWENTY-EIGHT THOUSAND, HOSTILE.
 NORTH TRAIL GROUP, TWENTY-FIVE THOUSAND, HOSTILE. SOUTH TRAIL GROUP, TWENTY-EIGHT THOUSAND, HOSTILE."

"TANGO, TWO GROUPS RANGE TWENTY, TRACK SOUTH. LEAD GROUP BULLSEYE 005/85, TWENTY-FIVE THOUSAND, HOSTILE.
 TRAIL GROUP, TWENTY-EIGHT THOUSAND, HOSTILE."

"TANGO, SINGLE GROUP BULLSEYE 180/30, TWENTY-TWO THOUSAND, CAP, HOSTILE."
```

### Anchoring

Anchor (give a BULLSEYE for) the highest-priority group first: closest to the fighters → most capable → highest → largest. Groups abreast are each anchored only when they are more than **10 nm** apart in azimuth; with several abreast, anchor the outermost. Groups in trail take their position from the lead group and the dimension.

### Amplifying remarks (after the dimensions, in this order)

1. **OPENING / CLOSING** — separation changing enough to matter to the intercept.
2. **WEIGHTED + cardinal** — three or more groups not evenly spaced: split the azimuth into thirds; a group outside the middle third makes the picture weighted toward that side.
3. **ECHELON + cardinal** — groups not directly abreast or in trail (not used when the depth offset is 5 nm or less). The 45° line from the closest group decides AZIMUTH versus RANGE.
4. **TRACK** direction.

> Note: `HEAVY` describes a **group's strength** (3+ contacts). The lopsided-formation remark is `WEIGHTED`, not "heavy north".

## Leading edge and waves

Used when the whole presentation does not fit one label, to shorten a complicated picture, or to get the priority groups targeted quickly.

- Total groups first, then `LEADING EDGE` + a traditional label for the groups the fighters will employ on.
- Follow-on groups are **waves** (defence in depth): `SECOND WAVE`, `THIRD WAVE`… each with its own label.
- Give the **separation** to the next wave — shortest distance along the threat axis.

```
"TANGO, EIGHT GROUPS, LEADING EDGE THREE GROUP CHAMPAGNE, FIFTEEN WIDE, TWELVE DEEP, TRACK EAST. NORTH LEAD GROUP BULLSEYE …
 SECOND WAVE SEPARATION THIRTY, FIVE GROUP WALL, FORTY WIDE."
```

How deep the leading edge runs is airframe-specific and set in mission planning — the trainer assumes a wave break at more than 25 nm of depth.

## Packages

Bodies of groups outside the briefed bounding limits are separate packages (waves differ from packages by their *depth* component). Each package may carry its own picture.

```
"TANGO, TWO PACKAGES AZIMUTH SIXTY, NORTH PACKAGE BULLSEYE 290/100, SOUTH PACKAGE BULLSEYE 250/105."
"TANGO, NORTH PACKAGE, TWO GROUPS RANGE TEN, TRACK EAST. LEAD GROUP BULLSEYE 290/100, THIRTY THOUSAND, HOSTILE. TRAIL GROUP, …"
```

Bounding limits are mission-planned — the trainer assumes a package break at more than 40 nm across the axis.

## Maneuvers (after the picture)

Groups keep flying after the initial picture, and they maneuver. Once the picture is called the **group names are locked**: a wall whose north group turns away is still a wall of NORTH / MIDDLE / SOUTH GROUP. Call the maneuver by the name the group already has; do **not** re-label or re-call the picture because the geometry no longer fits WALL.

- **Format** — `[group name], [aspect] [cardinal]`. The aspect is relative to the friendly fighters, in the same bands as BRAA aspect: HOT, FLANK, BEAM, DRAG. FLANK / BEAM / DRAG carry the new track direction; HOT stands alone.
- A lone group is just `GROUP`. In a packages picture the package name is part of the group's name.

```
"TANGO, NORTH GROUP, FLANK NORTH"
"TANGO, LEAD GROUP, DRAG WEST"
"TANGO, NORTH GROUP, HOT"            (the same group turning back in)
"TANGO, SOUTH PACKAGE LEAD GROUP, BEAM SOUTH"
```

### SPLIT

A group that divides into two groups more than 3 nm apart has **split**. Name the group as called, say `SPLIT`, then give each resulting group by its new name with BULLSEYE, altitude, track and declaration. The new names put the side across the threat axis in front of the old name (`LEAD GROUP` → `NORTH LEAD GROUP` / `SOUTH LEAD GROUP`). From then on, the pieces go by those names.

```
"TANGO, LEAD GROUP SPLIT. NORTH LEAD GROUP BULLSEYE 275/80, THIRTY THOUSAND, TRACK NORTHEAST, HOSTILE.
 SOUTH LEAD GROUP BULLSEYE 272/77, THIRTY THOUSAND, TRACK EAST, HOSTILE."
```

*Trainer convention:* the Picture Trainer drills track maneuvers and splits. Altitude changes and other maneuver calls are not modelled yet. The new-name rule gives awkward names when the old name already starts with a side (`NORTH NORTH GROUP`), and the trainer skips a split whose names would collide with a group already called. **Check the maneuver and SPLIT formats against the ALSSA maneuver paragraph before treating them as doctrine.**

## Fighter-specific calls (BRAA format)

| Trigger | Controller response |
|---------|---------------------|
| `"TANGO, RAPTOR11, BOGEY DOPE"` | `"RAPTOR11, GROUP BRAA 275/45, THIRTY THOUSAND, HOT, HOSTILE"` — the nearest group to that fighter; does not imply targeting |
| Unreported group meets briefed THREAT criteria | `"RAPTOR12, THREAT GROUP BRAA 270/13, FIVE THOUSAND, HOT, HOSTILE"` — to the closest fighter |

FLANK / BEAM / DRAG carry a cardinal (`FLANK NORTHEAST`).

## Electromagnetic attack responses

| Fighter call | Controller response |
|--------------|---------------------|
| `STROBE 285` / `STROBE LEAD GROUP` | Range, altitude, declaration and group name of the **closest group along that bearing** (correlate within ±30°; answer CLEAN if nothing correlates) — `"RAPTOR11, STROBE RANGE THIRTY-SEVEN, TWENTY-FIVE THOUSAND, HOSTILE, LEAD GROUP"` |
| `MUSIC NORTH GROUP` | Anchor that group off bullseye with altitude, track, declaration, fill-ins |
| `METALLICA LEAD GROUP` | Informative — no response required; fighter keeps targeting responsibility |

---

*Sources: ALSSA multi-Service air control communication standard (local extract, Oct 2024 edition); Research Document - Technical Architecture for High-Fidelity Tactical C2 Simulation. Paraphrased — verify against the PDF in `D:\ACC Refs` before treating as exam truth.*
