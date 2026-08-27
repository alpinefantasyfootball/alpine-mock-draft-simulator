// usageFor() has already decided which columns are meaningful for this
// player's position and formatted every cell — a share as a percentage, an
// EPA with its sign. This renders what it returns rather than reaching into
// the raw `u` block, the same contract ProjectionsTab has with
// projectionSummary().
//
// The tab is not rendered at all when usageFor() returns null, so the empty
// state here is only reachable if that ever changes.
export default function UsageTab({ usage }) {
  if (!usage) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-muted">
        No usage data for this player.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          How he was used
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-rule">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-rule bg-slate-sunk/60 text-[10px] uppercase tracking-wide text-ink-muted">
                <th className="px-2 py-1.5 text-left font-medium">Year</th>
                {usage.head.map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1.5 text-right font-medium">{h}</th>
                ))}
                {/* The denominator, and it is doing the same job it does on
                    the Projections tab. A share is over the team's whole
                    season rather than over the games he played, so a player
                    who missed six weeks shows a depressed share that is
                    arithmetically right and answers a different question
                    from the one being asked. */}
                <th className="px-2 py-1.5 text-right font-medium">GP</th>
              </tr>
            </thead>
            <tbody>
              {usage.rows.map((r) => (
                <tr key={r.year} className="border-b border-slate-rule/60 last:border-b-0">
                  <td className="px-2 py-1.5 text-white/70">{r.year}</td>
                  {r.cells.map((c, i) => (
                    <td
                      key={usage.head[i]}
                      className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-white"
                    >
                      {c === null ? '—' : c}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink-muted">
                    {r.games === null ? '—' : r.games}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {usage.hasShare && (
          <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
            Share is of his team&rsquo;s whole season, not of the games he
            played &mdash; read it next to GP. A negative air-yards share is
            real: a screen pass is caught behind the line.
          </p>
        )}
      </div>

      {/* Said plainly, because the temptation to read these as a better
          ranking is the whole reason they were nearly not built. Measured at
          the time: no usage metric beat points per game at predicting next
          season's points, and the best any of them managed on top of points
          per game was +0.008 r. */}
      <p className="text-[11px] leading-snug text-ink-muted">
        These explain a season rather than rank a player. Nothing here feeds
        the Juke score, the suggestions or the CPU &mdash; measured against
        points per game, usage predicted next season no better.
      </p>
    </div>
  )
}
