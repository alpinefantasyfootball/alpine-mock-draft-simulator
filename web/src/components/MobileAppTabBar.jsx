import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Compass, ListChecks, User } from 'lucide-react'
import ComingSoonModal from './ComingSoonModal.jsx'

// The app-level bottom nav — Lobby / Draft / Rooms / You — mounted only
// alongside LobbyBar.jsx (DraftRoom.jsx's Locker branch), never inside a
// live draft: the draft room has its own, different four tabs
// (MobileDraftTabBar.jsx, Decide/Board/Roster/Players) at a deeper level of
// the app, not this bar reused. Two bars, two navigation depths — confirmed
// against the handoff's own screenshots (1b vs 1c/1d), not assumed.
//
// Lobby and Draft are real routes; Rooms and You have no screen behind them
// yet, so they open the same ComingSoonModal every other not-built-yet
// control in this app already uses (SiteNav.jsx's AccountButtons,
// RoomsGrid.jsx's five non-live room cards) rather than linking somewhere
// that 404s.
const TABS = [
  { key: 'lobby', label: 'Lobby', icon: CalendarClock, href: '#/drafts' },
  { key: 'draft', label: 'Draft', icon: ListChecks, href: '#/draft-room' },
  { key: 'rooms', label: 'Rooms', icon: Compass },
  { key: 'you', label: 'You', icon: User },
]

function activeFromHash(hash) {
  if (hash.startsWith('#/draft-room')) return 'draft'
  if (hash.startsWith('#/drafts')) return 'lobby'
  return null
}

export default function MobileAppTabBar() {
  const [active, setActive] = useState(() => activeFromHash(location.hash))
  const modalRef = useRef(null)

  useEffect(() => {
    const onHash = () => setActive(activeFromHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <>
      {/* env(safe-area-inset-bottom) as padding, not a fixed height bump —
          the 58px is the tap-target row itself; the home-indicator clearance
          on top of it varies by device and has to be additive, or a device
          with no inset gets 58px of dead padding for nothing. lg:hidden:
          desktop's Locker keeps its own header-only nav, no bottom bar. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[0.06] bg-obsidian/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = active === t.key
          const commonClass =
            'flex flex-1 flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-semibold transition-colors ' +
            (isActive ? 'border-teal-400 text-teal-300' : 'border-transparent text-[#7C8A99]')
          const content = (
            <>
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
              {t.label}
            </>
          )
          return t.href ? (
            <a key={t.key} href={t.href} className={commonClass + ' h-[58px]'}>
              {content}
            </a>
          ) : (
            <button
              key={t.key}
              type="button"
              onClick={() =>
                modalRef.current?.open(
                  `The ${t.label} room is coming`,
                  'This room is still in build. The Draft Room is the one that’s live today.'
                )
              }
              className={commonClass + ' h-[58px]'}
            >
              {content}
            </button>
          )
        })}
      </nav>
      <ComingSoonModal ref={modalRef} />
    </>
  )
}
