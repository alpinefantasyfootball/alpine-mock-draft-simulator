import { useEffect, useState } from 'react'
import { CLERK_PUBLISHABLE_KEY } from '../clerkConfig.js'

// "Is it safe to render Clerk's own components yet." Answers false during
// the prerender and on the first client pass, and false forever in a
// checkout with no publishable key configured.
//
// Both halves matter and both fail silently when skipped, which is why this
// is a hook rather than a line each caller writes for itself:
//
// - **The key.** With none, main.jsx renders no <ClerkProvider> at all (its
//   own comment explains why: Clerk's frontend JS reaches for `window`
//   throughout, and entry-server.jsx's Node pass has none). Every Clerk
//   component — <SignedIn>, <SignInButton>, <UserButton> — throws without
//   that provider above it, so a fresh clone or a CI build would crash the
//   page rather than simply not offering accounts.
//
// - **The mount.** scripts/prerender.mjs writes real server-rendered markup
//   into #root and main.jsx hydrates onto it. The server cannot render
//   <SignedIn>/<SignedOut> (no provider, per above), so a first client pass
//   that *does* render them is a hydration mismatch — React's recovery is to
//   re-render the subtree, which on a phone is a visible frame of the wrong
//   thing. Waiting for an effect (never run during SSR, never before that
//   first client pass) keeps pass one byte-for-byte identical to the markup
//   the server sent.
//
// Nothing here calls into Clerk, deliberately: a hook that called useAuth()
// would itself throw in the no-key case, and hooks cannot be called
// conditionally to dodge that. It is plain React state, so it is safe with
// or without a provider above it — which is the whole point.
//
// What each caller does with `false` is its own decision rather than this
// hook's: SiteNav.jsx's AccountButtons still renders inert Log in / Sign up
// triggers (a nav row with a hole in it looks broken), while HomePhone.jsx's
// account card renders nothing at all (a card whose only purpose is two
// buttons has nothing to say without them).
export function useAccountUiReady() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return mounted && Boolean(CLERK_PUBLISHABLE_KEY)
}
