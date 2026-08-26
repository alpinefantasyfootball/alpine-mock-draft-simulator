/* ==========================================================
   Juke — the client side of a shared draft

   One socket to one room. This file knows how to connect,
   what to send, and how to hand the answer back to app.js. It
   does not know what a good pick is, what the board looks like
   or how anything is drawn.

   The important thing it does is give up authority. In a solo
   draft the browser decides what happened; in a room it asks
   and waits. So every action here is a message, and the board
   only changes when the room says it did — which is what makes
   two people clicking the same player resolve to one pick
   instead of two different boards.
   ========================================================== */

(function (root) {
  "use strict";

  /* Where the room lives.

     Localhost is detected rather than configured, so `wrangler dev` and a
     local server work together with nothing to change.

     Anywhere else needs the deployed worker's host, which is
     <worker-name>.<your-subdomain>.workers.dev and is printed by
     `wrangler deploy`. It is blank until that has happened, and blank is
     treated as "not set up" rather than guessed at — a wrong host fails as a
     socket that never opens, which looks exactly like a bug.

     A plain constant rather than a build flag, because this project has no
     build. */
  const WORKER_HOST = "juke-draft-room.jukeff.workers.dev";

  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const WORKER = LOCAL ? "ws://127.0.0.1:8787" : "wss://" + WORKER_HOST;

  // False when there is nowhere to connect to, so the invite box can say so
  // instead of offering a button that opens a socket into nothing.
  function configured() { return LOCAL || !!WORKER_HOST; }

  /* Who you are, to a room. Not an account: a random id kept in this
     browser so a refresh returns you to your own seat rather than taking a
     new one. Nothing about it identifies a person, and it never leaves for
     anywhere but the room you are in. */
  const MEMBER_KEY = "juke.member";

  function memberId() {
    let id = null;
    try { id = localStorage.getItem(MEMBER_KEY); } catch (err) {}
    if (!id) {
      id = "m" + Math.random().toString(36).slice(2, 10) +
           Math.random().toString(36).slice(2, 6);
      try { localStorage.setItem(MEMBER_KEY, id); } catch (err) {}
    }
    return id;
  }

  /* What you are called, to a room. Kept here rather than asked for every
     time, because typing your own name into every draft is the kind of small
     tax that ends with everybody called "Seat 4".

     Still not an account. It travels with the member id, it is only ever sent
     to the room you are in, and the room cleans it before anybody sees it —
     the length limit below is a courtesy to the field, not the check. */
  const NAME_KEY = "juke.name";
  const NAME_MAX = 20;

  function myName() {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch (err) { return ""; }
  }

  function setMyName(value) {
    const name = String(value == null ? "" : value).trim().slice(0, NAME_MAX);
    try {
      if (name) localStorage.setItem(NAME_KEY, name);
      else localStorage.removeItem(NAME_KEY);
    } catch (err) {}
    // Only if there is a room to tell. Setting it on the setup screen before
    // creating one is normal, and connect() sends it.
    send({ type: "rename", name: name });
    return name;
  }

  /* Room codes are short enough to read out over the phone and long enough
     that guessing one is not worth anyone's afternoon. No vowels, so it
     cannot accidentally spell something, and no characters that argue with
     each other in a sans-serif — no 0/O, no 1/l/I. */
  const CODE_ALPHABET = "BCDFGHJKMNPQRSTVWXYZ23456789";

  function newCode() {
    let out = "";
    const bytes = new Uint8Array(8);
    (root.crypto || {}).getRandomValues
      ? root.crypto.getRandomValues(bytes)
      : bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
    for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    return out;
  }

  const live = {
    code: null,
    socket: null,
    room: null,        // the last view the room sent
    status: "off",     // off | connecting | reconnecting | open | closed | rejected
    reason: null,
    wanted: false,     // are we meant to be in a room right now
    opts: null,        // what connect() was called with, so a retry can repeat it
    onchange: null,    // app.js sets this
    onchat: null,
    ontyping: null
  };

  /* A socket is not a connection you open once.

     A phone closes one the moment the browser stops being the front app, and
     the first thing anybody does after creating a room is leave the browser
     to send the link. So the drop is not an edge case — it is the normal path
     through the feature, and it used to be permanent: nothing here reopened a
     socket, and `live.room` was kept, so the page went on showing an invite
     box, a seat list and a chat window for a room it could no longer reach.

     Backoff because a worker that is actually down should not be asked ten
     times a second, and capped because a draft is a thing people are sitting
     and waiting on. */
  const RETRY_MS = [1000, 2000, 4000, 8000, 15000];
  let retryStep = 0;
  let retryTimer = null;

  function stopRetry() {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  }

  function scheduleRetry() {
    if (!live.wanted || retryTimer) return;
    const wait = RETRY_MS[Math.min(retryStep, RETRY_MS.length - 1)];
    retryStep++;
    retryTimer = setTimeout(function () { retryTimer = null; open(); }, wait);
  }

  /* Coming back to the tab is the strongest signal there is that a dropped
     socket should be retried now rather than in eight seconds, and it is
     exactly the moment it happens — the manager has just come back from
     their messages app having sent the link.

     readyState is checked as well as our own status, because a socket that
     was suspended with the page can report open while being dead: the close
     event arrives late, or never. */
  function awake() {
    if (!live.wanted) return;
    if (live.socket && live.socket.readyState === 1 && live.status === "open") return;
    stopRetry();
    retryStep = 0;
    open();
  }

  function announce() {
    if (typeof live.onchange === "function") live.onchange(live);
  }

  function active() { return !!live.socket && live.status === "open"; }

  /* The link a manager copies. Built from the page it is on, so it is right
     on jukeff.com, on localhost and in the installed app without being told
     which. Reads live.code directly rather than re-parsing location.hash
     (see codeInUrl() below) — the two answer different questions. codeInUrl()
     is "did the address bar just hand me a room to join", which is only ever
     true on #/draft-room?room=... itself. This is "what room am I in", which
     stays true wherever the app's own navigation takes the tab afterwards —
     the Lobby included, which is where the Draft Room's own invite popover
     shows it. Built off #/draft-room directly now, not the retired #/draft
     — applyRoute() still redirects the old route, so an old copied link
     keeps working, but a link generated today has no reason to take that
     hop. */
  function link() {
    if (!live.code) return null;
    return location.origin + location.pathname + "#/draft-room?room=" + live.code;
  }

  function codeInUrl() {
    const q = location.hash.split("?")[1] || "";
    const m = /(?:^|&)room=([A-Za-z0-9_-]{4,40})/.exec(q);
    return m ? m[1] : null;
  }

  /* league and clock are only read when the room does not exist yet: the
     first person through the door sets the shape and everyone after is
     joining a draft that already has one. */
  function connect(code, opts) {
    disconnect();

    live.code = code;
    live.opts = opts || {};
    live.wanted = true;
    live.reason = null;
    open();
  }

  /* Opening the socket, which connect() does once and a retry does again.
     Split from connect() because a reconnection must not clear `live.room`:
     that is the last thing the room said, everything on the page is drawn
     from it, and throwing it away to reopen a socket would blank the seat
     list and the whole chat log for the second the socket takes to come
     back. */
  function open() {
    const opts = live.opts || {};

    const existing = live.socket;
    live.socket = null;
    if (existing) { try { existing.close(); } catch (err) {} }

    // "reconnecting" only when there is something to reconnect to, so the
    // first attempt still reads as connecting rather than as a fault.
    live.status = live.room ? "reconnecting" : "connecting";
    announce();

    const params = new URLSearchParams({
      member: memberId(),
      // The stored name unless the caller has a better one, so following an
      // invite link lands you in the room already called something.
      name: opts.name || myName(),
      league: JSON.stringify(opts.league || {}),
      clock: String(opts.clock || 0),
      data: opts.dataVersion || ""
    });

    const socket = new WebSocket(WORKER + "/room/" + live.code + "?" + params);
    live.socket = socket;

    socket.addEventListener("open", function () {
      live.status = "open";
      // The ladder starts again from the bottom, so a draft that drops once
      // an hour never works its way up to a fifteen-second wait.
      retryStep = 0;
      announce();
    });

    socket.addEventListener("message", function (event) {
      let msg;
      try { msg = JSON.parse(event.data); } catch (err) { return; }

      if (msg.type === "state") {
        live.room = msg.room;
        announce();
      } else if (msg.type === "chat") {
        if (typeof live.onchat === "function") live.onchat(msg);
      } else if (msg.type === "typing") {
        /* Never part of the room view, and deliberately. Somebody typing is
           true for about two seconds; putting it in the state everybody
           stores would mean writing a keystroke to disk. */
        if (typeof live.ontyping === "function") live.ontyping(msg);
      } else if (msg.type === "rejected") {
        /* A rejection on connect is fatal and worth showing; one during a
           draft is usually a click that lost a race, and the state that
           follows already says so. */
        live.reason = msg.code;
        if (live.status !== "open") {
          live.status = "rejected";
          // Being turned away is an answer, not a failure to reach anyone.
          // Retrying it would ask the same question every second forever.
          live.wanted = false;
          stopRetry();
        }
        announce();
      }
    });

    // One handler for both, because a socket that errors closes immediately
    // after and the second event would otherwise schedule a second retry.
    const gone = function () {
      if (live.socket !== socket) return;      // an old socket finishing
      live.socket = null;
      if (live.status === "rejected") return;
      live.status = live.room ? "reconnecting" : "closed";
      announce();
      scheduleRetry();
    };

    socket.addEventListener("close", gone);
    socket.addEventListener("error", gone);
  }

  /* Leaving on purpose. `wanted` goes false first, so the close event this
     causes is not mistaken for a drop and retried. */
  function disconnect() {
    const socket = live.socket;
    live.wanted = false;
    live.opts = null;
    stopRetry();
    retryStep = 0;
    live.socket = null;
    live.room = null;
    // The code goes too. It is "the room we are in", not "the last room we
    // saw", and anything asking whether we are already in a given room gets
    // the wrong answer from a code that outlived its socket.
    live.code = null;
    live.status = "off";
    live.reason = null;
    if (socket) { try { socket.close(); } catch (err) {} }
  }

  function send(payload) {
    if (!active()) return false;
    try { live.socket.send(JSON.stringify(payload)); return true; }
    catch (err) { return false; }
  }

  /* The two moments a dropped socket is worth retrying immediately rather
     than on the ladder: the tab coming back to the front, and the network
     coming back at all. Registered once, for the life of the page, and both
     do nothing unless we are supposed to be in a room. */
  if (root.document) {
    root.document.addEventListener("visibilitychange", function () {
      if (!root.document.hidden) awake();
    });
  }
  root.addEventListener("online", awake);
  root.addEventListener("pageshow", awake);

  return root.Live = {
    WORKER: WORKER,
    configured: configured,
    memberId: memberId,
    newCode: newCode,
    codeInUrl: codeInUrl,
    link: link,
    active: active,
    state: function () { return live; },
    room: function () { return live.room; },
    status: function () { return live.status; },
    reason: function () { return live.reason; },
    connect: connect,
    disconnect: disconnect,

    onChange: function (fn) { live.onchange = fn; },
    onChat: function (fn) { live.onchat = fn; },
    onTyping: function (fn) { live.ontyping = fn; },

    name: myName,
    setName: setMyName,
    NAME_MAX: NAME_MAX,

    // Intent, not action. The board changes when the room says so.
    pick:     function (key) { return send({ type: "pick", key: key }); },
    autoPick: function (key) { return send({ type: "auto", key: key }); },
    claimSeat:function (seat){ return send({ type: "claim-seat", seat: seat }); },
    // Draft order, set by the host in the lobby. Indices only: this end has
    // never been told anybody else's member id and does not need one.
    swapSeats:function (a, b){ return send({ type: "swap-seats", a: a, b: b }); },
    start:    function ()    { return send({ type: "start" }); },
    /* The room owns the countdown, so pausing it is a message like any other.
       It used to be a purely local flag, which stopped nothing: the room went
       on counting and handed the seat to the CPU while the header said
       "Paused". The room refuses it from anyone but the host. */
    pause:    function (on)  { return send({ type: "pause", on: !!on }); },
    chat: function (text, gif) { return send({ type: "chat", text: text, gif: gif || null }); },
    react: function (id, emoji) { return send({ type: "react", id: id, emoji: emoji }); },

    /* Sent on a leading edge and then not again until it lapses — see
       app.js. A message per keystroke would be a message per keystroke for
       everybody else in the room too. */
    typing: function (on) { return send({ type: "typing", on: !!on }); },

    /* GIPHY search, through the worker. The key is server-side, so this
       is a plain fetch to our own origin rather than a call to GIPHY. */
    gifSearch: function (q) {
      const http = WORKER.replace(/^ws/, "http");
      return fetch(http + "/giphy?q=" + encodeURIComponent(q))
        .then((r) => r.json())
        .catch(() => ({ configured: false, results: [] }));
    },

    /* Player news, through the worker, for the same reason as the GIFs: the
       key is server-side.

       It lives in live.js because this is the file that knows where the
       worker is, and nowhere else does — but note it has nothing to do with
       being in a room. A solo draft opening a player sheet calls this, and
       should: news is not a shared-draft feature, it is a player-profile one.

       A rejected promise here would surface as an unhandled rejection on a
       page that is otherwise fine, so the catch is the contract rather than
       politeness. Offline, blocked, or no worker at all all arrive at the
       same answer: nothing to show. */
    news: function (playerId) {
      const http = WORKER.replace(/^ws/, "http");
      return fetch(http + "/news?player=" + encodeURIComponent(playerId || ""))
        .then((r) => r.json())
        .catch(() => ({ configured: false, items: [] }));
    }
  };
})(window);
