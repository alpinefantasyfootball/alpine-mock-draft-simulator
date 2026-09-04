import AppShell from './shell/AppShell.jsx'
import RoomsGridAlive from './RoomsGridAlive.jsx'

/* #/rooms -- design_handoff_v3_alive screens 2bg/2bu (mobile) and
   3bg/3bu (desktop).

   The rooms were a section on the homepage and a dropdown in the header.
   This makes them a destination, which is what the handoff's nav is built
   around, and it is why RoomsNavMenu's season-grouped dropdown retires
   with the old header: a menu listing the same six rooms one click before
   the page that lists them is a second copy of this screen.

   The grid itself is RoomsGridAlive, shared with the homepage's own THE
   ROOMS section -- see that file. What is left here is the screen: its
   title, and the one line that says why five of the six are locked. */

export default function RoomsLobby() {
  return (
    <AppShell active="rooms">
      <div className="mx-auto max-w-[1280px] px-5 pt-[22px] sm:px-10 sm:pt-10">
        <div className="mb-3.5 flex items-center gap-3">
          <span className="text-[26px] sm:text-[30px]" aria-hidden="true">🚪</span>
          <h1 className="m-0 font-display text-[30px] font-extrabold uppercase italic text-white sm:text-[44px]">
            The Rooms
          </h1>
        </div>

        {/* The shark says what the screen is for. It is a speech bubble
            rather than a paragraph because the alternative — a line of grey
            body copy under the H1 — is the thing every marketing page does
            and the thing a reader skips. */}
        <div className="mb-4 flex items-end gap-2.5 sm:mb-6 sm:max-w-[640px]">
          <img src="/juke-shark-mark.svg" alt="" className="h-14 w-14 shrink-0 object-contain" />
          <p className="m-0 flex-1 rounded-[14px_14px_14px_4px] border border-flow-pillEdge bg-flow-pill px-3.5 py-[11px] text-[14px] leading-[1.45] text-voidInk-primary">
            Draft Room is open. The rest unlock when you connect a league — peek inside any of them.
          </p>
        </div>

        <RoomsGridAlive />
      </div>
    </AppShell>
  )
}
