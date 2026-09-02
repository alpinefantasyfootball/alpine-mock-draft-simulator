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
  }
})()
