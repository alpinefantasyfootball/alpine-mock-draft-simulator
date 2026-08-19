import { useEffect, useReducer, useState } from 'react'
import { ChevronDown, ChevronUp, ListChecks, X } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

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
]

// Replaces the old chat dock. Not room-specific — a queue and a log of
// what's happened are just as useful solo, so unlike chat this renders
// regardless of engine.hasRoom(). Fixed bottom-right, same corner chat
// used to occupy; PlayerQueueSidebar reserves clearance below its own
// list (pb-64) so this can never sit on top of that list's Draft buttons.
export default function DraftLogDock() {
  const engine = useEngine()
  useJukeTick(engine)
  // Collapsed by default on narrow screens: open, this panel is tall
  // enough to sit over several rows of the player list at once rather
  // than just the one row pb-64 guarantees clearance past, so the
  // smallest safe footprint on a phone is the header bar alone.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640)
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
    <div className="fixed bottom-4 right-4 z-50 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <ListChecks className="h-4 w-4 text-teal-400" />
          Draft Log &amp; Queue
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronUp className="h-4 w-4 text-white/40" />}
      </button>

      {open && (
        <>
          <div className="flex border-t border-slate-800">
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

          <div className="max-h-[320px] overflow-y-auto p-2">
            {tab === 'queue' ? (
              queuePlayers.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs leading-relaxed text-white/30">
                  Star a player in the list to line them up here — this is your own plan, and
                  it's what gets drafted for you if the clock runs out while you're away.
                </p>
              ) : (
                queuePlayers.map((p, i) => (
                  <div
                    key={p.name}
                    className="mb-1.5 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-2"
                  >
                    <span className="w-3.5 shrink-0 text-center text-[10px] text-white/30">{i + 1}</span>
                    <span
                      className={
                        'shrink-0 rounded px-1 text-[9px] font-bold ' +
                        (POS_BADGE[p.pos] || 'bg-white/10 text-white/50')
                      }
                    >
                      {p.pos}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/90">{p.name}</span>
                    <button
                      type="button"
                      onClick={() => engine.queueMove(p.name, -1)}
                      disabled={i === 0}
                      className="shrink-0 text-[11px] text-white/40 hover:text-white/70 disabled:opacity-20"
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      onClick={() => engine.queueMove(p.name, 1)}
                      disabled={i === queuePlayers.length - 1}
                      className="shrink-0 text-[11px] text-white/40 hover:text-white/70 disabled:opacity-20"
                    >
                      &darr;
                    </button>
                    <button
                      type="button"
                      onClick={() => engine.queueToggle(p.name)}
                      title="Remove from your queue"
                      className="shrink-0 text-white/30 hover:text-rose-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => engine.draftPlayer(p)}
                      disabled={!myTurn}
                      className={
                        'shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors duration-150 ' +
                        (myTurn
                          ? 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white'
                          : 'cursor-not-allowed bg-white/5 text-white/25')
                      }
                    >
                      Draft
                    </button>
                  </div>
                ))
              )
            ) : recentOthers.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-white/30">No picks yet.</p>
            ) : (
              recentOthers.map((pick) => {
                const code = DE ? DE.pickCode(pick.overall, league.teams) : pick.overall
                return (
                  <p key={pick.overall} className="mb-1.5 px-1 text-xs leading-relaxed text-white/60">
                    <span className="text-white/30">{code}</span>{' '}
                    <span className="font-medium text-white/80">{engine.teamLabel(pick.slot)}</span> took{' '}
                    <span className="text-white/90">{pick.player.name}</span>{' '}
                    <span className="text-white/30">({pick.player.pos})</span>
                  </p>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
