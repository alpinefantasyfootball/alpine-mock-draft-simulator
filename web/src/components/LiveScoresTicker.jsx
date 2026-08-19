import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

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

// A full 0% -> -50% pass, at rest. Duration for a resumed (shorter) leg is
// scaled proportionally so speed stays constant across pause/resume.
const DURATION = 45

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
  const x = useMotionValue(0) // percent, ranges 0 -> -50
  const xPercent = useTransform(x, (v) => `${v}%`)
  const active = useRef(null)

  useEffect(() => {
    onGamesChange?.(games.length > 0)
  }, [games.length, onGamesChange])

  const playFrom = (fromValue) => {
    active.current?.stop()
    const distanceLeft = Math.abs(-50 - fromValue) // 0..50
    const duration = DURATION * (distanceLeft / 50)
    active.current = animate(x, -50, {
      duration,
      ease: 'linear',
      onComplete: () => {
        x.set(0)
        active.current = animate(x, -50, {
          duration: DURATION,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'loop',
        })
      },
    })
  }

  useEffect(() => {
    playFrom(0)
    return () => active.current?.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePause = () => active.current?.stop()
  const handleResume = () => playFrom(x.get())

  // Same contract as the legacy score strip: nothing to show (offseason, or
  // the fetch failed) means no bar at all, not an empty one.
  if (games.length === 0) return null

  return (
    <div
      className="fixed inset-x-0 top-16 z-40 h-12 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md"
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
    >
      <div
        className="h-full overflow-hidden"
        style={{ maskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)' }}
      >
        <motion.div className="flex h-full w-max items-center" style={{ x: xPercent }}>
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
        </motion.div>
      </div>
    </div>
  )
}
