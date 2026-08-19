import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

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

function TickerRow({ items, ariaHidden = false }) {
  return (
    <div className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={ariaHidden}>
      {items.map((item, i) => (
        <span key={i} className="flex shrink-0 items-center gap-3 whitespace-nowrap text-xs text-teal-300/90">
          {item}
          <span className="h-1 w-1 rounded-full bg-teal-500/50" />
        </span>
      ))}
    </div>
  )
}

export default function Ticker() {
  const items = useTickerItems()
  if (items.length === 0) return null

  return (
    <div
      className="hidden flex-1 overflow-hidden md:block"
      style={{ maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)' }}
    >
      <motion.div
        className="flex w-max"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
      >
        <TickerRow items={items} />
        <TickerRow items={items} ariaHidden />
      </motion.div>
    </div>
  )
}
