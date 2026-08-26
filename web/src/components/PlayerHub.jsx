import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import PlayerQueueSidebar from './PlayerQueueSidebar.jsx'
import QueueList from './QueueList.jsx'
import TeamTab from './TeamTab.jsx'
import ChatPanel from './ChatPanel.jsx'
import ActivityLog from './ActivityLog.jsx'

/* Five tabs, not four: the desktop row carries a Draft Log beside Chat
   and the sheet did not, which meant a phone was the one place you could
   not see what the room had just done. Everything desktop shows, mobile
   shows — that is the rule these tabs are keeping.

   This is the default list, still used wherever this component mounts
   without its own `tabs` prop — Analysis's own panel row, unchanged by
   the Players screen pass, including its own reachability: tapping this
   sheet's collapse header (below, `lg:hidden`) opens it independently of
   MobileDraftTabBar entirely, so Players and Team are still real
   destinations there. Reworking Analysis's own mobile panel is a later
   pass, not this one. */
const DEFAULT_TABS = [
  { key: 'players', label: 'Players' },
  { key: 'queue', label: 'Queue' },
  { key: 'team', label: 'Team' },
  { key: 'chat', label: 'Chat' },
  { key: 'log', label: 'Log' },
]

/* Players now has its own full screen (PlayersTab.jsx) and Roster is a
   pane inside it, and MobileDraftTabBar.jsx dropped the Roster/Players
   buttons that used to call openHub('team')/openHub('players') for this
   mount specifically — the Board tab's own mobile sheet. Leaving those
   two chips in here would be exactly the dead-entry trap CLAUDE.md warns
   about: reachable only by a user who happens to expand the sheet and
   tap a chip nothing points them toward, opening a stale, narrower copy
   of a screen that now exists properly elsewhere. Analysis's mount below
   keeps DEFAULT_TABS — see its own comment for why that one is different. */
export const BOARD_TABS = [
  { key: 'queue', label: 'Queue' },
  { key: 'chat', label: 'Chat' },
  { key: 'log', label: 'Log' },
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
  // Sheet open state and the active internal tab, lifted into DraftRoom.jsx
  // rather than owned here — the same treatment every other PlayerHub prop
  // already gets. The mobile bottom tab bar's Roster/Players buttons need to
  // reach into this sheet from outside it (open it, pick a tab) the same way
  // DraftRoom.jsx's Draft button already reaches into PlayerQueueSidebar's
  // queue toggle — a control cannot open a specific tab of a component that
  // owns its own tab as unreachable local state.
  open,
  onOpenChange,
  tab,
  onTabChange,
  // PlayerQueueSidebar passthrough — onSelectPlayer included, though the
  // profile it opens is a top-level modal now rather than a child of this
  // component (see PlayerProfileModal.jsx)
  players,
  search,
  onSearch,
  posFilter,
  counts,
  onPosFilter,
  expBand,
  onExpBand,
  watchlistOnly,
  onWatchlistOnly,
  showDrafted,
  onShowDrafted,
  pointsFor,
  valueFor,
  vorpFor,
  survivalFor,
  photoFor,
  initialsFor,
  onDraft,
  myTurn,
  draftOver,
  queuedNames,
  onToggleQueue,
  draftedByFor,
  onSelectPlayer,
  sortBy,
  sortDir,
  onSort,
  recommended,
  recommendedVorp,
  recommendedTierLeft,
  projOf,
  tierAvgByPos,
  // Queue tab
  queuePlayers,
  recentOthers,
  engine,
  // Team tab
  league,
  mySlot,
  teamLabelOf,
  // BOARD_TABS for the Board view's own mount; every other caller leaves
  // this at the classic five so Analysis's existing behaviour (both
  // breakpoints) is untouched by this pass.
  tabs = DEFAULT_TABS,
}) {
  const setOpen = onOpenChange
  const setTab = onTabChange
  // Belt and suspenders on top of the tab strip itself only drawing chips
  // from `tabs`: nothing sets hubTab to 'players' or 'team' for a mount
  // that never offered those chips, but hubTab is lifted, shared state
  // (DraftRoom.jsx), not local to this component — a value left over from
  // a different mount switching the view is exactly the kind of stale
  // cross-talk a content block gated only on `tab === X` cannot see coming.
  const showPlayersTab = tabs.some((t) => t.key === 'players')
  const showTeamTab = tabs.some((t) => t.key === 'team')
  const [viewSlot, setViewSlot] = useState(mySlot)
  // mySlot is 0 until a real draft actually assigns a seat (solo start,
  // or a room's seat claim/swap landing later), and this captured
  // whatever it was at mount forever after — the same seat-select-that-
  // lies failure DraftRoom.jsx's own rosterSlot/insightsSlot state
  // already had, and already fixed, the same way. Mobile's Team tab was
  // the one place that fix was never copied to.
  useEffect(() => { setViewSlot(mySlot) }, [mySlot])
  // window.DraftEngine, same global source DraftLogDock reads it from —
  // ActivityLog needs it for pickCode().
  const DE = typeof window !== 'undefined' ? window.DraftEngine : null

  return (
    <div
      // bottom-[58px+safe-area], not bottom-0: MobileDraftTabBar.jsx sits at
      // the true bottom-0 now, persistent underneath this sheet at every
      // height (collapsed strip or dragged open), the same relationship the
      // mockup's screenshots show — the four-tab bar never disappears, this
      // sheet rises above it. lg:static drops the whole fixed/bottom
      // question at desktop width, where this offset never applies.
      /* 85vh, not 75. On a phone the visible viewport is about 664px once
         browser chrome is out, and at 75vh this sheet was 498 of it — which
         after the tab strip and the filter header left the players list 111
         pixels, a little over two rows out of 210. The board behind the
         sheet goes from 108px showing to 42px, and that is the right trade
         on the one tab whose entire job is a long list. */
      className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-40 flex max-h-[85vh] flex-col overflow-hidden rounded-t-xl border-t border-slate-rule bg-slate-panel/95 shadow-2xl backdrop-blur-md lg:static lg:bottom-auto lg:z-auto lg:h-full lg:max-h-none lg:flex-1 lg:rounded-none lg:border-t-0 lg:bg-transparent lg:shadow-none"
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
        <span className="h-1 w-9 rounded-full bg-slate-rule" />
      </motion.div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full shrink-0 items-center justify-between px-4 py-1 text-left lg:hidden"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          {tabs.find((t) => t.key === tab)?.label}
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-ink-muted" /> : <ChevronUp className="h-3.5 w-3.5 text-ink-muted" />}
      </button>

      {/* A filled pill for the active tab, not a teal underline.

          This strip is `lg:hidden`, which puts it on exactly the width where
          MobileDraftTabBar also lives — and that bar marks its own active item
          with a 2px teal rule too. With the sheet dragged low the two land
          about 20px apart: two identical teal rules, same colour and weight,
          answering different questions (which screen am I on, which sheet tab
          is open). Reported as "the teal lines aren't aligned", and they never
          will be, because they belong to different components.

          So the two indicators differ in *form* rather than in colour. The bar
          keeps the rule, being the primary navigation; this one becomes a
          fill. Teal still means selected in both places, which is the part
          worth keeping — what changes is that a fill and a rule cannot be
          mistaken for each other or read as one misaligned line.

          h-11 while I am here: these were 32px tall against the handoff's own
          44px floor for anything tappable, and five of them sit in a row on a
          phone. The 12px comes out of the sheet's content, which is the right
          side of that trade for a control you hit with a thumb. */}
      <div className="flex shrink-0 gap-1 border-b border-slate-rule px-2 py-1.5 lg:hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setOpen(true) }}
            className={
              'h-11 flex-1 rounded-full px-2 text-center text-xs font-semibold transition-colors duration-150 ' +
              (tab === t.key ? 'bg-teal-400/[0.14] text-teal-300' : 'text-ink-muted hover:text-white/60')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Unconditionally at lg+ — but only for a mount whose tabs actually
          include 'players' (Analysis; Board's own tabs prop is BOARD_TABS
          and never reaches this branch, so its lg:hidden ancestor wrapper
          is the only thing standing between the desktop override and a
          tab it doesn't offer, and this guard makes that not matter).
          Below lg, only while Players is the active tab and the sheet is
          open. The profile used to slide over this box
          (PlayerProfileDrawer, absolutely positioned against it); it's a
          top-level modal now — see PlayerProfileModal.jsx's own comment on
          why a drawer scoped to one panel couldn't be reached from any
          other tab. */}
      {showPlayersTab && (
        <div className={'min-h-0 flex-1 ' + (open && tab === 'players' ? 'flex' : 'hidden') + ' lg:flex'}>
          <PlayerQueueSidebar
            counts={counts}
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
            vorpFor={vorpFor}
            survivalFor={survivalFor}
            photoFor={photoFor}
            initialsFor={initialsFor}
            onDraft={onDraft}
            myTurn={myTurn}
            draftOver={draftOver}
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
            projOf={projOf}
            tierAvgByPos={tierAvgByPos}
          />
        </div>
      )}

      {open && tab === 'queue' && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2 lg:hidden">
          <QueueList players={queuePlayers} myTurn={myTurn} engine={engine} />
        </div>
      )}

      {showTeamTab && open && tab === 'team' && (
        <div className="min-h-0 flex-1 lg:hidden">
          <TeamTab engine={engine} league={league} mySlot={mySlot} viewSlot={viewSlot} onViewSlot={setViewSlot} teamLabelOf={teamLabelOf} />
        </div>
      )}

      {open && tab === 'chat' && (
        <div className="flex min-h-0 flex-1 flex-col lg:hidden">
          <ChatPanel engine={engine} />
        </div>
      )}

      {open && tab === 'log' && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2 lg:hidden">
          <ActivityLog picks={recentOthers} engine={engine} DE={DE} league={league} />
        </div>
      )}
    </div>
  )
}
