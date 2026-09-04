import { useEffect, useRef, useState } from 'react'

/* The header's kickoff countdown — `KICKOFF 3D 07:14`.

   ---- It counts down from an instant it holds, not from the score cache ----

   This is the fix for the bug it shipped with, and the shape of the fix is
   the interesting part. The first version asked `nextKickoff()` on every
   tick, and `nextKickoff()` reads `cachedScores()`, which returns null once
   the entry is more than SCORES_TTL (60s) old. `primeScores()` ran once, at
   mount. So the pill counted down correctly for one minute and then removed
   itself, permanently, on every page anybody left open — measured at a
   73-second-old cache with sixteen perfectly good `pre` games in it.

   The naive repair is to re-prime on a timer under the TTL, and that is
   wrong twice: it puts a network request a minute behind every open tab,
   and it keeps a countdown coupled to a cache it has no reason to care
   about. **A kickoff time does not change.** Once this knows the instant,
   it can count to it locally for ever. So the instant is held in a ref and
   the feed is asked again only when the held one has passed — the game has
   started and the next one is a different game — throttled so an off-season
   with no fixtures at all cannot turn into a polling loop.

   ---- What it does when it does not know ----

   Renders nothing. `nextKickoff()` answers null for an unreachable ESPN, a
   changed response shape, a board where everything has kicked off, and the
   six months a year with nothing scheduled. A countdown is read as a fact,
   so a dash or a frozen `0D 00:00` in a pill labelled KICKOFF is a worse
   answer than an absent pill — the score strip's own "it fails by
   disappearing" contract, applied to the one other surface reading that
   feed.

   ---- Seconds, and why only inside a day ----

   Days out, the design's own value is `3D 07:14` and minutes are the right
   granularity. Inside a day the pill ticks every second, which is when a
   countdown is actually being watched — and `07:14:32` is the same
   character count as `3D 07:14`, so the widest form never grows.

   That width is load-bearing rather than tidy. Below `sm` this sits on the
   hero's eyebrow row, measured at 375px: the row is 335px, the eyebrow
   takes 194, leaving 141 for the pill against the ~118 it wants. Adding a
   seconds field to the days form takes it to ~139 — inside 141 by two
   pixels, which is not a margin on a row that has already had to be fixed
   for overflow once. */

const PRIME_THROTTLE_MS = 30000

function format(ms) {
  if (ms <= 0) return null
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const p = (n) => String(n).padStart(2, '0')
  return days > 0 ? `${days}D ${p(hours)}:${p(mins)}` : `${p(hours)}:${p(mins)}:${p(secs)}`
}

export default function KickoffPill({ className = '' }) {
  const [text, setText] = useState(null)
  const atRef = useRef(null)
  const primedAtRef = useRef(0)

  useEffect(() => {
    let alive = true

    /* Ask the feed for a kickoff instant, at most once per throttle window.
       primeScores() resolves to null on any failure rather than rejecting —
       an unhandled rejection on a page that is otherwise fine is the thing
       the score strip's own catch exists to stop. */
    const refresh = () => {
      const engine = window.JukeEngine
      if (!engine || !engine.nextKickoff) return
      const at = engine.nextKickoff()
      if (at) {
        atRef.current = at
        return
      }
      const now = Date.now()
      if (now - primedAtRef.current < PRIME_THROTTLE_MS) return
      primedAtRef.current = now
      if (engine.primeScores) {
        engine.primeScores().then(() => {
          if (!alive) return
          const next = engine.nextKickoff && engine.nextKickoff()
          if (next) atRef.current = next
        })
      }
    }

    const tick = () => {
      // Only go back to the feed when there is nothing to count to, or when
      // what we were counting to has already happened.
      if (!atRef.current || atRef.current <= Date.now()) {
        atRef.current = null
        refresh()
      }
      if (!alive) return
      setText(atRef.current ? format(atRef.current - Date.now()) : null)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  if (!text) return null

  return (
    <span
      className={
        'shrink-0 whitespace-nowrap rounded-full border border-flow-pillEdge bg-flow-pill ' +
        'px-2.5 py-[5px] font-mono text-[11px] leading-none tracking-[0.1em] text-voidInk-primary ' +
        'lg:px-3 lg:py-1.5 ' + className
      }
    >
      KICKOFF {text}
    </span>
  )
}
