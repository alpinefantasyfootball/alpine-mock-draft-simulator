export default function DraftHistoryCard({ draft }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-6 transition-all duration-200
                 hover:border-teal-400/70 hover:shadow-card-hover"
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

      <div className="flex items-center gap-2 border-t border-white/5 pt-3 text-xs text-white/55">
        <span className="rounded-full bg-white/5 px-2.5 py-1 font-medium">
          Pick {draft.pickPosition}
        </span>
      </div>
    </div>
  )
}
