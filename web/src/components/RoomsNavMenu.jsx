import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useRooms } from '../hooks/useRooms.js'
import { ROOM_ICON_BY_NAME, ROOM_TIER, ROOM_SIGNUP_SOURCE, roomSignupCopy, TierBadge } from './icons.jsx'

// The room rows themselves, grouped by season — shared by RoomsNavMenu
// below (the desktop dropdown) and MobileNavSheet.jsx's own accordion, so
// the two surfaces can't list a different set of rooms or drift in how a
// row looks. RoomsNavMenu wraps this in a floating panel; MobileNavSheet
// wraps it inline, in an expand/collapse section of the slide-in sheet
// itself — same rows either way, different container.
//
// Grouped by season without a separate season order list: app.js's own
// ROOMS array is already chronological (Pre-season, In-season,
// Post-season — see its file comment there), so de-duping room.season in
// array order reproduces that sequence for free. Writing the phase order
// down a second time here would be exactly the kind of copy CLAUDE.md's
// "nothing about the league shape may be written down twice" rule exists
// to catch, just for room phases instead of scoring.
//
// modalRef is the EarlyAccessModal instance the calling header already owns
// (Header.jsx and LobbyBar.jsx both build one for the account button) —
// reused here for a non-live room's own signup rather than mounting a
// second <dialog>, the same modalRef-as-prop pattern AccountButtons already
// uses. ROOM_SIGNUP_SOURCE/roomSignupCopy (icons.jsx) are the same lookup
// RoomsGrid.jsx's roadmap list and Homepage.jsx's footer room links use, so
// all three surfaces tag the identical five rooms with the identical source
// string rather than each inventing its own.
//
// onSelect fires on every row click, live room or not — what "selecting a
// room" should close is the caller's call: RoomsNavMenu collapses its own
// floating panel, MobileNavSheet closes the whole sheet (the same thing
// every other link in it already does on click).
export function RoomsList({ rooms, modalRef, onSelect }) {
  const seasons = [...new Set(rooms.map((room) => room.season))]

  const openSignup = (room) =>
    modalRef?.current?.open(roomSignupCopy(room), ROOM_SIGNUP_SOURCE[room.name])

  return (
    <>
      {seasons.map((season, i) => (
        <div key={season} className={i > 0 ? 'mt-1 border-t border-white/[0.06] pt-1' : ''}>
          {/* text-ink-muted, not a raw text-white/NN opacity: tailwind.config.js
              documents /25 through /45 failing 4.5:1 on this surface family and
              names ink-muted as the floor that still clears it (4.9:1 measured
              against slate.DEFAULT, and bg-slate-panel here is a step lighter
              still, so the margin only grows). */}
          <p className="px-3 pb-1 pt-2 font-numeral text-[10px] font-semibold tracking-[0.13em] text-ink-muted">
            {season.toUpperCase()}
          </p>
          {rooms
            .filter((room) => room.season === season)
            .map((room) => {
              const Icon = ROOM_ICON_BY_NAME[room.name]
              if (room.live) {
                return (
                  <a
                    key={room.name}
                    href={room.href}
                    role="menuitem"
                    onClick={onSelect}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.06]"
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0 text-mint" />}
                    {/* truncate, not just flex-1 — see the non-live row's
                        own comment below on why a room name needs an
                        ellipsis floor next to a tier badge. */}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{room.name}</span>
                    {/* "Free Access", not "Live" — RoomsGrid.jsx's featured
                        card carries the identical wording for the identical
                        room; this used to say "Live" and was the one place
                        on the page still saying it after that change, which
                        read as two different claims about the same room
                        depending which surface you were looking at. */}
                    <span className="shrink-0 rounded-full bg-[#08362E] px-2 py-[3px] font-numeral text-[10px] font-semibold text-[#90F4DE]">
                      Free Access
                    </span>
                  </a>
                )
              }
              return (
                <button
                  key={room.name}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect?.()
                    openSignup(room)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-muted" />}
                  {/* min-w-0 + truncate: "Juke All-Access" is wider than
                      "Juke Pro", and at this row's actual width (measured
                      262px inside the 280px desktop dropdown, tighter still
                      in MobileNavSheet's 82vw/max-w-xs sheet) that was
                      enough to wrap "The Strategy Room" and "The League
                      Room" onto a second line while every Pro-tier row
                      stayed on one — a flex-1 span shrinks in width but
                      still wraps its text by default. Ellipsis over a
                      two-line wrap in a fixed-height dropdown row, the same
                      "scrollWidth > clientWidth is what correct truncation
                      looks like" rule CLAUDE.md documents for the board
                      card's own team-name cells. */}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-soft">{room.name}</span>
                  {/* Same ROOM_TIER/TierBadge RoomsGrid.jsx's roadmap list
                      uses — these rows had no tier tag at all until now,
                      which meant a visitor never learned Prospect/Waiver/
                      Trade/Strategy/League were paid tiers unless they
                      scrolled all the way to the homepage's Rooms section. */}
                  <TierBadge tier={ROOM_TIER[room.name]} />
                </button>
              )
            })}
        </div>
      ))}
    </>
  )
}

// "The Rooms" nav item, rendered by SiteNav.jsx's NavLinks in place of a
// plain `#rooms` anchor — a dropdown of every room, grouped by season,
// instead of a scroll down to RoomsGrid.jsx's own section. Same data, same
// useRooms() hook RoomsGrid.jsx reads, so the two can't list a different
// set of rooms.
export default function RoomsNavMenu({ triggerClassName, modalRef }) {
  const rooms = useRooms()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // mousedown, not click: closing on the same click that opened it (a
    // click on the trigger toggles `open` itself) would race this listener
    // and the button's own onClick over which one runs first.
    const onOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [open])

  // The bridge hasn't resolved yet (useRooms() reads window.JukeEngine in
  // an effect, same one-tick-late window useEngine() guards against) —
  // fall back to the plain #rooms anchor this label always used to be,
  // rather than rendering a button that opens an empty panel.
  if (rooms.length === 0) {
    return (
      <a href="#rooms" className={triggerClassName}>
        The Rooms
      </a>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={triggerClassName + ' inline-flex items-center gap-1'}
      >
        The Rooms
        <ChevronDown className={'h-3.5 w-3.5 transition-transform duration-150 ' + (open ? 'rotate-180' : '')} />
      </button>

      {open && (
        <div
          role="menu"
          // w-[320px], was 280px — 280 was sized before the tier badges
          // existed. Measured: "The Strategy Room" + "Juke All-Access"
          // needs ~295px of row content alone; 320px gives that room to
          // breathe rather than relying on the truncate fallback for the
          // common case. The fallback still matters for the narrower
          // MobileNavSheet, which reuses this same RoomsList at 82vw.
          className="absolute left-0 top-full z-[80] mt-2 w-[320px] rounded-xl border border-white/10 bg-slate-panel p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]"
        >
          <RoomsList rooms={rooms} modalRef={modalRef} onSelect={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
