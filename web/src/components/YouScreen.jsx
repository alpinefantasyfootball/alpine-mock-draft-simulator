import { SignInButton, SignUpButton, SignedIn, SignedOut, useClerk, useUser } from '@clerk/clerk-react'
import AppShell from './shell/AppShell.jsx'
import ConnectLeagueCta from './shell/ConnectLeagueCta.jsx'
import { useAccountUiReady } from '../hooks/useAccountUiReady.js'
import { useEngine, useJukeTick } from '../hooks/useJukeEngine.js'

/* #/you — design_handoff_v3_alive 2gg/2gu (mobile) and 3gg/3gu (desktop).

   The tab existed and the screen did not: FloatingNavPill's "You" opened an
   action sheet, which was the only surface on a phone that could reach
   sign-out at all. That sheet stays for now — this is where it was always
   going, and the two can converge once every route is on the new shell.

   ---- What is real and what is not ----

   Everything on the signed-in half comes from somewhere real. The name and
   "member since" are Clerk's own `user`, and the mock count is
   `historyList()` through the bridge — the same list the Locker draws. None
   of it is sample content, which is why this screen is buildable today
   while the connected rooms are not.

   CONNECTED LEAGUES is the exception and it draws the honest version: there
   is no league connect yet, so there is nothing to list and the section is
   its own empty state — the dashed "Add a league" row, and no card above
   it. A list with a fabricated "Dynasty Degens · synced 6 min ago" in it
   would be the one thing on this screen a reader would act on.

   ---- Appearance is not here, and that is deliberate ----

   The handoff draws an `Appearance ... Dark` row. The React app is
   dark-only — every surface in web/src is a fixed Tailwind hex, and the
   legacy `data-theme="light"` block only reaches style.css's own pages —
   so a control there would either do nothing or break every screen it
   claims to restyle. A row that cannot act is the dead-control failure
   this project has shipped more than once; it comes back with a light
   theme, not before it. */

const ROW =
  'flex items-center gap-3 border-b border-line-hairline py-3.5 text-[15px] text-voidInk-primary transition-colors duration-150'

function Row({ glyph, label, value, href, onClick }) {
  const body = (
    <>
      <span className="w-8 text-center" aria-hidden="true">{glyph}</span>
      <span className="flex-1 text-left">{label}</span>
      <span className="text-[13px] text-ink-muted" aria-hidden={!value}>
        {value || '›'}
      </span>
    </>
  )
  if (href) {
    return (
      <a href={href} className={ROW + ' hover:text-white'}>
        {body}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={ROW + ' w-full hover:text-white'}>
      {body}
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="mt-[18px] sm:mt-7">
      <div className="mb-3 font-mono text-[11px] tracking-[0.14em] text-voidInk-primary">
        {title}
      </div>
      {children}
    </div>
  )
}

function GuestCard() {
  const ready = useAccountUiReady()

  const signup = (
    <button
      type="button"
      className="flex-1 whitespace-nowrap rounded-full px-3 py-3 text-[14px] font-bold text-surface-page transition-transform duration-150 hover:scale-[1.02]"
      style={{ background: 'linear-gradient(100deg,#44D4E2,#82A1F6)' }}
    >
      Sign up
    </button>
  )
  const login = (
    <button
      type="button"
      className="flex-1 whitespace-nowrap rounded-full border border-flow-pillEdge px-3 py-3 text-[14px] font-semibold text-voidInk-primary transition-colors duration-150 hover:border-white/30"
    >
      Log in
    </button>
  )

  return (
    <div className="rounded-[18px] border border-line-hairline bg-[#151920] p-[18px] text-center sm:max-w-[520px]">
      <img src="/juke-shark-mark.svg" alt="" className="mx-auto h-[72px] w-[72px] object-contain" />
      <div className="mt-1.5 font-display text-[22px] font-bold text-white">
        You&apos;re drafting as a guest
      </div>
      <p className="mb-3.5 mt-1.5 text-[14px] leading-[1.5] text-voidInk-body">
        An account keeps your mocks and lets you connect a league from Sleeper, ESPN, Yahoo or CBS.
      </p>
      <div className="flex gap-2">
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
      </div>
    </div>
  )
}

function Identity() {
  const { user } = useUser()
  const engine = useEngine()
  useJukeTick(engine)

  /* The mock count reads the tick because `historyList()` goes through the
     bridge and the deferred data lands after mount — the same reason
     MockDraftsPhone's own rows do. Read once, this shows 0 on a cold load
     and never corrects itself. */
  const mocks = engine && engine.historyList ? engine.historyList().length : 0

  const name = (user && (user.firstName || user.username)) || 'You'
  const initial = name.slice(0, 1).toUpperCase()
  const since =
    user && user.createdAt
      ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : null

  return (
    <div className="flex items-center gap-3.5">
      <span
        className="grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-[22px] font-extrabold text-surface-page"
        style={{ background: 'linear-gradient(135deg,#44D4E2,#82A1F6)' }}
        aria-hidden="true"
      >
        {initial}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[24px] font-bold leading-none text-white">
          {name}
        </span>
        <span className="mt-[3px] block text-[13px] text-ink-muted">
          {since ? `Member since ${since} · ` : ''}
          {mocks} {mocks === 1 ? 'mock' : 'mocks'}
        </span>
      </span>
    </div>
  )
}

function SignOutRow() {
  const clerk = useClerk()
  return <Row glyph="↩" label="Log out" value=" " onClick={() => clerk.signOut()} />
}

export default function YouScreen() {
  const ready = useAccountUiReady()

  const settings = (
    <Section title="SETTINGS">
      <Row glyph="⚙" label="Default draft settings" href="#/rooms/draft" />
      <Row glyph="❔" label="How it works" href="/docs/draft-room-how-it-works.html" />
      <Row glyph="📄" label="Privacy" href="/docs/privacy.html" />
      <Row glyph="📄" label="Terms" href="/docs/terms.html" />
    </Section>
  )

  return (
    <AppShell active="you">
      <div className="mx-auto max-w-[1280px] px-5 pt-[22px] sm:px-10 sm:pt-10">
        {/* Glyph in a mono eyebrow rather than inline beside the title
            -- see RoomsLobby.jsx. A fixed string here because this screen
            has no count worth deriving; the room pages' eyebrows are
            context, and "ACCOUNT" is this screen's. */}
        <div className="mb-3.5">
          <div className="mb-1.5 font-mono text-[11px] tracking-[0.1em] text-teal">
            <span className="mr-1.5" aria-hidden="true">👤</span>
            ACCOUNT
          </div>
          <h1 className="m-0 font-display text-[30px] font-extrabold uppercase italic text-white sm:text-[44px]">
            You
          </h1>
        </div>

        <div className="sm:max-w-[520px]">
          {!ready ? (
            <>
              <GuestCard />
              {settings}
            </>
          ) : (
            <>
              <SignedOut>
                <GuestCard />
                {settings}
              </SignedOut>
              <SignedIn>
                <Identity />

                <Section title="CONNECTED LEAGUES">
                  {/* No card above this row, because there is nothing
                      connected. The handoff draws a "Dynasty Degens ·
                      synced 6 min ago" card here and it is the one thing on
                      this screen a reader would act on — a fabricated
                      league is worse than an empty section, which at least
                      says truthfully that the next step is to add one. */}
                  {/* The same waitlist every other "connect" control opens,
                      rather than the #/rooms link this used to be — that was
                      a redirect standing in for an answer. */}
                  <ConnectLeagueCta variant="row" source="you-add-league">
                    <span className="flex items-center gap-2.5">
                      <span className="text-teal" aria-hidden="true">✨</span>
                      Add a league from Sleeper, ESPN, Yahoo or CBS
                    </span>
                    <span className="text-ink-muted" aria-hidden="true">›</span>
                  </ConnectLeagueCta>
                </Section>

                <Section title="SETTINGS">
                  <Row glyph="⚙" label="Default draft settings" href="#/rooms/draft" />
                  <Row glyph="❔" label="How it works" href="/docs/draft-room-how-it-works.html" />
                  <Row glyph="📄" label="Privacy" href="/docs/privacy.html" />
                  <Row glyph="📄" label="Terms" href="/docs/terms.html" />
                  <SignOutRow />
                </Section>
              </SignedIn>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
