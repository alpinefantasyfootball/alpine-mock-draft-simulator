import { useRef } from 'react'
import { Settings } from 'lucide-react'
import JukeLogo from './juke-logo/JukeLogo.jsx'
import ComingSoonModal from './ComingSoonModal.jsx'
import { NAV_LINKS, AccountButtons } from './SiteNav.jsx'

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

   NAV_LINKS/AccountButtons come from SiteNav.jsx rather than being declared
   here a second time — this file used to carry its own three-link nav
   ("Draft Room · The Rooms · Method") with no account controls at all,
   which is exactly the "two different implementations that have drifted"
   bug a design review caught: a manager bouncing between the homepage and
   a mock draft saw a different header each time, one of them missing
   Log in/Sign Up entirely. "Draft Room" is a real link here now (not the
   inert label it used to be) for the same reason: it's the identical link
   Header.jsx renders, and clicking it while already on this screen either
   no-ops or, if a draft has actually been entered, takes you back into it
   — never a dead click. */
export default function LobbyBar({ onOpenSettings }) {
  const modalRef = useRef(null)

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-obsidian/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-8">
        <a href="#/" aria-label="Juke home" className="shrink-0">
          <JukeLogo size={19} />
        </a>

        <div className="h-5 w-px shrink-0 bg-white/10" />

        <nav className="flex min-w-0 flex-1 items-center gap-[22px]">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-white/50 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Draft settings"
            title="Draft settings"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-slate-800 bg-obsidian/60 text-white/55 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300"
          >
            <Settings className="h-4 w-4" />
          </button>

          <div className="h-5 w-px shrink-0 bg-white/10" />

          <AccountButtons modalRef={modalRef} />
        </div>
      </div>

      <ComingSoonModal ref={modalRef} />
    </header>
  )
}
