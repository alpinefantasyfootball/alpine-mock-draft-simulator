import { X } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

// Extracted out of DraftLogDock so the desktop column and the mobile dock
// can each wrap it in their own chrome without the queue-row markup living
// in two places — see DraftLogDock.jsx's own comment on why there are two
// wrappers around one set of tab content.
//
// survivalOf is optional — the Cockpit's not-your-turn state wants an odds
// column on this exact list ("your queue, while you wait"), and passing a
// function here draws it rather than forking a second queue-row component
// for one extra column. Omitted (both original callers, DraftRoom.jsx and
// PlayerHub.jsx), the row renders exactly as it always did.
export default function QueueList({ players, myTurn, engine, survivalOf }) {
  if (players.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs leading-relaxed text-white/30">
        Star a player in the list to line them up here — this is your own plan, and
        it's what gets drafted for you if the clock runs out while you're away.
      </p>
    )
  }

  return players.map((p, i) => (
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
      {survivalOf && (
        <span className="shrink-0 font-plex text-[10px] tabular-nums text-white/50">
          {(() => {
            const s = survivalOf(p)
            return s == null ? '—' : Math.round(s * 100) + '%'
          })()}
        </span>
      )}
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
        disabled={i === players.length - 1}
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
}
