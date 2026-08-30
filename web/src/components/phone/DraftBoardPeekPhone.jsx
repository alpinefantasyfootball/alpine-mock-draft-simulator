import { POS_MATTE } from '../draftRoomPositions.js'
import DraftBoardGrid from '../DraftBoardGrid.jsx'

// The board behind the phone sheet. README section 2 draws this as a
// scroll-free repeat(4,1fr) grid — but that shape only exists in the
// prototype because the prototype never has to hold a real 24-team,
// 20-round board. DraftBoardGrid already renders the real thing at
// exactly this width (its own `cols`/`rowsTemplate` are the "mobile board
// pass's own pair," measured for a narrow phone column, not invented
// here), with real position rails, the real gold "your pick" ring, and
// the same FLIP transition into a drafted cell the desktop board gets.
// Reusing it — scrollable, not scroll-free — is the deliberate adaptation:
// a fixed-height no-scroll grid is a real correctness bug the moment a
// league runs more than a handful of rounds, where the prototype's mock
// data never had to.
//
// What IS new here is the strip above it: not DraftBoardGrid's own
// built-in "fill = position" colour legend (hidden via hideLegend), but
// the roster-need pills the README's seat strip actually specifies —
// `engine.filterCounts()` already computes exactly this for the Players
// tab's own filter chips (have/need/text, one call, never a second
// tally — see that function's own comment on why the decision lives
// engine-side).
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST']

export default function DraftBoardPeekPhone({ engine, league, picks, mySlot, onClock, onSelectPlayer, headerH, scrollToLiveSignal }) {
  const counts = engine.filterCounts()

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col" style={{ top: headerH }}>
      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-2.5 pb-2 pt-2.5 [scrollbar-width:none]">
        {POSITIONS.map((pos) => {
          const c = counts ? counts[pos] : null
          return (
            <span
              key={pos}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-rule bg-slate-panel px-[9px] py-[5px]"
            >
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: POS_MATTE[pos] }} aria-hidden="true" />
              <span className="font-body text-[11px] font-semibold text-ink-soft">
                {pos === 'DST' ? 'DEF' : pos} {c ? c.text : '—'}
              </span>
            </span>
          )
        })}
      </div>

      <div className="min-h-0 flex-1">
        <DraftBoardGrid
          league={league}
          picks={picks}
          mySlot={mySlot}
          onClock={onClock}
          teamLabelOf={(slot) => engine.teamLabel(slot)}
          shortNameOf={engine.shortName}
          onSelectPlayer={onSelectPlayer}
          hideLegend
          scrollToLiveSignal={scrollToLiveSignal}
        />
      </div>
    </div>
  )
}
