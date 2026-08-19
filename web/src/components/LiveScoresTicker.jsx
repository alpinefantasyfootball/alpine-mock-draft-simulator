import { useEffect, useState } from 'react'

// Real ESPN scores via the bridge — same fetchScores() the legacy score
// strip uses (same URL, same sessionStorage cache/TTL, same silent-fail
// contract), so there is exactly one place that knows the shape of an
// ESPN event. This just maps { state, detail } onto { live, status }.
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

function GameCard({ game }) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-5">
      {game.live && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
        </span>
      )}
      <span className="text-sm font-semibold text-white">{game.away}</span>
      <span className="font-mono text-sm font-bold text-slate-100">{game.awayScore}</span>
      <span className="text-slate-600">&ndash;</span>
      <span className="font-mono text-sm font-bold text-slate-100">{game.homeScore}</span>
      <span className="text-sm font-semibold text-white">{game.home}</span>
      <span className={`ml-1 text-xs font-medium ${game.live ? 'text-teal-300' : 'text-slate-400'}`}>
        {game.status}
      </span>
      <span className="ml-3 h-1 w-1 shrink-0 rounded-full bg-slate-700" aria-hidden="true" />
    </div>
  )
}

export default function LiveScoresTicker({ onGamesChange }) {
  const games = useGames()

  useEffect(() => {
    onGamesChange?.(games.length > 0)
  }, [games.length, onGamesChange])

  // Same contract as the legacy score strip: nothing to show (offseason, or
  // the fetch failed) means no bar at all, not an empty one.
  if (games.length === 0) return null

  return (
    <div className="group fixed inset-x-0 top-16 z-40 h-12 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
      <div
        className="h-full overflow-hidden"
        style={{ maskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)' }}
      >
        {/* A pure CSS animation, not a JS-driven one: it loops on the
            compositor thread with nothing for React or Framer Motion to
            recompute at the wraparound, which is what a restart-on-complete
            animate() call was measurably hitching on every 45s. Pausing on
            hover is animation-play-state, which genuinely holds position
            and resumes from there — no manual "resume from wherever it was"
            math to get wrong. */}
        <div className="flex h-full w-max animate-marquee items-center [animation-play-state:running] group-hover:[animation-play-state:paused]">
          <div className="flex h-full shrink-0 items-center">
            {games.map((g, i) => (
              <GameCard key={`a-${i}`} game={g} />
            ))}
          </div>
          <div className="flex h-full shrink-0 items-center" aria-hidden="true">
            {games.map((g, i) => (
              <GameCard key={`b-${i}`} game={g} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
