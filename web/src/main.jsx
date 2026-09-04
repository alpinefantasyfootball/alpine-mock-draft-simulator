import React from 'react'
import ReactDOM from 'react-dom/client'
import { createPortal } from 'react-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import AppHeader from './components/AppHeader.jsx'
import DraftRoom from './components/DraftRoom.jsx'
import AuthBridge from './components/AuthBridge.jsx'
import { CLERK_PUBLISHABLE_KEY, CLERK_APPEARANCE } from './clerkConfig.js'
import './index.css'

// #root, #appbar-root and #draftroom-root are three separate DOM nodes,
// which used to mean three separate ReactDOM.createRoot() calls, each
// wrapped in its own <ClerkProvider> so AccountButtons (SiteNav.jsx, which
// renders inside all three) had Clerk context wherever it landed. That
// shipped and crashed the whole page: @clerk/clerk-react hard-limits to
// exactly one <ClerkProvider> per page — a module-level singleton counter
// with maxCount = 1, nothing in ClerkProvider's own public props raises it
// — so "one provider per independent root" was never a supported pattern,
// three of them threw "multiple <ClerkProvider> components", and the
// throw took down React's own boot before anything painted. Verified
// directly against the installed package (web/node_modules/@clerk/
// clerk-react/dist/index.js's useMaxAllowedInstancesGuard), not assumed a
// second time.
//
// The fix is one React tree instead of three. A single
// ReactDOM.createRoot() at #root carries the one and only ClerkProvider;
// AppHeader and DraftRoom mount into their own DOM nodes via
// createPortal() rather than their own createRoot() call. A portal
// changes *where* a subtree paints, never which tree or which context it
// belongs to — so all three now share one ClerkProvider (and are
// otherwise one ordinary React application, one StrictMode boundary
// included) while still rendering into the same three places in the page
// app.js already expects and touches unconditionally.
const appbarRoot = document.getElementById('appbar-root')
const draftRoomRoot = document.getElementById('draftroom-root')

/* The portals mount a tick after hydration rather than during it, and that
   delay is the whole point.

   React hydrates a portal's children against whatever is ALREADY in the
   container createPortal() names — it does not treat a portal as a fresh
   mount just because its container sits outside the hydrating root.
   scripts/prerender.mjs only ever fills #root (entry-server.jsx exports
   App and nothing else), so #appbar-root and #draftroom-root are empty in
   the served HTML while the client tree renders AppHeader and DraftRoom
   into them. React looked for that markup, found none, and failed:

     Warning: Expected server HTML to contain a matching <div> in <div>.
         at div
         at AppHeader
     Hydration failed because the initial UI does not match what was
     rendered on the server.
     There was an error while hydrating... the entire root will switch to
     client rendering.

   Which is worse than it sounds. A hydration failure is not scoped to the
   subtree that caused it — React discards the server markup for the WHOLE
   root and rebuilds all of it on the client. So the prerender, whose
   entire job is to put hero pixels on screen before this module has
   parsed, was being thrown away on every single load of the site. It cost
   nothing visible, which is exactly why it survived: the page still looked
   right, just built the slow way.

   Rendering null on the first pass makes the client's hydration render
   match the server's markup exactly — no portals on either side — and the
   effect then mounts them normally, as a plain client render into empty
   containers, which is what they always were. The alternative is to teach
   the prerender to fill all three containers, which is a much larger
   change to entry-server.jsx and buys nothing: neither of these two
   components has anything to show before window.JukeEngine exists.

   This has to stay inside the one tree rather than becoming its own
   createRoot() call — see the ClerkProvider note above. */
function DeferredPortals() {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <>
      {appbarRoot && createPortal(<AppHeader />, appbarRoot)}
      {draftRoomRoot && createPortal(<DraftRoom />, draftRoomRoot)}
    </>
  )
}

// Only wraps when a key exists. entry-server.jsx's Node prerender pass
// never has one (there's no window there, which Clerk's frontend JS
// reaches for throughout), and a real browser with no key configured is
// just a clone or CI run that hasn't set one up — AccountButtons' own
// fallback (unchanged today's button) covers that case without a
// provider at all, the same "answer no to a missing binding" contract
// store.js already uses for D1/GIPHY/Tank01. AuthBridge is skipped
// outright in that branch for the same reason: useAuth() throws without
// a ClerkProvider ancestor, and there is nothing for it to bridge yet.
const tree = (
  <React.StrictMode>
    {CLERK_PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} appearance={CLERK_APPEARANCE}>
        <AuthBridge />
        <App />
        <DeferredPortals />
      </ClerkProvider>
    ) : (
      <>
        <App />
        <DeferredPortals />
      </>
    )}
  </React.StrictMode>
)

// scripts/prerender.mjs (homepage v4 pass 0) fills #root with real,
// server-rendered markup as part of `npm run build` — see its own header
// comment for what App renders without a window.JukeEngine to read.
// hydrateRoot() attaches to that markup instead of discarding and
// re-rendering it, which is the entire point: the browser already has
// pixels for the hero before this module has even finished parsing.
//
// A portal contributes no DOM nodes to its own tree's root container —
// its content appears in whatever node createPortal() names, not in
// #root — so what #root's own markup has to match is still exactly what
// <App/> renders, the same as before this file carried any of them.
//
// That sentence used to end "...so AppHeader/DraftRoom joining this tree
// changes nothing about hydration", and that second half was wrong. It is
// a true statement about #root's DOM and a false one about hydration:
// React hydrates each portal against ITS OWN container too, and both of
// those are empty in the served HTML, which failed the whole root on
// every load. See DeferredPortals above. Whether a portal's content is
// hydrated or freshly mounted is a separate question from which container
// its nodes land in, and only the second one is obvious from reading
// createPortal().
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
if (rootEl.innerHTML.trim()) {
  ReactDOM.hydrateRoot(rootEl, tree)
} else {
  ReactDOM.createRoot(rootEl).render(tree)
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
      // Hold for MIN_VISIBLE_MS from the START PASS, then leave.
      //
      // splash-boot.js applies every finite layer's animation in one pass and
      // stamps the element with data-splash-started-at when it does — see its
      // own note. That stamp is the composition's zero, and it is a frame the
      // viewer has actually seen rather than a style recalculation they have
      // not.
      //
      // This replaces reading the zero back off the animations themselves.
      // That worked, but it was inferring a moment another file already knew
      // exactly, and it kept picking up #boot-sonar's own dismissal failsafe
      // as though it were part of the picture — an animation whose 600ms
      // duration passes every filter because the eight seconds is delay. It
      // cost a silent 247ms truncation once already.
      //
      // 2700ms, from the design package: the reveal's own last frame is the
      // eye bloom settling at 2650ms and it holds to 2700. The package is
      // explicit that it "ends on a hold, so a slow boot just holds longer" —
      // never cut it mid-reveal, and never extend it with a loop.
      //
      // Reduced motion gets 600ms, the package's own figure. There is no
      // reveal to wait out in that branch: splash-boot.js has swapped the mark
      // to variant="static" and never runs the start pass, so what is on
      // screen is the finished frame from the moment it paints.
      const MIN_VISIBLE_MS = boot.hasAttribute('data-splash-reduced') ? 600 : 2700

      /* When the composition began, or null while it has not. Reduced motion
         never starts a pass, so that branch falls back to the paint entry —
         which is the right zero for it, and a better one than navigation
         start, because a 600ms hold measured from a clock the viewer cannot
         see is a hold that can already be over when the frame arrives. */
      const readStart = () => {
        const stamped = boot.getAttribute('data-splash-started-at')
        if (stamped !== null) {
          const n = Number(stamped)
          if (isFinite(n)) return n
        }
        if (!boot.hasAttribute('data-splash-reduced')) return null
        const fcp = performance.getEntriesByType('paint')
          .find((p) => p.name === 'first-contentful-paint')
        return fcp ? fcp.startTime : 0
      }


      const dismiss = () => {
      const shown = getComputedStyle(boot).opacity

      boot.style.opacity = shown
      boot.style.animation = 'none'
      void boot.offsetHeight // flush: provably at `shown`, with nothing animating

      boot.style.opacity = ''
      boot.setAttribute('data-sonar-out', '')
      // 280 against a 260ms transition: the element leaves the DOM a frame
      // after the transition ends, never during it. A fixed overlay at
      // z-index 9999 swallows every click on the page, so the one thing that
      // must not happen is this element outliving the load - not a few spare
      // milliseconds. Both numbers moved together when the design package set
      // the dismissal at 260ms (it was 220/240); keep the gap if either does.
      setTimeout(() => boot.remove(), 280)
      }

      /* Re-read rather than schedule once, because the reveal's zero can MOVE
         after this runs.

         splash-boot.js restarts the composition at the first painted frame
         when the browser has spent a meaningful part of it before presenting
         anything — see its own note for the recording that made that
         necessary. Rewinding sets each animation's startTime to that moment,
         so a hold computed here beforehand would be short by exactly the
         amount that was reclaimed, and the reveal would be cut off again at
         the far end. Nothing about the ordering of the two files is worth
         relying on: this asks the animations again on every tick, and a rewind
         simply moves the target.

         Capped at 120ms so a rewind is picked up within a frame or two rather
         than at the end of a single long sleep.

         The 7000 ceiling is derived rather than round: #boot-sonar carries
         `splash-boot-failsafe ... 8s`, which fades the overlay on its own if
         this teardown never runs. A hold scheduled past that would have the
         failsafe fading the layer out from under a reveal this code still
         believes it is showing — two dismissals fighting, and the visible one
         is the one nothing here can flush. 7000 leaves the 280ms removal and a
         margin inside it. Move both together. */
      const tick = () => {
        const startedAt = readStart()
        /* Not started yet. Wait rather than guess — splash-boot.js holds the
           pass until the mark is mounted AND a frame has been presented, and
           dismissing against a zero that has not happened is exactly the
           truncation this whole area keeps producing. Its own 4000ms deadline
           guarantees this resolves, and the 7000 ceiling below catches the
           case where that file never ran at all. */
        if (startedAt === null) {
          if (performance.now() > 7000) { dismiss(); return }
          setTimeout(tick, 60)
          return
        }
        const leaveAt = Math.min(startedAt + MIN_VISIBLE_MS, 7000)
        const wait = leaveAt - performance.now()
        if (wait <= 0) { dismiss(); return }
        setTimeout(tick, Math.min(wait, 120))
      }
      tick()
    }),
  )
}
