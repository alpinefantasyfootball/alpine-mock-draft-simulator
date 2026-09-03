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
      // Hold for MIN_VISIBLE_MS, then leave.
      //
      // This used to say "from navigation start", and that was the bug — see
      // revealStart below, which is what it is measured from now. What follows
      // is why the number is 3100 rather than 2500; both halves matter and
      // only one of them was ever right.
      //
      // Deepwater replaced Breach II's choreography wholesale, and shortened
      // the hold from 4900ms to 2500. The composition's own timing marks,
      // from the design package:
      //
      //   specks    speckIn   0            -> 0.66s
      //   droplet   blobForm  0.46s        -> 1.01s
      //   mark      fIn       0.66s        -> 1.24s
      //   teeth     fTooth    0.90s        -> 2.07s
      //   eyes      fEye/fBloom 1.10s      -> 2.50s
      //
      // 2500 is when the REVEAL ends — the eye flicker's last frame. This hold
      // is 3100, and the 600ms difference is the point rather than slack.
      //
      // It shipped at 2500 exactly, on the reasoning that nothing finite runs
      // past 2.5s so every extra millisecond is a still frame the visitor
      // waits through. Reported by the owner off the deployed site: the splash
      // is "close but could last slightly longer". The reasoning was wrong in
      // a specific way worth keeping. Dismissing at exactly 2500 means the
      // fade begins on the same frame the flicker ends, so the finished mark
      // is never actually SEEN finished — the design package's own sentence is
      // "2.5 seconds, then the frame sits completely still until the app is
      // ready", and at 2500 there is no "then". A still frame is not waste
      // here; it is the last beat of the composition, and it was the one beat
      // that never played.
      //
      // 600ms of dead-still mark, which is long enough to register as a held
      // frame rather than a hitch before the fade. The reveal itself is
      // untouched: 2500 is inside <juke-mark variant="form">'s shadow root,
      // juke-mark.js ships unedited, and this number cannot and must not
      // retime it. What moved is how long the finished picture stays up, which
      // is this file's to decide and index.html's --total has no part in.
      //
      // Cutting BACK below 2500 is still wrong for the original reason: it
      // truncates the eye flicker, and a mark still flickering when the layer
      // fades has not ended at all.
      //
      // This whole hold replaces an early return that removed the element
      // outright while it was still at opacity 0 — the branch a fast load
      // always took, and the reason the loader was invisible to anyone on a
      // quick connection.
      //
      // Reduced motion gets 600ms, the design package's own figure. There is
      // no reveal to wait out in that branch — splash-boot.js has already
      // swapped the mark to variant="static" and the CSS has dropped the
      // specks and the droplet — so the whole of what is on screen is the
      // finished frame, and 600ms is long enough to register it as a
      // deliberate screen rather than a flash. The attribute is written by
      // splash-boot.js rather than re-derived from matchMedia here, so the
      // two files cannot disagree about what this particular load decided.
      const MIN_VISIBLE_MS = boot.hasAttribute('data-splash-reduced') ? 600 : 3100

      /* ...from when the reveal actually STARTED, which is not navigation
         start, and charging it to navigation start is a real defect rather
         than a rounding difference.

         A CSS animation is play-pending until its first rendering
         opportunity, so the composition does not begin at style resolution —
         it begins at the first painted frame. And the first painted frame is
         gated on every render-blocking stylesheet in <head>, which here
         includes a cross-origin Google Fonts request the overlay cannot use
         (it has no text in it at all — see the markup's own note on why there
         is no wordmark).

         Measured against a stub for that request at four latencies, on the
         built site: the reveal's own start time tracks first-contentful-paint
         one for one — 130ms / 172ms / 426ms / 926ms at font latencies of
         0 / 150 / 400 / 900ms. The dismissal, meanwhile, was pinned at 3100ms
         from navigation start whatever happened. So at a 900ms font fetch the
         reveal runs 926 -> 3426 and the layer began fading at 3100: the eye
         flicker, the composition's last beat, was cut off by 326ms — on
         exactly the slow connections where the splash is doing the most work.
         Past about 1200ms of pre-paint delay it starts eating the teeth
         sweep, and past ~2500 there is nothing left to see but a fade.

         That is this file's own rule about not cutting back below 2500,
         broken from a direction the number could not see. It is fixed by
         measuring the hold from the thing being held rather than from the
         clock: the composition's real start is readable off its own
         animations, so there is no second guess at it and no constant to keep
         in step with juke-mark.js.

         The cascade falls back rather than throwing: the animations, then the
         paint entry, then navigation start, which is exactly today's
         behaviour. Under reduced motion there are no animations to read — the
         mark is variant="static" and the finite layers are display:none — so
         that branch lands on the paint entry, which is the right answer there
         too and a better one than 0. */
      const revealStart = (() => {
        let earliest = Infinity
        const scan = (root) => {
          if (!root || typeof root.getAnimations !== 'function') return
          let list
          try { list = root.getAnimations({ subtree: true }) } catch (e) { return }
          for (const a of list) {
            if (a.startTime == null || !a.effect) continue
            // Ambient only: the caustics, shafts and motes run `infinite` and
            // are still going when the layer leaves, so they say nothing about
            // where the finite composition has got to.
            let d
            try { d = a.effect.getComputedTiming().activeDuration } catch (e) { continue }
            if (!isFinite(d) || d > 60000) continue
            if (a.startTime < earliest) earliest = a.startTime
          }
        }
        scan(boot)
        const mark = boot.querySelector('juke-mark')
        if (mark) scan(mark.shadowRoot)
        if (earliest !== Infinity) return earliest
        const fcp = performance.getEntriesByType('paint')
          .find((p) => p.name === 'first-contentful-paint')
        return fcp ? fcp.startTime : 0
      })()

      /* Capped so a pathologically slow first paint cannot hold the page
         hostage, and 7000 rather than a round number because it is derived:
         #boot-sonar carries `splash-boot-failsafe ... 8s`, which fades the
         overlay on its own if this teardown never runs. A hold scheduled past
         that would have the failsafe fading the layer out from under a reveal
         this code still believes it is showing — two dismissals fighting, and
         the visible one is the one nothing here can flush. 7000 leaves the
         280ms removal and a margin inside it. Move both together. */
      const leaveAt = Math.min(revealStart + MIN_VISIBLE_MS, 7000)

      setTimeout(() => {
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
      }, Math.max(0, leaveAt - performance.now()))
    }),
  )
}
