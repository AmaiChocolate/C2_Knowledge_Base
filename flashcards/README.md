# Picture Call Flash Cards and WD from Zero

Still-image version of the [Picture Trainer](../picture_trainer/) for machines too slow to run it (NIPR workstations play the animated scope like a slideshow). Each card is one scope snapshot: make the call, flip the card, then mark it got or missed.

Nothing animates, and nothing loads from the internet. The page draws one small SVG per card, so it runs from GitHub Pages (`…/flashcards/`) or straight from a shared drive: copy the `flashcards/` folder and double-click `index.html`.

## The deck

1,030 cards, built from every Picture Trainer category × 15 variations × both threat axes:

| Cards | What you call |
|-------|---------------|
| **Picture** (450) | The full ALSSA picture: label, dimensions, anchors, altitudes, track. Threat, BOGEY DOPE, MUSIC and STROBE cards show the fighter's request and want the BRAA / anchor answer instead |
| **Maneuver** (580) | The same raid later on, after the picture has been called. The earlier calls are listed on the card, so you name the group as it was called: HOT / FLANK / BEAM / DRAG + direction, or a SPLIT with BULLSEYE for each new group |

The back of each card gives the correct call one sentence per line, the key values (groups, label, wide / deep, anchors…) and the rule that applies.

## Using it

- **Filters**: category, pictures and/or maneuvers, threat axis (E/W by default; N/S cards are still there), shuffled or in order.
- **Full scope / Raid close-up** (`V`): the close-up zooms on the hostiles so you can count contacts (wingmen sit under 2 nm from lead).
- **Measurements** (`M`, on by default): the numbers you would otherwise measure are already drawn on the scope, so the card drills the call, not the ruler work:
  - pictures: WIDE and DEEP brackets for each formation (or wave), wave SEPARATION, and package AZIMUTH separation
  - THREAT / BOGEY DOPE / STROBE: lines from the fighter with a BRAA readout box (wingmen are tagged so you can find RAPTOR12)
  - maneuvers: each group's heading and its angle off the fighters (0° = HOT), the number that decides HOT / FLANK / BEAM / DRAG

  They come from the same geometry as the answer key, so they agree with it. Turn them off to practise estimating.
- **Measure tool** (optional): click two points to read bearing / range yourself. `Esc` clears it.
- **Save image**: downloads the snapshot as a PNG, with any measurement, for slides or handouts.
- **Got it / Missed it** (`1` / `2`): at the end, *Review the ones I missed* replays only those. The missed list is also kept in this browser (if it allows storage), so **Missed cards only** brings them back next time.
- `Space` flips, `←` / `→` go back or skip.

Radar plots behind each track show the last ~30 s of movement; an orbiting (CAP) group shows a whole lap of its racetrack. Read the orbit and a maneuvering group's turn from them.

## WD from Zero course

`course.html` is a guided course for someone starting from nothing. Each module opens with a one-screen lesson, then practice that takes support away a stage at a time:

| Stage | What it asks | Graded by |
|-------|--------------|-----------|
| **Guided** | Multiple choice and "spot the error" on a scope snapshot, measurements drawn | the answer |
| **Build the call** | Type the pieces: BULLSEYE / BRAA bearing and range, altitude, label, WIDE / DEEP, track, aspect; or put a call in order | the Picture Trainer's tolerances (±5° / ±3 nm / ±1k, ±3 nm dimensions) |
| **Solo** | Make the whole call, measurements off | self-marked against the answer |

Every course scenario uses the E/W threat axis (west threat, raids tracking east). A stage is passed at 9 of 10 in one run. Passing a module's last stage opens the next one (or tick *Unlock every stage*). Every answer feeds a Leitner schedule, so missed questions come back in **Review due** after 0, 1, 3, 7 and 14 days. Progress stays in the browser when it allows storage, and **Export / Import progress** moves it between machines.

| Module | Content |
|--------|---------|
| 0 Reading the scope | Symbols, tags, track direction, contacts, the 3 nm rule |
| 1 Brevity and call format | Core-information order, BULLSEYE vs BRAA, altitude, track / aspect, declarations, fill-ins (hand-written) |
| 2 Single group | SINGLE GROUP off BULLSEYE; BOGEY DOPE in BRAA from any fighter |
| 3 Two groups | AZIMUTH vs RANGE, names, dimension, which groups are anchored |
| 4 Three or more | WALL, LADDER, CHAMPAGNE, VIC: the 5 nm rule, voiced dimensions, group names |
| 5–9 | Planned: BOX / waves / packages, maneuvers, fighter requests, DCA flow (commit, targeting, threat, from the BC3 sim), checkride mix |

Wrong options and "spot the error" calls are the correct call with one rule broken (BULLS for BULLSEYE, HIGH for an altitude, the wrong label, count, track, aspect, strength or dimension), so each explanation names the rule.

**Content review.** Lessons and module 1 are paraphrased from `kb/03_Notes_And_Insights/Picture_Call_Logic.md`, which is marked "needs your re-review"; the course shows a banner saying so and each written question cites its source. The "Research Document" notes (`Tactical_Range_Calls.md`, `ROE_Declarations.md`) disagree with the ALSSA note and are not used.

## Rebuilding

The cards come from the Picture Trainer's own scenario generator and answer engine, so they always match it. After changing anything in `picture_trainer/src/`:

```bash
node flashcards/build/build_cards.js          # rewrites flashcards/cards_data.js (~30 s)
node flashcards/build/build_cards.js --check  # what CI runs: fails if cards_data.js is stale or a card is bad
node flashcards/build/build_course.js         # rewrites flashcards/course_data.js (~10 s)
node flashcards/build/build_course.js --check
```

The build flies each scenario headlessly, takes the picture card 32 s into the ingress, "calls" it, and keeps flying. Each maneuver becomes a card about 20 s after the turn shows. Timings are in `SNAPSHOT` at the top of the build script, the study notes on the back in `TIPS`, and the drawn measurements in the *measurements* section of the build script.

| File | Role |
|------|------|
| `build/harness.js` | Shared: loads the trainer headlessly, flies scenarios, snapshots tracks, computes drawn measurements |
| `build/build_cards.js` | Generates `cards_data.js` from `picture_trainer/src` |
| `build/build_course.js` | Generates `course_data.js`: scope questions for modules 0, 2–4 and the rule-breaking distractors |
| `build/course_content.js` | Hand-written course content: module list, lessons, module 1 questions (each cites its KB source) |
| `cards_data.js` | The deck (generated, committed so the page works without a build step) |
| `src/card_render.js` | Draws a card's scope as an SVG string; measure helpers |
| `src/deck.js` | Filters, shuffle, flip, got / missed, PNG export |
| `course.html`, `course.css`, `src/course.js` | The course: lessons, question types, grading, unlocking, spaced review, export / import |
| `course_data.js` | The course (generated, committed) |
