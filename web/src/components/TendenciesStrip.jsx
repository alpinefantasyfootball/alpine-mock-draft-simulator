import { POS_SOLID, POS_NAMES } from './draftRoomPositions.js'
import GradeTrendChart from './GradeTrendChart.jsx'

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

// POS_NAMES (imported above, from draftRoomPositions.js) is shared between
// the weakest-spot card and its own paradox-resolving sentence — one
// lookup, not two copies drifting apart. weakestSpot itself can only ever
// be QB/RB/WR/TE (weakestStartingSpot() in app.js reads replacementGap()
// over the starting lineup, and K/DST are excluded from that measure the
// same way they're excluded from draft value elsewhere — see CLAUDE.md),
// but holeRounds' topOtherPos names whichever position filled that round
// most often, which is real and can be K or DST — a missing name here read
// as the literal code, lowercased ("a dst 7 of 14 times"), so both are
// covered even though only one card can ever ask for them.

function Card({ label, children }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-panel p-4">
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

export default function TendenciesStrip({ stats, onOpenAllDrafts }) {
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
    const remaining = MIN_MOCKS_FOR_TENDENCIES - total
    const pct = Math.max(0, Math.min(100, Math.round((total / MIN_MOCKS_FOR_TENDENCIES) * 100)))
    return (
      <div className="flex h-full flex-col">
        {/* Desktop: heading above a centred honest-line box, unchanged. */}
        <div className="hidden h-full flex-col lg:flex">
          <StripHeader>
            <h2 className="font-display text-[23px] font-bold text-white">Your tendencies</h2>
            <span className="text-xs tabular-nums text-white/50">
              {total} of {MIN_MOCKS_FOR_TENDENCIES} mocks
            </span>
          </StripHeader>
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-slate-panel/60 p-8 text-center">
            <p className="max-w-[320px] text-sm text-white/60">
              Run a few more mocks and Juke will start showing your tendencies.
            </p>
            {/* The one real, non-misleading number worth stating below the
                threshold — how many mocks it's actually counted, not a
                placeholder pretending to be an insight. */}
            <p className="mt-3 text-xs tabular-nums text-ink-muted">
              {total} mock{total === 1 ? '' : 's'} logged so far
            </p>
          </div>
        </div>

        {/* Mobile: one self-contained dashed panel, no separate heading
            above it — a 23px "Your tendencies" title plus a corner count
            plus a whole second box is three chrome elements standing over
            one sentence and a bar. A dashed border is this app's other tell
            for "not real data yet" (the same shape empty states elsewhere
            use), which a plain solid card doesn't say on its own. */}
        <div className="rounded-xl border border-dashed border-white/[0.16] p-5 lg:hidden">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Your tendencies</p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">
            {remaining} more mock{remaining === 1 ? '' : 's'} and Juke will start showing your patterns — which
            positions you reach for, and where you leave value on the board.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-teal-400" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 font-plex text-xs tabular-nums text-white/50">
              {total} of {MIN_MOCKS_FOR_TENDENCIES}
            </span>
          </div>
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

  if (stats.avgRoundByPosition) {
    // Replaces a round-1-only breakdown, which was RB or WR on virtually
    // every draft (ADP puts backs and receivers at the top of every board)
    // and so never varied enough to say anything. This is the average
    // round you land your *first* player at each position, across every
    // draft that ever had one — bar length is relative to the slowest
    // position in the list, not to the league's own round count, so the
    // card stays readable at any league size without a second prop.
    const maxRound = Math.max(...stats.avgRoundByPosition.map((row) => row.avgRound))
    cards.push(
      <Card key="avgRoundByPosition" label="Avg round by position">
        <div className="flex flex-col gap-2">
          {stats.avgRoundByPosition.map((row) => (
            <div key={row.pos} className="grid grid-cols-[26px_1fr_34px] items-center gap-2">
              <span className="text-[10px] font-bold text-white/50">{row.pos}</span>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(row.avgRound / maxRound) * 100}%`, background: POS_SOLID[row.pos] || 'rgba(255,255,255,0.3)' }}
                />
              </div>
              <span className="text-right text-[10px] tabular-nums text-white/70">Rd {row.avgRound.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (stats.gradeLast12) {
    const n = stats.gradeLast12.entries.length
    // The label used to say "last 12" over however many blocks actually
    // existed — true only once you have twelve. Below that it names the
    // real count instead of a number the data can't back up.
    cards.push(
      <Card key="gradeLast12" label={n < 12 ? `Grade, all ${n}` : 'Grade, last 12'}>
        <GradeTrendChart entries={stats.gradeLast12.entries} />
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
    const posName = POS_NAMES[stats.weakestSpot.pos] || stats.weakestSpot.pos
    const h = stats.holeRounds
    // "Most drafted" (a round-1 pick, above) and "weakest spot" read like a
    // contradiction sitting three inches apart until something names which
    // rounds actually carry the hole — h is only present when a real,
    // sampled round range backs that claim; without it this falls back to
    // the plain stat rather than asserting a range with nothing behind it.
    cards.push(
      <div
        key="weakestSpot"
        className={
          'rounded-xl border p-4 ' +
          (h ? 'border-rose-400/25 bg-rose-400/[0.04] sm:col-span-2' : 'border-white/[0.07] bg-slate-panel')
        }
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-300/90">
          Weakest spot{h ? ' — and it is not where you think' : ''}
        </p>
        {h ? (
          <p className="text-[15px] leading-[1.55] text-white/85">
            You finish below replacement at {posName} in {stats.weakestSpot.pct}% of your rosters. The hole isn't
            your first pick — it's rounds {h.startRound}–{h.endRound}, where you've taken a{' '}
            {(POS_NAMES[h.topOtherPos] || h.topOtherPos).toLowerCase()} {h.topOtherCount} of {h.total} times.
          </p>
        ) : (
          <>
            <p className="font-display text-[23px] font-bold text-white">{posName}</p>
            <p className="mt-1 text-xs text-white/50">Below replacement in {stats.weakestSpot.pct}% of your rosters</p>
          </>
        )}
      </div>
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
        <span className="flex items-center gap-3">
          <span className="text-xs text-white/50">Across all {stats.total} mocks</span>
          {onOpenAllDrafts && (
            <button
              type="button"
              onClick={onOpenAllDrafts}
              className="rounded-full border border-teal-400/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-teal-300 transition-colors duration-150 hover:border-teal-400/60 hover:bg-teal-400/10"
            >
              Full report
            </button>
          )}
        </span>
      </StripHeader>
      {/* Four candidate cards, two columns — a clean 2x2 rather than the
          three-wide grid that left an empty bottom-right cell whenever a
          fifth card (now removed) made it three-on-top, two-below. Fewer
          than four real cards still lays out cleanly: a lone third card
          sits alone on the left of its row instead of leaving a
          conspicuous gap on the right of a wider row. Single column below
          lg — two columns of a ~145px card is the same "wraps into an
          8px column of digits" squeeze the settings rows hit at panel
          width, just one component over. */}
      <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">{cards}</div>
    </div>
  )
}
