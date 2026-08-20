// Real grading only — every number here comes from engine.analyseDraft(),
// the exact function renderGrades() (app.js) calls, computed fresh on
// every render just like the legacy panel. This component reproduces
// that panel's structure state-for-state; it never re-derives a score.
//
// analyseDraft()'s per-team `.lineup` is built by bestLineup() (sorts by
// aboveReplacement, so it resolves the FLEX correctly between positions),
// which is deliberately NOT the same lineup RosterDock.jsx reads via
// seatedLineup() (fills slots in draft order). Reading anything off
// `.lineup` here rather than re-deriving it from seatedLineup() is what
// keeps this consistent with the grade CLAUDE.md documents — mixing the
// two back together is the exact starter-strength bug already fixed once.
export default function AnalysisTab({ engine, league, picks, mySlot }) {
  const teams = league.teams

  if (picks.length < teams) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0B0E14] p-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-white/70">Nothing to grade yet</p>
          <p className="mt-1 text-xs text-white/40">
            Analysis appears once the first round is done, and updates after every pick.
          </p>
        </div>
      </div>
    )
  }

  const DE = typeof window !== 'undefined' ? window.DraftEngine : null
  const all = engine.analyseDraft()
  const me = all[mySlot]
  const done = engine.draftOver()

  const tone = (v) => (v >= 66 ? 'good' : v >= 33 ? 'neutral' : 'bad')
  const barFill = { good: 'bg-emerald-400', neutral: 'bg-teal-400', bad: 'bg-rose-400' }

  const bars = [
    { label: 'Starter strength', detail: Math.round(me.starters) + ' pts above replacement', pct: me.startersScaled },
    { label: 'Draft value', detail: (me.value >= 0 ? '+' : '') + me.value + ' picks, K and D/ST aside', pct: me.valueScaled },
    { label: 'Roster construction', detail: me.build + ' / 100', pct: me.buildScaled },
    { label: 'Bye week safety', detail: engine.byeSummary(me.badWeeks), pct: me.byePenaltyScaled },
  ]

  const standings = all.slice().sort((a, b) => a.rank - b.rank)

  return (
    // pb-64 reserves the same clearance PlayerQueueSidebar's own list
    // does, below its Draft buttons — the fixed-position Draft Log &
    // Queue dock floats over the bottom-right of the viewport regardless
    // of which tab's content is scrolled underneath it, so the standings
    // table and method paragraph need the identical bottom padding or
    // they end up readable only by scrolling the dock out of the way.
    <div className="flex-1 overflow-y-auto bg-[#0B0E14] p-4 pb-64 sm:p-6">
      <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <div className="font-display text-4xl font-black text-teal-300">{me.grade}</div>
        <div>
          <h3 className="font-display text-base font-bold text-white">
            {done ? 'Final grade' : 'Grade so far'} — {me.rank} of {teams}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-white/50">
            {done ? 'Draft complete.' : 'Updates after every pick.'} Graded against the {teams - 1} teams in
            this room, not against the league at large.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {bars.map((b) => {
          const t = tone(b.pct)
          const width = Math.max(2, Math.min(100, b.pct))
          return (
            <div key={b.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <b className="font-semibold text-white/80">{b.label}</b>
                <span className="text-white/40">{b.detail}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-800">
                <div className={'h-1.5 rounded-full transition-all duration-300 ' + barFill[t]} style={{ width: width + '%' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Each callout stands on its own — a draft with nothing reached for
          still shows its best value, per CLAUDE.md's note on this exact
          panel ("they used to render as a pair or not at all"). */}
      {(me.bargain || me.reach) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {me.bargain && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Best value</div>
              <div className="mt-0.5 truncate text-sm font-medium text-white">{me.bargain.pick.player.name}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-white/50">
                Taken at {DE ? DE.pickCode(me.bargain.pick.overall, teams) : me.bargain.pick.overall}, board had
                him {me.bargain.pick.player.overall}
                {me.bargain.gap > 0 ? ` — ${me.bargain.gap} picks late` : ''}
              </div>
            </div>
          )}
          {me.reach && (
            <div
              className={
                'rounded-lg border p-3 ' +
                (me.reach.gap < -8 ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-800 bg-slate-900/40')
              }
            >
              <div className={'text-[10px] font-semibold uppercase tracking-wide ' + (me.reach.gap < -8 ? 'text-rose-400' : 'text-white/50')}>
                Biggest reach
              </div>
              <div className="mt-0.5 truncate text-sm font-medium text-white">{me.reach.pick.player.name}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-white/50">
                Taken at {DE ? DE.pickCode(me.reach.pick.overall, teams) : me.reach.pick.overall}, board had him{' '}
                {me.reach.pick.player.overall} — {Math.abs(me.reach.gap)} picks early
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-white/30">Starters on bye, by week</p>
      <div className="mt-1.5 flex gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 5).map((w) => {
          const n = me.byes[w] || 0
          const cls =
            n >= 4
              ? 'bg-rose-500/20 text-rose-300'
              : n === 3
                ? 'bg-amber-500/20 text-amber-300'
                : n === 2
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'bg-slate-800 text-white/30'
          return (
            <span key={w} className={'flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold ' + cls}>
              {w}
            </span>
          )
        })}
      </div>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-white/30">Room standings</p>
      <table className="mt-1.5 w-full text-xs">
        <tbody>
          {standings.map((t) => (
            <tr key={t.slot} className={t.slot === mySlot ? 'bg-[#FFD166]/10' : ''}>
              <td className="py-1 pr-2 text-white/40">{t.rank}</td>
              <td className="py-1 pr-2 font-medium text-white/80">{engine.teamLabel(t.slot)}</td>
              <td className="py-1 pr-2 text-right font-semibold text-white/90">{Math.round(t.total)}</td>
              <td className="py-1 text-right text-white/60">{t.grade}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-5 text-[11px] leading-relaxed text-white/40">
        Starter strength is 50% of the grade: every starter scored by how many places above replacement level
        they rank at their position, where replacement is {engine.replacementText()} for this {teams}-team
        league, which starts {engine.lineupText()}. Draft value is 25%: how far each player fell past their
        ADP when you took them, counting only the picks you were free to time — kickers and defenses are left
        out, because the room will not let anyone take one before the closing rounds and their ADP is set by
        longer drafts than this one. Roster construction is 15%, docking unfilled starting slots, spots spent
        on a quarterback, kicker or defense you can never start, and how far from startable your best benched
        running back and receiver are — nothing if either could start today. Bye week safety is the last 10%,
        charging every week that leaves more than two starters out — by the square of how many are missing
        beyond the second, so one week with four off costs more than two weeks with three. Each component is
        scaled against the other {teams - 1} teams before weighting.
      </p>
    </div>
  )
}
