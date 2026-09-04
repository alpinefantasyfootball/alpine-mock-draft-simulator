import { SignInButton, SignUpButton, SignedOut } from '@clerk/clerk-react'
import AppShell from './shell/AppShell.jsx'
import RoomsGridAlive from './RoomsGridAlive.jsx'
import { useAccountUiReady } from '../hooks/useAccountUiReady.js'

/* #/rooms — design_handoff_v3_alive screens 2bg/2bu (mobile) and 3bg/3bu
   (desktop).

   The rooms were a section on the homepage and a dropdown in the header.
   This makes them a destination, which is what the handoff's nav is built
   around, and it is why the old header's season-grouped dropdown retires
   with it: a menu listing the same rooms one click before the page that
   lists them is a second copy of this screen.

   The grid is RoomsGridAlive, shared with the homepage's own THE ROOMS
   section. What is left here is the screen around it.

   ---- The two heroes are not one hero at two sizes ----

   2bg puts the door and "The Rooms" on one line at 30px with the shark
   speaking underneath. 3bg gives it a two-line 64px H1 with its own
   sub-copy and moves the shark alongside, and the two say different
   things: the phone's bubble carries both facts at once ("Draft Room is
   open. The rest unlock...") because it is the only line on the screen,
   while the desktop splits them — the sub-copy states what is open and the
   bubble sells the preview. Both strings are the handoff's own.

   That is two strings and one hidden span, which is copy rather than
   logic. What would be the "written down twice" failure is two components. */

function UnlockBar() {
  const ready = useAccountUiReady()

  const signup = (
    <button
      type="button"
      className="whitespace-nowrap rounded-full px-5 py-3 text-[14px] font-bold text-surface-page transition-transform duration-150 hover:scale-[1.02]"
      style={{ background: 'linear-gradient(100deg,#44D4E2,#82A1F6)' }}
    >
      Sign up &amp; connect
    </button>
  )
  const login = (
    <button
      type="button"
      className="whitespace-nowrap rounded-full border border-flow-pillEdge px-5 py-3 text-[14px] font-semibold text-voidInk-primary transition-colors duration-150 hover:border-white/30"
    >
      Log in
    </button>
  )

  const bar = (
    <div className="mt-3.5 flex flex-col gap-3.5 rounded-2xl border border-line-hairline bg-[#151920] p-[18px] sm:flex-row sm:items-center sm:gap-4 sm:px-[22px]">
      <span className="text-[26px]" role="img" aria-label="Locked">🔒</span>
      <span className="flex-1">
        <span className="block text-[16px] font-semibold text-white">
          Unlock every room with your league
        </span>
        <span className="mt-1 block text-[12px] text-ink-muted">Sleeper · ESPN · Yahoo · CBS</span>
      </span>
      <span className="flex gap-2">
        {ready ? (
          <>
            <SignUpButton mode="modal">{signup}</SignUpButton>
            <SignInButton mode="modal">{login}</SignInButton>
          </>
        ) : (
          <>
            {signup}
            {login}
          </>
        )}
      </span>
    </div>
  )

  /* Guest only, and the handoff is explicit about it: 2bg and 3bg draw this
     bar and neither 2bu nor 3bu does. Somebody with a league connected has
     nothing left to unlock, so the bar would be an ask with no answer —
     the same rule the homepage's account card and "no account needed"
     line already follow. */
  if (!ready) return bar
  return <SignedOut>{bar}</SignedOut>
}

export default function RoomsLobby() {
  return (
    <AppShell active="rooms">
      <div className="mx-auto max-w-[1280px] px-5 pt-[22px] sm:px-10 sm:pt-10">
        <div className="mb-3.5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            <div className="flex items-center gap-3 sm:block">
              <span className="text-[26px] sm:text-[34px]" aria-hidden="true">🚪</span>
              <h1 className="m-0 font-display text-[30px] font-extrabold uppercase italic leading-[0.9] text-white sm:mt-1.5 sm:text-[64px]">
                The<span className="sm:hidden"> Rooms</span>
                <span className="hidden sm:block text-mint">Rooms</span>
              </h1>
            </div>
            <p className="mt-3 hidden text-[16px] text-voidInk-body sm:block">
              Draft Room is open to everyone. The rest unlock when you connect a league.
            </p>
          </div>

          {/* The shark says what the screen is for. A speech bubble rather
              than a paragraph because the alternative — a line of grey body
              copy under the H1 — is the thing every marketing page does and
              the thing a reader skips. */}
          <div className="flex items-end gap-2.5 sm:shrink-0 sm:items-center sm:gap-3.5">
            <img
              src="/juke-shark-mark.svg"
              alt=""
              className="h-14 w-14 shrink-0 object-contain sm:h-[72px] sm:w-[72px]"
            />
            <p className="m-0 flex-1 rounded-[14px_14px_14px_4px] border border-flow-pillEdge bg-flow-pill px-3.5 py-[11px] text-[14px] leading-[1.45] text-voidInk-primary sm:max-w-[520px] sm:rounded-[16px_16px_16px_4px] sm:px-[18px] sm:py-3.5 sm:text-[15px]">
              <span className="sm:hidden">
                Draft Room is open. The rest unlock when you connect a league — peek inside any of
                them.
              </span>
              <span className="hidden sm:inline">
                Peek inside any locked room — you will see a sample week so you know what you are
                getting.
              </span>
            </p>
          </div>
        </div>

        <RoomsGridAlive columns="lobby" />
        <UnlockBar />
      </div>
    </AppShell>
  )
}
