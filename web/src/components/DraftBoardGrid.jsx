import { motion } from 'framer-motion'
import { POS_CELL_BLOCK } from './draftRoomPositions.js'

// Real data only: `picks` is window.JukeEngine.picks() (state.picks itself,
// {overall, round, slot, player}), the same array the legacy board reads
// via `state.picks.find(p => p.round === r && p.slot === s)` — this just
// indexes it once into a map instead of re-scanning it per cell.
//
// Not memoized on `picks` itself: state.picks is mutated in place
// (Array.push in makePick()), so the array reference never changes and a
// useMemo keyed on it would freeze this map at whatever it was on first
// mount — every filled cell after that would silently render as empty.
// Rebuilding on every render is the same "render() redraws everything, no
// partial updates" trade this codebase already makes deliberately (see
// CLAUDE.md's Conventions section), and it costs nothing at ~280 entries.
// Positive = fell past ADP = a bargain (green); negative = taken early =
// a reach (red). Same "pick number minus rank" convention the real grade
// calculation uses for its own draft-value component (see CLAUDE.md's
// "The draft value gap is pick number minus board rank, in that order" —
// getting this backwards was a real, shipped bug there), just measured
// against the player's raw adp instead of the board's integer rank, which
// is what gives this its one decimal place rather than a whole number.
function adpGap(pick) {
  const adp = pick.player.adp
  if (typeof adp !== 'number' || !Number.isFinite(adp)) return null
  return pick.overall - adp
}

// Snake direction, per cell — every cell carries it, not just drafted
// ones (CLAUDE.md: "it was on drafted ones only" was itself a shipped
// bug — the turn matters most *before* a pick lands). Built only from
// DraftEngine.pickInRound(), the one place the snake mirror is allowed
// to live, never re-derived here.
function boardArrow(DE, round, slot, teams) {
  if (!DE) return null
  return DE.pickInRound(round, slot, teams) === teams ? 'down' : (round % 2 === 0 ? 'left' : 'right')
}

/* One glyph, rotated - never three different characters. The down arrow is a
   vertical stem and the right arrow is a thin cross-stroke, so a face draws
   the first far heavier than the second: measured in the board's own font
   (Inter 600), down carries 2.5x the ink of right - 305 pixels against 122.
   Nothing in CSS repairs that, because it is the glyph and not the styling.
   A rotated right arrow is the same glyph at the same weight by construction,
   so all three directions match whatever face the board ends up in.

   aria-hidden because the direction is decoration here: the pick code and the
   overall number in the same cell already say where the pick sits. */
const ARROW_SPIN = { right: 'rotate(0deg)', down: 'rotate(90deg)', left: 'rotate(180deg)' }

/* The box has to be square, and that is the whole trick. A span wrapping the
   glyph is glyph-advance wide (7.8px) but line-height tall (13.5px), so
   rotating it 90 degrees about its centre produces a visual box of 13.5 x 7.8
   that spills outside the layout box the `right-1 top-0.5` anchor is
   positioning. Measured: the down arrow drew 2.9px further right and 2.9px
   lower than its neighbours - which reads as a wonky arrow long before
   anybody works out it is an alignment problem rather than a weight one.

   A square box with leading-none and the glyph centred inside it rotates
   symmetrically, so all three directions occupy the identical rectangle. */
function Arrow({ dir, className }) {
  if (!dir) return null
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1em',
        height: '1em',
        lineHeight: 1,
        transform: ARROW_SPIN[dir],
      }}
    >
      →
    </span>
  )
}

// Gold is identity — CLAUDE.md's "Whose it is, and where the draft is":
// a ring on the board is always a pair (fill + keyline), always an inset
// box-shadow (never border/outline, which eats into border-box padding),
// and it marks the *whole* column, filled and empty alike, because "when
// do I pick again" is the question an empty cell has to answer too.
/* Two pixels of gold and no keyline, which departs from the legacy board's
   documented pair - and the reason is that this board's surfaces are not that
   board's surfaces. Measured against every ground a ring actually lands on
   here (the five translucent position blocks composited over #0B0E14, plus an
   empty cell), gold runs 11.25:1 at worst against a 3:1 bar, while the
   #0B1017 keyline measures 1.01 to 1.12. It is invisible, and it was a third
   of the ring's thickness spent on nothing.

   The keyline earns its place on the legacy board because that one is
   theme-aware, and a light-theme empty cell is near-white where gold falls to
   1.26. This board is hardcoded dark - bg-[#0B0E14], no theme variants - so
   that case does not arise. Give this board a light theme and the pair has to
   come back: measure before assuming it still does not. */
function mineRing(isMine, isCurrent) {
  if (!isMine) return ''
  return isCurrent
    ? 'shadow-[0_0_15px_rgba(0,229,255,0.4),inset_0_0_0_2px_#FFD166]'
    : 'shadow-[inset_0_0_0_2px_#FFD166]'
}

export default function DraftBoardGrid({ league, picks, mySlot, onClock, teamLabelOf, onTeamClick }) {
  const byCell = new Map()
  picks.forEach((p) => byCell.set(p.round + '-' + p.slot, p))

  const DE = typeof window !== 'undefined' ? window.DraftEngine : null
  const teams = league.teams
  const rounds = league.rounds
  /* Two different column rules, because the board now has two different
     jobs. Below lg it is a scrollable grid inside a phone: every column
     keeps a real 112px floor and the whole thing is wider than the
     viewport on purpose. At lg+ the board owns the full window width —
     that is the entire reason the desktop layout became a horizontal
     split — so columns share it evenly and all ten teams fit without
     scrolling sideways. A 0 floor is what lets them: minmax(112px, 1fr)
     still refuses to shrink past 112 each, which is 1184px of columns
     before the round rail, and that overflowed a 1569px content box once
     the cells' own content pushed them wider. */
  const cols = `64px repeat(${teams}, minmax(112px, 1fr))`
  const colsWide = `56px repeat(${teams}, minmax(0, 1fr))`

  return (
    // w-full h-full, not a flex-basis of its own: DraftRoom.jsx now wraps
    // this in a div that carries the mobileView show/hide and, at lg+, the
    // real lg:flex-[7] against the queue's lg:flex-[3] — this just fills
    // whatever that wrapper gives it, on both sides of the breakpoint,
    // rather than trying to size itself against the row a second time.
    // overflow-x-auto/overflow-y-auto: the grid itself is min-w-max (every
    // column at its real width, never squashed), so on a phone it's always
    // wider than the viewport — this box is what scrolls, both directions,
    // with touch.
    <div className="min-h-[240px] h-full w-full flex-1 overflow-x-auto overflow-y-auto border-b border-slate-800 bg-[#0B0E14] lg:border-b-0 lg:border-r">
      {/* auto-rows is a floor (minmax), not a fixed size — every row in
          this grid is implicit (no grid-template-rows), so this is the one
          place that states a row's minimum height rather than leaving each
          cell's own min-h to coincidentally agree with its neighbors. See
          CLAUDE.md's board-card note: "the row owns the height, not the
          cell." */}
      {/* pb-28 below lg: PlayerHub's sheet is fixed over the bottom edge
          there and would otherwise cover the last couple of rounds when
          scrolled all the way down. lg:pb-0 because at lg+ every panel is
          in normal flow and nothing floats over this. */}
      {/* The two column rules reach CSS as custom properties so the
          breakpoint can pick between them — a `style` prop cannot carry a
          media query, and this is one grid with two shapes rather than two
          grids. min-w-max likewise drops to min-w-0 at lg+: it is what
          forces the scroll below lg and what would prevent the fit above
          it. */}
      <div
        className="grid min-w-max auto-rows-[minmax(34px,auto)] pb-28 [grid-template-columns:var(--cols)] lg:min-w-0 lg:pb-0 lg:[grid-template-columns:var(--cols-wide)]"
        style={{ '--cols': cols, '--cols-wide': colsWide }}
      >
        {/* header row */}
        <div className="sticky left-0 top-0 z-20 flex items-center justify-center border-b border-r border-slate-800 bg-slate-900/95 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/30">
          Rd
        </div>
        {/* A real <button> only while there's somewhere for the click to
            go — DraftRoom passes onTeamClick once the draft is over, when
            every team has a full Insights report to open. Before that the
            header is the same inert label it always was, per the
            dead-control rule: nothing may look pressable and do nothing. */}
        {Array.from({ length: teams }, (_, s) =>
          onTeamClick ? (
            <button
              key={'hd-' + s}
              type="button"
              onClick={() => onTeamClick(s)}
              className={
                'sticky top-0 z-10 truncate border-b border-r border-slate-800 bg-slate-900/95 px-2 py-1 text-center text-xs font-semibold ' +
                'transition-colors duration-150 hover:bg-teal-500/10 hover:text-teal-300 ' +
                (s === mySlot ? 'text-teal-400' : 'text-white/60')
              }
              title={'View ' + teamLabelOf(s) + "'s draft insights"}
            >
              {s === mySlot ? 'YOU' : teamLabelOf(s)}
            </button>
          ) : (
            <div
              key={'hd-' + s}
              className={
                'sticky top-0 z-10 truncate border-b border-r border-slate-800 bg-slate-900/95 px-2 py-1 text-center text-xs font-semibold ' +
                (s === mySlot ? 'text-teal-400' : 'text-white/60')
              }
              title={teamLabelOf(s)}
            >
              {s === mySlot ? 'YOU' : teamLabelOf(s)}
            </div>
          )
        )}

        {Array.from({ length: rounds }, (_, ri) => {
          const round = ri + 1
          return (
            <div key={'row-' + round} className="contents">
              <div className="sticky left-0 z-10 flex items-center justify-center border-b border-r border-slate-800 bg-slate-900/95 text-xs font-semibold text-white/30">
                {round}
              </div>
              {Array.from({ length: teams }, (_, s) => {
                const pick = byCell.get(round + '-' + s)
                const isCurrent = !!onClock && onClock.round === round && onClock.slot === s
                const isMine = s === mySlot
                const gap = pick ? adpGap(pick) : null
                const overall = DE ? DE.overallOf(round, s, teams) : null
                // The label for a pick that has landed. Always via
                // DraftEngine.pickCode() — the snake mirror lives there and
                // nowhere else (CLAUDE.md: a pick number is not a seat
                // number, and half the board agrees with the wrong answer).
                const code = pick && DE ? DE.pickCode(pick.overall, teams) : null
                const arrow = boardArrow(DE, round, s, teams)
                return (
                  <div
                    key={round + '-' + s}
                    className={'border-b border-r border-slate-800/70 p-0.5 ' + mineRing(isMine, isCurrent)}
                  >
                    {pick ? (
                      // layoutId matches the same player's row in
                      // PlayerQueueSidebar.jsx — while both are mounted
                      // (the instant a real pick lands: the sidebar row
                      // exiting, this cell appearing), Framer Motion
                      // computes the shared FLIP transition between them
                      // on its own, so the card visibly moves from the
                      // queue into its cell rather than just popping in.
                      //
                      // Two lines, not four, still — that hasn't changed.
                      // What's gone is the small pill-shaped position badge:
                      // the cell itself is now a full colour block per
                      // POS_CELL_BLOCK (a saturated bg/border/text triple,
                      // not the old translucent tint), so position reads
                      // from the whole card rather than a chip inside it.
                      // The position letters stay as plain text — dropping
                      // the badge doesn't mean dropping the ability to read
                      // WR vs RB at a glance for anyone not distinguishing
                      // by colour alone.
                      <motion.div
                        layoutId={'player-' + (pick.player.id || pick.player.name)}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className={
                          /* `relative` is what the snake arrow below is
                             positioned against — without it the arrow
                             would hunt for the nearest positioned
                             ancestor and land somewhere else entirely. */
                          'relative flex h-full flex-col justify-center gap-0.5 rounded-md px-1 py-1 backdrop-blur-sm ' +
                          (POS_CELL_BLOCK[pick.player.pos] || 'border border-white/10 bg-white/[0.04] text-white/90')
                        }
                      >
                        {/* In the flow, not absolutely positioned. A filled
                            cell already puts the team abbreviation in the
                            top-right corner, so an `absolute right-1 top-0.5`
                            arrow drew straight on top of it - measured at 9x7
                            pixels of overlap on a 7.7px glyph, which is total.
                            36 cells on a part-drafted board were rendering two
                            characters in one place, and it reads as a smudged
                            arrow rather than as a collision. Empty and
                            on-the-clock cells have no team label and keep the
                            absolute placement. */}
                        <div className="flex items-center justify-between gap-1 leading-none">
                          <span className="flex items-center gap-1 text-[10px] font-bold">
                            {pick.player.pos}
                            {code && <span className="font-normal opacity-60">{code}</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium opacity-60">
                            {pick.player.team}
                            <Arrow dir={arrow} className="text-[9px]" />
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 leading-none">
                          <p className="min-w-0 truncate text-xs font-semibold">{pick.player.name}</p>
                          {gap != null && (
                            <span className={'shrink-0 text-[10px] font-semibold ' + (gap >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                              {gap >= 0 ? '+' : ''}
                              {gap.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ) : isCurrent ? (
                      <motion.div
                        animate={{ opacity: [1, 0.75, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative flex h-full min-h-[46px] items-center justify-center rounded-md border-2 border-teal-400 bg-teal-500/10 text-[10px] font-bold uppercase tracking-wide text-teal-300 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                      >
                        {overall != null && (
                          <span className="absolute left-1 top-0.5 text-[10px] font-normal normal-case text-teal-300/60">{overall}</span>
                        )}
                        On the clock
                        <Arrow dir={arrow} className="absolute right-1 top-0.5 text-[9px] font-normal normal-case text-teal-300/60" />
                      </motion.div>
                    ) : (
                      <div className="relative h-full min-h-[46px] rounded-md border border-dashed border-slate-800">
                        {overall != null && (
                          <span className="absolute left-1 top-0.5 text-[10px] text-slate-500">{overall}</span>
                        )}
                        <Arrow dir={arrow} className="absolute right-1 top-0.5 text-[9px] text-white/20" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
