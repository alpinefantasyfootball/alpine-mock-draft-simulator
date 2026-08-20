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

/* The D1 cache. Every function in there answers "no" to a missing binding
   rather than throwing, so this file works unchanged with no database — which
   is what keeps `wrangler dev --local` and the keyless news test running. */
import { syncPlayerPool, cachedNews, storeNews, usableNews } from "./store.js";

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

  /* One socket, and it may already be gone.

     send() and relay() have always wrapped their sends, because a socket can
     die between the moment it is listed and the moment it is written to. The
     single-socket sends did not, and a WebSocket is *most* likely to be dead
     on exactly these paths: a refusal happens milliseconds after the upgrade,
     to a client that had a reason to give up. A page reconnecting in a loop -
     which live.js does on purpose - produced one uncaught "Network connection
     lost" per attempt, and an uncaught error in a Durable Object is not free
     noise: it fills the log the next real fault has to be found in.

     Silence is the right answer. The client we are trying to tell has already
     stopped listening, and there is no one else to inform. */
  tell(socket, payload) {
    try { socket.send(JSON.stringify(payload)); } catch (err) { this.sockets.delete(socket); }
  }

  reject(socket, code, detail) {
    this.tell(socket, { type: "rejected", code, detail });
    try { socket.close(1008, code); } catch (err) {}
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
      this.tell(socket, { type: "rejected", code: "too-fast" });
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
      this.tell(socket, { type: "rejected", code: result.error });
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

/* Fifteen minutes. Long enough that a draft — an hour of the same dozen
   players being opened repeatedly — costs one call each rather than dozens,
   and short enough that a Sunday-morning inactive tag still reaches somebody
   drafting that afternoon. The provider updates several times an hour, so
   past this point we would be trading real freshness for savings that are
   already most of the way banked. */
const NEWS_TTL = 900;
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
  const mapped = (Array.isArray(rows) ? rows : []).map(function (n) {
    const url = String(n.link || n.url || "").slice(0, 400);
    return {
      title: String(n.title || n.headline || "").slice(0, 200),
      summary: String(n.summary || n.description || "").slice(0, SUMMARY_MAX),
      source: sourceName(n, url),
      at: publishedAt(n),
      url: url
    };
  });

  /* One shared normalisation rather than a filter written out here, and the
     reason is in usableNews(): the cache reads its list back through the same
     filter, the same dedup and the same ordering, and any of the three
     differing means a cache hit draws different cards from a cache miss.

     It also drops a `javascript:` link before it is ever sent, which the old
     `n.title && n.url` did not: that let a card the page refuses to build
     travel all the way to the page to be refused. */
  return usableNews(mapped).slice(0, NEWS_MAX);
}

/* Who actually wrote it.

   Measured against the real feed rather than guessed: Tank01 returns a title,
   a link and an image, and no source field of any kind — so the first version
   of this fell back to naming *them* on every card, which is wrong twice over.
   They are the aggregator, not the author, and "TANK01" tells a reader
   nothing about whether to trust the line.

   The link is the honest answer, because the link is where the article
   actually lives. Parsed with URL rather than a regex, for the same reason
   cleanGif() does: a hostname is a structured thing and picking it apart by
   hand is how "espn.com.evil.example" becomes "espn.com". */
function sourceName(row, url) {
  const given = String(row.source || row.provider || "").trim();
  if (given) return given.slice(0, 60);
  try {
    return new URL(url).hostname.replace(/^www\./, "").slice(0, 60);
  } catch (err) {
    return "";
  }
}

/* When it was published, and nothing else.

   This used to fall back to `playerID`, which is not a date and never was —
   so every card on a real sheet read "TANK01 · 4429795". A field that has no
   value is empty; it does not borrow one from whatever else is lying around.
   Anything that does not look like a date is dropped rather than printed. */
function publishedAt(row) {
  const raw = String(row.published || row.date || row.publishedDate || "").trim();
  if (!raw) return "";
  return /\d{4}|\d{1,2}[/-]\d{1,2}/.test(raw) ? raw.slice(0, 40) : "";
}

async function playerNews(request, env, ctx) {
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

  /* Served from the edge cache when we have asked recently.

     Without this the provider is called once per sheet opened, and a draft is
     people opening the same dozen players over and over. The free tier is a
     thousand calls a month, so sweeping the board once — 201 players with an
     id — is a fifth of the allowance in one sitting, and two people doing it
     is most of a month. Headlines change hourly at most, so this is close to
     free in freshness and is the difference between the feature being usable
     and being rationed. */
  const cache = caches.default;
  const key = newsCacheKey(playerId);

  const hit = await cache.match(key);
  if (hit) {
    /* Rebuilt rather than returned. The cached entry deliberately carries no
       CORS headers: those depend on who is asking, and handing one origin's
       header to another is how a cache turns a per-request decision into a
       shared one. The body is the only thing worth keeping. */
    return new Response(await hit.text(),
      { headers: Object.assign({}, headers, { "x-juke-cache": "hit" }) });
  }

  /* The second tier, and the one that actually protects the allowance.

     The cache above is the *freshness* tier: fifteen minutes, and per
     colocation, so ten managers in ten cities miss it ten times over, and an
     eviction costs an upstream call whenever it happens. This one is the
     *quota* tier — one database, global, durable, twelve hours — so the worst
     case stops being "once per player per quarter hour per data centre" and
     becomes twice a player a day for everybody at once. On a thousand calls a
     month that is the difference between the feature working and the feature
     being rationed by the middle of the month.

     A D1 hit fills the edge cache on the way past, or every reader in this
     colocation would keep paying for a database round trip to learn something
     the machine they are talking to could have told them. */
  const stored = await cachedNews(env, playerId);
  if (stored) {
    const body = JSON.stringify({ configured: true, items: stored });
    after(ctx, cache.put(key, new Response(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=" + NEWS_TTL
      }
    })));
    return new Response(body,
      { headers: Object.assign({}, headers, { "x-juke-cache": "db" }) });
  }

  try {
    const items = await fetchUpstreamNews(env, playerId, env.TANK01_BASE || NEWS_BASE);
    const body = JSON.stringify({ configured: true, items });

    /* Only a real answer is kept, and an empty one counts: "he has no news
       today" is a fact worth caching, and re-asking for it every time would
       spend the allowance on exactly the players who have nothing. The catch
       below is what must never be cached — pinning an upstream blip for the
       whole TTL would turn a momentary failure into a quarter of an hour of
       silence. That is the same line `configured` already draws between "not
       wired up" and "nothing today". */
    await cache.put(key, new Response(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=" + NEWS_TTL
      }
    }));

    /* Behind the response, not in front of it. A reader is waiting on
       headlines they already have; they are not waiting on a cache whose whole
       job is to make the *next* reader faster, and a database hiccup must not
       turn an answer we successfully fetched into an error. storeNews() catches
       its own failures for the same reason. */
    after(ctx, storeNews(env, playerId, items));

    return new Response(body,
      { headers: Object.assign({}, headers, { "x-juke-cache": "miss" }) });
  } catch (err) {
    /* News failing is not worth breaking a sheet over — the same rule the
       score strip follows. `error: true` is for us; the page draws nothing
       either way. Not cached, deliberately: see above. */
    return new Response(JSON.stringify({ configured: true, items: [], error: true }),
                        { headers });
  }
}

/* The cache key, built rather than taken from the request.

   `caches.default` keys on the whole URL, and the real one carries an Origin
   header and could carry anything else a client appends. A canonical key means
   one entry per player rather than one per (player, however-you-asked), which
   is the difference between a cache that works and a cache that mostly misses.

   The host is not a real one and is never fetched; it exists because the Cache
   API wants a Request. */
function newsCacheKey(playerId) {
  return new Request("https://juke-news-cache.invalid/player/" +
                     encodeURIComponent(playerId || "none"));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/news") {
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: Object.assign({
          "access-control-allow-methods": "GET",
          "access-control-max-age": "86400"
        }, corsFor(request)) });
      }
      return playerNews(request, env, ctx);
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
  },

  /* The nightly pool refresh. Declared in wrangler.toml under [triggers].

     It is a *cache* refresh and nothing depends on it having run: the board
     comes from players.js, which scripts/build_players.py regenerates from the
     same Sleeper endpoint every morning. So this failing costs the worker a
     staler copy of a list it uses for its own lookups, and costs the app
     nothing at all — which is why syncPlayerPool() logs rather than throws.

     `waitUntil` because a scheduled handler that returns before its work is
     done has its work cancelled. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncPlayerPool(env).then(function (n) {
      // Count what was written, not what was fetched. A count that disagrees
      // with the rows underneath it is how you stop reading the log at all.
      console.log(n === null ? "player pool sync: skipped or failed"
                             : "player pool sync: " + n + " rows");
    }));
  }
};

/* Run something after the response has gone.

   Two things this has to survive, and both of them are on the news path, whose
   entire contract is that it fails by disappearing.

   **`ctx` may not be there.** A bare `ctx.waitUntil` throws when this route is
   driven from anywhere but the fetch handler, and it would throw *after* a
   perfectly good answer had been assembled.

   **The promise is never awaited, so its rejection is nobody's.** An unhandled
   rejection on a page that is otherwise fine is exactly what the catch inside
   fetchUpstreamNews() exists to prevent, and a cache write is no different: it
   is swallowed here so a caller cannot forget to. */
function after(ctx, promise) {
  const quiet = Promise.resolve(promise).catch(function (err) {
    console.error("deferred work failed:", err && err.message);
  });
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(quiet);
  return quiet;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json" }
  });
}

function safeJson(text) {
  try { return JSON.parse(text); } catch (err) { return null; }
}
