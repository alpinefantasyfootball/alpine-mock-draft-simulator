import { Sparkles } from 'lucide-react'
import DraftLobby from './DraftLobby.jsx'
import { POS_BADGE } from './draftRoomPositions.js'

// The Cockpit's landing screen from the lobby — three columns, 300px |
// 1fr | 330px. Centre is the existing DraftLobby (the seat-claiming
// board, now bare — see its own comment) with this screen's headline and
// start banner wrapped around it; left and right are genuinely new,
// there was nowhere to see league shape or a scored preview before the
// first pick landed.
export default function DraftEntryScreen({
  engine,
  league,
  mySlot,
  roomActive,
  seats,
  onClaimSeat,
  soloAutopick,
  onOpenSettings,
}) {
  const scoringNames = engine.scoringNames()
  const lineup = engine.seatedLineup(mySlot)
  const clock = engine.clockLength()

  const rows = [
    { label: 'Teams', value: league.teams },
    { label: 'Scoring', value: scoringNames[league.scoring] || league.scoring },
    { label: 'Order', value: 'Snake' },
    { label: 'Rounds', value: league.rounds },
    { label: 'Per pick', value: clock ? `${clock}s` : 'No clock' },
    { label: 'Autopick', value: soloAutopick ? 'On' : 'Off' },
  ]

  const board = engine.board()
  const opening = board.slice(0, 8).map((p) => ({
    ...p,
    juke: engine.overallScore(p),
  }))

  const DE = window.DraftEngine
  // Round 1 is always left-to-right, so this seat's own first overall
  // pick is just its 1-indexed position — no snake mirror to ask for yet,
  // there's nothing on the board to mirror against.
  const firstOverall = mySlot + 1
  const firstPick = DE ? DE.pickCode(firstOverall, league.teams) : null
  // The first four picks this seat holds — first is shown on its own
  // above, so the strip below wants the four *after* it.
  const nextPicks = engine.nextPicksFor(mySlot, 5).slice(1)
  // The gap sentence used to hardcode "five picks between each turn after
  // round one" — the handoff's own example copy, and wrong for a snake
  // draft in general: the gap alternates rather than staying constant,
  // and a design review caught it printing "16, 33, 40, 57" — gaps of 17
  // and 7, never 5 — right next to that claim. Computed from the same
  // numbers the sentence is describing rather than asserted, and it says
  // only what those numbers actually show: one gap if they're all equal
  // (true for some seats), two alternating gaps if not, and nothing more
  // specific than the raw list if the pattern doesn't reduce that cleanly
  // — an edge seat's turns bunch up near a round boundary rather than
  // spacing evenly, and no short sentence describes that honestly.
  const gapSeq = [firstOverall, ...nextPicks]
  const gaps = gapSeq.slice(1).map((n, i) => n - gapSeq[i])
  const distinctGaps = [...new Set(gaps)]
  const gapClause =
    distinctGaps.length === 1
      ? `${distinctGaps[0]} picks between each turn after round one`
      : distinctGaps.length === 2
        ? `${Math.min(...distinctGaps)} or ${Math.max(...distinctGaps)} picks between each turn, depending which side of the turn you're on`
        : null

  return (
    // min-h-0 is gated behind lg: deliberately. At lg these three children
    // are *columns* sharing one viewport-height row, and min-h-0 is what
    // lets each shrink so the board inside can scroll. Below lg they
    // collapse to grid-cols-1 and become three *rows* dividing one flex-1
    // height — and there min-h-0 strips the centre row's min-content floor,
    // so the grid crushed it to 40px and 334px of headline, board and pick
    // banner painted straight over the row beneath it. Same utility,
    // opposite effect, because the axis it frees flips at the breakpoint.
    <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[300px_minmax(0,1fr)_330px]">
      <div className="border-white/[0.06] px-[18px] py-5 lg:border-r">
        <div className="mb-3.5 flex items-baseline justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">This draft</span>
          <button type="button" onClick={onOpenSettings} className="text-xs font-semibold text-teal-300 hover:text-teal-200">
            Edit
          </button>
        </div>
        <div className="flex flex-col gap-[3px]">
          {rows.map((r) => (
            <div key={r.label} className="flex h-9 items-center justify-between gap-3.5 rounded-[7px] bg-white/[0.03] px-3">
              <span className="text-xs text-white/60">{r.label}</span>
              <span className="font-body text-sm font-semibold tabular-nums text-white">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Desktop only. Nine rows reading "Empty" is roughly 300px of a
            390px phone spent saying nothing has happened yet — which the
            heading three lines above ("Nobody has picked yet") already
            says in five words. The roster earns its space from the Roster
            tab once it has contents in it. On desktop it costs a rail
            nothing else wants, so it stays. */}
        <div className="mt-5 hidden border-t border-white/[0.07] pt-[18px] lg:block">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Your roster, empty</div>
          <div className="flex flex-col gap-[3px]">
            {lineup.seats.map((s, i) => (
              <div key={i} className="grid h-[30px] grid-cols-[38px_minmax(0,1fr)] items-center gap-2.5 rounded-md border border-dashed border-white/[0.09] px-2.5">
                <span className="rounded bg-white/5 py-0.5 text-center text-[10px] font-bold text-white/50">{s.slot}</span>
                <span className="text-xs text-white/50">Empty</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* lg:min-h-0 — see the grid comment above. Below lg this is the row
          that gets crushed, so it has to keep its min-content floor. */}
      <div className="flex flex-col px-[22px] py-5 lg:min-h-0">
        {/* "Claim your chair" only describes a room, where a seat is
            genuinely still up for grabs — a design review caught this
            headline showing up over a board that already had a seat
            (yours) labelled and outlined, because a solo seat was decided
            back on the settings screen and there is nobody else who could
            take a different one. Room and solo ask two different
            questions here, so they get two different headlines. */}
        <h1 className="mb-1 font-display text-[32px] font-bold leading-none text-white">
          {roomActive ? 'Claim your chair' : `Seat ${mySlot + 1} is yours`}
        </h1>
        <p className="mb-[18px] text-sm text-white/60">
          {roomActive ? (
            <>Every column is a seat, and the empty cells already show which overall picks come with it. Everyone in the room sees the same board.</>
          ) : (
            <>The other {Math.max(0, league.teams - 1)} {league.teams - 1 === 1 ? 'team is' : 'teams are'} drafted by Juke. Change your seat from Edit setup if you'd rather draft from a different spot.</>
          )}
        </p>

        <DraftLobby engine={engine} league={league} mySlot={mySlot} onClaimSeat={onClaimSeat} seats={seats} roomActive={roomActive} fill />

        <div
          className="mt-4 flex items-center gap-4 rounded-xl border border-teal-400/30 p-4"
          style={{ background: 'linear-gradient(120deg, rgba(0,229,255,0.09), rgba(123,31,162,0.08) 70%, #12171f)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-display text-[23px] font-bold leading-tight text-white">
              Seat {mySlot + 1} · your first pick is {firstPick || '—'}
            </div>
            <div className="text-xs text-white/60">
              {nextPicks.length > 0
                ? `Then ${nextPicks.join(', ')}${gapClause ? ` — ${gapClause}.` : '.'}`
                : 'Pick order is set once every seat is filled.'}
            </div>
          </div>
        </div>
      </div>

      <div className="border-white/[0.06] px-[18px] py-5 lg:border-l">
        <div className="mb-1 flex items-center gap-2 text-teal-300">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em]">The board at {firstPick || '—'}</span>
        </div>
        <p className="mb-3.5 text-xs leading-relaxed text-white/60">
          Scored against your rules before a single pick is made. This is what you'd be choosing from.
        </p>
        <div className="flex flex-col gap-[3px]">
          {opening.map((p, i) => (
            <div key={p.name} className="grid h-9 grid-cols-[20px_34px_minmax(0,1fr)_40px] items-center gap-2.5 rounded-[7px] px-2.5">
              <span className="font-plex text-[10px] text-white/50">{i + 1}</span>
              <span className={'rounded py-0.5 text-center text-[10px] font-bold ' + (POS_BADGE[p.pos] || 'bg-white/10 text-white/60')}>
                {p.pos}
              </span>
              <span className="truncate text-xs font-medium text-white">{p.name}</span>
              <span className="text-right font-plex text-xs font-semibold text-teal-300">{p.juke != null ? Math.round(p.juke) : '—'}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/60">
          Change a scoring rule and every one of these moves. The Edit link on the left reruns the whole board.
        </p>
      </div>
    </div>
  )
}
