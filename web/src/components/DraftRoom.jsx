import { useEffect, useReducer, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
import DraftSettingsModal from './DraftSettingsModal.jsx'
import DraftLobby from './DraftLobby.jsx'
import LobbyBar from './LobbyBar.jsx'

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
          ? 'cursor-not-allowed border-slate-800 bg-slate-950/70 text-white/15'
          : 'border-slate-700 bg-slate-950/80 text-white/60 hover:border-teal-400/50 hover:text-teal-300')
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
  /* Board / Analysis, from the remote branch: Suggestions and Players are
     already merged into the player list, and Queue/Roster/Log have their
     own panels, so Analysis was the last legacy tab with no home in this
     layout. It toggles what the board area shows, not a whole view. */
  const [view, setView] = useState('board')
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

  if (!(active || draftsActive) || !engine) return null

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
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#0B0E14] text-white">
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

        <div className="min-h-0 flex-1 overflow-y-auto">
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
  if (!started) {
    const startLabel = roomActive
      ? (engine.isHost() ? 'Start for everyone' : 'Waiting for the host')
      : 'Start draft'

    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#0B0E14] text-white">
        <DraftRoomStatusBar
          preDraft
          problem={problem}
          startLabel={startLabel}
          startDisabled={!!problem || (roomActive && !engine.isHost())}
          onStartDraft={() => {
            /* The clock comes from state, which is where it lives — the
               settings modal writes it through setClockLength(). Reading it
               here rather than holding a second copy is what stopped the
               modal's control being decorative. */
            engine.startDraft({ mySlot: lobbySlot, clockLength: engine.clockLength() })
          }}
          onOpenSettings={() => setSettingsOpen(true)}
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

        {/* pt-14/md:pt-20 matches the live board's own offset below — this
            is the same DraftRoomStatusBar with the same fixed height and
            the same ticker strip at md+, so the clearance it needs is
            identical. */}
        <div className="flex flex-1 flex-col overflow-hidden px-3 pb-3 pt-14 md:pt-20 lg:px-4">
          <DraftLobby
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
            fill
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
          and still fixed-h-16 on the homepage — neither pre-draft screen in
          this file renders it either (LobbyBar and this same
          DraftRoomStatusBar in its preDraft mode are their own bars, not
          Header reused), which is why this branch's pt- offset (h-14) has
          never matched Header's own (h-16). */}
      <DraftRoomStatusBar
        onOpenSettings={() => setSettingsOpen(true)}
        /* Off-room only. In a room this same engine function toggles the
           autopilot on your own chair, which the Autopick switch beside it
           already is — two controls for one thing is the duplication this
           file keeps having to undo. */
        showFinish={!roomActive && !draftIsOver}
        onFinish={() => engine.autoDraftRest()}
        roundText={roundText}
        code={code}
        rightLabel={rightLabel}
        rightValue={rightValue}
        myTurn={myTurn}
        urgent={urgent}
        autopick={autopick}
        onToggleAutopick={handleToggleAutopick}
        showUndo={showUndo}
        onUndo={handleUndo}
        discardLabel={hasRoomVal ? 'Leave the room' : 'Discard draft'}
        discardDanger={!hasRoomVal}
        onDiscard={handleDiscard}
        soundOn={soundOn}
        onToggleSound={handleToggleSound}
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
              'relative flex min-h-0 min-w-0 flex-1 ' +
              (tray === 'hidden'
                ? 'lg:flex-1'
                : tray === 'raised'
                  ? 'lg:flex-none lg:h-[30%]'
                  : 'lg:flex-none lg:h-[45%]')
            }
          >
            {view === 'analysis' ? (
              <AnalysisTab engine={engine} league={league} picks={picks} mySlot={mySlot} />
            ) : (
            <DraftBoardGrid
              rosterOf={(slot) => engine.rosterStrip(slot)}
              photoFor={photoFor}
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
              'flex min-h-0 flex-none border-slate-800 ' +
              (isolate ? 'lg:hidden' : 'lg:flex-1 lg:border-t')
            }
          >
            {/* Players — the widest panel, as it is on Sleeper: it carries
                the search, the filter chips, the sortable grid and the
                profile drawer that slides over it. */}
            <div className="relative flex min-h-0 flex-1 lg:flex-[5] lg:min-w-0">
            <PlayerHub
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
          className="fixed left-1/2 top-16 z-[65] -translate-x-1/2 rounded-full border border-teal-400/40 bg-slate-950/90 px-4 py-1.5 text-xs font-semibold text-teal-300 shadow-[0_0_15px_rgba(0,229,255,0.2)] backdrop-blur transition-colors duration-200 hover:border-teal-400 hover:bg-teal-400/10"
        >
          Draft Insights
        </button>
      )}
    </div>
  )
}
