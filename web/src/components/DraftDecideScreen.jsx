import { ChevronRight, Sparkles } from 'lucide-react'
import { POS_BADGE, POS_SOLID } from './draftRoomPositions.js'
import QueueList from './QueueList.jsx'

function round1(v) {
  return v == null ? null : Math.round(v)
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// One function for verdict word, colour and the matching action — so a
// not-your-turn card can't say "safe to wait" in emerald and then hand
// you a rose Draft-now button underneath it. Thresholds are round numbers
// chosen for legibility, not fit to anything; survivalProbability() is
// the real measurement, this only buckets it into three sentences.
function verdictFor(survival) {
  if (survival == null) return { label: 'Unranked market', color: 'text-white/50', action: 'Draft' }
  if (survival < 0.2) return { label: 'Take him now', color: 'text-rose-300', action: 'Draft' }
  if (survival < 0.65) return { label: 'Coin flip', color: 'text-amber-300', action: 'Queue him' }
  return { label: 'Safe to wait', color: 'text-emerald-300', action: 'Leave him' }
}

function whatItDoes(engine, player, vorp) {
  const fit = engine.draftFit(player)
  const vorpText = vorp != null ? ` ${vorp >= 0 ? '+' : ''}${Math.round(vorp)} points above replacement.` : ''
  if (fit && fit.startsNow) return `Fills your ${ordinal(fit.have + 1)} ${player.pos} slot.${vorpText}`
  return `Bench depth at ${player.pos}.${vorpText}`
}

// A design review flagged this directly: the recommended card's own Juke
// score can print lower than a sibling's ("Juke's pick" at 57 next to a
// 59), and a reader's first conclusion is that the app recommended the
// worse player. It didn't — suggestions() ranks by ADP, need and risk
// alongside the model's opinion (see CLAUDE.md's "The suggestions"
// section), on purpose, so it can rank a lower-scoring player above a
// higher-scoring one when the higher scorer doesn't fill a real need or
// is riskier. Re-sorting the cards by the number shown would undo that —
// the fix is to say the actual reason a card won its slot instead of
// leaving a bare number to imply one that may not be true.
function reasonFor(rankLabel, candidate, engine) {
  if (rankLabel === 'Scarcest') {
    return candidate.tierLeft != null
      ? `Only ${candidate.tierLeft} left in his tier — the run won't wait.`
      : "Thin at his position — the run won't wait."
  }
  if (rankLabel === 'Safest wait') return 'Deepest tier of the three — the least urgent pick here.'
  // 'Also available' — a candidate too far below replacement for
  // "scarce"/"safe" to mean anything (see BAD_VORP below).
  if (rankLabel === 'Also available') return "Nobody's rushing for him — pure bench depth at this point."
  const fit = engine.draftFit(candidate.player)
  return fit && fit.startsNow ? 'Best value for a slot you still need to fill.' : 'Best value still on the board.'
}

function Card({ candidate, rankLabel, primary, onDraft, myTurn, engine }) {
  const { player, vorp, juke, survival, nextOverall } = candidate
  const proj = typeof player.projPts === 'number' ? Math.round(player.projPts) : null
  const risky = survival != null && survival < 0.4

  return (
    <div
      className={
        'flex flex-col rounded-xl border p-[18px] ' +
        (primary ? 'border-teal-400/35 bg-gradient-to-b from-teal-400/[0.08] to-transparent' : 'border-white/[0.08] bg-white/[0.02]')
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <span className={'rounded px-[9px] py-1 text-[10px] font-bold ' + (POS_BADGE[player.pos] || 'bg-white/10 text-white/60')}>
          {player.pos}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">{rankLabel}</span>
      </div>

      <div className="font-display text-[32px] font-bold leading-none text-white">{player.name}</div>
      <div className="mb-3 text-xs text-white/60">
        {player.team} · bye {player.bye || '—'}
        {player.tier ? ` · tier ${player.tier}` : ''}
      </div>

      {/* The reason this card won its slot, not just a number a reader has
          to compare against the other two cards themselves. */}
      <div className="mb-3 text-sm font-semibold leading-[1.4] text-teal-200">{reasonFor(rankLabel, candidate, engine)}</div>

      <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg bg-white/[0.03] px-3 py-2.5">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-muted">VORP</div>
          <div className="font-plex text-lg font-bold tabular-nums text-emerald-300">
            {vorp != null ? `${vorp >= 0 ? '+' : ''}${Math.round(vorp)}` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Juke score</div>
          <div className="font-plex text-lg font-bold tabular-nums text-teal-300">{juke ?? '—'}</div>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Proj</div>
          <div className="font-plex text-lg font-bold tabular-nums text-white">{proj ?? '—'}</div>
        </div>
      </div>

      <div className="mb-2 rounded-lg bg-white/[0.04] p-3">
        <div className="mb-[5px] text-[10px] font-bold uppercase tracking-[0.09em] text-white/50">What it does</div>
        <div className="text-sm leading-[1.45] text-white/90">{whatItDoes(engine, player, vorp)}</div>
      </div>

      {survival != null && (
        <div className={'mb-4 rounded-lg p-3 ' + (risky ? 'bg-rose-500/10' : 'bg-emerald-500/10')}>
          <div className={'mb-[5px] text-[10px] font-bold uppercase tracking-[0.09em] ' + (risky ? 'text-rose-300' : 'text-emerald-300')}>
            If you wait
          </div>
          <div className={'text-sm leading-[1.45] ' + (risky ? 'text-rose-200' : 'text-emerald-200')}>
            {risky
              ? `Gone before pick ${nextOverall} in ${Math.round((1 - survival) * 100)}% of boards.`
              : `Still there at ${nextOverall} in ${Math.round(survival * 100)}% of boards.`}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onDraft(player)}
        disabled={!myTurn}
        className={
          'mt-auto w-full rounded-lg py-[13px] text-sm font-bold transition-all duration-200 ' +
          (!myTurn
            ? 'cursor-not-allowed bg-white/5 text-white/25'
            : primary
              ? 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-glass hover:scale-[1.02]'
              : 'bg-white/[0.06] text-white/85 hover:bg-white/10')
        }
      >
        Draft {player.name}
      </button>
    </div>
  )
}

function SurvivorCard({ candidate, engine, onQueueToggle, onDraft, myTurn, queued }) {
  const { player, survival } = candidate
  const verdict = verdictFor(survival)
  const pct = survival != null ? Math.round(survival * 100) : null
  const barColor = survival == null ? 'bg-white/20' : survival < 0.2 ? 'bg-rose-400' : survival < 0.65 ? 'bg-amber-300' : 'bg-emerald-400'

  const act = () => {
    if (verdict.action === 'Draft') onDraft(player)
    else if (verdict.action === 'Queue him') onQueueToggle(player.name)
    // "Leave him" does nothing — that's the point of it.
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className={'rounded px-2 py-0.5 text-[10px] font-bold ' + (POS_BADGE[player.pos] || 'bg-white/10 text-white/60')}>
          {player.pos}
        </span>
        <span className={'text-[10px] font-bold uppercase tracking-[0.08em] ' + verdict.color}>{verdict.label}</span>
      </div>
      <div className="mb-3 font-display text-[23px] font-bold leading-tight text-white">{player.name}</div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className={'font-display text-[32px] font-bold leading-[0.95] ' + verdict.color}>{pct != null ? `${pct}%` : '—'}</span>
        <span className="text-xs text-white/55">still there</span>
      </div>
      <div className="mb-3 h-[5px] overflow-hidden rounded-full bg-white/[0.09]">
        <div className={'h-full rounded-full ' + barColor} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <button
        type="button"
        onClick={act}
        disabled={verdict.action === 'Draft' && !myTurn}
        className="w-full rounded-lg border border-[#FFD166]/45 bg-[#FFD166]/10 py-2.5 text-xs font-bold text-[#FFD166] transition-colors hover:bg-[#FFD166]/[0.18] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {verdict.action === 'Queue him' && queued ? 'Queued' : verdict.action}
      </button>
    </div>
  )
}

export default function DraftDecideScreen({ engine, league, mySlot, myTurn, picks, onDraft, onQueueToggle, onOpenProfile, queuedNames, nextOverall, nextPicks, onOpenHub }) {
  // A finished draft has no decision left to make — suggestions('ALL')
  // returns nothing, survivalProbability() has no next pick to check
  // against, and the not-your-turn cards would otherwise show three
  // "Unranked market" verdicts, a label built for an unrankable *player*
  // (K/DST), not for "there is no more draft." The real end-of-draft
  // banner and report are a later phase — this is just the guard against
  // rendering something confusing in the meantime, since finishing a
  // draft while sitting on this tab is one click away for anyone.
  if (engine.draftOver()) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <div className="mb-1 font-display text-[32px] font-bold text-white">Draft complete</div>
          <p className="text-sm text-white/60">
            {picks.length} picks made. See the Board or Analysis tab for the finished draft.
          </p>
        </div>
      </div>
    )
  }

  // nextOverall/nextPicks come from DraftRoom.jsx now, not computed here —
  // PickClockBand.jsx needs the identical values above the tab strip on
  // every tab, not just Decide, and this off-by-one (skip my own current
  // pick when it's genuinely my turn) already cost one design-review round
  // to get right. Lifting it to one call site is what stops a second copy
  // drifting from this one; see DraftRoom.jsx's own comment on both values.
  const lineup = engine.seatedLineup(mySlot)
  const counts = engine.filterCounts()
  const needRows = ['QB', 'RB', 'WR', 'TE']
    .map((pos) => ({ pos, ...(counts ? counts[pos] : { have: 0, need: 0 }) }))

  const raw = engine.suggestions('ALL').slice(0, 3)
  const candidates = raw.map((player) => ({
    player,
    // Rounded once, here, rather than at each place a card or a row
    // prints it — overallScore()/replacementGap() are real-valued
    // (Jahmyr Gibbs's own 100 is a coincidence of being the best score
    // on the board, not evidence the function rounds).
    vorp: round1(engine.replacementGap(player)),
    tierLeft: engine.tierRemaining(player),
    juke: round1(engine.overallScore(player)),
    survival: engine.survivalProbability(player, nextOverall),
    nextOverall,
  }))

  // Index 0 is already "Juke's pick" (suggestions() is best-first). Of the
  // other two, whichever has fewer players left in his own tier is the
  // scarcer one — the other gets "Safest wait" by elimination, so the two
  // labels can never both land on the same card.
  let rankLabels = ['Juke’s pick', 'Scarcest', 'Safest wait']
  if (candidates.length === 3 && candidates[2].tierLeft < candidates[1].tierLeft) {
    rankLabels = ['Juke’s pick', 'Safest wait', 'Scarcest']
  }
  // "Scarcest" means "grab him before the tier runs out" — a claim that
  // only makes sense if the tier is worth being in. Late rounds routinely
  // hand suggestions() three below-replacement players with nothing else
  // left to rank them by, and stamping the deepest-negative one
  // "Scarcest" reads as advice to rush a player who isn't worth having.
  // Caught by a design review against a real −100 VORP card.
  const BAD_VORP = -30
  rankLabels = rankLabels.map((label, i) => {
    const c = candidates[i]
    if ((label === 'Scarcest' || label === 'Safest wait') && c && c.vorp != null && c.vorp < BAD_VORP) {
      return 'Also available'
    }
    return label
  })

  const others = engine.suggestions('ALL').slice(3, 7).map((player) => ({
    player,
    vorp: round1(engine.replacementGap(player)),
    juke: round1(engine.overallScore(player)),
  }))

  // Room-live rail. Last 10 for the strip, last 6 for the sentence — same
  // slice the strip's own tail already is, not a second read of picks()
  // that could disagree with what's drawn.
  const last10 = picks.slice(-10)
  const last6 = picks.slice(-6)
  const posCounts = {}
  last6.forEach((p) => { posCounts[p.player.pos] = (posCounts[p.player.pos] || 0) + 1 })
  let runPos = null, runCount = 0
  Object.entries(posCounts).forEach(([pos, n]) => { if (n > runCount) { runCount = n; runPos = pos } })
  const runDepth = runPos ? engine.positionDepthRemaining(runPos) : null

  const boardForQueue = engine.board()
  // The count both mobile-only labels print — "N available" over the cards
  // and "Browse all N players" under them. One read of the same board array
  // the queue below already resolves against, never a second call that
  // could answer differently between two lines of the same screen.
  const availableCount = boardForQueue.filter((p) => !p.drafted).length
  const queue = engine
    .queue()
    .map((name) => boardForQueue.find((p) => p.name === name))
    .filter(Boolean)

  const survivalOfName = (p) => engine.survivalProbability(p, nextOverall)

  return (
    /* flex-col below lg, grid at lg+ — not grid-cols-1 at every width down
       to a lg:grid-cols override. A single-column grid still lays its
       children out as auto-placed rows, and an auto-sized grid row inside a
       container with a definite height (this one: min-h-0 flex-1, a fixed
       share of the viewport) stretches to fill leftover space by default —
       align-content: stretch, dividing the height evenly across all three
       rows whether or not their content actually fills it. That is
       invisible on the desktop 3-COLUMN grid, where three equal-height
       columns is the point, and only appears once grid-cols-1 turns those
       columns into rows: three panels each hard-capped to roughly a third
       of the screen with their own internal scrollbar, rather than one page
       that scrolls through Your team, then the cards, then The room live in
       reading order. flex-col's main axis does not stretch children to fill
       leftover space by default, which is the actual fix — every child
       below also drops its own overflow-y-auto down to lg:, since a
       naturally-sized flex child needs no scroll container of its own; the
       one on this wrapper is what scrolls the whole stack on a phone. */
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(58px+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[300px_minmax(0,1fr)_330px] lg:overflow-hidden lg:pb-0">
      {/* ---------- STILL TO FILL, mobile (handoff PROMPT 4) ----------
          The desktop rail below is 644px tall on a 390px phone — nine lineup
          rows, four need bars and the next-picks chip set — and it used to sit
          above the recommendation cards, so the one thing this screen exists
          for started a screen and a half below the fold on a 60-second clock.
          This is what replaces it: what is still owed, and a tap through to the
          Roster tab for everything else. That tab is not a second surface —
          onOpenHub('team') opens the same PlayerHub sheet MobileDraftTabBar's
          own Roster button does.

          Two lines, not one. The label and the "Roster ›" link share the first;
          the chips get the second to themselves. A single row does fit — I
          measured the one-line version at 390px with these exact labels and it
          came back at zero overflow, so the handoff's stated reason (an 8px
          overrun) does not reproduce here. It is still the better shape: the
          chips are a readout and the link is the only tappable thing in the
          block, and a row that mixes the two invites a tap on a chip. Splitting
          them also leaves room for a fifth chip if the lineup ever grows one,
          which is the case the handoff says breaks a single row outright.

          The denominator only prints while it is still owed. CLAUDE.md's rule
          is that a fraction is a promise about its denominator, and "1/1" in a
          success colour reads as a cap when a second tight end is an ordinary
          pick — so a met requirement drops to the bare count and goes solid,
          and the dashed border carries "still owed" the rest of the time. */}
      {onOpenHub && (
        <div className="shrink-0 border-b border-white/[0.06] px-4 py-2.5 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <span className="font-plex text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-muted">
              Still to fill
            </span>
            <button
              type="button"
              onClick={() => onOpenHub('team')}
              className="-my-2 flex h-11 items-center gap-0.5 text-[13px] font-semibold text-teal-300"
            >
              Roster
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {needRows.map((r) => {
              const met = r.need > 0 && r.have >= r.need
              return (
                <span
                  key={r.pos}
                  className={
                    'rounded-[5px] border px-2 py-1 font-plex text-[11px] font-semibold ' +
                    (met
                      ? 'border-white/10 bg-white/[0.07] text-white/70'
                      : 'border-dashed border-white/[0.14] bg-white/[0.045] text-ink-muted')
                  }
                >
                  {r.pos} {met ? r.have : `${r.have}/${r.need}`}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Roster rail — desktop only, see the strip above. */}
      <div className="hidden border-white/[0.06] px-[18px] py-5 lg:block lg:overflow-y-auto lg:border-r">
        <div className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Your team</div>
        <div className="mb-5 flex flex-col gap-1">
          {lineup.seats.map((s, i) => (
            <div key={i} className="grid h-8 grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-2.5">
              <span className={'rounded py-0.5 text-center text-[10px] font-bold ' + (s.player ? POS_BADGE[s.player.pos] || 'bg-white/10 text-white/60' : 'bg-white/5 text-ink-muted')}>
                {s.slot}
              </span>
              <span className={'truncate text-xs font-medium ' + (s.player ? 'text-white' : 'text-ink-muted')}>
                {s.player ? s.player.name : '—'}
              </span>
              {s.player && (
                <span className="text-[10px] tabular-nums text-emerald-300">
                  {(() => { const g = engine.replacementGap(s.player); return g != null ? `${g >= 0 ? '+' : ''}${Math.round(g)}` : '' })()}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mb-5 border-t border-white/[0.07] pt-[18px]">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Still to fill</div>
          <div className="flex flex-col gap-2.5">
            {needRows.map((r) => (
              <div key={r.pos} className="grid grid-cols-[34px_minmax(0,1fr)_34px] items-center gap-2.5">
                <span className="text-xs font-bold text-white/70">{r.pos}</span>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-teal-400"
                    style={{ width: `${r.need ? Math.min(100, (r.have / r.need) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-right text-[10px] tabular-nums text-white/60">{r.text}</span>
              </div>
            ))}
          </div>
        </div>

        {nextPicks.length > 0 && (
          <div className="seat-wash rounded-lg p-3.5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#FFD166]">Your next picks</div>
            <div className="flex flex-wrap gap-[7px]">
              {nextPicks.map((overall) => {
                const code = window.DraftEngine ? window.DraftEngine.pickCode(overall, league.teams) : overall
                return (
                  <span key={overall} className="rounded bg-white/10 px-2.5 py-1 font-plex text-xs font-semibold text-[#FFD166]">
                    {code}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Centre */}
      <div className="min-w-0 px-[22px] py-5 lg:overflow-y-auto">
        {myTurn ? (
          <>
            {/* One heading again, and it is the live one. An earlier pass
                gave the phone its own "Three ways to go" plus a count, from
                the first handoff's mock; the revision asks for this heading
                at 19px/800 on a phone with its real subline, and it is
                right — the subline is the sentence that says the numbers on
                these cards are the same ones the grade uses, which is the
                whole claim, and a bare count said nothing a reader needed.
                Size and the icon are what differ by width, not the words. */}
            <div className="mb-1 flex items-center gap-2.5">
              <Sparkles className="hidden h-4 w-4 text-teal-300 lg:block" />
              <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-white lg:font-display lg:text-[32px] lg:font-bold lg:leading-none lg:tracking-normal">
                What Juke would do
              </h2>
            </div>
            <p className="mb-4 text-[13.5px] text-white/60 lg:text-sm">Three options, ranked. Every number is the same one the grade uses.</p>

            <div className="mb-[18px] grid grid-cols-1 gap-3.5 md:grid-cols-3">
              {candidates.map((c, i) => (
                <Card key={c.player.name} candidate={c} rankLabel={rankLabels[i]} primary={i === 0} onDraft={onDraft} myTurn={myTurn} engine={engine} />
              ))}
            </div>

            {/* Back on the phone. An earlier pass hid this below lg and left
                "Browse all N players" as the only way past the three cards;
                the revision keeps both, and the two do different jobs — this
                is the next four names at a glance, that is the whole board
                when you want to search it.

                Two changes make it work at 358px rather than just fit. The
                column pair is labelled `VORP · JUKE` in the header, because
                desktop leaves it unlabelled and an unlabelled number pair on
                a phone is unreadable. And the per-row Draft control takes
                the 44px tap floor rather than a 34px chip: it is a real
                action against a running clock, so it is not exempt. */}
            {others.length > 0 && (
              <div>
                <div className="mb-2.5 flex items-baseline justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Everyone else</span>
                  <span className="font-plex text-[10px] text-ink-muted lg:hidden">VORP &middot; JUKE</span>
                </div>
                {/* Column heads — a design review caught "+64 · 38 · Draft"
                    with nothing saying which number was which. */}
                <div className="hidden h-5 grid-cols-[30px_minmax(0,1fr)_60px_64px_70px] items-center gap-3.5 px-3 text-[9px] font-semibold uppercase tracking-wide text-ink-muted lg:grid">
                  <span />
                  <span />
                  <span className="text-right">VORP</span>
                  <span className="text-right">Juke</span>
                  <span />
                </div>
                <div className="flex flex-col gap-1">
                  {others.map((o) => (
                    <div
                      key={o.player.name}
                      onClick={() => onOpenProfile(o.player)}
                      className="grid h-11 cursor-pointer grid-cols-[30px_minmax(0,1fr)_60px_64px_70px] items-center gap-3.5 rounded-md px-3 transition-colors hover:bg-white/[0.05] lg:h-10"
                    >
                      <span className="text-[10px] font-bold text-white/55">{o.player.pos}</span>
                      <span className="truncate text-sm font-medium text-white">{o.player.name}</span>
                      <span className="text-right text-xs tabular-nums text-white/85">
                        {o.vorp != null ? `${o.vorp >= 0 ? '+' : ''}${Math.round(o.vorp)}` : '—'}
                      </span>
                      <span className="text-right text-xs font-semibold tabular-nums text-teal-300">{o.juke ?? '—'}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDraft(o.player) }}
                        className="h-11 rounded-full border border-teal-400/40 text-xs font-bold text-teal-300 lg:h-auto lg:border-0 lg:bg-teal-400/[0.14] lg:py-1.5"
                      >
                        Draft
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="mb-1 font-display text-[32px] font-bold leading-none text-white">
              Who's still here at {nextOverall ?? '—'}
            </h2>
            <p className="mb-4 text-sm text-white/60">Same three cards, different question. Survival odds run off the board's own ADP distribution.</p>

            <div className="mb-4 grid grid-cols-1 gap-3.5 md:grid-cols-3">
              {candidates.map((c) => (
                <SurvivorCard
                  key={c.player.name}
                  candidate={c}
                  engine={engine}
                  onQueueToggle={onQueueToggle}
                  onDraft={onDraft}
                  myTurn={myTurn}
                  queued={queuedNames.has(c.player.name)}
                />
              ))}
            </div>

            <div className="rounded-lg bg-white/[0.035] p-3.5">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-white/55">Your queue · while you wait</span>
                <div className="flex-1" />
                <span className="text-xs text-white/55">Autopick will take #1 if you're away</span>
              </div>
              <QueueList players={queue} myTurn={myTurn} engine={engine} survivalOf={survivalOfName} />
            </div>
          </>
        )}
        {/* The mobile exit to the full board, on both turn states — the
            handoff draws it under the three cards on 1c, and it is the
            other half of dropping "Everyone else" above: three
            recommendations plus one door to all 217, rather than three
            recommendations and an arbitrary four more. */}
        {onOpenHub && (
          <button
            type="button"
            onClick={() => onOpenHub('players')}
            className="mt-4 flex h-[46px] w-full items-center justify-center gap-1.5 rounded-[10px] border border-white/[0.12] text-[14.5px] font-semibold text-white/65 lg:hidden"
          >
            Browse all {availableCount} players
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Room-live rail — desktop only. On a phone the same information has
          a better home already: the Board tab's own "Log ›" button
          (DraftBoardGrid.jsx) opens PlayerHub's Log tab, which is the full
          pick history rather than the last nine, and the board itself shows
          the position runs this rail summarises. Artboard 1c draws neither
          on the phone for that reason. */}
      <div className="hidden border-white/[0.06] px-[18px] py-5 lg:block lg:overflow-y-auto lg:border-l">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">The room, live</div>

        {runPos && runCount >= 3 && (
          <div className="mb-4 rounded-lg bg-white/[0.04] p-3.5">
            <div className="mb-2.5 text-sm font-semibold text-white">{runPos} run</div>
            <div className="mb-2.5 flex gap-1">
              {last10.map((p, i) => (
                <span key={i} className="h-5 flex-1 rounded-sm" style={{ background: POS_SOLID[p.player.pos] || 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
            <div className="text-xs leading-[1.5] text-white/60">
              {runCount} of the last {last6.length} were {runPos}s.
              {runDepth != null ? ` ${runDepth} left above replacement.` : ''}
            </div>
          </div>
        )}

        <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Last picks</div>
        <div className="flex flex-col gap-[3px]">
          {picks.slice(-9).reverse().map((p) => {
            const code = window.DraftEngine ? window.DraftEngine.pickCode(p.overall, league.teams) : p.overall
            const mine = p.slot === mySlot
            return (
              <div
                key={p.overall}
                className={'grid h-[30px] grid-cols-[36px_minmax(0,1fr)] items-center gap-2.5 rounded-[5px] border-l-2 px-2 ' + (mine ? 'seat-wash border-[#FFD166]' : 'border-transparent')}
              >
                <span className="font-plex text-[10px] text-white/50">{code}</span>
                <span className="flex min-w-0 items-baseline gap-[7px]">
                  <span className={'shrink-0 whitespace-nowrap text-xs font-medium ' + (mine ? 'text-[#FFD166]' : 'text-white')}>{p.player.name}</span>
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[10px] text-white/50">{p.player.team}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
