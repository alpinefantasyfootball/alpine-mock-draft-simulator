import { useMemo } from 'react'

// The real shape of a fantasy year, not a second copy of ROOMS' own
// `season` field (app.js) — that field says which room a task belongs to;
// this says which month it is, and they only have to agree at one point.
// Draft is that point, which is also the one room that's actually live —
// Scout/Trade/Manage are the calendar being honest about what's coming,
// not a claim that those rooms are clickable today (RoomsGrid below is
// where "live" vs "coming soon" actually gets said).
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

export default function PhaseRail() {
  // Computed once per mount from the reader's own clock rather than
  // hardcoded — a page kept open across a month boundary is not a case
  // worth a timer for a decorative rail.
  const active = useMemo(() => currentPhaseKey(), [])

  return (
    <div className="mt-9 border-t border-white/[0.06] pt-6">
      {/* Mobile: a horizontally-scrolling row of bordered chips, the same
          shape v3's own mobile shell uses — there's no room to connect four
          columns with a line at 375px, and the four chips are a clearer
          answer than a rail with three of its segments squeezed flat. */}
      {/* min-w-0: without it this row's own intrinsic width (four
          min-w-[104px] chips plus gaps) wins over the flex/grid column it
          sits in, and overflow-x-auto never gets a bounded box to scroll
          within — the row just renders full width and whatever's past the
          viewport gets silently cut off by a page-level overflow-x-hidden
          instead of being reachable by scrolling. Measured: without this,
          the row was 440px wide in a 375px viewport with nothing to show
          for it. */}
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 lg:hidden">
        {PHASES.map((phase) => {
          const isActive = phase.key === active
          return (
            <div
              key={phase.key}
              className={`flex min-w-[104px] shrink-0 flex-col gap-2 rounded-xl border px-[13px] py-[11px] ${
                isActive ? 'border-mint/40 bg-mint/[0.06]' : 'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-[7px]">
                <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${isActive ? 'bg-mint' : 'bg-white/20'}`} />
                <span
                  className={`font-plex text-[10px] font-semibold uppercase tracking-[0.1em] ${
                    isActive ? 'text-white' : 'text-white/50'
                  }`}
                >
                  {phase.label}
                </span>
              </div>
              <span className="font-plex text-[9.5px] text-white/35">{phase.window}</span>
            </div>
          )
        })}
      </div>

      {/* Desktop: the connected rail — a dot and a line per column, the
          line only drawn toward the next column so the last one doesn't
          trail off into nothing. */}
      <div className="hidden lg:flex">
        {PHASES.map((phase, i) => {
          const isActive = phase.key === active
          return (
            <div key={phase.key} className="flex flex-1 flex-col gap-[9px]">
              <div className="flex items-center">
                <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${isActive ? 'bg-mint' : 'bg-white/15'}`} />
                {i < PHASES.length - 1 && <span className={`h-px flex-1 ${isActive ? 'bg-mint/40' : 'bg-white/10'}`} />}
              </div>
              <span
                className={`font-plex text-[10.5px] font-semibold uppercase tracking-[0.12em] ${
                  isActive ? 'text-white' : 'text-white/45'
                }`}
              >
                {phase.label}
              </span>
              <span className="font-plex text-[10px] text-white/30">{phase.window}</span>
            </div>
          )
        })}
      </div>

      <p className="mt-[18px] max-w-[46ch] text-[14.5px] leading-[1.6] text-white/55">
        Your complete front office &mdash; every phase of the fantasy calendar, in one place.
      </p>
    </div>
  )
}
