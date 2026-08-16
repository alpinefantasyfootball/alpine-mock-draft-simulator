#!/usr/bin/env python3
"""
Rebuild players.js and stats.js from live data.

Sources (all free, no key, no account -- except the last, which is optional)
  https://api.sleeper.app/v1/players/nfl                    player master, injury, depth chart
  https://api.sleeper.app/v1/stats/nfl/regular/{season}     season totals
  https://api.sleeper.app/v1/stats/nfl/regular/{yr}/{wk}    weekly game logs
  https://api.sleeper.app/v1/projections/nfl/regular/{yr}   projections
  https://fantasyfootballcalculator.com/api/v1/adp/{format} ADP, one set per scoring format
  .../getNFLPlayerList (Tank01, via RapidAPI)               source-id crosswalk, needs TANK01_KEY

TANK01_KEY is read from the environment and is optional. Without it the
crosswalk step is skipped, the build is otherwise identical, and player news
stays switched off in the app. Nothing here may depend on a third party being
up in order to produce a board.

Sleeper asks that these be called no more than once a day.
FFC asks for attribution.

This writes raw components only. Fantasy points are NOT computed here — app.js
applies the scoring rules in the browser, so a league can change them without
rebuilding this data. Sleeper's own pts_half_ppr is ignored for the same
reason it always was: it bakes in assumptions we do not share.

Run by hand:  python scripts/build_players.py
"""

import json
import os
import re
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone

SLEEPER = "https://api.sleeper.app/v1"

FFC_URL = ("https://fantasyfootballcalculator.com/api/v1/adp/{fmt}"
           "?teams={teams}&year={year}&position=all")
ADP_YEAR = 2026

# One ADP set per scoring format, because the draft room can now be set to any
# of the three and 10-team half-PPR ADP would misprice a full-PPR draft by a
# round or more. The short key is what app.js looks up from league.scoring.
#
# Team count is deliberately NOT a second axis. FFC takes a teams= parameter and
# echoes it back in the response meta, but it does not filter the underlying
# sample: 8, 10, 12 and 14 all return the same rows, the same ADP and the same
# total_drafts (checked across 2024, 2025 and 2026). Requesting four team counts
# would write four identical copies of each set and imply a precision the feed
# does not have. If FFC ever starts breaking the sample out by team size, add
# the axis here and widen the key.
ADP_FORMATS = {"standard": "standard", "half": "half-ppr", "ppr": "ppr"}
DEFAULT_FORMAT = "half"          # the Alpine league, and the app's fallback
FFC_TEAMS = 10                   # sent for correctness; see the note above

PLAYERS_FILE = "players.js"
STATS_FILE = "stats.js"
UNMATCHED_FILE = "unmatched.txt"

KEEP = 320             # players written per ADP set (FFC currently returns 205-258)
WEEKLY_KEEP = 180      # players who also get week-by-week game logs
# Every season back to 2018 covers the full career of essentially any player
# with 2026 draft relevance. Seasons that return nothing are skipped, so this
# is self-limiting if Sleeper's history does not reach that far.
STAT_SEASONS = list(range(2018, 2026))

# Week-by-week logs, newest first. Two seasons, not more.
#
# Season totals above already go back to 2018, which is what a career table
# wants. Weekly rows answer a different and narrower question during a draft
# -- is he trending up, and what did the injury year look like -- and that is
# last season and the one before it. Each season costs about 184KB in
# stats.js, which is a plain script tag on a page with no build step, so a
# five-year selector would put a megabyte of render-blocking JSON in front of
# a phone to answer a question nobody asks mid-draft.
WEEKLY_SEASONS = [2025, 2024]
WEEKLY_WEEKS = 18
PROJECTION_SEASON = 2026

# Past seasons' projections, kept beside the actuals so the app can be held to
# what it said. Until now only the coming season was stored and it was
# overwritten nightly, which meant the one question worth asking of a
# projection -- was it any good -- had no data behind it at all. Season totals
# reach back to 2018 and every one of them is a graded answer to a forecast
# nobody kept.
#
# Three back rather than all of them. A projection block is about the size of a
# season block, so each year costs roughly what a year of actuals costs in a
# file that is a plain script tag on a page with no build step, and three is
# enough to separate a model that is calibrated from one that had a good year.
#
# Whether Sleeper serves these at all is a question this cannot answer from
# here: the endpoint takes a year, and asking for a past one may return the
# preseason forecast, the in-season revision, or nothing. Each fetch is
# optional and the counts are printed, so a season that comes back empty is
# visible in the run rather than silently absent from the file. If they all
# come back empty this list still earns its place going forward -- next year's
# run finds 2026 in it.
PROJECTION_HISTORY = [2025, 2024, 2023]

POSITION_MAP = {"QB": "QB", "RB": "RB", "WR": "WR", "TE": "TE",
                "PK": "K", "K": "K", "DEF": "DST", "DST": "DST"}

TEAM_ALIASES = {"JAC": "JAX", "LA": "LAR", "WSH": "WAS", "SD": "LAC",
                "OAK": "LV", "STL": "LAR", "ARZ": "ARI", "BLT": "BAL",
                "CLV": "CLE", "HST": "HOU"}

TEAM_CITIES = {
    "ARI": "Arizona", "ATL": "Atlanta", "BAL": "Baltimore", "BUF": "Buffalo",
    "CAR": "Carolina", "CHI": "Chicago", "CIN": "Cincinnati", "CLE": "Cleveland",
    "DAL": "Dallas", "DEN": "Denver", "DET": "Detroit", "GB": "Green Bay",
    "HOU": "Houston", "IND": "Indianapolis", "JAX": "Jacksonville",
    "KC": "Kansas City", "LAC": "LA Chargers", "LAR": "LA Rams", "LV": "Las Vegas",
    "MIA": "Miami", "MIN": "Minnesota", "NE": "New England", "NO": "New Orleans",
    "NYG": "NY Giants", "NYJ": "NY Jets", "PHI": "Philadelphia", "PIT": "Pittsburgh",
    "SEA": "Seattle", "SF": "San Francisco", "TB": "Tampa Bay", "TEN": "Tennessee",
    "WAS": "Washington",
}

INJURY_CODES = {
    "questionable": "Q", "doubtful": "D", "out": "O",
    "ir": "IR", "injured reserve": "IR",
    "pup": "PUP", "physically unable to perform": "PUP",
    "nfi": "NFI", "non football injury": "NFI",
    "sus": "SUS", "suspended": "SUS", "dnr": "DNR", "cov": "COV",
}

MANUAL_MATCHES = {
    # "Some Awkward Name": "1234",
}

# ---------------------------------------------------------------- scoring
#
# There isn't any, and that is the point. This pipeline used to apply one
# league's scoring and bake a points total into stats.js, which meant the
# browser could never rescore anybody and every scoring question needed a
# rebuild. A data pipeline should record facts, not opinions about how to
# value them, so the rules now live in app.js and this file writes raw
# components only.
#
# The one thing that does have to be shared is which short key holds which
# raw stat. Rather than write that map out again in JavaScript and let the
# two drift, it is generated into stats.js from STAT_FIELDS below.
#
# Anything scoreable must appear in STAT_FIELDS. A stat that was never
# stored can never be rescored.

# Scoring inputs, in the order the editor shows them. Values are not stored
# here — app.js owns those — but the pipeline has to know which raw stats
# are scoreable so it can emit the key map and flag anything unstored.
SCOREABLE = [
    "pass_yd", "pass_td", "pass_int", "pass_2pt",
    "pass_att", "pass_cmp", "pass_fd",
    "rush_yd", "rush_td", "rush_2pt", "rush_fd",
    "rec", "rec_yd", "rec_td", "rec_2pt", "rec_fd", "rec_40p",
    "fum_lost", "kr_td", "pr_td",
    "xpm", "xpmiss", "fgmiss",
    "fgm_0_19", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50_59", "fgm_60p",
    "sack", "int", "fum_rec", "safe",
    "def_td", "def_st_td", "blk_kick", "def_2pt",
    "pts_allow_0", "pts_allow_1_6", "pts_allow_7_13", "pts_allow_14_20",
    "pts_allow_21_27", "pts_allow_28_34", "pts_allow_35p",
]

# Raw counting stats worth keeping, and the short key used in stats.js.
#
# This is the whole point of the pipeline: record facts, not opinions about
# how to value them. Anything the browser might need to score has to be here,
# because a stat that was never stored can never be rescored. Sparse by
# design — compact() drops every zero, so a running back carries no kicking
# fields and a defense carries no receiving ones.
STAT_FIELDS = {
    # --- passing ---
    "pass_att": "pa", "pass_cmp": "pc", "pass_yd": "py", "pass_td": "pt",
    "pass_int": "pi", "pass_2pt": "p2", "pass_fd": "pfd",
    # --- rushing ---
    "rush_att": "ra", "rush_yd": "ry", "rush_td": "rt", "rush_2pt": "r2",
    "rush_fd": "rfd",
    # --- receiving ---
    # rec_40p is a catch of 40 or more yards, not a bonus on one. Sleeper
    # forecasts it, unlike every other big-play key it carries.
    "rec_tgt": "tg", "rec": "rc", "rec_yd": "cy", "rec_td": "ct",
    "rec_2pt": "c2", "rec_fd": "cfd", "rec_40p": "c40",
    # --- returns and fumbles ---
    "kr": "kr", "kr_yd": "kry", "kr_td": "krt",
    "pr": "pr", "pr_yd": "pry", "pr_td": "prt",
    "fum_lost": "fl",
    # --- kicking, by distance ---
    # Sleeper does separate 50-59 from 60+, despite an older comment in this
    # file claiming otherwise, so a league paying more for the long ones can
    # be scored exactly rather than approximated.
    "fgm": "fg", "xpm": "xp", "xpmiss": "xpx", "fgmiss": "fgx",
    "fgm_0_19": "f19", "fgm_20_29": "f29", "fgm_30_39": "f39",
    "fgm_40_49": "f49", "fgm_50_59": "f59", "fgm_60p": "f60",
    # --- defense and special teams ---
    "sack": "sk", "int": "in", "fum_rec": "fr", "safe": "sf",
    "def_td": "dtd", "def_st_td": "sttd", "blk_kick": "bk", "def_2pt": "d2",
    # Raw points and yards allowed, as well as Sleeper's own banded counts.
    # The raw number lets a weekly line be banded any way a league likes;
    # the banded counts are the only option for a season total, where the
    # per-game bands have already been collapsed and cannot be recovered.
    "pts_allow": "ptsa", "yds_allow": "ydsa",
    "pts_allow_0": "d0", "pts_allow_1_6": "d1", "pts_allow_7_13": "d7",
    "pts_allow_14_20": "d14", "pts_allow_21_27": "d21",
    "pts_allow_28_34": "d28", "pts_allow_35p": "d35",
}

# Keys we knowingly ignore, so the diagnostic below stays useful.
IGNORED_KEYS = {
    "gp", "gs", "gms_active", "team", "off_snp", "tm_off_snp", "tm_def_snp",
    "tm_st_snp", "def_snp", "st_snp", "pts_std", "pts_ppr", "pts_half_ppr",
    "rank_std", "rank_ppr", "rank_half_ppr", "pos_rank_std", "pos_rank_ppr",
    "pos_rank_half_ppr", "anytime_tds", "tm_st_snp_pct",
    # Folded into the finer buckets by reconcile(), so not a gap.
    "fgm_50p", "fgmiss_50p",
}


# ---------------------------------------------------------------- helpers

def fetch_json(url, optional=False):
    request = urllib.request.Request(url, headers={"User-Agent": "alpine-draft-room/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.load(response)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as error:
        if optional:
            print(f"  ! skipped {url} ({error})")
            return {}
        raise


def fetch_json_headers(url, headers, optional=False):
    """fetch_json with request headers, for a source that needs a key.

    Split out rather than adding a parameter to fetch_json, because every
    caller of that one is a free public feed and should stay obviously so.
    A key is a different kind of dependency and it reads better named.
    """
    merged = {"User-Agent": "alpine-draft-room/1.0"}
    merged.update(headers or {})
    request = urllib.request.Request(url, headers=merged)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.load(response)
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as error:
        if optional:
            print(f"  ! skipped {url} ({error})")
            return {}
        raise


def normalise(name):
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    text = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", " ", text)
    return re.sub(r"[^a-z]", "", text)


def clean_team(code):
    return TEAM_ALIASES.get((code or "FA").upper(), (code or "FA").upper())


def injury_code(entry):
    for field in ("injury_status", "status"):
        value = (entry.get(field) or "").strip().lower()
        if value in INJURY_CODES:
            return INJURY_CODES[value]
    return ""


SEEN_KEYS = set()


def reconcile(row):
    """Fold Sleeper's coarse projection keys into the shape its actuals use.

    Projections are a coarser dataset than season and weekly lines. They carry
    a combined fgm_50p where actuals carry fgm_50_59 and fgm_60p, and they
    express misses only as fgmiss_50p. Left alone, a kicker's projection loses
    every 50-yard field goal — 183 of them across 34 kickers — while his
    history keeps them, which makes the projection look far worse than the
    player.

    Checked against 2025: fgm_50p equals fgm_50_59 + fgm_60p on every row that
    carries both, so folding it in cannot double count. Everything 50+ is
    attributed to 50-59 rather than split, because projected 60-yarders are
    rare enough (10 all last season against 158 from 50-59) that splitting
    would be inventing precision the feed does not have.
    """
    if row.get("fgm_50p") and not row.get("fgm_50_59") and not row.get("fgm_60p"):
        row = dict(row)
        row["fgm_50_59"] = row["fgm_50p"]
    if row.get("fgmiss_50p") and not row.get("fgmiss"):
        row = dict(row) if row is not None else {}
        row["fgmiss"] = row["fgmiss_50p"]
    return row


def compact(row):
    """Keep the listed stats, and only where they are non-zero."""
    SEEN_KEYS.update(row.keys())
    row = reconcile(row)
    out = {}
    for source, short in STAT_FIELDS.items():
        value = row.get(source)
        if value:
            out[short] = round(float(value), 1) if isinstance(value, float) else int(value)
    return out


# ---------------------------------------------------------------- source ids
#
# One player, several providers, each with its own id. `x` on a stats record
# holds the foreign keys, so anything we add later joins to the same player
# without a second lookup at request time -- which is the part that matters.
# A name search performed while somebody is reading a profile is how one Josh
# Allen ends up wearing the other one's news, and every number around it would
# still be right.
#
# The key is read from the environment and never written down here. With no
# key the whole step is skipped, the build succeeds, and the app carries on
# exactly as it does today: no `x`, so no news. A pipeline that needs a
# third party to be up in order to produce a board is not a pipeline this
# project wants.
TANK01_KEY = os.environ.get("TANK01_KEY", "")
TANK01_HOST = "tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com"

# One call, not thirty-two. The free tier allows a thousand a month and the
# workflow runs daily, so per-team rosters (32 x 30 = 960) would spend the
# entire allowance on the crosswalk alone and leave nothing for the news the
# crosswalk exists to serve. getNFLPlayerList is the whole league in one.
TANK01_LIST = f"https://{TANK01_HOST}/getNFLPlayerList"


def fetch_tank01_players():
    """Every Tank01 player, or nothing at all. Never fatal."""
    if not TANK01_KEY:
        print("Tank01: no TANK01_KEY set, skipping the source-id crosswalk")
        return []

    print("Fetching Tank01 player list...")
    body = fetch_json_headers(TANK01_LIST, {
        "x-rapidapi-key": TANK01_KEY,
        "x-rapidapi-host": TANK01_HOST,
    }, optional=True)

    rows = body.get("body") if isinstance(body, dict) else body
    rows = rows if isinstance(rows, list) else []
    print(f"  {len(rows)} players")
    return rows


def link_source_ids(stats, sleeper, indexes, tank_rows):
    """Attach Tank01 ids to our records, and report anything that did not.

    Two joins, in order of how much they can be trusted:

    1. Their `sleeperBotID`, if they carry it. That is an identifier both
       sides already agree on, so there is nothing to get wrong.
    2. Failing that, the same name/position/team match the ADP join uses.
       Reused rather than reimplemented -- a second normalise() that drifted
       from the first would be the same class of bug as a league shape
       written down twice.

    Returns (linked, report_lines). Everything that fails is in the report:
    a crosswalk that misses quietly is worse than no crosswalk, because a
    wrong match does not look wrong on the page.
    """
    by_name_pos_team, by_name_pos, _by_name = indexes
    linked, report = {}, []
    claimed = {}                        # our id -> their id, to catch collisions
    method = {}                         # our id -> how it was matched

    for row in tank_rows:
        their_id = str(row.get("playerID") or "").strip()
        if not their_id:
            continue

        name = (row.get("longName") or row.get("espnName") or "").strip()
        position = POSITION_MAP.get((row.get("pos") or "").upper())
        team = clean_team(row.get("team"))

        # 1. The identifier they already share with us.
        our_id = str(row.get("sleeperBotID") or "").strip()
        how = "sleeperBotID"

        # 2. Name, position and team, strictest first -- and only for players
        #    we actually carry, so the report is about our pool rather than
        #    about every practice-squad player in the league.
        if not our_id or our_id not in stats:
            our_id = ""
            key = normalise(name)
            if key and position:
                match = (by_name_pos_team.get((key, position, team))
                         or by_name_pos.get((key, position)))
                if match:
                    our_id = match[0]
                    how = "name+pos+team"

        if not our_id or our_id not in stats:
            continue

        # Two of theirs pointing at one of ours means the join is wrong, not
        # that the player has two ids. Report it and keep neither, because
        # picking one at random is how the wrong news gets served.
        if our_id in claimed and claimed[our_id] != their_id:
            report.append(f"COLLISION | {name} | {position} | {team} | "
                          f"{claimed[our_id]} and {their_id} both map to {our_id}")
            linked.pop(our_id, None)
            continue

        claimed[our_id] = their_id
        linked[our_id] = their_id
        method[our_id] = how

    # What we hold and could not link. This is the list that matters: every
    # one of these is a player whose sheet will have no news, and silence
    # about it is exactly what unmatched.txt exists to prevent.
    for our_id, record in stats.items():
        if our_id in linked:
            continue
        entry = sleeper.get(our_id) or {}
        name = entry.get("full_name") or entry.get("last_name") or our_id
        pos = entry.get("position") or "?"
        report.append(f"{name} | {pos} | {clean_team(entry.get('team'))} | "
                      f"no Tank01 id")

    # Counted from what survived, not from what was attempted. Tallying as we
    # went made a collision read "1 on sleeperBotID" beside "linked 0", and a
    # duplicated row count twice -- a number that disagrees with the thing it
    # is describing is how you stop trusting the numbers.
    direct = sum(1 for k in linked if method.get(k) == "sleeperBotID")
    fallback = len(linked) - direct
    print(f"  linked {len(linked)} of {len(stats)} "
          f"({direct} on sleeperBotID, {fallback} on name)")
    if tank_rows and not direct:
        # Worth saying plainly: it means the good join is not available and
        # every row came from name matching, which is the fragile one.
        print("  ! no sleeperBotID on any row -- every link came from a name")
    return linked, report


def index_sleeper(sleeper):
    """Index the Sleeper master three ways, strictest first, so a name that is
    ambiguous on its own can still be matched on position and team."""
    by_name_pos_team, by_name_pos, by_name = {}, {}, {}

    for player_id, entry in sleeper.items():
        if entry.get("position") not in ("QB", "RB", "WR", "TE", "K", "DEF"):
            continue
        key = normalise(entry.get("full_name") or entry.get("last_name") or "")
        if not key:
            continue
        record = (player_id, entry)
        position = entry["position"]
        team = clean_team(entry.get("team"))
        by_name_pos_team.setdefault((key, position, team), record)
        by_name_pos.setdefault((key, position), record)
        by_name.setdefault(key, []).append(record)

    return by_name_pos_team, by_name_pos, by_name


def join_rows(adp_rows, sleeper, indexes):
    """Turn one format's FFC rows into player records carrying a Sleeper id.

    Runs once per scoring format. Anything that fails to join is returned
    separately rather than dropped, so unmatched.txt can report it.
    """
    by_name_pos_team, by_name_pos, by_name = indexes
    players, unmatched = [], []

    for row in adp_rows:
        position = POSITION_MAP.get((row.get("position") or "").upper())
        if position is None:
            continue

        team = clean_team(row.get("team"))
        name = (row.get("name") or "").strip()
        key = normalise(name)
        sleeper_position = "DEF" if position == "DST" else position
        match = None

        if position == "DST":
            entry = sleeper.get(team)
            if entry:
                match = (team, entry)
            name = f"{TEAM_CITIES.get(team, team)} Defense"

        if match is None and name in MANUAL_MATCHES:
            manual = MANUAL_MATCHES[name]
            if manual in sleeper:
                match = (manual, sleeper[manual])
        if match is None:
            match = by_name_pos_team.get((key, sleeper_position, team))
        if match is None:
            match = by_name_pos.get((key, sleeper_position))
        if match is None:
            candidates = by_name.get(key, [])
            if len(candidates) == 1:
                match = candidates[0]

        player_id, entry = match if match else ("", {})
        if not match:
            unmatched.append(f"{name} | {position} | {team} | ADP {row.get('adp')}")

        players.append({
            "id": player_id, "name": name, "pos": position, "team": team,
            "bye": int(row.get("bye") or 0),
            "adp": round(float(row.get("adp") or 999), 1),
            "inj": injury_code(entry), "_entry": entry,
        })

    players.sort(key=lambda p: p["adp"])
    return players[:KEEP], unmatched


def player_line(player):
    """One line of the PLAYERS array, as it appears in players.js."""
    return ('  {{ id: "{id}", name: "{name}", pos: "{pos}", team: "{team}", '
            'bye: {bye}, adp: {adp}, inj: "{inj}" }}'.format(
                id=player["id"], name=player["name"].replace('"', "'"),
                pos=player["pos"], team=player["team"], bye=player["bye"],
                adp=player["adp"], inj=player["inj"]))


# ---------------------------------------------------------------- main

def main():
    print("Fetching Sleeper player master...")
    sleeper = fetch_json(f"{SLEEPER}/players/nfl")
    print(f"  {len(sleeper)} players")

    print("Fetching FFC ADP, one set per scoring format...")
    adp_raw = {}
    for key, fmt in ADP_FORMATS.items():
        url = FFC_URL.format(fmt=fmt, teams=FFC_TEAMS, year=ADP_YEAR)
        rows = fetch_json(url, optional=(key != DEFAULT_FORMAT)).get("players", [])
        if rows:
            adp_raw[key] = rows
        print(f"  {key:<9} {len(rows)} rows")

    season_stats = {}
    for season in STAT_SEASONS:
        print(f"Fetching {season} season stats...")
        data = fetch_json(f"{SLEEPER}/stats/nfl/regular/{season}", optional=True)
        if data:
            season_stats[season] = data
        print(f"  {len(data)} lines")

    print(f"Fetching {PROJECTION_SEASON} projections...")
    projections = fetch_json(
        f"{SLEEPER}/projections/nfl/regular/{PROJECTION_SEASON}", optional=True)
    print(f"  {len(projections)} lines")

    # The same endpoint, pointed at seasons that have already been played. A
    # year that returns nothing simply does not appear, exactly as a missing
    # season of actuals does.
    past_projections = {}
    for season in PROJECTION_HISTORY:
        print(f"Fetching {season} projections (archive)...")
        data = fetch_json(
            f"{SLEEPER}/projections/nfl/regular/{season}", optional=True)
        if data:
            past_projections[season] = data
        print(f"  {len(data)} lines")

    # Optional, keyed, and never fatal: no key means no crosswalk and a build
    # that is otherwise identical to today's.
    tank_rows = fetch_tank01_players()

    # Keyed by season, then week. A season that returns nothing simply does
    # not appear, so the app draws a selector of the years it actually has
    # rather than a tab that opens onto an empty table.
    weekly = {}
    for season in WEEKLY_SEASONS:
        print(f"Fetching {season} weekly game logs...")
        got = {}
        for week in range(1, WEEKLY_WEEKS + 1):
            data = fetch_json(
                f"{SLEEPER}/stats/nfl/regular/{season}/{week}", optional=True)
            if data:
                got[week] = data
        if got:
            weekly[season] = got
        print(f"  {len(got)} weeks")

    # ---- join every ADP set to Sleeper records ----
    indexes = index_sleeper(sleeper)

    sets, unmatched = {}, []
    for key in ADP_FORMATS:
        if key not in adp_raw:
            print(f"  ! no {key} ADP, that set will be missing from players.js")
            continue
        joined, missed = join_rows(adp_raw[key], sleeper, indexes)
        sets[key] = joined
        # The same player fails to join in every set, so report each name once.
        for line in missed:
            if line not in unmatched:
                unmatched.append(line)

    if DEFAULT_FORMAT not in sets:
        raise SystemExit(f"No {DEFAULT_FORMAT} ADP: refusing to write a players.js "
                         "the app cannot fall back to.")

    players = sets[DEFAULT_FORMAT]

    # Stats are keyed by Sleeper id and shared by every set, so they have to
    # cover the union. PPR runs deeper than half-PPR, and a player who only
    # appears in the deeper set still needs his stat line. Ranked by each
    # player's best ADP across the sets, so the weekly-log cut stays meaningful.
    best_adp, union = {}, {}
    for joined in sets.values():
        for player in joined:
            if not player["id"]:
                continue
            if player["id"] not in union or player["adp"] < best_adp[player["id"]]:
                best_adp[player["id"]] = player["adp"]
                union[player["id"]] = player

    pool = sorted(union.values(), key=lambda p: p["adp"])

    # ---- build stats.js ----
    stats = {}
    for rank, player in enumerate(pool):
        player_id = player["id"]
        if not player_id:
            continue
        entry = player["_entry"]
        record = {}

        if entry.get("age"):
            record["age"] = int(entry["age"])
        if entry.get("years_exp") is not None:
            record["exp"] = int(entry["years_exp"])

        # Bio. Already in the player feed we fetch, previously thrown away.
        # It is the top line of a player profile everywhere else in fantasy,
        # and it costs a few bytes a head.
        if entry.get("height"):
            record["ht"] = str(entry["height"])
        if entry.get("weight"):
            record["wt"] = str(entry["weight"])
        if entry.get("college") and entry["college"] != "-":
            record["col"] = entry["college"]
        if entry.get("number") is not None:
            record["no"] = int(entry["number"])
        if entry.get("depth_chart_position"):
            record["depth"] = entry["depth_chart_position"]
        if entry.get("depth_chart_order") is not None:
            record["order"] = int(entry["depth_chart_order"])

        seasons = {}
        for season in sorted(season_stats):
            line = season_stats[season].get(player_id)
            if not line:
                continue
            games = int(line.get("gp") or 0)
            block = compact(line)
            # A season the player was not in the league: no games, and not a
            # single counting stat. Judged on the raw data now that there is
            # no points total to judge it by.
            if games == 0 and not block:
                continue
            block["gp"] = games
            seasons[str(season)] = block
        if seasons:
            record["s"] = seasons

        projection = projections.get(player_id)
        if projection:
            block = compact(projection)
            # gp is what tells the app this is a real forecast rather than a
            # zero-filled row. Sleeper returns those for players it has no
            # opinion on, and counting them as real projections once dragged
            # replacement level toward zero.
            block["gp"] = int(projection.get("gp") or 0)
            record["p"] = block

        # What we said about seasons that have since been played, keyed the
        # same way the actuals in "s" are, so the two line up by year without
        # the app having to know anything about how either was fetched. Same
        # gp test as above: a zero-filled row is not a forecast.
        past = {}
        for season in sorted(past_projections):
            line = past_projections[season].get(player_id)
            if not line:
                continue
            block = compact(line)
            games = int(line.get("gp") or 0)
            if games == 0 and not block:
                continue
            block["gp"] = games
            past[str(season)] = block
        if past:
            record["pp"] = past

        if rank < WEEKLY_KEEP:
            by_season = {}
            for season, weeks in weekly.items():
                logs = []
                for week in sorted(weeks):
                    line = weeks[week].get(player_id)
                    if not line:
                        continue
                    block = compact(line)
                    block["w"] = week
                    logs.append(block)
                if logs:
                    by_season[str(season)] = logs
            if by_season:
                record["w"] = by_season

        if record:
            stats[player_id] = record

    # ---- source ids ----
    #
    # After the records exist, because the join is against the pool we
    # actually carry rather than against every player either source knows
    # about. Attached to stats.js and not players.js: the same player appears
    # once per scoring format there, so an id would be stored three times and
    # could disagree with itself.
    source_ids, source_report = link_source_ids(stats, sleeper, indexes, tank_rows)
    for our_id, their_id in source_ids.items():
        stats[our_id]["x"] = {"tank": their_id}

    # ---- which scoreable stats the forecast actually carries ----
    #
    # Sleeper's projections are far coarser than its actuals: it forecasts
    # first downs but not a single 40-yard-touchdown bonus, forced fumble or
    # target. A rule over a stat it never projects still scores history and
    # week-by-week logs correctly, but contributes exactly zero to the 2026
    # numbers the draft board is built from.
    #
    # That is the kind of silent nothing this project refuses to ship, so the
    # set is measured here rather than written down, and the scoring editor
    # labels every rule with whether it moves the projection. Measured, so it
    # self-corrects the season Sleeper starts or stops forecasting something.
    # Measured through reconcile(), not off the raw feed: the coarse kicking
    # keys only become fgm_50_59 and fgmiss after folding, and reading the raw
    # rows marked both history-only when the app scores them from a real
    # projected value. A wrong label here is worse than no label.
    reconciled = [reconcile(line) for line in projections.values()]
    projected_keys = sorted(
        stat for stat in SCOREABLE
        if any((line.get(stat) or 0) for line in reconciled)
    )
    print(f"  {len(projected_keys)} of {len(SCOREABLE)} scoreable stats are forecast")

    # ---- write the files ----
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Every scoreable stat has to have somewhere to live, or the app will
    # silently score it as zero. Fail loudly instead.
    unstored = [k for k in SCOREABLE if k not in STAT_FIELDS]
    if unstored:
        raise SystemExit("Scoreable stats missing from STAT_FIELDS, so app.js "
                         f"could never score them: {', '.join(unstored)}")
    key_map = {k: STAT_FIELDS[k] for k in SCOREABLE}
    matched = sum(1 for p in players if p["id"])
    flagged = sum(1 for p in players if p["inj"])
    projected = sum(1 for v in stats.values() if "p" in v)
    archived = sum(1 for v in stats.values() if "pp" in v)
    crosswalked = sum(1 for v in stats.values() if "x" in v)
    archive_years = sorted({y for v in stats.values() for y in v.get("pp", {})})

    set_blocks = ",\n\n".join(
        f'  "{key}": [\n' + ",\n".join(player_line(p) for p in sets[key]) + "\n  ]"
        for key in ADP_FORMATS if key in sets)

    counts = " · ".join(f"{key} {len(sets[key])}" for key in ADP_FORMATS if key in sets)

    with open(PLAYERS_FILE, "w", encoding="utf-8") as handle:
        handle.write(
            "/* ==========================================================\n"
            "   Alpine Draft Room - player data\n"
            "   GENERATED FILE. Edit scripts/build_players.py instead.\n\n"
            f"   Generated : {stamp}\n"
            f"   Players   : {counts}\n"
            f"   Seasons   : {min(season_stats) if season_stats else '-'}"
            f"-{max(season_stats) if season_stats else '-'}\n"
            f"   Matched   : {matched} of the {DEFAULT_FORMAT} set carry a Sleeper id\n"
            f"   Flagged   : {flagged} carry an injury designation\n"
            f"   Projected : {projected} have {PROJECTION_SEASON} projections\n\n"
            "   ADP: Fantasy Football Calculator, one set per scoring format.\n"
            "   Team count is not an axis: FFC returns the same sample for\n"
            "   8, 10, 12 and 14 teams. See the note in build_players.py.\n"
            "   Player, injury and stat data: Sleeper.\n"
            "   ========================================================== */\n\n"
            f'const PLAYERS_META = {{ generated: "{stamp}", count: {len(players)}, '
            f"matched: {matched}, flagged: {flagged}, projected: {projected}, "
            f"unmatched: {len(unmatched)} }};\n\n"
            "/* One ordered list per scoring format. app.js picks the set that\n"
            "   matches league.scoring when a draft starts, and works out every\n"
            "   rank and tier from that set rather than from a fixed board. */\n"
            "const ADP_SETS = {\n" + set_blocks + "\n};\n\n"
            "// The Alpine default, and what the app falls back to if a set is missing.\n"
            f'const PLAYERS = ADP_SETS["{DEFAULT_FORMAT}"];\n')

    with open(STATS_FILE, "w", encoding="utf-8") as handle:
        handle.write(
            "/* ==========================================================\n"
            "   Alpine Draft Room - stats, projections and depth charts\n"
            "   GENERATED FILE. Keyed by Sleeper player id.\n\n"
            "     age / exp    age, years of experience\n"
            "     ht/wt/col/no height, weight, college, jersey number\n"
            "     depth/order  depth chart slot and place on it\n"
            "     s            season totals by year\n"
            "     p            projection for the coming season\n"
            "     pp           what we projected for seasons already played,\n"
            "                  keyed by year to line up with s\n"
            "     x            this player's id at other sources, so nothing\n"
            "                  has to match on a name at request time\n"
            "     w            week by week logs, keyed by season\n\n"
            "   Raw components only. There is no points total in here: app.js\n"
            "   applies the scoring rules, so a league can change them without\n"
            "   this file being rebuilt.\n\n"
            "   STAT_KEYS maps each scoreable stat to the short key holding it.\n"
            "   Generated from STAT_FIELDS so the two cannot drift apart.\n\n"
            "   PROJECTED_KEYS is the subset Sleeper actually forecasts. A rule\n"
            "   over anything outside it scores history correctly and adds\n"
            "   nothing to the 2026 projection, which is what the draft board\n"
            "   is ranked on. The scoring editor says so on each rule.\n\n"
            f"   Source ids : {crosswalked} of {len(stats)} players carry a Tank01 id\n"
            f"   Archived   : {archived} players carry past projections"
            f"{' for ' + ', '.join(archive_years) if archive_years else ' (none returned)'}\n"
            f"   Generated : {stamp}\n"
            "   ========================================================== */\n\n"
            "const STAT_KEYS = " + json.dumps(key_map, separators=(",", ":")) + ";\n\n"
            "const PROJECTED_KEYS = " + json.dumps(projected_keys, separators=(",", ":")) + ";\n\n"
            "const PLAYER_STATS = " + json.dumps(stats, separators=(",", ":")) + ";\n")

    with open(UNMATCHED_FILE, "w", encoding="utf-8") as handle:
        handle.write(f"FFC rows that did not join to a Sleeper player\nGenerated {stamp}\n"
                     "Across every scoring format, each name listed once.\n"
                     "Add an entry to MANUAL_MATCHES in build_players.py to fix one.\n\n")
        handle.write("\n".join(unmatched) if unmatched else "(none)\n")

        unscored = sorted(
            key for key in SEEN_KEYS
            if key not in STAT_FIELDS
            and key not in IGNORED_KEYS and not key.startswith("bonus_"))
        # A player we hold but could not link is a player whose sheet will
        # have no news. That is a small thing on its own and a bad thing to
        # discover from a user, so it is written down here with everything
        # else the pipeline could not use.
        handle.write("\n\n\nPlayers with no id at another source\n")
        handle.write("Each of these has no Latest news on their sheet, because the\n"
                     "only safe way to ask for it is by id. A COLLISION line means two\n"
                     "of their players claim one of ours -- neither is stored, since\n"
                     "picking one would serve somebody else's news under this name.\n\n")
        if not TANK01_KEY:
            handle.write("(no TANK01_KEY set, so no crosswalk was attempted)\n")
        else:
            handle.write("\n".join(source_report) if source_report else "(none)\n")

        handle.write("\n\n\nSleeper stats we are not storing\n")
        handle.write("The browser can only score what this pipeline records, so anything\n"
                     "here is a scoring rule the app could never support. If a league\n"
                     "counts it, add it to STAT_FIELDS and SCOREABLE in build_players.py\n"
                     "and give it a default in app.js.\n\n")
        handle.write("\n".join(unscored) if unscored else "(none)\n")

    print(f"\n{PLAYERS_FILE}: {counts}, {matched} matched, "
          f"{flagged} flagged, {len(unmatched)} unmatched")
    print(f"{STATS_FILE}: {len(stats)} players with stats, {projected} with projections")
    # Said out loud either way. Sleeper may or may not serve a past season's
    # forecast, and "no archive" is a fact about the feed worth seeing in the
    # run rather than inferring from a file that looks the same as before.
    if not TANK01_KEY:
        print("  no TANK01_KEY, so no source ids; player news stays off")
    else:
        print(f"  source ids on {crosswalked} of {len(stats)} players "
              f"({len(stats) - crosswalked} without, see unmatched.txt)")

    if archive_years:
        print(f"  archived projections for {', '.join(archive_years)} "
              f"on {archived} players")
    else:
        print("  no past projections returned; nothing archived this run")

    # The smallest set is the ceiling on teams x rounds, so print it: it is the
    # number the setup screen validates against.
    smallest = min(sets, key=lambda k: len(sets[k]))
    print(f"Smallest set is {smallest} at {len(sets[smallest])} players, "
          f"so a draft can be at most {len(sets[smallest])} picks.")

    if unmatched:
        print("\nUnmatched (see unmatched.txt):")
        for line in unmatched[:20]:
            print("  " + line)


if __name__ == "__main__":
    main()
