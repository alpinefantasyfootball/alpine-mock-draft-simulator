import { useEffect, useReducer, useRef, useState } from 'react'
import Header from './Header.jsx'
import ConfigureDraftForm from './ConfigureDraftForm.jsx'
import DraftRoomStatusBar from './DraftRoomStatusBar.jsx'
import DraftBoardGrid from './DraftBoardGrid.jsx'
import PlayerQueueSidebar from './PlayerQueueSidebar.jsx'
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
    return (
      <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#0B0E14] pt-16 text-white">
        <Header />
        <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-6 py-10">
          <ConfigureDraftForm />
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

  const availablePlayers = board
    .filter((p) => !p.drafted)
    .filter((p) => posFilter === 'ALL' || p.pos === posFilter)
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.overall - b.overall)

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

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0B0E14] text-white">
      <Header />
      <div className="flex flex-1 flex-col overflow-hidden pt-16">
        <DraftRoomStatusBar
          roundText={roundText}
          code={code}
          rightLabel={rightLabel}
          rightValue={rightValue}
          myTurn={myTurn}
          urgent={urgent}
          autopick={autopick}
          onToggleAutopick={handleToggleAutopick}
        />

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <DraftBoardGrid
            league={league}
            picks={picks}
            mySlot={mySlot}
            onClock={onClock}
            teamLabelOf={(slot) => engine.teamLabel(slot)}
          />
          <PlayerQueueSidebar
            players={availablePlayers}
            search={search}
            onSearch={setSearch}
            posFilter={posFilter}
            onPosFilter={setPosFilter}
            pointsFor={pointsFor}
            valueFor={valueFor}
            onDraft={handleDraft}
            myTurn={myTurn}
          />
        </div>

        <RosterDock lineup={lineup} benchSize={league.bench} />
      </div>
    </div>
  )
}
