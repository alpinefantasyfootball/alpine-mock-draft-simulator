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

/* Same file, same reason: whatever reads this has to know before body
   paints, or the thing it's deciding has already been drawn wrong once.
   #boot-sonar (index.html) is scoped to the installed app's cold launch —
   homepage v4 pass 0 — and this is the one synchronous place that can
   tell it apart from an ordinary browser visit before the CSS deciding
   its display applies. matchMedia is synchronous; nothing here waits on
   anything. navigator.standalone is the older iOS Safari signal, absent
   as a property on browsers that don't need it rather than false. */
(function () {
  try {
    var standalone = window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    if (standalone || navigator.standalone) {
      document.documentElement.setAttribute("data-standalone", "");
    }
  } catch (err) {}
})();
