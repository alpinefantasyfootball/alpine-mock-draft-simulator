import { useEffect, useRef, useState } from 'react'
import RoomCard from './RoomCard.jsx'
import ComingSoonModal from './ComingSoonModal.jsx'
import { DraftIcon, ProspectIcon, WaiverIcon, TradeIcon, StrategyIcon, LeagueIcon } from './icons.jsx'

// Icons are the only thing about a room this file gets to decide — the
// name, blurb, lead, live flag and season all come from app.js's ROOMS via
// the bridge, so this grid and the header's own rooms panel (if one is ever
// built again) read the same six rooms and cannot drift the way a second
// hardcoded list once did (it was missing "The League Room" entirely).
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

// Replaces the 3D coverflow carousel this file used to be — the brief's own
// complaint about it was real: only one card fully legible at a time, with
// touch/keyboard/resize logic just to look at the other five. A plain grid
// shows all six at once, which is the actual goal of a "here's everything
// Juke does" section on a marketing page.
export default function RoomsGrid() {
  const rooms = useRooms()
  const modalRef = useRef(null)

  if (rooms.length === 0) return null

  const liveCount = rooms.filter((r) => r.live).length
  const soonCount = rooms.length - liveCount

  return (
    <section id="rooms" className="border-t border-white/[0.06] bg-[#080b0e] px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-11 flex flex-wrap items-end justify-between gap-12">
          <div className="max-w-[620px]">
            <h2 className="font-display text-[30px] font-extrabold italic leading-[1.15] tracking-[-0.015em] text-white sm:text-[38px] sm:leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.025em]">
              The Rooms
            </h2>
            <p className="mt-[14px] text-[17px] leading-[1.55] text-white/55">
              Your comprehensive toolkit for every phase of the fantasy calendar.
            </p>
          </div>

          {/* Derived from the real data on every render, never hardcoded —
              a room going live moves this number for free. */}
          <div className="flex shrink-0 items-center gap-2 pb-1.5 font-plex text-[11.5px] text-white/40">
            <span className="h-[7px] w-[7px] rounded-full bg-teal-400" />
            {liveCount} live · {soonCount} coming soon
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const Icon = ICON_BY_NAME[room.name] ?? DraftIcon
            return (
              <RoomCard
                key={room.name}
                room={{ ...room, icon: <Icon className="h-[18px] w-[18px]" /> }}
                onComingSoon={(r) =>
                  modalRef.current?.open(
                    `${r.name} is coming soon`,
                    `${r.blurb} There's nothing to sign up for yet — check back once it's live.`
                  )
                }
              />
            )
          })}
        </div>
      </div>

      <ComingSoonModal ref={modalRef} />
    </section>
  )
}
