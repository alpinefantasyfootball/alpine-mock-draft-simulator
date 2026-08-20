import { useEffect, useReducer, useRef, useState } from 'react'
import Header from './Header.jsx'
import ConfigureDraftForm from './ConfigureDraftForm.jsx'
import RoomPanel from './RoomPanel.jsx'
import DraftLogDock from './DraftLogDock.jsx'
import DraftRoomStatusBar from './DraftRoomStatusBar.jsx'
import DraftBoardGrid from './DraftBoardGrid.jsx'
import PlayerQueueSidebar, { SORT_DEFAULT_DIR } from './PlayerQueueSidebar.jsx'
import PlayerProfileDrawer from './PlayerProfileDrawer.jsx'
import RosterDock from './RosterDock.jsx'

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
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  // Below lg, the board and the queue are two exclusive full-width views
  // ("Draft Hub" / "Full Board") switched by a segmented control, rather
  // than the board always showing with the queue as an on-demand overlay
  // sheet — a 10-column grid is what a phone opens onto first is exactly
  // the pinch-zoom problem this replaces. 'hub' is the default: the thing
  // a manager needs most (who to draft) shouldn't cost a tap to reach. At
  // lg+ this is never read — both panels are always visible side by side.
  const [mobileView, setMobileView] = useState('hub')
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
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-stretch gap-6 px-6 py-10 lg:flex-row">
          <div className="lg:basis-1/2">
            <ConfigureDraftForm />
          </div>
          <div className="lg:basis-1/2">
            <RoomPanel />
          </div>
        </div>
        <DraftLogDock />
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
  // change.
  const draftIsOver = engine.draftOver()
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
  const availablePlayers = board
    .filter((p) => !p.drafted)
    .filter((p) => {
      if (posFilter === 'ALL') return true
      if (posFilter === 'FLEX') return flexPositions.includes(p.pos)
      return p.pos === posFilter
    })
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'board') return a.overall - b.overall
      // Reuse the exact same readers the grid cells render from (pointsFor/
      // valueFor), so a sort can never disagree with what's on screen.
      const reader = sortBy === 'adp' ? (p) => p.adp : sortBy === 'pts' ? pointsFor : valueFor
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
  const queuedNames = new Set(engine.queue() || [])
  const handleToggleQueue = (name) => engine.queueToggle(name)

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
      />
      {/* pt-14 matches DraftRoomStatusBar's own h-14; md:pt-20 adds the
          6-unit ticker strip (top-14, h-6) that only exists at md+ — see
          the comment on that strip in DraftRoomStatusBar.jsx. No bottom
          padding here for RosterDock: it's `fixed` below lg now (see its
          own comment) rather than sitting in this flow, so clearance for
          its collapsed strip is reserved inside each scrollable panel
          instead (DraftBoardGrid's and PlayerQueueSidebar's own pb-28) —
          reserving it here too would just shrink the row for no reason,
          since a fixed element doesn't actually occupy space in it. */}
      <div className="flex flex-1 flex-col overflow-hidden pt-14 md:pt-20">
        {/* Draft Hub / Full Board — below lg only. A phone that opened
            straight onto a 10-column grid is the exact "pinch-zoom
            frustration" this whole pass exists to fix, so the two views
            are equal, explicit tabs rather than one primary view and one
            you have to discover. Not sticky: it's the top of the content,
            not a persistent nav bar, so it scrolls with the rest — the
            segmented control itself is the "you are here", and switching
            back is one tap up regardless. */}
        <div className="flex shrink-0 justify-center border-b border-slate-800 bg-slate-900/60 p-2 lg:hidden">
          <div className="inline-flex rounded-full border border-slate-800 bg-slate-950/60 p-1">
            {[
              { key: 'hub', label: 'Draft Hub' },
              { key: 'board', label: 'Full Board' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMobileView(tab.key)}
                aria-pressed={mobileView === tab.key}
                className={
                  'rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-150 ' +
                  (mobileView === tab.key ? 'bg-teal-500 text-obsidian' : 'text-white/50')
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* board and queue are two exclusive full-width views below lg
              (via mobileView) and the same always-visible side-by-side
              split at lg+ (mobileView is never read there) — same "one
              mount, repositioned by breakpoint, not duplicated" reasoning
              as the old overlay sheet this replaced: PlayerQueueSidebar's
              rows share layoutIds with DraftBoardGrid's cells for the
              queue-to-board FLIP transition, and a second mounted copy
              would collide with the first even if CSS-hidden — so this
              hides with `hidden`, which un-mounts nothing, rather than by
              conditionally rendering either side out of the tree. */}
          {/* min-w-0 is load-bearing: DraftBoardGrid's own content is
              min-w-max (every column at its real width, deliberately
              wider than any viewport so it can scroll). A flex item's
              "automatic minimum size" is normally content-based unless
              *that item itself* has overflow set — DraftBoardGrid has
              overflow-x-auto, but this wrapper around it doesn't, so
              without min-w-0 the wrapper refused to shrink below ~1900px
              of grid content and pushed the queue panel off the right
              edge of the screen entirely at lg+. Measured: the queue
              wrapper was rendering at x:1894 on a 1345px-wide viewport. */}
          <div className={(mobileView === 'board' ? 'flex' : 'hidden') + ' min-h-0 min-w-0 flex-1 lg:flex lg:flex-[7]'}>
            <DraftBoardGrid
              league={league}
              picks={picks}
              mySlot={mySlot}
              onClock={onClock}
              teamLabelOf={(slot) => engine.teamLabel(slot)}
            />
          </div>

          <div className={(mobileView === 'hub' ? 'relative flex min-h-0 flex-1' : 'hidden') + ' lg:relative lg:flex lg:flex-[3] lg:min-w-[280px]'}>
            <PlayerQueueSidebar
              players={availablePlayers}
              search={search}
              onSearch={setSearch}
              posFilter={posFilter}
              onPosFilter={setPosFilter}
              pointsFor={pointsFor}
              valueFor={valueFor}
              photoFor={photoFor}
              initialsFor={initialsFor}
              onDraft={handleDraft}
              myTurn={myTurn}
              queuedNames={queuedNames}
              onToggleQueue={handleToggleQueue}
              onSelectPlayer={setSelectedPlayer}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              recommended={recommended}
              recommendedVorp={recommendedVorp}
              recommendedTierLeft={recommendedTierLeft}
            />
            <PlayerProfileDrawer
              player={selectedPlayer}
              onClose={() => setSelectedPlayer(null)}
              photoFor={photoFor}
              initialsFor={initialsFor}
              pointsFor={pointsFor}
              valueFor={valueFor}
            />
          </div>
        </div>

        <RosterDock lineup={lineup} benchSize={league.bench} />
      </div>
      <DraftLogDock />
    </div>
  )
}
