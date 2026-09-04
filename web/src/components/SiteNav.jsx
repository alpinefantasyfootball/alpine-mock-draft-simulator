import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react'
import RoomsNavMenu from './RoomsNavMenu.jsx'
import { CLERK_APPEARANCE } from '../clerkConfig.js'
import { useAccountUiReady } from '../hooks/useAccountUiReady.js'

// The one canonical top-nav link list and account-controls pair. Before
// this file existed, LobbyBar.jsx (the Draft Room / Locker screen) had
// quietly grown its own smaller header — "Draft Room · The Rooms · Method,"
// a settings gear, and nothing else — while Header.jsx (the marketing
// homepage) carried a fourth link ("Scores"), no "Method," and the only
// Log in / Sign Up controls anywhere in the app. Two managers who bounced
// between the homepage and a mock draft saw two different sites. This is
// the shared source both headers render from now, so they can't drift
// apart the same way again without someone doing it on purpose.
//
// Same-page anchors (#proof, #rooms, #scores) still work when clicked from
// the Locker, even though it's a different screen: DraftRoom.jsx's own
// hash-route watcher (useHashActive) only treats a hash starting with "#/"
// as a real route change, so following one of these un-mounts the fixed
// Locker overlay and lets the browser's native anchor scroll land on the
// homepage section underneath — the same #root that never unmounts, per
// main.jsx.
//
// That's only the React half of it. #root itself sits inside
// app.js's #view-home, which applyRoute() hides whenever the hash is
// "#/drafts" or "#/draft-room" (see hideHome there) — and the Locker is
// reached at "#/drafts". A same-page anchor's hashchange deliberately
// skips calling applyRoute() at all (its own comment explains why:
// scrollTo(0, 0) fighting the native anchor scroll), which used to mean
// nothing ever set view-home visible again — the Locker overlay un-mounts
// exactly as this comment says, revealing a #root that renders correctly
// and sits inside an ancestor still carrying `hidden`. Fixed by having
// that hashchange guard call syncHomeVisibility() (app.js) before
// returning, rather than nothing at all. If a future change moves what
// hides #view-home, re-check this path specifically — it's the one case
// that reaches applyRoute()'s hiding logic without ever reaching
// applyRoute() itself.
//
// Both Header.jsx and LobbyBar.jsx render this through NavLinks below now
// — a literal copy in either file would be the exact "two different
// implementations that have drifted" bug this file's own top comment
// describes, just moved one level down from "which links exist" to "how
// they render."
// Scores dropped: the homepage's own scores strip was removed (a design
// review flagged live NFL scores as off-message on a page selling draft
// prep in August), which took the #scores section with it — leaving this
// entry pointing at an anchor that no longer exists anywhere.
//
// "Draft Room" used to be a third, permanent entry here
// (`{ label: 'Draft Room', href: '#/drafts' }`), on every screen including
// the homepage — where it duplicated the page's own much larger "Enter the
// Draft Room" CTAs (Hero.jsx, RoomsGrid.jsx's featured card, this file's
// own sticky bottom bar) as a second, smaller way to do the identical
// thing. It's gone from the list entirely now: The Draft Room is still
// reachable from "The Rooms" dropdown below (RoomsNavMenu), same as every
// other room, and NavLinks' own `currentRoom` prop covers the one thing
// that entry was actually doing inside the Lobby itself — see NavLinks'
// comment.
export const NAV_LINKS = [
  /* The docs page, not the old #proof anchor. That anchor was
     ShowYourWorking's own <section id="proof">, and the owner has taken
     that section off the homepage -- so the link kept working in the sense
     that nothing threw, and scrolled to nothing, which is the worse of the
     two failures because it looks like the page is broken rather than the
     link. The docs page is what "How it works" has always meant and is
     where the footer's own Method column already sends people.

     Reached only through LobbyBar now: this array's other consumer,
     Header.jsx, is orphaned since design_handoff_v3_alive replaced it with
     ShellHeader, which has its own three nav tabs and no How It Works. */
  { label: 'How It Works', href: '/docs/draft-room-how-it-works.html' },
  { label: 'The Rooms', href: '#/rooms' },
]

// The shared renderer for NAV_LINKS — Header.jsx and LobbyBar.jsx both call
// this instead of mapping the array themselves, because "The Rooms" needs
// more than a plain <a> now: it renders as RoomsNavMenu, a dropdown grouped
// by season, instead of a #rooms scroll link — every header gets the
// dropdown for free rather than each one wiring it up (and drifting)
// separately.
//
// `currentRoom` is the second reason this isn't a plain .map(): a caller
// that is itself a room's own header — LobbyBar.jsx today, whichever
// component the next room's lobby uses tomorrow — passes the name of that
// room (e.g. "The Draft Room"), and NavLinks appends it as a fourth,
// non-interactive item: `aria-current="page"`, nothing to click. This
// replaces what "Draft Room" used to do as a permanent NAV_LINKS entry
// (see that array's own comment) with something that (a) only appears
// inside a room, never on the homepage, since Header.jsx never passes this
// prop, and (b) says whichever room is actually open rather than always
// saying "Draft Room" — the mechanism generalises to every future room's
// header for free; only the string passed in changes. It used to be a
// real, always-clickable <a href="#/drafts"> even from inside the Lobby
// itself, which meant clicking it while already there set the hash to the
// value it already was — no hashchange, nothing visibly happens, a silent
// no-op with no explanation. A room's name is a fact about which screen
// you're on, not a link: there's nothing left to navigate to from inside a
// room that "The Rooms" beside it doesn't already cover.
export function NavLinks({ linkClassName, currentRoomClassName, currentRoom, modalRef, onNavigate }) {
  return (
    <>
      {NAV_LINKS.map((link) => {
        if (link.label === 'The Rooms') {
          return <RoomsNavMenu key={link.label} triggerClassName={linkClassName} modalRef={modalRef} />
        }
        return (
          <a key={link.label} href={link.href} onClick={onNavigate} className={linkClassName}>
            {link.label}
          </a>
        )
      })}
      {currentRoom && (
        <span aria-current="page" className={currentRoomClassName}>
          {currentRoom}
        </span>
      )}
    </>
  )
}

// The header's one account control. Log in and Sign Up used to sit here as
// two separate dead ends, each opening the same ComingSoonModal with a
// slightly different "not live yet" paragraph — which was true and useless:
// neither button could do anything, so a visitor had two ways to learn the
// identical fact. Phase 0 of accounts collapsed both into "Get early
// access", singular, taking an email. When real accounts first landed this
// stayed collapsed into one "Log in" trigger (Clerk's modal surfaces its
// own "Sign up" toggle inside), on the reasoning that two working buttons
// were still one control's worth of choice. That reasoning was really only
// about the old ComingSoonModal pair being fake, not about two real
// buttons being redundant — and it cost a click for the exact visitor this
// control most wants to convert: someone with no account yet has to open
// "Log in" and then find the toggle, rather than landing straight in
// sign-up. Split back into two triggers now, the ordinary pattern (see
// Sleeper.com, and most consumer sites): "Sign up" stays the loud pill,
// "Log in" is plain text beside it so the two don't compete for attention —
// this file's own primary-action rule (one loud control per row) applies
// here exactly as it does to `.draft-btn` in the legacy stylesheet. Signed
// in, it's still just Clerk's <UserButton/>. The EarlyAccessModal/modalRef
// path this used to take is gone from here — still very much alive
// elsewhere (RoomsNavMenu's per-room "notify me" for rooms that aren't
// built yet, LockerTable's locker-specific pitch), just not for the one
// thing that's no longer waitlist-only.
//
// useAccountUiReady() is the SSR/no-key guard that used to be a `mounted`
// state and a CLERK_PUBLISHABLE_KEY check inlined right here — see that
// hook's own comment for why both halves exist and how each one fails
// silently. It moved out when HomePhone.jsx's account card needed the
// identical question answered: the phone tree is deliberately a different
// screen rather than a narrower one (CLAUDE.md's mobile-pass rule), so the
// two share the wiring and decide their own look, rather than sharing a
// component neither quite fits. What differs is only what `false` means —
// here the inert triggers still render, because a nav row with a hole in
// it reads as broken.
//
// variant="ghost" (design_handoff_homepage_cosmetic §10's "Nav 'Sign Up'"
// row) is opt-in and homepage-only — Header.jsx passes it explicitly, both
// to its own direct call below and through to MobileNavSheet.jsx's copy.
// LobbyBar.jsx's two call sites (its own desktop row and its own
// MobileNavSheet instance) pass nothing and keep today's filled gradient
// pill. This component is shared with the Draft Room specifically so the
// two headers can't drift apart (this file's own top comment) — restyling
// the shared default in place would have silently carried the homepage's
// ghost treatment into the Cockpit's nav too, which the handoff never asks
// for and CLAUDE.md's scope note rules out ("the marketing homepage only").
export function AccountButtons({ variant = 'filled' }) {
  // buttonClass is Sign up's — the one loud control, exactly the "nav
  // 'Sign Up' pill" §9's tap-target audit and the design handoff both
  // already named it as (see the variant comment above). Log in sits
  // beside it, deliberately plain: text only, no border or fill, so the
  // two don't read as equally weighted. Two buttonClass pills side by
  // side would be the "wallpaper" trap CLAUDE.md's own primary-action
  // rule names for the legacy stylesheet's teal buttons, reached here in
  // a different component — one loud control per row, not two.
  const buttonClass =
    variant === 'ghost'
      ? 'inline-flex h-11 items-center justify-center rounded-full border border-[#454D5E] px-[18px] text-[15px] font-semibold text-[#E6E8EB] transition-colors duration-150 hover:border-[#4892A8] md:h-9'
      : 'inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#22d3ee] to-[#a78bfa] px-4 text-sm font-semibold text-white shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] md:h-9'

  // Same h-11/md:h-9 tap-target floor as Sign up (§9's audit again — a
  // plain-text control is still a real tap target and still owes a phone
  // 44px), just with no background or border to compete with it.
  const loginButtonClass =
    'inline-flex h-11 items-center justify-center rounded-full px-3 text-[15px] font-semibold text-[#B7BEC9] transition-colors duration-150 hover:text-white md:h-9 md:text-sm'

  const accountUiReady = useAccountUiReady()

  const loginTrigger = (
    <button type="button" className={loginButtonClass}>
      Log in
    </button>
  )
  const signUpTrigger = (
    <button type="button" className={buttonClass}>
      Sign up
    </button>
  )

  if (!accountUiReady) {
    // No Clerk (SSR, or a checkout with no key configured at all) — both
    // triggers still render, they just don't open anything yet, matching
    // every other "answer no to a missing binding" fallback in this app
    // rather than throwing.
    return (
      <>
        {loginTrigger}
        {signUpTrigger}
      </>
    )
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">{loginTrigger}</SignInButton>
        <SignUpButton mode="modal">{signUpTrigger}</SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton appearance={CLERK_APPEARANCE} />
      </SignedIn>
    </>
  )
}
