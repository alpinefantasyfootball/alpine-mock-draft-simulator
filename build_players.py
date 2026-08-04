#!/usr/bin/env python3
"""
Rebuild players.js from live data.

Sources
  Sleeper   https://api.sleeper.app/v1/players/nfl
            Player master, team, position, and injury status. Free, no key.
            Sleeper asks that this be called no more than once a day.

  FFC       https://fantasyfootballcalculator.com/api/v1/adp/half-ppr
            10-team half-PPR average draft position. Free for personal and
            commercial use; they ask for attribution and no heavy polling.

Run it by hand with:   python scripts/build_players.py
The GitHub Action runs the same command every morning.
"""

import json
import re
import unicodedata
import urllib.request
from datetime import datetime, timezone

SLEEPER_URL = "https://api.sleeper.app/v1/players/nfl"
FFC_URL = ("https://fantasyfootballcalculator.com/api/v1/adp/half-ppr"
           "?teams=10&year=2026&position=all")

OUTPUT_FILE = "players.js"
UNMATCHED_FILE = "unmatched.txt"

# How many players to keep. 140 get drafted in a 10-team, 14-round league,
# so anything under about 200 leaves the last rounds with no real choices.
KEEP = 260

# FFC position codes -> ours
POSITION_MAP = {"QB": "QB", "RB": "RB", "WR": "WR", "TE": "TE",
                "PK": "K", "K": "K", "DEF": "DST", "DST": "DST"}

# Providers disagree about a handful of team codes.
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

# Sleeper injury_status / status -> the short code shown next to a name.
INJURY_CODES = {
    "questionable": "Q",
    "doubtful": "D",
    "out": "O",
    "ir": "IR",
    "injured reserve": "IR",
    "pup": "PUP",
    "physically unable to perform": "PUP",
    "nfi": "NFI",
    "non football injury": "NFI",
    "sus": "SUS",
    "suspended": "SUS",
    "dnr": "DNR",
    "cov": "COV",
}

# Anything the automatic matcher can't work out goes here by hand.
# Left side is the FFC name, right side is the Sleeper player_id.
MANUAL_MATCHES = {
    # "Some Awkward Name": "1234",
}


# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------

def fetch_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "alpine-draft-room/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def normalise(name):
    """Lowercase, strip accents, drop suffixes and punctuation.

    'Marvin Harrison Jr.' and 'Marvin Harrison' both become 'marvinharrison',
    which is the whole point.
    """
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    text = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", " ", text)
    return re.sub(r"[^a-z]", "", text)


def clean_team(code):
    code = (code or "FA").upper()
    return TEAM_ALIASES.get(code, code)


def injury_code(entry):
    for field in ("injury_status", "status"):
        value = (entry.get(field) or "").strip().lower()
        if value in INJURY_CODES:
            return INJURY_CODES[value]
    return ""


# ----------------------------------------------------------------------
# main
# ----------------------------------------------------------------------

def main():
    print("Fetching Sleeper player master...")
    sleeper = fetch_json(SLEEPER_URL)
    print(f"  {len(sleeper)} players")

    print("Fetching FFC ADP...")
    ffc = fetch_json(FFC_URL)
    adp_rows = ffc.get("players", [])
    print(f"  {len(adp_rows)} ADP rows")

    # ---- index Sleeper three ways, strictest first ----
    by_name_pos_team = {}
    by_name_pos = {}
    by_name = {}

    for player_id, entry in sleeper.items():
        position = entry.get("position")
        if position not in ("QB", "RB", "WR", "TE", "K", "DEF"):
            continue

        full_name = entry.get("full_name") or entry.get("last_name") or ""
        key = normalise(full_name)
        if not key:
            continue

        team = clean_team(entry.get("team"))
        record = (player_id, entry)

        by_name_pos_team.setdefault((key, position, team), record)
        by_name_pos.setdefault((key, position), record)
        by_name.setdefault(key, []).append(record)

    # ---- walk the ADP list and attach a Sleeper record to each row ----
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

        # Defences are keyed by team abbreviation in Sleeper, not by name.
        if position == "DST":
            entry = sleeper.get(team)
            if entry:
                match = (team, entry)
            name = f"{TEAM_CITIES.get(team, team)} Defense"

        if match is None and name in MANUAL_MATCHES:
            player_id = MANUAL_MATCHES[name]
            if player_id in sleeper:
                match = (player_id, sleeper[player_id])

        if match is None:
            match = by_name_pos_team.get((key, sleeper_position, team))
        if match is None:
            match = by_name_pos.get((key, sleeper_position))
        if match is None:
            candidates = by_name.get(key, [])
            if len(candidates) == 1:
                match = candidates[0]

        if match is None:
            unmatched.append(f"{name} | {position} | {team} | ADP {row.get('adp')}")
            # Keep the player anyway, just without an id or injury status.
            players.append({"id": "", "name": name, "pos": position, "team": team,
                            "bye": int(row.get("bye") or 0),
                            "adp": round(float(row.get("adp") or 999), 1), "inj": ""})
            continue

        player_id, entry = match
        players.append({
            "id": player_id,
            "name": name,
            "pos": position,
            "team": team,
            "bye": int(row.get("bye") or 0),
            "adp": round(float(row.get("adp") or 999), 1),
            "inj": injury_code(entry),
        })

    players.sort(key=lambda p: p["adp"])
    players = players[:KEEP]

    # ---- write players.js ----
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    matched = sum(1 for p in players if p["id"])
    flagged = sum(1 for p in players if p["inj"])

    lines = []
    for p in players:
        lines.append(
            '  {{ id: "{id}", name: "{name}", pos: "{pos}", team: "{team}", '
            'bye: {bye}, adp: {adp}, inj: "{inj}" }}'.format(
                id=p["id"], name=p["name"].replace('"', "'"), pos=p["pos"],
                team=p["team"], bye=p["bye"], adp=p["adp"], inj=p["inj"]))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as handle:
        handle.write(
            "/* ==========================================================\n"
            "   Alpine Draft Room - player data\n"
            "   GENERATED FILE. Do not edit by hand; the next scheduled\n"
            "   run will overwrite it. Change scripts/build_players.py\n"
            "   instead.\n\n"
            f"   Generated : {stamp}\n"
            f"   Players   : {len(players)}\n"
            f"   Matched   : {matched} of {len(players)} carry a Sleeper id\n"
            f"   Flagged   : {flagged} carry an injury designation\n\n"
            "   ADP: Fantasy Football Calculator, 10-team half PPR.\n"
            "   Player and injury data: Sleeper.\n"
            "   ========================================================== */\n\n"
            f'const PLAYERS_META = {{ generated: "{stamp}", count: {len(players)}, '
            f"matched: {matched}, flagged: {flagged}, unmatched: {len(unmatched)} }};\n\n"
            "const PLAYERS = [\n" + ",\n".join(lines) + "\n];\n")

    with open(UNMATCHED_FILE, "w", encoding="utf-8") as handle:
        handle.write(f"Rows FFC returned that did not join to a Sleeper player\n"
                     f"Generated {stamp}\n"
                     f"Add an entry to MANUAL_MATCHES in build_players.py to fix one.\n\n")
        handle.write("\n".join(unmatched) if unmatched else "(none)\n")

    print(f"\nWrote {OUTPUT_FILE}: {len(players)} players, "
          f"{matched} matched, {flagged} flagged, {len(unmatched)} unmatched")

    if unmatched:
        print("\nUnmatched (also written to unmatched.txt):")
        for line in unmatched[:20]:
            print("  " + line)


if __name__ == "__main__":
    main()
