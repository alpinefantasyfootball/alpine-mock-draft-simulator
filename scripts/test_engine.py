"""Run draft-engine.js outside a browser and check it against the rules.

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

    harness = HARNESS.replace(
        "ENGINE_PATH", json.dumps(ENGINE.replace("\\", "/")))

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
