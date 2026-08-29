/* ==========================================================
   Juke — the client side of an account

   Sign-in state, the server-side locker sync, and the one-time
   migration of a browser's local mocks into a just-created
   account. Same shape as live.js, and for the same reason: this
   file knows how to talk to the worker about who you are; it
   does not know what a good pick is, what the board looks like,
   or how anything is drawn.

   Signed-out parity is the whole point of keeping this separate
   from app.js rather than folding it in: nothing here is ever
   allowed to become a thing app.js depends on to function.
   saveDraft()/recordHistory()/readSave()/readHistory() all still
   read and write localStorage exactly as they always have — this
   file only ever adds a second destination on top, through the
   "juke:locker-saved" event app.js fires after every one of them,
   the same seam renderHeader()'s "juke:header" event already
   draws between app.js and the rest of the page. A signed-out
   visitor, or a signed-in one who is offline, never touches any
   code in this file at all on the paths that matter to a draft.
   ========================================================== */

(function (root) {
  "use strict";

  /* The raw session token, kept exactly the way live.js keeps
     MEMBER_KEY — a bearer credential in this browser's own
     localStorage, sent as a header rather than a cookie. Not a cookie
     for the reason draft-room.js's own comment gives: this worker and
     the site are different origins, and every other exchange in this
     project already goes through an explicit header/param instead of
     cookie auth. */
  const SESSION_KEY = "juke.session";
  const SESSION_HEADER = "x-juke-session";

  function sessionToken() {
    try { return localStorage.getItem(SESSION_KEY) || null; } catch (err) { return null; }
  }
  function setSessionToken(token) {
    try {
      if (token) localStorage.setItem(SESSION_KEY, token);
      else localStorage.removeItem(SESSION_KEY);
    } catch (err) {}
  }

  /* Reused from live.js rather than a second copy of the same host — see
     WORKER's own comment there for what it resolves to locally and in
     production. Read lazily, not closed over at load: this file is loaded
     after live.js (see web/index.html), but reading it inside the function
     rather than at parse time costs nothing and removes any doubt about
     load order mattering here. */
  function httpBase() {
    return ((root.Live && root.Live.WORKER) || "").replace(/^ws/, "http");
  }

  const state = {
    // loading -> signed-out | signed-in, once the initial session check
    // answers. "loading" exists so a header that reads state before that
    // first answer lands can draw neither control rather than flashing
    // "signed out" for a moment on every page load.
    status: "loading",
    account: null,        // { id, email, migratedAt } while signed in
    // Set once, right after a magic link is consumed from the URL, and
    // read-and-cleared by whichever UI shows it — see dismissNotice().
    // { type: "welcome", migratedCount } | { type: "signed-in" } |
    // { type: "auth-error", error }
    notice: null
  };

  /* A DOM event, not a single callback slot — the same shape renderHeader()
     already uses for "juke:header", and for the identical reason: more than
     one React island reads account state at once (the header's own account
     menu, the welcome/error banner, the Locker screen, each mounted
     independently), and window.addEventListener supports as many listeners
     as ask for one. A single `state.onchange = fn` slot — which is what
     this was and which live.js's own Live.onChange still is, safely,
     because exactly one consumer (app.js) ever calls it — silently orphans
     every earlier subscriber the moment a later component mounts and
     overwrites the slot: the account menu still reading "Sign in" seconds
     after a real sign-in is that bug, caught by actually loading the page
     rather than by any check that only reads state. */
  function announce() {
    window.dispatchEvent(new Event("juke:account"));
  }

  /* One fetch wrapper, the same shape live.js's own gifSearch()/news()
     already use: the worker's own origin, the session header attached
     when there is one, and a body that is always JSON or an empty object
     — a caller here never has to guard against res.json() throwing on a
     malformed or absent body. */
  async function api(path, opts) {
    const token = sessionToken();
    const headers = Object.assign({ "content-type": "application/json" }, (opts && opts.headers) || {});
    if (token) headers[SESSION_HEADER] = token;
    let res;
    try {
      res = await fetch(httpBase() + path, Object.assign({}, opts, { headers }));
    } catch (err) {
      return { status: 0, body: { ok: false, error: "network" } };
    }
    let body = null;
    try { body = await res.json(); } catch (err) {}
    return { status: res.status, body: body || {} };
  }

  /* Ask the worker whether the stored session token is still good. Called
     once at load and after sign-out/deletion, so "signed in" always means
     a session the server actually still honours — a revoked or expired
     token is cleared locally the moment this notices, rather than the UI
     going on trusting a token that will fail the next real request anyway. */
  async function refresh() {
    const token = sessionToken();
    if (!token) {
      state.status = "signed-out";
      state.account = null;
      announce();
      return;
    }
    const { body } = await api("/account/session", { method: "GET" });
    if (body.ok) {
      state.status = "signed-in";
      state.account = body.account;
    } else {
      setSessionToken(null);
      state.status = "signed-out";
      state.account = null;
    }
    announce();
  }

  async function requestLink(email) {
    const { body } = await api("/account/request-link", {
      method: "POST",
      body: JSON.stringify({ email: email })
    });
    return body; // { ok:true } | { ok:true, devToken } | { ok:false, error }
  }

  /* Pull the server's locker down and merge it into this browser's own,
     through the one bridge built for it — window.JukeEngine.adoptServerLocker,
     not a second copy of the merge logic here. Called on every sign-in
     after the first (the first migrates instead — see migrateIfNeeded()),
     and is what makes "sign in on a second browser, same locker" true:
     that device has nothing of its own to migrate, so this is the only
     step that runs for it. */
  async function pullLocker() {
    const { body } = await api("/account/locker", { method: "GET" });
    if (body.ok && root.JukeEngine) root.JukeEngine.adoptServerLocker(body);
  }

  /* The one-time adoption of this browser's local mocks, for an account
     that has never migrated before (accountForSession's migratedAt is
     null). Reads the raw local locker through window.JukeEngine rather
     than a second copy of readSave()/readHistory() in this file — the
     exact rule CLAUDE.md states about DraftEngine/PLAYERS applies just as
     hard to app.js's own storage functions. */
  async function migrateIfNeeded() {
    const engine = root.JukeEngine;
    if (!engine) return { ok: true, migratedCount: 0 };
    const local = engine.rawLocalLocker();
    if (!local.save && !local.history.length) return { ok: true, migratedCount: 0 };
    const { body } = await api("/account/migrate", {
      method: "POST",
      body: JSON.stringify(local)
    });
    return body;
  }

  /* Consuming a magic link. Never called directly by the UI — the only
     path to a token is the emailed link, auto-detected below — but
     exposed on the returned object for the same reason live.js exposes
     connect() rather than hiding it: a plain, testable function beats a
     click handler nothing else can drive. */
  async function consume(token) {
    const { body } = await api("/account/consume", {
      method: "POST",
      body: JSON.stringify({ token: token })
    });
    if (!body.ok) return body;

    setSessionToken(body.sessionToken);
    state.status = "signed-in";
    state.account = body.account;
    announce();

    if (!body.account.migratedAt) {
      const result = await migrateIfNeeded();
      // Migrating just set migratedAt server-side, so the account object
      // this function already has is one field stale — refreshed rather
      // than patched by hand, which also happens to pull down anything a
      // partial migration didn't cover (nothing should be missing, but
      // this is the identical pull every other sign-in already does, so
      // there is no reason for the first one to skip it).
      await refresh();
      return Object.assign({}, body, { migratedCount: result && result.ok ? result.migratedCount : 0 });
    }

    await pullLocker();
    return body;
  }

  async function signOut() {
    // Best-effort: a network failure here must not leave the browser
    // believing it is still signed in to a session it just tried to kill.
    await api("/account/sign-out", { method: "POST" }).catch(function () {});
    setSessionToken(null);
    state.status = "signed-out";
    state.account = null;
    announce();
  }

  /* Deletes the account and every row scoped to it, server-side — see
     deleteAccount() in worker/store.js for exactly what that covers. Local
     data (this browser's own localStorage locker) is deliberately left
     alone: deleting an account is a statement about the server copy, and
     silently erasing a person's local mocks as a side effect of it would
     be the exact "signed-out parity" promise broken from the other
     direction — a solo drafter's browser-only locker was never something
     an account was allowed to take away. */
  async function deleteAccount() {
    const { body } = await api("/account/delete", { method: "POST" });
    if (body.ok) {
      setSessionToken(null);
      state.status = "signed-out";
      state.account = null;
      announce();
    }
    return body;
  }

  function dismissNotice() {
    state.notice = null;
    announce();
  }

  /* Write-through sync while signed in. app.js knows nothing about
     accounts, sessions or fetch — it only ever fires this event, the same
     way renderHeader() fires "juke:header" for a completely different
     reason. Ignored outright while signed out, so a solo drafter's every
     save is exactly as free of network activity as it always was. */
  root.addEventListener("juke:locker-saved", function (e) {
    if (state.status !== "signed-in") return;
    const d = e.detail || {};
    if (d.kind === "save") {
      api("/account/locker", { method: "POST", body: JSON.stringify({ save: d.data }) }).catch(function () {});
    } else if (d.kind === "history") {
      api("/account/locker", { method: "POST", body: JSON.stringify({ historyEntry: d.entry }) }).catch(function () {});
    } else if (d.kind === "delete") {
      api("/account/locker/delete", { method: "POST", body: JSON.stringify({ id: d.id }) }).catch(function () {});
    }
  });

  /* A magic link lands as `?authToken=...` on the plain page URL, never on
     the hash — so this never has to know or care about app.js's own hash
     router, and applyRoute() never has to know this exists. Stripped from
     the address immediately, before the async consume() below even
     resolves, so a reload mid-flight can't resubmit an already-spent
     token. */
  (function consumeFromUrl() {
    const params = new URLSearchParams(location.search);
    const token = params.get("authToken");
    if (!token) return;

    const clean = location.pathname + location.hash;
    try { history.replaceState(null, "", clean); } catch (err) {}

    consume(token).then(function (result) {
      state.notice = result.ok
        ? (result.migratedCount ? { type: "welcome", migratedCount: result.migratedCount } : { type: "signed-in" })
        : { type: "auth-error", error: result.error || "unknown" };
      announce();
    });
  })();

  refresh();

  root.Account = {
    state: function () { return state; },
    requestLink: requestLink,
    consume: consume,
    signOut: signOut,
    deleteAccount: deleteAccount,
    refresh: refresh,
    dismissNotice: dismissNotice,
    // Re-pull the server locker into this browser's own, on demand — the
    // Draft Locker screen calls this on mount so a change made on another
    // device while this one stayed signed in shows up without requiring a
    // fresh sign-in to notice it. A no-op while signed out.
    pullLocker: function () { return state.status === "signed-in" ? pullLocker() : Promise.resolve(); }
  };
})(window);
