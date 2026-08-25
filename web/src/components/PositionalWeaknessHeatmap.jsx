import AnalyticsCard from './AnalyticsCard.jsx'
import { POS_NAMES } from './draftRoomPositions.js'

const HEATMAP_POSITIONS = ['QB', 'RB', 'WR', 'TE']

// historyStats() already windows weaknessHeatmap to the same ten mocks in
// app.js — this names that number rather than choosing a second one. Slots
// beyond the real entries render as empty, transparent cells rather than
// the row simply being narrower, so the card is the same width on a
// user's third mock as their tenth.
const SLOT_COUNT = 10

// Chosen, not measured: how many points above or below replacement counts
// as a full-strength swing on the heatmap's colour scale. Double app.js's
// own MIN_SPAN floor for starter strength (20), a deliberately generous
// span so an ordinary roster doesn't paint every cell at full saturation.
const STRENGTH_SPAN = 40

// Floor width per mock column before the row scrolls instead of continuing
// to squeeze cells — not a target width. Each cell is flex-1 and grows to
// fill whatever room this card actually has (it spans 3 of the grid's 4
// columns, which is most of the page), so the common case draws wide,
// easy-to-scan bars on its own; this only stops the window's own ten slots
// from ever being crushed on a narrow phone.
const CELL_MIN_WIDTH = 22

function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16), b = parseInt(hexB.slice(1), 16)
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  return `rgb(${Math.round(ar + (br - ar) * t)}, ${Math.round(ag + (bg - ag) * t)}, ${Math.round(ab + (bb - ab) * t)})`
}

// Red -> yellow -> green: the traffic-light convention a heatmap is
// expected to use, rather than this grid's usual teal/rose pairing. Green
// is otherwise unused for *meaning* anywhere in Juke (RB's emerald in
// POS_SOLID is identity, not a verdict — it stays put, it just isn't what
// this scale is borrowing), so introducing it here as "strong" doesn't
// collide with an existing rule the way reusing a POSITION hue would.
function strengthColor(gap) {
  if (gap === null || gap === undefined) return 'rgba(255,255,255,0.05)'
  const t = Math.max(0, Math.min(1, (gap / STRENGTH_SPAN + 1) / 2)) // 0 = weak, 1 = strong
  return t < 0.5 ? mix('#F87171', '#FBBF24', t / 0.5) : mix('#FBBF24', '#34D399', (t - 0.5) / 0.5)
}

// The one-line takeaway under the grid — the position with the best and
// the position with the worst average strength across the real (non-ghost)
// mocks in the window, named directly rather than left for a reader to
// average six-to-ten cells by eye. Absent below two real mocks: an
// average of one number is just that number, not a comparison.
function buildInsight(entries) {
  const real = entries.filter(Boolean)
  if (real.length < 2) return null
  const avgByPos = {}
  HEATMAP_POSITIONS.forEach((pos) => {
    const gaps = real.map((e) => e.byPos && e.byPos[pos]).filter((g) => typeof g === 'number')
    if (gaps.length) avgByPos[pos] = gaps.reduce((a, b) => a + b, 0) / gaps.length
  })
  const ranked = Object.keys(avgByPos).sort((a, b) => avgByPos[b] - avgByPos[a])
  if (ranked.length < 2) return null
  const best = ranked[0], worst = ranked[ranked.length - 1]
  if (best === worst) return null
  return `${POS_NAMES[best] || best} is your most consistent strength; ${POS_NAMES[worst] || worst} is your most consistent weakness.`
}

// Row 3, cols 2-4 — how far above or below a replacement-level starter each
// position finished, per completed mock (historyStats()'s weaknessHeatmap
// in app.js, itself entry.posStrength stored the moment each draft actually
// finished — see that field's own comment on why it isn't reconstructed
// against today's board the way avgRoundByPosition is).
//
// Cells are flex-1, not a fixed pixel size: an earlier version drew a fixed
// 14px square regardless of how much room this card actually had, which is
// most of the page's width once it's the one panel spanning three of the
// grid's four columns — the result read as a small detail floating in a
// mostly-empty card rather than the wide, at-a-glance strip a heatmap is
// supposed to be. Filling the real width was the fix, not a bigger constant.
export default function PositionalWeaknessHeatmap({ stats }) {
  const entries = stats.weaknessHeatmap
  if (!entries || !entries.length) {
    return (
      <AnalyticsCard title="Positional Weakness Heatmap" sub="Position × mock draft number">
        <p className="flex h-full items-center text-xs text-ink-muted">Not enough mocks yet.</p>
      </AnalyticsCard>
    )
  }

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => entries[i] || null)
  const insight = buildInsight(slots)

  return (
    <AnalyticsCard
      title="Positional Weakness Heatmap"
      sub="Position × mock draft number"
      right={
        <div className="flex shrink-0 items-center gap-1.5 text-[9px] text-ink-muted">
          <span>Weak</span>
          <span className="h-2 w-16 rounded-full" style={{ background: 'linear-gradient(90deg, #F87171, #FBBF24, #34D399)' }} />
          <span>Strong</span>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full min-w-full flex-col justify-center gap-2">
            <div className="flex items-center gap-[3px] pl-7">
              {slots.map((e, i) => (
                <span key={e ? e.id : 'ghost' + i} className="min-w-[22px] flex-1 shrink-0 text-center text-[9px] text-ink-muted">
                  {i + 1}
                </span>
              ))}
            </div>
            {HEATMAP_POSITIONS.map((pos) => (
              <div key={pos} className="flex items-center gap-[3px]">
                <span className="w-6 shrink-0 text-[10px] font-bold text-white/50">{pos}</span>
                {slots.map((e, i) => {
                  const gap = e && e.byPos ? e.byPos[pos] : null
                  return (
                    <div
                      key={e ? e.id : 'ghost' + i}
                      className="h-7 flex-1 rounded-md"
                      style={{ minWidth: CELL_MIN_WIDTH, background: e ? strengthColor(gap) : 'transparent' }}
                      title={
                        e
                          ? `${POS_NAMES[pos] || pos} · mock ${i + 1}` +
                            (typeof gap === 'number' ? ` · ${gap >= 0 ? '+' : ''}${Math.round(gap)} vs. replacement` : ' · no data')
                          : `Mock ${i + 1}: not run yet`
                      }
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <p className="mt-1.5 shrink-0 text-[10px] text-ink-muted">
          {insight || `Mock 1 → ${entries.length}, left to right`}
        </p>
      </div>
    </AnalyticsCard>
  )
}
