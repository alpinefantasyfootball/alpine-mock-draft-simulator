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
  /* The hub has five internal tabs and this bar maps two of them. Queue, Chat
     and Log are reachable — the Board's own "Log ›" button opens one directly —
     and while any of those was showing, every item here fell through to
     inactive and the bar drew *nothing* as selected. A five-item nav with no
     selection reads as "no tab is on", which is never true.

     So an item that owns a hub tab lights for that tab, and a view item lights
     when its view is showing and the hub is not sitting on one of those two.
     The sheet is a layer over the current view, so on Queue/Chat/Log the bar
     correctly keeps pointing at the Board or Decide underneath it. */
  const hubOwnsTab = hubOpen && (hubTab === 'team' || hubTab === 'players')
  const viewActive = (v) => view === v && !hubOwnsTab

  const items = [
    // Decide has nothing left to decide once the board is full, and
    // DraftRoom.jsx already redirects the view off it at that point — so the
    // tab goes with it rather than staying as a button that silently lands
    // somewhere else.
    ...(draftIsOver ? [] : [{ key: 'decide', label: 'Decide', icon: Sparkle, active: viewActive('decide'),
      onClick: () => onSelectView('decide') }]),
    { key: 'board', label: 'Board', icon: LayoutGrid, active: viewActive('board'),
      onClick: () => onSelectView('board') },
    { key: 'roster', label: 'Roster', icon: ClipboardList, active: hubOpen && hubTab === 'team',
      onClick: () => onOpenHub('team') },
    { key: 'players', label: 'Players', icon: List, active: hubOpen && hubTab === 'players',
      onClick: () => onOpenHub('players') },
    { key: 'analysis', label: 'Analysis', icon: ChartColumn, active: viewActive('analysis'),
      onClick: () => onSelectView('analysis') },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/[0.06] bg-slate-bar/95 backdrop-blur-md lg:hidden"
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
              // The inactive label is `ink-muted`, the palette's stated floor
              // for an 11px label, measured 5.59:1 on this bar's composited
              // ground. It was #7C8A99, chosen against the old #0B0E14 bar
              // where PROMPT 6's #55616f measured 3.06:1 and failed; the
              // reasoning was right and the value did not survive the ground
              // moving to slate, where it scrapes 4.53:1 — past the bar by
              // 0.03, which is not a margin. The board's empty-cell pick
              // number carried a second copy of the same hex for the same
              // reason and moved to the token scale too — to `ink-soft`
              // rather than this one, because a board cell can carry the
              // gold identity wash and this bar cannot. Same scale, one
              // step apart, and the step is the ground rather than taste.
              (t.active ? 'border-teal-400 text-teal-300' : 'border-transparent text-ink-muted')
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
