import { useEffect, useState } from 'react'

/* The header's kickoff countdown — `KICKOFF 3D 07:14`.

   Two rules, and both are about what it does when it does not know.

   **It renders nothing rather than a placeholder.** `nextKickoff()` answers
   null for an unreachable ESPN, a changed response shape, a board where
   every game has kicked off, and the six months of the year with nothing
   scheduled at all. A countdown is read as a fact — a dash or a frozen
   `0D 00:00` in a pill labelled KICKOFF is a worse answer than an absent
   pill, which is the score strip's own contract ("it fails by
   disappearing") applied to the one other surface that reads the same feed.

   **It never fetches.** `primeScores()` is called once by the shell header,
   which is also what fills the strip's cache, and this component only ever
   reads the parsed result. Two components independently fetching a 220KB
   scoreboard to draw two different things off it is the "written down
   twice" rule with a network bill.

   The tick is 1s while a minute is the smallest unit shown, because the
   seconds column moves: `3D 07:14` is days + hours:minutes, so the last
   digit changes once a minute — but the interval has to be finer than the
   thing it drives or the display lags by up to its own period. 1000ms
   costs one cheap subtraction a second and keeps the minute honest. */

function format(ms) {
  if (ms <= 0) return null
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const hh = String(hours).padStart(2, '0')
  const mm = String(mins).padStart(2, '0')
  // Inside a day the D segment is noise, and dropping it is what keeps the
  // pill the same width all week rather than jumping when `0D` appears.
  return days > 0 ? `${days}D ${hh}:${mm}` : `${hh}:${mm}`
}

export default function KickoffPill({ className = '' }) {
  const [text, setText] = useState(null)

  useEffect(() => {
    let alive = true

    const read = () => {
      const engine = window.JukeEngine
      if (!engine || !engine.nextKickoff) return
      const at = engine.nextKickoff()
      if (alive) setText(at ? format(at - Date.now()) : null)
    }

    // One prime, then read on a timer. primeScores() resolves to null on any
    // failure rather than rejecting — an unhandled rejection on a page that
    // is otherwise fine is the thing the strip's own catch exists to stop.
    const engine = window.JukeEngine
    if (engine && engine.primeScores) engine.primeScores().then(read)
    read()

    const id = setInterval(read, 1000)
    return () => { alive = false; clearInterval(id) }
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
