import { useEffect, useState } from 'react'

// Real ESPN scores via the bridge — same fetchScores() the legacy score
// strip uses (same URL, same sessionStorage cache/TTL, same silent-fail
// contract), so there is exactly one place that knows the shape of an ESPN
// event. This is LiveScoresTicker.jsx's own useGames(), carried over as-is:
// this component replaces where and how the games render, not where they
// come from.
function useGames() {
  const [games, setGames] = useState([])

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return
    let cancelled = false
    engine
      .fetchScores()
      .then((raw) => {
        if (cancelled) return
        setGames(
          raw.map((g) => ({
            away: g.away,
            home: g.home,
            awayScore: g.awayScore,
            homeScore: g.homeScore,
            status: g.detail,
            live: g.state === 'in',
          }))
        )
      })
      .catch(() => {
        // Fails the same way the legacy strip does: nothing shows.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return games
}

function GameChip({ game }) {
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-[10px] border border-white/[0.06] bg-[#0d1216] px-4 py-[10px]">
      {game.live && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
        </span>
      )}
      <span className="whitespace-nowrap font-plex text-[13px] font-semibold text-[#cbd5da]">
        {game.away} <span className="tabular-nums">{game.awayScore}</span>
        <span className="text-white/25"> — </span>
        <span className="tabular-nums">{game.homeScore}</span> {game.home}
      </span>
      <span className={'whitespace-nowrap font-plex text-[11.5px] ' + (game.live ? 'text-mint' : 'text-white/35')}>
        {game.status}
      </span>
    </div>
  )
}

// Not sticky, not a marquee — a normal in-flow section, horizontally
// scrollable rather than animated. LiveScoresTicker.jsx was `fixed`,
// overlaying content that had to reserve clearance for it (Homepage.jsx's
// hasScores/pt-28 toggle); this is a real section with its own place in the
// page, so nothing below it needs to know whether it rendered.
export default function ScoresStrip() {
  const games = useGames()

  // Same contract as the legacy score strip: nothing to show (offseason, or
  // the fetch failed) means no section at all, not an empty one.
  if (games.length === 0) return null

  return (
    <section id="scores" className="border-y border-white/[0.06] bg-[#090d10] px-6 py-5">
      <div className="mx-auto max-w-7xl">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-plex text-[11px] tracking-[0.11em] text-white/40">AROUND THE LEAGUE</span>
          {/* Out, not built: nothing in this app has ever tracked a full
              season's schedule — fetchScores() only ever asks ESPN for
              "now," with no date range — and the same "we link, we don't
              republish" rule the news headlines already follow applies
              here too. Same target/rel pattern LatestNewsTab.jsx uses for
              every outbound link. */}
          <a
            href="https://www.espn.com/nfl/schedule"
            target="_blank"
            rel="noopener noreferrer"
            className="font-plex text-[11px] text-white/40 transition-colors hover:text-white/70"
          >
            full schedule &rarr;
          </a>
        </div>

        <div className="scores-scroll flex gap-[10px] overflow-x-auto pb-1">
          {games.map((g, i) => (
            <GameChip key={i} game={g} />
          ))}
        </div>
      </div>
    </section>
  )
}
