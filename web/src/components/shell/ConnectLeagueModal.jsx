import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { X, Check, Lock } from 'lucide-react'
import { PLATFORMS } from './leaguePlatforms.js'

/* Connect a league: which platform, then a username, then which league.

   ---- The platform step exists because the site claims four ----

   It did not, and that was the bug: every connect control on the site is
   captioned with four platforms, and pressing one opened a dialog headed
   "Your Sleeper username" with nothing in between. Reported as a
   disconnect between what we say we connect to and what the pop-up asks
   for, and it is exactly that — the reader is told the product reads their
   ESPN league and then asked for a credential from somewhere else.

   So the platform is chosen, all four are listed, and the three that are
   not built are visibly locked rather than absent. See leaguePlatforms.js
   for why they are listed at all.

   **The step is not skipped when only one platform is live.** It is one
   press, and what it buys is that nobody is ever asked for a Sleeper
   username without having said "Sleeper" first — which is the whole
   complaint. It also stops being a step nobody notices the day a second
   platform ships, rather than being a screen somebody has to remember to
   add back.

   ---- Why a username and not a login ----

   Sleeper's public API needs no key and has no OAuth, and it has no write
   endpoints at all. A username is enough to read the leagues behind it,
   which is the whole of what Juke wants. That is what makes "Connecting is
   read-only. Juke never edits your league" — the line on every unlock card
   — a property of the integration rather than a promise somebody has to
   keep: there is no credential here that could be used to change anything,
   because none was asked for.

   It also means no password ever reaches this app, which is the honest
   reason to prefer it over the alternative even where an alternative
   exists.

   ---- Two steps, and the second one has to exist ----

   A manager with one league would be happy with "type your name, done".
   Most have several, and a wrong guess connects the wrong roster to every
   screen in the app — so the league is always chosen, never inferred, even
   when there is only one to choose from. The single-league case is one
   extra press and no ambiguity.

   ---- The failures are told apart ----

   "We could not find that username" and "we could not reach Sleeper" want
   different things from the reader — retype versus retry — so live.js
   reports `not-found` separately from `offline` and this says the
   different thing. Collapsing them is how a form tells somebody their name
   is wrong when the network is down. */

const ConnectLeagueModal = forwardRef(function ConnectLeagueModal({ onConnected }, ref) {
  const dialogRef = useRef(null)
  const [username, setUsername] = useState('')
  // platform | idle | looking | picking | connecting | done | not-found | error
  const [status, setStatus] = useState('platform')
  const [platform, setPlatform] = useState(null)
  const [leagues, setLeagues] = useState([])
  const [sleeperUser, setSleeperUser] = useState(null)
  const [chosen, setChosen] = useState(null)

  useImperativeHandle(ref, () => ({
    open() {
      setUsername('')
      setLeagues([])
      setSleeperUser(null)
      setChosen(null)
      setPlatform(null)
      // Always the first step, never the one it was left on: this dialog
      // is one element reused for every open, which is the same reason
      // openSheet() clears the player sheet's team colour rather than
      // merely setting it.
      setStatus('platform')
      dialogRef.current?.showModal()
    },
  }))

  const close = () => dialogRef.current?.close()

  const live = () => (typeof window !== 'undefined' ? window.Live : null)
  const token = () => {
    const auth = typeof window !== 'undefined' ? window.JukeAuth : null
    return auth && auth.getToken ? auth.getToken() : Promise.resolve(null)
  }

  const lookup = async (e) => {
    e.preventDefault()
    const name = username.trim()
    if (!name) return
    setStatus('looking')

    const l = live()
    const res = l && l.sleeperLookup ? await l.sleeperLookup(name) : { ok: false, reason: 'offline' }
    if (!res.ok) {
      setStatus(res.reason === 'not-found' ? 'not-found' : 'error')
      return
    }
    setSleeperUser(res.user)
    setLeagues(res.leagues)
    // A real account with no leagues this season is its own answer, and
    // not an error: it is what a manager who has not joined one yet sees.
    setStatus('picking')
  }

  const connect = async () => {
    if (!chosen) return
    setStatus('connecting')
    const l = live()
    const res = l && l.connectLeague
      ? await l.connectLeague(await token(), chosen.leagueId, sleeperUser && sleeperUser.userId)
      : { ok: false, reason: 'offline' }

    if (!res.ok) {
      setStatus('error')
      return
    }
    setStatus('done')
    if (onConnected) onConnected(res.league)
    // Long enough to read the confirmation, short enough not to be a wait.
    setTimeout(() => close(), 900)
  }

  const label = 'font-mono text-[11px] tracking-[0.14em] text-teal'

  return (
    <dialog
      ref={dialogRef}
      className="m-auto rounded-2xl border border-line-hairline bg-[#151920] p-0 text-white backdrop:bg-black/60"
      onClick={(e) => {
        // The convention every other dialog here uses: a click landing on
        // the dialog element itself is a click on the backdrop.
        if (e.target === dialogRef.current) close()
      }}
    >
      <div className="w-[min(92vw,30rem)] p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className={label}>CONNECT A LEAGUE</span>
            <h3 className="mt-1.5 font-display text-[24px] font-bold text-white">
              {status === 'platform'
                ? 'Where is your league?'
                : status === 'picking' || status === 'connecting' || status === 'done'
                  ? 'Which league?'
                  : `Your ${platform ? platform.name : 'Sleeper'} username`}
            </h3>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1.5 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === 'platform' ? (
          <>
            <p className="mt-2 text-[14px] leading-[1.5] text-voidInk-body">
              Juke reads your league to price waivers, trades and your lineup. It never writes to
              it.
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {PLATFORMS.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    disabled={!p.live}
                    onClick={() => { setPlatform(p); setStatus('idle') }}
                    className={
                      'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ' +
                      (p.live
                        ? 'border-line-hairline hover:border-teal/60'
                        : 'cursor-default border-line-hairline/60 opacity-45')
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-white">
                        {p.name}
                      </span>
                      {p.note ? (
                        <span className="mt-0.5 block text-[12px] text-ink-muted">{p.note}</span>
                      ) : null}
                    </span>
                    {p.live ? (
                      <span className="shrink-0 text-[18px] text-ink-muted" aria-hidden="true">›</span>
                    ) : (
                      <Lock className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {/* Said once, plainly, rather than left for somebody to infer
                from three dimmed rows. The locked platforms carry no
                "soon" badge of their own for the reason the sport chips
                do not either: a lock says "not this one" and a badge says
                "we have committed to a date". */}
            <p className="mt-3.5 text-[13px] leading-[1.4] text-voidInk-body">
              Sleeper is the one Juke reads today. The others are not connected yet.
            </p>
          </>
        ) : status === 'done' ? (
          <p className="mt-4 flex items-center gap-2 text-[15px] text-mint">
            <Check className="h-5 w-5 shrink-0" />
            Connected {chosen ? chosen.name : 'your league'}.
          </p>
        ) : status === 'picking' || status === 'connecting' ? (
          <>
            <p className="mt-2 text-[14px] leading-[1.5] text-voidInk-body">
              Signed in as <b className="font-semibold text-white">{sleeperUser?.name}</b>. Juke
              reads this league and never writes to it.
            </p>

            {leagues.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-flow-pillEdge px-4 py-5 text-center text-[14px] text-voidInk-body">
                No leagues on that account this season.
              </p>
            ) : (
              <ul className="mt-4 flex max-h-[46vh] flex-col gap-2 overflow-y-auto">
                {leagues.map((lg) => {
                  const on = chosen && chosen.leagueId === lg.leagueId
                  return (
                    <li key={lg.leagueId}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setChosen(lg)}
                        className={
                          'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ' +
                          (on
                            ? 'border-teal bg-flow-mintDark/40'
                            : 'border-line-hairline hover:border-white/25')
                        }
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-white">
                            {lg.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] tracking-[0.1em] text-ink-muted">
                            {lg.season}
                            {lg.totalTeams ? ` · ${lg.totalTeams} TEAMS` : ''}
                          </span>
                        </span>
                        {on ? <Check className="h-5 w-5 shrink-0 text-teal" /> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={connect}
              disabled={!chosen || status === 'connecting'}
              className="mt-5 w-full rounded-full px-5 py-3 text-[15px] font-bold text-surface-page transition-transform duration-150 hover:scale-[1.01] disabled:opacity-40"
              style={{ background: 'linear-gradient(100deg,#44D4E2,#82A1F6)' }}
            >
              {status === 'connecting' ? 'Connecting…' : 'Connect league'}
            </button>
          </>
        ) : (
          <form onSubmit={lookup}>
            {/* A way back to the platform list. A three-step flow whose
                first step cannot be returned to is a flow that punishes a
                misclick with a close-and-reopen — and this one's first
                step is a choice between four things, which is exactly
                where a misclick happens. */}
            <button
              type="button"
              onClick={() => { setPlatform(null); setUsername(''); setStatus('platform') }}
              className="-ml-1 mt-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[13px] text-ink-muted transition-colors hover:text-white"
            >
              <span aria-hidden="true">‹</span> Not {platform ? platform.name : 'Sleeper'}?
            </button>

            <p className="mt-1.5 text-[14px] leading-[1.5] text-voidInk-body">
              We read your leagues from Sleeper. No password, and nothing is ever written back —
              Sleeper&apos;s public API has no way to change your league even if we wanted to.
            </p>

            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (status !== 'idle') setStatus('idle')
              }}
              autoComplete="username"
              spellCheck={false}
              placeholder="sleeper username"
              /* 16px, because anything smaller makes iOS zoom the page in
                 on focus and not zoom back out — the floor CLAUDE.md keeps
                 for every field in this app. */
              className="mt-4 w-full rounded-xl border border-line-hairline bg-surface-page px-4 py-3 text-[16px] text-white outline-none placeholder:text-ink-muted focus:border-teal"
            />

            {status === 'not-found' ? (
              <p className="mt-2 text-[13px] text-flow-rose">
                No Sleeper account with that username. Check the spelling — it is the username, not
                a display name.
              </p>
            ) : null}
            {status === 'error' ? (
              <p className="mt-2 text-[13px] text-flow-rose">
                Could not reach Sleeper just now. Try again in a moment.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!username.trim() || status === 'looking'}
              className="mt-4 w-full rounded-full px-5 py-3 text-[15px] font-bold text-surface-page transition-transform duration-150 hover:scale-[1.01] disabled:opacity-40"
              style={{ background: 'linear-gradient(100deg,#44D4E2,#82A1F6)' }}
            >
              {status === 'looking' ? 'Looking…' : 'Find my leagues'}
            </button>
          </form>
        )}
      </div>
    </dialog>
  )
})

export default ConnectLeagueModal
