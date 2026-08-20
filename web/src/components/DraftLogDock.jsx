import { useEffect, useReducer, useState } from 'react'
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
  { key: 'chat', label: 'Chat' },
  { key: 'log', label: 'Draft Log' },
]

function TabContent({ tab, engine, recentOthers, DE, league }) {
  if (tab === 'chat') return <ChatPlaceholder />
  return <ActivityLog picks={recentOthers} engine={engine} DE={DE} league={league} />
}

// Desktop (lg+) only now — the mobile equivalent of My Queue/Team/Chat
// lives in PlayerHub.jsx's bottom sheet instead (see its own comment on
// why this and RosterDock each shrank to lg+-only as part of that pass).
// A real column beside the board and the queue, not a float over them.
export default function DraftLogDock() {
  const engine = useEngine()
  useJukeTick(engine)
  const [tab, setTab] = useState('chat')

  if (!engine) return null

  const DE = typeof window !== 'undefined' ? window.DraftEngine : null
  const league = engine.league()
  const picks = engine.picks() || []
  const mySlot = engine.mySlot() ?? 0

  // "Made by the AI" — everyone else's picks, most recent first. In a
  // room some of those seats are other people, not CPUs, but "not my
  // seat" is still the honest, real filter: there's no per-pick flag
  // saying whether a seat was auto-played at the moment it picked.
  const recentOthers = picks
    .filter((p) => p.slot !== mySlot)
    .slice(-10)
    .reverse()

  /* The fourth panel in the desktop row. Chat and the activity log share
     it as two tabs rather than taking a column each: chat is the one that
     needs real height (see the layout note in DraftRoom) and the log is
     read in glances. Queue is not a tab here any more — it has its own
     panel now — so this is Chat first, Log second.

     No card chrome of its own: SidePanel around it already draws the
     border, the ground and the title, and nesting a second rounded card
     inside that was two borders describing one thing. */
  return (
    <div className="flex h-full w-full min-h-0 flex-col border-r border-slate-800 bg-slate-900/40 last:border-r-0">
      <div className="flex shrink-0 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'flex-1 border-b-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150 ' +
              (tab === t.key ? 'border-teal-400 text-teal-300' : 'border-transparent text-white/40 hover:text-white/60')
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <TabContent tab={tab} engine={engine} recentOthers={recentOthers} DE={DE} league={league} />
      </div>
    </div>
  )
}
