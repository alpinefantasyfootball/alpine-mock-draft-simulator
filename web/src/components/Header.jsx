import { useRef } from 'react'
import Ticker from './Ticker.jsx'
import JukeLogo from './juke-logo/JukeLogo.jsx'
import ComingSoonModal from './ComingSoonModal.jsx'

// Same-page anchors — this site has no router (App.jsx just renders
// <Homepage/>), so "navigation" below the logo is real content one scroll
// away, not a route. #proof and #rooms are ShowYourWorking.jsx's and
// RoomsGrid.jsx's own section ids. scroll-padding-top on <html> (see
// index.html) is what keeps the sticky header from slicing into whichever
// section one of these lands on.
//
// No "Scores" entry — the live-score strip it pointed at was pure NFL
// schedule/score content on a page selling draft prep, off-message in
// August and actively wrong once real games start counting, and it's been
// removed from the homepage entirely (a design review's call). Nothing
// left for this link to point at.
const NAV_LINKS = [
  { label: 'How It Works', href: '#proof' },
  { label: 'The Rooms', href: '#rooms' },
  { label: 'Draft Room', href: '#/draft-room' },
]

export default function Header() {
  const modalRef = useRef(null)

  return (
    // Two stacked rows now rather than one: the ticker used to share row 1
    // with the logo and nav, flex-1 between them — fine with no nav, but a
    // four-link nav plus a marquee competing for the same 64px is exactly
    // the "runs behind the logo and clips mid-word" layout the redesign
    // exists to fix. Row 2 is the ticker's own space, nothing else in it.
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-void/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-10 px-6">
        <a href="#/" aria-label="Juke home" className="shrink-0">
          <JukeLogo size={21} />
        </a>

        <nav className="hidden shrink-0 items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() =>
              modalRef.current?.open(
                'Accounts are not live yet',
                'There is nothing to log into so far. Your drafts save to this device, ' +
                  'so you can close the tab and pick up where you left off.'
              )
            }
            className="rounded-full px-4 py-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() =>
              modalRef.current?.open(
                'Sign-up is coming',
                'Juke does not have accounts yet. Everything here is free and needs no ' +
                  'sign-up, and your drafts already save to this device.'
              )
            }
            className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-4 py-2 text-sm font-semibold text-white
                       shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
          >
            Sign Up
          </button>
        </div>
      </div>

      <Ticker />

      <ComingSoonModal ref={modalRef} />
    </header>
  )
}
