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
     A config is { teams, rounds }. Anything else about a league
     — the lineup, the scoring, the bench — changes what a good
     pick is, never what a legal one is, so none of it is here. */

  function totalPicks(config) {
    return config.teams * config.rounds;
  }

  /* Overall pick 1 is round 1, seat 1. In even rounds the order reverses,
     which is the only thing that makes a snake draft a snake. Seats are
     returned zero-indexed, because every caller uses them as an index. */
  function pickInfo(overall, teams) {
    const round   = Math.ceil(overall / teams);
    const inRound = overall - (round - 1) * teams;
    const slot    = (round % 2 === 0) ? (teams + 1 - inRound) : inRound;
    return { round: round, slot: slot - 1 };
  }

  function pickCode(overall, teams) {
    const p = pickInfo(overall, teams);
    return p.round + "." + String(p.slot + 1).padStart(2, "0");
  }

  /* Whose turn it is, from the number of picks already made. Deliberately
     takes a count rather than a list: the server holds the authoritative
     count, and asking it for the whole pick list to answer "whose turn" is
     a round trip to learn something it already knows. */
  function onTheClock(config, pickCount) {
    if (pickCount >= totalPicks(config)) return null;
    return pickInfo(pickCount + 1, config.teams);
  }

  function draftOver(config, pickCount) {
    return pickCount >= totalPicks(config);
  }

  // How many picks until a seat is up. Zero means it is up now.
  function picksUntil(config, pickCount, seat) {
    const total = totalPicks(config);
    let n = pickCount + 1;
    let gap = 0;
    while (n <= total && pickInfo(n, config.teams).slot !== seat) { n++; gap++; }
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
    pickInfo: pickInfo,
    pickCode: pickCode,
    onTheClock: onTheClock,
    draftOver: draftOver,
    picksUntil: picksUntil,
    rejectPick: rejectPick,
    jitter: jitter,
    REJECT: REJECT
  };
});
