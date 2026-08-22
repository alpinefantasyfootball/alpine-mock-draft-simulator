import { POS_SOLID } from './draftRoomPositions.js'

// Round 1 position's bar fills use each position's own established hue
// (POS_BADGE's solid form) rather than the handoff's literal teal-for-RB/
// purple-for-WR — POS_BADGE is documented as the one position-colour
// reference for the whole site, already shared by this same app's
// ShowYourWorking.jsx and the Draft Room's own board, and introducing a
// second RB/WR colour scheme here is exactly the "a position reads a
// different colour depending which screen you're on" bug that file exists
// to prevent. Grade colour (teal for a strong grade) is a different axis —
// quality, not identity — so that one does follow the handoff directly.
//
// Imported from draftRoomPositions.js rather than redeclared: this used to
// be its own local -600-step copy, which was the exact drift the comment
// above warns about, just one file removed — a second RB/WR/TE/QB colour
// table that happened to still agree with the real one today and had no
// way to keep agreeing tomorrow.

// Below this many completed mocks, every one of the six aggregates below
// reads as a coincidence rather than a tendency: "most drafted, 2 of 2" and
// "round 1 position: RB 100%" are both trivially true of a single draft,
// and a two-point "grade, last 12" trend is two grades, not a trend. Five
// is the point where "most drafted" stops being "the only player you've
// ever taken" and a trend has more than one gap to average over — still a
// small sample, but no longer a coin flip dressed as an insight.
const MIN_MOCKS_FOR_TENDENCIES = 5

function Card({ label, children }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-charcoal p-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">{label}</p>
      {children}
    </div>
  )
}

// The header row is shared between the gated placeholder and the real grid
// below — same title, same right-aligned progress/context line — so the
// panel doesn't visually reset into a different-looking widget the moment
// the fifth mock lands.
function StripHeader({ children }) {
  return <div className="mb-3 flex items-baseline justify-between">{children}</div>
}

export default function TendenciesStrip({ stats }) {
  const total = (stats && stats.total) || 0

  // h-full pairs with DraftLocker's row switching to items-stretch: this
  // box fills exactly as much height as New Mock panel takes, rather than
  // sitting a few lines tall in a sea of blank space beside a much taller
  // panel — which is what "500px of dead space to the right of New Mock"
  // actually was, measured on this exact screen with fewer than five mocks.
  // Covers zero mocks too (0 < 5): a first-time visitor gets the same
  // honest "not yet" box instead of the empty flex-1 slot that used to sit
  // beside New Mock panel until a draft had ever been completed.
  if (total < MIN_MOCKS_FOR_TENDENCIES) {
    return (
      <div className="flex h-full flex-col">
        <StripHeader>
          <h2 className="font-display text-[23px] font-bold text-white">Your tendencies</h2>
          <span className="text-xs tabular-nums text-white/50">
            {total} of {MIN_MOCKS_FOR_TENDENCIES} mocks
          </span>
        </StripHeader>
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-charcoal/60 p-8 text-center">
          <p className="max-w-[320px] text-sm text-white/60">
            Run a few more mocks and Juke will start showing your tendencies.
          </p>
          {/* The one real, non-misleading number worth stating below the
              threshold — how many mocks it's actually counted, not a
              placeholder pretending to be an insight. */}
          <p className="mt-3 text-xs tabular-nums text-white/40">
            {total} mock{total === 1 ? '' : 's'} logged so far
          </p>
        </div>
      </div>
    )
  }

  const cards = []

  if (stats.mostDrafted) {
    const pct = Math.round((stats.mostDrafted.count / stats.mostDrafted.total) * 100)
    cards.push(
      <Card key="mostDrafted" label="Most drafted">
        <p className="font-display text-[23px] font-bold text-white">{stats.mostDrafted.name}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-teal-400" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs tabular-nums text-white/55">
          {stats.mostDrafted.count} of {stats.mostDrafted.total}
        </p>
      </Card>
    )
  }

  if (stats.round1Position) {
    cards.push(
      <Card key="round1Position" label="Round 1 position">
        <div className="flex flex-col gap-2">
          {stats.round1Position.map((row) => (
            <div key={row.pos} className="grid grid-cols-[26px_1fr_34px] items-center gap-2">
              <span className="text-[10px] font-bold text-white/50">{row.pos}</span>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${row.pct}%`, background: POS_SOLID[row.pos] || 'rgba(255,255,255,0.3)' }}
                />
              </div>
              <span className="text-right text-[10px] tabular-nums text-white/70">{row.pct}%</span>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (stats.gradeLast12) {
    cards.push(
      <Card key="gradeLast12" label="Grade, last 12">
        <div className="flex h-[42px] items-end gap-1">
          {stats.gradeLast12.entries.map((e) => {
            const height = Math.max(4, Math.min(42, Math.round((e.score / 100) * 42)))
            const fill = e.score >= 80 ? '#00E5FF' : e.score >= 60 ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.18)'
            return (
              <div
                key={e.id}
                title={`${e.grade} (${e.score})`}
                className="flex-1 rounded-sm"
                style={{ height, background: fill }}
              />
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-white/55">{stats.gradeLast12.caption}</p>
      </Card>
    )
  }

  // bestMock and avgRosterVorp deliberately don't have cards here any more.
  // avgRosterVorp moved to DraftLocker's own hero-stat row (see the comment
  // there) — showing it twice on one screen is the same "which number do I
  // believe" problem CLAUDE.md's "one number may not have three names" rule
  // already covers. bestMock never moved anywhere: a single grade in a
  // 32px display font is the exact "failing grade as a badge of honor"
  // shape the hero-stat fix exists to remove, and it's the one card here
  // that stayed statistically thin even past the five-mock gate — it names
  // your best of N, which is a real fact at any N, but "best of 1" reads
  // no differently on screen than "best of 20."

  if (stats.weakestSpot) {
    cards.push(
      <Card key="weakestSpot" label="Weakest spot">
        <p className="font-display text-[23px] font-bold text-white">
          {{ QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end' }[stats.weakestSpot.pos]
            || stats.weakestSpot.pos}
        </p>
        <p className="mt-1 text-xs text-white/50">
          Below replacement in {stats.weakestSpot.pct}% of your rosters
        </p>
      </Card>
    )
  }

  // Per the handoff: a stat that can't be computed cleanly doesn't render a
  // placeholder — the whole strip is simply shorter. An empty result (every
  // entry pre-dates every new field) means no strip at all.
  if (cards.length === 0) return null

  return (
    <div className="flex h-full flex-col">
      <StripHeader>
        <h2 className="font-display text-[23px] font-bold text-white">Your tendencies</h2>
        <span className="text-xs text-white/50">Across all {stats.total} mocks</span>
      </StripHeader>
      {/* Four candidate cards, two columns — a clean 2x2 rather than the
          three-wide grid that left an empty bottom-right cell whenever a
          fifth card (now removed) made it three-on-top, two-below. Fewer
          than four real cards still lays out cleanly: a lone third card
          sits alone on the left of its row instead of leaving a
          conspicuous gap on the right of a wider row. */}
      <div className="grid grid-cols-2 gap-[10px]">{cards}</div>
    </div>
  )
}
