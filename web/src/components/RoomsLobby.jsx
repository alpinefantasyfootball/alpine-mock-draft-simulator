import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/clerk-react'
import AppShell from './shell/AppShell.jsx'
import RoomsGridAlive from './RoomsGridAlive.jsx'
import ConnectLeagueCta from './shell/ConnectLeagueCta.jsx'
import { useRooms } from '../hooks/useRooms.js'
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

/* 3bu's phase strip: one cell per room across the top of the grid, the
   room you are in now lit.

   The handoff fills it with league timings — `WAIVER · 14H`, `TRADE · 2D`,
   `LINEUP · SUN` — and every one of those is a deadline read off a
   connected league. What survives without one is the part that is a fact
   about the product rather than about your week: which room is open. That
   is `live` on ROOMS, so the strip is real, and the timings arrive with
   the league rather than being guessed.

   Signed in only, which is the handoff's own split: 3bu draws this and
   3bg does not. Signed out the page is already making a bigger ask (make
   an account) and a row of locked labels above the same locked cards is
   the same fact twice. */
function PhaseStrip() {
  const rooms = useRooms()
  if (!rooms.length) return null

  return (
    <div className="mb-4 hidden gap-2 sm:flex">
      {rooms.map((r) => {
        const label = r.name.replace(/^The /, '').replace(/ Room$/, '').toUpperCase()
        return (
          <a
            key={r.name}
            href={r.href || `#/rooms/${r.slug}`}
            className="flex-1 rounded-lg py-[9px] text-center font-mono text-[10px] tracking-[0.08em] transition-opacity duration-150 hover:opacity-90"
            style={
              r.live
                ? { background: '#12302e', color: '#74E5CE' }
                : { background: '#1A1F27', color: '#8A9BAA' }
            }
          >
            {label} {r.live ? '✓' : '🔒'}
          </a>
        )
      })}
    </div>
  )
}

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

  const shell = (children) => (
    <div className="mt-3.5 flex flex-col gap-3.5 rounded-2xl border border-line-hairline bg-[#151920] p-[18px] sm:flex-row sm:items-center sm:gap-4 sm:px-[22px]">
      {children}
    </div>
  )

  const signedInBar = shell(
    <>
      <span className="text-[26px]" role="img" aria-label="Locked">🔒</span>
      <span className="flex-1">
        <span className="block text-[16px] font-semibold text-white">
          Unlock every room with your league
        </span>
        <span className="mt-1 block text-[12px] text-ink-muted">Sleeper · ESPN · Yahoo · CBS</span>
      </span>
      <ConnectLeagueCta variant="gradient" />
    </>,
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

  /* The handoff draws this bar on 2bg/3bg and on neither connected screen,
     because somebody with a league has nothing left to unlock. Nobody has
     a league here yet, so the ask is still live for a signed-in reader —
     what changes is what it asks for. Signed out that is an account and
     then a connect; signed in the account is done and only the connect is
     left, so the two buttons collapse to one.

     It disappears on its own the day a league can be connected, which is
     the same condition the handoff was drawing. */
  if (!ready) return bar
  return (
    <>
      <SignedOut>{bar}</SignedOut>
      <SignedIn>{signedInBar}</SignedIn>
    </>
  )
}

/* <SignedIn> throws without a ClerkProvider ancestor and main.jsx renders
   none in a keyless build, so this answers "nothing" there rather than
   taking the page down — the same guard every other account surface here
   makes, wrapped once because two things on this screen need it. */
function SignedInOnly({ children }) {
  const ready = useAccountUiReady()
  if (!ready) return null
  return <SignedIn>{children}</SignedIn>
}

export default function RoomsLobby() {
  const rooms = useRooms()
  const open = rooms.filter((r) => r.live).length

  return (
    <AppShell active="rooms">
      <div className="mx-auto max-w-[1280px] px-5 pt-[22px] sm:px-10 sm:pt-10">
        <div className="mb-3.5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div>
            {/* The glyph rides in a mono eyebrow, which is the shape
                RoomHero gives all five room pages -- `{glyph} {EYEBROW}`
                above the H1. This screen used to be the only one whose
                glyph MOVED between breakpoints: inline beside the title
                below `sm`, stranded on its own line above a 64px two-line
                H1 above it. Three placements across five screens, and this
                was the odd one.

                It also puts the H1 back on the page's own left margin.
                Inline, the title started 42-53px inside it (measured 3 Sep
                2026 at 1440 on #/drafts and #/you), so the heading did not
                line up with the header, the sub-copy or the grid.

                Counts rather than a fixed string, because a hardcoded
                "SIX ROOMS" is wrong the morning a room ships and nothing
                fails when it is. useRooms() fills on mount, so the numbers
                arrive a tick after the glyph -- the row keeps its height
                throughout, so nothing moves. */}
            <div className="mb-1.5 font-mono text-[11px] tracking-[0.1em] text-teal">
              <span className="mr-1.5" aria-hidden="true">🚪</span>
              {rooms.length ? `${rooms.length} ROOMS · ${open} OPEN` : ''}
            </div>
            <h1 className="m-0 font-display text-[30px] font-extrabold uppercase italic leading-[0.9] text-white sm:text-[64px]">
              The<span className="sm:hidden"> Rooms</span>
              <span className="hidden sm:block text-mint">Rooms</span>
            </h1>
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

        <SignedInOnly>
          <PhaseStrip />
        </SignedInOnly>

        <RoomsGridAlive columns="lobby" />
        <UnlockBar />
      </div>
    </AppShell>
  )
}
