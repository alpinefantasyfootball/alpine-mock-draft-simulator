import { useEffect, useState } from 'react'

// Every line here is read off the live board via the bridge. It used to be
// six invented stats — a mock-draft count and a bye-week clash rate with
// nothing behind them — presented as fact, which is exactly what this
// project's own pipeline refuses to do anywhere else. Those two have no
// real source (Juke keeps no usage analytics) and are dropped rather than
// replaced with a different invented number.
function useTickerItems() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return
    const board = engine.board()
    const league = engine.league()
    const meta = engine.playersMeta()
    const firstAt = (pos) => board.find((p) => p.pos === pos)

    const next = []
    if (meta) next.push(`${meta.count} players tracked · refreshed ${meta.generated}`)
    if (board[0]) next.push(`${board[0].name} is the top overall pick`)
    const firstQB = firstAt('QB')
    if (firstQB) next.push(`${firstQB.name} is the first quarterback off the board, at pick ${firstQB.overall}`)
    const firstTE = firstAt('TE')
    if (firstTE) next.push(`${firstTE.name} is the first tight end off the board, at pick ${firstTE.overall}`)
    if (league) next.push(`Kickers stay undrafted until round ${league.rounds - 1}`)
    setItems(next)
  }, [])

  return items
}

// The refresh stamp (first item) reads dimmer than the headlines — the
// design's own distinction between "when this was last true" and the facts
// themselves — everything else keeps the mint accent.
function TickerRow({ items, ariaHidden = false }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden}>
      {items.map((item, i) => (
        <span
          key={i}
          className={
            'flex shrink-0 items-center gap-[34px] whitespace-nowrap pl-[34px] font-plex text-xs ' +
            (i === 0 ? 'text-white/40' : 'text-mint')
          }
        >
          {item}
          <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
        </span>
      ))}
    </div>
  )
}

export default function Ticker() {
  const items = useTickerItems()
  if (items.length === 0) return null

  return (
    <div className="hidden h-9 border-t border-white/5 bg-[#0a0e12] md:block">
      <div
        className="relative h-full overflow-hidden"
        style={{ maskImage: 'linear-gradient(90deg, transparent, black 32px, black calc(100% - 32px), transparent)' }}
      >
        {/* Same CSS-marquee shape LiveScoresTicker.jsx's own comment
            explains: a native compositor-thread loop has no restart seam
            for React/Framer to hitch on at the wraparound, and
            animation-play-state gives a real, position-preserving pause on
            hover for free — a JS-driven animate() has neither. 64s to match
            the design's own reading speed for five short items; motion-
            reduce turns the loop off outright rather than merely slowing it,
            since a slow crawl is still motion someone asked not to see. */}
        <div className="flex h-full w-max items-center [animation-play-state:running] motion-reduce:!animate-none animate-[marquee_64s_linear_infinite] hover:[animation-play-state:paused]">
          <TickerRow items={items} />
          <TickerRow items={items} ariaHidden />
        </div>
      </div>
    </div>
  )
}
