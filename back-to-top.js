/* ==========================================================
   Juke — back to top

   One control, shared by the app and by the how-it-works
   page. It lives in its own file rather than in app.js
   because the docs page has no reason to load the draft
   engine, and duplicating the button in two places is how
   two buttons quietly stop behaving the same way.

   Usage:  backToTop()                     // the window
           backToTop({ target: el })       // a scroll container
           backToTop({ target: el, mount: box, className: "in-sheet" })

   `target` is what scrolls. `mount` is what the button is
   appended to, and only matters when the button has to sit
   inside a positioned box rather than over the viewport.
   `showAfter` is how far it has to scroll first.
   ========================================================== */

(function (global) {
  "use strict";

  // Far enough that the button never appears on a page you can already see
  // the top of, close enough that it is there when you want it.
  //
  // It is an option rather than a constant because a box that scrolls inside
  // the page has a fraction of the page's height to scroll through. The
  // player sheet tops out around 280px of travel on a phone, so a threshold
  // measured for a full page would sit past the end of it and the button
  // would simply never appear.
  const SHOW_AFTER = 400;

  // Asked at click time rather than cached at setup, because someone can
  // change the system setting with the page still open. And it has to be
  // asked at all: a prefers-reduced-motion rule in the stylesheet does not
  // apply to a programmatic scroll that asks for "smooth" — the same reason
  // the score strip's arrows check it themselves.
  function reducedMotion() {
    return !!(global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // The window and an element disagree about how you read a scroll position
  // and about what you listen to for changes, so every difference between
  // them is settled once, here, and nothing below has to care which it got.
  function scrollerFor(target) {
    if (!target || target === global) {
      return {
        events: global,
        top: function () {
          return global.pageYOffset || document.documentElement.scrollTop || 0;
        },
        to: function (options) { global.scrollTo(options); }
      };
    }
    return {
      events: target,
      top: function () { return target.scrollTop; },
      to: function (options) { target.scrollTo(options); }
    };
  }

  function backToTop(options) {
    const opts = options || {};
    const scroller = scrollerFor(opts.target);
    const mount = opts.mount || document.body;
    const showAfter = opts.showAfter > 0 ? opts.showAfter : SHOW_AFTER;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-top" + (opts.className ? " " + opts.className : "");
    // The accessible name, since the arrow inside is a shape with no text.
    btn.setAttribute("aria-label", "Back to top");
    btn.innerHTML = '<span class="to-top-arrow" aria-hidden="true"></span>';
    // It starts hidden, and it has to say so here rather than leaving it to
    // the first sync(): that call bails out when nothing has changed, so a
    // button created in its resting state would keep a button's default
    // tabIndex of 0 and stay reachable by keyboard while invisible.
    btn.tabIndex = -1;
    btn.setAttribute("aria-hidden", "true");
    mount.appendChild(btn);

    // Visibility is three things, not one. The class drives the fade, but a
    // faded-out button is still in the tab order and still announced, so
    // tabbing into an invisible control is the failure this avoids.
    function sync() {
      const show = scroller.top() > showAfter;
      if (show === btn.classList.contains("on")) return;
      btn.classList.toggle("on", show);
      btn.tabIndex = show ? 0 : -1;
      btn.setAttribute("aria-hidden", show ? "false" : "true");
      // Scrolling back to the top hides the button. If it still held focus
      // at that moment, focus would be stranded on something invisible.
      if (!show && document.activeElement === btn) btn.blur();
    }

    btn.addEventListener("click", function () {
      scroller.to({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    });

    scroller.events.addEventListener("scroll", sync, { passive: true });
    sync();

    return {
      el: btn,
      sync: sync,
      destroy: function () {
        scroller.events.removeEventListener("scroll", sync);
        if (btn.parentNode) btn.parentNode.removeChild(btn);
      }
    };
  }

  global.backToTop = backToTop;

  /* A page with nothing to configure can ask for the default button on the
     script tag itself:

         <script src="back-to-top.js" data-auto></script>

     The how-it-works page used to do this with an inline <script>backToTop()
     </script>, which is one line of JavaScript that a Content-Security-Policy
     has to be told to allow — and allowing inline scripts means allowing the
     ones somebody else writes too. app.js still calls backToTop() directly,
     twice and with options, which is why this is opt-in rather than
     automatic.

     document.currentScript is the tag being executed, and is only valid
     while that is happening, so it is read now rather than inside the
     listener. */
  var here = document.currentScript;
  if (here && here.hasAttribute("data-auto")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { backToTop(); });
    } else {
      backToTop();
    }
  }
})(window);
