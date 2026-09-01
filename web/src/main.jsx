import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import AppHeader from './components/AppHeader.jsx'
import DraftRoom from './components/DraftRoom.jsx'
import AuthBridge from './components/AuthBridge.jsx'
import { CLERK_PUBLISHABLE_KEY, CLERK_APPEARANCE } from './clerkConfig.js'
import './index.css'

// #root, #appbar-root and #draftroom-root below are three independent
// React trees (three separate ReactDOM.createRoot() calls), not one tree
// with three mount points — so a <ClerkProvider> around #root's App alone
// would leave AppHeader and DraftRoom with no Clerk context at all, even
// though AccountButtons (SiteNav.jsx) renders inside all three of them.
// Wrapping each root individually is the supported shape for exactly this
// — several independent React roots on one page sharing one publishableKey
// — rather than something to route around.
//
// Only wraps when a key exists. entry-server.jsx's Node prerender pass
// never has one (there's no window there, which Clerk's frontend JS reaches
// for throughout), and a real browser with no key configured is just a
// clone or CI run that hasn't set one up — AccountButtons' own fallback
// (unchanged today's button) covers that case without a provider at all,
// the same "answer no to a missing binding" contract store.js already uses
// for D1/GIPHY/Tank01.
// `bridge` is AuthBridge, and only the #root call below passes it — one
// instance of a global is enough (see that component's own comment), and
// it renders nothing, so it has to live inside the same conditional that
// decides whether a ClerkProvider exists at all: useAuth() throws without
// one, and unlike SiteNav.jsx's AccountButtons (which has its own mounted
// gate to fall back before ever calling a Clerk hook) this component has
// no reason to run at all when there is no key.
const withClerk = (node, bridge) =>
  CLERK_PUBLISHABLE_KEY ? (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} appearance={CLERK_APPEARANCE}>
      {bridge}
      {node}
    </ClerkProvider>
  ) : (
    node
  )

// scripts/prerender.mjs (homepage v4 pass 0) fills #root with real,
// server-rendered markup as part of `npm run build` — see its own header
// comment for what App renders without a window.JukeEngine to read.
// hydrateRoot() attaches to that markup instead of discarding and
// re-rendering it, which is the entire point: the browser already has
// pixels for the hero before this module has even finished parsing.
//
// `vite dev` never runs the prerender step (only the production build
// script does), so #root is genuinely empty there — hydrating empty
// markup is a real mismatch, not a false positive, and React's recovery
// from it is a full client render preceded by a console warning on every
// single dev reload. Checking for existing content rather than branching
// on import.meta.env.DEV is what keeps this correct for the one case that
// actually matters: `vite preview` serving a real dist/ build locally,
// which DEV cannot distinguish from dev but a filled #root can.
const rootEl = document.getElementById('root')
const app = withClerk(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  <AuthBridge />
)
if (rootEl.innerHTML.trim()) {
  ReactDOM.hydrateRoot(rootEl, app)
} else {
  ReactDOM.createRoot(rootEl).render(app)
}

// #appbar-root lives inside #appbar, which applyRoute() already shows and
// hides (home vs. draft route) — same contract as the two mounts above.
const appbarRoot = document.getElementById('appbar-root')
if (appbarRoot) {
  ReactDOM.createRoot(appbarRoot).render(
    withClerk(
      <React.StrictMode>
        <AppHeader />
      </React.StrictMode>,
    ),
  )
}

// #draftroom-root is not inside #view-home or #view-app, and nothing in
// app.js shows or hides it — DraftRoom itself watches location.hash and
// renders null off the #/draft-room route, so this mount is always safe to
// create regardless of which route is active.
const draftRoomRoot = document.getElementById('draftroom-root')
if (draftRoomRoot) {
  ReactDOM.createRoot(draftRoomRoot).render(
    withClerk(
      <React.StrictMode>
        <DraftRoom />
      </React.StrictMode>,
    ),
  )
}

// Breach (see #boot-sonar at the top of index.html) covers the blocking
// classic scripts and React's own boot. This is where it comes down.
//
// Runs unconditionally on every load now — reversed from Homepage v4 pass
// 0's original scoping, which skipped this whole block outright unless
// document.documentElement had a data-standalone attribute theme.js used
// to stamp. That scoping meant the overlay, Breach included, never played
// on an ordinary browser visit at all: reported directly, from someone who
// opened the site expecting to see it and did not, on desktop or mobile
// either one. theme.js no longer stamps the attribute and nothing here
// reads it any more.
//
// Two nested rAFs put the teardown after React's first paint, which is the real
// "ready" signal on this page. app.js is a classic script, so window.JukeEngine
// already exists by the time this module runs at all; there is no timing hazard
// to guard against here, only a paint to wait for.
//
// In a background tab rAF does not fire at all, so this waits for the first
// frame the tab is actually rendered. That is the behaviour we want rather than
// a problem to solve: the overlay's own CSS animation is throttled in step with
// it, so a tab opened in the background and looked at later finds the overlay
// still at opacity 0 and removes it outright, with no loader mid-flight.
//
// Which is the same branch a fast foreground load takes. The fade-in used to be
// delayed 300ms for exactly that reason — so an overlay still at opacity 0 was
// removed rather than faded, keeping a quick load from flashing a logo — but
// that delay is gone now too (see index.html's own note on why) and MIN_VISIBLE_MS
// below does the same job from the other end: holding a real minimum instead of
// skipping a fast one.
//
// The pin-then-flush dance is not superstition. Setting `animation: none` and
// changing opacity in one style change is the single case where the
// transition's start value is browser-variable: the animation was what held the
// opacity up, and removing it in the same breath can jump-cut instead of
// fading. Writing the animated value out as a real inline style, dropping the
// animation, forcing a style flush, and only then handing over to the
// [data-sonar-out] rule makes the fade deterministic in every engine.
const boot = document.getElementById('boot-sonar')
if (boot) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      // Hold for MIN_VISIBLE_MS from navigation start, then leave. performance
      // .now() is measured from the time origin, so it is exactly how long this
      // page has been loading — no separate start timestamp to keep in step.
      //
      // Breach II replaced Breach I's choreography wholesale — a second,
      // hardened handoff, built specifically to fix the sync-drift class of
      // bug that caused the glitching reported against Breach I. Every
      // breach* element now reads a single --total (4000ms) with no separate
      // start-delay layered on top; see index.html's own comment on
      // --total for why that second variable is gone rather than kept and
      // pointed at a different value.
      //
      //   shark/water breachMark/Pulse  --total, no delay                 -> fade complete   4000ms
      //   wordmark    sonar-label       500ms after .65 * --total delay   -> settles          3100ms
      //   ripple      breachRipple      --total after .55 * --total delay -> visually done  ~4680ms
      //   idle ring 1 sonar-ring        2100ms, --total delay             -> enters           4000ms
      //
      // The ripple's own animation technically keeps running past that
      // ~4680ms (both the mark and the ripple are declared with a duration of
      // --total itself, not a short fixed clip — see index.html for why:
      // matching Breach II's own file exactly, rather than reintroducing the
      // fixed-millisecond sub-durations that caused the drift Breach II was
      // built to fix), but breachRipple's own 62% keyframe already holds it
      // at opacity 0 from there on, so nothing after ~4680ms is visible.
      // 4900ms leaves that a little room rather than cutting it off flush. A
      // loading state that never shows its own last element is not finished,
      // it is interrupted — the lesson the first version of this hold (900ms,
      // the mark alone) was written to fix, and it applies exactly as much to
      // a ripple as it did to a third ring.
      //
      // This whole hold replaces an early return that removed the element
      // outright while it was still at opacity 0 — the branch a fast load
      // always took, and the reason the loader was invisible to anyone on a
      // quick connection.
      const MIN_VISIBLE_MS = 4900
      setTimeout(() => {
      const shown = getComputedStyle(boot).opacity

      boot.style.opacity = shown
      boot.style.animation = 'none'
      void boot.offsetHeight // flush: provably at `shown`, with nothing animating

      boot.style.opacity = ''
      boot.setAttribute('data-sonar-out', '')
      // 240 rather than 220: the element leaves the DOM a frame after the
      // transition ends, never during it. A fixed overlay at z-index 9999
      // swallows every click on the page, so the one thing that must not happen
      // is this element outliving the load - not a few spare milliseconds.
      setTimeout(() => boot.remove(), 240)
      }, Math.max(0, MIN_VISIBLE_MS - performance.now()))
    }),
  )
}
