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
//
// Live rooms first, a display-only sort rather than a change to ROOMS
// itself: app.js's own comment on that array explains it was deliberately
// reordered to run chronologically across a season (Prospect, Draft,
// Waiver, ...) rather than live-first, and the footer reads the same array
// — reordering the source would have silently reordered the footer too.
// This is the one place on the page a design review specifically asked to
// lead with what a visitor can actually click; Array.prototype.sort is
// stable in every current engine, so the five "coming soon" rooms keep
// their existing relative order behind whichever ones are live.
function liveFirst(rooms) {
  return [...rooms].sort((a, b) => (a.live === b.live ? 0 : a.live ? -1 : 1))
}

export default function RoomsGrid() {
  const rooms = useRooms()
  const modalRef = useRef(null)

  if (rooms.length === 0) return null

  const ordered = liveFirst(rooms)

  return (
    <section id="rooms" className="border-t border-white/[0.06] bg-[#080b0e] px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-11 max-w-[620px]">
          <h2 className="font-display text-[30px] font-extrabold italic leading-[1.15] tracking-[-0.015em] text-white sm:text-[38px] sm:leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.025em]">
            The Rooms
          </h2>
          {/* The forward-looking claim the hero used to open with, moved
              here rather than deleted — a design review caught it making a
              five-room promise in the headline while this same section
              immediately undercut it with a literal "1 live · 5 coming
              soon" count. One honest, clearly future-tense line, below the
              fold, beside the grid that actually shows what's live today. */}
          <p className="mt-[14px] text-[17px] leading-[1.55] text-white/55">
            The Draft Room is live today. Five more rooms — covering the rest of the fantasy
            calendar — are on the way.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((room) => {
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
