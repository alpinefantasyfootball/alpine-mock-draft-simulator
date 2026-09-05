import { useEffect, useReducer, useState } from 'react'

/* The connected league, and whether we know yet.

   ---- Three states, not two ----

   `status` is the whole reason this is a hook rather than a boolean, and
   getting it wrong is what makes a connect flow feel broken:

     "loading"    we have not been told yet. Nothing about the league is
                  known, including whether there is one.
     "none"       asked and answered: this account has connected nothing.
     "connected"  `league` is real.

   Collapsing loading into none is the bug this shape exists to prevent —
   a signed-in manager with a league would see "Connect your league" for a
   beat on every load, which reads as having been disconnected. Every
   caller branches on all three or draws nothing.

   ---- It reads the account, not localStorage ----

   A connection is per-account by design: the handoff's rule is that
   connecting always routes through account creation first, and the point
   of that is a league that follows somebody to their phone. So this asks
   the worker, with a Clerk token, and answers "none" while signed out
   rather than pretending.

   `window.JukeAuth` rather than Clerk's own hooks, for the reason
   AuthBridge exists: `getToken` is reassigned on every render there, so
   reading it at call time is what keeps this from holding a stale closure
   across a token refresh.

   ---- One answer, shared, and it is what makes connecting VISIBLE ----

   This used to be per-component state: every caller fetched its own copy
   and kept it to itself. Two things followed, and both were reported as
   one bug — "even after it said it connected, the Connect messaging is
   still there throughout the website".

   **Nothing could tell anybody.** ConnectLeagueModal wrote the league to
   the worker and said so in its own dialog, and every other surface on the
   page went on asking for a league it already had. The header's chip, the
   homepage's "your next move" card, the Rooms lobby's unlock bar and the
   You screen's empty section were each holding an answer fetched before
   the connect happened, with no way to hear that it had. Only a reload
   fixed it, which is exactly what a reader will not do to check whether
   the thing they just did worked.

   **And every caller was its own request.** Four surfaces on one screen
   meant four `GET /me/leagues` per page load, for one fact about one
   account.

   So the answer lives here, once, and components subscribe to it.
   `noteLeagueConnected()` is what the connect flow calls the instant the
   worker confirms — the same shape as `juke:header`, one level up: the
   thing that changed the state is what announces it, rather than every
   reader polling for it. */

const state = { status: 'loading', league: null, reason: null }
const subscribers = new Set()

/* One request at a time. Four components mounting together ask four times
   otherwise, and `refresh()` is also bound to three window events that can
   fire in the same tick. */
let inFlight = null

function announce() {
  subscribers.forEach((fn) => fn())
}

function settle(status, league, reason) {
  // A no-op write still re-renders every subscriber if it announces, and
  // `juke:auth` fires on every Clerk render — which is often.
  if (state.status === status && state.league === league && state.reason === (reason || null)) return
  state.status = status
  state.league = league
  state.reason = reason || null
  announce()
}

function authToken() {
  const auth = typeof window !== 'undefined' ? window.JukeAuth : null
  return auth && auth.isSignedIn && auth.getToken ? auth.getToken() : Promise.resolve(null)
}

/* Ask the worker. Answers immediately and settles later; safe to call as
   often as anything likes. */
export function refreshLeagues() {
  if (typeof window === 'undefined') return
  if (inFlight) return

  const auth = window.JukeAuth
  if (!auth || !auth.isSignedIn) {
    settle('none', null, 'signed-out')
    return
  }
  /* live.js has not landed yet. Stay in "loading" so no screen claims
     there is no league on the strength of a file that has not arrived —
     and note that this is the one path that used to be terminal: nothing
     re-ran when the script finally arrived, so a cold load could sit in
     "loading" for ever and the header would draw no chip at all. The
     `juke:data-loaded` listener below is what closes it. */
  if (!window.Live || !window.Live.listLeagues) return

  inFlight = Promise.resolve(authToken())
    .then((token) => window.Live.listLeagues(token))
    .then((res) => {
      if (!res.ok) {
        /* A failure is not "no league". Saying "none" here would offer
           Connect to somebody who has already connected, and pressing it
           would reconnect a league they never disconnected — so an
           unreachable worker keeps the previous answer and reports why,
           and the caller decides whether that is worth a message. */
        settle(state.league ? 'connected' : 'loading', state.league, res.reason)
        return
      }
      const first = res.leagues && res.leagues[0]
      settle(first ? 'connected' : 'none', first || null, null)
    })
    .catch(() => settle(state.league ? 'connected' : 'loading', state.league, 'offline'))
    .finally(() => { inFlight = null })
}

/* What the connect flow calls the moment the worker confirms a league.

   Not a `refresh()`: the worker has just told us what the league is, so
   asking it again is a round trip to learn what we are already holding —
   and on a slow connection it is a round trip during which every surface
   still says "Connect a league" after the dialog has said "Connected". */
export function noteLeagueConnected(league) {
  if (!league) { refreshLeagues(); return }
  settle('connected', league, null)
}

export function useLeague() {
  const [, bump] = useReducer((n) => n + 1, 0)

  useEffect(() => {
    subscribers.add(bump)
    refreshLeagues()

    /* Three reasons to re-read, and they are different questions.

       `juke:auth` — who is signed in changed. AuthBridge fires it on every
       Clerk render, so the first useful one is usually the moment the
       session resolves, which is exactly when the answer above went from
       "signed out, none" to something worth asking about.

       `juke:league` — somebody connected or disconnected one in another
       part of the tree. noteLeagueConnected() settles the state directly,
       so this is for anything that changes it without knowing the answer.

       `juke:data-loaded` — the deferred scripts landed, which is the one
       thing that can turn the early return above from "not yet" into an
       answer. */
    const reread = () => refreshLeagues()
    window.addEventListener('juke:auth', reread)
    window.addEventListener('juke:league', reread)
    window.addEventListener('juke:data-loaded', reread)
    return () => {
      subscribers.delete(bump)
      window.removeEventListener('juke:auth', reread)
      window.removeEventListener('juke:league', reread)
      window.removeEventListener('juke:data-loaded', reread)
    }
  }, [])

  return { status: state.status, league: state.league, reason: state.reason, refresh: refreshLeagues }
}

/* A league's live state, fetched on demand.

   Deliberately separate from useLeague(): the identity of the connected
   league is wanted by the header on every screen, and its rosters and
   records by exactly one screen. Folding them together would put four
   upstream calls behind every page load to draw a chip that needs a name.

   Answers null while loading and on failure alike, with `reason` for the
   difference — the same contract as everything else here. */
export function useLeagueSnapshot(leagueId) {
  const [snapshot, setSnapshot] = useState(null)
  const [status, setStatus] = useState('loading')
  const [reason, setReason] = useState(null)

  useEffect(() => {
    let alive = true
    if (!leagueId) {
      setStatus('none')
      setSnapshot(null)
      return () => { alive = false }
    }
    if (typeof window === 'undefined' || !window.Live || !window.Live.leagueSnapshot) {
      return () => { alive = false }
    }

    setStatus('loading')
    window.Live.leagueSnapshot(leagueId).then((res) => {
      if (!alive) return
      setSnapshot(res.ok ? res.snapshot : null)
      setStatus(res.ok ? 'ready' : 'error')
      setReason(res.ok ? null : res.reason)
    })

    return () => { alive = false }
  }, [leagueId])

  return { snapshot, status, reason }
}
