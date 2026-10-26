# Picture Call Flash Cards

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

- **Filters**: category, pictures and/or maneuvers, threat axis, shuffled or in order.
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

Radar plots behind each track show the last ~30 s of movement. Read a CAP's orbit and a maneuvering group's turn from them.

## Rebuilding

The cards come from the Picture Trainer's own scenario generator and answer engine, so they always match it. After changing anything in `picture_trainer/src/`:

```bash
node flashcards/build/build_cards.js          # rewrites flashcards/cards_data.js (~30 s)
node flashcards/build/build_cards.js --check  # what CI runs: fails if cards_data.js is stale or a card is bad
```

The build flies each scenario headlessly, takes the picture card 32 s into the ingress, "calls" it, and keeps flying. Each maneuver becomes a card about 20 s after the turn shows. Timings are in `SNAPSHOT` at the top of the build script, the study notes on the back in `TIPS`, and the drawn measurements in the *measurements* section of the build script.

| File | Role |
|------|------|
| `build/build_cards.js` | Generates `cards_data.js` from `picture_trainer/src` |
| `cards_data.js` | The deck (generated, committed so the page works without a build step) |
| `src/card_render.js` | Draws a card's scope as an SVG string; measure helpers |
| `src/deck.js` | Filters, shuffle, flip, got / missed, PNG export |
