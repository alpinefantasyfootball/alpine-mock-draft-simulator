import RoomsNavMenu from './RoomsNavMenu.jsx'

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
  { label: 'How It Works', href: '#proof' },
  { label: 'The Rooms', href: '#rooms' },
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

// Log in / Sign Up, verbatim from Header.jsx: neither does anything real
// yet (there are no accounts), so both just explain that through the same
// ComingSoonModal every other "not built yet" control in this app already
// uses. Takes the modal's ref rather than owning one, so each caller
// decides where its own <ComingSoonModal/> instance lives in the tree.
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
export function AccountButtons({ modalRef, variant = 'filled' }) {
  const signUpClass =
    variant === 'ghost'
      ? 'inline-flex h-11 items-center justify-center rounded-full border border-[#454D5E] px-[18px] text-[15px] font-semibold text-[#E6E8EB] transition-colors duration-150 hover:border-[#4892A8] md:h-9'
      : 'inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#22d3ee] to-[#a78bfa] px-4 text-sm font-semibold text-white shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] md:h-9'

  return (
    <>
      {/* h-11 (44px) below md, §9's own tap-target floor — py-2 alone
          measured 36px, found during homepage v4 pass 3's tap-target
          audit (this pill is the exact one §9 names: "the nav Sign Up
          pill"). md:h-9 keeps the shorter desktop nav pill AccountButtons
          shipped with, the same split CLAUDE.md documents ScoringDemoCard's
          own mobile pills already using ("h-11 ... not met by desktop's
          shorter chip") — one shared component, two heights, not two
          components. */}
      <button
        type="button"
        onClick={() =>
          modalRef.current?.open(
            'Accounts are not live yet',
            'There is nothing to log into so far. Your drafts save to this device, ' +
              'so you can close the tab and pick up where you left off.'
          )
        }
        className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm text-white/60 transition-colors hover:text-white md:h-9"
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
        className={signUpClass}
      >
        Sign Up
      </button>
    </>
  )
}
