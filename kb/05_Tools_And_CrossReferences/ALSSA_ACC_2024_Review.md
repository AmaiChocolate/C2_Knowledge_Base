# Accuracy Review Against ALSSA ACC (October 2024)

**Reviewed:** 2026-11-18  
**Source:** ATP 3-52.4 / MCRP 3-20F.10 / NTTP 6-02.9 / AFTTP 3-2.8, *Air Control Communication*, 09 OCT 2024 (Distribution A). Citations are chapter.paragraph and the printed page number.  
**Scope:** the Picture Trainer answer engine (`picture_trainer/src`), the BC3 Scope Trainer WD seat (`simulator/src/wd_seat.js`), the flash cards and WD from Zero course (`flashcards/`), and the KB notes that teach comm formats.  
**Tags:** `#review` `#alssa` `#wd`

Each item is **Matches**, **Conflicts** (ours is wrong against the publication) or **Not covered** (the publication leaves it to mission planning or does not address it).

## Status: all 16 conflicts fixed (2026-11-18)

| # | Fix |
|---|-----|
| 1 | `picture_logic.js` `trackMode()`: no TRACK when every group is HOT along the threat axis, once after the label for a common non-HOT track, per group otherwise; the answer key's track is blank when assumed |
| 2 | `PICTURE_RULES.aspectDeg` = 30 / 70 / 120; maneuver target aspects moved inside the new bands |
| 3 | SPLIT replaced: `[GROUP] MANEUVER SPREAD / RANGE / AZIMUTH. NORTH ARM [aspect]. SOUTH ARM [aspect].`; pieces are ARMs; grading, trainer form, cards and course module 6 follow |
| 4 | Waves voiced `SECOND WAVE FIFTEEN, THREE GROUP WALL` |
| 5 | LADDER: `[second group] SEPARATION [nm]` |
| 6 | WD seat THREAT range 35 nm; module 8 THREAT calls use the group's name (`… NORTH GROUP THREAT, BRAA …`) |
| 7 | WD seat and module 8: `RAPTOR COMMIT`, fighter acknowledges with call sign |
| 8 | Lessons, trainer README and cards say labels are post-COMMIT; scenarios stay labeled for drill purposes |
| 9–10 | `Communication_Flow.md` rewritten from ACC chapters II–III (check-in, WORDS, LOWDOWN, roll call) |
| 11–12 | `Tactical_Range_Calls.md`, `ROE_Declarations.md`, `DCA_Mission_Timeline.md`, `Scope_Simulator_Architecture.md`: conflicting calls corrected; unverified material labeled |
| 13 | HIGH fill-in above 40,000 ft (`PICTURE_RULES.highFtMsl`) |
| 14 | BOGEY DOPE answered by the group's name |
| 15 | STROBE voices the aspect when the group is not HOT |
| 16 | Lessons and module 1 state that bearings are magnetic |

Tests: `picture_trainer/tests/run_tests.js` now also checks track-assumed, LADDER separation, wave wording and the aspect bands.

## Conflicts, in priority order

| # | Topic | Ours | ALSSA ACC 2024 | Where ours lives |
|---|-------|------|----------------|------------------|
| 1 | **TRACK when every group is HOT** | Every picture with a common track says it after the label: `THREE GROUP WALL, THIRTY WIDE, TRACK EAST`. 320 of 450 picture cards do this for raids flying straight at the fighters | "If all GROUPs in a PICTURE are HOT along the fight axis, track direction is assumed" (IV.14.f(1), p. 44, figure 14: `TWO GROUPS, AZIMUTH TWENTY. NORTH GROUP ROCK 2-7-0/50 …` with no TRACK). A common track **other than hot** is voiced once after the label (IV.14.f(2), figure 15); different tracks go on each group (IV.14.f(3), figure 16) | `picture_logic.js` (`describeFormation`, `formationHeader`); every card and course call; course lesson 1 and M1 questions; `Picture_Call_Logic.md` |
| 2 | **Aspect bands** | HOT ≤ 30°, FLANK ≤ 60°, BEAM ≤ 110°, DRAG beyond (`PICTURE_RULES.aspectDeg`) | HOT 0–30° TA, **FLANK 31–70°**, **BEAM 71–120°**, DRAG 121–180° (IV.6.c, figure 1, p. 29) | `picture_logic.js`; maneuver cards, course modules 2, 6, 7; card tips; course lessons |
| 3 | **SPLIT** | `NORTH LEAD GROUP SPLIT. NORTH NORTH LEAD GROUP BULLSEYE …` | The word SPLIT does not appear. A group that divides is called with **MANEUVER** and its relationship: MANEUVER SPREAD / RANGE / AZIMUTH / RANGE AND AZIMUTH / AZIMUTH AND RANGE (V.10.c, pp. 64–68); pieces become **ARMs** named with the old group name (`NORTH ARM LEAD GROUP TRACK NORTH`, V.10.d(4), p. 69); outside targeting range a NEW PICTURE may be called (V.10.d(2)) | `maneuvers.js` split logic; maneuver cards; course module 6; `Picture_Call_Logic.md` |
| 4 | **Follow-on wave wording** | `SECOND WAVE SEPARATION THIRTY, FIVE GROUP WALL, FORTY WIDE` | `SECOND WAVE FIFTEEN, THREE GROUP WALL` (IV.17.e, figures 26–27, p. 55): the separation number follows the wave name directly, without the word SEPARATION; the examples give the follow-on wave's label without dimensions | `picture_logic.js` (`generateWavePicture`); course module 5 (its "How is the second wave introduced?" question teaches the wrong form) |
| 5 | **LADDER separation** | `THREE GROUP LADDER, THIRTY DEEP … MIDDLE GROUP, …` | "A separation distance will be communicated from the LEAD GROUP to the next GROUP" (IV.16.f(3), p. 53): `MIDDLE GROUP SEPARATION FIFTEEN, TWENTY THOUSAND, HOSTILE` (figure 25) | `picture_logic.js` (LADDER) |
| 6 | **THREAT criteria and format (DCA module)** | WD seat: THREAT due when an untargeted hostile is inside **15 nm**; module 8 builds `RAPTOR11, THREAT GROUP BRAA …` for groups already in the picture | Default THREAT criteria **35 nm, independent of aspect** (V.17.c(1), p. 74), mission-planned otherwise. A named group keeps its name: `HEAT 31, ADDITIONAL GROUP THREAT, BRAA 1-2-5/35 …` (V.17.c(1)), `EAGLE 11, LEAD GROUP, THREAT BRAA …` (IV.4.b(4), p. 27). `THREAT GROUP` is for an **undetected or unreported** group (IV.20.c, p. 58) | `wd_seat.js` (`threatNm`); course module 8 |
| 7 | **COMMIT call** | `RAPTOR11, COMMIT` | With controller commit authority the COMMIT is directed at the end of the picture or core-information call: `WARRIOR, TEN GROUPS, GROUP ROCK 2-5-0/45, …, HOSTILE, RAPTOR COMMIT.` Fighter acknowledges `RAPTOR 1`. Without authority the controller recommends: `…, RECOMMEND RAPTOR COMMIT.` Two-way communication is required (V.3.b, pp. 60–61) | `wd_seat.js` (`commit`); course module 8 lesson |
| 8 | **Labels before COMMIT** | The trainer labels every picture | Traditional labels are used once COMMIT criteria are met and the formation is discernible (IV.13.a, p. 37); pre-COMMIT pictures are core information (IV.10.a(1), figure 5). After a fighter-directed COMMIT the controller moves to labels or LEADING EDGE (V.3.b(5)) | Trainer and course: add the context ("post-COMMIT") rather than change every scenario |
| 9 | **LOWDOWN** | `Communication_Flow.md`: a general tactical summary (picture, emitters, weather, tanker, bingo field) after authentication | LOWDOWN is a request for the **tactical electromagnetic support picture or ground/surface picture**, correlated in BULLSEYE format; passed at a briefed time and immediately followed by a roll call, or at check-in as part of WORDS for late aircraft; may be digital (Link 16, chat) or voice (III.2, pp. 20–21). Example: `GOLIATH, LOWDOWN. SA TWENTY AWAKE BULLSEYE 0-9-0/10, HQ-9 ACTIVE BULLSEYE 0-8-5/13, …` Order for tactical SAMs and MOVERS: closest MEZ to friendly forces, closest MEZ to friendly axis of attack or ingress routes, most lethal | `kb/03_Notes_And_Insights/Communication_Flow.md` |
| 10 | **Check-in** | `Communication_Flow.md`: `WARRIOR, RAPTOR 11, flight of 2, Checking in` / authenticate / "standby for Lowdown" | Check-in tasks are in table 2 (II.4, pp. 6–7): positive friendly ID, ALPHA CHECK from BULLSEYE (correlated within 3 nm), safety-of-flight information, WORDS, weather, post-mission inflight report; terminal-control check-in follows the MNPOPCA order (table 3) | `Communication_Flow.md` |
| 11 | **THREAT and BEAM in the Research Document notes** | `Tactical_Range_Calls.md`: THREAT is "hostile group within pre-briefed range (typically 5nm)", example `THREAT, RAPTOR, BULLS 180/20, HIGH, TRACK HOT`; BEAM "70–110° aspect" | THREAT default 35 nm (V.17.c(1)); format above (#6); BULLSEYE is never shortened (IV.4.a(4)); HIGH never replaces the altitude (IV.5.b); aspect, not TRACK, with BRAA (IV.6.c); BEAM is 71–120° TA (figure 1) | `kb/03_Notes_And_Insights/Tactical_Range_Calls.md` |
| 12 | **DECLARE response** | `ROE_Declarations.md`: `RAPTOR, DECLARE BULLSEYE 180/40` → `HOSTILE, BULLSEYE 180/40`; picture example with `HIGH` | Request: `[custody call sign], [requester], DECLARE BULLSEYE 2-3-0/12, TWELVE THOUSAND` or `DECLARE EAST GROUP`. Response always gives BULLSEYE, altitude, track direction, declaration, fill-ins: `CHALICE, EAST GROUP BULLSEYE 2-7-3/27, TWENTY-TWO THOUSAND, TRACK EAST, BOGEY SPADES` (V.7, pp. 62–63) | `kb/03_Notes_And_Insights/ROE_Declarations.md` |
| 13 | **HIGH as a fill-in** | Course and notes say only that HIGH is never used for altitude | HIGH is not used **in place of** an altitude (IV.5.b), but it **is** a fill-in for a contact above 40,000 ft MSL (IV.8.b(3), p. 30: `… FORTY-TWO THOUSAND, TRACK WEST, HOSTILE, HIGH, VERY FAST`). The trainer has groups at 41,000 ft and never adds it | `picture_logic.js` fill-ins; course module 1 lesson |
| 14 | **BOGEY DOPE answer** | `RAPTOR11, GROUP BRAA …` | The answer names the group when it has a name: `EAGLE 11, NORTH GROUP BRAA 2-1-0/28 …`, `EAGLE 1, FIRST ADDITIONAL GROUP BRAA …` (V.11, p. 71) | `picture_logic.js` (`generateBogeyDope`) |
| 15 | **STROBE answer** | Range, altitude, declaration, group name; aspect never voiced | Range, altitude, **aspect (HOT assumed)**, declaration, group name (V.12.a, p. 71): aspect is voiced when the group is not HOT | `picture_logic.js` (`generateStrobeResponse`) |
| 16 | **Bearings** | The simulator documents bearings as true; lessons do not say | BULLSEYE and BRAA bearings are **magnetic** (IV.4.a(1), IV.4.b(2), p. 26) | Course module 0 lesson; simulator README (training geometry can stay true, but the lesson should state the real convention) |

## Matches

- **GROUP** is contacts within 3 nm in azimuth and range; SINGLE CONTACT assumed (IV.2.a, p. 25).
- **HEAVY, THREE CONTACTS is correct.** HEAVY when known to have three or more contacts, then the number of contacts if determined; HEAVY alone only when the count cannot be determined (IV.2.a note, IV.8.b(1), p. 30; examples `HEAVY, THREE CONTACTS` on pp. 28 and 34). Two contacts: `TWO CONTACTS`.
- Core information order: total groups, location, altitude, track or aspect, declaration, fill-ins (IV.3, p. 26).
- BULLSEYE is the primary location and is never shortened to "bull" (IV.4.a(4)); BRAA for BRAA requests, BOGEY DOPE, SNAPLOCK and THREAT calls (IV.4.b(3)–(4), p. 27).
- Altitude to the nearest thousand feet; never HIGH or LOW in place of the altitude (IV.5, p. 28).
- TRACK with BULLSEYE calls; HOT / FLANK / BEAM / DRAG with BRAA calls; FLANK, BEAM and DRAG carry a cardinal; CAP may replace track or aspect (IV.6, pp. 29–30).
- Declarations: BOGEY, FRIENDLY, NEUTRAL, BANDIT, HOSTILE; one is required with BULLSEYE or BRAA (IV.7, p. 30).
- Five ways to communicate a picture (IV.9.d, p. 33); four or more groups without a label: the total, then only the three highest-priority groups (IV.10.c, p. 34).
- Anchoring priorities (closest to fighters, most capable, highest, largest STRENGTH) and anchoring groups outside 10 nm in azimuth, outermost when several (IV.12, p. 36).
- Amplification order OPENING/CLOSING, WEIGHTED, ECHELON, TRACK; WEIGHTED by thirds; ECHELON's 45° line and no ECHELON at 5 nm of depth or less (IV.14, pp. 38–42).
- SINGLE GROUP, AZIMUTH and RANGE definitions and names (IV.15, pp. 46–47).
- The 5 nm depth rule; WALL (names to five groups, numbered inner groups beyond five), CHAMPAGNE (WIDE then DEEP), VIC (DEEP then WIDE), BOX (WIDE then DEEP), LADDER names (MIDDLE in three, SECOND / THIRD beyond) (IV.16, pp. 47–53).
- LEADING EDGE: total groups first, a traditional label after LEADING EDGE, follow-on WAVES numbered SECOND, THIRD with their own labels, separation along the threat axis (IV.17, pp. 54–56). Only the wording of the separation conflicts (#4).
- PACKAGES: `TWO PACKAGES AZIMUTH SIXTY, NORTH PACKAGE BULLSEYE …, SOUTH PACKAGE BULLSEYE …`, then a picture per package (IV.18, p. 56).
- THREAT GROUP for an unreported group meeting THREAT criteria, BRAA to the closest aircraft: `RAMBO 2, THREAT GROUP BRAA 2-7-0/13, ONE THOUSAND, HOT, HOSTILE` (IV.20.c, p. 58). This is the trainer's THREAT drill.
- Directive targeting `HORNET 2, TARGET NORTH GROUP` (II.3.a, p. 6); maneuver call `DARKSTAR, LEAD GROUP BEAM NORTH` keeps the picture's group names (V.10.b, p. 64).
- STROBE correlation within ±30°, CLEAN if nothing correlates; MUSIC anchored off BULLSEYE with altitude, track, declaration, fill-ins; METALLICA needs no response and keeps targeting responsibility with the fighter (V.12, pp. 71–72).
- COMMIT criteria and THREAT criteria are set in mission planning (V.3.a, V.17.c); our course already labels the simulator's commit and targeting numbers as training defaults.

## Not covered (mission planning or not modelled)

- Wave and package break distances: ALSSA leaves leading-edge depth and package bounding limits to mission planning (IV.17.a note, IV.18.a). The trainer's 25 nm / 40 nm stay labelled as trainer values.
- Commit window and targeting range: mission planned (V.3.a). TAC RANGE has a 60 nm default (V.4.b, p. 61) that the trainer does not use.
- Not modelled yet, and correctly listed as gaps: OPENING / CLOSING, WEIGHTED separation calls, ECHELON, altitude STACKs, FAST / VERY FAST, ADDITIONAL and POP-UP groups, UNTARGETED, TARGETED BY, LEANING ON, FADED / VANISHED, SMA PICTURE, inner-group formations.

## Recommended fixes

1. Engine (`picture_logic.js`, `maneuvers.js`): omit TRACK when all groups are HOT along the fight axis (#1); aspect bands 30 / 70 / 120 (#2); wave wording (#4); LADDER separation (#5); HIGH fill-in above 40,000 ft (#13); BOGEY DOPE group name (#14); STROBE aspect when not HOT (#15); replace SPLIT with ALSSA MANEUVER / ARM communication (#3, needs its own design).
2. Simulator WD seat: THREAT default 35 nm, named-group THREAT format, COMMIT call format (#6, #7).
3. Rebuild the flash cards and course; rewrite the lessons and module 1 items that teach #1, #2, #4, #13; add "post-COMMIT" context to picture prompts (#8); say bearings are magnetic (#16).
4. KB: rewrite `Communication_Flow.md` from ALSSA chapters II–III (#9, #10); correct or retire `Tactical_Range_Calls.md` and `ROE_Declarations.md` (#11, #12); update `Picture_Call_Logic.md` and remove its "needs your re-review" flag for the items now verified.
