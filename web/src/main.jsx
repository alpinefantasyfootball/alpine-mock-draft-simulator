import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AppHeader from './components/AppHeader.jsx'
import DraftRoom from './components/DraftRoom.jsx'
import './index.css'

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
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
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
    <React.StrictMode>
      <AppHeader />
    </React.StrictMode>,
  )
}

// #draftroom-root is not inside #view-home or #view-app, and nothing in
// app.js shows or hides it — DraftRoom itself watches location.hash and
// renders null off the #/draft-room route, so this mount is always safe to
// create regardless of which route is active.
const draftRoomRoot = document.getElementById('draftroom-root')
if (draftRoomRoot) {
  ReactDOM.createRoot(draftRoomRoot).render(
    <React.StrictMode>
      <DraftRoom />
    </React.StrictMode>,
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
      // Every breach* element carries index.html's --breach-start-delay (200ms)
      // on top of its own share of --breach-total, so every number below is
      // 200ms later than the design's own choreography states in isolation.
      //
      // --breach-total went 1600ms -> 2800ms because 1600ms was not long enough
      // to actually see: launch, arc, splash, settle, a water pulse, two droplet
      // waves and a closing ripple were packed into a second and a half, under
      // 400ms a beat. Reported twice as "doesn't last long enough" against a
      // production build with no load-time bottleneck to blame for it — DOM
      // interactive at ~230ms and the bundle fetched in ~55ms on a real
      // Cloudflare load, measured directly rather than assumed, so the shark's
      // own duration was the whole story, not network time eating the hold's
      // budget. 2800ms keeps every element's existing share of the sequence —
      // everything below still reads off --breach-total, the wordmark included
      // now (see index.html) — and roughly doubles its clock time, which is
      // still inside the normal range for a brand splash and short enough to
      // stay a once-per-cold-load moment rather than one anybody dreads.
      //
      //   shark       breachMark       200ms + --breach-total, no further delay -> settles/fades 3000ms
      //   wordmark    sonar-label      500ms after .4 * --breach-total delay    -> settles        1620ms
      //   ripple      breachRipple     500ms after 200ms + .88 * --breach-total -> completes       3164ms
      //   idle ring 1 sonar-ring       2100ms, 200ms + --breach-total delay     -> enters           3000ms
      //
      // breachMark's own 100% fades the shark to opacity 0, so what is on
      // screen at 3000ms is a blank instant — covered by breach-settled's
      // crossfade (see index.html), which finishes at the same 3000ms mark.
      // The ripple is the actual last arrival, completing at 3164ms; holding
      // to 3400ms leaves it room rather than cutting it off flush. A loading
      // state that never shows its own last element is not finished, it is
      // interrupted — the lesson the first version of this hold (900ms, the
      // mark alone) was written to fix, and it applies exactly as much to a
      // ripple as it did to a third ring.
      //
      // This whole hold replaces an early return that removed the element
      // outright while it was still at opacity 0 — the branch a fast load
      // always took, and the reason the loader was invisible to anyone on a
      // quick connection.
      const MIN_VISIBLE_MS = 3400
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
