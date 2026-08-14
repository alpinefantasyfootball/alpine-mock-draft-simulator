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
    NOT_STARTED:   "not-started"
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
      members: {}          // member id -> { name, seat|null, seen }
    };
  }

  /* ---- people --------------------------------------------- */

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
    const existing = next.members[opts.member];

    if (existing) {                       // a refresh, not a new person
      existing.seen = now;
      existing.name = opts.name || existing.name;
      return ok(next);
    }

    const seat = next.status === "lobby" ? freeSeat(next) : -1;

    next.members[opts.member] = {
      name: opts.name || null,
      seat: seat >= 0 ? seat : null,
      seen: now
    };

    if (seat >= 0) {
      next.seats[seat].member = opts.member;
      next.seats[seat].name = opts.name || null;
      next.seats[seat].auto = false;
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
    delete next.members[opts.member];
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
    create: create,
    join: join,
    claimSeat: claimSeat,
    leave: leave,
    start: start,
    submitPick: submitPick,
    autoPick: autoPick,
    hostPick: hostPick,
    pause: pause,
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
