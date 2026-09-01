import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import { NAV_LINKS, AccountButtons } from './SiteNav.jsx'
import { RoomsList } from './RoomsNavMenu.jsx'
import { useRooms } from '../hooks/useRooms.js'

// The hamburger's destination on both mobile shells (Header.jsx, LobbyBar.jsx)
// — composed rather than built from scratch, because the two pieces it needs
// already exist for other reasons and neither alone is the right shape.
//
// The backdrop is DraftMenuOverlay.jsx's: a `fixed inset-0` layer that closes
// on its own click, with the panel itself stopping propagation so a tap
// inside doesn't bubble up and close what it just opened. That overlay is a
// 292px corner dropdown, though — a full nav needs the whole link list, not
// four menu rows, so the panel borrows the slide-in shape the old
// PlayerProfileDrawer.jsx used to (now PlayerProfileModal.jsx, which fades
// and centres instead — this sheet's own reasons for a slide never applied
// to a player profile the way they do to a nav list): the same spring, the
// same `x: '100%' -> 0`, just `fixed inset-0` rather than `absolute
// inset-0` — this sheet has no shared relative ancestor with what it
// covers, it has to cover the whole viewport on its own.
//
// NAV_LINKS/AccountButtons come from SiteNav.jsx rather than being passed in
// — the whole point of that file's existence is one nav both headers agree
// on, and a sheet that took its own copy of the links as a prop would be
// exactly the drift SiteNav.jsx was written to stop. "The Rooms" still
// needed special-casing here the same way SiteNav.jsx's own NavLinks needs
// it on desktop — a floating dropdown doesn't fit inside an 82vw slide-in
// panel, so this renders the identical RoomsList (RoomsNavMenu.jsx) as an
// inline accordion instead: same rooms, same season grouping, same
// coming-soon modal, just expanding in place rather than floating.
//
// currentRoom mirrors SiteNav.jsx's NavLinks prop of the same name —
// LobbyBar.jsx passes the room it's the header for (computed once, off the
// same rooms() bridge, and threaded down to both its desktop NavLinks and
// this sheet so the two don't show two different answers to "which room am
// I in"); Header.jsx never passes it, since the homepage isn't inside any
// room.
//
// variant: forwarded to AccountButtons' own Sign Up pill (design_handoff_
// homepage_cosmetic §10) — Header.jsx passes "ghost", LobbyBar.jsx passes
// nothing and keeps the shared default. See AccountButtons' own comment
// (SiteNav.jsx) for why this has to be opt-in rather than a redefinition.
export default function MobileNavSheet({ open, onClose, modalRef, variant, currentRoom }) {
  const rooms = useRooms()
  const [roomsOpen, setRoomsOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]" onClick={onClose}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="absolute inset-y-0 right-0 flex w-[82vw] max-w-xs flex-col border-l border-white/10 bg-[#0B0E14] shadow-[-24px_0_60px_-12px_rgba(0,0,0,0.85)]"
          >
            <div className="flex shrink-0 items-center justify-end border-b border-white/[0.06] p-3">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition-colors hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* flex-1 overflow-y-auto: the accordion below can grow past
                what a short phone viewport has room for (six roadmap rooms
                plus their season labels), and this panel is pinned to the
                full viewport height (inset-y-0) with AccountButtons pinned
                to its bottom via mt-auto — without a scroll container here,
                an expanded list pushes those buttons out of frame instead
                of the row simply scrolling. */}
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV_LINKS.map((link) => {
                if (link.label !== 'The Rooms') {
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      onClick={onClose}
                      className="rounded-lg px-3 py-3 text-base font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      {link.label}
                    </a>
                  )
                }

                // Same one-tick-late bridge guard RoomsNavMenu.jsx's own
                // fallback documents — render the plain #rooms scroll link
                // this used to always be rather than an accordion with
                // nothing in it.
                if (rooms.length === 0) {
                  return (
                    <a
                      key={link.label}
                      href="#rooms"
                      onClick={onClose}
                      className="rounded-lg px-3 py-3 text-base font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      The Rooms
                    </a>
                  )
                }

                return (
                  <div key={link.label}>
                    <button
                      type="button"
                      onClick={() => setRoomsOpen((v) => !v)}
                      aria-expanded={roomsOpen}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-base font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      The Rooms
                      <ChevronDown className={'h-4 w-4 shrink-0 transition-transform duration-150 ' + (roomsOpen ? 'rotate-180' : '')} />
                    </button>
                    {roomsOpen && (
                      <div className="mt-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
                        <RoomsList rooms={rooms} modalRef={modalRef} onSelect={onClose} />
                      </div>
                    )}
                  </div>
                )
              })}

              {currentRoom && (
                <span aria-current="page" className="rounded-lg px-3 py-3 text-base font-semibold text-white">
                  {currentRoom}
                </span>
              )}
            </nav>

            <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-white/[0.06] p-3">
              <AccountButtons variant={variant} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
