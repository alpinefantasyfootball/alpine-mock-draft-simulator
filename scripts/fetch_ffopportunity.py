"""Fetch precomputed expected-points data from ffverse/ffopportunity.

ffopportunity is the ffverse's expected fantasy points model. Its GitHub
repository republishes the model's output as release assets under the
rolling tag `latest-data`: one `ep_weekly_<season>.csv` per season, about
5.4 MB each, refreshed in-season. This is the xFP input the statistical
audit found missing from the pipeline -- nothing in Sleeper or nflverse's
per-player stats carries expected points, and computing them here would
mean a play-by-play model this project has no business maintaining.

Standard library only, same rule as build_players.py: urllib against the
GitHub API, no pip. The join key in the data is `player_id`, which is a
gsis id -- the same identifier link_nflverse() already resolves for the
board, so no new crosswalk is needed to use this file.

Usage:
    py scripts/fetch_ffopportunity.py                  # newest season only
    py scripts/fetch_ffopportunity.py --seasons 2023 2024 2025

By default only the newest season is fetched and stored, because history
does not change: backfill seasons are a one-off `--seasons` run, not a
weekly download. Output goes to src/data/, which is deliberately NOT
served -- Cloudflare Pages builds from web/ and serves web/dist, and this
file is in neither LEGACY_FILES nor web/public/, so a 5 MB CSV never sits
in front of a page load.
"""

import argparse
import csv
import io
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "src" / "data"
RELEASE_URL = ("https://api.github.com/repos/ffverse/ffopportunity"
               "/releases/tags/latest-data")
ASSET_RX = re.compile(r"^ep_weekly_(\d{4})\.csv$")


def fetch(url, accept="application/vnd.github+json"):
    """One GET, with the headers GitHub requires. GITHUB_TOKEN is optional:
    Actions provides one and a local run works without it (60 requests an
    hour unauthenticated, and this makes two)."""
    headers = {"User-Agent": "juke-data-pipeline", "Accept": accept}
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def weekly_assets():
    """{season: download_url} for every ep_weekly CSV on the release."""
    release = json.loads(fetch(RELEASE_URL))
    out = {}
    for asset in release.get("assets", []):
        m = ASSET_RX.match(asset.get("name", ""))
        if m:
            out[int(m.group(1))] = asset["browser_download_url"]
    return out


def validate(raw, season):
    """Refuse to write anything that is not the file we asked for.

    A release asset can be renamed, truncated or replaced upstream, and a
    wrong file written quietly is worse than a loud failure -- the same
    rule the pipeline applies everywhere. The header must carry the gsis
    `player_id` join key and at least one `_exp` model column, and every
    row must belong to the season the filename claims.

    Returns the row count.
    """
    text = raw.decode("utf-8-sig", errors="strict")
    reader = csv.DictReader(io.StringIO(text))
    header = reader.fieldnames or []
    if "player_id" not in header:
        sys.exit("ep_weekly_%d.csv has no player_id column -- refusing to "
                 "write it. Header was: %s" % (season, header[:10]))
    if not any(col.endswith("_exp") for col in header):
        sys.exit("ep_weekly_%d.csv has no *_exp columns -- this is not the "
                 "expected-points file. Refusing to write it." % season)
    rows = 0
    for row in reader:
        rows += 1
        if rows == 1 and row.get("season") not in (None, "", str(season)):
            sys.exit("ep_weekly_%d.csv opens with season=%r -- the asset "
                     "does not match its own name. Refusing to write it."
                     % (season, row.get("season")))
    if rows == 0:
        sys.exit("ep_weekly_%d.csv parsed to zero rows -- refusing to "
                 "write an empty file." % season)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seasons", nargs="*", type=int,
                        help="seasons to fetch (default: newest available)")
    args = parser.parse_args()

    assets = weekly_assets()
    if not assets:
        sys.exit("The latest-data release has no ep_weekly_*.csv assets. "
                 "Either the release layout changed or the API answer was "
                 "not the release -- nothing was written.")

    wanted = sorted(args.seasons) if args.seasons else [max(assets)]
    missing = [s for s in wanted if s not in assets]
    if missing:
        sys.exit("No ep_weekly CSV on the release for: %s. Available: %s"
                 % (missing, sorted(assets)))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for season in wanted:
        raw = fetch(assets[season], accept="application/octet-stream")
        rows = validate(raw, season)
        out = OUT_DIR / ("ep_weekly_%d.csv" % season)
        # Write whole-or-nothing: a temp file renamed into place, so an
        # interrupted run can never leave a half-written CSV looking real.
        tmp = out.with_suffix(".csv.tmp")
        tmp.write_bytes(raw)
        tmp.replace(out)
        print("ep_weekly_%d.csv: %d rows, %d bytes -> %s"
              % (season, rows, len(raw), out.relative_to(REPO_ROOT)))


if __name__ == "__main__":
    main()
