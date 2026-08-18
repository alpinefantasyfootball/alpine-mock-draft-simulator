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

export async function openApp(context, path = "#/draft") {
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
  await page.evaluate(() => window.__watchSends());
  return page;
}

export function createRoom(page) {
  return page.evaluate(async () => {
    document.getElementById("createRoomBtn").click();
    await new Promise((r) => setTimeout(r, 1500));
    return Live.state().code;
  });
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
