import { useEffect, useReducer, useRef, useState } from 'react'
import Header from './Header.jsx'
import ConfigureDraftForm from './ConfigureDraftForm.jsx'
import RoomPanel from './RoomPanel.jsx'
import DraftLocker from './DraftLocker.jsx'
import DraftLogDock from './DraftLogDock.jsx'
import DraftRoomStatusBar from './DraftRoomStatusBar.jsx'
import DraftBoardGrid from './DraftBoardGrid.jsx'
import { SORT_DEFAULT_DIR } from './PlayerQueueSidebar.jsx'
import PlayerHub from './PlayerHub.jsx'
import SidePanel from './SidePanel.jsx'
import QueueList from './QueueList.jsx'
import TeamTab from './TeamTab.jsx'
import AnalysisTab from './AnalysisTab.jsx'
import DraftInsightsDashboard from './DraftInsightsDashboard.jsx'

function useEngine() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.JukeEngine) setReady(true)
  }, [])
  return ready ? window.JukeEngine : null
}

// "juke:header" fires from renderHeader() on every render, tick and pause
// toggle (see AppHeader.jsx's useHeaderInfo) — reused here as the one
// "something changed, re-read the bridge" signal so the whole page
// re-renders together off board()/picks()/league() rather than each panel
// polling on its own timer.
function useJukeTick(engine) {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    if (!engine) return
    window.addEventListener('juke:header', force)
    return () => window.removeEventListener('juke:header', force)
  }, [engine])
}

// A route of its own, deliberately outside applyRoute()'s home/draft
// toggle — see the comment beside #draftroom-root in index.html. Nothing
// here touches app.js's routing; it just watches the hash itself.
function useHashActive(prefix) {
  const [active, setActive] = useState(
    () => typeof window !== 'undefined' && window.location.hash.startsWith(prefix)
  )
  useEffect(() => {
    const onHash = () => setActive(window.location.hash.startsWith(prefix))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [prefix])
  return active
}

export default function DraftRoom() {
  const engine = useEngine()
  useJukeTick(engine)
  const active = useHashActive('#/draft-room')

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('ALL')
  // Independent of posFilter rather than folded into it — "RB rookies I'm
  // watching" is a real combination someone would want, and a single-select
  // list can't hold three things that all have to be true at once.
  const [expBand, setExpBand] = useState('all') // 'all' | 'rookie' | 'veteran'
  const [watchlistOnly, setWatchlistOnly] = useState(false)
  const [showDrafted, setShowDrafted] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  // Isolate hides the queue/profile column and the log/chat dock, leaving
  // just the board — see the status bar's own comment on why this is
  // lg+ only for now.
  const [isolate, setIsolate] = useState(false)
  // 'board' is the default — the board's own ADP-rank order, same as
  // sortBy === 'adp' asc for undrafted players, but it's its own case so
  // clicking away from a column and never toggling anything back to it
  // isn't required just to get the original order back.
  const [sortBy, setSortBy] = useState('board')
  const [sortDir, setSortDir] = useState('asc')
  const handleSort = (column) => {
    if (column === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir(SORT_DEFAULT_DIR[column])
    }
  }
  /* Board / Analysis, from the remote branch: Suggestions and Players are
     already merged into the player list, and Queue/Roster/Log have their
     own panels, so Analysis was the last legacy tab with no home in this
     layout. It toggles what the board area shows, not a whole view. */
  const [view, setView] = useState('board')
  /* Mirrors AppHeader.jsx's own soundOn state — engine.soundWanted() is
     not covered by the "juke:header" tick, since toggling it never
     touches renderHeader(). This page mounts the marketing Header rather
     than AppHeader, so it keeps its own copy of the same sync instead of
     reaching into that component. */
  const [soundOn, setSoundOn] = useState(false)
  useEffect(() => {
    if (!engine) return
    setSoundOn(engine.soundWanted())
  }, [engine])
  const handleToggleSound = () => {
    if (!engine) return
    engine.toggleSound()
    setSoundOn(engine.soundWanted())
  }

  // Solo has no real persistent "keep drafting for me" flag to read (see
  // the bridge comment on toggleRoomAutopilot in app.js) — a room does, so
  // this is only ever the source of truth off-room.
  const [soloAutopick, setSoloAutopick] = useState(false)
  // Guards the solo autopick effect against submitting twice for the same
  // turn — it re-runs on every "juke:header" tick while it's my turn, not
  // just on the one that actually changed anything.
  const lastAutoPickedOverall = useRef(-1)

  // Derived, engine-dependent values, computed with safe fallbacks so they
  // can sit above the early return below — every hook in this component
  // has to run on every render, in the same order, so the autopick effect
  // can't wait until after `if (!engine) return null`.
  const DE = typeof window !== 'undefined' ? window.DraftEngine : null
  const league = engine ? engine.league() : null
  const picks = engine ? engine.picks() || [] : []
  const board = engine ? engine.board() || [] : []
  // mySlot is only set once a real draft has started; this page is also
  // reachable before that (a fresh board, nobody on the clock yet), so it
  // falls back to seat 0 rather than leaving every "mine" check undefined.
  const mySlot = engine ? engine.mySlot() ?? 0 : 0
  const onClock = engine && DE && league ? DE.onTheClock(league, picks.length) : null
  const overall = picks.length + 1
  const myTurn = !!onClock && onClock.slot === mySlot
  const roomActive = engine ? engine.inRoom() : false
  // In a room, state.autoMe is the real flag (toggleable from the legacy
  // UI too, so this has to read it live rather than mirror a local copy).
  // Off-room it's just the local switch above.
  const autopick = roomActive ? !!(engine && engine.autoMe()) : soloAutopick

  const started = engine ? !!engine.headerInfo().started : false
  // Computed up here, with the other pre-early-return fallbacks, so the
  // insights effect below can watch it — the later render code reuses this
  // same value rather than asking engine.draftOver() a second time.
  const draftIsOver = engine && started ? !!engine.draftOver() : false

  // The Insights dashboard opens itself on the edge — "the draft just
  // became over", not "the draft is over" — same reasoning as
  // checkDraftFinished()/revealAnalysis() in app.js: acting on the state
  // would drag the overlay back over the board on every re-render after
  // the user closed it to look around. The effect's dep array IS the edge
  // detector: it only re-fires when draftIsOver actually changes. A draft
  // reopened from the Locker mounts with draftIsOver already true, so the
  // first run fires too — which is right, since "Analyze Draft" is exactly
  // a request for this screen.
  const [showInsights, setShowInsights] = useState(false)
  // Which team's report the dashboard is showing. Yours on the auto-open
  // and from the reopen pill; a board header click opens that column's
  // team instead. State lives here rather than inside the dashboard so a
  // header click can pick the team and open the overlay in one gesture.
  const [insightsSlot, setInsightsSlot] = useState(0)
  // Which seat the desktop Roster panel is showing. Separate from
  // insightsSlot: reading a rival's roster mid-draft and reading a
  // finished team's report are different questions, and one resetting
  // the other would be a surprise.
  const [rosterSlot, setRosterSlot] = useState(0)
  // Which of the combined Queue/Roster panel's two tabs is showing. Queue
  // first: it is the one that changes as the draft runs.
  const [sideTab, setSideTab] = useState('queue')
  useEffect(() => {
    if (draftIsOver) {
      setInsightsSlot(mySlot)
      setShowInsights(true)
    }
  }, [draftIsOver, mySlot])

  // The Roster panel opens on your own seat. mySlot is 0 until a draft
  // actually starts, so this follows it rather than being an initial
  // value that would strand the panel on seat 0 for anyone who drafted
  // from a different one.
  useEffect(() => { setRosterSlot(mySlot) }, [mySlot])

  // Solo autopick's real submission path: the exact same engine.draftPlayer
  // the Draft button uses (draftAndAdvance() underneath), just triggered
  // automatically instead of by a click, with the pick chosen by
  // engine.autoPickForMe() — the same queueTop() -> suggestions()[0] ->
  // bestLeft() order autoDraftRest()'s own solo loop already uses for my
  // seat. Room mode needs none of this: driveMyAutopilot() already re-runs
  // itself off every room broadcast once toggled on (see the bridge
  // comment on toggleRoomAutopilot), so this effect only ever acts off-room.
  useEffect(() => {
    if (!active || !engine || !started || roomActive || !soloAutopick || !myTurn) return
    if (lastAutoPickedOverall.current === overall) return
    lastAutoPickedOverall.current = overall
    const choice = engine.autoPickForMe()
    if (choice) engine.draftPlayer(choice)
  }, [active, engine, started, roomActive, soloAutopick, myTurn, overall])

  if (!active || !engine) return null

  // Before a draft exists, this is the exact same real form the setup
  // page uses — league size, scoring, pick clock, draft position, and its
  // own Resume/Discard for a save in progress — rather than this page
  // guessing at a seat and a clock length nobody chose. It calls the same
  // startDraft()/resumeDraft() the live board below reacts to, so the
  // instant one of them sets state.started, the effect above and this
  // check both pick it up on the next "juke:header" tick and this page
  // swaps to the live board on its own.
  if (!started) {
    // z-[60], not z-40: #root (Homepage) never unmounts — it's a separate
    // React root behind this one, per main.jsx — and its own fixed header
    // is z-50. z-40 traps this whole overlay, header included, in a
    // stacking context beneath that outer header; it never showed before
    // because both headers had identical content (logo/ticker/
    // login/signup) and there was nothing to tell them apart on screen.
    // See the same comment on the started branch's wrapper, where this
    // stopped being invisible.
    return (
      <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-[#0B0E14] pt-16 text-white">
        <Header />
        {/* max-w-7xl, not the two-column screen's old max-w-4xl — three
            panels at that width would leave each one under 280px, too
            narrow for the Locker's cards (a league label, a rank pill, an
            Analyze button) or the room panel's invite link. basis-1/3 each,
            not a wider Locker: the three are equally-weighted things a
            manager might be here for — start a new draft, draft with
            friends, reopen an old one — not one primary action and two
            secondary ones. */}
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-stretch gap-6 px-6 py-10 lg:flex-row">
          <div className="lg:basis-1/3">
            <ConfigureDraftForm />
          </div>
          <div className="lg:basis-1/3">
            <RoomPanel />
          </div>
          <div className="relative lg:basis-1/3 lg:min-h-[420px]">
            {/* Absolute inside a relative column, not an explicit height.
                The Locker needs a bounded height so a long history scrolls
                inside it instead of setting the row's height — but the old
                bound was a viewport guess (calc(100vh-176px)), and whenever
                the guess ran shorter than the row's real height (set by the
                tallest sibling, the Configure form) the Locker's bottom
                visibly sat above the other two columns'. An absolutely
                positioned fill contributes nothing to the row's height and
                tracks the stretched column height exactly, so all three
                bottoms align by construction rather than by arithmetic
                that has to be re-derived every time the padding moves. The
                min-h lives on the column so a near-empty row still gives
                the Locker something worth filling; below lg none of this
                applies and the Locker takes its natural stacked height. */}
            <div className="lg:absolute lg:inset-0">
              <DraftLocker />
            </div>
          </div>
        </div>
        {/* No DraftLogDock here on purpose — "My Queue" and "Draft Log" are
            both meaningless before a draft exists (nothing queued, nothing
            picked yet), and it would float over the same corner the Locker
            now occupies. It still belongs on the live board below, where
            both tabs have something real to show. */}
      </div>
    )
  }

  const code = onClock && DE ? DE.pickCode(overall, league.teams) : null
  const pickInRound = onClock && DE ? DE.pickInRound(onClock.round, onClock.slot, league.teams) : null
  const roundText = onClock
    ? `Round ${onClock.round}, Pick ${pickInRound}`
    : picks.length > 0
      ? 'Draft complete'
      : 'Board ready'

  const info = engine.headerInfo()
  const rightLabel = info.started ? info.rightLabel : 'Status'
  const rightValue = info.started ? info.rightValue : 'Idle'
  const urgent = !!info.urgent

  // Same gating renderActionBar() already uses in app.js: Undo is
  // solo-only (a room's copy just gets overwritten by the next
  // broadcast — see the bridge comment on `undo`), Pause is the host's in
  // a room, and both disappear once the draft is over. Discard/"Leave the
  // room" stays offered either way; only its label and danger styling
  // change. draftIsOver itself is computed above the early returns, where
  // the insights effect needs it.
  const hasRoomVal = engine.hasRoom()
  const isHost = engine.isHost()
  const showPause = !draftIsOver && (!hasRoomVal || isHost)
  const showUndo = !draftIsOver && !hasRoomVal
  const paused = engine.paused()
  const pauseDisabled = engine.clockLength() === 0

  const lineup = engine.seatedLineup()
  const rules = engine.rulesForFormat(league.scoring)
  const pointsFor = (player) => {
    const stat = engine.statOf(player)
    if (!stat || !stat.p) return null
    return engine.pointsUnder(stat.p, rules)
  }
  // overallScore() is the same "Juke score" used everywhere else on the
  // site — points above replacement at the player's position, as a share
  // of the best such figure on the board. Not a second value metric.
  const valueFor = (player) => engine.overallScore(player)
  /* The projection block a player's raw counting stats live on — the same
     `s.p` logColumns() reads in app.js. Handed to the list so its stat
     columns and its sort read one source. */
  const projOf = (player) => {
    const s = engine.statOf(player)
    return s && s.p ? s.p : null
  }

  // The Value Assistant card's one recommendation — suggestions('ALL')[0],
  // the exact real ranking (adp+jitter) x need x risk x model that already
  // drives the legacy Suggestions tab, not a fresh computation. Not gated
  // on myTurn: my team's needs don't change depending on whose turn it is
  // right now, only whether the button can act on them does (see the card
  // itself). Recomputed every render off the live board/roster, same as
  // everything else here.
  const recommended = engine.suggestions('ALL')[0] || null
  const recommendedVorp = recommended ? engine.replacementGap(recommended) : null
  const recommendedTierLeft = recommended ? engine.tierRemaining(recommended) : null
  const photoFor = (player) => engine.photoUrl(player)
  const initialsFor = (player) => engine.initials(player.name)

  // FLEX is a roster slot (RB/WR/TE), not a player.pos, so it can't be a
  // plain equality check the way every other pill is. flexPositions() is
  // SLOT_ELIGIBLE.FLEX from app.js, bridged rather than hand-copied — see
  // the bridge comment on photoUrl/initials/flexPositions.
  const flexPositions = engine.flexPositions()
  const watchlistedNames = new Set(engine.watchlist() || [])
  // Who took a drafted player, for the showDrafted view — picks() rather
  // than a second copy of "who has who": teamLabel() is the exact name the
  // board's own header row already uses for that seat.
  const draftedByFor = (player) => {
    const pick = picks.find((p) => p.player.name === player.name)
    return pick ? engine.teamLabel(pick.slot) : null
  }
  const availablePlayers = board
    .filter((p) => showDrafted || !p.drafted)
    .filter((p) => {
      if (posFilter === 'ALL') return true
      if (posFilter === 'FLEX') return flexPositions.includes(p.pos)
      return p.pos === posFilter
    })
    .filter((p) => !watchlistOnly || watchlistedNames.has(p.name))
    .filter((p) => {
      if (expBand === 'all') return true
      const exp = engine.statOf(p)?.exp
      return expBand === 'rookie' ? exp === 0 : exp !== undefined && exp > 0
    })
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'board') return a.overall - b.overall
      /* Reuse the exact same readers the cells render from, so a sort can
         never disagree with what is on screen. Anything that is not one
         of the three derived columns is a raw projection key (rushing
         yards, targets, and the rest of the scrollable stats), read off
         the same block those cells draw from. */
      const reader =
        sortBy === 'adp' ? (p) => p.adp
          : sortBy === 'pts' ? pointsFor
            : sortBy === 'vorp' || sortBy === 'value' ? valueFor
              : (p) => { const proj = projOf(p); const v = proj ? proj[sortBy] : null; return v || null }
      const av = reader(a)
      const bv = reader(b)
      // "A missing number is not a small number" — Value is null for K/DST
      // (overallScore() withholds a rank for UNRANKED_POSITIONS) and Proj
      // Pts is null for anyone with no projection. Blanks sort last in
      // both directions rather than reading as 0, same rule the legacy
      // player grid's own column sorts already follow.
      const aMissing = av == null || Number.isNaN(av)
      const bMissing = bv == null || Number.isNaN(bv)
      if (aMissing && bMissing) return 0
      if (aMissing) return 1
      if (bMissing) return -1
      return sortDir === 'asc' ? av - bv : bv - av
    })

  // Real submission: engine.draftPlayer() is draftAndAdvance() underneath
  // (see the bridge comment in app.js), so this mutates the same
  // board/state a legacy Draft button would, and — in a room — sends the
  // same Live.pick() request. It re-checks isMyTurn() itself, but the
  // button is also disabled off the same `myTurn` value below, so a click
  // here should only ever be a no-op if the turn changed in the instant
  // between render and click (another manager's pick landing, a CPU step).
  // draftAndAdvance() calls render() synchronously, which fires
  // "juke:header" — useJukeTick() above picks that up and this whole page
  // (board, roster dock, status bar) re-renders with the real result,
  // including the CPU cascade that follows in solo mode.
  const handleDraft = (player) => {
    engine.draftPlayer(player)
  }

  // Room vs. solo really do mean different things here — see the bridge
  // comment on toggleRoomAutopilot in app.js for why neither branch is a
  // stand-in for the other.
  const handleToggleAutopick = () => {
    if (roomActive) engine.toggleRoomAutopilot()
    else setSoloAutopick((a) => !a)
  }

  // Undo/Pause/Discard are all real, direct calls into app.js — undo()
  // pops picks off state.picks until it's my turn again, togglePause()
  // stops the clock (or sends Live.pause() in a room), and restart() is
  // clearSave()+goHome(), the exact "Discard draft"/"Leave the room"
  // action. None of them are reimplemented here.
  const handleUndo = () => engine.undo()
  const handleTogglePause = () => engine.togglePause()
  const handleDiscard = () => engine.restart()

  // The real queue (state.queue, an array of player names) — queueToggle()
  // is the exact function the legacy rail's star button already calls.
  // queuedNames as a Set just makes the sidebar's per-row lookup cheap.
  // queuePlayers resolves those same names back to board players, for
  // PlayerHub's mobile Queue tab — the exact resolution DraftLogDock's
  // desktop "My Queue" tab already does, not a second copy of it.
  const queuedNames = new Set(engine.queue() || [])
  const queuePlayers = (engine.queue() || []).map((name) => board.find((p) => p.name === name)).filter(Boolean)
  const handleToggleQueue = (name) => engine.queueToggle(name)

  /* Everybody else's picks, most recent first — the Draft Log's data.
     Computed once here and handed to both surfaces that draw it (the
     desktop panel and the mobile sheet's Log tab) rather than each
     deriving its own: two copies of "what has happened" is exactly the
     kind of thing that drifts.

     "Not my seat" is the honest filter. In a room some of those seats are
     other people rather than CPUs, and there is no per-pick flag saying
     which was which at the moment it picked. */
  const recentOthers = picks
    .filter((p) => p.slot !== mySlot)
    .slice(-10)
    .reverse()

  return (
    // z-[60], not z-40: #root (Homepage) is a separate React root that
    // never unmounts (see main.jsx) and its own header is a fixed z-50.
    // z-40 traps this whole overlay beneath that header's stacking
    // context — invisible as long as DraftRoom rendered its own identical
    // <Header/> on top, but this view's header now has different content
    // (round/pick/clock/autopick, no login/signup), so the trap became a
    // real bug: Homepage's header was painting over this one entirely.
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0B0E14] text-white">
      {/* DraftRoomStatusBar is the fixed top bar for this view now — it
          carries the brand/ticker Header.jsx used to own here, consolidated
          with the round/pick/clock/autopick controls into one h-14 row
          instead of two stacked h-16 bars. Header.jsx itself is untouched
          and still fixed-h-16 on the homepage and the pre-draft setup
          screen below, which is why this branch's pt- offset (h-14) no
          longer matches that one's (h-16) — they're genuinely different
          bars now, not the same one reused. */}
      <DraftRoomStatusBar
        roundText={roundText}
        code={code}
        rightLabel={rightLabel}
        rightValue={rightValue}
        myTurn={myTurn}
        urgent={urgent}
        autopick={autopick}
        onToggleAutopick={handleToggleAutopick}
        showPause={showPause}
        paused={paused}
        pauseDisabled={pauseDisabled}
        onTogglePause={handleTogglePause}
        showUndo={showUndo}
        onUndo={handleUndo}
        discardLabel={hasRoomVal ? 'Leave the room' : 'Discard draft'}
        discardDanger={!hasRoomVal}
        onDiscard={handleDiscard}
        soundOn={soundOn}
        onToggleSound={handleToggleSound}
        isolate={isolate}
        onToggleIsolate={() => setIsolate((v) => !v)}
      />
      {/* pt-14 matches DraftRoomStatusBar's own h-14; md:pt-20 adds the
          6-unit ticker strip (top-14, h-6) that only exists at md+ — see
          the comment on that strip in DraftRoomStatusBar.jsx. No bottom
          padding here: PlayerHub's mobile sheet is `fixed` and so occupies
          no space in this flow — clearance for it is reserved inside the
          scrollable panels themselves (the board's and the player list's
          own pb-28), and reserving it here too would shrink the row for
          no reason. */}
      <div className="flex flex-1 flex-col overflow-hidden pt-14 md:pt-20">
        {/* The board stays visible on every width now — see PlayerHub.jsx's
            file comment for what replaced the old Draft Hub/Full Board
            toggle below lg (a bottom sheet over the board, not a view that
            swaps it out). */}
        {/* Desktop is a horizontal split — board across the full window
            width on top, panels in a row beneath — not the vertical split
            this used to be. Measured against Sleeper's own desktop room,
            which is arranged the same way and for the same reason: a
            10-team board needs the whole width to show ten columns, and
            sharing width with side panels is what forced ours to scroll
            sideways at every window size. Below lg this is unchanged: one
            column, board filling it, PlayerHub's sheet fixed over the
            bottom (see its own file comment). */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* min-w-0 is load-bearing: DraftBoardGrid's own content is
              min-w-max (every column at its real width, deliberately
              wider than any viewport so it can scroll) and a flex item's
              automatic minimum size is content-based unless the item
              itself sets overflow — the grid does, this wrapper doesn't.
              Without it the wrapper refuses to shrink to the window.

              Height, not width, is what the two breakpoints now argue
              over: flex-1 below lg (the board owns the column, the sheet
              floats above it), a fixed share at lg+ so the panel row
              beneath always gets its half. isolate hands the whole height
              back to the board. */}
          {/* Board / Analysis. The grade used to be the one legacy tab
              with no home in this layout — Suggestions and Players merged
              into the player list, and Queue/Roster/Log/Chat each have a
              panel. It swaps what the top half shows rather than taking
              over the screen, so the panels underneath stay put. */}
          <div className="flex shrink-0 gap-1.5 border-b border-slate-800 bg-slate-900/40 px-3 py-1.5">
            {[
              { key: 'board', label: 'Board' },
              { key: 'analysis', label: 'Analysis' },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className={
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ' +
                  (view === v.key ? 'bg-teal-500 text-obsidian' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white')
                }
              >
                {v.label}
              </button>
            ))}
          </div>

          <div
            className={
              'flex min-h-0 min-w-0 flex-1 ' +
              (isolate ? 'lg:flex-1' : 'lg:flex-none lg:h-[45%]')
            }
          >
            {view === 'analysis' ? (
              <AnalysisTab engine={engine} league={league} picks={picks} mySlot={mySlot} />
            ) : (
            <DraftBoardGrid
              league={league}
              picks={picks}
              mySlot={mySlot}
              onClock={onClock}
              teamLabelOf={(slot) => engine.teamLabel(slot)}
              onTeamClick={
                draftIsOver
                  ? (slot) => { setInsightsSlot(slot); setShowInsights(true) }
                  : undefined
              }
            />
            )}
          </div>

          {/* The panel row. flex-none below lg with no in-flow children —
              PlayerHub is `fixed` there — so it collapses to nothing and
              the board keeps the whole column; lg:flex-1 gives it the
              other half of the screen at desktop width. It cannot be
              `hidden` below lg: display:none on the parent would hide
              PlayerHub's fixed sheet too, which is the whole mobile UI. */}
          <div
            className={
              'flex min-h-0 flex-none border-slate-800 ' +
              (isolate ? 'lg:hidden' : 'lg:flex-1 lg:border-t')
            }
          >
            {/* Players — the widest panel, as it is on Sleeper: it carries
                the search, the filter chips, the sortable grid and the
                profile drawer that slides over it. */}
            <div className="relative flex min-h-0 flex-1 lg:flex-[5] lg:min-w-0">
            <PlayerHub
              players={availablePlayers}
              search={search}
              onSearch={setSearch}
              posFilter={posFilter}
              onPosFilter={setPosFilter}
              expBand={expBand}
              onExpBand={setExpBand}
              watchlistOnly={watchlistOnly}
              onWatchlistOnly={setWatchlistOnly}
              showDrafted={showDrafted}
              onShowDrafted={setShowDrafted}
              pointsFor={pointsFor}
              valueFor={valueFor}
              photoFor={photoFor}
              initialsFor={initialsFor}
              onDraft={handleDraft}
              myTurn={myTurn}
              queuedNames={queuedNames}
              onToggleQueue={handleToggleQueue}
              draftedByFor={draftedByFor}
              selectedPlayer={selectedPlayer}
              onSelectPlayer={setSelectedPlayer}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              recommended={recommended}
              recommendedVorp={recommendedVorp}
              recommendedTierLeft={recommendedTierLeft}
              projOf={projOf}
              queuePlayers={queuePlayers}
              recentOthers={recentOthers}
              engine={engine}
              league={league}
              mySlot={mySlot}
              teamLabelOf={(slot) => engine.teamLabel(slot)}
            />
            </div>

            {/* The other panels are lg+ only — below lg these same views
                are tabs inside PlayerHub's sheet (Queue, Team, Chat),
                which is why nothing here needs a mobile branch.

                Queue and Roster share one tabbed panel rather than taking
                a column each. Four columns was one too many: at 1600px it
                gave each side panel 320px, and neither of these two needs
                that constantly — a queue is usually a handful of names and
                a roster is read in glances, while the player grid it was
                taking width from is the surface the whole screen exists
                for. Combined, Players goes 640px -> 800px at that width,
                and the pair still gets 480px between them. */}
            <div className="hidden lg:flex lg:min-h-0 lg:flex-[3] lg:min-w-0">
              <SidePanel
                tabs={[
                  { key: 'queue', label: 'Queue', count: queuePlayers.length },
                  { key: 'roster', label: 'Roster' },
                ]}
                active={sideTab}
                onTab={setSideTab}
              >
                {sideTab === 'queue' ? (
                  <div className="p-2">
                    <QueueList players={queuePlayers} myTurn={myTurn} engine={engine} />
                  </div>
                ) : (
                  /* Roster, not the old bottom strip: the strip could only
                     show a surname per slot across the full width, where a
                     real panel shows the whole lineup and can carry any
                     seat — the same any-team switcher the Insights
                     dashboard has. */
                  <TeamTab
                    compact
                    engine={engine}
                    league={league}
                    mySlot={mySlot}
                    viewSlot={rosterSlot}
                    onViewSlot={setRosterSlot}
                    teamLabelOf={(slot) => engine.teamLabel(slot)}
                  />
                )}
              </SidePanel>
            </div>

            <div className="hidden lg:flex lg:min-h-0 lg:flex-[2] lg:min-w-0">
              <DraftLogDock recentOthers={recentOthers} />
            </div>
          </div>
        </div>
      </div>

      {/* Opens itself on the draft-over edge (see the effect near the top)
          and closes to the board, leaving a pill to reopen — the analysis
          is the most valuable screen in the app (CLAUDE.md: the last pick
          lands and it opens itself), so it must never be more than one
          press away from a finished board. z-[65] for the pill keeps it
          above the fixed status bar (z-50); the dashboard itself is z-[70],
          over everything in this view. */}
      {draftIsOver && showInsights && (
        <DraftInsightsDashboard
          engine={engine}
          league={league}
          mySlot={mySlot}
          viewSlot={insightsSlot}
          onViewSlot={setInsightsSlot}
          onClose={() => setShowInsights(false)}
        />
      )}
      {draftIsOver && !showInsights && (
        <button
          type="button"
          onClick={() => { setInsightsSlot(mySlot); setShowInsights(true) }}
          className="fixed left-1/2 top-16 z-[65] -translate-x-1/2 rounded-full border border-teal-400/40 bg-slate-950/90 px-4 py-1.5 text-xs font-semibold text-teal-300 shadow-[0_0_15px_rgba(0,229,255,0.2)] backdrop-blur transition-colors duration-200 hover:border-teal-400 hover:bg-teal-400/10"
        >
          Draft Insights
        </button>
      )}
    </div>
  )
}
