#!/usr/bin/env python3
"""The two crosswalks and the nflverse audit, tested without the network.

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


# ---- 11. the nflverse join -----------------------------------------------
#
# A different source, a different join, and the same failure mode: a wrong
# match does not look wrong. Their file carries no Sleeper id at all, so
# unlike Tank01 there is no shared-identifier tier to fall back from -- the
# name match IS the join, and every case below is one it has to get right.
#
# Its own pool, because these cases need a two-way player and a Rams player
# and the pool above is asserted on exactly as it stands.
NFL_SLEEPER = {
    "1001": {"full_name": "Puka Nacua",     "position": "WR", "team": "LAR"},
    "1002": {"full_name": "Travis Hunter",  "position": "WR", "team": "JAX"},
    "1003": {"full_name": "Jahmyr Gibbs",   "position": "RB", "team": "DET"},
    "1004": {"full_name": "Ja'Marr Chase",  "position": "WR", "team": "CIN"},
}
NFL_STATS = {pid: {"age": 25} for pid in NFL_SLEEPER}
NFL_INDEXES = bp.index_sleeper(NFL_SLEEPER)


def nfl(gsis, name, pos, team, last=2025):
    return {"gsis_id": gsis, "display_name": name, "position": pos,
            "latest_team": team, "last_season": str(last)}


linked, report = bp.link_nflverse(NFL_STATS, NFL_SLEEPER, NFL_INDEXES, [
    nfl("00-01", "Jahmyr Gibbs", "RB", "DET"),
    nfl("00-02", "Ja'Marr Chase", "WR", "CIN"),
])
check("nflverse joins on name, position and team",
      linked, {"1003": "00-01", "1004": "00-02"})
check("and reports everyone it could not reach",
      sorted(l.split(" | ")[0] for l in report if "no nflverse id" in l),
      ["Puka Nacua", "Travis Hunter"])


# ---- 12. nflverse calls the Rams LA and we call them LAR ------------------
#
# TEAM_ALIASES already knows. The point of the test is that link_nflverse
# actually asks it: a raw team code compared straight across drops every Ram
# to the looser tier, and this is how a defence once reconciled to zero.
linked, _ = bp.link_nflverse(NFL_STATS, NFL_SLEEPER, NFL_INDEXES, [
    nfl("00-03", "Puka Nacua", "WR", "LA"),
])
check("an nflverse LA row joins our LAR player on the strict tier",
      linked, {"1001": "00-03"})


# ---- 13. a two-way player carries the wrong position ----------------------
#
# nflverse lists Travis Hunter as a DB because that is what he mostly is.
# His receiving is perfectly present under his gsis_id; the position tier
# simply cannot see him, and no amount of name matching will fix that. So
# the join has to fail here rather than guess, and NFLVERSE_MATCHES is what
# rescues him.
linked, _ = bp.link_nflverse(NFL_STATS, NFL_SLEEPER, NFL_INDEXES, [
    nfl("00-04", "Travis Hunter", "DB", "JAX"),
])
check("a position nobody drafts does not join by itself", linked.get("1002"), None)

saved_matches = bp.NFLVERSE_MATCHES
bp.NFLVERSE_MATCHES = {"1002": "00-04"}
linked, report = bp.link_nflverse(NFL_STATS, NFL_SLEEPER, NFL_INDEXES, [
    nfl("00-04", "Travis Hunter", "DB", "JAX"),
])
check("NFLVERSE_MATCHES is what reaches him", linked.get("1002"), "00-04")
check("and he stops being reported as missing",
      any("Travis Hunter" in l for l in report), False)
bp.NFLVERSE_MATCHES = saved_matches


# ---- 14. two of theirs claiming one of ours ------------------------------
linked, report = bp.link_nflverse(NFL_STATS, NFL_SLEEPER, NFL_INDEXES, [
    nfl("00-05", "Jahmyr Gibbs", "RB", "DET"),
    nfl("00-06", "Jahmyr Gibbs", "RB", "DET"),
])
check("an nflverse collision stores neither id", linked.get("1003"), None)
check("and says so loudly",
      any(l.startswith("COLLISION") and "00-05" in l and "00-06" in l for l in report),
      True)


# ---- 15. the outage path -------------------------------------------------
#
# nflverse being down, or a season not played yet, both arrive here as no
# rows. The board must be unaffected and the report must say so, because a
# pipeline that needs a third party to be up in order to produce a board is
# not a pipeline this project wants.
linked, report = bp.link_nflverse(NFL_STATS, NFL_SLEEPER, NFL_INDEXES, [])
check("no rows links nothing", linked, {})
check("and reports every player we hold", len(report), len(NFL_STATS))

lines, flagged = bp.audit_against_nflverse(NFL_STATS, {}, {})
check("an audit with nothing to compare flags nothing", flagged, 0)
check("and says why rather than printing an empty table",
      any("nothing compared" in l for l in lines), True)


# ---- 16. the audit applies the two known definitions ---------------------
#
# These are the two differences that would look like data if they were
# reported, and like a bug if they were fixed by taking nflverse's column.
# A touchdown is a first down to them and is not to us; a blocked kick is a
# miss to us and is not to them.
def audited(ours, theirs):
    stats = {"1003": {"s": {"2025": ours}}}
    seasons = {2025: {"00-01": dict(theirs, player_display_name="Test Player")}}
    return bp.audit_against_nflverse(stats, {"1003": "00-01"}, seasons)[1]


check("a first-down line that differs by exactly the touchdowns is not flagged",
      audited({"cfd": 40, "ct": 9},
              {"receiving_first_downs": "49", "receiving_tds": "9"}), 0)
check("and one that differs by anything else is",
      audited({"cfd": 40, "ct": 9},
              {"receiving_first_downs": "52", "receiving_tds": "9"}), 1)
check("a miss total that differs by exactly the blocked kicks is not flagged",
      audited({"fgx": 6}, {"fg_missed": "4", "fg_blocked": "2"}), 0)
check("and one that differs by anything else is",
      audited({"fgx": 6}, {"fg_missed": "4", "fg_blocked": "0"}), 1)
check("a stat both feeds agree on is not flagged",
      audited({"cy": 1200}, {"receiving_yards": "1200"}), 0)


# ---- 17. the audit never changes a stored number -------------------------
#
# The whole design. Sleeper is the feed every season block, every weekly log
# and every archived projection was built from, so a value quietly replaced
# from somewhere else would make `pp` a comparison between two feeds instead
# of between a forecast and an outcome.
import copy as _copy
before = {"1003": {"s": {"2025": {"cy": 1200, "ct": 9, "cfd": 40}}}}
after = _copy.deepcopy(before)
bp.audit_against_nflverse(after, {"1003": "00-01"}, {2025: {"00-01": {
    "receiving_yards": "999", "receiving_tds": "1", "receiving_first_downs": "2",
    "player_display_name": "Test Player"}}})
check("the audit leaves every stored value exactly as it found it", after, before)


# ---- 17. app.js has the other half of every scoring rule -----------------
#
# The build already refuses to write when a SCOREABLE stat has no home in
# STAT_FIELDS. This is the other direction, and it is just as silent:
# pointsUnder() walks the rules object, so a stat with no default in app.js
# is summed as zero and nothing says a word.
#
# It runs against the real app.js rather than a fixture, because a fixture
# would prove the parser works and not that the two files agree.
_here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_cwd = os.getcwd()
os.chdir(_here)
try:
    bp.check_app_rules()
    check("every scoreable stat has a default, a group and a label in app.js",
          True, True)
except SystemExit as error:
    check("every scoreable stat has a default, a group and a label in app.js",
          str(error), "no problems")
finally:
    os.chdir(_cwd)

# ---- 18. the usage block ------------------------------------------------
#
# The one thing nflverse writes into a record. Everything else it does is a
# report, so this is the only place a third party can put a number into
# stats.js at all -- which is why the outage case below matters as much as
# the happy one.
def usage_row(**kw):
    row = {"target_share": "", "air_yards_share": "", "wopr": "",
           "receiving_epa": "", "rushing_epa": "", "passing_epa": "",
           "passing_cpoe": "", "rushing_20": "", "gwfg_att": "", "gwfg_made": ""}
    row.update(kw)
    return row


records = {"1003": {"s": {"2025": {"cy": 1200}}}}
written = bp.build_usage(records, {"1003": "00-01"}, {2025: {"00-01": usage_row(
    target_share="0.30412", air_yards_share="0.3341", wopr="0.6903",
    receiving_epa="41.44", rushing_20="3")}})
check("a usage block is written under `u`, keyed by season like `s`",
      records["1003"].get("u"),
      {"2025": {"ts": 0.304, "ays": 0.334, "wo": 0.69, "ep": 41.4, "r20": 3}})
check("and it is counted", written, 1)
check("the season block beside it is untouched",
      records["1003"]["s"], {"2025": {"cy": 1200}})

# A zero and a missing value read identically on a sheet, and this file is a
# plain <script src> in front of every first paint. Both are dropped.
records = {"1003": {}}
bp.build_usage(records, {"1003": "00-01"},
               {2025: {"00-01": usage_row(target_share="0", receiving_epa="12.5")}})
check("a zero is dropped rather than stored",
      records["1003"]["u"], {"2025": {"ep": 12.5}})

records = {"1003": {}}
bp.build_usage(records, {"1003": "00-01"}, {2025: {"00-01": usage_row()}})
check("a row with nothing in it writes no `u` at all", "u" in records["1003"], False)

# Air yards go negative -- a screen pass is caught behind the line -- so the
# sign is meaningful rather than dirty, and it must survive being stored.
records = {"1003": {}}
bp.build_usage(records, {"1003": "00-01"},
               {2025: {"00-01": usage_row(air_yards_share="-0.003")}})
check("a negative air-yards share is kept, not clamped or dropped",
      records["1003"]["u"], {"2025": {"ays": -0.003}})

# The outage path. nflverse down, or a season not played yet, both arrive
# as no rows -- and the board must be identical either way.
records = {"1003": {"s": {"2025": {"cy": 1200}}}}
before = _copy.deepcopy(records)
check("no nflverse rows writes no usage", bp.build_usage(records, {}, {}), 0)
check("and leaves every record exactly as it found it", records, before)

records = {"1003": {"s": {"2025": {"cy": 1200}}}}
bp.build_usage(records, {"1003": "00-01"}, {2025: {}})
check("a linked player with no row that season gets no `u`",
      "u" in records["1003"], False)

# USAGE_FIELDS may not name a Sleeper key. compact() resolves STAT_FIELDS
# source names against the raw Sleeper row, so a collision would quietly
# store Sleeper's number under an nflverse label and stay plausible.
check("no usage short key collides with a stored stat short key",
      sorted(set(s for s, _, _ in bp.USAGE_FIELDS) & set(bp.STAT_FIELDS.values())),
      [])
check("no usage source column is a Sleeper key name",
      sorted(set(c for _, c, _ in bp.USAGE_FIELDS) & set(bp.STAT_FIELDS)), [])

# ---- 19. expected points ride the same block ----------------------------
#
# fetch_expected_points() output merges into the same per-season `u` block
# under xf/xd, on the same gsis id. The seasons walked are the union of the
# two feeds, so either one being down costs its own columns and nothing else.
records = {"1003": {}}
bp.build_usage(records, {"1003": "00-01"},
               {2025: {"00-01": usage_row(receiving_epa="12.5")}},
               {2025: {"00-01": {"xf": 180.3, "xd": -12.1}}})
check("expected points merge into the same season block",
      records["1003"]["u"], {"2025": {"ep": 12.5, "xf": 180.3, "xd": -12.1}})

records = {"1003": {}}
bp.build_usage(records, {"1003": "00-01"}, {},
               {2024: {"00-01": {"xf": 95.0}}})
check("an nflverse outage does not silently drop xFP with it",
      records["1003"]["u"], {"2024": {"xf": 95.0}})

records = {"1003": {}}
bp.build_usage(records, {"1003": "00-01"},
               {2025: {"00-01": usage_row(receiving_epa="12.5")}},
               {2025: {}})
check("no expected points leaves the block exactly as before",
      records["1003"]["u"], {"2025": {"ep": 12.5}})

check("xf/xd do not collide with a stored stat short key",
      sorted({"xf", "xd"} & set(bp.STAT_FIELDS.values())), [])
check("xf/xd do not collide with another usage short key",
      sorted({"xf", "xd"} & set(s for s, _, _ in bp.USAGE_FIELDS)), [])


# ---- N. extending past real ADP with Sleeper's own deeper pool ----------
#
# Real ADP for this format is one player; the pool behind it deliberately
# includes everything that should be excluded -- an id already on the real
# list, a player with no team (retired or a free agent), a position that
# isn't fantasy-relevant (a long snapper), and a team defense keyed by team
# code the way Sleeper's own master actually stores one -- so a wrong
# exclusion or a wrong inclusion shows up as a wrong id in the result
# rather than merely a wrong count.
DEEP_SLEEPER = {
    "1001": {"full_name": "Real Starter", "position": "QB", "team": "BUF", "search_rank": 5},
    "2001": {"full_name": "Bench Guy One", "position": "RB", "team": "DET", "search_rank": 300},
    "2002": {"full_name": "Bench Guy Two", "position": "WR", "team": "MIA", "search_rank": 100},
    "2003": {"full_name": "No Team Guy",   "position": "WR", "team": None,  "search_rank": 1},
    "2004": {"full_name": "Ray Guy",       "position": "LS", "team": "DAL", "search_rank": 1},
    "2005": {"full_name": "No Rank Guy",   "position": "TE", "team": "NYJ"},
    "MIA":  {"position": "DEF", "team": "MIA"},
}
DEEP_PLAYERS = [
    {"id": "1001", "name": "Real Starter", "pos": "QB", "team": "BUF", "bye": 7,
     "adp": 1.0, "sd": 1.1, "td": 40, "inj": "", "_entry": DEEP_SLEEPER["1001"]},
]
DEEP_BYES = {"BUF": 7, "DET": 8, "MIA": 11, "NYJ": 9}

no_op = bp.extend_deep_bench(list(DEEP_PLAYERS), DEEP_SLEEPER, DEEP_BYES, target=1)
check("nothing to add once the target is already met", no_op, DEEP_PLAYERS)

extended = bp.extend_deep_bench(list(DEEP_PLAYERS), DEEP_SLEEPER, DEEP_BYES, target=5)
check("real ADP is left in place, first", extended[0]["id"], "1001")
check("ranked by search_rank -- lowest (best-known) first, ties in candidate order",
      [p["id"] for p in extended[1:]], ["2002", "2001", "2005", "MIA"])
check("an id already on the real list is never duplicated",
      "1001" in [p["id"] for p in extended[1:]], False)
check("no team means no candidacy", "2003" in [p["id"] for p in extended], False)
check("a position outside FANTASY_POSITIONS is never added",
      "2004" in [p["id"] for p in extended], False)

added = extended[1:]
check("every extension carries deep: true", all(p.get("deep") is True for p in added), True)
check("no real ADP sample behind these, so sd/td are both zero",
      [(p["sd"], p["td"]) for p in added], [(0.0, 0)] * 4)
check("adp continues past the real sequence rather than restarting it",
      [p["adp"] for p in added], [2.0, 3.0, 4.0, 5.0])
check("bye comes from the team lookup built off real ADP rows, not a fetch of its own",
      [p["bye"] for p in added], [11, 8, 9, 11])
check("a team defense gets the same city name join_rows() gives one",
      extended[4]["name"], "Miami Defense")

exhausted = bp.extend_deep_bench(list(DEEP_PLAYERS), DEEP_SLEEPER, DEEP_BYES, target=50)
check("stops once the real pool runs out, rather than inventing players to hit target",
      len(exhausted), 1 + 4)

# A player Sleeper only carries as first_name/last_name (no full_name) still
# gets a real name -- join_rows()'s own ADP rows never hit this path (FFC
# always sends a name), but Sleeper's master sometimes has no full_name for
# a player nobody has looked up yet.
NO_FULL_NAME = {
    "1001": DEEP_SLEEPER["1001"],
    "4001": {"first_name": "Fallback", "last_name": "Name", "position": "RB",
              "team": "CHI", "search_rank": 1},
}
fallback = bp.extend_deep_bench(list(DEEP_PLAYERS), NO_FULL_NAME, DEEP_BYES, target=2)
check("first_name + last_name stands in for a missing full_name",
      fallback[1]["name"], "Fallback Name")


print()
if FAILURES:
    print(f"{len(FAILURES)} FAILED: " + ", ".join(FAILURES))
    sys.exit(1)
print("OK")
