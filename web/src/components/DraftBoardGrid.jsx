import { motion } from 'framer-motion'
import { POS_BADGE, POS_CELL } from './draftRoomPositions.js'

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
export default function DraftBoardGrid({ league, picks, mySlot, onClock, teamLabelOf }) {
  const byCell = new Map()
  picks.forEach((p) => byCell.set(p.round + '-' + p.slot, p))

  const teams = league.teams
  const rounds = league.rounds
  const cols = `64px repeat(${teams}, minmax(112px, 1fr))`

  return (
    <div className="min-h-[240px] flex-1 overflow-auto border-b border-slate-800 bg-[#0B0E14] lg:flex-[7] lg:border-b-0 lg:border-r">
      <div className="grid min-w-max" style={{ gridTemplateColumns: cols }}>
        {/* header row */}
        <div className="sticky left-0 top-0 z-20 flex items-center justify-center border-b border-r border-slate-800 bg-slate-900/95 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/30">
          Rd
        </div>
        {Array.from({ length: teams }, (_, s) => (
          <div
            key={'hd-' + s}
            className={
              'sticky top-0 z-10 truncate border-b border-r border-slate-800 bg-slate-900/95 px-2 py-2 text-center text-xs font-semibold ' +
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
                return (
                  <div key={round + '-' + s} className="border-b border-r border-slate-800/70 p-1">
                    {pick ? (
                      // layoutId matches the same player's row in
                      // PlayerQueueSidebar.jsx — while both are mounted
                      // (the instant a real pick lands: the sidebar row
                      // exiting, this cell appearing), Framer Motion
                      // computes the shared FLIP transition between them
                      // on its own, so the card visibly moves from the
                      // queue into its cell rather than just popping in.
                      <motion.div
                        layoutId={'player-' + (pick.player.id || pick.player.name)}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className={
                          'flex h-full flex-col justify-center rounded-md border p-1.5 backdrop-blur-sm ' +
                          (POS_CELL[pick.player.pos] || 'border-white/10 bg-white/[0.04]')
                        }
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={
                              'rounded px-1 text-[9px] font-bold ' +
                              (POS_BADGE[pick.player.pos] || 'bg-white/10 text-white/50')
                            }
                          >
                            {pick.player.pos}
                          </span>
                          <span className="text-[9px] font-medium text-white/35">{pick.player.team}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-white/90">{pick.player.name}</p>
                      </motion.div>
                    ) : isCurrent ? (
                      <motion.div
                        animate={{ opacity: [1, 0.75, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="flex h-full min-h-[46px] items-center justify-center rounded-md border-2 border-teal-400 bg-teal-500/10 text-[10px] font-bold uppercase tracking-wide text-teal-300 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                      >
                        On the clock
                      </motion.div>
                    ) : (
                      <div className="h-full min-h-[46px] rounded-md border border-dashed border-slate-800" />
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
