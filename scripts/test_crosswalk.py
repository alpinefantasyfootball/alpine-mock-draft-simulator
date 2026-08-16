#!/usr/bin/env python3
"""The source-id crosswalk, tested without the network.

Why this file exists when the rest of the pipeline is tested by running it:
a bad join does not look like a failure. Every count still prints, both
generated files still write, the board is still correct, and the only symptom
is one player's news on another player's profile -- with every number around
it right. That is the same shape as the bug this project already has a scar
from, where a pick that failed to resolve hit a silent `return` and a wrong
board looked right for an entire draft.

So the join is exercised directly, against a pool small enough to reason
about, including the cases nobody would think to check by eye: two of theirs
claiming one of ours, a player we hold that they have never heard of, and a
player they hold that we do not carry.

Run:  python scripts/test_crosswalk.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_players as bp


FAILURES = []


def check(label, got, want):
    if got == want:
        print(f"ok  {label}")
    else:
        FAILURES.append(label)
        print(f"FAIL {label}\n       got  {got!r}\n       want {want!r}")


# ---- a pool small enough to hold in your head ---------------------------
#
# Two Josh Allens on purpose. They are the reason the fallback matches on
# position as well as name, and the reason a name search at request time is
# not an option.
SLEEPER = {
    "4984": {"full_name": "Josh Allen",     "position": "QB", "team": "BUF"},
    "5092": {"full_name": "Josh Allen",     "position": "DEF", "team": "JAX"},
    "9221": {"full_name": "Jahmyr Gibbs",   "position": "RB", "team": "DET"},
    "6794": {"full_name": "Ja'Marr Chase",  "position": "WR", "team": "CIN"},
    "1234": {"full_name": "Amon-Ra St. Brown", "position": "WR", "team": "DET"},
    "7777": {"full_name": "Nobody Knowsme", "position": "TE", "team": "NYJ"},
}
# Only the players we actually carry. 5092 is deliberately left out: a DEF is
# not in our pool the way a person is, and the join must not invent one.
STATS = {pid: {"age": 25} for pid in ("4984", "9221", "6794", "1234", "7777")}

INDEXES = bp.index_sleeper(SLEEPER)


def tank(pid, name, pos, team, sleeper_id=None):
    row = {"playerID": pid, "longName": name, "pos": pos, "team": team}
    if sleeper_id is not None:
        row["sleeperBotID"] = sleeper_id
    return row


# ---- 1. the good join: they carry our id --------------------------------
linked, report = bp.link_source_ids(STATS, SLEEPER, INDEXES, [
    tank("T1", "Josh Allen", "QB", "BUF", "4984"),
    tank("T2", "Jahmyr Gibbs", "RB", "DET", "9221"),
])
check("sleeperBotID links straight through", linked, {"4984": "T1", "9221": "T2"})
check("and everything unlinked is reported",
      sorted(l.split(" | ")[0] for l in report),
      ["Amon-Ra St. Brown", "Ja'Marr Chase", "Nobody Knowsme"])


# ---- 2. the fallback: no shared id, match on name/pos/team ---------------
linked, _ = bp.link_source_ids(STATS, SLEEPER, INDEXES, [
    tank("T1", "Josh Allen", "QB", "BUF"),
    tank("T3", "Ja'Marr Chase", "WR", "CIN"),
])
check("a name/pos/team match is used when there is no shared id",
      linked, {"4984": "T1", "6794": "T3"})


# ---- 3. punctuation and accents are not a difference --------------------
linked, _ = bp.link_source_ids(STATS, SLEEPER, INDEXES, [
    tank("T4", "Amon-Ra St Brown", "WR", "DET"),      # no full stop
    tank("T5", "JaMarr Chase", "WR", "CIN"),          # no apostrophe
])
check("normalise() is shared with the ADP join, so punctuation does not matter",
      linked, {"1234": "T4", "6794": "T5"})


# ---- 4. the same name at two positions stays two people -----------------
#
# Their quarterback must not be able to claim our defensive end, and the
# fallback must not reach a player we do not carry at all.
linked, _ = bp.link_source_ids(STATS, SLEEPER, INDEXES, [
    tank("T6", "Josh Allen", "DEF", "JAX"),
])
check("a player we do not carry links to nothing", linked, {})


# ---- 5. two of theirs claiming one of ours ------------------------------
#
# The dangerous case. Keeping either one is a coin flip that serves somebody
# else's news under this player's name, so neither is kept.
linked, report = bp.link_source_ids(STATS, SLEEPER, INDEXES, [
    tank("T1", "Jahmyr Gibbs", "RB", "DET", "9221"),
    tank("T9", "Jahmyr Gibbs", "RB", "DET", "9221"),
])
check("a collision stores neither id", linked.get("9221"), None)
check("and says so loudly",
      any(l.startswith("COLLISION") and "T1" in l and "T9" in l for l in report), True)


# ---- 6. the same id twice is not a collision ----------------------------
linked, report = bp.link_source_ids(STATS, SLEEPER, INDEXES, [
    tank("T2", "Jahmyr Gibbs", "RB", "DET", "9221"),
    tank("T2", "Jahmyr Gibbs", "RB", "DET", "9221"),
])
check("a duplicated row is not mistaken for a conflict", linked.get("9221"), "T2")
check("and raises no collision", [l for l in report if l.startswith("COLLISION")], [])


# ---- 7. a bad shared id falls back rather than trusting it --------------
#
# If their sleeperBotID points at somebody we do not hold, the row is not
# thrown away -- the name match still gets a chance.
linked, _ = bp.link_source_ids(STATS, SLEEPER, INDEXES, [
    tank("T7", "Jahmyr Gibbs", "RB", "DET", "999999"),
])
check("an unusable shared id falls through to the name match",
      linked, {"9221": "T7"})


# ---- 8. nothing at all ---------------------------------------------------
linked, report = bp.link_source_ids(STATS, SLEEPER, INDEXES, [])
check("no rows links nothing", linked, {})
check("and reports every player we hold", len(report), len(STATS))


# ---- 9. no key means no call --------------------------------------------
#
# The build has to survive a missing key, an expired key and a provider that
# is down, all of which arrive here as "no rows".
saved = bp.TANK01_KEY
bp.TANK01_KEY = ""
check("no key returns no rows and does not raise", bp.fetch_tank01_players(), [])
bp.TANK01_KEY = saved


# ---- 10. the printed tally has to agree with what was stored -------------
#
# It did not. A collision counted the row it then discarded, so the run said
# "linked 0 ... (1 on sleeperBotID)", and a duplicated row counted twice. A
# count that disagrees with the data it describes is how you stop believing
# the run output, which is the only thing standing between a quiet bad join
# and a user finding it.
import io as _io, contextlib as _ctx

def tally(rows):
    buf = _io.StringIO()
    with _ctx.redirect_stdout(buf):
        linked, _ = bp.link_source_ids(STATS, SLEEPER, INDEXES, rows)
    line = [l for l in buf.getvalue().splitlines() if "linked" in l][0]
    head = int(line.split("linked ")[1].split(" of ")[0])
    direct = int(line.split("(")[1].split(" on")[0])
    name = int(line.split(", ")[1].split(" on")[0])
    return head, direct + name, len(linked)

for label, rows in [
    ("a collision", [tank("T1", "Jahmyr Gibbs", "RB", "DET", "9221"),
                     tank("T9", "Jahmyr Gibbs", "RB", "DET", "9221")]),
    ("a duplicate row", [tank("T2", "Jahmyr Gibbs", "RB", "DET", "9221"),
                         tank("T2", "Jahmyr Gibbs", "RB", "DET", "9221")]),
    ("a mixed batch", [tank("T1", "Josh Allen", "QB", "BUF", "4984"),
                       tank("T3", "Ja'Marr Chase", "WR", "CIN")]),
]:
    head, parts, stored = tally(rows)
    check(f"{label}: the headline count is what was stored", head, stored)
    check(f"{label}: the breakdown adds up to it", parts, stored)


print()
if FAILURES:
    print(f"{len(FAILURES)} FAILED: " + ", ".join(FAILURES))
    sys.exit(1)
print("OK")
