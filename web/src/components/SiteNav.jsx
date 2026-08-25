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
// Header.jsx keeps its own literal copy of NAV_LINKS rather than importing
// this one — the homepage is out of scope for the pass that added this
// file, so nothing there was touched. The two lists are identical today;
// if they're ever meant to diverge, that has to be a real decision made in
// Header.jsx, not a second copy quietly drifting from this one.
// Scores dropped: the homepage's own scores strip was removed (a design
// review flagged live NFL scores as off-message on a page selling draft
// prep in August), which took the #scores section with it — leaving this
// entry pointing at an anchor that no longer exists anywhere. Header.jsx's
// own copy lost it for the same reason; this one has to agree, per the
// file comment above about the two lists staying identical.
export const NAV_LINKS = [
  { label: 'How It Works', href: '#proof' },
  { label: 'The Rooms', href: '#rooms' },
  // #/drafts (the Lobby), not #/draft-room — see the comment on ROOMS in
  // app.js. A nav link is a fresh choice, not a resume; #/draft-room
  // lands wherever DraftRoom.jsx's own enteredRoom state already was,
  // stale draft included.
  { label: 'Draft Room', href: '#/drafts' },
]

// Log in / Sign Up, verbatim from Header.jsx: neither does anything real
// yet (there are no accounts), so both just explain that through the same
// ComingSoonModal every other "not built yet" control in this app already
// uses. Takes the modal's ref rather than owning one, so each caller
// decides where its own <ComingSoonModal/> instance lives in the tree.
export function AccountButtons({ modalRef }) {
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
        className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#22d3ee] to-[#a78bfa] px-4 text-sm font-semibold text-white
                   shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] md:h-9"
      >
        Sign Up
      </button>
    </>
  )
}
