import { useRef, useState } from 'react'
import { Menu, Settings } from 'lucide-react'
import JukeLogo from './juke-logo/JukeLogo.jsx'
import EarlyAccessModal from './EarlyAccessModal.jsx'
import MobileNavSheet from './MobileNavSheet.jsx'
import { NavLinks, AccountButtons } from './SiteNav.jsx'
import { useRooms } from '../hooks/useRooms.js'

/* The lobby's own top bar — a plain nav bar, carrying no draft action.

   It used to carry the screen's one primary CTA ("Enter Draft Room" /
   "Start mock draft") — see the Claude Design v2 handoff. That was always
   fighting DraftLocker.jsx's own EmptyState button for the same job, wearing
   the same gradient: the exact two-primaries problem the one-primary-action
   rule exists to catch, just invisible until there was history to look at.
   The fix moves the action into NewMockPanel.jsx's launcher instead — one
   screen, one gradient button — and this bar does only what every other
   header in the app does: the same nav Header.jsx (the homepage) uses, the
   same Log in / Sign Up controls, plus one thing genuinely specific to this
   screen — the settings gear.

   `onStart`/`startLabel`/`startDisabled`/`problem` are gone from this
   component's props entirely, not just unused — NewMockPanel.jsx owns that
   wiring now, verbatim (same gradient, same disabled/problem handling this
   file used to carry), so nothing about that behavior was rebuilt, only
   relocated.

   NavLinks/AccountButtons come from SiteNav.jsx rather than being declared
   here a second time — this file used to carry its own three-link nav
   ("Draft Room · The Rooms · Method") with no account controls at all,
   which is exactly the "two different implementations that have drifted"
   bug a design review caught: a manager bouncing between the homepage and
   a mock draft saw a different header each time, one of them missing
   Log in/Sign Up entirely.

   `currentRoom` is the one thing this screen's nav needs that Header.jsx's
   never passes: this *is* a room, so NavLinks (SiteNav.jsx) appends its
   name as a fourth, non-interactive item instead of the plain <a> "Draft
   Room" used to be in NAV_LINKS itself — see that array's own comment on
   why it's gone from there. Read off the same `rooms()` bridge
   RoomsNavMenu/RoomsGrid already use, matched by href rather than a second
   hardcoded "The Draft Room" string, so if this room's name ever changes
   in app.js's ROOMS this bar doesn't quietly go stale.

   The old permanent link had a real bug worth remembering: clicking it
   while already on #/drafts set the hash to the value it already was, so
   nothing visibly happened — a silent no-op with no explanation. A room's
   name is a fact about which screen you're on, not a link: there's nothing
   left to navigate to from inside a room that "The Rooms" beside it
   doesn't already cover. */
export default function LobbyBar({ onOpenSettings }) {
  const modalRef = useRef(null)
  const [navOpen, setNavOpen] = useState(false)
  const rooms = useRooms()
  // href, not name: app.js's ROOMS comment on the Draft Room's own entry is
  // explicit that #/drafts (the Lobby) is the identifier to match on, same
  // as RoomsNavMenu's live-room link uses room.href directly rather than a
  // name string.
  const currentRoom = rooms.find((r) => r.href === '#/drafts')?.name

  return (
    // A Fragment, not a single <header> return — MobileNavSheet has to be a
    // true sibling of it, not a descendant. backdrop-blur-md on <header> is
    // a CSS filter, and any filter/backdrop-filter on an ancestor becomes
    // the containing block for a position:fixed descendant, the same rule
    // transform follows (Header.jsx's own comment on its bottom action bar
    // documents the identical mechanism). Nested inside this header the
    // sheet's `fixed inset-0` resolved against the *header's own* short
    // h-14 box instead of the viewport — measured live at exactly 56px
    // tall, with its nav links and account button overflowing that
    // box uncontained and reading as pasted directly over the Lobby
    // underneath rather than a slide-in drawer. EarlyAccessModal stays
    // inside <header>: a native <dialog> promotes to the browser's own top
    // layer on showModal(), above this containing-block question entirely.
    <>
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-bar/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 md:px-8">
        {/* Two instances behind a wrapper's hidden/block, matching
            Header.jsx's own fix for the identical trap: JukeLogo's root
            <span> hardcodes display:inline-flex as an inline style, and an
            inline style beats a Tailwind display class of any specificity —
            md:hidden on the component itself would be silently defeated. */}
        <a href="#/" aria-label="Juke home" className="shrink-0">
          <span className="md:hidden"><JukeLogo size={19} surface="appbar" /></span>
          <span className="hidden md:block"><JukeLogo size={34} surface="appbar" /></span>
        </a>

        <div className="hidden h-5 w-px shrink-0 bg-white/10 md:block" />

        {/* Same drift this file's own header comment already warned about,
            one level down: three links plus two account buttons in a 56px
            row was never going to fit an 8px-padded 375px screen, and the
            desktop version of that crowding is exactly what NAV_LINKS/
            AccountButtons coming from SiteNav.jsx was written to prevent
            recurring per-screen. hidden md:flex is the mobile half of the
            same fix — a hamburger sheet below md rather than a nav that
            wraps into the settings gear. */}
        <nav className="hidden min-w-0 flex-1 items-center gap-[22px] md:flex">
          <NavLinks
            linkClassName="text-sm font-medium text-white/50 transition-colors hover:text-white"
            currentRoomClassName="text-sm font-semibold text-white"
            currentRoom={currentRoom}
            modalRef={modalRef}
          />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0 md:gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Draft settings"
            title="Draft settings"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-slate-rule bg-slate-sunk/60 text-white/55 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300"
          >
            <Settings className="h-4 w-4" />
          </button>

          <div className="hidden h-5 w-px shrink-0 bg-white/10 md:block" />

          <div className="hidden shrink-0 items-center gap-3 md:flex">
            <AccountButtons modalRef={modalRef} />
          </div>

          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <EarlyAccessModal ref={modalRef} />
    </header>

    <MobileNavSheet open={navOpen} onClose={() => setNavOpen(false)} modalRef={modalRef} currentRoom={currentRoom} />
    </>
  )
}
