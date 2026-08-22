// The screen's one primary action, moved here from LobbyBar.jsx verbatim —
// same gradient, same disabled/problem handling — per the design's own fix
// for the two-primaries bug (LobbyBar's old "Enter Draft Room" and
// DraftLocker's own EmptyState button wearing the identical gradient for
// the identical job). One launcher, one gradient button, on this one panel.
//
// w-full lg:w-[396px]: this panel used to be a hardcoded 396px regardless of
// viewport — wider than a 375-390px phone outright, the hard blocker the
// mobile handoff calls out first. Full-bleed below lg, the fixed card width
// back above it.
export default function NewMockPanel({ engine, league, problem, lobbySlot, onStartNew, onOpenSettings }) {
  const scoringNames = engine.scoringNames()
  const clockLength = engine.clockLength()

  // Desktop's label/value rows — unchanged.
  const rows = [
    { label: 'Teams', value: league.teams },
    { label: 'Scoring', value: scoringNames[league.scoring] || league.scoring },
    { label: 'Rounds', value: league.rounds },
    // The only draft order this app runs — not a per-league setting to
    // read, so not pulled from anywhere.
    { label: 'Order', value: 'Snake' },
    { label: 'Your seat', value: lobbySlot + 1 },
  ]

  // Mobile's wrapping chip row — the same values as the rows above, plus the
  // pick clock (which the desktop rows list has never shown), each combined
  // into one label+value string rather than a label-left/value-right line: a
  // six-row table doesn't fit a full-bleed panel at 375px, a chip does.
  // clockLength comes from engine.clockLength(), the identical read
  // DraftSettingsModal's own "Seconds per pick" control uses — not a second
  // source for the same number. 0 means no clock (app.js's own comment on
  // state.clockLength), so that reads as "No clock" rather than "0s clock".
  const chips = [
    `${league.teams} teams`,
    scoringNames[league.scoring] || league.scoring,
    'Snake',
    `${league.rounds} rounds`,
    `Seat ${lobbySlot + 1}`,
    clockLength ? `${clockLength}s clock` : 'No clock',
  ]

  return (
    <div
      className="w-full rounded-xl border border-white/[0.09] p-[22px] lg:w-[396px] lg:shrink-0"
      style={{ background: 'linear-gradient(168deg, #171d28, #10141c)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[23px] font-bold text-white">New mock draft</h2>
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-sm font-semibold text-teal-300 transition-colors hover:text-teal-200"
        >
          Edit setup
        </button>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-white/[0.06] lg:block">
        <div className="flex flex-col gap-px">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between bg-white/[0.02] px-[14px] py-[11px]">
              <span className="text-xs text-white/50">{row.label}</span>
              <span className="font-semibold tabular-nums text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:hidden">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-[7px] font-plex text-[12.5px] text-white/80"
          >
            {chip}
          </span>
        ))}
      </div>

      {/* Disabled with the reason beside it, never disabled and silent —
          setupProblem()'s message is the whole explanation and hiding it
          leaves a button that refuses without saying why. Same rule
          LobbyBar.jsx enforced before this control lived here.
          py-[15px]: 15+15+24 (text-base's own line-height) = 54px, the
          primary-CTA floor, on every width — not a mobile-only bump, since
          the same button is the same element at both sizes. */}
      <button
        type="button"
        onClick={onStartNew}
        disabled={!!problem}
        title={problem || undefined}
        className={
          'mt-4 w-full rounded-full py-[15px] text-base font-bold transition-all duration-200 ' +
          (problem
            ? 'cursor-not-allowed bg-white/5 text-white/25'
            : 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-glass hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]')
        }
      >
        Start mock draft
      </button>
      {problem && <p className="mt-2 text-[11px] leading-relaxed text-rose-300/90">{problem}</p>}
    </div>
  )
}
