import AnalyticsCard from './AnalyticsCard.jsx'
import TrendChart from './TrendChart.jsx'

// Matches app.js's own TREND_WINDOW — historyStats() already caps
// winPctHistory to this many of the most recent mocks, and this passes the
// same number to TrendChart as the fixed denominator its x-axis spans, so
// a user with four mocks gets a line occupying the first four-tenths of
// the chart's width rather than one stretched to fill it.
const SLOT_COUNT = 10

function fmtDate(ms) {
  return typeof ms === 'number' ? new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''
}

// First value against last, not a two-half average — matches what a reader
// actually sees looking at the two ends of the line. Absent below two
// points: one point has no "trend" to describe.
function trendInsight(entries) {
  if (entries.length < 2) return null
  const first = entries[0].value, last = entries[entries.length - 1].value
  const delta = last - first
  const direction = delta > 3 ? 'Trending up' : delta < -3 ? 'Trending down' : 'Holding steady'
  return `${direction} — ${Math.round(first)}% to ${Math.round(last)}%.`
}

// Row 2, col 4 — historyStats()'s winPctHistory in app.js, itself
// entry.projectedWinPct stored the moment each draft finished. See the file
// comment above projectedWinPctForRoom() in app.js for exactly what this
// can and can't honestly claim: a scoring-strength estimate against the
// room you actually drafted with, from real projected output and real
// week-to-week variability — not a simulated season, and it doesn't know
// which week any team's bye falls in relative to anyone else's.
export default function WinPctTrendCard({ stats }) {
  const entries = stats.winPctHistory
  if (!entries || !entries.length) {
    return (
      <AnalyticsCard title="Projected Win % Trend" sub={`Across your last ${SLOT_COUNT} mocks`}>
        <p className="flex h-full items-center text-xs text-ink-muted">Not enough mocks yet.</p>
      </AnalyticsCard>
    )
  }

  return (
    <AnalyticsCard
      title="Projected Win % Trend"
      sub={`Across your last ${SLOT_COUNT} mocks`}
      right={
        typeof stats.avgWinPct === 'number' ? (
          <span className="font-display text-sm font-bold tabular-nums text-teal-300">{Math.round(stats.avgWinPct)}%</span>
        ) : null
      }
    >
      <div className="flex h-full flex-col justify-between">
        <TrendChart entries={entries} area suffix="%" height={72} slotCount={SLOT_COUNT} />
        <div className="mt-1 flex justify-between text-[9px] text-ink-muted">
          <span>{fmtDate(entries[0].completedAt)}</span>
          <span>{fmtDate(entries[entries.length - 1].completedAt)}</span>
        </div>
        <p className="mt-1 text-[10px] text-ink-muted">{trendInsight(entries)}</p>
      </div>
    </AnalyticsCard>
  )
}
