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

// The board grid's full colour-block cells — saturated background, matching
// border, matching text colour, so position reads from the whole card
// rather than a badge inside it. Same six hues as POS_BADGE above, just the
// bolder bg-950/60 + border-500/40 + text-200 formula the board asked for.
//
// The Draft Room Cockpit handoff asked for this to become a left-rail accent
// instead — CLAUDE.md already had a section titled "Tried and rejected:
// position colour as a left rail" for exactly this change, built once and
// screenshotted: "at working zoom the rails are nearly invisible. Scanning
// the grid for position runs is what a draft board is for, and it stops
// working." That didn't make the handoff wrong on its own — this file
// overrode a different documented decision (orange -> teal) two days after
// writing it down — so it was re-tried rather than dismissed on a two-year-
// old memory: prototyped with an injected stylesheet on a real completed
// board (a full 140-pick draft, all six positions on screen at once) and
// screenshotted at two widths.
//
// A 3px rail on a neutral cell — the exact width the rejected attempt used —
// reproduced the original finding: the colour is technically there on close
// inspection and reads as almost uniformly dark from a normal glance. A
// deliberately bolder 6px rail, double the original, closed some of the gap
// and is genuinely scannable up close — but the full-cell fill below is
// still faster to read at a glance, because it recruits the whole cell
// rather than one edge of it, and "scan the grid for position runs" is the
// job this screen has to do fastest. So the verdict stands: fill, not rail.
// Whoever revisits this again should still look rather than trust this
// comment — but the look has now actually happened twice, not zero times.
export const POS_CELL_BLOCK = {
  QB: 'bg-orange-950/60 border border-orange-500/40 text-orange-200',
  RB: 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200',
  WR: 'bg-blue-950/60 border border-blue-500/40 text-blue-200',
  TE: 'bg-fuchsia-950/60 border border-fuchsia-500/40 text-fuchsia-200',
  K: 'bg-yellow-950/60 border border-yellow-500/40 text-yellow-200',
  DST: 'bg-indigo-950/60 border border-indigo-500/40 text-indigo-200',
}

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
