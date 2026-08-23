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
   rest fill with CPUs at kickoff. One screen, because a seat is a seat.

   Bare — no header, no border, no background — since its one real caller
   (DraftEntryScreen.jsx, confirmed the only import besides a comment
   reference in DraftSettingsModal.jsx) now owns "Claim your chair" and its
   description as part of the Cockpit's own 3-column shell. A second,
   smaller "Your seat" heading nested inside this one used to sit directly
   under that headline, saying roughly the same thing a second time. */
export default function DraftLobby({ engine, league, mySlot, onClaimSeat, seats, roomActive, fill }) {
  return (
    // fill still means "take the whole column" at lg. Below lg the entry
    // screen scrolls, and an unbounded board there is ~1200px of one
    // continuous grid wedged between the headline and the pick banner.
    // 420px is the height this component already uses when it isn't
    // filling, and DraftBoardGrid scrolls inside it either way.
    <div className={'flex flex-col ' + (fill ? 'h-[420px] lg:h-auto lg:min-h-0 lg:flex-1' : 'h-[420px]')}>
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
  )
}
