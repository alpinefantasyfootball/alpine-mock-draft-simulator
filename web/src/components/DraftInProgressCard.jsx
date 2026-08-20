import { ChevronRight } from 'lucide-react'

// Same card shell as DraftHistoryCard — hover scale, teal glow, whole card
// clickable — so the two read as one family despite showing different
// things: this one is mid-draft, so a projected rank has nothing to grade
// yet, and a progress bar takes its place.
export default function DraftInProgressCard({ draft, onResume, onDiscard }) {
  const pct = Math.round((draft.made / draft.total) * 100)

  const discard = (e) => {
    e.stopPropagation()
    onDiscard()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onResume}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onResume() } }}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-6
                 transition-all duration-200 hover:scale-[1.01] hover:border-teal-400
                 hover:shadow-[0_0_15px_rgba(0,229,255,0.2)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold text-white">{draft.leagueType}</p>
          <p className="mt-0.5 text-xs text-white/45">Pick {draft.pickPosition}</p>
        </div>
        <span className="shrink-0 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-400">
          In progress
        </span>
      </div>

      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-teal-400" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-white/55">{draft.made} of {draft.total} picks made</p>
      </div>

      <div className="flex items-center gap-2 border-t border-white/5 pt-3">
        <button
          type="button"
          onClick={discard}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-white/50 transition-colors duration-200 hover:text-white"
        >
          Discard
        </button>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onResume() }}
          className="ml-auto flex items-center gap-1 rounded-full border border-teal-400/40 bg-teal-400/5
                     px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors duration-200
                     hover:border-teal-400 hover:bg-teal-400/15 hover:text-teal-200"
        >
          Resume
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
