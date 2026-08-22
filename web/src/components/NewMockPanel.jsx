// The screen's one primary action, moved here from LobbyBar.jsx verbatim —
// same gradient, same disabled/problem handling — per the design's own fix
// for the two-primaries bug (LobbyBar's old "Enter Draft Room" and
// DraftLocker's own EmptyState button wearing the identical gradient for
// the identical job). One launcher, one gradient button, on this one panel.
export default function NewMockPanel({ engine, league, problem, lobbySlot, onStartNew, presets, onOpenSettings }) {
  const scoringNames = engine.scoringNames()
  const rows = [
    { label: 'Teams', value: league.teams },
    { label: 'Scoring', value: scoringNames[league.scoring] || league.scoring },
    { label: 'Rounds', value: league.rounds },
    // The only draft order this app runs — not a per-league setting to
    // read, so not pulled from anywhere.
    { label: 'Order', value: 'Snake' },
    { label: 'Your seat', value: lobbySlot + 1 },
  ]

  const startPreset = (id) => {
    if (engine.startFromHistoryLeague(id)) return
    // A preset can fail setupProblem() the same way the main CTA can (the
    // stored league no longer fits, e.g. a roster shape that's since become
    // invalid) — falls back to the ordinary path rather than doing nothing,
    // so the click still goes somewhere.
    onStartNew()
  }

  return (
    <div
      className="w-[396px] shrink-0 rounded-xl border border-white/[0.09] p-[22px]"
      style={{ background: 'linear-gradient(168deg, #171d28, #10141c)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[23px] font-bold text-white">New mock</h2>
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-sm font-semibold text-teal-300 transition-colors hover:text-teal-200"
        >
          Edit setup
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/[0.06]">
        <div className="flex flex-col gap-px">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between bg-white/[0.02] px-[14px] py-[11px]">
              <span className="text-xs text-white/50">{row.label}</span>
              <span className="font-semibold tabular-nums text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disabled with the reason beside it, never disabled and silent —
          setupProblem()'s message is the whole explanation and hiding it
          leaves a button that refuses without saying why. Same rule
          LobbyBar.jsx enforced before this control lived here. */}
      <button
        type="button"
        onClick={onStartNew}
        disabled={!!problem}
        title={problem || undefined}
        className={
          'mt-4 w-full rounded-full py-[14px] text-base font-bold transition-all duration-200 ' +
          (problem
            ? 'cursor-not-allowed bg-white/5 text-white/25'
            : 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-glass hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]')
        }
      >
        Start mock draft
      </button>
      {problem && <p className="mt-2 text-[11px] leading-relaxed text-rose-300/90">{problem}</p>}

      {presets && (
        <div className="mt-[18px] border-t border-white/[0.06] pt-4">
          <p className="mb-[10px] text-[10px] font-semibold uppercase tracking-[0.09em] text-white/50">
            Or start from
          </p>
          <div className="flex flex-col gap-[7px]">
            {[
              presets.repeatLast && { ...presets.repeatLast, meta: 'Repeat last setup' },
              presets.mostRun && { ...presets.mostRun, meta: 'Most run' },
              presets.deepestBoard && { ...presets.deepestBoard, meta: 'Deepest board' },
            ]
              // Two presets can legitimately name the same entry (the last
              // mock run was also the most-run format) — shown once, not
              // twice under two different labels for the identical click.
              .filter(Boolean)
              .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
              .map((preset) => (
                <button
                  key={preset.meta}
                  type="button"
                  onClick={() => startPreset(preset.id)}
                  className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-[13px] py-[10px] text-left transition-colors duration-150 hover:border-teal-400/40 hover:bg-teal-400/5"
                >
                  <span className="font-body text-sm font-medium text-white/85">
                    {preset.meta === 'Repeat last setup'
                      ? 'Repeat last setup'
                      : `${preset.teams}-team ${scoringNames[preset.scoring] || preset.scoring}`}
                  </span>
                  <span className="text-xs tabular-nums text-white/50">
                    {preset.meta === 'Repeat last setup'
                      ? `${preset.teams}-team · ${scoringNames[preset.scoring] || preset.scoring}`
                      : preset.meta}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
