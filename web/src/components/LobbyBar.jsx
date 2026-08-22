import { Settings } from 'lucide-react'
import JukeLogo from './juke-logo/JukeLogo.jsx'

/* The lobby's own top bar — now a plain nav bar, carrying no action.

   It used to carry the screen's one primary CTA ("Enter Draft Room" /
   "Start mock draft") — see the Claude Design v2 handoff. That was always
   fighting DraftLocker.jsx's own EmptyState button for the same job, wearing
   the same gradient: the exact two-primaries problem the one-primary-action
   rule exists to catch, just invisible until there was history to look at.
   The fix moves the action into NewMockPanel.jsx's launcher instead — one
   screen, one gradient button — and this bar goes back to doing only what
   every other header in the app does: say what this is and offer a way
   through the settings modal.

   `onStart`/`startLabel`/`startDisabled`/`problem` are gone from this
   component's props entirely, not just unused — NewMockPanel.jsx owns that
   wiring now, verbatim (same gradient, same disabled/problem handling this
   file used to carry), so nothing about that behavior was rebuilt, only
   relocated. */
export default function LobbyBar({ onOpenSettings }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-obsidian/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-8">
        <a href="#/" aria-label="Juke home" className="shrink-0">
          <JukeLogo size={19} />
        </a>

        <div className="h-5 w-px shrink-0 bg-white/10" />

        <nav className="flex min-w-0 flex-1 items-center gap-[22px]">
          <span className="text-sm font-semibold text-white">Draft Room</span>
          {/* Both land on the homepage rather than a specific section —
              this app's hash routing is one string, not nested routes, and
              a same-page anchor like #rooms only means something *on* the
              homepage; jumping straight to a section from a different view
              isn't something the current router shape supports without
              real work this pass isn't scoped for. Method goes straight to
              the real docs page instead, which is arguably the more useful
              destination from here anyway. */}
          <a href="#/" className="text-sm font-medium text-white/50 transition-colors hover:text-white">
            The Rooms
          </a>
          <a
            href="/docs/draft-room-how-it-works.html"
            className="text-sm font-medium text-white/50 transition-colors hover:text-white"
          >
            Method
          </a>
        </nav>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Draft settings"
          title="Draft settings"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-slate-800 bg-obsidian/60 text-white/55 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
