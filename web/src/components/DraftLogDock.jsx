import { useEffect, useReducer, useState } from 'react'
import { ListChecks } from 'lucide-react'
import QueueList from './QueueList.jsx'
import ActivityLog from './ActivityLog.jsx'
import ChatPlaceholder from './ChatPlaceholder.jsx'

function useEngine() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.JukeEngine) setReady(true)
  }, [])
  return ready ? window.JukeEngine : null
}

function useJukeTick(engine) {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    if (!engine) return
    window.addEventListener('juke:header', force)
    return () => window.removeEventListener('juke:header', force)
  }, [engine])
}

const TABS = [
  { key: 'queue', label: 'My Queue' },
  { key: 'log', label: 'Draft Log' },
  { key: 'chat', label: 'Chat' },
]

function TabContent({ tab, queuePlayers, myTurn, engine, recentOthers, DE, league }) {
  if (tab === 'chat') return <ChatPlaceholder />
  if (tab === 'queue') {
    return <QueueList players={queuePlayers} myTurn={myTurn} engine={engine} />
  }
  return <ActivityLog picks={recentOthers} engine={engine} DE={DE} league={league} />
}

// Desktop (lg+) only now — the mobile equivalent of My Queue/Team/Chat
// lives in PlayerHub.jsx's bottom sheet instead (see its own comment on
// why this and RosterDock each shrank to lg+-only as part of that pass).
// A real column beside the board and the queue, not a float over them.
export default function DraftLogDock() {
  const engine = useEngine()
  useJukeTick(engine)
  const [tab, setTab] = useState('queue')

  if (!engine) return null

  const DE = typeof window !== 'undefined' ? window.DraftEngine : null
  const league = engine.league()
  const picks = engine.picks() || []
  const board = engine.board() || []
  const mySlot = engine.mySlot() ?? 0
  const onClock = league && DE ? DE.onTheClock(league, picks.length) : null
  const myTurn = !!onClock && onClock.slot === mySlot

  // The real queue — state.queue is an array of player names, resolved
  // back to board players the same way the legacy rail does. Not a
  // separate "favorites" list: queueTop() is what autoPickForMe() and a
  // clock-expiry pick already prefer over the model's own opinion, so
  // starring someone here is the actual plan, not decoration.
  const queueNames = engine.queue() || []
  const queuePlayers = queueNames.map((name) => board.find((p) => p.name === name)).filter(Boolean)

  // "Made by the AI" — everyone else's picks, most recent first. In a
  // room some of those seats are other people, not CPUs, but "not my
  // seat" is still the honest, real filter: there's no per-pick flag
  // saying whether a seat was auto-played at the moment it picked.
  const recentOthers = picks
    .filter((p) => p.slot !== mySlot)
    .slice(-10)
    .reverse()

  return (
    <div className="hidden h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 lg:flex">
      <div className="flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold text-white">
        <ListChecks className="h-4 w-4 text-teal-400" />
        Draft Log &amp; Queue
      </div>
      <div className="flex shrink-0 border-t border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'flex-1 border-b-2 px-3 py-2 text-xs font-semibold transition-colors duration-150 ' +
              (tab === t.key ? 'border-teal-400 text-teal-300' : 'border-transparent text-white/40 hover:text-white/60')
            }
          >
            {t.label}
            {t.key === 'queue' && queuePlayers.length > 0 ? ` (${queuePlayers.length})` : ''}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <TabContent tab={tab} queuePlayers={queuePlayers} myTurn={myTurn} engine={engine} recentOthers={recentOthers} DE={DE} league={league} />
      </div>
    </div>
  )
}
