// A diagnosis with nowhere to act on it is just a complaint. historyStats()
// already computes formatSplit and seatSplit — real average scores grouped
// by scoring format and by front-third/back-third draft order, gated on
// their own minimum sample sizes in app.js — this turns whichever of those
// clears a real gap into one sentence and a button that actually sets up
// the underpracticed combination, rather than a tip pointing at nothing.
//
// Absent entirely when neither split clears GAP: a band asserting a pattern
// that isn't really there is worse than no band, the same rule every other
// tendency card on this screen already follows.
const GAP = 10 // points of average score — the same magnitude MISS_FLOOR
// and other "is this delta worth naming" thresholds already use elsewhere
// in this app, not a new number invented for this one card.

function buildRecommendation(stats, scoringNames) {
  if (!stats || (!stats.formatSplit && !stats.seatSplit)) return null

  const clauses = []
  let recScoring = null
  let recSeat = null // 'early' | 'late' | null

  if (stats.formatSplit && stats.formatSplit.length >= 2) {
    const best = stats.formatSplit[0]
    const worst = stats.formatSplit[stats.formatSplit.length - 1]
    if (Math.round(best.avg) - Math.round(worst.avg) >= GAP) {
      const bestName = scoringNames[best.scoring] || best.scoring
      const worstName = scoringNames[worst.scoring] || worst.scoring
      clauses.push(`score ${Math.round(best.avg)} on average in ${bestName} against ${Math.round(worst.avg)} in ${worstName}`)
      recScoring = worst.scoring
    }
  }

  if (stats.seatSplit) {
    const { early, late } = stats.seatSplit
    const gap = Math.round(early.avg) - Math.round(late.avg)
    if (Math.abs(gap) >= GAP) {
      if (gap > 0) {
        clauses.push(`score ${Math.round(early.avg)} from the front of the draft order against ${Math.round(late.avg)} from the back`)
        recSeat = 'late'
      } else {
        clauses.push(`score ${Math.round(late.avg)} from the back of the draft order against ${Math.round(early.avg)} from the front`)
        recSeat = 'early'
      }
    }
  }

  if (!clauses.length) return null
  const text = clauses.length === 2
    ? `You ${clauses[0]}, and ${clauses[1]}.`
    : `You ${clauses[0]}.`
  return { text, recScoring, recSeat }
}

export default function WhatToRunNext({ engine, league, stats, onSetLobbySlot, onStartNew }) {
  const scoringNames = engine.scoringNames() || {}
  const rec = buildRecommendation(stats, scoringNames)
  if (!rec) return null

  const formatLabel = scoringNames[rec.recScoring || league.scoring] || rec.recScoring || league.scoring
  const seatLabel = rec.recSeat === 'late' ? `seat ${league.teams}` : rec.recSeat === 'early' ? 'seat 1' : null
  const ctaLabel = 'Run ' + formatLabel + (seatLabel ? `, ${seatLabel}` : '')

  // Real setup, not a hint: setLeague() patches the one real league object
  // (the same one the New Mock panel already reads), the seat writes into
  // the same lobbySlot state that panel's own "Your seat" row shows, and
  // onStartNew is the identical launch this screen's primary button uses —
  // this is that button, pre-aimed at the config actually worth practising.
  const run = () => {
    if (rec.recScoring) engine.setLeague({ scoring: rec.recScoring })
    if (rec.recSeat) onSetLobbySlot(rec.recSeat === 'late' ? league.teams - 1 : 0)
    onStartNew()
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-5 rounded-xl border border-teal-400/30 bg-teal-400/[0.05] px-6 py-5">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-teal-300">What to run next</p>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">{rec.text}</p>
      </div>
      <button
        type="button"
        onClick={run}
        className="shrink-0 whitespace-nowrap rounded-lg bg-teal-400 px-[22px] py-3 text-[11px] font-bold uppercase tracking-wide text-obsidian transition-colors hover:bg-teal-300"
      >
        {ctaLabel}
      </button>
    </div>
  )
}
