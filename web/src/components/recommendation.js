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
// and onRunAtSeat both writes the seat New Mock's own "Your seat" row
// shows AND launches the draft with that exact seat, in one call — this
// is that button, pre-aimed at the exact seat and format actually worth
// practising. rec.seat is 1-based (it's what's printed on screen);
// onRunAtSeat wants a 0-based seat index, same as lobbySlot.
//
// This used to call two separate callbacks — onSetLobbySlot(seat) then
// onStartNew() — and it was a real, confirmed bug: onSetLobbySlot is a
// React state setter, so its update was still pending when onStartNew()
// ran the very next line, and onStartNew's own launch read the *previous*
// render's lobbySlot, not the one just set. The CTA read "Run Standard,
// seat 5" and started the draft from whatever seat the Lobby happened to
// already be on. onRunAtSeat takes the seat directly and starts the draft
// with it in the same call, rather than relying on a state update landing
// before the code right after it runs.
export function runRecommendation(engine, league, rec, onRunAtSeat) {
  if (rec.scoring) engine.setLeague({ scoring: rec.scoring })
  onRunAtSeat(rec.seat - 1)
}
