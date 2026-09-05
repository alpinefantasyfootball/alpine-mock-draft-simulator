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

/* `leagues` is every league this account has connected, active first, and
   `league` is its head.

   Both, rather than one derived at each call site, because they answer
   different questions and almost every caller wants only the first: the
   header draws the active league, the League Room reads the active
   league's snapshot, the You screen lists all of them. Keeping `league` on
   the object means the seven surfaces that read it did not change when
   this grew a list underneath them.

   The order is the server's. listLeagues() returns most-recently-selected
   first, so the head IS the active league by construction — there is no
   `activeId` here to keep in step with the array, which would be the same
   fact written down twice and would drift the first time a switch failed
   halfway. */
const state = { status: 'loading', league: null, leagues: [], reason: null }
const subscribers = new Set()

/* Cheap identity for "is this the same list, in the same order". Used only
   to decide whether a re-render is worth announcing: refreshLeagues() runs
   on three window events, one of which (`juke:auth`) fires on every Clerk
   render, so an unchanged answer must cost nothing. */
function listKey(leagues) {
  return (leagues || []).map((l) => l.provider + ':' + l.leagueId).join('|')
}

/* One request at a time. Four components mounting together ask four times
   otherwise, and `refresh()` is also bound to three window events that can
   fire in the same tick. */
let inFlight = null

function announce() {
  subscribers.forEach((fn) => fn())
}

function settle(status, leagues, reason) {
  const list = leagues || []
  const head = list[0] || null
  // A no-op write still re-renders every subscriber if it announces, and
  // `juke:auth` fires on every Clerk render — which is often. The list is
  // compared by content rather than by reference because every refresh
  // builds a fresh array out of a fresh response, so an identity check
  // here would announce on every poll.
  if (
    state.status === status &&
    state.reason === (reason || null) &&
    listKey(state.leagues) === listKey(list)
  ) return
  state.status = status
  state.leagues = list
  state.league = head
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
    settle('none', [], 'signed-out')
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
        settle(state.leagues.length ? 'connected' : 'loading', state.leagues, res.reason)
        return
      }
      const list = Array.isArray(res.leagues) ? res.leagues : []
      settle(list.length ? 'connected' : 'none', list, null)
    })
    .catch(() => settle(state.leagues.length ? 'connected' : 'loading', state.leagues, 'offline'))
    .finally(() => { inFlight = null })
}

/* What the connect flow calls the moment the worker confirms a league.

   Not a `refresh()`: the worker has just told us what the league is, so
   asking it again is a round trip to learn what we are already holding —
   and on a slow connection it is a round trip during which every surface
   still says "Connect a league" after the dialog has said "Connected". */
export function noteLeagueConnected(league) {
  if (!league) { refreshLeagues(); return }
  /* At the head, because that is where the worker has just put it:
     POST /me/leagues selects what it connects. Prepending rather than
     appending is not cosmetic — the head is what every screen draws, so an
     appended league would be stored, listed, and invisible until a reload
     reordered it.

     Filtered first so reconnecting a league already in the list moves it
     and refreshes its label rather than listing it twice. */
  const rest = state.leagues.filter(
    (l) => !(l.provider === league.provider && l.leagueId === league.leagueId)
  )
  settle('connected', [league].concat(rest), null)
}

/* Switch the active league.

   ---- Optimistic, and it settles back on failure ----

   The reorder is applied before the request goes out, because a menu that
   waits a round trip to close reads as a menu that did not take the press.
   What it must not do is keep an order the account will not come back to:
   a switch that failed and stayed on screen is the "claims a backup it
   does not have" failure with a league name on it, and the reader finds
   out on their next page load.

   So a failure puts the previous order back and reports why. The caller
   gets the reason and decides whether it is worth a message; every
   subscriber gets the truth either way.

   ---- The success path takes the server's list, not the local one ----

   PATCH answers with the whole list because the server owns the order.
   Re-using the optimistic array here instead would be a second opinion
   about which league is active, which is the thing the head-is-active rule
   exists to prevent. */
export function selectLeague(league) {
  if (!league) return Promise.resolve({ ok: false, reason: 'bad-request' })

  const previous = state.leagues
  const already = previous[0]
  if (already && already.provider === league.provider && already.leagueId === league.leagueId) {
    return Promise.resolve({ ok: true, reason: null })
  }

  const rest = previous.filter(
    (l) => !(l.provider === league.provider && l.leagueId === league.leagueId)
  )
  settle('connected', [league].concat(rest), null)

  const live = typeof window !== 'undefined' ? window.Live : null
  if (!live || !live.selectLeague) {
    settle('connected', previous, 'offline')
    return Promise.resolve({ ok: false, reason: 'offline' })
  }

  return Promise.resolve(authToken())
    .then((token) => live.selectLeague(token, league.leagueId, league.provider))
    .then((res) => {
      if (!res.ok) {
        settle('connected', previous, res.reason)
        return { ok: false, reason: res.reason }
      }
      const list = Array.isArray(res.leagues) && res.leagues.length ? res.leagues : [league].concat(rest)
      settle('connected', list, null)
      return { ok: true, reason: null }
    })
    .catch(() => {
      settle('connected', previous, 'offline')
      return { ok: false, reason: 'offline' }
    })
}

/* Disconnect one.

   ---- Why this arrived with the switcher and not before ----

   `Live.disconnectLeague` has existed since connect shipped and nothing
   called it, which was survivable while the app drew one league: a second
   connect replaced the first on screen, so there was never a league you
   could see and not get rid of. The switcher ends that — leagues now
   accumulate and all of them are visible — so shipping the accumulation
   without the removal would leave somebody who connected the wrong league
   permanently looking at it.

   Not optimistic, unlike select(). A switch is reversible by switching
   back and costs nothing if it fails; a disconnect that appeared to work
   and did not would have somebody believing a league was gone from their
   account. So the row goes when the worker says it has gone.

   The list comes from a re-read rather than a local filter, because the
   server decides what is active next: removing the head promotes whatever
   was selected before it, and that is not a fact this side can derive. */
export function removeLeague(league) {
  if (!league) return Promise.resolve({ ok: false, reason: 'bad-request' })

  const live = typeof window !== 'undefined' ? window.Live : null
  if (!live || !live.disconnectLeague) {
    return Promise.resolve({ ok: false, reason: 'offline' })
  }

  return Promise.resolve(authToken())
    .then((token) => live.disconnectLeague(token, league.leagueId, league.provider))
    .then((res) => {
      if (!res.ok) return { ok: false, reason: res.reason }
      /* refreshLeagues() bails while a read is in flight, so the state is
         settled from a filtered copy first and then re-read. Without the
         first half a disconnect during an in-flight refresh would appear
         to do nothing at all. */
      const left = state.leagues.filter(
        (l) => !(l.provider === league.provider && l.leagueId === league.leagueId)
      )
      // "none" when that was the last one, or the screen keeps claiming a
      // connection it no longer has — status is what every caller branches
      // on, and an empty list under 'connected' is a state no reader of
      // this hook is written for.
      settle(left.length ? 'connected' : 'none', left, null)
      refreshLeagues()
      return { ok: true, reason: null }
    })
    .catch(() => ({ ok: false, reason: 'offline' }))
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

  return {
    status: state.status,
    league: state.league,
    leagues: state.leagues,
    reason: state.reason,
    refresh: refreshLeagues,
    select: selectLeague,
    remove: removeLeague,
  }
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
