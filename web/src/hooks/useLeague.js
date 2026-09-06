import { useEffect, useReducer, useState } from 'react'
import {
  leagueState,
  noteLeagueConnected,
  refreshLeagues,
  removeLeague,
  retryLeagues,
  selectLeague,
  subscribeLeagues,
} from '../lib/leagueStore.js'

/* React's view of the connected-league store.
 *
 * The store is web/src/lib/leagueStore.js and its own header explains both
 * the four states and why it has no imports. This file is the subscription
 * and nothing else.
 *
 * Re-exported so every existing import site keeps working -- the split was
 * about testability, not about moving anybody's imports. */
export {
  leagueState,
  noteLeagueConnected,
  refreshLeagues,
  removeLeague,
  retryLeagues,
  selectLeague,
}

export function useLeague() {
  const [, bump] = useReducer((n) => n + 1, 0)

  useEffect(() => {
    const unsubscribe = subscribeLeagues(bump)
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
    /* Coming back to the tab is the strongest evidence there is that now is
       the moment, which is the same signal reconcileWithServer() and
       live.js already act on. Only from "error", because the other three
       states are already answers and a re-read on every tab focus would be
       a request per glance for a fact that has not changed. */
    const onVisible = () => {
      if (document.visibilityState === 'visible' && leagueState().status === 'error') retryLeagues()
    }
    window.addEventListener('juke:auth', reread)
    window.addEventListener('juke:league', reread)
    window.addEventListener('juke:data-loaded', reread)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      window.removeEventListener('juke:auth', reread)
      window.removeEventListener('juke:league', reread)
      window.removeEventListener('juke:data-loaded', reread)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const snapshot = leagueState()
  return {
    status: snapshot.status,
    league: snapshot.league,
    leagues: snapshot.leagues,
    reason: snapshot.reason,
    refresh: refreshLeagues,
    retry: retryLeagues,
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
export function useLeagueSnapshot(leagueId, provider) {
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
    window.Live.leagueSnapshot(leagueId, provider).then((res) => {
      if (!alive) return
      setSnapshot(res.ok ? res.snapshot : null)
      setStatus(res.ok ? 'ready' : 'error')
      setReason(res.ok ? null : res.reason)
    })

    return () => { alive = false }
    // provider is in the key because the same numeric id is a different
    // league on a different platform — re-fetching on it is what stops a
    // switch between two leagues drawing the first one's rosters.
  }, [leagueId, provider])

  return { snapshot, status, reason }
}
