import { motion } from 'framer-motion'
import { POS_BADGE } from './draftRoomPositions.js'
import ShareBar from './ShareBar.jsx'

const ordinal = (n) => {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`
}

// The dark-charcoal container every data section here sits in — 1px border
// that subtly glows on hover, matching the card treatment the rest of the
// draft room already uses (same slate-800 border, same teal accent).
const PANEL =
  'rounded-2xl border border-slate-rule bg-slate-panel/60 transition-all duration-300 ' +
  'hover:border-teal-400/40 hover:shadow-[0_0_18px_rgba(0,229,255,0.12)]'

/* Four horizontal bars on one 0-100 scale, replacing the four-axis radar a
   design review flagged directly: two near-equal values read very
   differently depending on which axis they land on, and a radar has no
   way to show the weights or prove the components sum to the composite.
   A bar does both. Same component order and labels Analysis's own bars
   use, same weakest-only-warning-colour rule (the other three stay a
   neutral teal whatever their own score is), so a reader moving between
   the two screens never has to relearn what a colour means. */
function ComponentBars({ mine, weights }) {
  const bars = [
    { key: 'starters', label: 'Starter strength', pct: mine.startersScaled, weight: weights.starters },
    { key: 'value', label: 'Draft value', pct: mine.valueScaled, weight: weights.value },
    { key: 'build', label: 'Roster construction', pct: mine.buildScaled, weight: weights.build },
    { key: 'byes', label: 'Bye-week safety', pct: mine.byePenaltyScaled, weight: weights.byes },
  ]
  const weakest = bars.reduce((a, b) => (b.pct < a.pct ? b : a))

  return (
    <div>
      <div className="space-y-3">
        {bars.map((b) => {
          const isWeakest = b.key === weakest.key
          return (
            <div key={b.key}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-white/80">{b.label}</span>
                <span className="font-numeral text-ink-muted">wt {Math.round(b.weight * 100)}%</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, Math.min(100, b.pct))}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    className={'h-full rounded-full ' + (isWeakest ? 'bg-rose-400' : 'bg-teal-400')}
                  />
                </div>
                <span className={'w-8 shrink-0 text-right font-numeral text-sm font-bold ' + (isWeakest ? 'text-rose-400' : 'text-teal-300')}>
                  {Math.round(b.pct)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {/* The components must visibly add up to the composite in the
          summary card above — mine.total itself, never a local recompute,
          so this can never drift a decimal from what that card shows. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-rule/70 pt-3 text-xs">
        <span className="font-semibold uppercase tracking-wide text-teal-300">Weighted sum</span>
        <span className="flex-1 font-numeral text-ink-muted">{bars.map((b) => (b.pct * b.weight).toFixed(1)).join(' + ')}</span>
        <span className="font-numeral text-sm font-bold text-teal-300">= {mine.total.toFixed(1)}</span>
      </div>
      {/* A weight is not a share of the outcome, and the two are far enough
          apart on roster construction to be worth saying once.

          A component moves your placing in proportion to its weight AND to how
          much it varies across the room. Three of these are scaled against the
          room, so they are stretched to fill 0-100 whatever happened and their
          spread sits near 30 by construction. Roster construction is its own
          raw score and spreads about 9, because most rosters really are built
          alike — so at the same 15% weight it decides less of the order than
          the label alone suggests. Measured: 5.1% of the finishing order
          against a printed 15%.

          The weight is not wrong and was deliberately left at 0.15. Raising it
          to the 0.37 that would buy 15% of the outcome makes roster
          construction the joint-largest weight in a grade whose whole premise
          is that starters are worth double, and it would manufacture
          separation the data does not contain — which is the thing MIN_SPAN
          exists to prevent, reached from the other side. See CLAUDE.md. */}
      <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
        A weight is how much a component counts, not how much it separates the room. Roster
        construction is scored on its own scale rather than against the other teams, so it varies
        less and shifts the order less than its weight alone suggests.
      </p>
    </div>
  )
}

/* Each starter against the replacement baseline at his own position —
   engine.replacementGap(), the same un-clamped VORP figure the Juke score
   is built from, never a second computation. The center line IS the
   baseline: teal grows right for value above a replacement starter, red
   grows left for below. K/DST read a dash, not a bar — the projection
   can't rank those positions (see CLAUDE.md), and drawing a red bar from a
   number we refuse to trust elsewhere would be the withholding-has-to-be-
   complete bug all over again. */
function VorpRow({ seat, gap, maxAbs }) {
  const player = seat.player
  const width = gap !== null && maxAbs > 0 ? (Math.abs(gap) / maxAbs) * 100 : 0

  return (
    <div className="flex items-center gap-2">
      <span
        className={
          'w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ' +
          (player ? POS_BADGE[player.pos] || 'bg-white/10 text-white/50' : 'bg-white/5 text-ink-muted')
        }
      >
        {seat.slot}
      </span>
      <span className={'w-28 shrink-0 truncate text-xs sm:w-36 ' + (player ? 'font-medium text-white/85' : 'text-ink-muted')}>
        {player ? player.name : 'Empty'}
      </span>

      <div className="relative h-4 min-w-0 flex-1">
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
        {player && gap !== null && (
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${width / 2}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className={
              'absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm ' +
              (gap >= 0
                ? 'left-1/2 bg-gradient-to-r from-teal-500/80 to-teal-300 shadow-[0_0_8px_rgba(0,229,255,0.35)]'
                : 'right-1/2 bg-gradient-to-l from-rose-600/80 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.35)]')
            }
          />
        )}
      </div>

      <span
        className={
          'w-12 shrink-0 text-right text-xs font-semibold tabular-nums ' +
          (gap === null || !player ? 'text-ink-muted' : gap >= 0 ? 'text-teal-300' : 'text-rose-400')
        }
      >
        {!player || gap === null ? '—' : (gap >= 0 ? '+' : '') + Math.round(gap)}
      </span>
    </div>
  )
}

/* Below 10 points of replacement value, a "miss" is inside the forecast's
   own error — the 2026 projection runs at MAE 6.8 against actuals (see
   CLAUDE.md's Juke score section) — so accusing a pick over a single-digit
   delta would be reading precision into a number that doesn't carry it.
   Above it, the miss is worth saying out loud. */
const MISS_FLOOR = 10

// One centered-baseline bar, shared shape with the VORP rows: teal grows
// right for a pick that fell to you, red grows left for a reach — the same
// signed gap (pick number minus board rank) the grade's value component
// counts, in the same convention its callouts already print.
function TimelineRow({ pick, gap, maxAbs, shortName }) {
  const width = maxAbs > 0 ? (Math.abs(gap) / maxAbs) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[10px] font-bold text-ink-muted">R{pick.round}</span>
      <span
        className={
          'w-9 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-bold ' +
          (POS_BADGE[pick.player.pos] || 'bg-white/10 text-white/50')
        }
      >
        {pick.player.pos}
      </span>
      <span className="w-24 shrink-0 truncate text-xs font-medium text-white/85 sm:w-28">{shortName}</span>
      <div className="relative h-4 min-w-0 flex-1">
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${width / 2}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className={
            'absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm ' +
            (gap >= 0
              ? 'left-1/2 bg-gradient-to-r from-teal-500/80 to-teal-300 shadow-[0_0_8px_rgba(0,229,255,0.35)]'
              : 'right-1/2 bg-gradient-to-l from-rose-600/80 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.35)]')
          }
        />
      </div>
      <span
        className={
          'w-10 shrink-0 text-right text-xs font-semibold tabular-nums ' +
          (gap >= 0 ? 'text-teal-300' : 'text-rose-400')
        }
      >
        {(gap >= 0 ? '+' : '') + gap}
      </span>
    </div>
  )
}

// The "Draft Insights" tab — DraftRoom.jsx switches the view here itself
// the moment a draft concludes (see its draftIsOver effect) rather than
// waiting for a click, same reasoning as before: this is the most
// valuable screen in the app, so it must never be more than one press
// away from a finished board. Was a `fixed inset-0` modal reached only
// through a floating reopen pill; both are gone; a real tab on the same
// bar as Players/Board/Analysis needs neither. All of it is real: the
// grade is engine.draftAnalysis() — the identical analyseDraft() the
// legacy standings print — and every bar is replacementGap() over the
// real seated lineup.
//
// viewSlot is whose report this is — yours by default, any team's via the
// standings rows below or a board header click (DraftRoom owns the state
// so a header click can pick the team and switch to this tab in one
// gesture). Every figure derives from viewSlot; mySlot is only for
// telling "you" apart from a team that needs naming.
export default function DraftInsightsDashboard({ engine, league, mySlot, viewSlot, onViewSlot, onClose }) {
  const analysis = engine.draftAnalysis()
  const mine = analysis && analysis[viewSlot]
  if (!mine) return null

  // The same two actions AnalysisTab.jsx promotes to the top of its own
  // screen, for the identical reason: DraftRoom.jsx lands here first the
  // moment a draft ends, so whichever report a manager sees first has to
  // be the one that offers "what next" rather than making them go find
  // the other tab for it. engine.restart() is the exact bridge
  // AnalysisTab.jsx and DraftMenuOverlay's own kebab menu already share —
  // never a second reset. Close/Discard are not repeated here: there is
  // no modal left to close, and the kebab menu already reaches Discard/
  // Leave the room from every tab, this one included.
  const handleRunAnother = () => engine.restart()

  // Net ADP value is mine.value itself — analyseTeam()'s own unclamped
  // pick-number-minus-board-rank sum, never a second computation of the
  // same gap. Projected win % has no equivalent already sitting on the
  // analysis object, so it's the one figure here that asks the bridge for
  // something new — see the file comment above projectedWinPctForRoom() in
  // app.js for what it can and can't honestly claim.
  const winPcts = engine.winPctForRoom ? engine.winPctForRoom(analysis) : null
  const winPct = winPcts ? winPcts[viewSlot] : null

  // The real component weights (50/25/15/10), bridged — not hand-copied,
  // so this can never quote a stale percentage after WEIGHTS moves in
  // app.js. Same fallback AnalysisTab.jsx uses for the same reason.
  const weights = engine.weights ? engine.weights() : { starters: 0.5, value: 0.25, build: 0.15, byes: 0.1 }

  const isMe = viewSlot === mySlot
  const teamName = engine.teamLabel(viewSlot)
  // "you took" / "Bijan Mustard took"; "your pick" / "their pick".
  const subject = isMe ? 'you' : teamName
  const poss = isMe ? 'your' : 'their'

  /* mine.lineup, not engine.seatedLineup(viewSlot) — the two disagree on
     purpose and this panel needs the one seatedLineup() isn't.
     seatedLineup() fills FLEX with the first eligible player in *draft
     order*; mine.lineup is bestLineup()'s own output, already sitting on
     the analysis object, which fills it by aboveReplacement — the exact
     fix CLAUDE.md documents for the historical FLEX bug ("sorts by
     posRank, never aboveReplacement... a within-position measure cannot
     answer a between-position question"). analyseTeam()'s starter-strength
     score is computed from this same bestLineup() result, so reading
     seatedLineup() here instead means this panel's VORP matrix can credit
     a different player as the FLEX starter than the score two inches above
     it just counted — the same mismatch AnalysisTab.jsx's own file comment
     already warns against. No bench here either way; this panel only ever
     showed starters. */
  const seats = mine.lineup || []
  const gaps = seats.map((seat) => (seat.player ? engine.replacementGap(seat.player) : null))
  const maxAbs = Math.max(1, ...gaps.filter((g) => g !== null).map((g) => Math.abs(g)))

  /* mine.bargain itself, not gated on gap > 0 here — analyseTeam() (app.js)
     already picks whichever judged pick has the *highest* gap, positive or
     not, and never nulls it the way reach is (reach is nulled at gap >= 0,
     bargain never is). AnalysisTab.jsx and the legacy panel it matches both
     show "Best value" unconditionally on the same rule; gating it here too
     meant a team whose best pick still landed at-or-before its own board
     rank showed the card on one screen and not the other, for identical
     data. The gap sign still has to be checked before the label calls it
     "picks late", though — that part of AnalysisTab's rule is real. */
  const bargain = mine.bargain || null
  const reach = mine.reach || null

  const picks = engine.picks() || []
  // FORCED_LATE is a lookup object ({ K: true, DST: true }), not a list —
  // the same shape freelyChosen() in app.js tests it with.
  const forced = engine.forcedLate() || {}
  const teamPicks = picks.filter((p) => p.slot === viewSlot).slice().sort((a, b) => a.overall - b.overall)

  /* The value timeline judges only the picks this team was free to time —
     the same FORCED_LATE exclusion the grade's value component applies,
     and for the same documented reason: the app itself schedules kickers
     and defenses into the closing rounds, and their long-draft ADP makes
     every one of them read as a reach. Naming a kicker the worst pick was
     a real bug once; it does not come back through a new panel. */
  const timeline = teamPicks
    .filter((p) => !forced[p.player.pos])
    .map((p) => ({ pick: p, gap: p.overall - p.player.overall }))
  const tlMax = Math.max(1, ...timeline.map((t) => Math.abs(t.gap)))

  /* The one that got away: at each of this team's turns, the player somebody
     else took before their next turn who would have improved this lineup most.

     The scan used to live here and compared two bare replacementGap()
     readings — his against the pick actually made — which is a claim about
     the player pool with no reference to the roster it is advising. A team
     holding two elite tight ends was told it had missed a third; the
     subtraction was right and the advice was unusable, because he could never
     have started. engine.oneThatGotAway() runs the same window scan as a
     substitution through bestLineup(), beside the grade it belongs to, so a
     player who would not crack this lineup scores 0 and cannot be named.

     Still gated on MISS_FLOOR here: the delta is projected points on both
     sides of the change, which is the unit that floor was always written in. */
  const missed = engine.oneThatGotAway ? engine.oneThatGotAway(viewSlot) : null
  const realMiss = missed && missed.delta >= MISS_FLOOR ? missed : null

  const standings = analysis.slice().sort((a, b) => a.rank - b.rank)

  // Everything the share card draws, assembled from the same values the
  // summary card above renders — the card can never say something the
  // screen does not.
  const shareData = {
    teamName,
    leagueText: engine.settingsText(league),
    dateText: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    grade: mine.grade,
    rankText: ordinal(mine.rank),
    teams: league.teams,
    // No `total`. The card drew it as "x / 100 weighted score" under the
    // grade and no longer does; leaving the field here would be an invitation
    // to put the line back without the reasoning that took it out.
    components: mine,
    bestValue: bargain
      ? `${bargain.pick.player.name}${bargain.gap > 0 ? ` · ${bargain.gap} picks late` : ''}`
      : null,
    biggestReach: reach ? `${reach.pick.player.name} · ${Math.abs(reach.gap)} picks early` : null,
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate pb-64">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">Draft complete</p>
            <h1 className="font-display text-2xl font-bold text-white">
              Draft Insights <span className="text-ink-muted">·</span>{' '}
              <span className={isMe ? 'text-teal-300' : 'text-[#B784E0]'}>{teamName}</span>
            </h1>
          </div>
          {/* No close/X any more — this is a tab, not a modal, so there is
              nothing to dismiss. "Back to your team" stays: it's real
              navigation (this report can be showing someone else's team,
              via a board header click or a standings row below), not an
              exit action. */}
          {!isMe && (
            <button
              type="button"
              onClick={() => onViewSlot(mySlot)}
              className="shrink-0 rounded-full border border-teal-400/40 px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors duration-150 hover:border-teal-400 hover:bg-teal-400/10"
            >
              Back to your team
            </button>
          )}
        </div>

        {/* Summary card — the grade, large and glowing, in the two brand
            accents, with the rank beside it because the letter is handed out
            for finishing position: a grade without its rank invites the reader
            to take a room-relative ranking as an absolute verdict.

            The weighted total used to sit under the rank and no longer does.
            "A" over "69 / 100" asks a reader to hold two incompatible scales
            at once, and the familiar one wins — measured across a room, the
            letter agreed with the school reading of the number beneath it on
            0 of 10 teams. The rank says the same thing the letter does, in
            words nobody can misread. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          // sm:flex-wrap so the full-width ShareBar at the end of the card
          // breaks onto its own line under the grade and the callouts,
          // instead of being squeezed into the row as a third column.
          className={PANEL + ' flex flex-col items-center gap-4 p-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-8'}
        >
          <div className="flex items-center gap-5">
            <span className="bg-gradient-to-br from-[#00E5FF] to-[#7B1FA2] bg-clip-text font-display text-7xl font-black leading-none text-transparent sm:text-8xl">
              {mine.grade}
            </span>
            <div>
              <p className="font-display text-xl font-bold text-white">
                {ordinal(mine.rank)} <span className="text-ink-muted">of {league.teams}</span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/50">
                <span>
                  Net ADP value{' '}
                  <span className={'font-semibold ' + (mine.value >= 0 ? 'text-teal-300' : 'text-rose-400')}>
                    {mine.value >= 0 ? '+' : ''}{Math.round(mine.value)}
                  </span>
                </span>
                {typeof winPct === 'number' && (
                  <span>
                    Projected win % <span className="font-semibold text-teal-300">{Math.round(winPct * 100)}%</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs sm:text-right">
            {bargain && (
              <p className="text-white/60">
                <span className="font-semibold uppercase tracking-wide text-teal-400">Best value</span>{' '}
                {bargain.pick.player.name}
                {bargain.gap > 0 && <span className="text-ink-muted"> · {bargain.gap} picks late</span>}
              </p>
            )}
            {reach && (
              <p className="text-white/60">
                <span className="font-semibold uppercase tracking-wide text-rose-400">Biggest reach</span>{' '}
                {reach.pick.player.name} <span className="text-ink-muted">· {Math.abs(reach.gap)} picks early</span>
              </p>
            )}
          </div>

          <ShareBar shareData={shareData} />
        </motion.div>

        {/* The same two actions AnalysisTab.jsx promotes to the top of its
            own screen, and for the same reason — DraftRoom.jsx lands on
            this tab first the moment a draft ends, so this is the report
            most likely to be the only one somebody sees before deciding
            what's next. */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRunAnother}
            className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-4 py-2 text-xs font-bold text-white shadow-glass transition-transform duration-150 hover:scale-[1.02]"
          >
            Run another mock
          </button>
          <a
            href="#/drafts"
            className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/60 transition-colors duration-150 hover:border-teal-400/60 hover:text-teal-300"
          >
            Back to the locker
          </a>
        </div>

        {/* Sliding doors — the single biggest value upgrade that left the
            board between two of your turns. It is the strongest analytic in
            the product and the thing most likely to trigger another mock,
            so it gets a treatment nothing else on this screen has: its own
            accent colour (the same purple the missed player's own name
            already carries below) rather than the shared teal PANEL border,
            and its own number pulled out at scale rather than folded into
            the sentence where a reader has to go looking for it. When
            nothing clears MISS_FLOOR the panel says so in the positive,
            because that is a checkable claim about this draft, not an
            empty box — and the number is dropped rather than shown as a
            hollow zero, since there is no "amount forgone" to report. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="rounded-2xl border-2 border-[#B784E0]/40 bg-gradient-to-br from-[#B784E0]/[0.07] to-transparent p-5 transition-all duration-300 hover:border-[#B784E0]/70 hover:shadow-[0_0_20px_rgba(183,132,224,0.18)]"
        >
          <div className="flex flex-wrap items-center gap-5">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-[#B784E0]">
                The One That Got Away
              </h2>
              {realMiss ? (
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  <span className="font-semibold text-[#B784E0]">{realMiss.theirs.player.name}</span>{' '}
                  was still on the board when {subject} took {realMiss.mine.player.name} in round{' '}
                  {realMiss.mine.round} — {engine.teamLabel(realMiss.theirs.slot)} got him{' '}
                  {realMiss.theirs.overall - realMiss.mine.overall === 1
                    ? 'with the very next pick'
                    : `${realMiss.theirs.overall - realMiss.mine.overall} picks later`}
                  , and swapping him in would have made {poss} starting lineup this much stronger.
                </p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  Nothing got away. At every turn, nobody taken before {poss} next pick would have improved{' '}
                  {poss} starting lineup by more than the projection can honestly measure — that is the mark
                  of a draft with no real regrets in it.
                </p>
              )}
            </div>
            {realMiss && (
              <div className="shrink-0 text-right">
                <div className="font-display text-4xl font-black leading-none text-[#B784E0] sm:text-5xl">
                  +{Math.round(realMiss.delta)}
                </div>
                <div className="mt-1.5 font-numeral text-[9.5px] font-semibold uppercase tracking-wide text-ink-muted">
                  lineup points forgone
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Team analysis</h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-muted">The four grade components, scaled against the room</p>
            <ComponentBars mine={mine} weights={weights} />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">VORP matrix</h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-muted">
              Each starter against a replacement-level player at his position
            </p>
            <div className="flex flex-col gap-1.5">
              {seats.map((seat, i) => (
                <VorpRow key={i} seat={seat} gap={gaps[i]} maxAbs={maxAbs} />
              ))}
            </div>
            {/* The last clause is not decoration. Starter strength is a sum of
                the same points these rows print, so a reader can now add this
                panel up and check it — which they could not while the grade
                counted ADP rank places and this counted points. The two
                positions dashed here still go into that sum (5 to 29 points a
                team, measured across a room), and a footnote that stopped at
                "no bar is drawn" would leave the panel implying they were
                excluded. Dashing them is a refusal to *rank* them, which is
                what the backtest actually condemned; it was never a claim that
                their points did not happen. */}
            <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">
              Kickers and defenses show a dash: measured against three seasons of archived forecasts the
              projection ranks them no better than chance, so no bar is drawn from it. Their points still
              count toward starter strength — the rows above will add up to a little less than the grade uses.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className={PANEL + ' p-5'}
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Draft value timeline</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Where each pick landed against the board's rank — right means he fell to {isMe ? 'you' : 'them'}
                </p>
              </div>
              <span className="shrink-0 font-numeral text-[9.5px] font-semibold uppercase tracking-wide text-ink-muted">Unit: picks</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {timeline.map((t) => (
                <TimelineRow
                  key={t.pick.overall}
                  pick={t.pick}
                  gap={t.gap}
                  maxAbs={tlMax}
                  shortName={engine.shortName(t.pick.player)}
                />
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">
              Kickers and defenses sit this out too — the app schedules those picks itself, so their
              timing says nothing about the drafting.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Room standings</h2>
            {/* The score column is gone from between the rank and the letter.
                CLAUDE.md's standings rule was that whatever sits there has to
                be the weighted total, because a column showing anything else
                makes a strictly-ranked table look broken — and it once showed
                starter strength and did exactly that. Removing the column
                honours the same rule from the other side: the row is ordered
                by rank and labelled by a letter that means rank, so there is
                nothing left for a third number to disagree with. */}
            <p className="mb-3 mt-0.5 text-xs text-ink-muted">
              Best to worst — click any team to view their report
            </p>
            <div className="flex flex-col gap-1">
              {/* Each row is the switcher for this whole dashboard: the
                  viewed team carries the ring, your own row keeps its teal
                  name so "where am I" survives while reading somebody
                  else's report. */}
              {standings.map((t) => (
                <button
                  key={t.slot}
                  type="button"
                  onClick={() => onViewSlot(t.slot)}
                  className={
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-150 ' +
                    (t.slot === viewSlot
                      ? 'border border-teal-400/40 bg-teal-500/10 font-semibold text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white')
                  }
                >
                  <span className="w-5 shrink-0 text-right tabular-nums text-ink-muted">{t.rank}</span>
                  <span className={'min-w-0 flex-1 truncate ' + (t.slot === mySlot ? 'text-teal-300' : '')}>
                    {engine.teamLabel(t.slot)}
                  </span>
                  <span
                    className={
                      'w-8 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold ' +
                      (t.slot === viewSlot ? 'bg-teal-400/20 text-teal-300' : 'bg-white/5 text-white/50')
                    }
                  >
                    {t.grade}
                  </span>
                </button>
              ))}
            </div>
          </motion.section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mx-auto rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white/60 transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300"
        >
          View the full board
        </button>
      </div>
    </div>
  )
}
