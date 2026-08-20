import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, X } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'
import { useEngine } from '../hooks/useJukeEngine.js'
import ProjectionsTab from './ProjectionsTab.jsx'
import GameLogsTab from './GameLogsTab.jsx'
import LatestNewsTab from './LatestNewsTab.jsx'
import DepthChartTab from './DepthChartTab.jsx'

const TABS = ['Projections', 'Game Logs', 'Latest News', 'Depth Chart']

// Slides in over the Player Queue only — DraftRoom.jsx wraps this and
// PlayerQueueSidebar in one `relative` box, so `absolute inset-0` here
// covers exactly the queue's own footprint and nothing else on the page,
// per "covering the Player Queue" rather than the whole screen.
export default function PlayerProfileDrawer({ player, onClose, photoFor, initialsFor }) {
  const engine = useEngine()
  const [tab, setTab] = useState('Projections')

  // Reset to the first tab on every new player, so opening someone else's
  // drawer never lands on the tab the last player happened to be left on.
  useEffect(() => {
    if (player) setTab('Projections')
  }, [player?.id || player?.name])

  useEffect(() => {
    if (!player) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player, onClose])

  return (
    <AnimatePresence>
      {player && (
        <motion.div
          key={player.id || player.name}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          className="absolute inset-0 z-20 flex flex-col border-l border-slate-800 bg-[#0B0E14]/95 backdrop-blur-xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-[10px] font-bold text-white/40">
                {initialsFor(player)}
                {photoFor(player) && (
                  <img
                    src={photoFor(player)}
                    alt=""
                    loading="lazy"
                    onError={(e) => e.currentTarget.remove()}
                    className={'absolute inset-0 h-full w-full ' + (player.pos === 'DST' ? 'object-contain p-1.5' : 'object-cover')}
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-base font-bold text-white">{player.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-white/40">
                  <span className={'rounded px-1.5 py-0.5 text-[10px] font-bold ' + (POS_BADGE[player.pos] || 'bg-white/10 text-white/50')}>
                    {player.pos}
                  </span>
                  {player.team}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Watchlisting lives here rather than as a row icon in the
                  list — that row is already tight (see PlayerQueueSidebar's
                  own width-budget notes), and this is the screen someone
                  opens specifically to decide whether to track a player. */}
              {engine && (
                <button
                  type="button"
                  onClick={() => engine.watchlistToggle(player.name)}
                  title={engine.watchlisted(player) ? 'Remove from watchlist' : 'Add to watchlist'}
                  aria-label={engine.watchlisted(player) ? 'Remove from watchlist' : 'Add to watchlist'}
                  className={
                    'flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-150 ' +
                    (engine.watchlisted(player)
                      ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                      : 'border-slate-800 bg-slate-950/60 text-white/60 hover:border-slate-700 hover:text-white')
                  }
                >
                  <Bookmark className={'h-4 w-4 ' + (engine.watchlisted(player) ? 'fill-amber-300' : '')} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close player profile"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950/60 text-white/60 transition-colors duration-150 hover:border-slate-700 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex shrink-0 border-b border-slate-800">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  'flex-1 border-b-2 px-2 py-2.5 text-center text-[11px] font-semibold transition-colors duration-150 ' +
                  (tab === t ? 'border-teal-400 text-teal-300' : 'border-transparent text-white/40 hover:text-white/60')
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!engine ? null : tab === 'Projections' ? (
              <ProjectionsTab summary={engine.projectionSummary(player)} />
            ) : tab === 'Game Logs' ? (
              <GameLogsTab engine={engine} player={player} />
            ) : tab === 'Latest News' ? (
              <LatestNewsTab engine={engine} player={player} />
            ) : (
              <DepthChartTab engine={engine} player={player} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
