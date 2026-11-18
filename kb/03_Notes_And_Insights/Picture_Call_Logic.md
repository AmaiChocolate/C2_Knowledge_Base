# Picture Call Logic and Formation Labels

**Last Reviewed:** 2026-11-18: checked against ALSSA ACC, ATP 3-52.4 / MCRP 3-20F.10 / NTTP 6-02.9 / AFTTP 3-2.8 (09 OCT 2024). References in brackets are to its chapter and paragraph; see [[../05_Tools_And_CrossReferences/ALSSA_ACC_2024_Review|ALSSA_ACC_2024_Review]] for what changed.  
**Tags:** `#wd` `#picture` `#brevity`  
**Related:** [[../06_Summaries_And_Learning/WD_Picture_Summary|WD_Picture_Summary]] · sim `sc-02-wall-ladder` · [[../../picture_trainer/README|Picture Trainer]] (its answer engine implements this note)

## Building blocks

- **GROUP**: contacts within **3 nm** in azimuth and range of each other. SINGLE CONTACT is assumed; more are specified [IV.2.a].
- **Strength fill-in**: `TWO CONTACTS`; three or more is `HEAVY`, followed by the number of contacts if it is determined (`HEAVY, THREE CONTACTS`). `HEAVY` alone only when the count cannot be determined [IV.2.a note, IV.8.b(1)].
- **Core information order**: total groups → location → altitude → track / aspect → declaration → fill-ins [IV.3].
- **Location**: `BULLSEYE 045/60`, the primary method; never shortened to "bull" because it gets heard as BRAA. `BRAA` when the call pertains to one aircraft: BRAA requests, BOGEY DOPE, SNAPLOCK, THREAT calls. Bearings are **magnetic**, rounded to the nearest degree and nm; within 5 nm of BULLSEYE a group may be `AT BULLSEYE` [IV.4].
- **Altitude**: nearest thousand feet (`THIRTY-TWO THOUSAND`). Never `HIGH` or `LOW` in place of the altitude; `ALTITUDE UNKNOWN` if the platform can measure altitude but has no solution. 10,000 ft or more of separation inside a group is a `STACK`, higher altitude first [IV.5].
- **Track / aspect**: `TRACK` + cardinal or sub-cardinal with BULLSEYE calls; HOT / FLANK / BEAM / DRAG with BRAA calls, the last three with a cardinal (`DRAG EAST`). `CAP` may replace track or aspect for an orbiting group [IV.6].
- **Aspect bands** (target aspect, figure 1): **HOT 0–30°, FLANK 31–70°, BEAM 71–120°, DRAG 121–180°** [IV.6.c].
- **Declaration**: BOGEY / FRIENDLY / NEUTRAL / BANDIT / HOSTILE; required with a BULLSEYE or BRAA call [IV.7].
- **Fill-ins**, in priority order: HEAVY and number of contacts; platform or NATO type; `HIGH` for a contact above **40,000 ft MSL**; `FAST` (660–900 kt) / `VERY FAST` (over 900 kt); `TARGETED BY`, `LEANING ON`, `THREAT TO`; `IMPACT` time [IV.8.b].

## Five ways to communicate a picture

1. **Core information**: pre-COMMIT, or when the picture fits no traditional or LEADING EDGE label. With four or more groups: the total, then only the three highest-priority groups [IV.10].
2. **Traditional labels**: once COMMIT criteria are met and the formation is discernible [IV.13.a].
3. **LEADING EDGE** [IV.17].
4. **WAVES** [IV.17.e].
5. **PACKAGES** [IV.18].

Friendly, neutral and non-participating groups are not counted in the picture; they go in a separate transmission [IV.9 note].

## Traditional labels

Measure **WIDE** across the threat axis and **DEEP** along it. The lead group is the one closest to the fighters.

| Groups | Label | Rule | Dimensions voiced | Group names |
|--------|-------|------|-------------------|-------------|
| 1 | SINGLE GROUP | the only known BOGEY / BANDIT / HOSTILE group; passed as core information | - | - |
| 2 | AZIMUTH | about the same distance from the fighters (wider than deep) | `TWO GROUPS AZIMUTH TWENTY` | cardinal (NORTH / SOUTH GROUP) |
| 2 | RANGE | one closer to the fighters (deeper than wide) | `TWO GROUPS RANGE THIRTY` | LEAD / TRAIL GROUP |
| 3+ | WALL | depth **≤ 5 nm** (or CLOSING inside 5) | `… WIDE` | outer = cardinal, inner = MIDDLE (cardinal MIDDLE when several); more than five: numbered inner groups (SECOND…) |
| 3+ | LADDER | separated in range | total `DEEP`, then the **SEPARATION from the LEAD GROUP to the next group** | LEAD, MIDDLE (three groups) or SECOND, THIRD… (more), TRAIL |
| 3 | CHAMPAGNE | two closest abreast, third in trail (depth > 5 nm) | WIDE then DEEP | cardinal LEAD GROUPs, TRAIL GROUP |
| 3 | VIC | one closest, two in trail abreast (depth > 5 nm) | DEEP then WIDE | LEAD GROUP, cardinal TRAIL GROUPs |
| 4 | BOX | two abreast closest, two abreast farthest | WIDE then DEEP | cardinal LEAD / TRAIL GROUPs, voiced clockwise or counterclockwise by anchoring priority |

**The 5 nm depth rule** decides WALL versus CHAMPAGNE / VIC [IV.16.a].

### Track in a labeled picture [IV.14.f]

- Every group **HOT along the fight axis**: track is **assumed**, so no TRACK is said at all.
- Every group sharing a track **other than HOT**: say it once, after the label and dimensions.
- Different tracks: give each group its own.

### Examples (ALSSA figures, and the trainer's format)

```
"BLACKOUT, THREE GROUP WALL TWENTY-FIVE WIDE. NORTH GROUP ROCK 2-8-0/22, THIRTY THOUSAND, HOSTILE.
 MIDDLE GROUP, THIRTY THOUSAND, HOSTILE. SOUTH GROUP ROCK 2-2-5/35, TWENTY-FIVE THOUSAND, HOSTILE."     (figure 19)

"BARNYARD, THREE GROUP VIC FIFTEEN DEEP, TWENTY WIDE. LEAD GROUP ROCK 2-3-0/17, THIRTY-TWO THOUSAND, HOSTILE,
 TWO CONTACTS, FLANKER. NORTH TRAIL GROUP, TWENTY-FIVE THOUSAND, HOSTILE, TWO CONTACTS. SOUTH TRAIL GROUP, …"  (figure 23)

"DARKLORD, THREE GROUP LADDER THIRTY DEEP. LEAD GROUP ROCK 2-2-5/10, THIRTY THOUSAND, HOSTILE.
 MIDDLE GROUP SEPARATION FIFTEEN, TWENTY THOUSAND, HOSTILE. TRAIL GROUP FORTY THOUSAND, HOSTILE."  (figure 25)

"BARNYARD, TWO GROUPS AZIMUTH TWENTY TRACK WEST, NORTH GROUP ROCK 2-7-0/50, …"   (figure 15: common track, not HOT)

"CHALICE, SINGLE GROUP BULLSEYE 3-6-0/20, TWENTY THOUSAND, TRACK WEST, BOGEY SPADES."   (IV.15.a)
```

### Anchoring [IV.12]

Anchor (give a BULLSEYE for) by priority when risk to force leads: closest to the fighters → most capable → highest → largest STRENGTH. Priorities can shift to risk to mission (an enemy striker nearing a mission fail line). Groups are anchored when **outside 10 nm in azimuth**; with several in azimuth, only the outermost unless using directive targeting. Groups in trail take their position from the lead group and the dimension.

### Amplifying remarks, after the dimensions, in this order [IV.14]

1. **OPENING / CLOSING**: separation changing enough to matter to the intercept.
2. **WEIGHTED + cardinal**: three or more groups not evenly spaced. Split the azimuth into thirds; a group outside the middle third makes the picture weighted. A WEIGHTED WALL also gives the separation from the priority anchored group to the next closest.
3. **ECHELON + cardinal or sub-cardinal**: groups not directly abreast or in trail (not used at 5 nm of depth or less). The 45° line from the group closest to the fighters decides AZIMUTH (forward of it) versus RANGE (aft); the distance is passed as SEPARATION.
4. **TRACK** direction, per the rule above.

> `HEAVY` is a group's strength (3+ contacts). A lopsided formation is `WEIGHTED`, not "heavy north".

## LEADING EDGE and WAVES [IV.17]

Used when the groups do not fit a traditional label, to shorten a complicated picture, or to get priority groups targeted quickly. How deep the leading edge runs is airframe-specific and mission-planned.

- Total groups first, then `LEADING EDGE` + a traditional label for the groups the fighters expect to employ on.
- Follow-on groups are waves: `SECOND WAVE`, `THIRD WAVE`…, each with a traditional label.
- Each wave is voiced with its separation, the shortest distance along the threat axis from the wave in front, **without the word SEPARATION**:

```
"WARRIOR, EIGHT GROUPS, LEADING EDGE THREE GROUP WALL TWENTY-FIVE WIDE. NORTH GROUP ROCK 1-3-5/10, THIRTY THOUSAND,
 HOSTILE, FLANKER. MIDDLE GROUP SEPARATION TWELVE, … SECOND WAVE FIFTEEN, THREE GROUP WALL, FLANKER.
 THIRD WAVE FIFTEEN, TWO GROUPS AZIMUTH, FLOUNDER."     (figure 27)
```

The trainer breaks a wave at more than 25 nm of depth (a trainer value; the real one is mission-planned).

## PACKAGES [IV.18]

Groups outside the briefed bounding limits are separate packages (waves differ from packages by their depth). Each package may carry its own picture; refer to a group by group and package name when targeting (`VIPER 2, TARGET LEAD GROUP NORTH PACKAGE`).

```
"GOLIATH, TWO PACKAGES AZIMUTH SIXTY, NORTH PACKAGE BULLSEYE 0-3-0/45, SOUTH PACKAGE BULLSEYE 1-1-0/55."
"CHALICE, NORTH PACKAGE, TWO GROUPS RANGE TEN, TRACK WEST. LEAD GROUP BULLSEYE 0-4-5/35, TWENTY-FIVE THOUSAND,
 HOSTILE, TWO CONTACTS. TRAIL GROUP FIFTEEN THOUSAND, HOSTILE, TWO CONTACTS."
```

The trainer breaks packages at more than 40 nm across the axis (a trainer value).

## NEW PICTURE, ADDITIONAL, POP-UP and THREAT groups [IV.19–20]

- Keep the original labels and names unless new ones fix or better facilitate targeting; `NEW PICTURE` when fighters are HOT.
- **ADDITIONAL GROUP**: newly detected outside targeting range, or not fitting the label; anchored by BULLSEYE.
- **POP-UP GROUP**: previously undetected or unreported, appearing inside targeting range and outside THREAT range.
- **THREAT GROUP**: undetected or unreported and meeting THREAT criteria; called in BRAA to the closest aircraft.

## Maneuvers (after the picture) [V.10]

Once the picture is called, group names are kept: a wall whose north group turns away is still NORTH / MIDDLE / SOUTH GROUP.

- Recognise the maneuver, communicate it, and update names and altitude as targeting needs.
- With a direction: call sign, group name, maneuver: `DARKSTAR, LEAD GROUP BEAM NORTH`. If an aspect does not apply to all fighters, use track: `DARKSTAR, LEAD GROUP TRACK NORTH`.
- `MANEUVER` when the direction cannot yet be determined; "maneuver hot" for groups turning toward the fight axis.

### A group that divides: MANEUVER and ARMs [V.10.c–d]

There is no SPLIT call. Say MANEUVER and how the contacts divided:

| Call | Contacts |
|------|----------|
| `MANEUVER SPREAD` | all still FLANK or HOT |
| `MANEUVER RANGE` | at least one FLANK / HOT, at least one BEAM / DRAG |
| `MANEUVER AZIMUTH` | all BEAM or DRAG |
| `MANEUVER RANGE AND AZIMUTH` | three or more contacts dividing both ways, at least one FLANK / HOT |
| `MANEUVER AZIMUTH AND RANGE` | three or more contacts dividing both ways, none FLANK / HOT |

The pieces are ARMs (and ARMs maneuver into CONTACTs). A single group's pieces are `NORTH ARM` / `SOUTH ARM`; when several groups divide, add the old name: `NORTH ARM LEAD GROUP TRACK NORTH`. Outside targeting range a NEW PICTURE may be called instead. PASSING, CROSSING and JOINED describe groups changing places or joining.

Trainer format: `WARRIOR, LEAD GROUP MANEUVER RANGE. NORTH ARM BEAM NORTH. SOUTH ARM HOT.`

## Fighter-specific calls (BRAA format)

| Trigger | Controller response |
|---------|---------------------|
| `MIKE, EAGLE 11 BOGEY DOPE NORTH GROUP` / `BOGEY DOPE` | `EAGLE 11, NORTH GROUP BRAA 2-1-0/28, THIRTY-EIGHT THOUSAND, HOT, HOSTILE`: the named or closest group, by its name; does not imply targeting [V.11] |
| An undetected or unreported group meets THREAT criteria | `RAMBO 2, THREAT GROUP BRAA 2-7-0/13, ONE THOUSAND, HOT, HOSTILE`, to the closest aircraft [IV.20.c] |
| A named, UNTARGETED group will be inside THREAT range | `HEAT 31, ADDITIONAL GROUP THREAT, BRAA 1-2-5/35, THIRTY-FIVE THOUSAND, HOT, HOSTILE`. Default THREAT criteria **35 nm, independent of aspect**; completed no later than threat range. BULLSEYE if the fighter's position is unknown or several fighters are threatened; within 5 nm, cardinal direction and range [V.17] |

## Electromagnetic attack responses [V.12]

| Fighter call | Controller response |
|--------------|---------------------|
| `STROBE 3-6-0` / `STROBE LEAD GROUP` | Range, altitude, aspect (HOT assumed), declaration and group name of the **closest group along that line of bearing**, correlated within ±30°; CLEAN if nothing correlates: `RAMBO 1, STROBE RANGE THIRTY-SEVEN, TWENTY-FIVE THOUSAND, HOSTILE, LEAD GROUP` |
| `MUSIC EAST GROUP` | Anchor the group off BULLSEYE with altitude, track, declaration, fill-ins |
| `METALLICA LEAD GROUP` | Informative: no response required; the fighter keeps targeting responsibility |

## COMMIT and targeting [V.3, V.5]

- COMMIT criteria are mission-planned (range, location, threat or weapons based). COMMIT authority comes from the combatant commander and may be delegated.
- Controller with authority: end the picture or core-information call with `RAPTOR COMMIT`; the fighter answers `RAPTOR 1`. Without it: `…, RECOMMEND RAPTOR COMMIT`. Two-way communication is required.
- Directive targeting: `HORNET 2, TARGET NORTH GROUP`. Fighters report `TARGETED WEST GROUP` (with BULLSEYE when there is no data link).
- `TAC RANGE`: default 60 nm from the closest fighter to the closest group.

---

*Source: ALSSA ACC, ATP 3-52.4 / MCRP 3-20F.10 / NTTP 6-02.9 / AFTTP 3-2.8, 09 OCT 2024, Distribution A. Paraphrased; trainer conventions are marked as such.*
