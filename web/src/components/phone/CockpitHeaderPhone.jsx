import { Settings, X } from 'lucide-react'

// The phone-only cockpit header — replaces DraftCockpitHeader's 46px tablet
// bar below the new usePhoneWidth() line rather than growing a third mode
// into that file. DraftCockpitHeader's own bars stay exactly as they were
// for desktop (62px, unconditional) and tablet (46px, `lg:hidden`) —
// this is additive, mounted only from DraftRoomPhone.jsx.
//
// Every value here is a prop DraftRoom.jsx already computed for the
// existing header (code/myTurn/urgent/timeLeft/clockLength) — nothing is
// re-derived from the engine a second time, same rule PickClockBand's own
// header comment states.
function formatClock(seconds) {
  if (seconds == null) return '—:—'
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function CockpitHeaderPhone({ code, myTurn, urgent, timeLeft, clockLength, onOpenMenu }) {
  const pct = clockLength ? Math.max(0, Math.min(100, (timeLeft / clockLength) * 100)) : 0

  return (
    <header className="fixed inset-x-0 top-0 z-40 shrink-0 border-b border-white/[0.06] bg-slate-bar pb-[10px] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center px-3.5 pt-1.5">
        {/* #/drafts, not a modal — the same "back to your draft locker"
            destination DraftCockpitHeader's own chevron already uses.
            44px hit box around a visually smaller glyph, same trick that
            file's own header comment documents for every circular control
            below lg ("a 44px hit box around a visibly smaller pill"). */}
        <a
          href="#/drafts"
          aria-label="Back to your draft locker"
          title="Back to your draft locker"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink-muted"
        >
          <X className="h-[19px] w-[19px]" />
        </a>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-[3px]">
          <span className={'font-plex text-[10px] font-bold uppercase tracking-[0.12em] ' + (myTurn ? 'text-teal-300' : 'text-ink-muted')}>
            {myTurn ? 'YOUR PICK' : 'ON THE CLOCK'}
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={
                'font-display text-[30px] font-bold leading-none tabular-nums ' +
                (urgent ? 'text-rose-300' : 'text-ink')
              }
            >
              {clockLength > 0 ? formatClock(timeLeft) : '—:—'}
            </span>
            {code && <span className="font-plex text-[11px] text-ink-muted">{code}</span>}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenMenu}
          title="Draft settings"
          aria-label="Draft settings"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink-muted"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2]"
          style={{ width: pct + '%' }}
        />
      </div>
    </header>
  )
}
