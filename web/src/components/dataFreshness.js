// When the board was last rebuilt, said once.
//
// This existed twice and the two disagreed on screen by eleven hours. The
// header ticker read PLAYERS_META.generated — the pipeline's own stamp, the
// moment build_players.py actually wrote players.js — and rendered "230
// players · refreshed 17 hrs ago". The footer ran its own derivation off the
// `?v=` query on app.js's script tag and rendered "230 players tracked ·
// updated 6 hours ago", directly below it on the same page.
//
// PLAYERS_META.generated is the right source and the `?v=` stamp is not, which
// is worth stating plainly because the second one looks reasonable. `?v=` is a
// deploy marker, not a data marker: CLAUDE.md records that the nightly bumps it
// while a hand-run rebuild does not, and that a deploy touching only CSS bumps
// it while the board underneath is days old. It answers "when did this page
// last change", which is a different question from the one both lines ask.
//
// One fact, one derivation, one wording — the same rule the league shape and
// the scoring table are already held to.

// PLAYERS_META.generated is a raw pipeline timestamp — "2026-08-22 01:35 UTC" —
// meant for a build log, not a reader. Parsed by hand rather than handed to
// `new Date(str)`: that string isn't ISO 8601, so parsing it would be left to
// each browser's own legacy fallback (reliable in practice, not guaranteed by
// spec). Constructing the UTC timestamp explicitly removes the guesswork.
export function parseGenerated(stamp) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})\s*UTC$/.exec(stamp || '')
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  return Date.UTC(+y, +mo - 1, +d, +h, +mi)
}

// Same scale InProgressBand.jsx's own elapsed() already uses for a running
// draft, extended with a day step: a missed pipeline run is a real, visible
// possibility (CLAUDE.md — "even if every one comes back empty the list still
// earns its place"), not just a hypothetical to round away.
//
// Returns the stamp unchanged when it cannot be parsed, so a pipeline that
// changes its format degrades to printing something true and ugly rather than
// to printing "NaN hrs ago".
export function timeAgo(stamp) {
  const ms = parseGenerated(stamp)
  if (ms == null) return stamp
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// The whole line, so the two places that print it cannot word it differently
// either — "230 players · refreshed 17 hrs ago". Returns null when the bridge
// or the meta is not there, which is the score strip's contract: a fact we
// cannot state disappears rather than being guessed at.
export function freshnessLine() {
  const engine = typeof window !== 'undefined' ? window.JukeEngine : null
  const meta = engine && engine.playersMeta ? engine.playersMeta() : null
  if (!meta || !meta.count) return null
  return `${meta.count} players · refreshed ${timeAgo(meta.generated)}`
}
