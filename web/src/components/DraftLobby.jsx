import DraftBoardGrid from './DraftBoardGrid.jsx'

/* The board, before anybody has picked on it.

   A draft position used to be a number in a dropdown, which is a strange way
   to choose a chair when the chairs are drawn on the screen right there. The
   board is the lobby now: every column is a seat, claiming one is a click on
   it, and the empty cells already show the overall pick numbers and the snake
   arrows — so "where do I sit" and "when do I pick" are the same picture
   rather than two facts a manager holds in their head.

   It is deliberately the *same* DraftBoardGrid the draft uses, in a claimable
   mode, rather than a mock-up of it. A second grid drawn only for the lobby
   would be a picture of the board that is wrong the first time the real one
   changes — the same argument that keeps the hero shot generated and the
   room's doors drawn rather than photographed.

   In a room the seats carry the managers who have taken them, and claiming
   one is Live.claimSeat(). Off-room the only owned seat is yours, and the
   rest fill with CPUs at kickoff. One screen, because a seat is a seat. */
export default function DraftLobby({ engine, league, mySlot, onClaimSeat, seats, roomActive, fill }) {
  return (
    <section className={'flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 ' + (fill ? 'min-h-0 flex-1' : '')}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold text-white">Your seat</h2>
          <p className="text-[11px] leading-snug text-white/45">
            {roomActive
              ? 'Claim a chair — everyone in the room sees the same board.'
              : 'Claim a chair. The rest are drafted by the computer.'}
          </p>
        </div>

        {/* No randomise button here on purpose. Configure Draft already has
            one beside its Draft position field, and both now write the same
            lifted state - so a second copy would be two controls doing one
            job, which is what the tray's maximise icon was. The board is the
            direct way to choose a seat; the field is the precise one. */}
      </div>

      {/* A real height rather than flex-1: this sits in a normal-flow page
          rather than the draft's fixed-height column, so the grid needs to be
          told how much room it has or it collapses to its own minimum. */}
      {/* `fill` is the full-bleed lobby, where the board should take the
          screen; the boxed height is for anywhere this sits in normal flow. */}
      <div className={fill ? 'flex min-h-0 flex-1' : 'flex h-[260px] lg:h-[320px]'}>
        <DraftBoardGrid
          league={league}
          picks={[]}
          mySlot={mySlot}
          onClock={null}
          /* Not engine.teamLabel(s): that answers "is this seat mine" by
             comparing against state.mySlot, which is only correct once
             startDraft() has actually committed it. Here mySlot is still a
             live, unstarted selection, so the "mine" branch below already
             handles that question from the real prop — this only ever
             needs to name a seat that *isn't* mine, which is what
             cpuName() does with no comparison to get stale. */
          teamLabelOf={(s) => engine.cpuName(s)}
          onClaimSeat={onClaimSeat}
          seats={seats}
        />
      </div>
    </section>
  )
}
