/* ==========================================================
   Juke — the draft engine

   The rules of a snake draft, and nothing else. No DOM, no
   globals, no dependencies: every function here takes what it
   needs and returns an answer.

   This exists because of multiplayer. Today the browser is the
   only thing that decides whether a pick is legal, and with one
   drafter that is fine — there is nobody to disagree with. With
   ten people in a room the server has to decide, and the server
   and every client have to agree, or two managers take Bijan
   Robinson three milliseconds apart and the room forks.

   The only way to guarantee they agree is for both to run this
   file. So it is written to run unchanged in a browser, a
   Cloudflare Worker, Deno or Node, which is also why it has no
   imports and no build step to speak of.

   Nothing in here knows about `league`, `state` or `board`.
   app.js keeps thin wrappers over these so its own call sites
   read the same as they always did.
   ========================================================== */

(function (root, factory) {
  const api = factory();
  // Node and Workers get a module; the browser gets a global. Both, rather
  // than either, because this file has to load the same way in a page with
  // no bundler and in a server that has never heard of a <script> tag.
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DraftEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ---- shape ------------------------------------------------
     A config is { teams, rounds } plus, since draft types arrived,
     { type, thirdRoundReversal }. Anything else about a league —
     the lineup, the scoring, the bench — changes what a good pick
     is, never what a legal one is, so none of it is here.

     Every function below that used to take a bare `teams` number
     still does, and a bare number still means a plain snake. That
     is not backwards compatibility for its own sake: it is what
     lets DraftBoardGrid ask for a pick code while holding only a
     team count, and it is what keeps every existing call site in
     app.js, room.js and the worker correct rather than quietly
     drawing round three the old way. Pass the league object
     wherever the ORDER matters and a number wherever it cannot. */

  function shapeOf(teamsOrConfig) {
    if (typeof teamsOrConfig === "number") {
      return { teams: teamsOrConfig, type: "snake", trr: false };
    }
    const c = teamsOrConfig || {};
    return {
      teams: c.teams,
      type: c.type || c.draftType || "snake",
      trr: !!(c.thirdRoundReversal || c.trr)
    };
  }

  function totalPicks(config) {
    return config.teams * config.rounds;
  }

  /* Does this round run backwards? The one place the answer lives.

     - linear: never. Every round runs seat 1 to seat N, which is
       what "non-snaking" means and is the whole of that format.
     - snake: even rounds, which is the only thing that makes a
       snake draft a snake.
     - snake with third-round reversal: rounds one and two are an
       ordinary snake, round three repeats round two's direction
       instead of flipping back, and it snakes normally from there.
       So from round three on the parity is inverted — odd rounds
       run backwards and even rounds forwards, the mirror image of
       the two rounds before it.

     Written as one expression per format rather than as a table,
     because the reversal is a property of the round number and a
     table would have to be as long as the draft. */
  function reversedRound(round, shape) {
    if (shape.type === "linear") return false;
    if (shape.trr && round >= 3) return round % 2 === 1;
    return round % 2 === 0;
  }

  /* Overall pick 1 is round 1, seat 1. Seats are returned
     zero-indexed, because every caller uses them as an index. */
  function pickInfo(overall, teamsOrConfig) {
    const shape   = shapeOf(teamsOrConfig);
    const teams   = shape.teams;
    const round   = Math.ceil(overall / teams);
    const inRound = overall - (round - 1) * teams;
    const slot    = reversedRound(round, shape) ? (teams + 1 - inRound) : inRound;
    return { round: round, slot: slot - 1 };
  }

  /* The inverse of pickInfo: which pick of its own round a seat holds.

     In a forward round that is simply the seat. In a reversed one it is
     mirrored, and that mirror is the entire difference between a seat number
     and a pick number — which is why it is written down once, here, rather
     than by each caller that happens to have a round and a seat in hand. */
  function pickInRound(round, slot, teamsOrConfig) {
    const shape = shapeOf(teamsOrConfig);
    return reversedRound(round, shape) ? (shape.teams - slot) : (slot + 1);
  }

  /* Which overall pick a seat holds in a given round — the other inverse of
     pickInfo, and the one the board wants for a cell nobody has drafted yet.

     It is here rather than in the caller for the same reason pickInRound is:
     it is snake arithmetic, the mirror is inside it, and a caller holding a
     round and a seat must never work it out again. The board printed "5.01"
     and had no way to say that is the 41st pick of the draft without either
     asking this or writing the mirror down a second time. */
  function overallOf(round, slot, teamsOrConfig) {
    const shape = shapeOf(teamsOrConfig);
    return (round - 1) * shape.teams + pickInRound(round, slot, teamsOrConfig);
  }

  /* The label a draft actually uses: the round, then which pick of that round.

     Not the seat. For half the board those are the same number, which is how
     this was wrong for as long as it existed: it read the seat, so odd rounds
     were right and even rounds were mirrored. In a ten-team league the first
     pick of round two came out "2.10" and the last came out "2.01".

     The header is where it was self-contradicting — "Pick 2.10 (11 Overall)",
     when 11 overall can only be the first pick of the round. Two correct
     numbers side by side disagreeing, which is the tell worth remembering:
     nothing about the arithmetic was wrong, only what it was called. */
  function pickCode(overall, teamsOrConfig) {
    const p = pickInfo(overall, teamsOrConfig);
    return p.round + "." + String(pickInRound(p.round, p.slot, teamsOrConfig)).padStart(2, "0");
  }

  /* Whose turn it is, from the number of picks already made. Deliberately
     takes a count rather than a list: the server holds the authoritative
     count, and asking it for the whole pick list to answer "whose turn" is
     a round trip to learn something it already knows. */
  function onTheClock(config, pickCount) {
    if (pickCount >= totalPicks(config)) return null;
    // `config`, not `config.teams`: the whole point of threading the shape
    // through is that whose turn it is depends on the draft type, and this
    // is the function every other caller asks. Passing the bare team count
    // here would make a linear or reversal draft snake anyway, correctly
    // labelled and in the wrong order — which is the pick-number-versus-seat
    // bug all over again, with nothing on screen disagreeing with itself.
    return pickInfo(pickCount + 1, config);
  }

  function draftOver(config, pickCount) {
    return pickCount >= totalPicks(config);
  }

  // How many picks until a seat is up. Zero means it is up now.
  function picksUntil(config, pickCount, seat) {
    const total = totalPicks(config);
    let n = pickCount + 1;
    let gap = 0;
    while (n <= total && pickInfo(n, config).slot !== seat) { n++; gap++; }
    return gap;
  }

  /* ---- legality ---------------------------------------------

     Why a pick would be rejected, or null when it is fine.

     These are exactly the three rules the single-player app has
     always enforced, written down rather than implied. A human
     can still draft a kicker in round one: the CPU avoids it and
     the suggestions never offer it, but the app has never
     forbidden it and this does not start.

     Adding a rule here is adding it for everyone, which is the
     point — a client that disagrees with the server about
     legality is a client that shows a pick which then vanishes.

     Players are identified by a stable key rather than an object,
     since the server has no board to hold references into.       */

  const REJECT = {
    DRAFT_OVER:  "draft-over",
    NOT_YOUR_TURN: "not-your-turn",
    NO_PLAYER:   "no-player",
    ALREADY_TAKEN: "already-taken"
  };

  function rejectPick(config, pickCount, seat, playerKey, takenKeys) {
    if (draftOver(config, pickCount)) return REJECT.DRAFT_OVER;

    const c = onTheClock(config, pickCount);
    if (!c || c.slot !== seat) return REJECT.NOT_YOUR_TURN;

    if (!playerKey) return REJECT.NO_PLAYER;
    if (takenKeys && takenKeys.indexOf(playerKey) >= 0) return REJECT.ALREADY_TAKEN;

    return null;
  }

  /* ---- determinism ------------------------------------------

     The CPU wobble. Every client and the server must produce the
     same CPU picks from the same seed or the boards drift apart
     within a round, so this is arithmetic rather than anything
     drawn from a random source.

     It reads a player's position on the board, which means every
     participant has to be working from the same player list. The
     data files are regenerated nightly, so a room has to pin the
     version it started with — a problem for the transport layer,
     recorded here because this is where the assumption lives. */
  function jitter(boardPosition, seed) {
    const n = (boardPosition * 7919 + seed * 104729) % 1000;
    return (n / 1000) * 6 - 3;
  }

  return {
    totalPicks: totalPicks,
    // Exported so a caller can ask which way a round runs without
    // re-deriving the rule — the arrow on every board cell wants exactly
    // this and was working it out from `round % 2` on its own, which is
    // right for a plain snake and wrong for both of the other two formats.
    reversedRound: function (round, teamsOrConfig) {
      return reversedRound(round, shapeOf(teamsOrConfig));
    },
    pickInfo: pickInfo,
    pickInRound: pickInRound,
    overallOf: overallOf,
    pickCode: pickCode,
    onTheClock: onTheClock,
    draftOver: draftOver,
    picksUntil: picksUntil,
    rejectPick: rejectPick,
    jitter: jitter,
    REJECT: REJECT
  };
});
