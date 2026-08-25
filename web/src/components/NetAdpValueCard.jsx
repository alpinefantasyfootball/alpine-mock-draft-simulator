import AnalyticsCard from './AnalyticsCard.jsx'

// The card's own fixed slot count — historyStats() already windows
// netAdpValueHistory to the same ten in app.js, so this is naming that
// number rather than choosing a second one. Slots beyond the real entries
// render transparent rather than the row simply being narrower: the layout
// stays the same width from a user's first mock through their tenth, and a
// bar only ever *appears* in a slot, it never resizes the ones beside it.
const SLOT_COUNT = 10

// One column per mock — green growing up from the centre line for a
// bargain, pink growing down for a reach. Green rather than this grid's
// earlier teal: green is otherwise unused for meaning anywhere in Juke
// (RB's emerald in POS_SOLID is identity, not a "good/bad" signal), so it's
// free to carry "positive" here without colliding with an existing rule.
// Pink instead of the heatmap's red on purpose — a reach here is an
// ordinary outcome, not the kind of real problem the heatmap's red is
// flagging, and borrowing its alarm colour for it would overstate that.
// flex-1 rather than a fixed pixel width: a fixed width is what "tucked to
// the left" in a wide card actually was — ten bars each claiming exactly
// 5px left the other 90% of the card as bare background. flex-1 makes
// every slot claim an equal share of whatever width the card actually has,
// real or empty. top/bottom/height as percentages are safe here (relative
// to this element's own height); a percentage margin is not (the CSS spec
// resolves margin-top/bottom percentages against the containing block's
// WIDTH, not its height), which is why this is built with absolute
// positioning rather than a margin-based flex trick.
function Bar({ entry, index, maxAbs }) {
  if (!entry) {
    return <div className="h-full min-w-[6px] flex-1" title={`Mock ${index + 1}: not run yet`} />
  }
  const pct = maxAbs > 0 ? (Math.abs(entry.value) / maxAbs) * 48 : 0
  const positive = entry.value >= 0
  return (
    <div
      className="relative h-full min-w-[6px] flex-1"
      title={`Mock ${index + 1}: ${entry.value >= 0 ? '+' : ''}${Math.round(entry.value)} picks vs. board rank`}
    >
      <div
        className="absolute left-0 right-0 rounded-[1px]"
        style={{
          background: positive ? '#34D399' : '#F472B6',
          ...(positive ? { bottom: '50%', height: `${pct}%` } : { top: '50%', height: `${pct}%` }),
        }}
      />
    </div>
  )
}

// Row 3, col 1 — one bar per mock, historyStats()'s netAdpValueHistory in
// app.js, itself entry.netAdpValue (analyseTeam()'s own unclamped `value`)
// stored the moment each draft finished. Positive means picks fell to you
// against the board's own rank; negative means you reached — the same
// signed convention CLAUDE.md documents at length for the single-draft
// grade's own callouts, kept here rather than inverted for this chart.
export default function NetAdpValueCard({ stats }) {
  const entries = stats.netAdpValueHistory
  if (!entries || !entries.length) {
    return (
      <AnalyticsCard title="Net ADP Value" sub="Sum of (actual pick − ADP), per mock">
        <p className="flex h-full items-center text-xs text-ink-muted">Not enough mocks yet.</p>
      </AnalyticsCard>
    )
  }

  const maxAbs = Math.max(1, ...entries.map((e) => Math.abs(e.value)))
  const agg = stats.avgNetAdpValue
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => entries[i] || null)
  const beat = entries.filter((e) => e.value > 0).length

  return (
    <AnalyticsCard
      title="Net ADP Value"
      sub="Sum of (actual pick − ADP), per mock"
      right={
        typeof agg === 'number' ? (
          <span
            className="font-display text-sm font-bold tabular-nums"
            style={{ color: agg >= 0 ? '#34D399' : '#F472B6' }}
          >
            {agg >= 0 ? '+' : ''}{Math.round(agg)}
          </span>
        ) : null
      }
    >
      <div className="flex h-full flex-col">
        <div className="relative flex min-h-[80px] flex-1 items-stretch gap-[3px]">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/15" />
          {slots.map((e, i) => <Bar key={e ? e.id : 'ghost' + i} entry={e} index={i} maxAbs={maxAbs} />)}
        </div>
        <p className="mt-1.5 shrink-0 text-[10px] text-ink-muted">
          You beat ADP in {beat} of {entries.length} mock{entries.length === 1 ? '' : 's'}.
        </p>
      </div>
    </AnalyticsCard>
  )
}
