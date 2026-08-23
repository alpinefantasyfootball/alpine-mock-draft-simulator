import { ChartColumn, ClipboardList, LayoutGrid, List, Sparkle } from 'lucide-react'

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
// Five items, not four. Analysis has no side rail to live in on a phone and
// DraftCockpitHeader's own tab nav is `md:flex`, so below 768px there was no
// way to reach it at all — the running grade simply did not exist on a phone.
// At 390px five flex-1 items are 78px each, which is the handoff's own figure
// and comfortably holds "Analysis" at 11px.
//
// The icons are named by the handoff because this bar has no desktop
// equivalent to copy from, and the set it replaced was differentiated mostly
// by corner radius — Grid3x3 and ClipboardList read as the same glyph at 20px.
export default function MobileDraftTabBar({ view, onSelectView, hubOpen, hubTab, onOpenHub, draftIsOver }) {
  const items = [
    // Decide has nothing left to decide once the board is full, and
    // DraftRoom.jsx already redirects the view off it at that point — so the
    // tab goes with it rather than staying as a button that silently lands
    // somewhere else.
    ...(draftIsOver ? [] : [{ key: 'decide', label: 'Decide', icon: Sparkle, active: view === 'decide' && !hubOpen,
      onClick: () => onSelectView('decide') }]),
    { key: 'board', label: 'Board', icon: LayoutGrid, active: view === 'board' && !hubOpen,
      onClick: () => onSelectView('board') },
    { key: 'roster', label: 'Roster', icon: ClipboardList, active: hubOpen && hubTab === 'team',
      onClick: () => onOpenHub('team') },
    { key: 'players', label: 'Players', icon: List, active: hubOpen && hubTab === 'players',
      onClick: () => onOpenHub('players') },
    { key: 'analysis', label: 'Analysis', icon: ChartColumn, active: view === 'analysis' && !hubOpen,
      onClick: () => onSelectView('analysis') },
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
              // #7C8A99, not PROMPT 6's #55616f: measured on this bar's own
              // #0B0E14 ground that is 3.06:1 behind an 11px label, under
              // the 4.5:1 bar. PROMPT 1 of the same handoff specifies this
              // value, and PROMPT 5 quotes its 5.48:1 approvingly for the
              // board's empty-cell pick number — so this follows the
              // document's own reasoning rather than one of its numbers.
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
