"""Run draft-engine.js and room.js outside a browser and check them.

The engine's whole claim is that a server and every client reach the same
verdict about a draft. A claim like that is worth testing somewhere other
than the page that already agrees with it, so this evaluates the file in a
standalone JavaScript host and asserts the snake maths, the turn order and
the legality checks from the outside.

Standard library only, like the rest of the pipeline. It needs a JS runtime
on PATH -- node, deno or bun -- and says so plainly rather than failing in a
way that looks like the engine is broken.

    py scripts/test_engine.py
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = os.path.join(ROOT, "draft-engine.js")
ROOM = os.path.join(ROOT, "room.js")

# In preference order. Deno and bun both run a plain script the same way node
# does, so any of them proves the point: the file did not need a browser.
RUNTIMES = ["node", "deno", "bun"]


def find_runtime():
    for name in RUNTIMES:
        path = shutil.which(name)
        if path:
            return name, path
    return None, None


HARNESS = r"""
const E = require(ENGINE_PATH);
const R = require(ROOM_PATH);

let failures = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) failures.push(name + "\n    got  " + g + "\n    want " + w);
}

// ---- snake maths ----
const ten = { teams: 10, rounds: 14 };
check("total picks", E.totalPicks(ten), 140);
check("1.01 is seat 0", E.pickInfo(1, 10), { round: 1, slot: 0 });
check("1.10 is seat 9", E.pickInfo(10, 10), { round: 1, slot: 9 });
check("round 2 reverses", E.pickInfo(11, 10), { round: 2, slot: 9 });
check("2.10 is seat 0", E.pickInfo(20, 10), { round: 2, slot: 0 });
check("round 3 turns back", E.pickInfo(21, 10), { round: 3, slot: 0 });
check("last pick", E.pickInfo(140, 10), { round: 14, slot: 0 });
check("pick code pads", E.pickCode(2, 10), "1.02");

/* A pick code is round-then-pick-of-round, never round-then-seat. The two
   agree for every odd round, which is why reading the seat looked correct
   for as long as it did — so the cases that matter are all even. */
check("first pick of an even round", E.pickCode(11, 10), "2.01");
check("last pick of an even round",  E.pickCode(20, 10), "2.10");
check("odd rounds are unchanged",    E.pickCode(21, 10), "3.01");
check("the very last pick",          E.pickCode(140, 10), "14.10");

/* Two invariants, and only the second one catches the bug this was written
   for. That is worth saying rather than leaving to be discovered.

   Uniqueness is the obvious check and it is useless here: reading the seat
   still hands out every code in a round exactly once, because each overall
   number in a round has its own seat. The set is right and the assignment is
   backwards, so the count cannot see it. It is kept because it is a genuine
   property worth holding, not because it defends this.

   What catches it is the second: a pick code has to be derivable from the
   overall number and the league size alone, with no reference to the snake.
   That is what makes it a pick number rather than a seat number, and a
   mirrored round fails it 10 times out of 10. */
[8, 10, 12, 13, 14, 24].forEach(function (teams) {
  const cfg = { teams: teams, rounds: 14 };
  const codes = {};
  let mismatched = 0;
  for (let n = 1; n <= E.totalPicks(cfg); n++) {
    const code = E.pickCode(n, teams);
    codes[code] = (codes[code] || 0) + 1;
    // The code has to be derivable from the overall number alone, with no
    // reference to the snake at all: that is what makes it a pick number.
    const round   = Math.ceil(n / teams);
    const inRound = n - (round - 1) * teams;
    if (code !== round + "." + String(inRound).padStart(2, "0")) mismatched++;
  }
  const counts = Object.keys(codes).map((k) => codes[k]);
  check("every pick code is unique at " + teams + " teams",
        [Object.keys(codes).length, Math.max.apply(null, counts)],
        [E.totalPicks(cfg), 1]);
  check("and counts up through each round at " + teams + " teams", mismatched, 0);
});

/* pickInRound is the inverse of pickInfo, so a round trip through both has to
   land back on the pick it started from. This is the assertion that stops the
   mirror in one drifting from the mirror in the other. */
[8, 10, 12, 13, 14, 24].forEach(function (teams) {
  let wrong = 0;
  for (let n = 1; n <= teams * 14; n++) {
    const p = E.pickInfo(n, teams);
    const back = (p.round - 1) * teams + E.pickInRound(p.round, p.slot, teams);
    if (back !== n) wrong++;
  }
  check("pickInRound inverts pickInfo at " + teams + " teams", wrong, 0);
});

// every seat appears exactly `rounds` times, in every league size we offer
[4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].forEach(function (teams) {
  const cfg = { teams: teams, rounds: 14 };
  const seen = {};
  for (let i = 1; i <= E.totalPicks(cfg); i++) {
    const s = E.pickInfo(i, teams).slot;
    seen[s] = (seen[s] || 0) + 1;
  }
  const counts = Object.keys(seen).map((k) => seen[k]);
  check("every seat drafts 14 times at " + teams + " teams",
        [Object.keys(seen).length, Math.min.apply(null, counts), Math.max.apply(null, counts)],
        [teams, 14, 14]);
});

// ---- the clock ----
check("clock at start", E.onTheClock(ten, 0), { round: 1, slot: 0 });
check("clock mid draft", E.onTheClock(ten, 10), { round: 2, slot: 9 });
check("no clock when done", E.onTheClock(ten, 140), null);
check("draft over", [E.draftOver(ten, 139), E.draftOver(ten, 140)], [false, true]);
check("picks until my turn from the off", E.picksUntil(ten, 0, 3), 3);
check("zero when it is my turn", E.picksUntil(ten, 3, 3), 0);

// back to back at the turn: seat 9 picks 1.10 and 2.01
check("snake gives seat 9 back-to-back", E.picksUntil(ten, 10, 9), 0);

// ---- legality ----
check("legal pick", E.rejectPick(ten, 0, 0, "Gibbs", []), null);
check("wrong seat", E.rejectPick(ten, 0, 4, "Gibbs", []), E.REJECT.NOT_YOUR_TURN);
check("already taken", E.rejectPick(ten, 0, 0, "Gibbs", ["Gibbs"]), E.REJECT.ALREADY_TAKEN);
check("no player", E.rejectPick(ten, 0, 0, null, []), E.REJECT.NO_PLAYER);
check("after the end", E.rejectPick(ten, 140, 0, "Gibbs", []), E.REJECT.DRAFT_OVER);

// a kicker in round one is legal, as it has always been in this app
check("no positional ban", E.rejectPick(ten, 0, 0, "Some Kicker", []), null);

// ---- determinism ----
// The same seed and board position must give the same wobble every time and
// in every runtime, or two clients drift apart inside a round.
check("jitter is stable", E.jitter(42, 12345), E.jitter(42, 12345));
check("jitter is in range", (function () {
  let lo = 99, hi = -99;
  for (let seed = 0; seed < 200; seed++) {
    for (let pos = 1; pos <= 260; pos++) {
      const j = E.jitter(pos, seed);
      if (j < lo) lo = j;
      if (j > hi) hi = j;
    }
  }
  return [lo >= -3, hi <= 3];
})(), [true, true]);
check("jitter differs by seed", E.jitter(42, 1) === E.jitter(42, 2), false);

// A full simulated draft driven only by the engine: no duplicates, right
// number of picks, every seat with the right count.
(function () {
  const cfg = { teams: 12, rounds: 15 };
  const taken = [];
  let rejects = 0;
  for (let i = 0; i < E.totalPicks(cfg); i++) {
    const c = E.onTheClock(cfg, i);
    const key = "player-" + i;
    if (E.rejectPick(cfg, i, c.slot, key, taken)) rejects++;
    taken.push(key);
  }
  check("180 legal picks in a row", [taken.length, rejects, new Set(taken).size],
        [180, 0, 180]);
  check("nothing legal after the last", E.onTheClock(cfg, 180), null);
})();

// ---- the room ----
(function () {
  const L = { teams: 4, rounds: 3 }, T0 = 1000000;
  let r = R.create({ league: L, seed: 7, clockLength: 60, host: "alice" });
  check("room starts in lobby", r.status, "lobby");
  check("one chair per team", r.seats.length, 4);

  r = R.join(r, { member: "alice", name: "Alice" }, T0).state;
  r = R.join(r, { member: "bob", name: "Bob" }, T0).state;
  check("seats fill in order", [R.seatOf(r, "alice"), R.seatOf(r, "bob")], [0, 1]);

  r = R.join(r, { member: "alice", name: "Alice" }, T0 + 5).state;
  check("a refresh is not a second seat",
        r.seats.filter((s) => s.member === "alice").length, 1);

  check("only the host may start", R.start(r, { member: "bob" }, T0).error, R.ERR.NOT_YOUR_SEAT);
  r = R.start(r, { member: "alice" }, T0).state;
  check("drafting", r.status, "drafting");

  check("wrong seat is refused",
        R.submitPick(r, { member: "bob", key: "x", now: T0 }).error, R.ERR.NOT_YOUR_SEAT);

  check("countdown from the pick", R.msLeft(r, T0 + 30000), 30000);
  check("expiry", R.expired(r, T0 + 60001), true);

  // a whole draft: two managers, two empty chairs
  let pool = 0, guard = 0, now = T0;
  const key = () => "player-" + (pool++);
  while (r.status === "drafting" && guard++ < 50) {
    const c = R.onTheClock(r);
    now += 10;
    const res = R.seatIsAuto(r, c.slot)
      ? R.autoPick(r, { now: now, choose: key })
      : R.submitPick(r, { member: r.seats[c.slot].member, key: key(), now: now });
    if (res.error) { failures.push("draft stalled: " + res.error); break; }
    r = res.state;
  }
  check("room draft finishes", [r.status, r.picks.length, new Set(r.picks.map((p) => p.key)).size],
        ["done", 12, 12]);
  check("snake order", r.picks.slice(0, 8).map((p) => p.slot), [0, 1, 2, 3, 3, 2, 1, 0]);

  const view = R.viewFor(r, "alice", now);
  check("view hides other member ids", JSON.stringify(view).indexOf('"bob"') < 0, true);
  check("view names your seat", view.yourSeat, 0);

  const snapshot = JSON.stringify(r);
  R.submitPick(r, { member: "alice", key: "z", now: now });
  R.leave(r, { member: "alice" });
  check("actions do not mutate", JSON.stringify(r), snapshot);
})();

/* ---- what only the host may do ----

   Three things about a room belong to whoever made it, and two of them were
   not checked at all. Pausing had no host test — nothing caught it, because
   no client had ever sent the message — and the clock is the one fact a room
   holds that is true for everybody at once, so anyone able to stop it was
   anyone able to stop everybody. */
(function () {
  const league = { teams: 4, rounds: 2, starters: { QB: 1, RB: 1 },
                   flex: 0, superflex: 0, bench: 0 };
  const T0 = 1000000;
  let r = R.create({ league: league, seed: 1, host: "alice", clockLength: 30 });
  r = R.join(r, { member: "alice", name: "Alice" }, T0).state;
  r = R.join(r, { member: "bob", name: "Bob" }, T0).state;
  r = R.join(r, { member: "cass", name: "Cass" }, T0).state;

  check("a guest cannot pause the room",
        R.pause(r, { member: "bob" }, true).error, R.ERR.NOT_YOUR_SEAT);
  check("the host can", R.pause(r, { member: "alice" }, true).state.paused, true);
  check("a refused pause leaves the clock alone",
        R.pause(r, { member: "bob" }, true).state.paused, false);

  // ---- draft order, which is seats and never names ----
  check("a guest cannot set the draft order",
        R.swapSeats(r, { member: "bob", a: 0, b: 1 }).error, R.ERR.NOT_YOUR_SEAT);
  check("a seat that does not exist is refused",
        R.swapSeats(r, { member: "alice", a: 0, b: 99 }).error, R.ERR.NO_SUCH_SEAT);

  const swapped = R.swapSeats(r, { member: "alice", a: 0, b: 2 }).state;
  check("the chairs change places",
        swapped.seats.map((s) => s.name), ["Cass", "Bob", "Alice", null]);

  /* The member record carries a chair of its own and it is what a
     reconnection looks itself up by, so leaving it behind would send somebody
     who went through a tunnel back to the seat they used to have. */
  check("the member records follow the chairs",
        [swapped.members.alice.seat, swapped.members.cass.seat], [2, 0]);
  check("a member who did not move is untouched", swapped.members.bob.seat, 1);
  check("and the room agrees with itself",
        [R.seatOf(swapped, "alice"), R.seatOf(swapped, "cass")], [2, 0]);

  check("a swap with itself is allowed and changes nothing",
        JSON.stringify(R.swapSeats(r, { member: "alice", a: 1, b: 1 }).state.seats),
        JSON.stringify(r.seats));

  /* Lobby only. Once a pick exists the snake order is what those picks mean,
     so moving a chair afterwards would rewrite whose they were. */
  const started = R.start(r, { member: "alice" }, T0).state;
  check("the order cannot be changed once drafting",
        R.swapSeats(started, { member: "alice", a: 0, b: 1 }).error, R.ERR.NOT_IN_LOBBY);

  // ---- a room says whose it is, without saying who anybody is ----
  const view = R.viewFor(r, "bob", T0);
  check("the room is named after its host", view.hostName, "Alice");
  check("naming it leaks no member id", JSON.stringify(view).indexOf('"alice"') < 0, true);

  let nameless = R.create({ league: league, seed: 1, host: "alice" });
  nameless = R.join(nameless, { member: "alice", name: null }, T0).state;
  check("a host who typed no name gives the room none",
        R.viewFor(nameless, "alice", T0).hostName, null);
})();

/* ---- names, and the things hanging off a message ----

   All of this is drawn on somebody else's screen from something somebody
   else typed, which is why it is checked here rather than only through the
   page: the page is one of two things that has to agree about it. */
(function () {
  const league = { teams: 4, rounds: 2, starters: { QB: 1, RB: 1 },
                   flex: 0, superflex: 0, bench: 0 };
  const T0 = 1000000;
  let r = R.create({ league: league, seed: 1, host: "alice", clockLength: 30 });

  // ---- a name is cleaned, not trusted ----
  check("control characters are stripped from a name",
        R.cleanName("Ch" + String.fromCharCode(0) + "a" + String.fromCharCode(31) + "se" + String.fromCharCode(127)), "Chase");
  check("a newline cannot break the line a name sits on",
        R.cleanName("Chase\nCantwell"), "Chase Cantwell");
  check("runs of space collapse", R.cleanName("Sam    Reyes"), "Sam Reyes");
  check("a name is capped", R.cleanName("x".repeat(60)).length, R.NAME_MAX);
  check("a name of only spaces is no name", R.cleanName("   "), null);
  check("no name is no name", R.cleanName(null), null);

  r = R.join(r, { member: "alice", name: "  Chase   Cantwell " }, T0).state;
  r = R.join(r, { member: "bob", name: "Sam" }, T0).state;
  check("the name lands on the chair", r.seats[0].name, "Chase Cantwell");

  // ---- renaming moves everywhere at once ----
  r = R.say(r, { member: "alice", text: "morning", now: T0 }).state;
  r = R.rename(r, { member: "alice", name: "Coach" }).state;
  check("rename moves the chair", r.seats[0].name, "Coach");
  check("rename rewrites what was already said",
        r.chat.filter((m) => !m.system).map((m) => m.name), ["Coach"]);

  r = R.join(r, { member: "alice", name: null }, T0 + 1).state;
  check("a nameless rejoin keeps the name", r.seats[0].name, "Coach");

  // ---- reactions ----
  const line = r.chat.filter((m) => !m.system)[0];
  check("a message carries an id", typeof line.id, "number");
  check("an unlisted reaction is refused",
        R.react(r, { member: "bob", id: line.id, emoji: "not-an-emoji" }).error,
        R.ERR.BAD_REACTION);
  check("a reaction to a line that has fallen off is refused",
        R.react(r, { member: "bob", id: 99999, emoji: R.REACTIONS[0] }).error,
        R.ERR.NO_SUCH_LINE);

  r = R.react(r, { member: "bob", id: line.id, emoji: R.REACTIONS[0] }).state;
  const mine = R.viewFor(r, "bob", T0).chat.filter((m) => !m.system)[0];
  const theirs = R.viewFor(r, "alice", T0).chat.filter((m) => !m.system)[0];
  check("the reactor is told it was them", mine.reacts,
        [{ emoji: R.REACTIONS[0], count: 1, you: true }]);
  check("everyone else gets the count and not the name", theirs.reacts,
        [{ emoji: R.REACTIONS[0], count: 1, you: false }]);

  /* The whole reason reactions are stored as member ids and projected: a
     client that has never been told another member's id cannot impersonate
     them by echoing it back. */
  check("a reaction leaks no member id",
        JSON.stringify(R.viewFor(r, "alice", T0)).indexOf('"bob"') < 0, true);

  r = R.react(r, { member: "bob", id: line.id, emoji: R.REACTIONS[0] }).state;
  check("the same reaction twice takes it back",
        R.viewFor(r, "bob", T0).chat.filter((m) => !m.system)[0].reacts, null);

  // ---- the log is bounded, in lines and in bytes ----
  let big = R.join(R.create({ league: league, seed: 1, host: "alice" }),
                   { member: "alice", name: "A" }, T0).state;
  for (let i = 0; i < 400; i++) {
    big = R.say(big, { member: "alice", text: "x".repeat(500), now: T0 + i }).state;
  }
  check("the log is capped in lines", big.chat.length <= 200, true);
  /* The room is written to Durable Object storage whole, on every action, and
     a value there has a hard ceiling. Five hundred characters is a legal
     message, so a line count alone does not bound the write. */
  check("the log is capped in bytes", JSON.stringify(big.chat).length <= 60000, true);

  const ids = big.chat.map((m) => m.id);
  check("ids keep climbing as lines fall off the front",
        ids[0] < ids[ids.length - 1], true);
  check("ids are unique", new Set(ids).size, ids.length);
})();

if (failures.length) {
  console.log("FAIL " + failures.length);
  failures.forEach((f) => console.log("  x " + f));
  process.exit(1);
}
console.log("OK");
"""


def main():
    name, path = find_runtime()
    if not name:
        print("No JavaScript runtime found on PATH (looked for: "
              + ", ".join(RUNTIMES) + ").")
        print()
        print("The engine is plain JavaScript with no imports, so any of them")
        print("will run it. Install one and re-run, or open index.html and")
        print("exercise it through the app instead.")
        return 2

    harness = (HARNESS
               .replace("ENGINE_PATH", json.dumps(ENGINE.replace("\\", "/")))
               .replace("ROOM_PATH", json.dumps(ROOM.replace("\\", "/"))))

    with tempfile.TemporaryDirectory() as tmp:
        script = os.path.join(tmp, "harness.js")
        with open(script, "w", encoding="utf-8") as handle:
            handle.write(harness)

        cmd = [path, script]
        if name == "deno":
            cmd = [path, "run", "--allow-read", script]

        result = subprocess.run(cmd, capture_output=True, text=True)

    print(f"runtime: {name}")
    if result.stdout:
        print(result.stdout.rstrip())
    if result.stderr:
        print(result.stderr.rstrip(), file=sys.stderr)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
