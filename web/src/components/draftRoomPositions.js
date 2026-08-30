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
//                  next to it on the wheel
//   DST indigo   — deep and moody rather than left as "no colour"
//
// Those six identities are unchanged by the matte pass below. What the
// pass changed is that all three renderings of a position — the chip
// (POS_BADGE), the flat fill (POS_MATTE) and the white-type ground
// (POS_SOLID) — are now one hue at three lightnesses, where they used to
// be a Tailwind stock scale and two separate hand-picked hex maps that
// only looked like the same colour because they were never side by side.
//
// This is the one hue reference for the whole site — POS_BADGE is imported
// directly by ShowYourWorking.jsx's homepage scoring demo as well as the
// queue, the profile drawer, the roster dock and the log dock, and
// POS_MATTE is the board's cell fill. All of them read the six hues below,
// so a position can no longer read as a different colour depending which
// panel — or which page — you're looking at.
//
// Written out as full literal class strings in POS_BADGE rather than built
// from a name -> hue map with template interpolation: Tailwind's JIT
// scanner finds classes by grepping source files for the literal string,
// and `` `bg-pos-${key}/15` `` never appears as one — it would compile to
// nothing, silently, and every chip would render with no colour at all.
// The table above is documentation only, not code these read from.

// Small translucent chip — the queue's position tag, the profile drawer's
// header badge, a roster-dock slot, a log-dock row. Same 15%-bg/text
// formula this always used; what changed is what the two halves point at.
//
// They used to name Tailwind's own stock scales (orange-500/orange-300,
// emerald-500/emerald-300, ...) while POS_SOLID below carried hand-picked
// hexes. That is one position wearing two colours that merely looked
// related — the exact drift this file's own header already forbids,
// reached from the direction nobody was checking, because a tint and a
// solid are never side by side for long enough to compare. Both halves
// now name `pos-*` (tailwind.config.js), which is the identical hex the
// matte fill below uses, so a chip is literally a faded version of the
// cell rather than a different colour of roughly the same family.
export const POS_BADGE = {
  QB: 'bg-pos-qb/15 text-pos-qb',
  RB: 'bg-pos-rb/15 text-pos-rb',
  WR: 'bg-pos-wr/15 text-pos-wr',
  TE: 'bg-pos-te/15 text-pos-te',
  K: 'bg-pos-k/15 text-pos-k',
  DST: 'bg-pos-dst/15 text-pos-dst',
}

/* The matte fills — the flat, unmixed colour a board cell is painted with,
   and the palette the whole site now reads a position off.

   This replaces a 14%-alpha wash of POS_SOLID over the panel ground.
   The wash was a compromise that existed because the fill underneath it
   had to carry white text: a colour dark enough for white type is far too
   dark to fill 140 cells with, so it was diluted until it stopped
   competing, and what a reader actually saw was six barely-separated
   tints of the page's own charcoal. Sleeper's board does the opposite and
   is the reason this changed — it fills each cell with a real, saturated
   matte colour and writes on it in near-black, so position is legible
   across a whole column at a glance instead of on inspection.

   That inversion is the whole design, and it is the one rule these
   colours carry: A MATTE FILL TAKES DARK INK, NEVER WHITE. POS_MATTE_INK
   is that ink and is the only value allowed on top of one. Every matte
   value clears it by at least 8.4:1 (measured: QB 9.15, RB 12.39,
   WR 9.02, TE 9.32, K 12.80, DST 8.46), which is well past the 4.5 bar
   for the 9.5-11px type a board cell actually carries.

   Hue assignment is unchanged. QB is still orange, RB emerald, WR blue,
   TE fuchsia, K gold, DST indigo — the same six identities this file has
   documented since the board went colour-coded, and the same ones every
   returning user already reads. Only the value moved: each hue is held
   and re-rendered at pastel lightness, the same lightness-only move the
   position solids and the team accents were both repaired with. The
   closest pair is WR/DST at 19.9 CIE76, against a just-noticeable
   threshold near 2.3 and the 12 this project already uses as its bar for
   the thirty-two club accents.

   Written as hex here and as Tailwind tokens in tailwind.config.js
   because both are genuinely needed and neither can do the other's job: a
   cell fill is computed per player (`POS_MATTE[p.pos]`) and can only
   reach CSS as an inline style, while a badge is a static class pair the
   JIT scanner has to find as a literal. The two lists are the same six
   values and have to stay that way. */
export const POS_MATTE = {
  QB: '#F0A189',
  RB: '#8EE1C8',
  WR: '#8AB6EF',
  TE: '#E89CE8',
  K: '#F1D274',
  DST: '#B2A4EA',
}

// The only ink a POS_MATTE fill may carry. One value rather than one per
// position, deliberately: six inks would be six more things to keep in
// contrast, and a single near-black already clears every fill above with
// room to spare.
export const POS_MATTE_INK = '#0E1116'

// A softer companion to POS_MATTE, for the large surfaces a full matte
// fill would shout on — a roster row, a wide progress bar, an empty slot
// that wants to say which position it is waiting for without reading as
// filled. Same hex, applied as alpha, so nothing here is a seventh value
// to keep in step.
export function posTint(pos, alpha) {
  const hex = POS_MATTE[pos]
  if (!hex) return undefined
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
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

/* POS_CELL_BLOCK — a full-strength position fill for a board cell — has now
   been proposed four times, rejected three, and shipped once, and the
   record is worth keeping straight because each round overturned the one
   before it and every one of them was reached by looking rather than
   arguing.

   1. A neutral cell with a 3px rail. Prettier, calmer — and at working
      zoom the rails were nearly invisible. Rejected: scanning a column for
      a position run is what a draft board is for.
   2. The same rail, bolder, on a real 140-pick board. Closer, still lost
      to a fill at a glance. Rejected again.
   3. A full-strength fill drawn from POS_SOLID. Shipped, then pulled by a
      Cockpit-wide design review that read it as "a saturated quilt
      fighting the ADP-delta tint on every card" — which it was, because
      the value tint was a second full-cell wash at the time. The rail came
      back, and this file's own comment argued at length that three
      independent lookers agreeing on the rail settled it.

   4. POS_MATTE, above, which is the fill again and is what ships today.
      What makes it different from (3) rather than a fourth swing of the
      same pendulum is that the two reasons (3) failed are both gone. The
      ADP delta is a small coloured number now, not a competing wash, so
      there is nothing left for a fill to fight. And the fill itself is a
      different kind of colour: (3) filled with POS_SOLID, a value chosen
      to carry WHITE text and therefore dark, saturated and heavy across
      140 cells. A matte pastel with dark ink is the opposite weight — it
      is the treatment Sleeper's board uses and the direct instruction this
      pass came from.

   The lesson to carry rather than the verdict: a cell affordance can only
   be judged against everything else already in the cell. Three of the four
   rounds above were really about what the fill was competing WITH, not
   about the fill. Rebuild from POS_MATTE/POS_SOLID directly if it ever
   swings back — there is no separate POS_CELL_BLOCK export and there
   should not be one, since a dead export a future reroute could
   "helpfully" wire back in is a fifth look nobody asked for. */

/* The deep end of the same six hues — the value to use wherever white type
   sits ON the colour, which is the one thing a matte fill can never do.

   Roster chips in the board header are the case that defines it: white on
   a position colour is the contract those chips were built to, so the
   header behind a chip is never part of the sum. Bars, dots and legend
   swatches read off this too, since a 7px dot at pastel lightness on a
   dark panel is a smudge rather than a colour.

   Each one is its POS_MATTE hue darkened by lightness alone — hue and
   saturation held, the same repair the legacy position solids and the
   thirty-two team accents both had — down to the first step where white
   clears 4.6:1 (measured: QB 4.61, RB 4.66, WR 4.67, TE 4.62, K 4.68,
   DST 5.03). Stopping at a uniform ratio rather than a uniform Tailwind
   step is what keeps the set from looking arbitrarily inconsistent: gold
   is the hard case and has to go much darker than blue does to carry the
   same white.

   These are NOT the old Tailwind-700 values. Those were a different hue
   family from the tints beside them; these are the identical hues as
   POS_MATTE, one lightness apart, which is what makes a chip and a cell
   read as the same position rather than two neighbours. */
export const POS_SOLID = {
  QB: '#D1451A',
  RB: '#238366',
  WR: '#1E71DE',
  TE: '#C42EC4',
  K: '#906F0E',
  DST: '#735AD8',
}

// Sleeper's injury_status, already computed into player.inj by
// injury_code() in build_players.py — RULED_OUT/RISKY in app.js group
// these into two severities for the bust-risk score; this groups them into
// three for a chip, since a badge has room to say more than "risky or not."
// None of the three hues below is a POS_BADGE hue: amber and violet aren't
// spoken for at all, and rose is already the app's one reserved danger
// colour (CLAUDE.md: "red/rose already mean danger/urgent elsewhere"),
// which is exactly the meaning IR/O/D carry here rather than a collision
// with it.
// `dot` is a full, separate literal per code rather than `cls`'s bg-*/15
// swapped for a solid bg-* at read time — this file's own header comment
// already names that exact trap: a class built from a runtime string never
// appears as a complete token for Tailwind's JIT scanner to find, and
// compiles to nothing, silently. Written out twice on purpose.
//
// `onMatte` is a third rendering, and it exists because `dot` cannot do its
// job on a POS_MATTE cell. Both `cls` and `dot` are light values chosen for
// a dark panel; a POS_MATTE fill is a light surface, so amber-400 on the
// gold K fill is very nearly invisible and rose-400 on the QB orange is not
// much better. These are the same three severities solved downward against
// the LIGHTEST fill in the set rather than an average — measured worst
// cases 3.04 (amber), 3.08 (rose), 4.20 (violet), 3.01 (grey), all clearing
// the 3:1 bar 1.4.11 sets for a non-text mark. Hex rather than a class for
// the same reason POS_MATTE is: it is applied as an inline style beside a
// per-player background colour that is itself a hex.
export const INJURY_META = {
  Q: { label: 'Questionable', cls: 'bg-amber-500/15 text-amber-300', dot: 'bg-amber-400', onMatte: '#7F5103' },
  D: { label: 'Doubtful', cls: 'bg-rose-500/15 text-rose-300', dot: 'bg-rose-400', onMatte: '#AF1D30' },
  O: { label: 'Out', cls: 'bg-rose-500/15 text-rose-300', dot: 'bg-rose-400', onMatte: '#AF1D30' },
  IR: { label: 'Injured reserve', cls: 'bg-rose-500/15 text-rose-300', dot: 'bg-rose-400', onMatte: '#AF1D30' },
  PUP: { label: 'Physically unable to perform', cls: 'bg-violet-500/15 text-violet-300', dot: 'bg-violet-400', onMatte: '#5629A3' },
  NFI: { label: 'Non-football injury', cls: 'bg-violet-500/15 text-violet-300', dot: 'bg-violet-400', onMatte: '#5629A3' },
  SUS: { label: 'Suspended', cls: 'bg-white/10 text-white/50', dot: 'bg-white/50', onMatte: '#575C66' },
  DNR: { label: 'Did not report', cls: 'bg-white/10 text-white/50', dot: 'bg-white/50', onMatte: '#575C66' },
  COV: { label: 'Reserve/COVID-19', cls: 'bg-white/10 text-white/50', dot: 'bg-white/50', onMatte: '#575C66' },
}

