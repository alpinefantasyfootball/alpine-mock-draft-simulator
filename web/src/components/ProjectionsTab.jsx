// projectionSummary() already rounds/formats everything (Math.round on the
// points total, perGame()'s own dash-for-no-games handling) — this renders
// what it returns rather than reaching back into raw stat fields itself.
export default function ProjectionsTab({ summary, record }) {
  if (!summary) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-muted">
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
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Projected stat line
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {summary.stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-rule bg-slate-sunk/50 px-2 py-1.5 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">{s.label}</p>
                <p className="text-sm font-semibold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Our record on this player. It is the only thing on this drawer that
          can be checked rather than believed, and the one thing a projection
          feed will never show you about itself — it was on the legacy sheet,
          and the React rewrite quietly dropped it. Both halves go through
          fantasyPoints() under the current rules, so it rescores with the
          scoring editor like everything else. */}
      {record && record.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Our record on him
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-rule">
            <table className="w-full bg-slate-panel text-xs">
              <thead>
                <tr className="border-b border-slate-rule bg-slate-sunk/60 text-[10px] uppercase tracking-wide text-ink-muted">
                  <th className="px-2 py-1.5 text-left font-medium">Year</th>
                  <th className="px-2 py-1.5 text-right font-medium">We said</th>
                  <th className="px-2 py-1.5 text-right font-medium">He got</th>
                  <th className="px-2 py-1.5 text-right font-medium">Diff</th>
                  {/* Games played is not decoration, it is the honesty:
                      availability is most of the projection's error (r 0.873
                      at 15+ games against 0.617 below), so "we said 250, he
                      got 40" is a hamstring rather than a miss. A DST is one
                      aggregate row stamped gp:1, so it shows a dash — the
                      same trap perGame() already exists to prevent. */}
                  <th className="px-2 py-1.5 text-right font-medium">GP</th>
                </tr>
              </thead>
              <tbody>
                {record.map((r) => (
                  <tr key={r.year} className="border-b border-slate-rule/60 last:border-b-0">
                    <td className="px-2 py-1.5 text-white/70">{r.year}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-white/70">{Math.round(r.proj)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-white">{Math.round(r.act)}</td>
                    <td className={'px-2 py-1.5 text-right font-semibold tabular-nums ' +
                      (r.diff >= 0 ? 'text-teal-300' : 'text-rose-300')}>
                      {r.diff >= 0 ? '+' : ''}{Math.round(r.diff)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-ink-muted">
                      {r.games === null ? '—' : r.games}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Without this a column of green reads as a model that is simply
              too low, rather than one doing its job. */}
          <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
            A projection is an expected value that prices in injury risk, so it
            runs about 20 points light on anyone who stays fit — most healthy
            seasons beat it.
          </p>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-slate-rule bg-slate-sunk/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={'text-lg font-bold ' + (tone || 'text-white')}>{value}</p>
    </div>
  )
}
