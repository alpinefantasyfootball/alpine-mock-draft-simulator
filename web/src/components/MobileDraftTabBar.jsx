import { ClipboardList, Grid3x3, Target, Users } from 'lucide-react'

// The draft room's own bottom tab bar — Decide / Board / Roster / Players —
// mounted only inside a live draft (DraftRoom.jsx's started branch), lg:hidden.
// A different bar at a different navigation depth than MobileAppTabBar.jsx;
// see that file's own comment for why they're two components, not one.
//
// Roster and Players don't own screens of their own. Per the confirmed plan
// decision, they open the existing PlayerHub sheet pre-selected to its Team
// or Players internal tab — not a second player-browsing surface. PlayerHub
// already has five tabs (Players/Queue/Team/Chat/Log); this bar exposes two
// of them directly because they're the two someone reaches for constantly
// mid-draft, and leaves Queue/Chat/Log reachable inside the sheet once
// opened, same as before this pass — nothing about those three lost a way
// in, they just didn't get a seventh and eighth bottom-bar icon apiece.
export default function MobileDraftTabBar({ view, onSelectView, hubOpen, hubTab, onOpenHub }) {
  const items = [
    { key: 'decide', label: 'Decide', icon: Target, active: view === 'decide' && !hubOpen,
      onClick: () => onSelectView('decide') },
    { key: 'board', label: 'Board', icon: Grid3x3, active: view === 'board' && !hubOpen,
      onClick: () => onSelectView('board') },
    { key: 'roster', label: 'Roster', icon: ClipboardList, active: hubOpen && hubTab === 'team',
      onClick: () => onOpenHub('team') },
    { key: 'players', label: 'Players', icon: Users, active: hubOpen && hubTab === 'players',
      onClick: () => onOpenHub('players') },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/[0.06] bg-obsidian/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((t) => {
        const Icon = t.icon
        return (
          <button
            key={t.key}
            type="button"
            onClick={t.onClick}
            className={
              'flex h-[58px] flex-1 flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-semibold transition-colors ' +
              (t.active ? 'border-teal-400 text-teal-300' : 'border-transparent text-[#7C8A99]')
            }
          >
            <Icon className="h-5 w-5" strokeWidth={t.active ? 2.25 : 1.75} />
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
