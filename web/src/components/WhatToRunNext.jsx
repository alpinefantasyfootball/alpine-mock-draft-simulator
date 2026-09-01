import { describeRecommendation, runRecommendation } from './recommendation.js'

// A diagnosis with nowhere to act on it is just a complaint. stats.recommendation
// is the single (format, seat-third) pair historyStats() already picked out
// in app.js — see its own comment for the gap test and the GAP floor — so
// this component only ever turns that one real fact into a sentence and a
// button that actually sets up the underpracticed combination, rather than
// a tip pointing at nothing. describeRecommendation()/runRecommendation()
// are shared with RecommendationEngine.jsx's own footer, so the two can
// never point at, or word, a different recommendation.
//
// Absent entirely when nothing clears the gap: a band asserting a pattern
// that isn't really there is worse than no band, the same rule every other
// tendency card on this screen already follows.
export default function WhatToRunNext({ engine, league, stats, roomActive, onRunAtSeat }) {
  const scoringNames = engine.scoringNames() || {}
  const info = describeRecommendation(stats, league, scoringNames)
  if (!info) return null

  const run = () => runRecommendation(engine, league, info.rec, onRunAtSeat)

  // Disabled with the reason beside it, never disabled and silent — the
  // same rule NewMockPanel.jsx's own Teams/Scoring selects already follow
  // once a room exists. Neither half of this CTA means anything in a room:
  // the seat comes from claiming a chair, not lobbySlot, and the scoring
  // format is the room's, not this browser's to silently rewrite — which
  // is exactly what it used to do, with no lock check at all, unlike every
  // other control on this screen that can change league shape.
  return (
    <div className="mb-5 flex flex-wrap items-center gap-5 rounded-xl border border-teal-400/30 bg-teal-400/[0.05] px-6 py-5">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-teal-300">What to run next</p>
        <p className="mt-2 text-[15px] leading-relaxed text-white/85">{info.text}</p>
        {roomActive && <p className="mt-1.5 text-[11px] text-white/40">Not available in a room — seat and scoring are the room's.</p>}
      </div>
      <button
        type="button"
        onClick={run}
        disabled={roomActive}
        title={roomActive ? "Not available in a room" : undefined}
        className={
          'shrink-0 whitespace-nowrap rounded-lg px-[22px] py-3 text-[11px] font-bold uppercase tracking-wide transition-colors ' +
          (roomActive
            ? 'cursor-not-allowed bg-white/10 text-white/30'
            : 'bg-teal-400 text-obsidian hover:bg-teal-300')
        }
      >
        {info.ctaLabel}
      </button>
    </div>
  )
}
