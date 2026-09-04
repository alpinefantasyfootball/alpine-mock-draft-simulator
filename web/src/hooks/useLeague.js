import { useCallback, useEffect, useState } from 'react'

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
   across a token refresh. */

function authToken() {
  const auth = typeof window !== 'undefined' ? window.JukeAuth : null
  return auth && auth.isSignedIn && auth.getToken ? auth.getToken() : Promise.resolve(null)
}

export function useLeague() {
  const [status, setStatus] = useState('loading')
  const [league, setLeague] = useState(null)
  const [reason, setReason] = useState(null)

  const refresh = useCallback(() => {
    let alive = true

    const done = (nextStatus, nextLeague, nextReason) => {
      if (!alive) return
      setStatus(nextStatus)
      setLeague(nextLeague)
      setReason(nextReason || null)
    }

    const auth = typeof window !== 'undefined' ? window.JukeAuth : null
    if (!auth || !auth.isSignedIn) {
      done('none', null, 'signed-out')
      return () => { alive = false }
    }
    if (typeof window === 'undefined' || !window.Live || !window.Live.listLeagues) {
      // live.js is a deferred classic script; nothing is wrong, it simply
      // has not landed. Stay in "loading" so no screen claims there is no
      // league on the strength of a file that has not arrived.
      return () => { alive = false }
    }

    Promise.resolve(authToken())
      .then((token) => window.Live.listLeagues(token))
      .then((res) => {
        if (!res.ok) {
          /* A failure is not "no league". Saying "none" here would offer
             Connect to somebody who has already connected, and pressing it
             would reconnect a league they never disconnected — so an
             unreachable worker keeps the previous answer and reports why,
             and the caller decides whether that is worth a message. */
          done(league ? 'connected' : 'loading', league, res.reason)
          return
        }
        const first = res.leagues && res.leagues[0]
        done(first ? 'connected' : 'none', first || null, null)
      })
      .catch(() => done(league ? 'connected' : 'loading', league, 'offline'))

    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancel = refresh()
    /* Re-read when who is signed in changes. AuthBridge fires this on
       every Clerk render, so the first useful one is usually the moment
       the session resolves — which is exactly when the answer above went
       from "signed out, none" to something worth asking about. */
    const onAuth = () => { if (cancel) cancel(); cancel = refresh() }
    window.addEventListener('juke:auth', onAuth)
    return () => {
      window.removeEventListener('juke:auth', onAuth)
      if (cancel) cancel()
    }
  }, [refresh])

  return { status, league, reason, refresh }
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
