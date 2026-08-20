import { POS_BADGE } from './draftRoomPositions.js'

function SlotBox({ label, player }) {
  return (
    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-slate-800 bg-slate-950/60 px-0.5">
      <span
        className={
          'max-w-full truncate rounded px-1 text-[7px] font-bold leading-tight ' +
          (player ? POS_BADGE[player.pos] || 'bg-white/10 text-white/50' : 'bg-white/5 text-white/25')
        }
      >
        {label}
      </span>
      <span className={'w-full truncate text-center text-[8px] font-medium leading-tight ' + (player ? 'text-white/85' : 'text-white/20')}>
        {player ? player.name.split(' ').slice(-1)[0] : '—'}
      </span>
    </div>
  )
}

// Real data only: `lineup` is window.JukeEngine.seatedLineup() — the exact
// function that already decides which bench player counts as the FLEX
// (see the bestLineup()/posRank note in CLAUDE.md). This never re-derives
// that assignment; it just draws what the engine already decided.
//
// lg+ only now — a plain panel in the normal document flow. Below lg,
// "your roster" is one of the four tabs PlayerHub.jsx's bottom sheet
// already covers (via the same seatedLineup(), defaulted to your own
// seat), so this doesn't need its own separate fixed sheet any more; see
// PlayerHub's file comment for the rest of what that pass consolidated.
export default function RosterDock({ lineup, benchSize }) {
  const seats = lineup?.seats || []
  const bench = lineup?.bench || []
  const filled = seats.filter((s) => s.player).length + bench.length
  const total = seats.length + benchSize

  const benchBoxes = Array.from({ length: benchSize }, (_, i) => bench[i] || null)

  return (
    <div className="hidden shrink-0 bg-slate-900/80 lg:block">
      <div className="flex w-full items-center justify-between px-4 py-1 text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
          Your roster &middot; <span className="text-white/70">{filled} of {total}</span>
        </span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-4 pb-2">
        {seats.map((seat, i) => (
          <SlotBox key={'seat-' + i} label={seat.slot} player={seat.player} />
        ))}
        {benchBoxes.map((player, i) => (
          <SlotBox key={'bn-' + i} label="BN" player={player} />
        ))}
      </div>
    </div>
  )
}
