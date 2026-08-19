import { AnimatePresence, motion } from 'framer-motion'
import { Search, Star } from 'lucide-react'
import { POS_BADGE, POS_LIST } from './draftRoomPositions.js'

function formatAdp(adp) {
  return typeof adp === 'number' && Number.isFinite(adp) ? adp.toFixed(1) : null
}

const FILTERS = ['ALL', ...POS_LIST]

// Real, undrafted board players only — this is `board()` filtered/sorted at
// the UI layer, not a second suggestions engine. Ranking (ADP, need, risk,
// the model's opinion) stays exactly where CLAUDE.md says it has to live:
// suggestions() in app.js. The list here is ordered by the board's own
// `overall` (ADP rank), same as the legacy Players tab.
export default function PlayerQueueSidebar({
  players,
  search,
  onSearch,
  posFilter,
  onPosFilter,
  pointsFor,
  valueFor,
  onDraft,
  myTurn,
  queuedNames,
  onToggleQueue,
}) {
  return (
    <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden bg-slate-900/40 lg:flex-[3] lg:min-w-[280px]">
      <div className="shrink-0 space-y-3 border-b border-slate-800 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-teal-400/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => onPosFilter(pos)}
              className={
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ' +
                (posFilter === pos
                  ? 'bg-teal-500 text-obsidian'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white')
              }
            >
              {pos === 'ALL' ? 'All' : pos}
            </button>
          ))}
        </div>

        {!myTurn && (
          <p className="text-[10px] leading-relaxed text-white/30">
            Draft is disabled until it's your turn.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-64">
        <AnimatePresence initial={false}>
          {players.map((player) => {
            const pts = pointsFor(player)
            const adp = formatAdp(player.adp)
            const value = valueFor(player)
            const queued = queuedNames.has(player.name)
            return (
              <motion.div
                key={player.id || player.name}
                layoutId={'player-' + (player.id || player.name)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 32, scale: 0.94, transition: { duration: 0.28 } }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="mb-2 flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => onToggleQueue(player.name)}
                  title={queued ? 'Remove from your queue' : 'Add to your queue'}
                  className="shrink-0 text-white/25 transition-colors duration-150 hover:text-amber-300"
                >
                  <Star className={'h-4 w-4 ' + (queued ? 'fill-amber-300 text-amber-300' : '')} />
                </button>

                <span
                  className={
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ' +
                    (POS_BADGE[player.pos] || 'bg-white/10 text-white/50')
                  }
                >
                  {player.pos}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/90">{player.name}</p>
                  <p className="truncate text-[11px] text-white/40">
                    {player.team} &middot; {pts != null ? pts.toFixed(1) + ' pts' : 'No projection'}
                  </p>
                  {/* Both real: adp is the board's own ADP field, and value
                      is overallScore() — points above replacement as a
                      share of the best such figure on the board, the same
                      "Juke score" used everywhere else on the site. Neither
                      is invented for this row. */}
                  <p className="mt-0.5 flex items-center gap-2 text-[10px] font-medium text-teal-400/80">
                    {adp && <span>ADP {adp}</span>}
                    {value != null && <span>Value {Math.round(value)}</span>}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onDraft(player)}
                  disabled={!myTurn}
                  title={myTurn ? undefined : "Not your turn"}
                  className={
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ' +
                    (myTurn
                      ? 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-glass hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                      : 'cursor-not-allowed bg-white/5 text-white/25')
                  }
                >
                  Draft
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {players.length === 0 && (
          <p className="mt-8 text-center text-sm text-white/30">No players match this search.</p>
        )}
      </div>
    </div>
  )
}
