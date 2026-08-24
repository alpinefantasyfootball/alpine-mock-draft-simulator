// The status strip — homepage v4 pass 2. Was Ticker.jsx, a horizontal-scroll
// marquee of six-to-seven scrolling facts; the v4 brief replaces that
// wholesale with a single-line bar that never scrolls and never disappears.
// Renamed rather than left as Ticker.jsx with new contents, because a file
// called that no longer describes what's in it — the same reason this
// project renames rather than repurposes elsewhere (see grep(1)'s own
// "check a new class name against the existing sheet" rule in CLAUDE.md).
//
// Every fact is read off the live board via the bridge, same contract the
// old ticker followed and the same one the rest of this page follows —
// nothing here is invented. "Live" and the free/no-account line are static
// product facts, not board data, so unlike the old ticker (which hid itself
// entirely with no board yet) this bar always renders; only the three
// data-dependent facts in the middle wait on window.JukeEngine.
import { useEffect, useState } from 'react'
import { parseGenerated } from './dataFreshness.js'

// One reader-local wall-clock time, not a relative "X hrs ago" — the v4
// draft's own example ("ADP refreshed 06:14 CT") is a clock reading, and the
// existing timeAgo() (dataFreshness.js) already owns the relative phrasing
// used everywhere else (the footer, the old ticker). Two different facts —
// "how long ago" vs "what time was it" — are allowed to read differently;
// CLAUDE.md's own note on this contradiction (the ADP feed vs the nightly
// rebuild) says to pick one *per instance*, not force one phrasing site-wide.
//
// hour12: false for the mockup's un-suffixed "06:14" shape. timeZoneName:
// 'short' reads the reader's own system zone — never the pipeline's UTC
// stamp printed raw, which CLAUDE.md is explicit is not a fact a reader can
// use.
function formatAdpTime(generated) {
  const ms = parseGenerated(generated)
  if (ms == null) return null
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }).format(ms)
  } catch (err) {
    return null
  }
}

// "10-team snake · 1QB / 2RB / 2WR / 1TE / 1FLEX" — every number read off
// league.starters/flex, never the mockup's literal "12-team" (this app's
// league defaults to 10, CLAUDE.md is explicit that's still true of every
// control on the setup screen). "Snake" is the one literal in here and it's
// a safe one: draft-engine.js has no other order to draw, so it isn't a
// fact that can drift the way a count or a date could.
function leagueShape(league) {
  const s = league.starters
  return `${league.teams}-team snake · ${s.QB}QB / ${s.RB}RB / ${s.WR}WR / ${s.TE}TE / ${league.flex}FLEX`
}

function useStatusStripData() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return

    // Same shape as ScoringDemoCard.jsx's own read(): re-run on "juke:header"
    // rather than once on mount, so a board that's still loading when this
    // effect first fires (see app.js's deferred-data boot) fills in once it
    // lands, instead of leaving this bar's middle group permanently empty.
    const read = () => {
      const meta = engine.playersMeta()
      const league = engine.league()
      if (!meta || !meta.count || !league) return

      setData({
        count: meta.count,
        adpTime: formatAdpTime(meta.generated),
        shape: leagueShape(league),
      })
    }

    read()
    window.addEventListener('juke:header', read)
    return () => window.removeEventListener('juke:header', read)
  }, [])

  return data
}

export default function StatusStrip() {
  const data = useStatusStripData()

  return (
    <div className="flex h-8 items-center gap-3 overflow-hidden whitespace-nowrap border-y border-white/5 bg-void px-4 font-plex text-[9.5px] font-medium uppercase tracking-[0.08em] text-white/50 md:gap-6 md:px-6">
      {/* Left: live dot + label. Always rendered — this is a fact about the
          product, not about the board, so it doesn't wait on data the way
          the three facts in the middle do. */}
      <div className="flex shrink-0 items-center gap-[7px]">
        <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-mint" aria-hidden="true" />
        <span className="text-mint">Live</span>
      </div>

      {/* Middle: the three data facts. Fact 3 (league shape) drops first on
          mobile per §3.9 via display:none, not overflow — a structural
          absence rather than a fragment. What's left (player count + ADP
          time) still doesn't reliably fit an narrow phone at full desktop
          gap sizing (measured: it doesn't, at 375px, with gap-6 — the raw
          overflow-hidden clip cut "ADP" mid-word, exactly the "clipped
          mid-word" failure CLAUDE.md's contrast/overflow notes warn about
          elsewhere in this project), so two things change together: gap-3
          on mobile instead of gap-6, and the ADP fact truncates with an
          ellipsis (min-w-0 + text-ellipsis) rather than a hard clip if a
          narrower phone still can't fit it whole. */}
      {data && (
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden md:gap-6">
          <span className="shrink-0 tabular-nums">{data.count} players</span>
          {data.adpTime && (
            <span className="min-w-0 overflow-hidden text-ellipsis">
              <span className="md:hidden">ADP {data.adpTime}</span>
              <span className="hidden md:inline">ADP refreshed {data.adpTime}</span>
            </span>
          )}
          <span className="hidden shrink-0 md:inline">{data.shape}</span>
        </div>
      )}

      {/* Right: free/no-account line. Always rendered, same reason as Live —
          ml-auto rather than living inside the middle flex group so it stays
          pinned right whether or not `data` has landed yet. */}
      <span className="ml-auto shrink-0 pl-3 md:pl-6">
        <span className="md:hidden">Free · no account</span>
        <span className="hidden md:inline">Free · no account needed</span>
      </span>
    </div>
  )
}
