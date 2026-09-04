import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import JukeLogo from '../juke-logo/JukeLogo.jsx'
import { useAccountUiReady } from '../../hooks/useAccountUiReady.js'
import { CLERK_APPEARANCE } from '../../clerkConfig.js'
import KickoffPill from './KickoffPill.jsx'
import ConnectLeagueCta from './ConnectLeagueCta.jsx'

/* The sitewide header, guest and connected — design_handoff_v3_alive's
   "Global rules", screens 2ag/2au (mobile) and 3ag/3au (desktop).

   It replaces Header.jsx's marketing bar everywhere, which is the owner's
   call and worth stating plainly because it retires two things: the
   "How It Works" nav link and RoomsNavMenu's season-grouped dropdown. The
   handoff has neither — Rooms is a destination now, not a menu, so a
   dropdown listing the same six rooms one click earlier is a second copy
   of the screen it points at. How It Works moves to the footer and the You
   tab; the docs page itself is untouched.

   ---- Three things that are not styling ----

   **The wordmark is JukeLogo, not the handoff's own.** The handoff draws
   `JUKE` in Barlow Condensed 800 at +0.02em and sizes the mark into a
   28x28 square. The mark is 564x352 — CLAUDE.md's rule is that sizing it
   square squashes it — and the repo's wordmark has been Archivo 900 at
   -0.045em since the shark landed. Changing the wordmark's face is a brand
   decision rather than a layout one, so this defers to the component that
   already expresses the lockup correctly. That is the README's own
   "substitute only where an existing repo component already expresses the
   same thing" clause, used at the one place it most obviously applies.

   **The kickoff pill is here only above `sm`.** Below it the design puts
   the pill in the hero, on the eyebrow's own row (2ag/2au), not in the
   header — so it is `hidden sm:inline-flex` here and every mobile hero
   renders its own. One component, two homes, and the breakpoint is `sm`
   because that is the phone/desktop product split everywhere else in
   web/src (usePhoneWidth, FloatingNavPill's own `sm:hidden`); a third
   breakpoint here would be a second answer to the same question.

   **The connected chip says what is true.** The design draws a league
   switcher — a platform badge, "Dynasty Degens · Wk 3", a caret. There is
   no league connect in this project yet: no Sleeper/ESPN/Yahoo/CBS import,
   no roster, no week. So a signed-in user with no league gets the chip
   slot as the connect CTA it is really offering, and the switcher arrives
   with the integration rather than as a chip full of invented content. */

const TABS = [
  { key: 'home', label: 'Home', href: '#/' },
  { key: 'drafts', label: 'Drafts', href: '#/drafts' },
  { key: 'rooms', label: 'Rooms', href: '#/rooms' },
]

function GuestAuth() {
  const ready = useAccountUiReady()

  // Both controls are text-first and only one is loud: white pill for Sign
  // up, plain text for Log in. Two equally weighted controls in one row is
  // the "one primary action" rule this project has held since the rebrand,
  // and the handoff draws it the same way.
  const login = (
    <button
      type="button"
      className="inline-flex h-11 items-center rounded-full px-2 text-[14px] font-semibold text-voidInk-primary transition-colors duration-150 hover:text-white sm:h-9"
    >
      Log in
    </button>
  )
  const signup = (
    <button
      type="button"
      className="inline-flex h-11 items-center rounded-full bg-white px-4 text-[14px] font-bold text-surface-page transition-transform duration-150 hover:scale-[1.03] sm:h-9 sm:px-[18px]"
    >
      Sign up
    </button>
  )

  // No key configured, or the first client pass — both triggers still draw
  // and simply open nothing yet. A row with a hole in it reads as broken;
  // this is the same fallback AccountButtons already makes.
  if (!ready) return <>{login}{signup}</>

  return (
    <>
      <SignInButton mode="modal">{login}</SignInButton>
      <SignUpButton mode="modal">{signup}</SignUpButton>
    </>
  )
}

/* The league switcher's slot, before there is a league to switch between.

   The handoff draws a chip here reading "Dynasty Degens · Wk 3" with a
   caret. There is no league, so the chip offers the thing that would put
   one there — and it opens the same waitlist every other "connect" control
   in the app opens, rather than linking to #/you, which is where this
   pointed and which is a redirect standing in for an answer. */
function ConnectChip() {
  return (
    <ConnectLeagueCta variant="chip" source="header-chip">
      <span
        className="grid h-[18px] w-[18px] place-items-center rounded font-display text-[11px] font-extrabold text-surface-page"
        style={{ background: '#00E5FF' }}
      >
        +
      </span>
      Connect a league
    </ConnectLeagueCta>
  )
}

export default function ShellHeader({ active = null }) {
  const ready = useAccountUiReady()

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-surface-page/90 backdrop-blur-md">
      <div className="mx-auto flex h-[57px] max-w-[1280px] items-center justify-between gap-3 px-5 sm:h-[68px] sm:px-10">
        <div className="flex min-w-0 items-center gap-9">
          <a href="#/" className="shrink-0" aria-label="Juke — home">
            <JukeLogo size={22} />
          </a>

          {/* Text tabs, desktop only — the mobile equivalent is
              FloatingNavPill, which is the same four destinations at the
              bottom of the screen. */}
          <nav className="hidden items-center gap-[26px] text-[14px] font-semibold sm:flex">
            {TABS.map((t) => {
              const on = active === t.key
              return (
                <a
                  key={t.key}
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={
                    'border-b-2 pb-[2px] transition-colors duration-150 ' +
                    (on ? 'border-mint text-mint' : 'border-transparent text-voidInk-body hover:text-voidInk-primary')
                  }
                >
                  {t.label}
                </a>
              )
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-3.5">
          <KickoffPill className="hidden sm:inline-flex" />

          {!ready ? (
            <GuestAuth />
          ) : (
            <>
              <SignedOut>
                <GuestAuth />
              </SignedOut>
              <SignedIn>
                <ConnectChip />
                {/* Clerk's own avatar rather than the handoff's gradient
                    circle, and the reason is sign-out: UserButton's menu is
                    the only place Clerk offers it, and on a phone this and
                    the You tab are the only two surfaces that can reach it.
                    A decorative circle here would leave a signed-in user
                    with no way out on desktop at all. */}
                <UserButton appearance={CLERK_APPEARANCE} />
              </SignedIn>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
