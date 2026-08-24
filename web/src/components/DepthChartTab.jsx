import { POS_BADGE } from './draftRoomPositions.js'

// Only players inside the draftable pool appear here — engine.depthChartFor()
// filters to the board the same way the legacy sheet's own depth chart does
// — so this is the fantasy-relevant depth chart rather than the full roster.
export default function DepthChartTab({ engine, player }) {
  const groups = engine.depthChartFor(player)

  if (!groups) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-muted">
        No depth chart data for {player.team}.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{g.group}</p>
          <div className="flex flex-col gap-1">
            {g.players.map((p) => (
              <div
                key={p.name}
                className={
                  'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ' +
                  (p.isSelf ? 'border-teal-400/40 bg-teal-500/10' : 'border-slate-rule bg-slate-sunk/50')
                }
              >
                <span className="w-4 shrink-0 text-center text-[10px] text-ink-muted">{p.order || '–'}</span>
                <span className={'shrink-0 rounded px-1 text-[9px] font-bold ' + (POS_BADGE[p.pos] || 'bg-white/10 text-white/50')}>
                  {p.pos}
                </span>
                <span className={'min-w-0 flex-1 truncate ' + (p.isSelf ? 'font-semibold text-white' : 'text-white/80')}>
                  {p.name}
                </span>
                <span className="shrink-0 text-xs text-ink-muted">ADP {p.adp.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs leading-relaxed text-ink-muted">
        Only players inside the draftable pool appear here, so this is the fantasy-relevant depth chart rather than the full roster.
      </p>
    </div>
  )
}
