import { useEffect, useState } from 'react'

/* Whether anybody is signed in, read through window.JukeAuth rather than
   through Clerk's own useAuth().

   Clerk's hook is the obvious choice and it is the wrong one HERE for a
   reason that is structural rather than stylistic: useAuth() throws
   without a <ClerkProvider> ancestor, and main.jsx deliberately renders
   the whole app with no provider at all when VITE_CLERK_PUBLISHABLE_KEY
   is unset — a fresh clone, CI, and the Playwright build are all in that
   branch. A hook cannot be called conditionally, so a component that
   wants this fact and also has to render in a keyless build cannot reach
   for useAuth() at all.

   window.JukeAuth is the bridge AuthBridge.jsx already writes for app.js,
   and "juke:auth" the event it already fires on every change to it. Both
   are simply absent in a keyless build, which reads here as signed out —
   which is exactly what it is. Same "answer no to a missing binding"
   contract store.js uses for D1 and the two proxied keys.

   Read once on attach as well as on the event, for the reason
   useJukeTick() already documents: AuthBridge's first write can land
   before this listener exists. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(
    () => typeof window !== 'undefined' && !!(window.JukeAuth && window.JukeAuth.isSignedIn)
  )
  useEffect(() => {
    const read = () => setSignedIn(!!(window.JukeAuth && window.JukeAuth.isSignedIn))
    window.addEventListener('juke:auth', read)
    read()
    return () => window.removeEventListener('juke:auth', read)
  }, [])
  return signedIn
}
