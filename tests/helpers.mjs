/* What the tests need from a page, and nothing about what they assert.

   Two ideas carry most of this file:

   1. A *member* is a browser context, not a tab. Two tabs on one origin share
      localStorage, so they share `juke.member`, and the room correctly treats
      them as one manager with two sockets — which tests nothing about a
      second person. Playwright contexts have their own storage, so one
      context is one manager.

   2. Everything a client sends is recorded, and so is everything it is
      refused. A room can be rejecting half of what a client sends and look
      perfectly healthy from the outside, right up until it stops: that is
      exactly how a shared draft once deadlocked at pick 86. So `__sent` and
      `__rejects` are installed before the app loads and survive a reconnect,
      because the interesting failures happen around a socket being replaced.
*/

/* Local by default, and overridable so the same specs can be pointed at what
   is actually deployed.

   The socket suite has had JUKE_WORKER since it was written, and this file not
   having the equivalent meant the one thing nobody could run was the one thing
   worth running after a deploy: a full room draft against the real worker,
   over the real CSP, through Cloudflare. Local is where a bug is found; live
   is where it is confirmed gone.

     JUKE_SITE=https://jukeff.com \
     JUKE_WORKER_HTTP=https://juke-draft-room.jukeff.workers.dev \
     npx playwright test tests/room.spec.mjs

   Note that live.js picks its worker from the address bar — localhost means
   127.0.0.1:8787 and anything else means the deployed one — so these two move
   together or the page talks to a room the assertions are not watching. */
export const SITE = process.env.JUKE_SITE || "http://localhost:8765";
export const WORKER_HTTP = process.env.JUKE_WORKER_HTTP || "http://127.0.0.1:8787";

/* What "local" means, written once and asked twice.

   Two different questions need it and they are not the same question, which
   is why both are derived here rather than each caller answering for itself.
   The config asks about the *site*, because that is what decides whether
   there are servers to start. The news suite asks about the *worker*,
   because the provider key lives there: a `wrangler dev` this suite starts
   has none and the deployed one does, so the test for the keyless path can
   only pass against the local one.

   They move together in every sane run — see the note above — but they are
   two variables, and a run that points them apart should get the honest
   answer to each rather than one of them standing in for both. */
const isLocal = (url) => url.includes("localhost") || url.includes("127.0.0.1");
export const LOCAL_SITE = isLocal(SITE);
export const LOCAL_WORKER = isLocal(WORKER_HTTP);

/* Installed before any page script runs.

   WebSocket is wrapped rather than the socket being listened to after the
   fact, because `live.js` replaces the socket on every reconnect and a
   listener attached to the first one would stop seeing anything at the
   moment things get interesting. */
function instrumentation() {
  window.__sent = [];
  window.__rejects = [];

  const RealWS = window.WebSocket;
  function Wrapped(url, protocols) {
    const ws = protocols === undefined ? new RealWS(url) : new RealWS(url, protocols);
    ws.addEventListener("message", function (e) {
      try {
        const m = JSON.parse(e.data);
        if (m.type === "rejected") window.__rejects.push(m.code);
      } catch (err) {}
    });
    return ws;
  }
  Wrapped.prototype = RealWS.prototype;
  ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k) { Wrapped[k] = RealWS[k]; });
  window.WebSocket = Wrapped;

  // Live is defined by live.js, which has not run yet, so the wrapping is a
  // function the test calls once the page is up.
  window.__watchSends = function () {
    if (window.__watching || typeof Live === "undefined") return false;
    const pick = Live.pick, auto = Live.autoPick;
    Live.pick = function (key) {
      window.__sent.push({ t: Date.now(), kind: "pick", key: key });
      return pick.apply(Live, arguments);
    };
    Live.autoPick = function (key) {
      window.__sent.push({ t: Date.now(), kind: "auto", key: key });
      return auto.apply(Live, arguments);
    };
    window.__watching = true;
    return true;
  };

  /* A stand-in manager: picks on their own turn and never on anybody else's.

     Driven by the socket rather than by a timer, deliberately. A page that is
     not the front tab has its timers throttled to about once a minute, and a
     draft that stalls because of that is the harness failing, not the app. */
  window.__playAsHuman = function () {
    const act = function () {
      const room = Live.room();
      if (!room || room.status !== "drafting") return;
      const c = DraftEngine.onTheClock(room.league, room.picks.length);
      if (!c || c.slot !== room.yourSeat) return;
      const best = suggestions()[0];
      if (best) Live.pick(best.name);
    };
    Live.state().socket.addEventListener("message", act);
    act();
  };
}

/* The legacy setup screen — readSetup(), setupProblem(), #startBtn's own
   click handler — is unchanged and still what most of these tests exercise;
   it is only hidden now, in favour of the React lobby and settings modal
   (see CLAUDE.md's "setup screen" section). Playwright's real click() and
   selectOption() wait on visibility, which a deliberately display:none
   element never satisfies — a test that needs this exact mechanism (rounds,
   bench, starters: settings the new page does not expose) drives it via
   evaluate() instead, same as it always read/wrote these ids, just without
   the actionability wait. */
export function setLegacyField(page, id, value) {
  return page.evaluate(([id, value]) => {
    const el = document.getElementById(id);
    el.value = String(value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, [id, value]);
}

export function clickLegacyStart(page) {
  return page.evaluate(() => document.getElementById("startBtn").click());
}

// Same reasoning, generalised: any id inside the hidden .setup or
// .appbar-inner subtrees (#homeBtn, #soundBtn, #themeBtn, ...) needs this
// rather than page.click(), which waits on visibility that is never coming.
export function clickHidden(page, id) {
  return page.evaluate((id) => document.getElementById(id).click(), id);
}

export async function openApp(context, path = "#/draft-room") {
  const page = await context.newPage();
  await page.addInitScript(instrumentation);
  await page.goto(`${SITE}/index.html${path}`);
  /* `state` is a top-level `const` in app.js, and `const` does not become a
     property of `window` — only `var` and an explicit assignment do. So it is
     checked unqualified, which resolves through the global scope the same way
     the app's own code does. Written as `window.state` this waits forever on
     a page that is working perfectly. */
  await page.waitForFunction(
    () => typeof state === "object" && typeof Live === "object" && typeof suggestions === "function");

  /* Then wait for the cold-load overlay to leave.

     #boot-sonar is fixed at z-index 9999 over the whole page, and since it
     started being held for a minimum of 900ms rather than removed as soon as
     React paints, it genuinely covers the page for about a second after load.
     Every test that clicks or hit-tests immediately was racing it — phone
     .spec.mjs's "nothing is sitting on top of the Start button" caught it
     first, reporting the overlay's own wordmark as the thing covering the
     button, which was true and not the bug that test exists to find.

     Handled here rather than per-test because it is not one test's problem:
     it is a property of every page load, and a person cannot click through the
     overlay either. Waiting for it is what makes a test's timing match a
     user's.

     Tolerant of the overlay not existing at all — 404.html and the docs pages
     have no loader — and of it never leaving, which is the failure sonar
     .spec.mjs owns; a hard wait here would turn that into a timeout in every
     other file instead. */
  await page
    .waitForFunction(() => !document.getElementById("boot-sonar"), null, { timeout: 12000 })
    .catch(() => {});

  await page.evaluate(() => window.__watchSends());
  return page;
}

/* Through the bridge rather than through #createRoomBtn.

   That button is in the legacy invite panel, which the full-bleed lobby no
   longer renders inline - "Draft with friends" is the settings modal's Invite
   tab now. Clicking it would mean opening a modal and switching a tab to set
   up a fixture, which is three interactions of ceremony before the thing
   under test. engine.createRoom() is what that button calls.

   Polled rather than slept on: a room is created when the worker answers, and
   how long that takes is the network's business.

   It waits for the host to be *seated*, not just for the code to exist, and
   that second condition is the whole point of this comment.

   codeInUrl() goes true the moment the worker answers with a code, because
   createRoom() writes the hash itself at that instant. The host's own seat
   arrives later, on the broadcast that follows their join. Between those two
   moments the room is real, reachable by its link, and seat 0 is still empty
   - and join() hands a new member the first free chair (freeSeat(), room.js).
   So a guest who got in during that window took the host's seat, and
   room.spec.mjs's "the guest is seat 1" failed with 0.

   Intermittent, and it read as a flake in the room rather than as a fixture
   handing out the code before it was safe to use. In life the window is
   unreachable: a person has to copy the link and send it, which is seconds,
   and the host is seated long before anyone clicks. A test hands the code
   straight to a second browser, so it hits the one race a human cannot.

   Returning "a room you are in" rather than "a code that exists" is what the
   callers all assumed they were getting anyway. */
export function createRoom(page) {
  return page.evaluate(async () => {
    window.JukeEngine.createRoom();
    for (let i = 0; i < 120 && !window.JukeEngine.codeInUrl(); i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const seated = () => {
      const room = typeof Live !== "undefined" && Live.room();
      return !!room && room.yourSeat >= 0;
    };
    for (let i = 0; i < 120 && !seated(); i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return window.JukeEngine.codeInUrl();
  });
}

/* The real path from a cold Locker to a running solo draft, through every
   screen a person actually passes through — this used to be a handful of
   near-identical copies, one per spec file, and today's own Locker
   consolidation (NewMockPanel.jsx replacing LobbyBar's old "Enter Draft
   Room" button with a single "Start mock draft" launcher, to fix a
   two-primaries bug) broke every one of them at once: each copy still
   only looked for "Enter Draft Room" — now dead text nothing renders —
   before jumping straight to "start draft"/"start for everyone", with no
   step in between for the button that actually launches a mock now.
   That's the same "second copy that drifted" failure this project's own
   code has a rule against; the fix is one helper, not seven patches.

   Playwright locators rather than a one-shot page.evaluate() query, on
   purpose: `.click()` on a text locator auto-waits for the button to
   exist and be actionable, where the old evaluate()-based check ran once,
   synchronously, and reported "no button" the instant it was a render
   frame early rather than actually wrong.

   Every step is optional except the last, checked by count() rather than
   assumed present — a page that starts already past the Locker (a room,
   or a test driving a second client) simply won't have "Start mock
   draft" to click, the same way it might not have "Enter Draft Room". */
export async function startSoloDraft(page) {
  const enter = page.locator('#draftroom-root button:text-is("Enter Draft Room")');
  if (await enter.count()) await enter.click();

  // Checked before clicking, not inferred from the click failing to start
  // a draft afterward — a disabled button and a missing one are different
  // facts, and only one of them is "this league configuration is invalid".
  // A thrown Error rather than an expect(): this file's own opening
  // comment is what the tests need from a page, not what they assert, and
  // waitForRoom() below already sets the precedent for surfacing "the
  // condition was never satisfied" this way instead.
  //
  // This check used to live on the Start button below, and had to move up
  // here with the behaviour: the Lobby's "Start mock draft" now starts the
  // draft outright, so it is the control that refuses an illegal league
  // (15 rounds against a 14-slot roster, say) and there is no second
  // button left to ask.
  const startMock = page.locator('#draftroom-root button:text-is("Start mock draft")');
  if (await startMock.count()) {
    if (!(await startMock.isEnabled())) throw new Error("the Start button refused this league");
    await startMock.click();
  }

  // Optional, like every step above it, and it did not use to be. A room
  // still has a real second Start ("Start for everyone", host-only), so
  // this stays rather than being deleted — but a solo draft is already
  // started by the time it gets here, and the locator then matches
  // nothing.
  //
  // count() rather than isEnabled() is the whole fix. No actionTimeout is
  // set in playwright.config.mjs, so isEnabled() on a locator matching
  // nothing waits for ever instead of returning false, and every spec
  // that drives a draft — grade, journey, solo — sat here until the
  // 6-minute test timeout killed it. A hang, not an assertion: nothing in
  // the output named this line, and the app was fine throughout.
  const startBtn = page.locator('#draftroom-root >> text=/Start for everyone|Start draft/');
  if (await startBtn.count()) {
    if (!(await startBtn.isEnabled())) throw new Error("the Start button refused this league");
    await startBtn.click();
  }
  await page.waitForFunction(() => state.started, null, { timeout: 15000 });
}

export function roomView(page) {
  return page.evaluate(() => {
    const room = Live.room();
    return room && {
      status: room.status,
      picks: room.picks.length,
      yourSeat: room.yourSeat,
      isHost: room.isHost,
      seats: room.seats
    };
  });
}

export function sent(page) {
  return page.evaluate(() => ({
    all: window.__sent,
    rejects: window.__rejects,
    picks: window.__sent.filter((s) => s.kind === "pick").length,
    autos: window.__sent.filter((s) => s.kind === "auto").length
  }));
}

// Polls the worker rather than a page, so it is not fooled by one client
// having a stale view of a room that has moved on without it.
export async function waitForRoom(request, code, predicate, timeoutMs = 5 * 60 * 1000) {
  const until = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < until) {
    const res = await request.get(`${WORKER_HTTP}/room/${code}/state`);
    if (res.ok()) {
      last = await res.json();
      if (predicate(last)) return last;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`room ${code} never satisfied the condition; last seen: ` +
                  JSON.stringify(last && { status: last.status, picks: last.picks.length }));
}

export function pickGaps(picks) {
  const ts = picks.map((p) => p.at);
  return ts.slice(1).map((t, i) => t - ts[i]);
}

export function median(values) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function perSeat(picks) {
  return picks.reduce(function (o, p) { o[p.slot] = (o[p.slot] || 0) + 1; return o; }, {});
}
