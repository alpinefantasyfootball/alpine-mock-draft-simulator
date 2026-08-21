import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, X } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'
import { useEngine } from '../hooks/useJukeEngine.js'
import OurReadTab from './OurReadTab.jsx'
import ProjectionsTab from './ProjectionsTab.jsx'
import GameLogsTab from './GameLogsTab.jsx'
import LatestNewsTab from './LatestNewsTab.jsx'
import DepthChartTab from './DepthChartTab.jsx'
import DraftFitTab from './DraftFitTab.jsx'

// Our Read leads: it is the one thing here a projection feed cannot show
// you about its own numbers, and CLAUDE.md's own note on this is that the
// explanation used to be reachable only as a title tooltip — "not at all
// on a phone, and never on the sheet somebody opens because they are
// confused." First tab, not a tooltip.
// Draft Fit sits second, directly after the model's own read. Our Read says
// what we think of the player; Draft Fit says what he is worth *to this
// roster at this pick*, which is the question somebody mid-draft actually
// opened the sheet to answer. It is hidden outright before a draft is
// running rather than shown empty — a tab that opens onto "not applicable"
// is a dead control, and this project has shipped one of those before.
const BASE_TABS = ['Our Read', 'Projections', 'Game Logs', 'Latest News', 'Depth Chart']

// Slides in over the Player Queue only — DraftRoom.jsx wraps this and
// PlayerQueueSidebar in one `relative` box, so `absolute inset-0` here
// covers exactly the queue's own footprint and nothing else on the page,
// per "covering the Player Queue" rather than the whole screen.
export default function PlayerProfileDrawer({ player, onClose, photoFor, initialsFor }) {
  const engine = useEngine()
  const [tab, setTab] = useState('Our Read')

  // Recomputed on every render rather than memoized: draftFit() is a
  // question about the board *right now*, and state.picks is mutated in
  // place (see DraftBoardGrid's own note on why nothing here may be keyed
  // on that array's identity), so a memo would freeze it at mount.
  const fit = engine && player ? engine.draftFit(player) : null
  const TABS = fit ? [BASE_TABS[0], 'Draft Fit', ...BASE_TABS.slice(1)] : BASE_TABS

  // A tab can disappear underneath the reader — the draft ends, or they open
  // a sheet before starting one — so a selection that no longer exists falls
  // back rather than rendering nothing at all.
  useEffect(() => {
    if (!TABS.includes(tab)) setTab(TABS[0])
  }, [TABS.join('|'), tab])

  // Reset to the first tab on every new player, so opening someone else's
  // drawer never lands on the tab the last player happened to be left on.
  useEffect(() => {
    if (player) setTab('Our Read')
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
          /* Opaque, not frosted. This was bg-[#0B0E14]/95 with a
             backdrop-blur, and what sits behind it is the stat table - a
             dense grid of small, high-contrast type. Five per cent of that
             is legible, and it landed across the Juke score: "PROJECTED",
             "PASSING", "RUSHING" and a row of column heads reading straight
             through the one number this panel exists to explain.

             The blur was not saving it either. Computed style said
             blur(24px) and the bleed rendered sharp, so the backdrop-filter
             was not compositing - which makes it exactly the kind of effect
             that looks fine until it silently is not there. An opaque
             surface cannot fail that way, and this project already has the
             rule: translucency over a busy ground is a false economy. */
          className="absolute inset-0 z-20 flex flex-col border-l border-slate-800 bg-[#0B0E14]"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 lg:h-16 lg:w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-[10px] lg:text-sm font-bold text-white/40">
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

          {/* Scrolls sideways rather than squeezing: five tabs at flex-1
              in a ~300px drawer would break "Depth Chart" and "Latest
              News" mid-word. whitespace-nowrap + shrink-0 keeps each label
              whole and lets the strip pan, the same treatment the draft
              room's own tab row already uses at narrow widths. */}
          <div className="flex shrink-0 overflow-x-auto border-b border-slate-800">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-center text-[11px] font-semibold transition-colors duration-150 ' +
                  (tab === t ? 'border-teal-400 text-teal-300' : 'border-transparent text-white/40 hover:text-white/60')
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!engine ? null : tab === 'Our Read' ? (
              <OurReadTab engine={engine} player={player} />
            ) : tab === 'Draft Fit' ? (
              <DraftFitTab fit={fit} player={player} />
            ) : tab === 'Projections' ? (
              <ProjectionsTab
                summary={engine.projectionSummary(player)}
                record={engine.projectionRecord(player)}
              />
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
