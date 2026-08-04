#!/usr/bin/env python3
"""
Rebuild players.js and stats.js from live data.

Sources (all free, no key, no account)
  https://api.sleeper.app/v1/players/nfl                    player master, injury, depth chart
  https://api.sleeper.app/v1/stats/nfl/regular/{season}     season totals
  https://api.sleeper.app/v1/stats/nfl/regular/{yr}/{wk}    weekly game logs
  https://api.sleeper.app/v1/projections/nfl/regular/{yr}   projections
  https://fantasyfootballcalculator.com/api/v1/adp/half-ppr 10-team half-PPR ADP

Sleeper asks that these be called no more than once a day.
FFC asks for attribution.

Fantasy points are recomputed from raw components using the Alpine league's
own scoring, NOT Sleeper's pts_half_ppr, which assumes 4-point passing
touchdowns and flat kicker scoring.

Run by hand:  python scripts/build_players.py
"""

import json
import re
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone

SLEEPER = "https://api.sleeper.app/v1"
FFC_URL = ("https://fantasyfootballcalculator.com/api/v1/adp/half-ppr"
           "?teams=10&year=2026&position=all")

PLAYERS_FILE = "players.js"
STATS_FILE = "stats.js"
UNMATCHED_FILE = "unmatched.txt"

KEEP = 260             # players written to players.js
WEEKLY_KEEP = 180      # players who also get week-by-week game logs
# Every season back to 2018 covers the full career of essentially any player
# with 2026 draft relevance. Seasons that return nothing are skipped, so this
# is self-limiting if Sleeper's history does not reach that far.
STAT_SEASONS = list(range(2018, 2026))
WEEKLY_SEASON = 2025
WEEKLY_WEEKS = 18
PROJECTION_SEASON = 2026

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
# Straight from the league settings screen.
SCORING = {
    "pass_yd": 0.04, "pass_td": 5, "pass_int": -2, "pass_2pt": 2,
    "rush_yd": 0.1, "rush_td": 6, "rush_2pt": 2,
    "rec": 0.5, "rec_yd": 0.1, "rec_td": 6, "rec_2pt": 2,
    "fum_lost": -2,
    # Return touchdowns. The league pays 6 for kick and punt returns, and a
    # receiver or back who returns kicks can pick up real points this way.
    # def_td / def_st_td below already cover the defence side, so they are
    # deliberately not repeated here.
    "kr_td": 6, "pr_td": 6,
    # Kicker: Sleeper lumps everything 50+ into one bucket, so 60-yarders
    # score 5 here instead of 6. Every shorter band is exact.
    "xpm": 1, "xpmiss": -1,
    "fgm_0_19": 3, "fgm_20_29": 3, "fgm_30_39": 3,
    "fgm_40_49": 4, "fgm_50p": 5, "fgmiss": -1,
    # Defence. Sleeper's points-allowed buckets are 14-20 and 21-27 where
    # the league uses 14-17 and 18-27, so those two bands are approximate.
    "sack": 1, "int": 2, "fum_rec": 2, "safe": 2,
    "def_td": 6, "def_st_td": 6, "blk_kick": 2,
    "pts_allow_0": 5, "pts_allow_1_6": 4, "pts_allow_7_13": 3,
    "pts_allow_14_20": 1, "pts_allow_21_27": 0,
    "pts_allow_28_34": -1, "pts_allow_35p": -4,
}

# Raw counting stats worth keeping, and the short key used in stats.js.
STAT_FIELDS = {
    "pass_att": "pa", "pass_cmp": "pc", "pass_yd": "py", "pass_td": "pt",
    "pass_int": "pi", "rush_att": "ra", "rush_yd": "ry", "rush_td": "rt",
    "rec_tgt": "tg", "rec": "rc", "rec_yd": "cy", "rec_td": "ct",
    "kr": "kr", "kr_yd": "kry", "kr_td": "krt",
    "pr": "pr", "pr_yd": "pry", "pr_td": "prt",
    "fum_lost": "fl",
    "fgm": "fg", "xpm": "xp", "sack": "sk", "int": "in", "fum_rec": "fr",
}

# Keys we knowingly ignore, so the diagnostic below stays useful.
IGNORED_KEYS = {
    "gp", "gs", "gms_active", "team", "off_snp", "tm_off_snp", "tm_def_snp",
    "tm_st_snp", "def_snp", "st_snp", "pts_std", "pts_ppr", "pts_half_ppr",
    "rank_std", "rank_ppr", "rank_half_ppr", "pos_rank_std", "pos_rank_ppr",
    "pos_rank_half_ppr", "anytime_tds", "tm_st_snp_pct",
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


def fantasy_points(row):
    """Apply the Alpine scoring rules to one Sleeper stat line."""
    if not row:
        return 0.0
    total = 0.0
    for key, weight in SCORING.items():
        value = row.get(key)
        if value:
            total += float(value) * weight
    return round(total, 1)


SEEN_KEYS = set()


def compact(row):
    SEEN_KEYS.update(row.keys())
    """Keep the listed stats, and only where they are non-zero."""
    out = {}
    for source, short in STAT_FIELDS.items():
        value = row.get(source)
        if value:
            out[short] = round(float(value), 1) if isinstance(value, float) else int(value)
    return out


# ---------------------------------------------------------------- main

def main():
    print("Fetching Sleeper player master...")
    sleeper = fetch_json(f"{SLEEPER}/players/nfl")
    print(f"  {len(sleeper)} players")

    print("Fetching FFC ADP...")
    adp_rows = fetch_json(FFC_URL).get("players", [])
    print(f"  {len(adp_rows)} ADP rows")

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

    print(f"Fetching {WEEKLY_SEASON} weekly game logs...")
    weekly = {}
    for week in range(1, WEEKLY_WEEKS + 1):
        data = fetch_json(
            f"{SLEEPER}/stats/nfl/regular/{WEEKLY_SEASON}/{week}", optional=True)
        if data:
            weekly[week] = data
    print(f"  {len(weekly)} weeks")

    # ---- index Sleeper three ways, strictest first ----
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

    # ---- join ADP rows to Sleeper records ----
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
    players = players[:KEEP]

    # ---- build stats.js ----
    stats = {}
    for rank, player in enumerate(players):
        player_id = player["id"]
        if not player_id:
            continue
        entry = player["_entry"]
        record = {}

        if entry.get("age"):
            record["age"] = int(entry["age"])
        if entry.get("years_exp") is not None:
            record["exp"] = int(entry["years_exp"])
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
            points = fantasy_points(line)
            if games == 0 and points == 0:
                continue          # a season the player was not in the league
            block = compact(line)
            block["gp"] = games
            block["pts"] = points
            seasons[str(season)] = block
        if seasons:
            record["s"] = seasons

        projection = projections.get(player_id)
        if projection:
            block = compact(projection)
            block["gp"] = int(projection.get("gp") or 0)
            block["pts"] = fantasy_points(projection)
            record["p"] = block

        if rank < WEEKLY_KEEP:
            logs = []
            for week in sorted(weekly):
                line = weekly[week].get(player_id)
                if not line:
                    continue
                block = compact(line)
                block["w"] = week
                block["pts"] = fantasy_points(line)
                logs.append(block)
            if logs:
                record["w"] = logs

        if record:
            stats[player_id] = record

    # ---- write the files ----
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    matched = sum(1 for p in players if p["id"])
    flagged = sum(1 for p in players if p["inj"])
    projected = sum(1 for v in stats.values() if "p" in v)

    lines = [
        '  {{ id: "{id}", name: "{name}", pos: "{pos}", team: "{team}", '
        'bye: {bye}, adp: {adp}, inj: "{inj}" }}'.format(
            id=p["id"], name=p["name"].replace('"', "'"), pos=p["pos"],
            team=p["team"], bye=p["bye"], adp=p["adp"], inj=p["inj"])
        for p in players
    ]

    with open(PLAYERS_FILE, "w", encoding="utf-8") as handle:
        handle.write(
            "/* ==========================================================\n"
            "   Alpine Draft Room - player data\n"
            "   GENERATED FILE. Edit scripts/build_players.py instead.\n\n"
            f"   Generated : {stamp}\n"
            f"   Players   : {len(players)}\n"
            f"   Seasons   : {min(season_stats) if season_stats else '-'}"
            f"-{max(season_stats) if season_stats else '-'}\n"
            f"   Matched   : {matched} carry a Sleeper id\n"
            f"   Flagged   : {flagged} carry an injury designation\n"
            f"   Projected : {projected} have {PROJECTION_SEASON} projections\n\n"
            "   ADP: Fantasy Football Calculator, 10-team half PPR.\n"
            "   Player, injury and stat data: Sleeper.\n"
            "   ========================================================== */\n\n"
            f'const PLAYERS_META = {{ generated: "{stamp}", count: {len(players)}, '
            f"matched: {matched}, flagged: {flagged}, projected: {projected}, "
            f"unmatched: {len(unmatched)} }};\n\n"
            "const PLAYERS = [\n" + ",\n".join(lines) + "\n];\n")

    with open(STATS_FILE, "w", encoding="utf-8") as handle:
        handle.write(
            "/* ==========================================================\n"
            "   Alpine Draft Room - stats, projections and depth charts\n"
            "   GENERATED FILE. Keyed by Sleeper player id.\n\n"
            "     age / exp    age, years of experience\n"
            "     depth/order  depth chart slot and place on it\n"
            "     s            season totals by year\n"
            "     p            projection for the coming season\n"
            "     w            week by week logs for last season\n\n"
            "   Fantasy points use Alpine league scoring, not Sleeper's.\n"
            f"   Generated : {stamp}\n"
            "   ========================================================== */\n\n"
            "const PLAYER_STATS = " + json.dumps(stats, separators=(",", ":")) + ";\n")

    with open(UNMATCHED_FILE, "w", encoding="utf-8") as handle:
        handle.write(f"FFC rows that did not join to a Sleeper player\nGenerated {stamp}\n"
                     "Add an entry to MANUAL_MATCHES in build_players.py to fix one.\n\n")
        handle.write("\n".join(unmatched) if unmatched else "(none)\n")

        unscored = sorted(
            key for key in SEEN_KEYS
            if key not in SCORING and key not in STAT_FIELDS
            and key not in IGNORED_KEYS and not key.startswith("bonus_"))
        handle.write("\n\n\nSleeper stats we are neither scoring nor storing\n")
        handle.write("Check this list against the league scoring settings; anything\n"
                     "that should count belongs in SCORING in build_players.py.\n\n")
        handle.write("\n".join(unscored) if unscored else "(none)\n")

    print(f"\n{PLAYERS_FILE}: {len(players)} players, {matched} matched, "
          f"{flagged} flagged, {len(unmatched)} unmatched")
    print(f"{STATS_FILE}: {len(stats)} players with stats, {projected} with projections")

    if unmatched:
        print("\nUnmatched (see unmatched.txt):")
        for line in unmatched[:20]:
            print("  " + line)


if __name__ == "__main__":
    main()
