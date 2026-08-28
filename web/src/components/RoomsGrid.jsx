import { useEffect, useRef, useState } from 'react'
import ComingSoonModal from './ComingSoonModal.jsx'
import PhaseRail from './PhaseRail.jsx'
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

// Homepage cosmetic revision (design_handoff_homepage_cosmetic) §9. This
// replaces both the desktop season-grouped six-card grid and the separate
// mobile-only "live room hero + collapsed N-more-rooms button" treatment
// that predated this pass — one responsive layout now (a featured card and
// a roadmap list that sit side by side at lg and stack below it), matching
// the handoff's own Responsive note ("the Rooms two-column layout should
// stack" below ~900px) rather than two structurally different designs per
// breakpoint. The old mobile treatment solved the same "five Coming Soon
// cards reads as not ready" problem in its own bespoke way; keeping it
// alongside this would have left the page with two unrelated answers to
// the identical problem, in two different visual languages.
//
// Order: app.js's own ROOMS array is already chronological (Prospect,
// Draft, Waiver, Trade, Strategy, League), so filtering the live Draft Room
// out leaves Prospect, Waiver, Trade, Strategy, League — exactly the order
// §9 asks for. Nothing here re-sorts it a second time.
export default function RoomsGrid() {
  const rooms = useRooms()
  const modalRef = useRef(null)

  if (rooms.length === 0) return null

  const liveRoom = rooms.find((r) => r.live)
  const roadmapRooms = rooms.filter((r) => !r.live)
  const LiveIcon = liveRoom ? (ICON_BY_NAME[liveRoom.name] ?? DraftIcon) : null

  const openComingSoon = (room) =>
    modalRef.current?.open(
      `${room.name} is coming soon`,
      `${room.blurb} There's nothing to sign up for yet — check back once it's live.`
    )

  return (
    <section id="rooms" className="mx-auto max-w-[1200px] px-10 pb-0 pt-[96px]">
      <div className="max-w-[620px]">
        {/* Outlined rather than filled — §9's own eyebrow treatment for
            this section (the .dc.html reference draws it as a border with
            no background, unlike Hero.jsx's filled mint pill), confirmed
            against the reference rather than carried over from the old
            filled version this replaced. */}
        <span className="inline-flex items-center rounded-full border border-[#1C5248] px-[14px] py-[6px] font-voidNumeral text-[11px] font-semibold tracking-[0.13em] text-mint">
          THE SEASON-LONG SYSTEM
        </span>
        <h2 className="mt-4 font-display text-[clamp(32px,3.6vw,48px)] font-extrabold italic leading-none text-voidInk-primary">
          The Rooms
        </h2>
        {/* The forward-looking claim the hero used to open with, moved
            here rather than deleted — a design review caught it making a
            five-room promise in the headline while this same section
            immediately undercut it with a literal "1 live · 5 coming
            soon" count. One honest, clearly future-tense line, below the
            fold, beside the layout that actually shows what's live today. */}
        <p className="mt-3 text-[17px] leading-[1.55] text-voidInk-body">
          The Draft Room is live today. Five more rooms — covering the rest of the fantasy
          calendar — are on the way.
        </p>
      </div>

      {/* §8 — the Scout/Draft/Trade/Manage timeline, moved here from
          Hero.jsx. Directly above the room cards, where what's live and
          what's coming next is already being explained, rather than
          competing with the hero's own headline and CTA pair. mt-[28px]
          matches the handoff's own spacing from the intro paragraph
          above it (also §2's subhead-to-content-block figure). */}
      <div className="mt-[28px]">
        <PhaseRail />
      </div>

      {liveRoom && (
        <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* Left — the Draft Room, featured. */}
          <div
            className="flex flex-col rounded-[14px] border border-[#1C5248] p-[26px]"
            style={{ background: 'linear-gradient(150deg, #052221, #13161C 65%)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#0C2F2D]">
                {LiveIcon && <LiveIcon className="h-[18px] w-[18px] text-mint" />}
              </div>
              <span className="font-display text-[26px] font-bold italic text-mint">{liveRoom.name}</span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-[6px] rounded-full bg-[#08362E] px-[11px] py-[5px] font-voidNumeral text-[11px] font-semibold text-[#90F4DE]">
                <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#7FE998]" />
                Live
              </span>
            </div>
            <p className="mt-5 text-[20px] font-bold text-voidInk-primary">{liveRoom.lead}</p>
            <p className="mt-[10px] max-w-[440px] text-[16px] leading-[1.55] text-voidInk-body">{liveRoom.blurb}</p>
            {/* The flex spacer §9 asks for — pins the CTA to the card's own
                bottom edge once items-stretch (above) grows this card to
                match the roadmap list's taller natural height. */}
            <div className="flex-1" />
            {liveRoom.href && (
              <a
                href={liveRoom.href}
                // data-hero-cta: the mobile-only card this replaced carried
                // this marker so Header.jsx's sticky bottom bar would stand
                // down while this section's own "Enter the Draft Room" CTA
                // was on screen. The new featured card is the same CTA in
                // a new shape, so it keeps the marker — dropping it would
                // silently bring back the double-CTA bug that marker exists
                // to prevent, just from this section instead of Hero's.
                data-hero-cta=""
                className="mt-[22px] inline-flex w-fit items-center rounded-full border border-[#217263] px-6 py-3 font-voidBody text-[15px] font-bold text-[#7EF0D7] transition-colors duration-150 hover:border-[#3EA692] hover:bg-[#082A25]"
              >
                Enter the Draft Room
              </a>
            )}
          </div>

          {/* Right — roadmap list. */}
          <div className="rounded-[14px] border border-line-hairline bg-surface-nav p-[22px]">
            <div className="flex items-baseline justify-between">
              <span className="font-voidNumeral text-[10.5px] font-semibold tracking-[0.13em] text-[#7D8086]">
                ON THE ROADMAP
              </span>
              <span className="font-voidNumeral tabular-nums text-[11.5px] font-semibold text-[#6F7278]">
                {roadmapRooms.length} rooms
              </span>
            </div>
            <div className="mt-[10px] flex flex-col">
              {roadmapRooms.map((room) => (
                <button
                  key={room.name}
                  type="button"
                  onClick={() => openComingSoon(room)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#1C1F25] py-[13px] text-left last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-[15.5px] font-bold text-voidInk-primary">{room.name}</p>
                    {/* room.lead, not room.blurb — §9's own "one-line
                        promise" is the short imperative line ("Win the
                        wire."), not the long description. The .dc.html
                        reference's own roadmap mock data confirms this: its
                        per-row `blurb` field is set to what app.js actually
                        calls `lead`, not to a long description. The long
                        descriptions §9 says to drop are still real data
                        (openComingSoon's modal body still reads room.blurb),
                        just not shown in this row. */}
                    <p className="mt-[2px] text-[14px] text-[#A2A5AA]">{room.lead}</p>
                  </div>
                  <span className="whitespace-nowrap text-right font-voidNumeral text-[11px] tracking-[0.06em] text-[#7D8086]">
                    {room.season.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ComingSoonModal ref={modalRef} />
    </section>
  )
}
