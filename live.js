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

  /* Where the room lives. Localhost while wrangler dev is running, the
     deployed worker otherwise. Kept as a plain constant rather than a build
     flag, because this project has no build. */
  const WORKER = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? "ws://127.0.0.1:8787"
    : "wss://juke-draft-room.playjukeff.workers.dev";

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
    status: "off",     // off | connecting | open | closed | rejected
    reason: null,
    onchange: null,    // app.js sets this
    onchat: null
  };

  function announce() {
    if (typeof live.onchange === "function") live.onchange(live);
  }

  function active() { return !!live.socket && live.status === "open"; }

  /* The link a manager copies. Built from the page it is on, so it is right
     on jukeff.com, on localhost and in the installed app without being told
     which. */
  function link() {
    if (!live.code) return null;
    return location.origin + location.pathname + "#/draft?room=" + live.code;
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
    live.status = "connecting";
    live.reason = null;
    announce();

    const params = new URLSearchParams({
      member: memberId(),
      name: (opts && opts.name) || "",
      league: JSON.stringify((opts && opts.league) || {}),
      clock: String((opts && opts.clock) || 0),
      data: (opts && opts.dataVersion) || ""
    });

    const socket = new WebSocket(WORKER + "/room/" + code + "?" + params);
    live.socket = socket;

    socket.addEventListener("open", function () {
      live.status = "open";
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
      } else if (msg.type === "rejected") {
        /* A rejection on connect is fatal and worth showing; one during a
           draft is usually a click that lost a race, and the state that
           follows already says so. */
        live.reason = msg.code;
        if (live.status !== "open") live.status = "rejected";
        announce();
      }
    });

    socket.addEventListener("close", function () {
      if (live.socket !== socket) return;      // an old socket finishing
      if (live.status !== "rejected") live.status = "closed";
      announce();
    });

    socket.addEventListener("error", function () {
      if (live.socket !== socket) return;
      if (live.status !== "rejected") live.status = "closed";
      announce();
    });
  }

  function disconnect() {
    const socket = live.socket;
    live.socket = null;
    live.room = null;
    live.status = "off";
    live.reason = null;
    if (socket) { try { socket.close(); } catch (err) {} }
  }

  function send(payload) {
    if (!active()) return false;
    try { live.socket.send(JSON.stringify(payload)); return true; }
    catch (err) { return false; }
  }

  return root.Live = {
    WORKER: WORKER,
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

    // Intent, not action. The board changes when the room says so.
    pick:     function (key) { return send({ type: "pick", key: key }); },
    autoPick: function (key) { return send({ type: "auto", key: key }); },
    claimSeat:function (seat){ return send({ type: "claim-seat", seat: seat }); },
    start:    function ()    { return send({ type: "start" }); },
    chat:     function (text){ return send({ type: "chat", text: text }); }
  };
})(window);
