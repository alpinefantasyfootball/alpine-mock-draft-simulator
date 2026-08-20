import { Sparkles } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

// Every number here is a real, already-existing function — nothing was
// invented for this card:
//   - `player` is suggestions('ALL')[0] from app.js, the same ranking
//     (adp+jitter) x need x risk x model that drives the legacy Suggestions
//     tab. 'ALL' rather than the queue's own position pill on purpose — see
//     CLAUDE.md's autoPickForMe() note: a filter is a lens, never the thing
//     deciding what "recommended" means.
//   - `vorp` is replacementGap(player), the un-clamped points-above-
//     replacement figure overallScore() itself divides down to a 0-100
//     share — already named "vor" in app.js's own source.
//   - `tierLeft` is tierRemaining(player), the exact function the legacy
//     board's tier chips already print ("2 left in tier 1").
//
// The alert only renders when tierLeft is genuinely small (<=3) — the
// legacy tierChip() always prints something, but calling six players left
// a "scarcity alert" would be crying wolf. Nothing to recommend (no
// player, or every position full) means no card, not an empty one.
export default function JukeValueAssistant({ player, vorp, tierLeft, onDraft, myTurn, photoFor, initialsFor }) {
  if (!player) return null

  const photo = photoFor(player)

  return (
    <div className="mb-3 rounded-xl border border-teal-500/40 bg-slate-900/90 p-4 shadow-[0_0_20px_rgba(0,229,255,0.1)]">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-teal-300">
        <Sparkles className="h-3 w-3" />
        Juke Value Assistant
      </p>

      <p className="mt-3 text-[9px] font-semibold uppercase tracking-wide text-white/40">Recommended Pick</p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-[9px] font-bold text-white/40">
          {initialsFor(player)}
          {photo && (
            <img
              src={photo}
              alt=""
              loading="lazy"
              onError={(e) => e.currentTarget.remove()}
              className={'absolute inset-0 h-full w-full ' + (player.pos === 'DST' ? 'object-contain p-1' : 'object-cover')}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ' + (POS_BADGE[player.pos] || 'bg-white/10 text-white/50')}>
              {player.pos}
            </span>
            <p className="truncate text-sm font-semibold text-white">{player.name}</p>
          </div>
          <p className="truncate text-[11px] text-white/40">{player.team}</p>
        </div>
        {vorp != null && (
          <div className="shrink-0 text-right leading-none">
            <span className={'block font-display text-base font-bold tabular-nums ' + (vorp >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
              {vorp >= 0 ? '+' : ''}
              {vorp.toFixed(1)}
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-wide text-white/30">VORP</span>
          </div>
        )}
      </div>

      {tierLeft != null && tierLeft <= 3 && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-amber-200">
          <span aria-hidden="true">⚠️</span>
          <span>
            <span className="font-bold uppercase tracking-wide">Tier scarcity —</span> only {tierLeft} Tier-{player.tier} {player.pos}
            {tierLeft === 1 ? '' : 's'} remaining before a steep drop-off.
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() => onDraft(player)}
        disabled={!myTurn}
        title={myTurn ? undefined : 'Not your turn'}
        className={
          'mt-3 w-full rounded-lg py-2 text-sm font-bold transition-all duration-200 ' +
          (myTurn
            ? 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-[0_0_18px_rgba(0,229,255,0.5)] hover:scale-[1.02] hover:shadow-[0_0_26px_rgba(0,229,255,0.7)]'
            : 'cursor-not-allowed bg-white/5 text-white/25')
        }
      >
        Draft Recommended
      </button>
    </div>
  )
}
