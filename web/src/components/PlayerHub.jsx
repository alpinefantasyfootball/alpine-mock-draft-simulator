import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import PlayerQueueSidebar from './PlayerQueueSidebar.jsx'
import PlayerProfileDrawer from './PlayerProfileDrawer.jsx'
import QueueList from './QueueList.jsx'
import TeamTab from './TeamTab.jsx'
import ChatPlaceholder from './ChatPlaceholder.jsx'

const TABS = [
  { key: 'players', label: 'Players' },
  { key: 'queue', label: 'Queue' },
  { key: 'team', label: 'Team' },
  { key: 'chat', label: 'Chat' },
]

// Replaces three separate mobile mechanisms — the Draft Hub/Full Board
// toggle, the floating Draft Log & Queue dock, and the fixed RosterDock
// sheet — with the one Sleeper actually uses: the board stays visible and
// a single bottom sheet switches between Players/Queue/Team/Chat. At lg+
// this is just the Players column exactly as it was before this pass;
// desktop already has its own separate, already-approved column for
// Queue/Log/Chat (DraftLogDock) and its own static roster bar (RosterDock),
// so those three panes are lg:hidden here — they don't exist a second time.
//
// PlayerQueueSidebar mounts exactly once, always — its rows share
// layoutIds with DraftBoardGrid's cells for the queue-to-board FLIP
// transition (see its own file comment), so a second mounted copy anywhere
// would collide with this one even if CSS-hidden. Below lg it's shown only
// while the Players tab is active; at lg+ `lg:flex` shows it unconditionally,
// the same "one mount, repositioned by breakpoint" contract DraftRoom.jsx
// already uses for the board itself.
//
// Drag-to-collapse reuses RosterDock's exact motion.div pattern — same
// component, same reasoning: the drag lives on the handle alone so it
// doesn't fight a thumb panning sideways through a horizontally-scrolling
// row underneath it (the Team tab's seat picker, here).
export default function PlayerHub({
  // PlayerQueueSidebar / PlayerProfileDrawer passthrough
  players,
  search,
  onSearch,
  posFilter,
  onPosFilter,
  expBand,
  onExpBand,
  watchlistOnly,
  onWatchlistOnly,
  showDrafted,
  onShowDrafted,
  pointsFor,
  valueFor,
  photoFor,
  initialsFor,
  onDraft,
  myTurn,
  queuedNames,
  onToggleQueue,
  draftedByFor,
  selectedPlayer,
  onSelectPlayer,
  sortBy,
  sortDir,
  onSort,
  recommended,
  recommendedVorp,
  recommendedTierLeft,
  // Queue tab
  queuePlayers,
  engine,
  // Team tab
  league,
  mySlot,
  teamLabelOf,
}) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState('players')
  const [viewSlot, setViewSlot] = useState(mySlot)

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-t-xl border-t border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md lg:static lg:z-auto lg:h-full lg:max-h-none lg:flex-1 lg:rounded-none lg:border-t-0 lg:bg-transparent lg:shadow-none"
    >
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.3}
        onDragEnd={(_, info) => {
          if (info.offset.y < -20) setOpen(true)
          else if (info.offset.y > 20) setOpen(false)
        }}
        className="flex shrink-0 cursor-grab touch-none justify-center pt-1.5 active:cursor-grabbing lg:hidden"
      >
        <span className="h-1 w-9 rounded-full bg-slate-700" />
      </motion.div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full shrink-0 items-center justify-between px-4 py-1 text-left lg:hidden"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
          {TABS.find((t) => t.key === tab)?.label}
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-white/40" /> : <ChevronUp className="h-3.5 w-3.5 text-white/40" />}
      </button>

      <div className="flex shrink-0 border-b border-slate-800 lg:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setOpen(true) }}
            className={
              'flex-1 border-b-2 px-2 py-2 text-center text-xs font-semibold transition-colors duration-150 ' +
              (tab === t.key ? 'border-teal-400 text-teal-300' : 'border-transparent text-white/40 hover:text-white/60')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* PlayerQueueSidebar's own relative wrapper for PlayerProfileDrawer
          to slide over — unconditionally at lg+, only while Players is the
          active tab and the sheet is open below it. */}
      <div className={'relative min-h-0 flex-1 ' + (open && tab === 'players' ? 'flex' : 'hidden') + ' lg:flex'}>
        <PlayerQueueSidebar
          players={players}
          search={search}
          onSearch={onSearch}
          posFilter={posFilter}
          onPosFilter={onPosFilter}
          expBand={expBand}
          onExpBand={onExpBand}
          watchlistOnly={watchlistOnly}
          onWatchlistOnly={onWatchlistOnly}
          showDrafted={showDrafted}
          onShowDrafted={onShowDrafted}
          pointsFor={pointsFor}
          valueFor={valueFor}
          photoFor={photoFor}
          initialsFor={initialsFor}
          onDraft={onDraft}
          myTurn={myTurn}
          queuedNames={queuedNames}
          onToggleQueue={onToggleQueue}
          draftedByFor={draftedByFor}
          onSelectPlayer={onSelectPlayer}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          recommended={recommended}
          recommendedVorp={recommendedVorp}
          recommendedTierLeft={recommendedTierLeft}
        />
        <PlayerProfileDrawer
          player={selectedPlayer}
          onClose={() => onSelectPlayer(null)}
          photoFor={photoFor}
          initialsFor={initialsFor}
        />
      </div>

      {open && tab === 'queue' && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2 lg:hidden">
          <QueueList players={queuePlayers} myTurn={myTurn} engine={engine} />
        </div>
      )}

      {open && tab === 'team' && (
        <div className="min-h-0 flex-1 lg:hidden">
          <TeamTab engine={engine} league={league} mySlot={mySlot} viewSlot={viewSlot} onViewSlot={setViewSlot} teamLabelOf={teamLabelOf} />
        </div>
      )}

      {open && tab === 'chat' && (
        <div className="flex min-h-0 flex-1 lg:hidden">
          <ChatPlaceholder />
        </div>
      )}
    </div>
  )
}
