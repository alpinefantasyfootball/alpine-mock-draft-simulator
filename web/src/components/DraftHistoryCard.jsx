import { ChevronRight } from 'lucide-react'

// The whole card is the click target, not just the button — but it renders
// real <button>s inside it for "Analyze Draft" and "Delete", so each one
// stops its own click from bubbling and firing onAnalyze twice (same
// pattern RoomCard uses for its "Enter" link inside an equally clickable
// card). Delete sits where DraftInProgressCard's own "Discard" already
// sits, on the same card shell — the two lockers didn't disagree on layout,
// only one of them had ever been given the button.
export default function DraftHistoryCard({ draft, onAnalyze, onDelete }) {
  const analyze = (e) => {
    e.stopPropagation()
    onAnalyze()
  }
  const del = (e) => {
    e.stopPropagation()
    onDelete()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAnalyze}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAnalyze() } }}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-6
                 transition-all duration-200 hover:scale-[1.01] hover:border-teal-400
                 hover:shadow-[0_0_15px_rgba(0,229,255,0.2)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold text-white">{draft.leagueType}</p>
          <p className="mt-0.5 text-xs text-white/45">{draft.dateCompleted}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">Projected rank</p>
          <span className="mt-1 inline-block rounded-full bg-teal-500/10 px-3 py-1 text-sm font-bold text-teal-400">
            {draft.projectedRank}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3 text-xs text-white/55">
        <span className="rounded-full bg-white/5 px-2.5 py-1 font-medium">
          Pick {draft.pickPosition}
        </span>
        {draft.round1Pick && (
          <span className="rounded-full bg-white/5 px-2.5 py-1 font-medium">
            1st Pick: {draft.round1Pick}
          </span>
        )}

        <button
          type="button"
          onClick={del}
          className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-white/50 transition-colors duration-200 hover:text-white"
        >
          Delete
        </button>

        <button
          type="button"
          onClick={analyze}
          className="flex items-center gap-1 rounded-full border border-teal-400/40 bg-teal-400/5
                     px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors duration-200
                     hover:border-teal-400 hover:bg-teal-400/15 hover:text-teal-200"
        >
          Analyze Draft
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
