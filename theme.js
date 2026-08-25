/* The stored theme, applied before anything paints.

   This has to run before the body is drawn, or a reader who chose light
   watches the page flash dark first — which is why it is loaded from <head>
   with no defer and no async. It is its own file rather than an inline
   <script> so that a Content-Security-Policy can say script-src 'self' and
   mean it: the alternatives were 'unsafe-inline', which gives most of the
   policy away, or a sha256 hash in a Cloudflare rule that silently breaks
   the site the first time somebody edits these six lines and forgets it.

   Loading it costs one request against an origin the page is already
   opening a connection to, and the file is a few hundred bytes.

   Kept out of app.js deliberately: app.js is at the foot of the body, and by
   the time it runs the flash has already happened. */
(function () {
  try {
    var saved = localStorage.getItem("draftroom.theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (err) {}   // private browsing can make localStorage throw
})();

/* This file used to carry a second IIFE here, stamping data-standalone from
   matchMedia('(display-mode: standalone)') so #boot-sonar (index.html)
   could tell an installed-app cold launch apart from an ordinary browser
   visit before its CSS applied. That overlay — Sonar, then Breach — was
   scoped to the installed case only, which meant it never played on a
   regular desktop or mobile browser visit at all: reported directly, from
   someone who opened the site expecting to see it and did not. The owner
   reversed the scoping rather than the gate, so the overlay now plays on
   every cold load and nothing here needs to tell the two apart any more. */
