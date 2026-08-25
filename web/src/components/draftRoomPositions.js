// Six positions, six hues, chosen for maximum mutual distinctness rather
// than reused from anywhere else — the previous set (violet/emerald/sky/
// amber/teal/slate, matching ShowYourWorking.jsx's homepage demo) put WR
// and K one hue-family apart (sky/teal) and left DST as slate, which reads
// as "no colour" rather than a sixth colour. Reported back as "too similar"
// after the board switched to full colour-block cells, where the mistake
// is much harder to miss than it was on a small translucent badge.
//
// Two hues are deliberately avoided everywhere in this file: teal and
// purple are the brand accent pair (tailwind.config.js, the CTA gradient,
// focus rings, "my turn"), and red/rose already mean danger/urgent
// elsewhere in the draft room (DraftRoomStatusBar's urgent countdown,
// Discard's hover state). Reusing any of those four as a *position* colour
// would make the position identity compete with an existing UI meaning
// instead of standing alone.
//
//   QB  orange   — the marquee position, the warmest hue on the board
//   RB  emerald  — unchanged; every other component already agreed on it
//   WR  blue     — a true blue, nowhere near teal
//   TE  fuchsia  — bold pink-violet, nowhere near brand purple
//   K   yellow   — bright gold, distinct from orange despite sitting
//                  next to it on the wheel (Tailwind's actual amber/
//                  orange/yellow swatches read apart even at close hues)
//   DST indigo   — deep and moody rather than left as "no colour"
//
// This is the one hue reference for the whole site now, not just the draft
// room — POS_BADGE is imported directly by ShowYourWorking.jsx's homepage
// scoring demo as well as the queue, the profile drawer, the roster dock
// and the log dock, and POS_CELL_BLOCK is the board's full-colour cells.
// All of them point at the same six hues below, so a position can no
// longer read as a different colour depending which panel — or which page
// — you're looking at.
//
// Written out as full literal class strings in both objects below rather
// than built from a name -> hue map with template interpolation: Tailwind's
// JIT scanner finds classes by grepping source files for the literal
// string, and `` `bg-${hue}-950/60` `` never appears as one — it would
// compile to nothing, silently, and every cell would render with no colour
// at all. The table above is documentation only, not code these read from.

// Small translucent chip — the queue's position tag, the profile drawer's
// header badge, a roster-dock slot, a log-dock row. Same 15%-bg/300-text
// formula this always used; only which hue each position points at moved.
export const POS_BADGE = {
  QB: 'bg-orange-500/15 text-orange-300',
  RB: 'bg-emerald-500/15 text-emerald-300',
  WR: 'bg-blue-500/15 text-blue-300',
  TE: 'bg-fuchsia-500/15 text-fuchsia-300',
  K: 'bg-yellow-500/15 text-yellow-300',
  DST: 'bg-indigo-500/15 text-indigo-300',
}

export const POS_LIST = ['QB', 'RB', 'WR', 'TE']

// The plain-English name for a position key — used anywhere a sentence
// names a position rather than labelling a chip (TendenciesStrip.jsx's
// weakest-spot sentence, AllDraftsInsights.jsx's report). Promoted here
// from a local copy in TendenciesStrip.jsx once a second file needed the
// same six names — this file is already documented as the one position
// reference for the whole site, and a name is exactly the kind of thing
// that drifts silently if it is ever written down twice.
export const POS_NAMES = { QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end', DST: 'Defense', K: 'Kicker' }

/* POS_CELL_BLOCK — the board grid's old full-colour-block cells — lived here
   until a third look overturned the verdict directly above this line. Worth
   keeping the record straight, since the comment that used to sit here
   argued the opposite of what actually shipped:

   The first look built the rail once, screenshotted it, and rejected it —
   "at working zoom the rails are nearly invisible." The second look re-built
   it, re-screenshotted it on a real 140-pick board, and rejected it again —
   a 3px rail read as almost uniformly dark, a bolder 6px rail closed some of
   the gap but still lost to the fill at a glance. Both times the conclusion
   was "fill, not rail," and both times it was reached by looking rather than
   assuming, which is exactly what should make a third reversal suspicious
   rather than obviously correct.

   The third look is the one that actually shipped: a Cockpit-wide design
   review of the built (not prototyped) screens read the full-colour cells as
   a saturated quilt fighting the ADP-delta tint on every card, and the fix
   landed — a neutral #151923 cell with a 3px POS_SOLID left rule, the exact
   geometry the first two attempts already tried and rejected. It survived
   this time for a reason the first two attempts didn't have: it wasn't
   competing with a hypothetical, it was compared against the thing it would
   replace, live, with every other cell affordance (the arrow, the pick code,
   the ADP delta) already drawn around it — and a design review, a full test
   suite, and now this file's own mobile counterpart all independently landed
   on the same rail. Three lookers agreeing the rail works is a different
   kind of evidence than one file's own two earlier tries agreeing it
   doesn't, on a board that didn't yet have to share the cell with anything
   else.

   POS_CELL_BLOCK has no remaining consumers anywhere in web/src as of this
   note — removed rather than kept dark, the same reasoning this project
   applies to any other dead control: an unused export a future reroute could
   "helpfully" wire back in is a fourth look nobody asked for. If the rail
   ever loses another look, rebuild it from POS_SOLID directly (it's the same
   six hex values) rather than reaching for this name again. */

/* The board header's roster chips, and these are the *solids* rather than the
   tints above. Each count carries its own ground on purpose: white on a
   position solid is the contract those colours were darkened to meet, so the
   header behind a chip is never part of the sum.

   These used to be style.css's legacy --qb/--rb/--wr/--te hexes — red, blue,
   green, orange — reused so the two boards wouldn't drift on an already
   contrast-checked colour. They drifted anyway, the other way: once the cells
   above moved to this file's own six hues, a QB read orange in its cell and
   red in that same team's roster-strip chip one row up, on one screen. All
   six now come from this file's own POS_BADGE/POS_CELL_BLOCK hues, at
   Tailwind's -700 step, the shade each needs to clear white text — the
   700 step is uniform across all six for the same reason the legacy solids
   were each darkened to the same ~4.6 rather than left at whatever their
   individual hue happened to allow: yellow is the hard case (yellow-600 is
   only 2.94:1; -700 clears 4.92) and the other five would have looked
   arbitrarily inconsistent stopping earlier just because they could. */
export const POS_SOLID = {
  QB: '#C2410C',   // orange-700, white 5.18
  RB: '#047857',   // emerald-700, white 5.48
  WR: '#1D4ED8',   // blue-700, white 6.70
  TE: '#A21CAF',   // fuchsia-700, white 6.32
  K: '#A16207',    // yellow-700, white 4.92
  DST: '#4338CA',  // indigo-700, white 7.90
}
