// projectionSummary() already rounds/formats everything (Math.round on the
// points total, perGame()'s own dash-for-no-games handling) — this renders
// what it returns rather than reaching back into raw stat fields itself.
export default function ProjectionsTab({ summary }) {
  if (!summary) {
    return (
      <p className="px-1 py-6 text-center text-sm text-white/40">
        No projection stored for this player yet.
      </p>
    )
  }

  const vsAdpText = summary.vsAdp === null
    ? '—'
    : summary.vsAdp > 0 ? `+${summary.vsAdp}` : String(summary.vsAdp)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Points" value={summary.points} />
        <StatBox label="Per game" value={summary.perGame} />
        <StatBox label="Pos rank" value={summary.posRank || '—'} />
        <StatBox
          label="vs ADP"
          value={vsAdpText}
          tone={summary.vsAdp > 0 ? 'text-teal-300' : summary.vsAdp < 0 ? 'text-rose-300' : ''}
        />
      </div>

      {summary.stats.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
            Projected stat line
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {summary.stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/35">{s.label}</p>
                <p className="text-sm font-semibold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-white/35">{label}</p>
      <p className={'text-lg font-bold ' + (tone || 'text-white')}>{value}</p>
    </div>
  )
}
