import { useState } from 'react'

function elapsed(startedAt) {
  if (!startedAt) return null
  const mins = Math.max(0, Math.round((Date.now() - startedAt) / 60000))
  if (mins < 1) return 'Started just now'
  if (mins < 60) return `Started ${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `Started ${hrs} hr${hrs === 1 ? '' : 's'} ago`
}

export default function InProgressBand({ draft, onResume, onDiscard }) {
  // A single click destroying an in-progress draft is unrecoverable — the
  // handoff calls this out specifically, and this app generally avoids the
  // native confirm() dialog everywhere else (nothing else in web/src uses
  // one), so this is a lightweight in-place relabel instead: click once to
  // arm it, click the same spot again within a few seconds to actually
  // discard, or it disarms itself if you don't.
  const [confirming, setConfirming] = useState(false)

  const handleDiscardClick = () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 4000)
      return
    }
    onDiscard()
  }

  const recent = (draft.recentPicks || []).slice(-6)
  const overallMade = draft.made
  const started = elapsed(draft.startedAt)

  return (
    // grid-cols-1: a fixed 1fr/260px split was never going to fit a phone —
    // the 260px action column alone is most of a 375px viewport before the
    // gap and the left column's own min-content width are even counted.
    // Stacks to a single column below lg, buttons full-width beneath the
    // summary rather than beside it.
    <div
      className="mb-5 grid grid-cols-1 items-center gap-4 rounded-xl border p-[18px] lg:grid-cols-[1fr_260px] lg:gap-7"
      style={{
        borderColor: 'rgba(0,229,255,0.32)',
        borderLeftColor: '#00E5FF',
        borderLeftWidth: 3,
        background: 'linear-gradient(96deg, rgba(0,229,255,0.09), rgba(21,25,35,0.6) 55%)',
      }}
    >
      <div>
        <div className="mb-[10px] flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-[7px] rounded-full bg-teal-400/[0.16] px-[9px] py-[3px] text-[10px] font-bold tracking-[0.07em] text-teal-300">
            <span className="h-[5px] w-[5px] rounded-full bg-teal-400" />
            IN PROGRESS
          </span>
          <span className="font-display text-[19px] font-bold text-white">{draft.leagueType}</span>
          <span className="text-xs text-white/50">
            Seat {draft.pickPosition} · Snake · {draft.rounds} rounds
          </span>
          {started && <span className="text-xs text-white/50">{started}</span>}
        </div>

        <div className="mb-[11px] flex flex-wrap items-center gap-x-[14px] gap-y-1.5">
          <div className="h-[5px] w-full min-w-[80px] flex-1 overflow-hidden rounded-full bg-white/[0.07] sm:w-auto">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.round((overallMade / draft.total) * 100))}%`,
                background: 'linear-gradient(90deg, #00E5FF, #33EAFF)',
              }}
            />
          </div>
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-white/75">
            {draft.round ? `Round ${draft.round} · ` : ''}Pick {overallMade + 1} of {draft.total}
          </span>
          {draft.onClockSlot != null && (
            <span className="whitespace-nowrap text-xs text-white/50">
              {draft.myTurn ? "You're on the clock" : `Seat ${draft.onClockSlot + 1} on the clock`}
            </span>
          )}
        </div>

        {recent.length > 0 && (
          <div className="flex flex-wrap items-center gap-[7px]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">
              Your roster
            </span>
            {recent.map((p, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded border border-white/[0.07] bg-white/[0.03] px-[9px] py-1"
              >
                <span className="text-[10px] font-bold text-white/50">{p.pos}</span>
                <span className="text-xs font-medium text-white/80">{p.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {/* Teal outline, not the gradient — the design is explicit that this
            screen keeps exactly one gradient button (NewMockPanel's), and
            the band's own tint/rule/progress-bar already carry its
            prominence. */}
        <button
          type="button"
          onClick={onResume}
          className="w-full rounded-full border border-teal-400/45 bg-teal-400/10 px-5 py-[11px] text-center text-sm font-semibold text-teal-300 transition-colors duration-150 hover:border-teal-400 hover:bg-teal-400/[0.18] hover:text-teal-200 lg:w-auto"
        >
          Resume draft
        </button>
        <button
          type="button"
          onClick={handleDiscardClick}
          className={
            'text-center text-xs font-medium transition-colors lg:text-left ' +
            (confirming ? 'font-semibold text-rose-300' : 'text-white/50 hover:text-white')
          }
        >
          {confirming ? 'Click again to discard' : 'Discard'}
        </button>
      </div>
    </div>
  )
}
