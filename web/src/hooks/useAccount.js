import { useEffect, useState } from 'react'

// window.Account (account.js) mirrors window.Live's own shape, and this
// hook mirrors useEngine()/useJukeTick() from useJukeEngine.js for the
// identical reason: every React island that reads account state was about
// to grow its own copy of "subscribe, force a re-render, unsubscribe."
//
// Returns null until account.js has run (same "ready" gate useEngine()
// uses for window.JukeEngine) and the live state object after that —
// account.js's own state.status starts at "loading" until the first
// /account/session check answers, so a caller can tell "don't know yet"
// apart from "signed out."
//
// Listens for "juke:account" — a plain window event, the same shape
// useJukeTick() already uses for "juke:header" — rather than registering a
// callback through an Account.onChange(fn) method. The account menu, the
// welcome/error banner and the Locker screen all call this hook at once,
// and a single `state.onchange = fn` slot (what this used to be, and what
// account.js's own announce() used to call) silently drops every earlier
// subscriber the moment a later component mounts and claims the one slot —
// caught by actually loading a signed-in page and finding the header still
// reading "Sign in." A DOM event has no such limit: every mounted consumer
// gets every announce().
export function useAccount() {
  const [state, setState] = useState(() =>
    (typeof window !== 'undefined' && window.Account) ? window.Account.state() : null
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.Account) return
    const onChange = () => setState(Object.assign({}, window.Account.state()))
    window.addEventListener('juke:account', onChange)
    // Read once on attach, the same reason useJukeTick() does: account.js's
    // own consumeFromUrl() can resolve before this effect ever runs, and
    // missing that first announce() would leave the header showing
    // "loading" through a sign-in that already finished.
    onChange()
    return () => window.removeEventListener('juke:account', onChange)
  }, [])

  return state
}
