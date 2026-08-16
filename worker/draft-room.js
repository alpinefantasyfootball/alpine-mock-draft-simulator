/* ==========================================================
   Juke — the Durable Object behind an invite link

   One of these exists per draft room. The link a manager copies
   ends in the room's name, Cloudflare routes everyone with that
   link to this same object, and it is the only thing that
   decides what happened.

   It is deliberately thin. The rules are in draft-engine.js and
   the room is in room.js, both of which are pure and both of
   which the browser also loads — that is the whole point. Two
   managers clicking the same player a tenth of a second apart
   get one answer because there is one referee running one copy
   of the rules.

   What lives here and nowhere else:
     - sockets, and who is on the other end of each
     - storage, so a room survives the object being evicted
     - the alarm, so a clock still expires with nobody watching

   Deploying needs Node and wrangler. See worker/README.md.
   ========================================================== */

// Only the room; the engine reaches the worker through it. Both are pure,
// and the browser loads the same two files.
import Room from "../room.js";

/* How long after the last socket closes before the room is forgotten. Long
   enough that a phone locking, a tunnel, or closing a laptop for lunch does
   not destroy a draft; short enough that abandoned rooms do not accumulate
   forever. */
const IDLE_MS = 6 * 60 * 60 * 1000;   // six hours

/* What one socket may send, and how often.

   Nothing was limited: a script could open a socket and write chat until the
   room hit its storage ceiling, and every message is a Durable Object write
   plus a broadcast to everyone else in the draft.

   Forty actions per ten seconds is four a second sustained, which no person
   reaches. Typing is already throttled to one message every two seconds by
   the client, a pick happens once a turn, and the fastest real thing anyone
   does is press a reaction a few times. The limit is deliberately far above
   a real ten-person draft, because a limit that fires during somebody's
   draft is worse than the abuse it prevents.

   Counted per connection and held in memory rather than in storage: writing
   a counter to disk on every message would cost more than the messages do,
   and a limit that resets when the object is evicted is still a limit.
   Someone determined can reconnect — that is a job for a Cloudflare rate
   limiting rule on the edge, not for the room. */
const RATE_WINDOW_MS = 10000;
const RATE_MAX = 40;

export class DraftRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sockets = new Map();          // WebSocket -> member id
    this.room = null;
  }

  async load() {
    if (!this.room) this.room = await this.ctx.storage.get("room");
    return this.room;
  }

  async save() {
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.put("touched", Date.now());
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/state")) {
      await this.load();
      if (!this.room) return json({ error: "no-such-room" }, 404);
      return json(Room.viewFor(this.room, null, Date.now()));
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected a WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    await this.accept(pair[1], url);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async accept(socket, url) {
    socket.accept();

    const member = url.searchParams.get("member");
    const name = url.searchParams.get("name");
    const dataVersion = url.searchParams.get("data");

    await this.load();

    if (!this.room) {
      /* First person through the door creates the room from the settings on
         their setup screen, and becomes its host. Everyone after gets the
         room as it already is — their own settings are ignored rather than
         merged, because a draft cannot be half twelve-team. */
      const league = safeJson(url.searchParams.get("league"));
      if (!league || !league.teams) {
        return this.reject(socket, "bad-league");
      }
      this.room = Room.create({
        league: league,
        seed: Math.floor(Math.random() * 1000000),
        dataVersion: dataVersion,
        clockLength: Number(url.searchParams.get("clock") || 60),
        host: member
      });
    } else if (dataVersion && this.room.dataVersion &&
               dataVersion !== this.room.dataVersion) {
      /* The generated player list is rebuilt nightly, and the CPU wobble
         reads a player's position on the board. Someone who loaded the page
         after a rebuild would compute different CPU picks from everyone
         else and drift apart inside a round, so they are turned away with
         something they can act on rather than silently desynced. */
      return this.reject(socket, "stale-data", {
        roomVersion: this.room.dataVersion,
        yourVersion: dataVersion
      });
    }

    this.sockets.set(socket, member);

    /* Asked of the member list rather than of the seats. A drop frees the
       chair in the lobby, so "had no seat a moment ago" is true of somebody
       coming straight back as well as of somebody arriving — and since the
       page now reconnects by itself, that is every time a phone is put down.
       The record outlives the connection precisely so this can tell them
       apart. */
    const knew = !!(this.room.members && this.room.members[member]);
    const joined = Room.join(this.room, { member, name }, Date.now());
    this.room = joined.state;

    // Only for somebody actually new. A refresh reconnects and would
    // otherwise announce the same person every time their train moved.
    const seat = Room.seatOf(this.room, member);
    if (!knew && seat >= 0) {
      // The cleaned name, not the one off the query string: this goes into a
      // stored line that everybody's browser will draw.
      this.room = Room.announce(this.room,
        (Room.cleanName(name) || "A manager") + " took seat " + (seat + 1), Date.now());
    }
    await this.save();

    socket.addEventListener("message", (event) => this.onMessage(socket, event));
    socket.addEventListener("close", () => this.onClose(socket));
    socket.addEventListener("error", () => this.onClose(socket));

    this.broadcast();
    await this.scheduleAlarm();
  }

  reject(socket, code, detail) {
    socket.send(JSON.stringify({ type: "rejected", code, detail }));
    socket.close(1008, code);
  }

  /* True when this socket has had its allowance for the moment.

     A sliding count rather than a token bucket, because the window is short
     and the arithmetic should be obvious to whoever reads it next. */
  overRate(socket) {
    const now = Date.now();
    const seen = socket.__rate || { from: now, count: 0 };
    if (now - seen.from > RATE_WINDOW_MS) { seen.from = now; seen.count = 0; }
    seen.count++;
    socket.__rate = seen;
    return seen.count > RATE_MAX;
  }

  async onMessage(socket, event) {
    const member = this.sockets.get(socket);
    const msg = safeJson(event.data);
    if (!msg || !member) return;

    /* Refused, not disconnected. A client with a runaway loop should lose the
       message rather than the draft, and the rejection is the thing that
       tells it to stop. Checked before the message is even parsed for meaning,
       so a flood costs one comparison rather than a storage write. */
    if (this.overRate(socket)) {
      try { socket.send(JSON.stringify({ type: "rejected", code: "too-fast" })); } catch (err) {}
      return;
    }

    const now = Date.now();
    let result;

    /* Typing is the one thing that does not go through the room.

       It is true for about two seconds and then it is a lie, so storing it
       would mean a Durable Object write per keystroke to record something
       nobody will ever want to replay. It is relayed to the other sockets and
       forgotten — which also means it simply does not exist for anyone whose
       connection has dropped, and that is the right answer.

       The seat is looked up here rather than taken from the message, because
       a client saying "seat 4 is typing" about somebody else is not a claim
       worth honouring. */
    if (msg.type === "typing") {
      const seat = Room.seatOf(this.room, member);
      if (seat < 0) return;
      const name = (this.room.seats[seat] || {}).name || null;
      this.relay(socket, { type: "typing", seat, name, on: msg.on !== false });
      return;
    }

    switch (msg.type) {
      case "claim-seat":
        result = Room.claimSeat(this.room, { member, seat: Number(msg.seat) });
        break;
      // The host putting the room in draft order. Two seat indices and
      // nothing else — see the note on Room.swapSeats.
      case "swap-seats":
        result = Room.swapSeats(this.room, { member, a: msg.a, b: msg.b });
        break;
      case "start":
        result = Room.start(this.room, { member }, now);
        if (!result.error) result.state = Room.announce(result.state, "The draft has begun.", now);
        break;
      case "pick":
        result = Room.submitPick(this.room, { member, key: msg.key, now });
        break;
      case "auto":
        // The host standing in for an empty chair or an expired clock. The
        // room checks it is really the host and really an auto seat.
        result = Room.hostPick(this.room, { member, key: msg.key, now });
        break;
      case "pause":
        result = Room.pause(this.room, { member }, !!msg.on);
        break;
      case "chat":
        result = Room.say(this.room, { member, text: msg.text, gif: msg.gif, now });
        break;
      case "rename":
        result = Room.rename(this.room, { member, name: msg.name });
        break;
      case "react":
        result = Room.react(this.room, { member, id: Number(msg.id), emoji: msg.emoji });
        break;
      default:
        return;
    }

    if (result.error) {
      /* Sent only to the manager who tried it. A rejection is about one
         person's click, and broadcasting it would tell nine other people
         about a mistake that does not concern them. */
      socket.send(JSON.stringify({ type: "rejected", code: result.error }));
      return;
    }

    this.room = result.state;
    await this.save();
    this.broadcast();
    await this.scheduleAlarm();
  }

  async onClose(socket) {
    const member = this.sockets.get(socket);
    this.sockets.delete(socket);
    if (!member) return;

    /* Only if they have no other tab open. Two windows on one draft is a
       normal thing to do and closing one should not hand your seat to the
       CPU. */
    let stillHere = false;
    this.sockets.forEach((m) => { if (m === member) stillHere = true; });
    if (stillHere) return;

    this.room = Room.leave(this.room, { member }).state;
    await this.save();
    this.broadcast();
  }

  /* No CPU picking happens here. The host's browser does it, because the
     board is a megabyte of generated data and shipping it to a Durable
     Object to reproduce an opinion the host already has would be paying
     twice. The worker's job is to say no when the host gets it wrong.

     What the alarm still earns its place for: waking the room when a clock
     expires so every client is told, and forgetting rooms nobody came back
     to. */

  /* One alarm, set for whichever comes first: the current pick expiring, or
     the room going idle. Durable Objects get exactly one, so it is
     recomputed after anything that could change either. */
  async scheduleAlarm() {
    const now = Date.now();
    const left = Room.msLeft(this.room, now);
    const idleAt = now + IDLE_MS;
    const at = left === null ? idleAt : Math.min(now + left, idleAt);
    await this.ctx.storage.setAlarm(at);
  }

  async alarm() {
    await this.load();
    if (!this.room) return;

    const touched = (await this.ctx.storage.get("touched")) || 0;
    if (this.sockets.size === 0 && Date.now() - touched > IDLE_MS) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }

    this.broadcast();
  }

  /* Each client gets its own view, because it contains their seat and
     nobody else's member id. */
  broadcast() {
    const now = Date.now();
    this.sockets.forEach((member, socket) => {
      try {
        socket.send(JSON.stringify({
          type: "state",
          room: Room.viewFor(this.room, member, now)
        }));
      } catch (err) {
        this.sockets.delete(socket);
      }
    });
  }

  send(payload) {
    const text = JSON.stringify(payload);
    this.sockets.forEach((member, socket) => {
      try { socket.send(text); } catch (err) { this.sockets.delete(socket); }
    });
  }

  // Everyone but the sender. Being told that you are typing is noise, and
  // with two tabs open it is noise that argues with itself.
  relay(from, payload) {
    const text = JSON.stringify(payload);
    this.sockets.forEach((member, socket) => {
      if (socket === from) return;
      try { socket.send(text); } catch (err) { this.sockets.delete(socket); }
    });
  }
}

/* The routing worker. Everything under /room/<name> goes to the one object
   with that name, which is what makes an invite link work: the name is the
   only thing the link carries. */
/* Origins allowed to call the search below. The room itself does not need
   this — a WebSocket is not subject to CORS — but a plain fetch is, and an
   open proxy is somebody else's GIF quota being spent on your key. */
const ALLOWED = [
  "https://jukeff.com",
  "https://www.jukeff.com"
];

/* Whether this request is from somewhere we serve.

   Split out from corsFor() because the two do different jobs and only one of
   them is security. CORS headers tell a *browser* whether to let the page
   read a response; they do nothing about the request being made, or about a
   client that is not a browser. Withholding the header therefore stopped
   nobody: `curl -H "Origin: https://evil.example"` came back with a full set
   of results and a little more of the GIPHY quota spent. The check below is
   the one that refuses. */
function originAllowed(request) {
  const origin = request.headers.get("Origin") || "";
  return ALLOWED.indexOf(origin) >= 0 ||
         /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function corsFor(request) {
  const origin = request.headers.get("Origin") || "";
  const ok = originAllowed(request);
  return ok ? { "access-control-allow-origin": origin, "vary": "Origin" } : {};
}

/* GIPHY search, proxied.

   The key lives here and only here. In the page it would be readable by
   anyone who opened dev tools, which is the whole reason this route exists
   rather than the client calling GIPHY directly.

   With no key set it answers honestly rather than erroring: the client shows
   "GIFs are not set up" instead of a search that silently returns nothing. */
async function giphySearch(request, env) {
  const cors = corsFor(request);
  const headers = Object.assign({ "content-type": "application/json" }, cors);

  /* Refused outright, before the key is touched. This is the difference
     between a proxy that a browser will not read from and a proxy that will
     not answer — only the second one protects the quota, because anything
     that is not a browser ignores the first. */
  if (!originAllowed(request)) {
    return new Response(JSON.stringify({ error: "forbidden" }),
                        { status: 403, headers: { "content-type": "application/json" } });
  }

  if (!env.GIPHY_KEY) {
    return new Response(JSON.stringify({ configured: false, results: [] }), { headers });
  }

  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 60);
  if (!q) return new Response(JSON.stringify({ configured: true, results: [] }), { headers });

  const api = "https://api.giphy.com/v1/gifs/search?api_key=" +
              encodeURIComponent(env.GIPHY_KEY) +
              "&q=" + encodeURIComponent(q) +
              "&limit=12&rating=pg-13&bundle=messaging_non_clips";

  try {
    const res = await fetch(api);
    if (!res.ok) throw new Error("giphy " + res.status);
    const body = await res.json();

    // Only what the client draws. Passing GIPHY's whole payload through
    // would hand the page a lot of fields nobody reads and one more thing
    // to keep escaping.
    const results = (body.data || []).map(function (g) {
      const img = (g.images || {}).fixed_height_small ||
                  (g.images || {}).fixed_height || {};
      return { id: g.id, url: img.url || "", w: img.width, h: img.height,
               alt: g.title || "GIF" };
    }).filter((g) => g.url);

    return new Response(JSON.stringify({ configured: true, results }), { headers });
  } catch (err) {
    // A GIF failing is not worth breaking a draft over.
    return new Response(JSON.stringify({ configured: true, results: [], error: true }),
                        { headers });
  }
}

/* Player news, proxied.

   Same shape as the GIPHY route above and for the same reason: the key lives
   here, the origin is refused before the key is touched, and no key answers
   `configured: false` rather than an empty list, so the page can say "not set
   up" instead of showing a panel that is silently always empty.

   Two things are different, and both are about what this content *is*.

   **We normalise rather than pass through.** The client sees `{ title, source,
   at, url, summary }` and nothing else. That is partly the GIPHY argument —
   fewer fields to keep escaping — and partly that the upstream shape is not
   ours to depend on: swapping provider should be a change to one function
   here, not to the sheet.

   **We link, we do not republish.** A headline, a short summary, the source's
   name and a link back to it is what an aggregator may do; reproducing the
   body is what a licence is for. `summary` is cut hard for that reason as
   well as for layout, and `source` is never dropped — an unattributed
   headline is the version of this that is not allowed.

   TANK01_BASE exists so the tests can point this at a local stub. The real
   host is the default and nothing has to be set in production. */
const NEWS_BASE = "https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com";
const NEWS_MAX = 6;
const SUMMARY_MAX = 220;

// One upstream call, deliberately isolated. Everything above and below this
// function is ours; this is the only part that knows whose API it is.
async function fetchUpstreamNews(env, playerId, base) {
  const api = base + "/getNFLNews?fantasyNews=true&maxItems=" + NEWS_MAX +
              (playerId ? "&playerID=" + encodeURIComponent(playerId) : "&topNews=true");

  const res = await fetch(api, {
    headers: {
      "x-rapidapi-key": env.TANK01_KEY,
      "x-rapidapi-host": new URL(base).host
    }
  });
  if (!res.ok) throw new Error("news " + res.status);
  const body = await res.json();

  const rows = Array.isArray(body) ? body : (body.body || body.data || []);
  return (Array.isArray(rows) ? rows : []).map(function (n) {
    return {
      title: String(n.title || n.headline || "").slice(0, 200),
      summary: String(n.summary || n.description || "").slice(0, SUMMARY_MAX),
      // Attribution is not optional, so it falls back to the provider's own
      // name rather than to an empty string.
      source: String(n.source || n.provider || "Tank01").slice(0, 60),
      at: String(n.published || n.date || n.playerID || "").slice(0, 40),
      url: String(n.link || n.url || "").slice(0, 400)
    };
  }).filter((n) => n.title && n.url).slice(0, NEWS_MAX);
}

async function playerNews(request, env) {
  const cors = corsFor(request);
  const headers = Object.assign({ "content-type": "application/json" }, cors);

  if (!originAllowed(request)) {
    return new Response(JSON.stringify({ error: "forbidden" }),
                        { status: 403, headers: { "content-type": "application/json" } });
  }

  if (!env.TANK01_KEY) {
    return new Response(JSON.stringify({ configured: false, items: [] }), { headers });
  }

  // Whatever id the page holds, bounded. It is echoed into a URL, so it is
  // constrained here rather than trusted to be the id we think it is.
  const playerId = (new URL(request.url).searchParams.get("player") || "")
    .replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);

  try {
    const items = await fetchUpstreamNews(env, playerId, env.TANK01_BASE || NEWS_BASE);
    return new Response(JSON.stringify({ configured: true, items }), { headers });
  } catch (err) {
    /* News failing is not worth breaking a sheet over — the same rule the
       score strip follows. `error: true` is for us; the page draws nothing
       either way. */
    return new Response(JSON.stringify({ configured: true, items: [], error: true }),
                        { headers });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/news") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: Object.assign({
          "access-control-allow-methods": "GET",
          "access-control-max-age": "86400"
        }, corsFor(request)) });
      }
      return playerNews(request, env);
    }

    if (url.pathname === "/giphy") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: Object.assign({
          "access-control-allow-methods": "GET",
          "access-control-max-age": "86400"
        }, corsFor(request)) });
      }
      return giphySearch(request, env);
    }

    const match = url.pathname.match(/^\/room\/([A-Za-z0-9_-]{4,40})/);
    if (!match) return new Response("Not found", { status: 404 });

    const id = env.DRAFT_ROOM.idFromName(match[1]);
    return env.DRAFT_ROOM.get(id).fetch(request);
  }
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json" }
  });
}

function safeJson(text) {
  try { return JSON.parse(text); } catch (err) { return null; }
}
