// Pinned above the tab strip's own content, on every mobile draft-room tab
// — the one thing worth knowing regardless of whether you're looking at
// Decide, Board, Roster or Players right now. lg:hidden: desktop already
// says all of this inside DraftCockpitHeader's own row, at a width where a
// second copy of the same facts would just be redundant furniture.
//
// Every value here is a prop DraftRoom.jsx already computed for
// DraftCockpitHeader — onClock/overall/code/myTurn/urgent/timeLeft/
// clockLength — plus nextOverall/nextPicks, lifted out of
// DraftDecideScreen.jsx this same pass so this band and that screen can
// never disagree about "how many picks away." Nothing here is recomputed
// from the engine a second time.
function formatClock(seconds) {
  if (seconds == null) return '—:—'
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function PickClockBand({ code, myTurn, urgent, timeLeft, clockLength, nextOverall, nextPicks, overall, teams, onClock }) {
  const picksAway = nextOverall != null && overall != null ? nextOverall - overall : null
  const whoLabel = myTurn
    ? 'YOUR PICK'
    : onClock
      ? `SEAT ${onClock.slot + 1} PICKING`
      : 'ON THE CLOCK'

  return (
    <div
      className={
        'flex flex-col gap-2 border-b px-4 py-2.5 lg:hidden ' +
        (myTurn
          ? 'border-teal-400/20 bg-teal-400/[0.07]'
          : urgent
            ? 'border-rose-400/25 bg-rose-500/[0.08]'
            : 'border-white/[0.06] bg-white/[0.02]')
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              'h-2 w-2 shrink-0 rounded-full ' +
              (myTurn ? 'animate-pulse bg-teal-300' : urgent ? 'animate-pulse bg-rose-400' : 'bg-white/30')
            }
          />
          <span className={'truncate font-plex text-[12.5px] font-bold uppercase tracking-[0.08em] ' + (myTurn ? 'text-teal-200' : 'text-white/60')}>
            {whoLabel}{code ? ` · ${code}` : ''}
          </span>
        </div>
        <span className={'shrink-0 font-plex text-[25px] font-bold tabular-nums leading-none ' + (urgent ? 'text-rose-300' : myTurn ? 'text-teal-200' : 'text-white/80')}>
          {clockLength > 0 ? formatClock(timeLeft) : '—'}
        </span>
      </div>

      {nextPicks && nextPicks.length > 0 && (
        <div className="flex items-baseline gap-2 text-[11px] text-white/50">
          <span className="shrink-0 font-bold uppercase tracking-[0.08em] text-white/40">Next</span>
          <span className="min-w-0 flex-1 truncate font-plex">
            {nextPicks.slice(0, 3).map((o) => (window.DraftEngine ? window.DraftEngine.pickCode(o, teams) : o)).join(' · ')}
          </span>
          {picksAway != null && picksAway > 0 && (
            <span className="shrink-0 font-plex text-white/45">{picksAway} pick{picksAway === 1 ? '' : 's'} away</span>
          )}
        </div>
      )}
    </div>
  )
}
