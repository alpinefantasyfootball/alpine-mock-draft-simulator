import AnalyticsCard from './AnalyticsCard.jsx'
import { POS_CHALK, POS_NAMES } from './draftRoomPositions.js'

// Row 2, col 3 — what share of your early picks (historyStats()'s own
// CAPITAL_EARLY_ROUNDS in app.js — five rounds, named there once rather
// than repeated here) went to each position, across every completed mock.
// Normalised to 100% of early picks, kickers and defenses excluded since
// neither is ever a real candidate for one — their ADP comes from longer
// drafts than these, so counting them would only dilute the shares that are.
export default function DraftCapitalAllocationCard({ stats }) {
  const rows = stats.capitalAllocation
  if (!rows || !rows.length) {
    return (
      <AnalyticsCard title="Draft Capital Allocation" sub="Top 5-round picks by position">
        <p className="flex h-full items-center text-xs text-ink-muted">No early-round picks yet.</p>
      </AnalyticsCard>
    )
  }

  // The top position by share, named directly — rows is already sorted
  // descending by pct, so this is just its first entry, never a second
  // ranking of the same array.
  const top = rows[0]
  const plural = (POS_NAMES[top.pos] || top.pos).toLowerCase() + 's'
  const insight = `${Math.round(top.pct)}% of your early picks are ${plural}.`

  return (
    <AnalyticsCard title="Draft Capital Allocation" sub="Top 5-round picks by position">
      <div className="flex h-full flex-col">
        <div className="flex flex-1 items-end justify-between gap-2 px-1">
          {rows.map((row) => (
            <div key={row.pos} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="text-[10.5px] font-bold tabular-nums text-white/80">{Math.round(row.pct)}%</span>
              {/* POS_CHALK, not POS_SOLID — see AvgRoundByPositionCard
                  for the measurement. This is the card where it showed
                  worst: the columns are the largest position marks in the
                  Lobby, and at -700 the TE and QB ones read as holes in
                  the panel rather than as bars. The percentage above and
                  the code below are the labels; nothing is written on the
                  column itself. */}
              <div className="flex h-16 w-full items-end overflow-hidden rounded-t-sm bg-white/[0.06]">
                <div
                  className="w-full rounded-t-sm"
                  style={{ height: `${row.pct}%`, background: POS_CHALK[row.pos] || 'rgba(255,255,255,0.55)' }}
                />
              </div>
              <span className="text-[10px] font-bold text-white/50">{row.pos}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 shrink-0 text-[10px] text-ink-muted">{insight}</p>
      </div>
    </AnalyticsCard>
  )
}
