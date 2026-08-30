import AnalyticsCard from './AnalyticsCard.jsx'
import { POS_MATTE } from './draftRoomPositions.js'

const SKILL_POSITIONS = ['QB', 'RB', 'WR', 'TE']

// The two fastest and the one slowest among the four skill positions,
// named directly rather than left for a reader to compare six-to-eight
// bars by eye. K and DST sit out — the app schedules both into the closing
// rounds itself (CLAUDE.md's FORCED_LATE), so naming either as "slowest"
// would describe a rule the app enforces, not a drafting tendency.
// Abbreviations, not full names — matches how every other label on this
// card already reads (RB, WR, QB, not "Running back").
function buildInsight(rows) {
  const skill = rows.filter((r) => SKILL_POSITIONS.indexOf(r.pos) >= 0)
  if (skill.length < 3) return null
  const [a, b] = skill
  const slowest = skill[skill.length - 1]
  if (slowest === a || slowest === b) return null
  return `${a.pos} and ${b.pos} go early; ${slowest.pos} waits until round ${slowest.avgRound.toFixed(1)}.`
}

// Row 2, col 2 — the average round you land your first player at each
// position, across every completed mock (historyStats()'s avgRoundByPosition
// in app.js). Bar length is relative to the slowest position in the list,
// not to the league's own round count, so the card stays readable at any
// league size without a second prop.
export default function AvgRoundByPositionCard({ stats }) {
  const rows = stats.avgRoundByPosition
  if (!rows || !rows.length) {
    return (
      <AnalyticsCard title="Avg Round by Position" sub="How early you take each position">
        <p className="flex h-full items-center text-xs text-ink-muted">Not enough drafted positions yet.</p>
      </AnalyticsCard>
    )
  }

  const maxRound = Math.max(...rows.map((r) => r.avgRound))
  const insight = buildInsight(rows)

  return (
    <AnalyticsCard title="Avg Round by Position" sub="How early you take each position">
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          {rows.map((row) => (
            <div key={row.pos} className="grid grid-cols-[32px_1fr_46px] items-center gap-2">
              {/* 32px/46px, not the 26px/38px this was first written with:
                  sized off QB/RB/WR/TE/K (1-2 characters) and never checked
                  against DST (3), which wrapped to two lines in its own cell
                  and pushed the whole row taller — found by measuring the
                  rendered row height against its neighbours, not by reading
                  the class names. whitespace-nowrap stays on both regardless,
                  since a width tuned to today's position labels is still a
                  width tuned to today's position labels. */}
              <span className="whitespace-nowrap text-[10px] font-bold text-white/50">{row.pos}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(row.avgRound / maxRound) * 100}%`, background: POS_MATTE[row.pos] || 'rgba(255,255,255,0.3)' }}
                />
              </div>
              <span className="whitespace-nowrap text-right text-[10.5px] tabular-nums text-white/70">Rd {row.avgRound.toFixed(1)}</span>
            </div>
          ))}
        </div>
        {insight && <p className="mt-2 shrink-0 text-[10px] text-ink-muted">{insight}</p>}
      </div>
    </AnalyticsCard>
  )
}
