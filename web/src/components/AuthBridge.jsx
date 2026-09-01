import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'

// The mirror image of window.JukeEngine: that bridge lets React read real
// data out of app.js's classic-script boot; this one lets app.js (still a
// classic script, still the thing that actually owns saveDraft()/
// recordHistory()) read Clerk's signed-in state back out of React, since
// Clerk's hooks only work inside a component. Renders nothing — this is a
// side-effect-only component, mounted once alongside <App/> in main.jsx.
//
// One instance is enough even though three independent roots exist
// (#root, #appbar-root, #draftroom-root, each in its own <ClerkProvider>):
// window.JukeAuth is a single global, and Clerk's own state is already
// shared across every provider using the same publishableKey, so nothing
// is gained by writing it three times.
//
// `getToken` is reassigned on every render rather than captured once —
// it's the function Clerk's own SDK hands back each time useAuth() runs,
// and calling whatever the latest one is is what keeps a caller from
// holding a stale closure across a token refresh.
export default function AuthBridge() {
  const { isSignedIn, userId, getToken } = useAuth()

  useEffect(() => {
    window.JukeAuth = { isSignedIn: !!isSignedIn, userId: userId || null, getToken }
    // Same pattern headerInfo() already uses (see CLAUDE.md's note on
    // window.dispatchEvent(new Event("juke:header"))) — a plain DOM event
    // rather than a callback registry, so app.js can listen without this
    // bridge needing to know who, if anyone, is listening.
    window.dispatchEvent(new Event('juke:auth'))
  }, [isSignedIn, userId, getToken])

  return null
}
