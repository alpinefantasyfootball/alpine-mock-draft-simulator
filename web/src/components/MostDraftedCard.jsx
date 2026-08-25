import AnalyticsCard from './AnalyticsCard.jsx'
import { POS_BADGE, POS_SOLID } from './draftRoomPositions.js'

// Row 1, col 4 of the analytics grid — the top five names by how often they
// land on your own roster, tallied across only your own picks
// (historyStats()'s own mostDraftedList, in app.js — never every team's,
// see that function's own comment on why). Below five mocks the whole grid
// is gated by DraftLocker itself, so this never has to draw its own
// thin-sample warning.
export default function MostDraftedCard({ stats }) {
  const list = stats.mostDraftedList
  if (!list || !list.length) {
    return (
      <AnalyticsCard title="Most Drafted" sub="Players you keep coming back to">
        <p className="flex h-full items-center text-xs text-ink-muted">No repeat picks yet.</p>
      </AnalyticsCard>
    )
  }

  return (
    <AnalyticsCard title="Most Drafted" sub="Players you keep coming back to">
      <div className="flex h-full flex-col justify-between gap-2.5">
        {list.map((row) => {
          const pct = Math.round((row.count / row.total) * 100)
          return (
            <div key={row.name} className="flex items-center gap-2">
              <span className={'w-9 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-bold ' + (POS_BADGE[row.pos] || 'bg-white/10 text-white/50')}>
                {row.pos}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/85">{row.name}</span>
              <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: POS_SOLID[row.pos] || '#00E5FF' }} />
              </div>
              <span className="w-14 shrink-0 text-right text-[10.5px] tabular-nums text-white/55">
                {row.count} of {row.total}
              </span>
            </div>
          )
        })}
      </div>
    </AnalyticsCard>
  )
}
