import { ChartColumn, LayoutGrid, List, Sparkle } from 'lucide-react'

// The draft room's own bottom tab bar — Players / Board / Decide / Analysis,
// the same order and the same four screens DraftCockpitHeader's desktop nav
// carries — mounted only inside a live draft (DraftRoom.jsx's started
// branch), lg:hidden. A different bar at a different navigation depth than
// MobileAppTabBar.jsx; see that file's own comment for why they're two
// components, not one.
//
// Four items now, not five. Roster used to be its own bar slot that opened
// PlayerHub's sheet pre-selected to its Team tab; it has no slot of its own
// any more because it is a pane *inside* Players (PlayersTab.jsx's own
// segmented control), the same way Players itself used to be a sheet and is
// now a real screen. PlayerHub keeps Queue/Chat/Log for the Board view only
// — see its own file comment on the `tabs` prop this bar no longer needs to
// reach into.
//
// The four glyphs differ in shape, not corner radius — the set this
// replaced was two grid variants distinguished mostly by rounding, and read
// as the same icon at 20px. Three stacked bars (List) for Players, a 2x2
// grid (LayoutGrid) for Board, a diamond (Sparkle reads close enough at this
// size) for Decide, three ascending bars (ChartColumn) for Analysis.
export default function MobileDraftTabBar({ view, onSelectView, draftIsOver }) {
  const items = [
    { key: 'players', label: 'Players', icon: List },
    { key: 'board', label: 'Board', icon: LayoutGrid },
    // Decide has nothing left to decide once the board is full, and
    // DraftRoom.jsx already redirects the view off it at that point — so
    // the tab goes with it rather than staying as a button that silently
    // lands somewhere else.
    ...(draftIsOver ? [] : [{ key: 'decide', label: 'Decide', icon: Sparkle }]),
    { key: 'analysis', label: 'Analysis', icon: ChartColumn },
  ]

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/[0.06] bg-slate-bar/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map((t) => {
        const Icon = t.icon
        const active = view === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelectView(t.key)}
            aria-pressed={active}
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
              (active ? 'border-teal-400 text-teal-300' : 'border-transparent text-ink-muted')
            }
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
