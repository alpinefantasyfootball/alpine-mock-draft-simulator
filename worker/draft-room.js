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

    const joined = Room.join(this.room, { member, name }, Date.now());
    this.room = joined.state;
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

  async onMessage(socket, event) {
    const member = this.sockets.get(socket);
    const msg = safeJson(event.data);
    if (!msg || !member) return;

    const now = Date.now();
    let result;

    switch (msg.type) {
      case "claim-seat":
        result = Room.claimSeat(this.room, { member, seat: Number(msg.seat) });
        break;
      case "start":
        result = Room.start(this.room, { member }, now);
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
        result = Room.pause(this.room, !!msg.on);
        break;
      case "chat":
        return this.onChat(member, msg);
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

  onChat(member, msg) {
    const text = String(msg.text || "").slice(0, 500);
    if (!text.trim()) return;
    const seat = Room.seatOf(this.room, member);
    this.send({
      type: "chat",
      seat: seat,
      name: (this.room.members[member] || {}).name || null,
      text: text,
      gif: msg.gif ? String(msg.gif).slice(0, 500) : null,
      at: Date.now()
    });
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
}

/* The routing worker. Everything under /room/<name> goes to the one object
   with that name, which is what makes an invite link work: the name is the
   only thing the link carries. */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
