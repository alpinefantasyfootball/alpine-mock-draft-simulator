import { useMemo } from 'react'

// The real shape of a fantasy year, not a second copy of ROOMS' own
// `season` field (app.js) — that field says which room a task belongs to;
// this says which month it is, and they only have to agree at one point.
// Draft is that point, which is also the one room that's actually live —
// Scout/Trade/Manage are the calendar being honest about what's coming,
// not a claim that those rooms are clickable today (RoomsGrid's own cards
// below this strip are where "live" vs "coming soon" actually gets said).
const PHASES = [
  { key: 'scout', label: 'Scout', window: 'Apr – Jul', months: [4, 5, 6, 7] },
  { key: 'draft', label: 'Draft', window: 'August', months: [8] },
  { key: 'trade', label: 'Trade', window: 'Sep – Dec', months: [9, 10, 11, 12] },
  { key: 'manage', label: 'Manage', window: 'Year-round', months: [1, 2, 3] },
]

// Every month maps to exactly one phase, so this always finds one — the
// fallback only exists to satisfy that the function has a return type, not
// because the four month lists above actually leave a gap.
function currentPhaseKey() {
  const month = new Date().getMonth() + 1
  return PHASES.find((p) => p.months.includes(month))?.key ?? 'draft'
}

// Homepage cosmetic revision (design_handoff_homepage_cosmetic) §8: this
// used to sit in the hero, under the CTA pair — "five competing ideas" in
// one section, per the handoff's own complaint. Moved here, directly above
// RoomsGrid.jsx's own cards, where the same content (what's live, what's
// coming, and when) is already being explained. Hero.jsx's own comment on
// its `min-w-0` fix records where this used to live and why that fix
// stayed behind anyway.
//
// The 1px-gap-over-a-hairline-background trick: the container's own
// background is the divider colour, and a 1px gap between cells lets a
// sliver of it show through as a hairline — no per-cell border needed, and
// no doubled-up 2px line where two cells meet.
export default function PhaseRail() {
  // Computed once per mount from the reader's own clock rather than
  // hardcoded — a page kept open across a month boundary is not a case
  // worth a timer for a decorative rail.
  const active = useMemo(() => currentPhaseKey(), [])

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line-hairline lg:grid-cols-4">
      {PHASES.map((phase) => {
        const isActive = phase.key === active
        return (
          <div key={phase.key} className="px-[18px] py-4" style={{ background: isActive ? '#092120' : '#12151A' }}>
            <div className="flex items-center gap-2">
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: isActive ? '#74E5CE' : '#3A3D44' }}
              />
              <span
                className="font-voidNumeral text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: isActive ? '#7EF0D7' : '#9B9EA5' }}
              >
                {phase.label}
              </span>
            </div>
            <span className="mt-[6px] block font-voidNumeral tabular-nums text-[12px] font-medium text-voidInk-muted">
              {phase.window}
            </span>
          </div>
        )
      })}
    </div>
  )
}
