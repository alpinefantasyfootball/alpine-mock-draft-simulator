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

export default function DraftBoardGrid({ league, picks, mySlot, onClock, teamLabelOf }) {
  const byCell = new Map()
  picks.forEach((p) => byCell.set(p.round + '-' + p.slot, p))

  const DE = typeof window !== 'undefined' ? window.DraftEngine : null
  const teams = league.teams
  const rounds = league.rounds
  const cols = `64px repeat(${teams}, minmax(112px, 1fr))`

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
      {/* pb-28 below lg: RosterDock is a fixed bottom sheet there now (see
          its own comment), which would otherwise cover the last couple of
          rounds when scrolled all the way down. lg:pb-0 because RosterDock
          is back in normal flow at lg+ and there's nothing floating over
          this to clear. */}
      <div className="grid min-w-max auto-rows-[minmax(34px,auto)] pb-28 lg:pb-0" style={{ gridTemplateColumns: cols }}>
        {/* header row */}
        <div className="sticky left-0 top-0 z-20 flex items-center justify-center border-b border-r border-slate-800 bg-slate-900/95 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/30">
          Rd
        </div>
        {Array.from({ length: teams }, (_, s) => (
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
        ))}

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
                const gap = pick ? adpGap(pick) : null
                const code = pick && DE ? DE.pickCode(pick.overall, teams) : null
                return (
                  <div key={round + '-' + s} className="border-b border-r border-slate-800/70 p-0.5">
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
                          'flex h-full flex-col justify-center gap-0.5 rounded-md px-1 py-1 backdrop-blur-sm ' +
                          (POS_CELL_BLOCK[pick.player.pos] || 'border border-white/10 bg-white/[0.04] text-white/90')
                        }
                      >
                        <div className="flex items-center justify-between gap-1 leading-none">
                          <span className="flex items-center gap-1 text-[10px] font-bold">
                            {pick.player.pos}
                            {code && <span className="font-normal opacity-60">{code}</span>}
                          </span>
                          <span className="text-[10px] font-medium opacity-60">{pick.player.team}</span>
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
                        className="flex h-full min-h-[32px] items-center justify-center rounded-md border-2 border-teal-400 bg-teal-500/10 text-[10px] font-bold uppercase tracking-wide text-teal-300 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                      >
                        On the clock
                      </motion.div>
                    ) : (
                      <div className="h-full min-h-[32px] rounded-md border border-dashed border-slate-800" />
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
