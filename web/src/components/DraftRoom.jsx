import { useEffect, useReducer, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import DraftLocker from './DraftLocker.jsx'
import DraftLogDock from './DraftLogDock.jsx'
import DraftCockpitHeader from './DraftCockpitHeader.jsx'
import DraftMenuOverlay from './DraftMenuOverlay.jsx'
import DraftBoardGrid from './DraftBoardGrid.jsx'
import { SORT_DEFAULT_DIR } from './PlayerQueueSidebar.jsx'
import PlayerHub from './PlayerHub.jsx'
import SidePanel from './SidePanel.jsx'
import QueueList from './QueueList.jsx'
import TeamTab from './TeamTab.jsx'
import AnalysisTab from './AnalysisTab.jsx'
import DraftDecideScreen from './DraftDecideScreen.jsx'
import DraftInsightsDashboard from './DraftInsightsDashboard.jsx'
import DraftSettingsModal from './DraftSettingsModal.jsx'
import DraftEntryScreen from './DraftEntryScreen.jsx'
import DraftLobby from './DraftLobby.jsx'
import SonarLoader from './SonarLoader.jsx'
import LobbyBar from './LobbyBar.jsx'
import MobileAppTabBar from './MobileAppTabBar.jsx'
import MobileDraftTabBar from './MobileDraftTabBar.jsx'
import PickClockBand from './PickClockBand.jsx'

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
    /* And read once on attach, because the event can land before this
       listener exists. useEngine() resolves in an effect, so the listener
       goes on two renders after mount - and in a lobby the room's first
       state is often the only broadcast there will be, so missing it means
       showing an empty board until something else happens to fire. The live
       board never showed this: picks keep coming, and the next one repaired
       it. A quiet screen has no next one. */
    force()
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

/* Small enough to live here rather than in its own file, and deliberately
   not IconButton from the status bar: that one is a 28-32px header control
   with its own hover language, and this sits on top of a busy board where it
   has to stay legible without shouting. */
function TrayButton({ onClick, disabled, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        'flex h-6 w-6 items-center justify-center rounded-md border transition-colors duration-150 ' +
        (disabled
          ? 'cursor-not-allowed border-slate-rule bg-slate-sunk/70 text-white/15'
          : 'border-slate-rule bg-slate-sunk/80 text-white/60 hover:border-teal-400/50 hover:text-teal-300')
      }
    >
      {children}
    </button>
  )
}

export default function DraftRoom() {
  const engine = useEngine()
  useJukeTick(engine)
  const active = useHashActive('#/draft-room')
  // A direct, bookmarkable link to the locker — previously there was none:
  // the locker only ever showed as #/draft-room's own not-yet-entered
  // state, so a finished draft's grade had no way back to it once you'd
  // navigated anywhere else. Deliberately not folded into `active` itself
  // — the live-draft-only effects below (autopick, etc.) all gate on
  // `active` meaning specifically "on the live draft route", and widening
  // it would let them fire while looking at the locker instead.
  const draftsActive = useHashActive('#/drafts')

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('ALL')
  // Independent of posFilter rather than folded into it — "RB rookies I'm
  // watching" is a real combination someone would want, and a single-select
  // list can't hold three things that all have to be true at once.
  const [expBand, setExpBand] = useState('all') // 'all' | 'rookie' | 'veteran'
  const [watchlistOnly, setWatchlistOnly] = useState(false)
  const [showDrafted, setShowDrafted] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  /* The tray under the board has three positions, not two, and the middle
     one is the default — the same shape Sleeper's chevrons drive. `hidden`
     is the old isolate: board only, nothing underneath. `raised` gives the
     panels the room to read a long player list without leaving the board
     entirely.

     A boolean could not express this, and the old one lived in the header as
     a maximise icon — which is a control for a thing that is not the header.
     The chevrons sit on the board's own bottom-right corner instead, where
     the thing they move actually is. */
  const TRAY = ['hidden', 'default', 'raised']
  const [tray, setTray] = useState('default')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The seat, shared between the form's dropdown and the lobby board.
  const [lobbySlot, setLobbySlot] = useState(0)
  // Three screens, not two: Settings & Locker (league config, nothing
  // drafted yet, no board) -> choose a seat (the live page's own shell,
  // board in claimable mode) -> the live draft itself, gated by `started`
  // below. entered/! started is the middle one. Local and UI-only on
  // purpose — it says nothing about the actual draft, which is exactly why
  // it can't just be `!started` reused: a page refresh mid-"choosing a
  // seat" has nothing saved to resume into anyway, so there is no save to
  // desync from by starting back at the Locker.
  const [enteredRoom, setEnteredRoom] = useState(false)
  // Homepage v4 pass 0's lobby -> draft room sonar placement. Pressing
  // Start Draft flips this true; the poll effect below drops it once the
  // engine both reports started AND has real data loaded (players.js/
  // stats.js/draft-engine.js — see app.js's deferred-data boot and its
  // dataReady() bridge method), held to a 400ms floor. Distinct from
  // `started` itself: engine.startDraft() flips state.started
  // synchronously in app.js, before React has had a chance to paint
  // anything for it, and reaching #/draft-room at all almost always means
  // the deferred data landed long ago on the homepage — so this is mostly
  // the floor doing its job, not a real wait, but the brief's requirement
  // is unconditional ("every surface, always"), not "only when slow".
  const [starting, setStarting] = useState(false)
  const startingSinceRef = useRef(0)
  const START_TRANSITION_MIN_MS = 400
  // The one thing that can refuse the Start button, said beside it rather
  // than folded away — the rule the legacy setup screen already followed.
  const problem = engine ? engine.setupProblem() : ''
  // Recomputed each render rather than memoized: these change on every pick,
  // and state.picks is mutated in place so nothing here may be keyed on it.
  const filterCounts = engine ? engine.filterCounts() : null
  /* Who is sitting where, straight off the room's broadcast. viewFor() has
     already turned member ids into names before it leaves the server — a
     client that has never been told another member's id must not learn it
     from this screen. Null off-room: there is nobody else to show. */
  const roomSeats = (() => {
    const room = engine ? engine.room() : null
    return room && room.seats ? room.seats : null
  })()
  /* Functional update, not a read of `tray`. Written the obvious way first,
     and two quick clicks moved the tray one step: both handlers closed over
     the same render's `tray`, computed the same next position, and the
     second set it to where the first already had. The bug only shows up when
     somebody presses twice faster than a re-render, which is exactly how a
     person uses a chevron to go from raised straight to hidden. */
  const moveTray = (dir) => {
    setTray((current) => {
      const i = TRAY.indexOf(current)
      return TRAY[Math.min(TRAY.length - 1, Math.max(0, i + dir))]
    })
  }
  const isolate = tray === 'hidden'
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
  /* Decide / Board / Analysis — the Cockpit's own three tabs, driven by
     DraftCockpitHeader's tab nav now rather than a second strip inside
     the body (there was one, redundant with the header the moment the
     header grew tab buttons of its own). Decide is the default: for
     almost all of a draft you're either waiting or choosing, and the
     board is reference — see DraftDecideScreen.jsx and the handoff's own
     thesis. Board and Analysis keep the existing panels-below-the-fold
     layout (Queue/Roster/Chat/Log) unchanged; Decide owns its own full
     3-column layout instead, with nothing below it — its own roster rail
     and room-live rail already cover what those panels show. */
  const [view, setView] = useState('decide')
  const [menuOpen, setMenuOpen] = useState(false)
  /* Mirrors AppHeader.jsx's own soundOn state — engine.soundWanted() is
     not covered by the "juke:header" tick, since toggling it never
     touches renderHeader(). This page renders its own header
     (DraftRoomStatusBar, or LobbyBar pre-entry) rather than AppHeader, so
     it keeps its own copy of the same sync instead of reaching into that
     component. */
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
  // hasRoom() ("in a room") rather than inRoom() ("the socket is up right
  // now") — the same distinction CLAUDE.md's own dropped-socket section
  // draws, and the one that matters here: a guest whose socket blips
  // mid-draft is still in the room and must not be bounced back to the
  // locker just because roomActive flickered false for a reconnect.
  const hasRoomVal = engine ? engine.hasRoom() : false

  const started = engine ? !!engine.headerInfo().started : false
  // enteredRoom only ever gets set true by the "Enter Draft Room" button
  // (and the locker's own start-a-new-mock action) — there was no path
  // that set it when a draft became started any other way, which is
  // every path that matters more: resuming a saved draft, or a room
  // broadcast landing on a guest who joined the URL directly. Without
  // this, resuming from the locker flipped state.started but the screen
  // just kept showing the locker forever, since enteredRoom || !started
  // never followed. If a draft is genuinely running, "entered" is true
  // by definition — there's no state where started should be true and
  // this should still be showing Settings & Locker.
  useEffect(() => { if (started) setEnteredRoom(true) }, [started])
  // Polls the engine directly on rAF rather than waiting on another
  // "juke:header" tick: app.js's deferred-data retry (see the boot at its
  // foot) only re-runs refreshSetup() while state.started is still false,
  // so if the deferred files finish loading *after* Start Draft was
  // pressed, nothing re-dispatches that event and a listener keyed on it
  // would hang here forever. engine.headerInfo().started and
  // engine.dataReady() are read fresh every frame instead, independent of
  // whether app.js has any further reason to re-render.
  useEffect(() => {
    if (!starting || !engine) return
    let raf
    const check = () => {
      const ready = !!engine.headerInfo().started && engine.dataReady()
      const elapsed = performance.now() - startingSinceRef.current
      if (ready && elapsed >= START_TRANSITION_MIN_MS) { setStarting(false); return }
      raf = requestAnimationFrame(check)
    }
    raf = requestAnimationFrame(check)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [starting, engine])
  // A real invite link (#/draft-room?room=CODE) joins the room over the
  // socket the moment app.js boots — see joinRoom() in app.js — entirely
  // independently of this component's own local enteredRoom state. Without
  // this, a guest who clicked a friend's invite landed on "Your draft
  // locker / Nothing in progress / Start your first mock" instead of the
  // seats they were just invited to, and had to notice and press "Enter
  // Draft Room" themselves to see them. Joining a room is never a fresh
  // start, so it should never show the locker a fresh start shows.
  useEffect(() => { if (hasRoomVal) setEnteredRoom(true) }, [hasRoomVal])
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
  // PlayerHub's own sheet state, lifted here — see that file's own comment
  // on why. hubTab still defaults to 'players', the same reason PlayerHub's
  // local version used to: it's the tab that answers "what's available right
  // now" without picking a specific one of the five first. hubOpen does NOT
  // keep PlayerHub's old true default, though — that default only ever ran
  // on desktop, where lg:static means "open" is meaningless (the column is
  // just always there); mobile had no other view to default to instead, so
  // "open" cost nothing to leave true. Now Decide is that other view, and
  // defaulting the sheet open over top of it on every fresh entry would
  // bury the one tab the mobile handoff calls "the only tab needed to
  // actually draft" under the one that answers a different question.
  const [hubOpen, setHubOpen] = useState(false)
  const [hubTab, setHubTab] = useState('players')
  // The mobile draft-room tab bar's Roster/Players buttons open the sheet
  // pre-selected to a specific internal tab — 'team'/'players' map onto
  // PlayerHub's own TABS keys, not new vocabulary.
  //
  // Also steps view off 'decide', which is not a mobile-only add-on to what
  // desktop already does — it is what desktop already does. Decide owns the
  // whole content area on every width ("nothing renders underneath it," a
  // few lines below), so PlayerHub is only ever mounted inside the
  // view !== 'decide' branch there too; a wide window just makes that branch
  // easy to reach by clicking Board once. Below lg there was no way back
  // into that branch at all until this tab bar existed, which is exactly
  // why opening the sheet has to carry the same view change a Board click
  // already implies, not a new mobile-only rule.
  const openHub = (t) => { setHubTab(t); setHubOpen(true); setView((v) => (v === 'decide' ? 'board' : v)) }
  // Decide/Board also close the sheet, or tapping one while the other is
  // open leaves both true — the tab bar shows the new view as active while
  // the sheet is still visually sitting over the top of it, which reads as
  // the tap having done nothing.
  const selectMobileView = (v) => { setHubOpen(false); setView(v) }
  // Whether the sheet is actually on screen, which is not the same question
  // as whether hubOpen is true — PlayerHub only mounts in the view !== 'decide'
  // branch, so hubOpen alone can outlive the thing it describes.
  //
  // It gets there through DraftCockpitHeader's own tab nav, which is handed
  // the raw setView (openHub and selectMobileView are the two setters that
  // keep the pair in step; that is a third that doesn't). Its nav is
  // `md:flex` and MobileDraftTabBar is `lg:hidden`, so between 768px and
  // 1023px both are on screen at once: tap Roster in the bottom bar, then
  // Decide in the header, and the sheet unmounts while the bottom bar goes
  // on drawing Roster as the selected tab. CLAUDE.md's goToTab() note names
  // exactly this — "the app is then on a tab its own nav says it is not".
  //
  // Derived rather than a third flag, because two flags that must agree is
  // one flag with a second copy. Both consumers take this one: inside the
  // branch where PlayerHub mounts it is identical to hubOpen, so the sheet's
  // own behaviour is unchanged and desktop keeps its remembered tab across a
  // trip through Decide.
  const hubShowing = hubOpen && view !== 'decide'
  useEffect(() => {
    if (draftIsOver) {
      setInsightsSlot(mySlot)
      setShowInsights(true)
      // A design review caught the fallback underneath this overlay: the
      // Decide tab has nothing left to decide once the draft is over, and
      // was left selected showing a one-line dead end ("see the Board or
      // Analysis tab"). Whoever closes the overlay — or, in a room, a
      // guest who never got the auto-open because they were mid-navigation
      // when it fired — lands on Analysis instead, which has something to
      // show. The tab itself is hidden below once draftIsOver is true, so
      // this only matters as the one-time redirect off of Decide.
      setView((v) => (v === 'decide' ? 'analysis' : v))
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

  if (!(active || draftsActive) || !engine) return null

  // Takes priority over every branch below, including the entry screen
  // Start Draft was pressed from and the live board `started` now points
  // at — the loader is the thing standing between those two, not a state
  // alongside them. bg-slate matches the ground DraftLocker/DraftEntryScreen
  // already render on (see their own "fixed inset-0 ... bg-slate" shells
  // below); JukeMark's surface="app" is the negatives variant measured
  // against that exact hex (#1E2733, tailwind.config.js's slate.DEFAULT),
  // not "obsidian", which is the boot overlay's own void-page ground.
  if (starting) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-slate text-white">
        <SonarLoader tier="screen" surface="app" srLabel="Setting up your draft" style={{ height: '100%' }} />
      </div>
    )
  }

  // Enter takes you to #/draft-room whether you arrived here via that
  // route already or via the direct #/drafts link — location.hash is a
  // harmless no-op when it's already what it's being set to.
  const enterDraftRoom = () => {
    location.hash = '#/draft-room'
    setEnteredRoom(true)
  }

  // Before a draft exists, this is the exact same real form the setup
  // page uses — league size, scoring, pick clock, draft position, and its
  // own Resume/Discard for a save in progress — rather than this page
  // guessing at a seat and a clock length nobody chose.
  //
  // draftsActive forces this screen regardless of enteredRoom — it's the
  // direct link back to the locker, and has to win even mid-draft (the
  // chevron on the live status bar points here now); the enteredRoom sync
  // effect above is what makes leaving it via Resume land back on the
  // live board rather than stranding you here.
  if (draftsActive || !enteredRoom) {
    /* Settings & Locker, full bleed, board-free.

       This was three equal columns — Configure Draft, Draft with friends, and
       the Locker — under a claimable board. The columns went first (every
       setting in Configure Draft now lives on the settings modal's General
       tab, and Draft with friends is its Invite tab — keeping both would have
       been the same duplication as two randomise buttons, at the scale of a
       whole panel), and the board went second: picking a seat is a live-page
       question now (see the next block), so this screen answers only "what
       is this draft" and "what have I already drafted" — settings and the
       locker, exactly what it says on the tin.

       Resume and Discard were checked before the Configure column went:
       InProgressBand inside the Locker owns both, so a saved draft is
       still resumable. ConfigureDraftForm only ever read the save to pre-fill
       its own fields — it's gone now (nothing imported it anywhere in the
       app), which is also why DraftLocker's own empty-state CTA needed
       rewiring rather than continuing to scroll to a form that no longer
       exists.

       z-[60], not z-40: #root (Homepage) never unmounts — a separate React
       root behind this one, per main.jsx — and its own fixed header is z-50.
       z-40 would trap this whole overlay beneath it. */
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-slate text-white">
        <LobbyBar onOpenSettings={() => setSettingsOpen(true)} />

        {settingsOpen && (
          <DraftSettingsModal
            engine={engine}
            started={false}
            inRoom={roomActive}
            mySlot={lobbySlot}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {/* pb-[calc(58px+env(safe-area-inset-bottom))]: MobileAppTabBar's own
            fixed footprint, reserved on the scroll container the same way
            PlayerHub's mobile sheet already reserves its own clearance
            elsewhere in this file — never a fixed offset guessed
            independently of what's actually covering the content. lg: reverts
            to nothing, since the bar itself is lg:hidden. */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(58px+env(safe-area-inset-bottom))] lg:pb-0">
          {/* Host-only gating belongs on the real Start Draft action one
              screen further in, not here — anyone should be able to walk in
              and look at seats regardless of who the room says can actually
              begin it. Only a genuinely broken league config (problem) stops
              the launcher's own CTA from working, same rule LobbyBar used to
              enforce before this screen owned the action itself. */}
          <DraftLocker
            onStartNew={enterDraftRoom}
            problem={problem}
            lobbySlot={lobbySlot}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
        <MobileAppTabBar />
      </div>
    )
  }

  // Entered, but nobody's picked yet — the live page's own shell (see the
  // final return below, which this deliberately mirrors: same fixed
  // inset-0 overlay, same DraftRoomStatusBar) with the claimable board
  // standing in for the real one. It's the *same* DraftBoardGrid the draft
  // itself uses, in claimable mode, for the reason DraftLobby.jsx's own
  // comment already gives: a second board drawn just for this moment would
  // be a picture of the real one that's wrong the first time it changes.

  // Declared before the !started early return below — DraftCockpitHeader
  // shows a working Autopick toggle pre-draft too (Entry's own summary
  // row reads the same soloAutopick state), so this has to exist before
  // that branch can reach it. Room vs. solo really do mean different
  // things here — see the bridge comment on toggleRoomAutopilot in app.js
  // for why neither branch is a stand-in for the other.
  const handleToggleAutopick = () => {
    if (roomActive) engine.toggleRoomAutopilot()
    else setSoloAutopick((a) => !a)
  }

  if (!started) {
    const startLabel = roomActive
      ? (engine.isHost() ? 'Start for everyone' : 'Waiting for the host')
      : 'Start draft'

    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-slate text-white">
        <DraftCockpitHeader
          preDraft
          problem={problem}
          startLabel={startLabel}
          startDisabled={!!problem || (roomActive && !engine.isHost())}
          onStartDraft={() => {
            // Homepage v4 pass 0's lobby -> draft room loader — see the
            // starting state and its poll effect above. Timestamp before
            // the engine call, not after: startDraft() is synchronous, but
            // the 400ms floor is measured from the moment the reader acted,
            // not from whenever this closure happens to finish running.
            startingSinceRef.current = performance.now()
            setStarting(true)
            /* The clock comes from state, which is where it lives — the
               settings modal writes it through setClockLength(). Reading it
               here rather than holding a second copy is what stopped the
               modal's control being decorative. */
            engine.startDraft({ mySlot: lobbySlot, clockLength: engine.clockLength() })
          }}
          autopick={soloAutopick}
          onToggleAutopick={handleToggleAutopick}
          onOpenMenu={() => setSettingsOpen(true)}
        />

        {settingsOpen && (
          <DraftSettingsModal
            engine={engine}
            started={false}
            inRoom={roomActive}
            mySlot={lobbySlot}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {/* pt-[62px] matches DraftCockpitHeader's own height — see its own
            comment on why 62px isn't a Tailwind step and has to be
            matched exactly rather than rounded. No md: step-up any more:
            that used to add the ticker strip's own 6-unit band, which a
            design review had removed from the Draft Room entirely (it
            fought the pick clock directly beneath it). */}
        {/* overflow-hidden only from lg, where the three columns are sized
            to the viewport and each scrolls internally. Below lg the entry
            screen stacks to roughly 1520px, and this branch renders no
            bottom tab bar to reserve clearance for, so it just scrolls.
            Without this the screen was clipped at the fold with no way to
            reach the rest of it. */}
        <div className="flex flex-1 flex-col overflow-y-auto pt-[62px] lg:overflow-hidden">
          <DraftEntryScreen
            engine={engine}
            league={league}
            /* -1 while we are in a room whose seats have not arrived yet.
               mySlot is a leftover from before the room existed, so falling
               back to it draws "You" on seat 0 for a guest who is actually
               sitting somewhere else — briefly, but it is a chair with the
               wrong person's name on it, and the room is about to say so.
               No seat is better than the wrong seat. */
            mySlot={roomActive ? (roomSeats ? mySlot : -1) : lobbySlot}
            roomActive={roomActive}
            seats={roomSeats}
            soloAutopick={soloAutopick}
            onOpenSettings={() => setSettingsOpen(true)}
            onClaimSeat={(seat) => {
              // In a room the room decides; off-room this is just my chair.
              if (roomActive) engine.claimSeat(seat)
              else setLobbySlot(seat)
            }}
          />
        </div>
      </div>
    )
  }

  const code = onClock && DE ? DE.pickCode(overall, league.teams) : null

  // "If you wait" means past *this* pick — when it's genuinely my turn,
  // nextPicksFor(mySlot, 1) returns the pick I'm on right now (trivial: of
  // course he's still there before anyone's picked yet), not the one after
  // it. Skip my own current pick in that case; when it's someone else's
  // turn, my own next pick is already the right question to ask. Lifted
  // here from DraftDecideScreen.jsx, which used to compute this itself —
  // PickClockBand needs the identical value above the tab strip on every
  // tab, not just Decide, and a second copy of an off-by-one that already
  // cost one design-review round to fix is exactly the risk "nothing about
  // the league shape may be written down twice" exists to prevent.
  const upcoming = engine.nextPicksFor(mySlot, 2)
  const nextOverall = myTurn ? (upcoming[1] ?? null) : (upcoming[0] ?? null)
  // Same skip, same reason — a design review caught this exact rail
  // printing the pick already on the clock as though it were still ahead of
  // you ("1.11 · 2.02 · 3.11" while 1.11 was the live pick).
  const nextPicks = myTurn ? engine.nextPicksFor(mySlot, 5).slice(1) : engine.nextPicksFor(mySlot, 4)

  // DraftCockpitHeader composes its own "Round N · Pick N · your turn"
  // caption straight from onClock/overall/myTurn (below) rather than
  // reading headerInfo()'s pre-formatted statusLine/rightLabel/rightValue
  // strings — those were shaped for the old two-line bar's different
  // slots. urgent is the one field still worth reading off headerInfo()
  // itself: isMyTurn()'s own clock-under-10s check, not re-derived here.
  const urgent = !!engine.headerInfo().urgent

  // Same gating renderActionBar() already uses in app.js: Undo is
  // solo-only (a room's copy just gets overwritten by the next
  // broadcast — see the bridge comment on `undo`), Pause is the host's in
  // a room, and both disappear once the draft is over. Discard/"Leave the
  // room" stays offered either way; only its label and danger styling
  // change. draftIsOver itself is computed above the early returns, where
  // the insights effect needs it. hasRoomVal itself is computed further up,
  // above the early returns — the enteredRoom sync effect needs it there.
  const showUndo = !draftIsOver && !hasRoomVal

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

  // Undo/Pause/Discard are all real, direct calls into app.js — undo()
  // pops picks off state.picks until it's my turn again, togglePause()
  // stops the clock (or sends Live.pause() in a room), and restart() is
  // clearSave()+goHome(), the exact "Discard draft"/"Leave the room"
  // action. None of them are reimplemented here.
  const handleUndo = () => engine.undo()
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
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate text-white">
      {/* DraftCockpitHeader is the fixed top bar for this view now — it
          carries the brand/ticker Header.jsx used to own here, consolidated
          with the round/pick/clock/autopick/tab-nav controls into one
          62px row. Header.jsx itself is untouched and still fixed-h-16 on
          the homepage — neither pre-draft screen in this file renders it
          either (LobbyBar and this same header in its preDraft mode are
          their own bars, not Header reused). */}
      <DraftCockpitHeader
        cockpitTab={view}
        onSelectTab={setView}
        round={onClock ? onClock.round : null}
        overall={overall}
        code={code}
        myTurn={myTurn}
        urgent={urgent}
        over={draftIsOver}
        clockLength={engine.clockLength()}
        timeLeft={engine.timeLeft()}
        autopick={autopick}
        onToggleAutopick={handleToggleAutopick}
        onOpenMenu={() => setMenuOpen(true)}
      />
      {menuOpen && (
        <DraftMenuOverlay
          engine={engine}
          onClose={() => setMenuOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          inRoom={roomActive}
          isHost={roomActive && engine.isHost()}
          clockLength={engine.clockLength()}
          paused={engine.paused()}
          onTogglePause={() => engine.togglePause()}
          showFinish={!roomActive && !draftIsOver}
          onFinish={() => engine.autoDraftRest()}
          showUndo={showUndo}
          onUndo={handleUndo}
          soundOn={soundOn}
          onToggleSound={handleToggleSound}
          discardLabel={hasRoomVal ? 'Leave the room' : 'Discard draft'}
          discardDanger={!hasRoomVal}
          onDiscard={handleDiscard}
        />
      )}
      {/* pt-[62px] matches DraftCockpitHeader's own height — the ticker strip
          that used to add an md: step-up here is gone, removed from the
          Draft Room entirely per a design review (it fought the pick
          clock directly beneath it). No bottom
          padding here: PlayerHub's mobile sheet is `fixed` and so occupies
          no space in this flow — clearance for it is reserved inside the
          scrollable panels themselves (the board's and the player list's
          own pb-28), and reserving it here too would shrink the row for
          no reason. */}
      <div className="flex flex-1 flex-col overflow-hidden pt-[62px]">
        <PickClockBand
          code={code}
          myTurn={myTurn}
          urgent={urgent}
          timeLeft={engine.timeLeft()}
          clockLength={engine.clockLength()}
          nextOverall={nextOverall}
          nextPicks={nextPicks}
          overall={overall}
          teams={league.teams}
          onClock={onClock}
        />
        {view === 'decide' ? (
          /* Decide owns the whole content area, not half of it — its own
             roster rail and room-live rail already cover what the panels
             below the board show for Board/Analysis, so nothing renders
             underneath it. Board and Analysis keep the existing
             board-plus-panels layout exactly as it already worked. */
          <DraftDecideScreen
            engine={engine}
            league={league}
            mySlot={mySlot}
            myTurn={myTurn}
            picks={picks}
            onDraft={handleDraft}
            onQueueToggle={handleToggleQueue}
            onOpenProfile={setSelectedPlayer}
            queuedNames={queuedNames}
            nextOverall={nextOverall}
            nextPicks={nextPicks}
            /* The same openHub MobileDraftTabBar's Roster and Players
               buttons call. Decide's mobile roster strip and its "Browse
               all N players" button are two more ways into the one
               PlayerHub sheet, not a second player surface — passing the
               opener rather than letting that screen mount its own is what
               keeps that true. */
            onOpenHub={openHub}
          />
        ) : (
        <>
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
          {/* Board / Analysis tab switching moved to DraftCockpitHeader's
              own tab nav — this used to be a second, redundant strip right
              here, doing the same job the header now does above it. */}
          <div
            className={
              'relative flex min-h-0 min-w-0 flex-1 ' +
              (tray === 'hidden'
                ? 'lg:flex-1'
                : tray === 'raised'
                  ? 'lg:flex-none lg:h-[30%]'
                  : 'lg:flex-none lg:h-[45%]')
            }
          >
            {view === 'analysis' ? (
              // onClose: the report's own "Close" exit action. Analysis is a
              // tab, not a modal, so dismissing it means switching tabs —
              // Board is the obvious landing spot, the same content this
              // strip shows for every other tab.
              <AnalysisTab engine={engine} league={league} picks={picks} mySlot={mySlot} onClose={() => setView('board')} />
            ) : (
            <DraftBoardGrid
              shortNameOf={engine.shortName}
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
              // Mobile only (DraftBoardGrid gates the button itself with
              // lg:hidden) — opens the same PlayerHub sheet the bottom tab
              // bar's Roster/Players buttons already reach into, just
              // pre-selected to its Log tab instead of building a second,
              // one-off sheet for the same content.
              onOpenLog={() => openHub('log')}
            />
            )}

            {/* The tray control, on the board rather than in the header,
                because the board is the thing it moves. Desktop only: below
                lg the panels are a fixed bottom sheet with its own tab bar,
                so there is no tray here to raise or hide.

                Two buttons rather than one cycling button — a single control
                that wraps around from hidden back to raised is the kind of
                thing you have to press three times to learn. Each is disabled
                at its own end of the range, which is also what tells you the
                range exists. */}
            <div className="absolute bottom-3 right-3 z-10 hidden flex-col gap-1 lg:flex">
              <TrayButton
                onClick={() => moveTray(1)}
                disabled={tray === 'raised'}
                title="Show more of the list"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </TrayButton>
              <TrayButton
                onClick={() => moveTray(-1)}
                disabled={tray === 'hidden'}
                title={tray === 'default' ? 'Hide the list' : 'Show less of the list'}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </TrayButton>
            </div>
          </div>

          {/* The panel row. flex-none below lg with no in-flow children —
              PlayerHub is `fixed` there — so it collapses to nothing and
              the board keeps the whole column; lg:flex-1 gives it the
              other half of the screen at desktop width. It cannot be
              `hidden` below lg: display:none on the parent would hide
              PlayerHub's fixed sheet too, which is the whole mobile UI. */}
          <div
            className={
              'flex min-h-0 flex-none border-slate-rule ' +
              (isolate ? 'lg:hidden' : 'lg:flex-1 lg:border-t')
            }
          >
            {/* Players — the widest panel, as it is on Sleeper: it carries
                the search, the filter chips, the sortable grid and the
                profile drawer that slides over it. */}
            <div className="relative flex min-h-0 flex-1 lg:flex-[5] lg:min-w-0">
            <PlayerHub
              open={hubShowing}
              onOpenChange={setHubOpen}
              tab={hubTab}
              onTabChange={setHubTab}
          counts={filterCounts}
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
              draftOver={draftIsOver}
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
        </>
        )}
      </div>

      <MobileDraftTabBar
        view={view}
        onSelectView={selectMobileView}
        hubOpen={hubShowing}
        hubTab={hubTab}
        onOpenHub={openHub}
        draftIsOver={draftIsOver}
      />

      {/* Opens itself on the draft-over edge (see the effect near the top)
          and closes to the board, leaving a pill to reopen — the analysis
          is the most valuable screen in the app (CLAUDE.md: the last pick
          lands and it opens itself), so it must never be more than one
          press away from a finished board. z-[65] for the pill keeps it
          above the fixed status bar (z-50); the dashboard itself is z-[70],
          over everything in this view. */}
      {settingsOpen && (
        <DraftSettingsModal
          engine={engine}
          started={started}
          inRoom={roomActive}
          mySlot={mySlot}
          onClose={() => setSettingsOpen(false)}
        />
      )}

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
          className="fixed left-1/2 top-16 z-[65] -translate-x-1/2 rounded-full border border-teal-400/40 bg-slate-sunk px-4 py-1.5 text-xs font-semibold text-teal-300 backdrop-blur transition-colors duration-200 hover:border-teal-400 hover:bg-teal-400/10"
        >
          Draft Insights
        </button>
      )}
    </div>
  )
}
