// The two decisions the cold-load splash has to make before its first frame.
//
// Loaded parser-blocking, immediately after #boot-sonar in web/index.html.
// Neither answer survives being late: a same-session reload would flash the
// reveal it is meant to suppress, and a reduced-motion visitor would watch the
// animation start before it was taken away. Both have to be settled while the
// element exists and nothing has painted, which is exactly one position in the
// document and this is it.
//
// It is a file rather than an inline block because _headers says
// script-src 'self'. See index.html's own note.
(function () {
  var el = document.getElementById('boot-sonar')
  if (!el) return

  // ---- 1. Is this a cold load? -------------------------------------------
  //
  // Package 01, item 6: "gate it so it does not play on warm loads,
  // client-side navigations, or refreshes within the same session."
  //
  // This is a reversal of a decision recorded in CLAUDE.md and it is worth
  // saying so out loud rather than leaving the next reader to find the
  // contradiction. The owner previously removed a skip-gate from this overlay,
  // on the measured grounds that production traffic on a fast connection never
  // saw it at all — and then reversed a second, narrower gate (installed-app
  // only) for the same reason, "an overlay restricted to installed users is an
  // overlay almost nobody sees at all."
  //
  // What makes this gate a different thing from those two: both of those hid
  // the splash from a person who had never seen it. This one hides it from a
  // person who watched it a moment ago and pressed reload. The first visit of
  // every session still plays in full, on every device and every connection
  // speed, which is the property those reversals were protecting.
  //
  // sessionStorage rather than localStorage, deliberately — per tab, cleared
  // when the tab closes, so "cold" means what a visitor would mean by it.
  //
  // Client-side navigations need no handling here at all: this file runs once
  // per document load, and every route in this app is a hash change.
  var cold = true
  try {
    cold = !sessionStorage.getItem('juke.splash.seen')
    sessionStorage.setItem('juke.splash.seen', '1')
  } catch (e) {
    // Private mode, or storage blocked outright. Treat it as a cold load and
    // play: a visitor seeing the reveal twice is a far smaller failure than a
    // visitor never seeing it, and this is the branch a privacy-hardened
    // browser takes on every single load.
    cold = true
  }

  if (!cold) {
    // Remove rather than hide. A fixed element at z-index 9999 swallows every
    // click on the page whether or not it is transparent, and leaving it in
    // the DOM would also leave main.jsx's teardown holding for a reveal that
    // is not playing. Gone before first paint is gone.
    el.remove()
    return
  }

  // ---- 2. Does it play animated? -----------------------------------------
  //
  // Package 01, item 7: under prefers-reduced-motion, render
  // <juke-mark variant="static"> on the same ground for a 600ms hold.
  //
  // This has to be a script. juke-mark.js ships unedited from the design
  // package and carries no reduced-motion handling of its own, and its
  // animations live inside a shadow root, so index.html's stylesheet cannot
  // reach them however the selector is written. Swapping the attribute is the
  // supported way to ask that element for a different thing, and it is what
  // the design package's own note asks for.
  //
  // The water, the specks and the droplet are CSS and are handled by the
  // @media block in index.html — see the comment there for why the ambient
  // layers keep their opacity while the finite ones are removed outright.
  //
  // Guarded because matchMedia is the kind of API that is present everywhere
  // and still worth not assuming: this script runs before anything else on
  // the page and a throw here leaves the overlay up for ever.
  var reduced = false
  try {
    reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  } catch (e) {
    reduced = false
  }

  if (reduced) {
    var mark = el.querySelector('juke-mark')
    // setAttribute rather than replacing the element: juke-mark observes
    // 'variant' and re-renders itself, so this is one attribute write rather
    // than a teardown and a second upgrade.
    if (mark) mark.setAttribute('variant', 'static')
    // main.jsx reads this to shorten its hold from the reveal's 2500ms to the
    // 600ms the design package asks for. An attribute on the element rather
    // than a second sessionStorage read, so the two files cannot disagree
    // about what this load decided.
    el.setAttribute('data-splash-reduced', '')
    // Nothing finite is left to start — variant="static" has no animations and
    // the CSS has dropped the specks and the droplet — so the rest of this
    // file has nothing to do.
    return
  }

  // ---- 3. Start the composition when it can be SEEN ----------------------
  //
  // A CSS animation begins at its first RENDERING opportunity, and that is not
  // the same moment the viewer first sees a frame. The browser renders the new
  // document while still presenting the previous page, so the clock starts
  // behind whatever is still on screen — and every millisecond of that is
  // composition the visitor never gets.
  //
  // Reported off the deployed site with a screen recording, and the recording
  // is unambiguous. Desktop, 2556x1348, sampled every 20ms: seven consecutive
  // frames of empty navy ground, and then the mark present at FULL SIZE in a
  // single 20ms step. No specks, no droplet, no rise. What follows plays
  // correctly — the teeth light, the eyes flicker, the frame holds and leaves
  // on time — so the composition was running the whole time. It had simply
  // spent its first ~1.2 seconds, which is the specks (0-0.66s), the droplet
  // (0.46-1.01s) and the mark's own rise (0.66-1.24s), before the browser put
  // anything on screen. The mark appearing exactly as fIn ends is the tell.
  //
  // Ruled out rather than assumed: prefers-reduced-motion produces
  // variant="static", zero finite animations and an overlay gone at 1291ms,
  // where the recording holds the mark for ~2.1s and shows the teeth light.
  //
  // WHAT THIS DOES NOT DO is fix a number. The gap is machine-dependent and
  // this environment cannot reproduce its size — measured against production
  // it is 119ms at 1600x900 and 260ms at 2560x1440, growing with viewport but
  // nowhere near the ~1.2s the recording shows. So the repair is not a
  // constant that has to be right; it is to make the composition's zero be the
  // first frame the viewer actually sees, whatever that costs on the day.
  // Rewinding to currentTime 0 also moves each animation's startTime to now,
  // which is what main.jsx measures its hold from, so the hold follows without
  // being told.
  //
  // Only when the loss is worth a rewind. A healthy load spends about 120ms
  // before first paint, which is 5% of the reveal and invisible; restarting
  // for that would be a visible jump back for no gain. REWIND_IF_SPENT is the
  // line between "a fraction nobody can see" and "the opening beats are gone".
  var REWIND_IF_SPENT = 250
  // And never late. If first paint is seconds in, the composition has either
  // already been watched or is about to collide with the overlay's own 8s
  // failsafe; restarting it there would replay a reveal the visitor has seen.
  var REWIND_DEADLINE = 4000

  var rewound = false
  function finiteAnimations() {
    var out = []
    function scan(root) {
      if (!root || typeof root.getAnimations !== 'function') return
      var list
      try { list = root.getAnimations({ subtree: true }) } catch (e) { return }
      for (var i = 0; i < list.length; i++) {
        var a = list[i]
        if (!a.effect || a.startTime == null) continue
        // The overlay's own animation is its dismissal failsafe, not part of
        // the picture — see app.js's revealEndsAt() for the same exclusion and
        // what counting it cost there.
        if (a.effect.target === el) continue
        var c
        try { c = a.effect.getComputedTiming() } catch (e) { continue }
        if (!isFinite(c.endTime) || c.endTime > 60000) continue   // ambient loops
        out.push(a)
      }
    }
    scan(el)
    var m = el.querySelector('juke-mark')
    if (m) scan(m.shadowRoot)
    return out
  }

  function startFromHere(paintedAt) {
    if (rewound) return
    var anims = finiteAnimations()
    if (!anims.length) return            // not created yet; the caller retries
    rewound = true
    if (performance.now() > REWIND_DEADLINE) return
    var earliest = Infinity
    for (var i = 0; i < anims.length; i++) {
      if (anims[i].startTime < earliest) earliest = anims[i].startTime
    }
    if (paintedAt - earliest < REWIND_IF_SPENT) return
    for (var j = 0; j < anims.length; j++) {
      try { anims[j].currentTime = 0 } catch (e) { /* leave it where it is */ }
    }
    // For main.jsx and for the tests: how much was reclaimed, and that this
    // load's composition zero is a painted frame rather than a style recalc.
    el.setAttribute('data-splash-restarted', String(Math.round(paintedAt - earliest)))
  }

  /* first-contentful-paint is presentation-based, which is exactly the event
     wanted here — it is the browser saying "the viewer has now seen
     something". Two frames after it, so the mark's own SVG has had a raster
     opportunity: the recording shows the navy ground arriving ~140ms before
     the mark does, and starting the specks into a frame the mark cannot yet
     be drawn in would trade one missing beat for another.

     The whole block is wrapped: PerformanceObserver with a paint entry type is
     everywhere this matters, and a throw here would leave the overlay running
     exactly as it does today rather than break it. */
  try {
    var po = new PerformanceObserver(function (list) {
      var e = list.getEntries()
      for (var i = 0; i < e.length; i++) {
        if (e[i].name !== 'first-contentful-paint') continue
        var at = e[i].startTime
        po.disconnect()
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            // Retry while the animations have not been created yet — the mark's
            // shadow root resolves its styles on its own schedule.
            var tries = 0
            ;(function attempt() {
              startFromHere(at)
              if (!rewound && ++tries < 30) requestAnimationFrame(attempt)
            })()
          })
        })
        return
      }
    })
    po.observe({ type: 'paint', buffered: true })
  } catch (e) { /* no observer, no rewind — today's behaviour */ }
})()
