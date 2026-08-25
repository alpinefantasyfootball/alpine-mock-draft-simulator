// Turns stats.recommendation — the single (scoring format, seat) pair
// historyStats() already picked out in app.js — into the sentence and CTA
// label both WhatToRunNext.jsx's top strip and RecommendationEngine.jsx's
// own footer show. One function, so the two can never disagree on the
// wording either, not just on which pair they're pointing at.
export function describeRecommendation(stats, league, scoringNames) {
  const rec = stats && stats.recommendation
  if (!rec) return null

  const formatLabel = scoringNames[rec.scoring] || rec.scoring
  const text = `You average ${Math.round(rec.avg)} in ${formatLabel} from seat ${rec.seat}, ` +
    `against ${Math.round(rec.overallAvg)} everywhere else.`
  const ctaLabel = `Run ${formatLabel}, seat ${rec.seat}`

  return { rec, formatLabel, text, ctaLabel }
}

// Real setup, not a hint: setLeague() patches the one real league object,
// onSetLobbySlot writes the same lobbySlot state New Mock's own "Your seat"
// row shows, and onStartNew is the identical launch the primary Start
// button uses — this is that button, pre-aimed at the exact seat and
// format actually worth practising. rec.seat is 1-based (it's what's
// printed on screen); lobbySlot is 0-based (it's a seat index).
export function runRecommendation(engine, league, rec, onSetLobbySlot, onStartNew) {
  if (rec.scoring) engine.setLeague({ scoring: rec.scoring })
  onSetLobbySlot(rec.seat - 1)
  onStartNew()
}
