import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
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
// touch/keyboard/resize logic just to look at the other five.
//
// Desktop was a flat live-first grid for a while; a design review asked for
// a chronological timeline instead — grouped by season, in the order a
// fantasy year actually runs, rather than by what happens to be clickable
// today. `season` already exists on every entry in ROOMS (app.js) for
// exactly this reason, so grouping reads it rather than re-deciding which
// room belongs to which phase a second time.
const SEASON_ORDER = ['Pre-season', 'In-season', 'Post-season']

function bySeasonGroup(rooms) {
  return SEASON_ORDER.map((season) => ({ season, rooms: rooms.filter((r) => r.season === season) })).filter(
    (group) => group.rooms.length > 0
  )
}

// Mobile keeps live-first: the phone-only pattern below leads with whichever
// room you can actually enter today, not with the season calendar — a
// display-only sort rather than a change to ROOMS itself. app.js's own
// comment on that array explains it was deliberately reordered to run
// chronologically (Prospect, Draft, Waiver, ...) rather than live-first, and
// the footer reads the same array — reordering the source would have
// silently reordered the footer too. Array.prototype.sort is stable in
// every current engine, so the five "coming soon" rooms keep their existing
// relative order behind whichever ones are live.
function liveFirst(rooms) {
  return [...rooms].sort((a, b) => (a.live === b.live ? 0 : a.live ? -1 : 1))
}

// "Five more rooms" on the mobile summary row is spelled out because the
// mock spells it out — kept as a real count rather than a literal string so
// it can't go stale the way a hardcoded room list already has once (this
// file's own top comment: the old hardcoded grid was "missing 'The League
// Room' entirely"). Falls back to the numeral past nine, which nothing on
// this six-room array can reach today.
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
function numberWord(n) {
  return NUMBER_WORDS[n] ?? String(n)
}

// "The Draft Room" -> "Draft Room", for the mobile footer/summary row's
// shorter labels. Strips only the leading article and trailing "Room" —
// every name in ROOMS (app.js) follows "The ___ Room", so this doesn't need
// to know the six names to shorten them correctly.
function shortRoomName(name) {
  return name.replace(/^The\s+/, '').replace(/\s+Room$/, '')
}

export default function RoomsGrid() {
  const rooms = useRooms()
  const modalRef = useRef(null)

  if (rooms.length === 0) return null

  const ordered = liveFirst(rooms)
  const liveRoom = ordered.find((r) => r.live)
  const comingSoon = ordered.filter((r) => !r.live)
  const LiveIcon = liveRoom ? (ICON_BY_NAME[liveRoom.name] ?? DraftIcon) : null
  const seasonGroups = bySeasonGroup(rooms)

  return (
    <section id="rooms" className="border-t border-white/[0.06] bg-[#080b0e] px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-11 max-w-[620px]">
          {/* Homepage v4 pass 2, new — same mint-pill eyebrow shape Hero.jsx
              already uses ("AGILITY THROUGH ANALYTICS"), not a second
              treatment invented for this one section. */}
          <span className="inline-flex items-center gap-[9px] rounded-full border border-mint/30 bg-mint/[0.06] px-[15px] py-[7px] text-[11.5px] font-bold tracking-[0.13em] text-mint">
            THE SEASON-LONG SYSTEM
          </span>
          <h2 className="mt-4 font-display text-[clamp(32px,3.6vw,48px)] font-extrabold italic leading-none text-white">
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

        {/* ---------- Mobile: design_handoff_mobile Prompt 2 ----------
            The live room gets its own full-width hero treatment (a pulsing
            dot, its own CTA) and the five non-live cards collapse into one
            tappable summary row — not five Coming Soon cards, which the
            handoff explicitly says not to render on a phone. Name/blurb/
            href still come from `room` via the bridge, same as the desktop
            grid below: only the layout is bespoke here, not the data. */}
        {liveRoom && (
          <div className="lg:hidden">
            <div
              className="rounded-2xl border border-teal-400/40 p-6"
              style={{ background: 'linear-gradient(170deg, rgba(0,229,255,0.09), #0d1216 62%)' }}
            >
              <span className="inline-flex items-center gap-[7px] font-plex text-[11px] font-semibold uppercase tracking-[0.12em] text-teal-300">
                <span className="relative flex h-[7px] w-[7px]">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-teal-400" />
                </span>
                {/* "Live", not "LIVE NOW" — RoomCard.jsx's own badge is the
                    word this status owns, and the phone was saying it
                    differently for the same room on the same page. The
                    uppercase treatment is the class, not the string. */}
                Live
              </span>

              <div className="mt-3 flex items-center gap-[11px]">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-white/5 text-teal-300">
                  {LiveIcon && <LiveIcon className="h-[18px] w-[18px]" />}
                </div>
                <h3 className="font-display text-[19px] font-bold text-white">{liveRoom.name}</h3>
              </div>

              <p className="mt-3 text-[14.5px] leading-[1.55] text-[#a9b6bd]">{liveRoom.blurb}</p>

              {liveRoom.href && (
                <a
                  href={liveRoom.href}
                  // data-hero-cta: this is a mobile-only ("lg:hidden" parent)
                  // full "Enter the Draft Room" CTA, the same button Hero.jsx
                  // and ClosingCta.jsx already mark — Header.jsx's sticky
                  // bottom bar needs to stand down here too, not just over
                  // the hero's own copy of it. Found by inspection: a reader
                  // could see two identical "Enter the Draft Room" buttons on
                  // screen at once here, which is the exact bug this marker
                  // was invented to prevent, just not extended past Hero.jsx
                  // when this card grew its own CTA.
                  data-hero-cta=""
                  className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#22d3ee] to-[#a78bfa] text-[15px] font-bold text-white
                             shadow-glass transition-all duration-200 active:scale-[0.98]"
                >
                  Enter the {shortRoomName(liveRoom.name)} Room
                </a>
              )}
            </div>

            {comingSoon.length > 0 && (() => {
              const heading = `${numberWord(comingSoon.length).replace(/^./, (c) => c.toUpperCase())} more rooms in build`
              return (
                <button
                  type="button"
                  onClick={() =>
                    modalRef.current?.open(
                      heading,
                      `${comingSoon.map((r) => r.name).join(', ')}. There's nothing to sign up for yet — check back once they're live.`
                    )
                  }
                  className="mt-3 flex w-full items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-[#0c1013] p-4 text-left transition-colors duration-150 hover:border-teal-400/40"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-white">{heading}</p>
                    <p className="mt-[3px] truncate text-[13.5px] text-white/50">
                      {comingSoon.map((r) => shortRoomName(r.name)).join(', ')}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                </button>
              )
            })()}
          </div>
        )}

        <div className="hidden lg:block">
          {seasonGroups.map((group) => (
            <div key={group.season} className="mb-11 last:mb-0">
              {/* The rule fades into the row rather than running edge to edge —
                  a full-width line reads as a table divider; this reads as a
                  season heading, which is what it is. */}
              <div className="mb-4 flex items-center gap-3">
                <span className="font-plex text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">{group.season}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-teal-400/35 via-white/10 to-transparent" />
                <span className="font-plex text-[11px] text-white/40">
                  {group.rooms.length} room{group.rooms.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.rooms.map((room) => {
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
          ))}
        </div>
      </div>

      <ComingSoonModal ref={modalRef} />
    </section>
  )
}
