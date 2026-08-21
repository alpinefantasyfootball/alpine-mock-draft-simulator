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
   position solid is the contract those colours were darkened to meet (4.61 to
   4.62 measured), so the header behind a chip is never part of the sum.

   Colouring the text instead was measured first and does not survive — the
   light-theme --*-fg tones run 4.85 to 5.69 on the header but 2.15 to 2.52 on
   the navy of your own column, so the one team a manager looks at most would
   be the one that failed.

   Hexes taken from style.css's --qb/--rb/--wr/--te rather than re-picked, so
   the two boards cannot drift apart on a colour that has already been
   contrast-checked. */
export const POS_SOLID = {
  QB: '#D43E39',
  RB: '#2A7BB1',
  WR: '#208553',
  TE: '#AA6419',
}
