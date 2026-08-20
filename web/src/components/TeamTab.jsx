import { POS_BADGE } from './draftRoomPositions.js'

function SlotRow({ label, player }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <span className={'w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ' + (player ? POS_BADGE[player.pos] || 'bg-white/10 text-white/50' : 'bg-white/5 text-white/25')}>
        {label}
      </span>
      {player ? (
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">{player.name}</span>
      ) : (
        <span className="min-w-0 flex-1 text-sm text-white/25">Empty</span>
      )}
    </div>
  )
}

// engine.seatedLineup(slot) — the same starter-fill logic the grade and the
// legacy My Team view depend on being correct (see CLAUDE.md's note on
// posRank vs. aboveReplacement in bestLineup()), now taking any seat rather
// than always yours. Built for the mobile tray's Team tab, which is the one
// new capability here: checking a rival's roster, not just your own.
export default function TeamTab({ engine, league, mySlot, viewSlot, onViewSlot, teamLabelOf, compact }) {
  const lineup = engine.seatedLineup(viewSlot)
  const seats = lineup?.seats || []
  const bench = lineup?.bench || []
  const benchBoxes = Array.from({ length: league.bench }, (_, i) => bench[i] || null)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* A row of chips where there is width for one, a select where there
          is not. The desktop Roster panel is about 320px and team names
          here are real ("Bone-Thugs-N-Montgomery"), so chips there meant a
          horizontal scroller inside a column that already scrolls
          vertically — two axes to find one team. The mobile sheet is full
          width and keeps the chips, which are a faster tap target. */}
      {compact ? (
        <div className="shrink-0 p-2 pb-1.5">
          <select
            value={viewSlot}
            onChange={(e) => onViewSlot(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs font-semibold text-white outline-none focus:border-teal-400/60"
          >
            {Array.from({ length: league.teams }, (_, slot) => (
              <option key={slot} value={slot} className="bg-charcoal">
                {teamLabelOf(slot)}
                {slot === mySlot ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto p-3 pb-2">
          {Array.from({ length: league.teams }, (_, slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => onViewSlot(slot)}
              className={
                'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ' +
                (viewSlot === slot
                  ? 'bg-white text-obsidian'
                  : slot === mySlot
                    ? 'bg-teal-500/20 text-teal-300'
                    : 'bg-white/5 text-white/50')
              }
            >
              {teamLabelOf(slot)}
            </button>
          ))}
        </div>
      )}

      <div className={'flex-1 space-y-1.5 overflow-y-auto ' + (compact ? 'p-2 pt-1' : 'p-3 pt-1')}>
        {seats.map((s, i) => (
          <SlotRow key={'seat-' + i} label={s.slot} player={s.player} />
        ))}
        {benchBoxes.map((player, i) => (
          <SlotRow key={'bn-' + i} label="BN" player={player} />
        ))}
      </div>
    </div>
  )
}
