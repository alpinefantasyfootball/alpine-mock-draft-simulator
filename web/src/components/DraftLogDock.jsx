import { useState } from 'react'
import { useEngine, useJukeTick } from '../hooks/useJukeEngine.js'
import ActivityLog from './ActivityLog.jsx'
import ChatPlaceholder from './ChatPlaceholder.jsx'

const TABS = [
  { key: 'chat', label: 'Chat' },
  { key: 'log', label: 'Log' },
  { key: 'picks', label: 'Picks' },
]

/* The full pick history — every pick, own included, most recent first,
   with a "Round N" divider wherever the round changes. Deliberately
   separate from the Log tab's feed: that one is a narrow activity ticker
   (last 10, other seats only), and this is the record. One pass, no
   separate grouping structure, matching renderPicks() in app.js. */
function buildPickItems(picks) {
  const items = []
  let lastRound = null
  picks.slice().reverse().forEach((pick) => {
    if (pick.round !== lastRound) {
      items.push({ type: 'divider', round: pick.round })
      lastRound = pick.round
    }
    items.push({ type: 'pick', pick })
  })
  return items
}

function PicksList({ items, engine, DE, league, mySlot }) {
  if (items.length === 0) {
    return <p className="px-2 py-6 text-center text-xs text-white/30">No picks yet.</p>
  }
  return items.map((item) =>
    item.type === 'divider' ? (
      <p
        key={'round-' + item.round}
        className="mb-1 mt-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-white/30 first:mt-0"
      >
        Round {item.round}
      </p>
    ) : (
      /* Gold on your own picks — identity, the same mark the board's
         column ring uses, and never as text colour (CLAUDE.md: #FFD166
         is 1.4:1 as type on a light card). A left border and a wash. */
      <p
        key={item.pick.overall}
        className={
          'mb-1.5 rounded-md border-l-2 px-2 py-1 text-xs leading-relaxed ' +
          (item.pick.slot === mySlot
            ? 'border-l-[#FFD166] bg-[#FFD166]/5 text-white/80'
            : 'border-l-transparent text-white/60')
        }
      >
        <span className="text-white/30">
          {DE ? DE.pickCode(item.pick.overall, league.teams) : item.pick.overall}
        </span>{' '}
        <span className="font-medium text-white/80">{engine.teamLabel(item.pick.slot)}</span> took{' '}
        <span className="text-white/90">{item.pick.player.name}</span>{' '}
        <span className="text-white/30">({item.pick.player.pos})</span>
      </p>
    )
  )
}

function TabContent({ tab, engine, recentOthers, pickItems, DE, league, mySlot }) {
  if (tab === 'chat') return <ChatPlaceholder />
  if (tab === 'picks') {
    return <PicksList items={pickItems} engine={engine} DE={DE} league={league} mySlot={mySlot} />
  }
  return <ActivityLog picks={recentOthers} engine={engine} DE={DE} league={league} />
}

// Desktop (lg+) only — the mobile equivalents of these tabs live in
// PlayerHub.jsx's bottom sheet instead. A real column in the panel row
// beside the board, not a float over it, so it draws no card chrome of
// its own: DraftRoom's row already gives it a border and a ground.
export default function DraftLogDock({ recentOthers }) {
  const engine = useEngine()
  useJukeTick(engine)
  // 'log', not 'chat' — chat is ChatPlaceholder (a deliberate stub; the
  // real messages land in a follow-up pass), so opening here by default
  // put an empty "coming soon" panel in front of the two tabs that show
  // real, working data. PlayerHub.jsx's mobile tab strip defaults to
  // 'players' for the same reason: don't default onto the one tab with
  // nothing in it yet.
  const [tab, setTab] = useState('log')

  if (!engine) return null

  const DE = typeof window !== 'undefined' ? window.DraftEngine : null
  const league = engine.league()
  const picks = engine.picks() || []
  const mySlot = engine.mySlot() ?? 0
  const pickItems = buildPickItems(picks)

  return (
    <div className="flex h-full w-full min-h-0 flex-col border-r border-slate-800 bg-slate-900/40 last:border-r-0">
      <div className="flex shrink-0 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'flex-1 border-b-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150 ' +
              (tab === t.key ? 'border-teal-400 text-teal-300' : 'border-transparent text-white/40 hover:text-white/60')
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <TabContent
          tab={tab}
          engine={engine}
          recentOthers={recentOthers}
          pickItems={pickItems}
          DE={DE}
          league={league}
          mySlot={mySlot}
        />
      </div>
    </div>
  )
}
