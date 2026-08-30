import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Compass, Home, ListChecks, User } from 'lucide-react'
import EarlyAccessModal from '../EarlyAccessModal.jsx'

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

export default function FloatingNavPill() {
  const [active, setActive] = useState(() => (typeof window === 'undefined' ? null : activeFromHash(location.hash)))
  const modalRef = useRef(null)

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
            return t.href ? (
              <a key={t.key} href={t.href} className={cls} aria-current={isActive ? 'page' : undefined}>
                {content}
              </a>
            ) : (
              <button
                key={t.key}
                type="button"
                onClick={() =>
                  modalRef.current?.open(
                    "The You room is in build. Leave an email and we'll tell you when it opens.",
                    'nav:you',
                  )
                }
                className={cls}
              >
                {content}
              </button>
            )
          })}
        </div>
      </nav>
      <EarlyAccessModal ref={modalRef} />
    </>
  )
}
