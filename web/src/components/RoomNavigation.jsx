import { useEffect, useRef, useState } from 'react'
import RoomCard from './RoomCard.jsx'
import { DraftIcon, ProspectIcon, WaiverIcon, TradeIcon, StrategyIcon, LeagueIcon } from './icons.jsx'

// Icons are the only thing about a room this file gets to decide — the
// name, blurb, live flag and season all come from app.js's ROOMS via the
// bridge, so the header dropdown and this carousel read the same six rooms
// and cannot drift the way a second hardcoded list once did (it was missing
// "The League Room" entirely).
const ICON_BY_NAME = {
  'The Draft Room': DraftIcon,
  'The Prospect Room': ProspectIcon,
  'The Waiver Room': WaiverIcon,
  'The Trade Room': TradeIcon,
  'The Strategy Room': StrategyIcon,
  'The League Room': LeagueIcon,
}

function useRooms() {
  const [rooms, setRooms] = useState([])

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return
    setRooms(engine.rooms())
  }, [])

  return rooms
}

function getOffset(index, active, total) {
  const half = Math.floor(total / 2)
  let raw = index - active
  if (raw > half) raw -= total
  if (raw < -half) raw += total
  return raw
}

function getDims(width) {
  if (width < 640) return { cardW: 190, cardH: 250, spacingX: 120, spacingZ: 70, maxAbs: 1 }
  if (width < 1024) return { cardW: 220, cardH: 290, spacingX: 185, spacingZ: 105, maxAbs: 2 }
  return { cardW: 250, cardH: 320, spacingX: 232, spacingZ: 135, maxAbs: 2 }
}

function cardStyle(offset, dims) {
  const abs = Math.abs(offset)
  const dir = Math.sign(offset)
  const translateX = offset * dims.spacingX
  const translateZ = -abs * dims.spacingZ
  const rotateY = -dir * Math.min(abs * 30, 52)
  const scale = Math.max(1 - abs * 0.15, 0.55)
  const opacity = abs === 0 ? 1 : abs <= dims.maxAbs ? 0.62 : 0

  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: dims.cardW,
    height: dims.cardH,
    marginTop: -(dims.cardH / 2),
    marginLeft: -(dims.cardW / 2),
    transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
    opacity,
    zIndex: 50 - abs,
    pointerEvents: abs > dims.maxAbs ? 'none' : 'auto',
    transition: 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease',
  }
}

export default function RoomNavigation() {
  const rooms = useRooms()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dims, setDims] = useState(() => getDims(typeof window !== 'undefined' ? window.innerWidth : 1280))
  // A ref, not state — updated inside a touchmove handler that can fire
  // many times a second, and a swipe only needs to be decided once per
  // gesture rather than triggering a re-render on every pixel of movement.
  const touchState = useRef(null)

  useEffect(() => {
    function onResize() {
      setDims(getDims(window.innerWidth))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (paused || rooms.length === 0) return
    const id = setInterval(() => setActive((a) => (a + 1) % rooms.length), 4500)
    return () => clearInterval(id)
  }, [paused, rooms.length])

  if (rooms.length === 0) return null

  const prev = () => setActive((a) => (a - 1 + rooms.length) % rooms.length)
  const next = () => setActive((a) => (a + 1) % rooms.length)

  return (
    <div
      className="w-full overflow-x-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        role="group"
        aria-label="Rooms"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') prev()
          if (e.key === 'ArrowRight') next()
        }}
        onTouchStart={(e) => {
          touchState.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, swiped: false }
          setPaused(true)
        }}
        onTouchMove={(e) => {
          const start = touchState.current
          if (!start || start.swiped) return
          const dx = e.touches[0].clientX - start.x
          const dy = e.touches[0].clientY - start.y
          // Horizontal intent only — a mostly-vertical drag is the page
          // scrolling, not a swipe, and must not be eaten here.
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
          start.swiped = true
          if (dx < 0) next()
          else prev()
        }}
        onTouchEnd={() => {
          touchState.current = null
          setPaused(false)
        }}
        className="relative mx-auto w-full max-w-[900px] touch-pan-y outline-none"
        style={{ height: dims.cardH + 64, perspective: 1400 }}
      >
        {rooms.map((room, i) => {
          const offset = getOffset(i, active, rooms.length)
          const Icon = ICON_BY_NAME[room.name] ?? DraftIcon
          return (
            <div
              key={room.name}
              style={cardStyle(offset, dims)}
              onClick={() => setActive(i)}
              className="cursor-pointer"
            >
              <RoomCard room={{ ...room, icon: <Icon /> }} />
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous room"
          className="flex h-9 w-9 items-center justify-center rounded-full glass-panel text-white/70
                     transition-all duration-200 hover:scale-105 hover:text-teal hover:shadow-card-hover"
        >
          &larr;
        </button>

        <div className="flex items-center gap-2">
          {rooms.map((room, i) => (
            <button
              key={room.name}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Go to ${room.name}`}
              className={
                'h-1.5 rounded-full transition-all duration-300 ' +
                (i === active ? 'w-6 bg-teal' : 'w-1.5 bg-white/20 hover:bg-white/40')
              }
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          aria-label="Next room"
          className="flex h-9 w-9 items-center justify-center rounded-full glass-panel text-white/70
                     transition-all duration-200 hover:scale-105 hover:text-teal hover:shadow-card-hover"
        >
          &rarr;
        </button>
      </div>
    </div>
  )
}
