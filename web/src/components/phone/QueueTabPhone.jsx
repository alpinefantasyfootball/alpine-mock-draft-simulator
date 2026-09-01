import { X } from 'lucide-react'
import { POS_BADGE } from '../draftRoomPositions.js'

// README section 6. Calls the same engine methods the existing desktop/
// tablet queue already does (engine.queueToggle, engine.autoMe/
// toggleRoomAutopilot via the autopick props DraftRoomPhone already
// threads through) rather than a second queue implementation — QueueList.jsx
// stays the tablet/desktop component, untouched; this is a fresh phone
// layout over the identical data (queuePlayers, survivalFor) DraftRoom.jsx
// already computes for it.
//
// The spec's row has no reorder control, unlike QueueList.jsx's up/down
// arrows — matched pixel-for-pixel here rather than adding a control the
// design doesn't show. The real cost: a phone manager can't fine-tune
// queue order the way a tablet/desktop one can, only remove and re-add
// (which appends to the bottom). Worth knowing if that's reported back as
// a regression rather than a deliberate scope line.
export default function QueueTabPhone({ queuePlayers, survivalFor, onRemove, autopick, onToggleAutopick, over }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2.5">
        <span className="text-xs text-ink-soft">Auto-pick if the clock runs out</span>
        <button
          type="button"
          onClick={onToggleAutopick}
          disabled={over}
          aria-pressed={autopick}
          className={'relative block h-6 w-[42px] shrink-0 rounded-full transition-colors duration-200 ' + (autopick && !over ? 'bg-[#00B8CC]' : 'bg-slate-rule')}
        >
          <span
            className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-[#0D0F15] transition-[left] duration-200"
            style={{ left: autopick && !over ? 21 : 3 }}
          />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {queuePlayers.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
            <p className="font-body text-sm font-semibold text-ink">Draft queue is empty</p>
            <p className="text-xs leading-relaxed text-ink-muted">
              Speed up the draft by adding players to your queue from the players tab
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-[7px]">
            {queuePlayers.map((p, i) => {
              const s = survivalFor(p)
              return (
                <div key={p.name} className="flex items-center gap-2.5 rounded-[10px] border border-slate-rule bg-slate-sunk px-2.5 py-[9px]">
                  <span className="w-4 shrink-0 font-plex text-[11px] text-ink-muted">{i + 1}</span>
                  <span className={'shrink-0 rounded px-[5px] py-px text-[10px] font-bold ' + (POS_BADGE[p.pos] || 'bg-white/10 text-white/60')}>
                    {p.pos}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</span>
                  <span className="shrink-0 font-plex text-[11px] text-ink-muted">
                    {s == null ? '—' : Math.round(s * 100) + '%'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(p.name)}
                    title="Remove from your queue"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-rose-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="shrink-0 px-3 pb-3 pt-1 text-[12px] leading-[1.55] text-ink-muted">
        The clock draws from the top of this list first — reorder by removing and adding a player back in the order you want them.
      </p>
    </div>
  )
}
