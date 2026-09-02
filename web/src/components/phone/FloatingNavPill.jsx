import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { SignInButton, useClerk, useUser } from '@clerk/clerk-react'
import { CalendarClock, Compass, Home, ListChecks, LogOut, Settings2, User } from 'lucide-react'
import { useAccountUiReady } from '../../hooks/useAccountUiReady.js'

/* The app-level bottom nav, as a floating pill.

   It replaces MobileAppTabBar.jsx's flush, edge-to-edge, full-width bar,
   and the difference is not decoration. A bar welded to the bottom edge
   reads as part of the page's chrome — the same thing the browser's own
   toolbar is — so it sits in the same visual layer as the address bar and
   the home indicator and reads as furniture. A detached pill floating
   above the content reads as a control that belongs to the app, which is
   what every sports app the owner benchmarked this against ships, and it
   is what makes a phone screen feel like an app rather than a website in
   a browser.

   ---- Three things that are load-bearing rather than styling ----

   It is `fixed`, so it costs the page no layout height at all — which is
   exactly why every scroller underneath it has to reserve its own bottom
   clearance. NAV_PILL_CLEARANCE is that number, exported rather than
   re-typed, because a pill floating over the last row of a list is the
   same failure as a sheet covering the last two rounds of a board, and the
   two places that need it are not near each other in the source.

   The safe-area inset is additive padding, never folded into the height.
   The tap-target row is a fixed 58px; the home-indicator clearance on top
   of it varies by device, so a phone without one would otherwise get 34px
   of dead space for nothing.

   And it hides itself inside a live draft. The draft room has its own,
   different four tabs at a deeper level of the app (the bottom sheet's
   Players/Queue/Team/Chat), and two bottom navs on a 390px screen — one of
   them floating over the other — is the "same control, two affordances"
   problem with the whole navigation system.
*/

// 58px of pill + 8px of float above the safe area + 10px of breathing room.
// Anything that scrolls under this pill reserves it.
export const NAV_PILL_CLEARANCE = 'calc(76px + env(safe-area-inset-bottom))'

const TABS = [
  { key: 'home', label: 'Home', icon: Home, href: '#/' },
  { key: 'lobby', label: 'Drafts', icon: CalendarClock, href: '#/drafts' },
  { key: 'draft', label: 'Board', icon: ListChecks, href: '#/draft-room' },
  { key: 'rooms', label: 'Rooms', icon: Compass, href: '#rooms' },
  { key: 'you', label: 'You', icon: User },
]

function activeFromHash(hash) {
  if (hash.startsWith('#/draft-room')) return 'draft'
  if (hash.startsWith('#/drafts')) return 'lobby'
  if (hash === '' || hash === '#' || hash === '#/') return 'home'
  return null
}

/* The "You" tab, which until now opened the waitlist modal on a line that
   had gone false: "The You room is in build. Leave an email and we'll tell
   you when it opens." Accounts shipped; there was nothing left to wait for.
   It was also, for a while, the only place on a phone this could have
   lived — every AccountButtons call site is inside the desktop half of
   Homepage.jsx. HomePhone's own account card is where signing up starts
   now, and this is where being signed in lives.

   Three states, and the middle one is the one worth naming:

   - **Not ready** — the prerender, the first client pass, or a checkout
     with no publishable key (useAccountUiReady's own comment covers all
     three). The tab still draws, identically, and does nothing when
     tapped. That is deliberately not a disabled or dimmed tab: `ready`
     goes false -> true one tick after mount on every single load, so
     anything that looks different in that window is a flicker on a
     control that is always on screen. The cost is a no-op tap in a
     keyless build, which is the same contract AccountButtons already
     keeps for its own inert triggers.
   - **Signed out** — the whole tab is Clerk's sign-in trigger. Sign-in
     rather than sign-up because a "You" tab is what a returning person
     reaches for; somebody with no account yet is being offered both, in
     order, by the card on the home screen above it. Clerk's own modal
     carries the toggle either way.
   - **Signed in** — YouSheet, below.

   `isLoaded` gets its own branch rather than being folded into "signed
   out". Clerk answers `isSignedIn: undefined` until it has resolved, and
   treating that as signed-out means a signed-in person who taps in that
   window gets handed a sign-in modal for an account they are already in. */
function YouTab({ cls, content, onOpenSheet }) {
  const { isLoaded, isSignedIn } = useUser()

  if (!isLoaded) {
    return <button type="button" className={cls}>{content}</button>
  }
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button type="button" className={cls}>{content}</button>
      </SignInButton>
    )
  }
  return (
    <button type="button" className={cls} onClick={onOpenSheet}>
      {content}
    </button>
  )
}

/* What a signed-in person gets from the You tab: who they are, a way into
   Clerk's own account screen, and a way out.

   An action sheet rather than Clerk's <UserButton/>, and the reason is the
   dead-control rule GameRow's own comment states one file over — a 44px
   pill inside a 78px card means most of the card looks pressable and is
   not. <UserButton/> renders its own avatar-sized button, so dropping it
   into a nav tab would leave the "You" label beside it inert, and the
   label is half the tab's height.

   Sign out is the reason this is a sheet at all rather than a one-line
   call to Clerk's openUserProfile(). <UserButton/>'s menu is the only
   place Clerk offers sign-out by default, and that component exists
   nowhere a phone can reach — so without an explicit row here, somebody
   who signed in on their phone would have no way to sign out anywhere in
   the app. Nothing about auth is reimplemented: useClerk() supplies both
   actions and useUser() the identity. */
function YouSheet({ onClose }) {
  const { user } = useUser()
  const clerk = useClerk()

  const rowClass =
    'flex w-full items-center gap-3 px-4 py-3.5 text-left text-[16px] font-semibold transition-colors active:bg-white/[0.05]'

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/65 backdrop-blur-[2px] sm:hidden"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        className="mx-2 flex flex-col gap-2"
        style={{ marginBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-[18px] border border-line-hairline bg-surface-card">
          {/* Who you are, before what you can do about it. The avatar is
              Clerk's own CDN (img.clerk.com), which _headers' img-src
              already allows for exactly this — it was added for
              <UserButton/>'s picture and this is the same image. */}
          <div className="flex items-center gap-3 border-b border-line-hairline px-4 py-3.5">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-300">
                <User className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              {user?.fullName && (
                <span className="block truncate text-[15px] font-bold text-white">{user.fullName}</span>
              )}
              <span className="block truncate text-[13px] text-voidInk-muted">
                {user?.primaryEmailAddress?.emailAddress || 'Signed in'}
              </span>
            </span>
          </div>

          <button
            type="button"
            className={rowClass + ' text-voidInk-body'}
            onClick={() => { onClose(); clerk.openUserProfile() }}
          >
            <Settings2 className="h-[19px] w-[19px] shrink-0 text-voidInk-muted" aria-hidden="true" />
            Manage account
          </button>
          <button
            type="button"
            className={rowClass + ' border-t border-line-hairline text-rose-400'}
            onClick={() => { onClose(); clerk.signOut() }}
          >
            <LogOut className="h-[19px] w-[19px] shrink-0 text-rose-400" aria-hidden="true" />
            Sign out
          </button>
        </div>

        {/* Cancel in its own group, the way an action sheet has always
            done it — the same shape DraftMenuOverlay's phone frame uses. */}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-[18px] border border-line-hairline bg-surface-nav px-5 py-4 text-center text-[16px] font-bold text-white active:bg-white/[0.05]"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  )
}

export default function FloatingNavPill() {
  const [active, setActive] = useState(() => (typeof window === 'undefined' ? null : activeFromHash(location.hash)))
  const [youOpen, setYouOpen] = useState(false)
  const accountUiReady = useAccountUiReady()

  useEffect(() => {
    const onHash = () => setActive(activeFromHash(location.hash))
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 sm:hidden"
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex w-full max-w-[420px] items-stretch gap-0.5 rounded-full border border-white/[0.09] bg-[rgba(17,20,25,0.86)] px-1.5 shadow-[0_10px_34px_-8px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = active === t.key
            const cls =
              'flex h-[58px] flex-1 flex-col items-center justify-center gap-[3px] rounded-full text-[10px] font-semibold transition-colors duration-150 ' +
              (isActive ? 'text-teal-300' : 'text-[#7C8A99]')
            const content = (
              <>
                {/* The active tab gets a filled lozenge behind its glyph
                    rather than a top border. A border on a pill fights the
                    pill's own rounded edge — the two curves do not agree —
                    and a lozenge is the shape that does. */}
                <span
                  className={
                    'flex h-[26px] w-[42px] items-center justify-center rounded-full transition-colors duration-150 ' +
                    (isActive ? 'bg-teal-500/15' : '')
                  }
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.3 : 1.8} />
                </span>
                {t.label}
              </>
            )
            if (t.href) {
              return (
                <a key={t.key} href={t.href} className={cls} aria-current={isActive ? 'page' : undefined}>
                  {content}
                </a>
              )
            }
            // The one tab with no destination — see YouTab. Its hooks call
            // into Clerk, so it may only mount once there is a provider
            // above it to call into, which is exactly what accountUiReady
            // answers; the plain button is what stands in until then.
            return accountUiReady ? (
              <YouTab key={t.key} cls={cls} content={content} onOpenSheet={() => setYouOpen(true)} />
            ) : (
              <button key={t.key} type="button" className={cls}>{content}</button>
            )
          })}
        </div>
      </nav>
      {accountUiReady && youOpen && <YouSheet onClose={() => setYouOpen(false)} />}
    </>
  )
}
