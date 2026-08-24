import { useState } from 'react'
import { ChevronLeft, Share2, Check, Plus } from 'lucide-react'

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
//
// 1st/2nd/3rd/4th… for the mobile placement line ("4th of 12"). Small and
// self-contained rather than a dependency for four lines of arithmetic.
function ordinal(n) {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return n + 'th'
  switch (n % 10) {
    case 1: return n + 'st'
    case 2: return n + 'nd'
    case 3: return n + 'rd'
    default: return n + 'th'
  }
}

export default function AnalysisTab({ engine, league, picks, mySlot, onClose }) {
  const teams = league.teams

  /* Declared above the early return below so every hook still runs on
     every render regardless of which branch this component takes — a
     hook placed after an early return fires on some renders and not
     others, which is exactly the kind of bug React's own rules exist to
     catch. showAllTeams/shared belong to the mobile-only block below but
     live here for the same reason. */
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [showAllTeams, setShowAllTeams] = useState(false)
  const [shared, setShared] = useState(false)

  if (picks.length < teams) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate p-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-white/70">Nothing to grade yet</p>
          <p className="mt-1 text-xs text-ink-muted">
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
  // { starters: .50, value: .25, build: .15, byes: .10 } — read off the
  // engine (app.js's WEIGHTS, bridged for exactly this screen) rather than
  // hand-copied, so the mobile "NN% weight" rows can never quote a stale
  // percentage after WEIGHTS moves. Falls back to the documented values
  // only if an older bundle without the bridge entry is somehow live.
  const weights = engine.weights ? engine.weights() : { starters: 0.5, value: 0.25, build: 0.15, byes: 0.1 }

  const tone = (v) => (v >= 66 ? 'good' : v >= 33 ? 'neutral' : 'bad')
  const barFill = { good: 'bg-emerald-400', neutral: 'bg-teal-400', bad: 'bg-rose-400' }

  const bars = [
    { label: 'Starter strength', detail: Math.round(me.starters) + ' pts above replacement', pct: me.startersScaled, weight: weights.starters },
    { label: 'Draft value', detail: (me.value >= 0 ? '+' : '') + me.value + ' picks, K and D/ST aside', pct: me.valueScaled, weight: weights.value },
    { label: 'Roster construction', detail: me.build + ' / 100', pct: me.buildScaled, weight: weights.build },
    { label: 'Bye week safety', detail: engine.byeSummary(me.badWeeks), pct: me.byePenaltyScaled, weight: weights.byes },
  ]

  const standings = all.slice().sort((a, b) => a.rank - b.rank)

  // Mobile's collapsed room list: top three, plus your own row if you
  // aren't already in it — never a duplicate "you" row when you are.
  const topThree = standings.slice(0, 3)
  const mobileStandings = showAllTeams
    ? standings
    : topThree.some((t) => t.slot === mySlot)
      ? topThree
      : topThree.concat(standings.filter((t) => t.slot === mySlot))

  // The mobile grade header's one-sentence summary — the strongest and
  // weakest of the four *real* components (never the mock's invented
  // "Bench depth" row), plus the room's actual average composite. Every
  // number in it is read off `all`/`bars`, nothing here is a guess.
  const PHRASE = {
    'Starter strength': ['strong starters', 'weak starters'],
    'Draft value': ['sharp value', 'reach-heavy value'],
    'Roster construction': ['a deep bench', 'a thin bench'],
    'Bye week safety': ['bye-safe starters', 'bye-week exposure'],
  }
  const strongest = bars.reduce((a, b) => (b.pct > a.pct ? b : a))
  const weakest = bars.reduce((a, b) => (b.pct < a.pct ? b : a))
  const roomAverage = Math.round(all.reduce((s, t) => s + t.total, 0) / all.length)
  const goodPhrase = PHRASE[strongest.label][0]
  const summarySentence =
    goodPhrase.charAt(0).toUpperCase() + goodPhrase.slice(1) + ', ' + PHRASE[weakest.label][1] + '. ' +
    'The room averaged ' + roomAverage + '.'

  /* The exact "Discard draft" / "Leave the room" bridge DraftMenuOverlay's
     own kebab menu already uses (engine.restart() = clearSave() +
     goHome() in app.js) — not a second reset. "Run another mock" calls
     the identical function: a completed draft is already written into
     history the moment it finished (recordHistory(), fired off the same
     draftOver() edge that opens this report), so clearing the *active*
     save here throws nothing away — it only frees the slot so a new mock
     can start. Only the label, and whether a click needs confirming,
     differ by intent and by CLAUDE.md's own hard-won rule: mislabelling
     this exact action as "discard" when it actually just leaves a shared
     room was a real, documented bug. */
  const hasRoom = engine.hasRoom()
  const discardLabel = hasRoom ? 'Leave the room' : 'Discard this mock'
  const handleRunAnother = () => engine.restart()
  const handleDiscard = () => engine.restart()
  // Two-step confirm, mirroring DraftMenuOverlay's own confirmingDiscard
  // pattern exactly (same 4-second window, same "click again" relabel) —
  // reused rather than reinvented. Only the solo "Discard" path arms it;
  // "Leave the room" fires on one click there too, same as the kebab menu.
  const handleDiscardClick = () => {
    if (hasRoom || confirmingDiscard) { handleDiscard(); return }
    setConfirmingDiscard(true)
    setTimeout(() => setConfirmingDiscard(false), 4000)
  }

  // The mobile top bar's share icon. A real share action, not a dead
  // button: the Web Share sheet where it exists, otherwise the same
  // clipboard fallback ShareBar.jsx already uses elsewhere in this app.
  // Deliberately not the full share-card PNG (ShareBar.jsx/shareCard.js)
  // — that is a labelled row of three actions with its own status text,
  // not a single icon in a 62px bar, and this app already has one real
  // surface for that job. AbortError (the user closing the native sheet)
  // is a choice, not a failure, same rule ShareBar.jsx follows.
  const shareGrade = async () => {
    const text = me.grade + ' — ' + ordinal(me.rank) + ' of ' + teams + ' in my Juke mock draft.'
    const url = typeof location !== 'undefined' ? location.href : undefined
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'My Juke draft grade', text, url })
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url ? text + ' ' + url : text)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return
    }
  }

  // Shared verbatim between the mobile card and the desktop disclosure
  // below — the same paragraph, never a second wording of the same rules.
  const methodologyText = (
    <>
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
    </>
  )

  return (
    <>
      {/* Mobile-only top bar (Prompt 6 of the mobile handoff). DraftCockpitHeader
          stays mounted above this component at every width — it is a fixed,
          always-on 62px bar with its own back chevron, but on a phone its tab
          nav (Board/Analysis) is hidden below md and its "Draft complete" pill
          shares the row with an Autopick toggle and a kebab menu that mean
          nothing once the report is open. Rather than fork DraftRoom.jsx's
          shell for one screen, this bar matches its exact 62px height and a
          higher z-index, so on mobile it visually replaces DraftCockpitHeader
          for the one screen where "back" means "close this report," not "go to
          the locker." `lg:hidden` — at lg+ the Cockpit's own tab nav is back
          and this never renders. Solid background (no blur) so nothing of the
          bar underneath shows through. */}
      <header className="fixed inset-x-0 top-0 z-[55] flex h-[62px] shrink-0 items-center justify-between border-b border-white/[0.06] bg-slate px-2 lg:hidden">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close analysis"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors duration-150 active:bg-white/[0.06]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-plex text-[11px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          {done ? 'Draft complete' : 'Grade so far'}
        </span>
        <button
          type="button"
          onClick={shareGrade}
          aria-label="Share your grade"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors duration-150 active:bg-white/[0.06]"
        >
          {shared ? <Check className="h-5 w-5 text-teal-300" /> : <Share2 className="h-5 w-5" />}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate pb-64">
        {/* ============================= MOBILE ============================= */}
        <div className="mx-auto max-w-xl p-4 pt-5 sm:p-6 lg:hidden">
          <div className="flex items-start gap-3.5">
            <div className="flex h-[92px] w-[92px] shrink-0 flex-col items-center justify-center rounded-2xl border border-teal-400/25 bg-teal-400/[0.07]">
              <div className="font-display text-[38px] font-black leading-none text-teal-300">{me.grade}</div>
              <div className="mt-1.5 font-plex text-[11px] text-ink-muted">{Math.round(me.total)} / 100</div>
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="font-display text-[21px] font-extrabold leading-tight text-white">
                {ordinal(me.rank)} of {teams}
              </h2>
              <p className="mt-1.5 text-[14px] leading-snug text-white/55">{summarySentence}</p>
            </div>
          </div>

          <h3 className="mt-8 font-display text-lg font-extrabold text-white">How the grade is built</h3>
          <div className="mt-4 space-y-5">
            {bars.map((b) => {
              const t = tone(b.pct)
              const width = Math.max(2, Math.min(100, b.pct))
              const contributes = b.pct * b.weight
              return (
                <div key={b.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-bold text-white">{b.label}</span>
                    <span className={'shrink-0 font-plex text-[15px] font-bold ' + (t === 'bad' ? 'text-rose-400' : 'text-teal-300')}>
                      {Math.round(b.pct)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div className={'h-1.5 rounded-full transition-all duration-300 ' + barFill[t]} style={{ width: width + '%' }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-plex text-[11px] text-ink-muted">
                    <span>{Math.round(b.weight * 100)}% weight</span>
                    <span>contributes {contributes.toFixed(1)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
            <span className="text-[15px] font-bold text-white">Composite</span>
            <span className="font-plex text-[17px] font-bold text-teal-300">
              {me.total.toFixed(1)} <span className="text-ink-muted">&rarr;</span> {me.grade}
            </span>
          </div>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
            Every score is your value ranked against the other {teams - 1} teams, so 50 is the room average.
            Bars run one direction: right is better.
          </p>

          {/* Same behaviour as the desktop disclosure below (collapsed
              <details>, 70ch cap, identical wording) — mobile-width styling
              only, per the handoff's own instruction not to invent new
              behavior here. */}
          <details className="group mt-5 rounded-xl border border-slate-rule bg-slate-panel/40 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="block text-[14px] font-bold text-white">How this grade is calculated</span>
                <span className="mt-0.5 block text-[13.5px] text-ink-muted">The full method, in plain English</span>
              </span>
              <Plus className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-45" />
            </summary>
            <p className="mt-3 max-w-[70ch] text-[13.5px] leading-relaxed text-ink-muted">{methodologyText}</p>
          </details>

          <div className="mt-7 flex items-center justify-between">
            <h3 className="font-display text-lg font-extrabold text-white">The room</h3>
            <span className="font-plex text-[11px] text-ink-muted">{teams} teams</span>
          </div>
          <div className="mt-3 space-y-2">
            {mobileStandings.map((t) => {
              const mine = t.slot === mySlot
              return (
                <div
                  key={t.slot}
                  className={
                    'flex items-center gap-3 rounded-xl border px-3.5 py-3 ' +
                    (mine ? 'border-teal-400/40 bg-teal-400/[0.08]' : 'border-white/[0.06] bg-white/[0.02]')
                  }
                >
                  <span className="w-4 shrink-0 font-plex text-[12px] text-ink-muted">{t.rank}</span>
                  <span className={'min-w-0 flex-1 truncate text-[14px] font-bold ' + (mine ? 'text-teal-300' : 'text-white/85')}>
                    {mine ? 'You · seat ' + (t.slot + 1) : engine.teamLabel(t.slot)}
                  </span>
                  <span className={'shrink-0 font-plex text-[13.5px] font-semibold ' + (mine ? 'text-teal-300' : 'text-white/70')}>
                    {t.grade} &middot; {Math.round(t.total)}
                  </span>
                </div>
              )
            })}
          </div>
          {teams > mobileStandings.length || showAllTeams ? (
            <button
              type="button"
              onClick={() => setShowAllTeams((v) => !v)}
              className="mt-2.5 inline-block py-1.5 text-[13.5px] font-semibold text-ink-muted transition-colors duration-150 hover:text-teal-300"
            >
              {showAllTeams ? 'Show fewer ‹' : 'Show all ' + teams + ' ›'}
            </button>
          ) : null}

          {/* Four exits — Prompt 6's own review note: these were missing
              entirely before this pass. Only Discard confirms (the state and
              handler above, shared with the desktop buttons below), because
              nothing else here can lose a finished draft — it is already in
              history the moment the draft ended (see the comment above
              handleRunAnother). */}
          <div className="mt-8 space-y-2.5 border-t border-white/10 pt-6">
            <button
              type="button"
              onClick={handleRunAnother}
              className="flex h-[52px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-[15px] font-bold text-white shadow-glass transition-transform duration-150 active:scale-[0.98]"
            >
              Run another mock
            </button>
            <a
              href="#/drafts"
              className="flex h-[50px] w-full items-center justify-center rounded-full border border-white/15 text-[14px] font-semibold text-white/75 transition-colors duration-150 active:bg-white/[0.06]"
            >
              Back to the locker
            </a>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex h-12 flex-1 items-center justify-center rounded-full border border-white/15 px-2 text-center text-[13.5px] font-semibold leading-tight text-white/60 transition-colors duration-150 active:bg-white/[0.06]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDiscardClick}
                className={
                  'flex h-12 flex-1 items-center justify-center rounded-full border px-2 text-center text-[13.5px] font-semibold leading-tight transition-colors duration-150 ' +
                  (confirmingDiscard
                    ? 'border-rose-400 bg-rose-500/15 text-rose-300'
                    : 'border-rose-500/30 text-rose-400 active:bg-rose-500/10')
                }
              >
                {confirmingDiscard ? 'Click again' : discardLabel}
              </button>
            </div>
          </div>
        </div>

        {/* ============================= DESKTOP ============================= */}
        {/* Unchanged from before this pass — same structure, same classes,
            same content. This prompt is the mobile layout; the lg+ report
            below is deliberately untouched. */}
        <div className="mx-auto hidden max-w-6xl p-6 lg:block">
          <div className="flex items-center gap-4 rounded-xl border border-slate-rule bg-slate-panel/60 p-4 sm:p-5">
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

          <div className="mt-4 space-y-2.5">
            {bars.map((b) => {
              const t = tone(b.pct)
              const width = Math.max(2, Math.min(100, b.pct))
              return (
                <div key={b.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <b className="w-32 shrink-0 font-semibold text-white/80 sm:w-40">{b.label}</b>
                  <div className="h-1.5 min-w-[100px] max-w-[420px] flex-1 rounded-full bg-slate-rule">
                    <div className={'h-1.5 rounded-full transition-all duration-300 ' + barFill[t]} style={{ width: width + '%' }} />
                  </div>
                  <span className="shrink-0 text-ink-muted">{b.detail}</span>
                </div>
              )
            })}
          </div>

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
                    (me.reach.gap < -8 ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-rule bg-slate-panel/40')
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

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Starters on bye, by week</p>
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
                      : 'bg-slate-rule text-ink'
              return (
                <span key={w} className={'flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold ' + cls}>
                  {w}
                </span>
              )
            })}
          </div>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Room standings</p>
          <table className="mt-1.5 w-full text-xs">
            <tbody>
              {standings.map((t) => (
                <tr key={t.slot} className={t.slot === mySlot ? 'bg-[#FFD166]/10' : ''}>
                  <td className="py-1 pr-2 text-ink-muted">{t.rank}</td>
                  <td className="py-1 pr-2 font-medium text-white/80">{engine.teamLabel(t.slot)}</td>
                  <td className="py-1 pr-2 text-right font-semibold text-white/90">{Math.round(t.total)}</td>
                  <td className="py-1 text-right text-white/60">{t.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="mt-5">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-ink-muted hover:text-white/50">
              How this grade is calculated
            </summary>
            <p className="mt-2 max-w-[70ch] text-[11px] leading-relaxed text-ink-muted">{methodologyText}</p>
          </details>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 border-t border-slate-rule/80 pt-5">
            <a
              href="#/drafts"
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/60 transition-colors duration-150 hover:border-teal-400/60 hover:text-teal-300"
            >
              Back to the locker
            </a>
            <button
              type="button"
              onClick={handleRunAnother}
              className="rounded-full border border-teal-400/40 px-4 py-2 text-xs font-semibold text-teal-300 transition-colors duration-150 hover:border-teal-400 hover:bg-teal-400/10"
            >
              Run another mock
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/60 transition-colors duration-150 hover:border-teal-400/60 hover:text-teal-300"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDiscardClick}
              className={
                'rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-150 ' +
                (confirmingDiscard
                  ? 'border-rose-400 bg-rose-500/15 text-rose-300'
                  : 'border-rose-500/30 text-rose-400 hover:border-rose-500/60 hover:bg-rose-500/10')
              }
            >
              {confirmingDiscard ? 'Click again to discard' : discardLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
