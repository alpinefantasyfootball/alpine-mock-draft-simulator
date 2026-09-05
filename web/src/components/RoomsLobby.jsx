import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/clerk-react'
import AppShell from './shell/AppShell.jsx'
import RoomsGridAlive from './RoomsGridAlive.jsx'
import ConnectLeagueCta from './shell/ConnectLeagueCta.jsx'
import { LINE as PLATFORM_LINE } from './shell/leaguePlatforms.js'
import { LIVE_WHEN_CONNECTED } from './RoomPage.jsx'
import { useRooms } from '../hooks/useRooms.js'
import { useLeague } from '../hooks/useLeague.js'
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

   Connected only, and that is this file's own argument followed one step
   further than it was. It already said a row of locked labels above the
   same locked cards is "the same fact twice", and used that to keep the
   strip off the signed-out screen -- then drew it for a signed-in reader,
   who has no league either and therefore sees exactly the same
   duplication. The handoff's split is signed-out against signed-in
   because in the handoff being signed in MEANS having a league; here the
   two came apart, and the half that matters is the league.

   So the condition is the one that decides whether there is anything to
   say: a connected league, which is what turns `WAIVER` into
   `WAIVER · 14H`. It draws itself the day one is connected rather than
   waiting for somebody to remember it. */
function PhaseStrip() {
  const rooms = useRooms()
  const { status } = useLeague()
  // "loading" is not "none" -- see useLeague. Drawing on anything but a
  // settled `connected` would flash the strip on every load for a reader
  // whose league has not been read back yet.
  if (status !== 'connected' || !rooms.length) return null

  return (
    <div className="mb-4 hidden gap-2 sm:flex">
      {rooms.map((r) => {
        const label = r.name.replace(/^The /, '').replace(/ Room$/, '').toUpperCase()
        /* `live` is "built for everybody"; open is "you can walk in". They
           were the same question until a league could be connected, and a
           padlock on a room RoomPage will render live is the connection
           failing to show — the same complaint this whole change is about,
           in an emoji. LIVE_WHEN_CONNECTED is RoomPage's own list; the one
           thing this must not do is keep a second copy of it. */
        const open = r.live || (status === 'connected' && LIVE_WHEN_CONNECTED.includes(r.slug))
        return (
          <a
            key={r.name}
            href={r.href || `#/rooms/${r.slug}`}
            className="flex-1 rounded-lg py-[9px] text-center font-mono text-[10px] tracking-[0.08em] transition-opacity duration-150 hover:opacity-90"
            style={
              open
                ? { background: '#12302e', color: '#74E5CE' }
                : { background: '#1A1F27', color: '#8A9BAA' }
            }
          >
            {label} {open ? '✓' : '🔒'}
          </a>
        )
      })}
    </div>
  )
}

/* The two lines that promise what connecting buys, and what they say once
   it has been bought.

   Both read "the rest unlock when you connect a league", which is a
   promise to a guest and a falsehood to somebody holding one — connecting
   opens the League Room and leaves Waiver, Trade and Strategy exactly as
   they were, because those three need Juke to have an opinion that has not
   been built yet. Saying so is the honest version and it is also the more
   useful one: it names where to go next.

   `status` rather than `league`, and "loading" keeps the guest line, for
   useLeague's own reason — the wrong line once beats the wrong line
   followed by the right one. */
function SubCopy() {
  const { status } = useLeague()
  return (
    <p className="mt-3 hidden text-[16px] text-voidInk-body sm:block">
      {status === 'connected'
        ? 'Draft Room and League Room are open. Waiver, Trade and Strategy open as they are built.'
        : 'Draft Room is open to everyone. The rest unlock when you connect a league.'}
    </p>
  )
}

function Blurb() {
  const { status } = useLeague()
  const connected = status === 'connected'
  return (
    <p className="m-0 flex-1 rounded-[14px_14px_14px_4px] border border-flow-pillEdge bg-flow-pill px-3.5 py-[11px] text-[14px] leading-[1.45] text-voidInk-primary sm:max-w-[520px] sm:rounded-[16px_16px_16px_4px] sm:px-[18px] sm:py-3.5 sm:text-[15px]">
      {connected ? (
        'Your league is in. League Room reads it now — the other three still show a sample week until they are built.'
      ) : (
        <>
          <span className="sm:hidden">
            Draft Room is open. The rest unlock when you connect a league — peek inside any of
            them.
          </span>
          <span className="hidden sm:inline">
            Peek inside any locked room — you will see a sample week so you know what you are
            getting.
          </span>
        </>
      )}
    </p>
  )
}

function UnlockBar() {
  const ready = useAccountUiReady()
  /* Whether there is anything left to unlock. See the note above the
     return for why this arrived late and what it corrects. */
  const { status: leagueStatus } = useLeague()

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
        <span className="mt-1 block text-[12px] text-ink-muted">{PLATFORM_LINE}</span>
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
        <span className="mt-1 block text-[12px] text-ink-muted">{PLATFORM_LINE}</span>
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

  /* The handoff draws this bar on 2bg/3bg and on neither CONNECTED screen,
     because somebody with a league has nothing left to unlock — and that
     state is reachable now rather than hypothetical, so it is drawn.

     This comment used to end "it disappears on its own the day a league
     can be connected". That day arrived and it did not disappear: nothing
     in this file read the league, so a manager who had just connected one
     was still being told to unlock every room with it. Corrected in place
     rather than left standing, which is the rule this project keeps for a
     note whose premise has moved.

     `status` rather than `league`, for useLeague's own reason: hiding the
     bar for a tick and then showing it is worse than showing it once, so
     "loading" keeps the ask.

     Signed out the ask is an account and then a connect; signed in the
     account is done and only the connect is left, so the two buttons
     collapse to one. */
  if (leagueStatus === 'connected') return null
  if (!ready) return bar
  return (
    <>
      <SignedOut>{bar}</SignedOut>
      <SignedIn>{signedInBar}</SignedIn>
    </>
  )
}

export default function RoomsLobby() {
  const rooms = useRooms()
  /* "1 OPEN" counts what this reader can walk into, not what is built —
     the same distinction the grid and the phase strip now make, and the
     eyebrow was the third place saying the old answer. */
  const { status } = useLeague()
  const open = rooms.filter(
    (r) => r.live || (status === 'connected' && LIVE_WHEN_CONNECTED.includes(r.slug)),
  ).length

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
            <SubCopy />
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
            <Blurb />
          </div>
        </div>

        <PhaseStrip />

        <RoomsGridAlive columns="lobby" />
        <UnlockBar />
      </div>
    </AppShell>
  )
}
