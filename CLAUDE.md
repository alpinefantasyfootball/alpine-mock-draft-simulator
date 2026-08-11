# Alpine Draft Room

A fantasy football mock draft simulator, built for one specific ten-team
league and now configurable from the setup screen: 8 to 14 teams, 8 to 20
rounds, any starting lineup, and standard, half or full PPR. The Alpine
league is still what every control defaults to.
Live at `alpinefantasyfootball.github.io/alpine-mock-draft-simulator/`,
hosted on GitHub Pages straight off `main`.

## Stack

Plain HTML, CSS and JavaScript. **No framework, no build step, no npm, no
bundler.** Open `index.html` in a browser and it runs. Keep it that way —
the owner is learning web development and a build step would put the
project out of reach.

Python 3 standard library only in the pipeline. No pip dependencies.

## Files

| File | Role |
|---|---|
| `index.html` | Markup. Sticky header, tabs, action bar, panels, player sheet. |
| `style.css` | All styling. Colours defined once in `:root`, reused by name. |
| `app.js` | Everything else: draft engine, CPU logic, analysis, rendering. |
| `players.js` | **GENERATED.** 260 players by ADP. Never edit by hand. |
| `stats.js` | **GENERATED.** Stats, projections, depth charts by Sleeper ID. |
| `scripts/build_players.py` | The pipeline that writes the two generated files. |
| `.github/workflows/update-players.yml` | Runs the pipeline daily at 11:00 UTC. |
| `unmatched.txt` | **GENERATED.** Feed rows that failed to join, plus unscored stat keys. |

## Data

Two free feeds, no keys: **Sleeper** (players, injuries, stats back to 2018,
weekly logs, projections, depth charts) and **Fantasy Football Calculator**
(ADP, one set per scoring format, written to `players.js` as `ADP_SETS`).

Fantasy points are **recomputed from raw components** in `build_players.py`
using the `SCORING` table — six points for a touchdown of any kind,
distance-tiered field goals. Sleeper's own `pts_half_ppr` is deliberately
discarded because it assumes four-point passing TDs.

The scoring table is deliberately generic rather than one league's settings,
so no local quirk leaks into projections, historical points or the grade.

## Conventions

- `app.js` is organised in numbered sections. Keep new code in the right one.
- `render()` rebuilds every panel from scratch on any change. There are no
  partial updates. This is fine at this size and keeps state bugs away.
- Click handling is delegated from `document`, because the DOM is constantly
  rebuilt. Don't attach listeners to elements inside a render function.
- Comments explain *why*, not *what*. The owner reads this code to learn.

## Hard-won rules — do not undo these

**Decide a player's type from `player.pos`, never from whether a stat is
present.** Christian McCaffrey threw one pass in 2025, and a check of
`if (stats.pa)` rendered him with quarterback columns and no receiving line
at all. Presence of data is not identity.

**Treat `0` from an API as missing, not as a real zero.** Sleeper returns
`pts: 0` for players it has no projection for. Counting those as valid
projections dragged replacement level toward zero and made every other
player look elite.

**Never hand-edit `players.js` or `stats.js`.** The next scheduled run
overwrites them. Change `build_players.py` instead.

**Nothing about the league shape may be written down twice.** `app.js` has
one `league` object and everything else derives from it — replacement level,
roster limits, the starting lineup, the round a kicker becomes legal, even
the prose in the method notes. The old code spelled "ten teams" out in a
dozen places and carried a hand-picked replacement level that was only
correct for one of them.

**FFC's `teams=` parameter does nothing.** It is echoed back in the response
meta, so it looks like it worked, but 8, 10, 12 and 14 all return the same
rows, the same ADP and the same `total_drafts` — checked across 2024, 2025
and 2026. Only the scoring format actually changes the data. Don't build a
team-count axis on top of it without re-checking that first.

**Anything an API gives us that we don't use should be visible, not silent.**
Unmatched players and unscored stat keys both get written to `unmatched.txt`
rather than dropped.

**Inline SVG needs explicit `width` and `height` attributes**, not just CSS.
A cached stylesheet once let the logo expand to fill the entire screen.

## Testing

- Pipeline: `python scripts/build_players.py` — prints counts and writes the
  generated files. Check `unmatched.txt` afterwards. On Windows run it as
  `py scripts/build_players.py`. A bare `python` reaches the Microsoft Store
  stub and fails with "Python was not found" unless the installer's
  "Add python.exe to PATH" box was ticked, which it usually isn't.
- App: open `index.html` directly in a browser. `file://` works because the
  data files load via `<script src>` rather than fetch.
- Before claiming a change works, run a full simulated draft and confirm
  140 picks, no duplicate players, 14 per team, no kicker before round 13.
  Then run one at a different shape — 12 teams, 15 rounds, full PPR — and
  confirm 180 picks, 15 per team, one QB each and no kicker before round 14.
  If the console reports an error naming something the source no longer
  contains, you are looking at a cached `app.js`, not a real failure. Hard
  reload, or serve the folder over `python -m http.server` and use that.

## Don't

- Don't add a framework, bundler, or npm dependency.
- Don't add live multi-user drafting. It roughly triples the project and
  even FantasyPros doesn't do it.
- Don't scrape or republish expert rankings, news articles or analyst
  commentary. That content belongs to the sites that produce it.
- Don't commit secrets. There are none in this project and there shouldn't be.
