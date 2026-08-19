import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

function SlotBox({ label, player }) {
  return (
    <div className="flex h-14 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 px-1.5">
      <span
        className={
          'rounded px-1.5 py-0.5 text-[9px] font-bold ' +
          (player ? POS_BADGE[player.pos] || 'bg-white/10 text-white/50' : 'bg-white/5 text-white/25')
        }
      >
        {label}
      </span>
      <span className={'w-full truncate text-center text-[10px] font-medium ' + (player ? 'text-white/85' : 'text-white/20')}>
        {player ? player.name.split(' ').slice(-1)[0] : '—'}
      </span>
    </div>
  )
}

// Real data only: `lineup` is window.JukeEngine.seatedLineup() — the exact
// function that already decides which bench player counts as the FLEX
// (see the bestLineup()/posRank note in CLAUDE.md). This never re-derives
// that assignment; it just draws what the engine already decided.
export default function RosterDock({ lineup, benchSize }) {
  const [open, setOpen] = useState(true)
  const seats = lineup?.seats || []
  const bench = lineup?.bench || []
  const filled = seats.filter((s) => s.player).length + bench.length
  const total = seats.length + benchSize

  const benchBoxes = Array.from({ length: benchSize }, (_, i) => bench[i] || null)

  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-1.5 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
          Your roster &middot; <span className="text-white/70">{filled} of {total}</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronUp className="h-4 w-4 text-white/40" />}
      </button>

      {open && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {seats.map((seat, i) => (
            <SlotBox key={'seat-' + i} label={seat.slot} player={seat.player} />
          ))}
          {benchBoxes.map((player, i) => (
            <SlotBox key={'bn-' + i} label="BN" player={player} />
          ))}
        </div>
      )}
    </div>
  )
}
