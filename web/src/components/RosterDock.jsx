import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
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
// Below lg this is a real bottom sheet, not just a collapsible panel in
// normal flow: fixed to the bottom edge, open or closed by the same button
// as before, or by dragging the handle. The drag lives on the handle
// alone, not the whole sheet — the slot boxes below scroll horizontally on
// their own, and a y-drag recogniser covering that area would fight that
// scroll every time a thumb tried to pan sideways through the bench. At
// lg+ none of this applies: back to a plain panel in the normal document
// flow, exactly as it was before this pass.
export default function RosterDock({ lineup, benchSize }) {
  const [open, setOpen] = useState(true)
  const seats = lineup?.seats || []
  const bench = lineup?.bench || []
  const filled = seats.filter((s) => s.player).length + bench.length
  const total = seats.length + benchSize

  const benchBoxes = Array.from({ length: benchSize }, (_, i) => bench[i] || null)

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 shrink-0 rounded-t-xl border-t border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md lg:static lg:z-auto lg:rounded-none lg:bg-slate-900/80 lg:shadow-none">
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.3}
        onDragEnd={(_, info) => {
          if (info.offset.y < -20) setOpen(true)
          else if (info.offset.y > 20) setOpen(false)
        }}
        className="flex cursor-grab touch-none justify-center pt-1.5 active:cursor-grabbing lg:hidden"
      >
        <span className="h-1 w-9 rounded-full bg-slate-700" />
      </motion.div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-1 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
          Your roster &middot; <span className="text-white/70">{filled} of {total}</span>
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-white/40" /> : <ChevronUp className="h-3.5 w-3.5 text-white/40" />}
      </button>

      {open && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2">
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
