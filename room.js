/* ==========================================================
   Juke — the room

   One shared mock draft: who is sitting where, what has been
   picked, whose turn it is, and how long they have left.

   Pure, like draft-engine.js and for the same reason. Every
   function takes a room and returns a new one; nothing here
   opens a socket, reads a clock or touches storage. The
   Cloudflare Worker in worker/ is a thin adapter that receives
   messages, calls these, and broadcasts the result.

   Two rules make it testable and make a room reproducible:

   - The current time is always passed in, never read. A room
     that calls Date.now() cannot be replayed, and replay is how
     a late joiner catches up and how a bug gets diagnosed.

   - Choosing a player for an absent manager is passed in too.
     That decision needs the board, which is a megabyte of
     generated data the room has no business holding.

   Everything is JSON-serializable, because the whole room has
   to survive being written to storage between messages.
   ========================================================== */

(function (root, factory) {
  const api = factory(
    typeof require === "function" ? require("./draft-engine.js") : root.DraftEngine
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Room = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Engine) {
  "use strict";

  const VERSION = 1;

  const ERR = {
    NOT_IN_LOBBY:  "not-in-lobby",
    NOT_DRAFTING:  "not-drafting",
    NO_SUCH_SEAT:  "no-such-seat",
    SEAT_TAKEN:    "seat-taken",
    NOT_YOUR_SEAT: "not-your-seat",
    ALREADY_SEATED:"already-seated",
    EMPTY_MESSAGE: "empty-message",
    NOT_STARTED:   "not-started",
    NO_SUCH_LINE:  "no-such-line",
    BAD_REACTION:  "bad-reaction"
  };

  function fail(state, code) { return { state: state, error: code }; }
  function ok(state)         { return { state: state, error: null }; }

  // Rooms are copied rather than mutated, so a rejected action cannot leave
  // half a change behind and a caller can always keep the previous state.
  function clone(state) { return JSON.parse(JSON.stringify(state)); }

  /* ---- creating ------------------------------------------- */

  /* dataVersion pins the generated player list. The files are rebuilt
     nightly, and the CPU wobble reads a player's position on the board, so
     two people on different builds would get different CPU picks and drift
     apart inside a round. The room records which build it started on and
     the adapter refuses a client that disagrees. */
  function create(opts) {
    const teams = opts.league.teams;
    const seats = [];
    for (let i = 0; i < teams; i++) {
      seats.push({ member: null, name: null, auto: true });
    }

    return {
      v: VERSION,
      league: JSON.parse(JSON.stringify(opts.league)),
      dataVersion: opts.dataVersion || null,
      seed: opts.seed || 0,
      host: opts.host || null,
      status: "lobby",
      seats: seats,
      picks: [],
      clockLength: opts.clockLength === undefined ? 60 : opts.clockLength,
      pickStartedAt: null,
      paused: false,
      chat: [],
      chatSeq: 0,          // see nextId(): ids outlive their position
      members: {}          // member id -> { name, seat|null, seen }
    };
  }

  /* ---- people ---------------------------------------------

     A name is the one thing in a room that a person types about themselves,
     and it is drawn beside every message they send and on their chair. So it
     is cleaned here, on the server, rather than trusted from the client:
     the page that submitted it is not the only page that will draw it.

     Control characters go first. They are invisible, they survive HTML
     escaping — which is about `<` and `&`, not about a backspace — and a
     newline in a name breaks the line it sits on for everybody in the room. */
  const NAME_MAX = 20;

  function cleanName(value) {
    if (value == null) return null;

    // Read a bounded amount before doing any work. The name arrives on a
    // query string, and nothing says it has to be short.
    const raw = String(value).slice(0, NAME_MAX * 10);
    let out = "";

    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);

      /* Tabs and line breaks become a space rather than vanishing. Dropping
         them turns "Chase\nCantwell" into "ChaseCantwell", which is not a
         sanitised name — it is a different one. */
      if (code === 9 || (code >= 10 && code <= 13)) { out += " "; continue; }

      // Everything else invisible is simply not part of a name.
      if (code < 32 || (code >= 127 && code < 160)) continue;

      out += raw.charAt(i);
    }

    // Collapsed and trimmed before the cut, so the limit counts characters
    // somebody will actually see.
    return out.replace(/\s+/g, " ").trim().slice(0, NAME_MAX) || null;
  }

  function seatOf(state, member) {
    for (let i = 0; i < state.seats.length; i++) {
      if (state.seats[i].member === member) return i;
    }
    return -1;
  }

  function freeSeat(state) {
    for (let i = 0; i < state.seats.length; i++) {
      if (!state.seats[i].member) return i;
    }
    return -1;
  }

  /* Joining takes the first free seat, because someone who followed an
     invite link wants to be in the draft, not to be asked which chair. A
     full room still lets them in to watch rather than turning them away —
     the alternative is a link that silently stops working, and a person who
     cannot tell whether they are early or too late. */
  function join(state, opts, now) {
    const next = clone(state);
    const known = next.members[opts.member];
    const name = cleanName(opts.name);

    /* The chair they already hold, if any. Mid-draft leave() keeps the chair
       and only marks it auto, so this finds it; in the lobby the chair was
       freed and they take the first one going.

       Which makes this the path everybody comes *back* along, not just the
       one they arrive on — a socket on a phone drops every time the browser
       stops being the front app. The two have to be told apart, because
       leave() hands the seat to the CPU so the draft keeps moving without
       them and returning has to undo precisely that. It did not: a manager
       who went through a tunnel came back to a chair the host's browser went
       on drafting for, and the only sign of it was picks they never made. */
    let seat = seatOf(next, opts.member);
    if (seat < 0 && next.status === "lobby") seat = freeSeat(next);

    next.members[opts.member] = {
      /* A reconnect carries whatever name that browser has, which may be
         newer than the one the chair is wearing — somebody renamed
         themselves and then went through a tunnel. One carrying no name at
         all keeps the name they had rather than anonymising them. */
      name: name || (known && known.name) || null,
      seat: seat >= 0 ? seat : null,
      seen: now,
      // Survives a drop, so a return can be told from an arrival.
      first: known ? known.first : now
    };

    if (seat >= 0) {
      next.seats[seat].member = opts.member;
      next.seats[seat].name = next.members[opts.member].name;
      // They are back, so the room stops picking for them.
      next.seats[seat].auto = false;
    }
    return ok(next);
  }

  /* Changing your name mid-draft is allowed, and it moves everywhere at once:
     the chair, and every line already in the log. The alternative — leaving
     old messages under the old name — reads as two different people talking,
     which is worse than the small dishonesty of rewriting history. */
  function rename(state, opts) {
    const name = cleanName(opts.name);
    const next = clone(state);

    if (!next.members[opts.member]) return fail(state, ERR.NOT_YOUR_SEAT);
    next.members[opts.member].name = name;

    const seat = seatOf(next, opts.member);
    if (seat >= 0) next.seats[seat].name = name;

    if (seat >= 0) {
      next.chat.forEach(function (m) {
        if (!m.system && m.seat === seat) m.name = name;
      });
    }
    return ok(next);
  }

  function claimSeat(state, opts) {
    if (state.status !== "lobby") return fail(state, ERR.NOT_IN_LOBBY);
    if (!state.seats[opts.seat]) return fail(state, ERR.NO_SUCH_SEAT);
    if (state.seats[opts.seat].member &&
        state.seats[opts.seat].member !== opts.member) {
      return fail(state, ERR.SEAT_TAKEN);
    }

    const next = clone(state);
    const had = seatOf(next, opts.member);
    if (had >= 0) {                        // moving chairs, not taking a second
      next.seats[had].member = null;
      next.seats[had].name = null;
      next.seats[had].auto = true;
    }

    next.seats[opts.seat].member = opts.member;
    next.seats[opts.seat].name = (next.members[opts.member] || {}).name || null;
    next.seats[opts.seat].auto = false;
    if (next.members[opts.member]) next.members[opts.member].seat = opts.seat;
    return ok(next);
  }

  /* Leaving frees the seat in the lobby but keeps it mid-draft, switched to
     auto. A dropped connection is usually a tunnel or a locked phone, and
     handing someone's roster to a stranger because their train went
     underground would be worse than picking for them. */
  function leave(state, opts) {
    const next = clone(state);
    const seat = seatOf(next, opts.member);

    if (seat >= 0) {
      if (next.status === "lobby") {
        next.seats[seat].member = null;
        next.seats[seat].name = null;
      }
      next.seats[seat].auto = true;
    }

    /* The record stays, with its chair forgotten, where it used to be
       deleted outright. It is the only thing that can tell a reconnection
       from a new arrival, and without it a phone backgrounding in the lobby
       — which is what everyone does, to send the invite link — announced
       "took seat 1" again every time it came back. A room never holds more
       of these than have actually been in it. */
    if (next.members[opts.member]) {
      next.members[opts.member].seat = null;
    }
    return ok(next);
  }

  /* ---- the draft ------------------------------------------ */

  function start(state, opts, now) {
    if (state.status !== "lobby") return fail(state, ERR.NOT_IN_LOBBY);
    if (state.host && opts.member !== state.host) return fail(state, ERR.NOT_YOUR_SEAT);

    const next = clone(state);
    next.status = "drafting";
    next.pickStartedAt = now;
    return ok(next);
  }

  function onTheClock(state) {
    return Engine.onTheClock(state.league, state.picks.length);
  }

  function takenKeys(state) {
    return state.picks.map((p) => p.key);
  }

  /* A seat nobody is sitting in, or one whose manager has gone quiet. Both
     get picked for; the room does not distinguish, because from the board's
     point of view they are the same situation. */
  function seatIsAuto(state, seat) {
    const chair = state.seats[seat];
    return !chair || chair.auto || !chair.member;
  }

  function submitPick(state, opts) {
    if (state.status !== "drafting") return fail(state, ERR.NOT_DRAFTING);

    const c = onTheClock(state);
    if (!c) return fail(state, ERR.NOT_DRAFTING);

    // Whose seat is on the clock, checked before the engine sees it, so the
    // error a client gets back is about them rather than about the pick.
    if (state.seats[c.slot].member !== opts.member) {
      return fail(state, ERR.NOT_YOUR_SEAT);
    }

    const reject = Engine.rejectPick(
      state.league, state.picks.length, c.slot, opts.key, takenKeys(state));
    if (reject) return fail(state, reject);

    return ok(applyPick(clone(state), c, opts.key, opts.now));
  }

  /* The clock ran out, or the seat is empty. `choose` is handed the room and
     the seat and returns a player key; the room does not know what a good
     pick is and should not learn. */
  function autoPick(state, opts) {
    if (state.status !== "drafting") return fail(state, ERR.NOT_DRAFTING);

    const c = onTheClock(state);
    if (!c) return fail(state, ERR.NOT_DRAFTING);

    const key = opts.choose(state, c.slot);
    if (!key) return fail(state, Engine.REJECT.NO_PLAYER);

    const reject = Engine.rejectPick(
      state.league, state.picks.length, c.slot, key, takenKeys(state));
    if (reject) return fail(state, reject);

    return ok(applyPick(clone(state), c, key, opts.now));
  }

  /* The host's browser stands in for the empty chairs.

     The CPU's opinion needs the board — a megabyte of generated data the
     room has no business holding — so it is worked out where the board
     already is and submitted like any other pick. The room still decides
     whether to accept it: only the host may send one, and only for a seat
     that is genuinely nobody's or whose clock has run out. Authority stays
     here; the knowledge stays there.

     The cost is that CPU seats stall if the host closes the tab. Better
     than shipping a megabyte to a Durable Object, and visible rather than
     silent: the board simply stops. */
  function hostPick(state, opts) {
    if (state.status !== "drafting") return fail(state, ERR.NOT_DRAFTING);
    if (!state.host || opts.member !== state.host) return fail(state, ERR.NOT_YOUR_SEAT);

    const c = onTheClock(state);
    if (!c) return fail(state, ERR.NOT_DRAFTING);

    const mayPick = seatIsAuto(state, c.slot) || expired(state, opts.now);
    if (!mayPick) return fail(state, ERR.NOT_YOUR_SEAT);

    const reject = Engine.rejectPick(
      state.league, state.picks.length, c.slot, opts.key, takenKeys(state));
    if (reject) return fail(state, reject);

    return ok(applyPick(clone(state), c, opts.key, opts.now));
  }

  function applyPick(next, c, key, now) {
    next.picks.push({
      overall: next.picks.length + 1,
      round: c.round,
      slot: c.slot,
      key: key,
      at: now
    });

    if (Engine.draftOver(next.league, next.picks.length)) {
      next.status = "done";
      next.pickStartedAt = null;
    } else {
      next.pickStartedAt = now;    // a fresh clock for the next seat
    }
    return next;
  }

  /* ---- time ------------------------------------------------

     The room never counts. It records when the current pick started and
     answers how long is left when asked, which is what lets a client that
     was asleep, or one that just joined, arrive at the same number as
     everyone else instead of counting from whenever it woke up. */

  function msLeft(state, now) {
    if (state.status !== "drafting" || !state.clockLength) return null;
    if (state.paused || !state.pickStartedAt) return null;
    return Math.max(0, state.clockLength * 1000 - (now - state.pickStartedAt));
  }

  function expired(state, now) {
    const left = msLeft(state, now);
    return left !== null && left <= 0;
  }

  /* True when the room should pick without being asked: the clock has run
     out, or the seat on the clock has nobody in it. Checked by the adapter
     on a timer and after every message. */
  function needsAutoPick(state, now) {
    if (state.status !== "drafting") return false;
    const c = onTheClock(state);
    if (!c) return false;
    return seatIsAuto(state, c.slot) || expired(state, now);
  }

  function pause(state, on) {
    const next = clone(state);
    next.paused = !!on;
    return ok(next);
  }

  /* ---- talking --------------------------------------------

     Chat lives in the room rather than being relayed straight through, so
     somebody who joins in round four can read what the room has been saying
     rather than arriving into silence. It costs a broadcast either way.

     Bounded twice, because the whole room is written to storage on every
     action and a Durable Object value has a hard ceiling. A count alone is
     not enough: five hundred characters is a legal message and two hundred of
     those would not fit beside the picks and the league. So lines fall off
     the front on whichever limit bites first.

     Picks are deliberately not in here. They arrive in the stream on the
     client, merged out of room.picks by timestamp, which already carries all
     of them — a hundred and forty in a normal draft. Storing them as chat
     would double the record and, worse, would push every real message out of
     a fixed-length log by the third round. */
  const CHAT_KEEP = 200;
  const CHAT_BYTES = 60000;
  const CHAT_MAX = 500;

  /* A reaction is one of these and nothing else.

     An allowlist rather than "any emoji", because the alternative is storing
     an arbitrary string per person per message, and a room is a thing
     strangers can be invited into. Six is also about as many as anybody
     picks from without thinking, which is the whole point of a reaction. */
  const REACTIONS = ["👍", "😂", "😱",
                     "🔥", "💀", "🏈"];

  /* Ids come from a counter on the room, not from the timestamp or the
     position in the array. Two people can send in the same millisecond, and
     the array shifts every time a line falls off the front — either would
     mean a reaction landing on somebody else's message. */
  function nextId(next) {
    next.chatSeq = (next.chatSeq || 0) + 1;
    return next.chatSeq;
  }

  function trimChat(next) {
    if (next.chat.length > CHAT_KEEP) next.chat = next.chat.slice(-CHAT_KEEP);

    // Measured once and decremented, rather than re-stringifying the whole
    // log per line dropped, which is the difference between O(n) and O(n²) on
    // the hot path of every message anybody sends.
    let bytes = JSON.stringify(next.chat).length;
    while (next.chat.length > 1 && bytes > CHAT_BYTES) {
      bytes -= JSON.stringify(next.chat.shift()).length + 1;
    }
    return next;
  }

  /* A GIF address is a claim, not a fact. It arrives from a manager the same
     way a message does, and the client puts it in an img src — so anything
     that is not GIPHY's own media is dropped here, before it is stored and
     before anybody else's browser is asked to fetch it.

     Checked with URL rather than a substring test: "https://evil.com/?x=giphy.com"
     contains the string and is not GIPHY. The host has to actually be theirs. */
  function cleanGif(value) {
    if (!value) return null;
    try {
      const url = new URL(String(value));
      if (url.protocol !== "https:") return null;
      const host = url.hostname.toLowerCase();
      if (host !== "giphy.com" && !host.endsWith(".giphy.com")) return null;
      return url.href.slice(0, CHAT_MAX);
    } catch (err) {
      return null;
    }
  }

  function say(state, opts) {
    const text = String(opts.text == null ? "" : opts.text).trim().slice(0, CHAT_MAX);
    const gif = cleanGif(opts.gif);
    // A GIF on its own is a message; empty with nothing attached is not.
    if (!text && !gif) return fail(state, ERR.EMPTY_MESSAGE);

    const next = clone(state);
    const seat = seatOf(next, opts.member);

    next.chat.push({
      id: nextId(next),
      // The seat, not the member id: a client is never told anyone else's
      // id and a chat line is no reason to start.
      seat: seat,
      name: (next.members[opts.member] || {}).name || null,
      text: text,
      gif: gif,
      at: opts.now
    });

    return ok(trimChat(next));
  }

  /* Said by the room itself: who arrived, who left, when it started. The
     same shape as a person's line with no seat, so one renderer draws both
     and the transcript reads in order. */
  function announce(state, text, now) {
    const next = clone(state);
    next.chat.push({
      id: nextId(next), seat: -1, name: null, text: text, at: now, system: true
    });
    return trimChat(next);
  }

  /* Reactions hang off the message rather than being messages of their own,
     which is the difference between a room where six people agree and a room
     where six people each say "👍" and the conversation is gone.

     Stored as member ids so that pressing the same one twice takes it back,
     and so nobody can react twice by reconnecting. Those ids never leave the
     server — viewFor() turns them into a count and a flag. */
  function react(state, opts) {
    if (REACTIONS.indexOf(opts.emoji) < 0) return fail(state, ERR.BAD_REACTION);

    const next = clone(state);
    const line = next.chat.filter(function (m) { return m.id === opts.id; })[0];
    // A line that has already fallen off the front of the log. Nothing to
    // attach to, and nothing worth interrupting anybody about.
    if (!line) return fail(state, ERR.NO_SUCH_LINE);

    if (!line.reacts) line.reacts = {};
    const who = line.reacts[opts.emoji] || [];
    const at = who.indexOf(opts.member);

    if (at >= 0) who.splice(at, 1);
    else who.push(opts.member);

    if (who.length) line.reacts[opts.emoji] = who;
    else delete line.reacts[opts.emoji];
    if (!Object.keys(line.reacts).length) delete line.reacts;

    return ok(next);
  }

  /* Counts and whether it was you, never who. A client that has never been
     told another member's id cannot impersonate them by echoing it back, and
     a reaction is no reason to start handing them out. */
  function reactsFor(line, member) {
    if (!line.reacts) return null;

    const out = [];
    // REACTIONS order rather than insertion order, so the row does not
    // reshuffle under somebody's finger as other people press things.
    REACTIONS.forEach(function (emoji) {
      const who = line.reacts[emoji];
      if (!who || !who.length) return;
      out.push({
        emoji: emoji,
        count: who.length,
        you: !!member && who.indexOf(member) >= 0
      });
    });
    return out.length ? out : null;
  }

  /* ---- what a client sees ---------------------------------

     Deliberately not the whole room. Members carry ids that are nobody
     else's business, and a client that has never been told another
     member's id cannot impersonate them by echoing it back. */
  function viewFor(state, member, now) {
    return {
      v: state.v,
      league: state.league,
      dataVersion: state.dataVersion,
      seed: state.seed,
      status: state.status,
      picks: state.picks,
      clockLength: state.clockLength,
      paused: state.paused,
      msLeft: msLeft(state, now),
      /* Rebuilt rather than handed over. The stored line carries the member
         ids of everyone who reacted to it, and those are exactly the thing
         this function exists to keep in. */
      chat: (state.chat || []).map(function (m) {
        return {
          id: m.id,
          seat: m.seat,
          name: m.name,
          text: m.text,
          gif: m.gif,
          at: m.at,
          system: m.system,
          reacts: reactsFor(m, member)
        };
      }),
      reactions: REACTIONS,
      isHost: !!state.host && state.host === member,
      yourSeat: seatOf(state, member),
      seats: state.seats.map(function (chair, i) {
        return {
          index: i,
          name: chair.name,
          taken: !!chair.member,
          auto: chair.auto,
          you: chair.member === member
        };
      })
    };
  }

  return {
    VERSION: VERSION,
    ERR: ERR,
    REACTIONS: REACTIONS,
    NAME_MAX: NAME_MAX,
    create: create,
    join: join,
    claimSeat: claimSeat,
    leave: leave,
    rename: rename,
    start: start,
    submitPick: submitPick,
    autoPick: autoPick,
    hostPick: hostPick,
    pause: pause,
    say: say,
    react: react,
    cleanGif: cleanGif,
    cleanName: cleanName,
    announce: announce,
    onTheClock: onTheClock,
    seatOf: seatOf,
    freeSeat: freeSeat,
    seatIsAuto: seatIsAuto,
    msLeft: msLeft,
    expired: expired,
    needsAutoPick: needsAutoPick,
    viewFor: viewFor
  };
});
