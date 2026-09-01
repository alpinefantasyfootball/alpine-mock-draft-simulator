# The 2026 preseason baseline — frozen, not generated

**These two files must never be regenerated, edited by hand, or "refreshed."**
That is not caution — it is the entire point of them existing.

## Why this exists

Juke's projections come from `players.js`/`stats.js`, and both are rebuilt
from scratch every night by `scripts/build_players.py` (see CLAUDE.md). That
is exactly right for a live draft board — it should always reflect the
freshest depth-chart news and market ADP — and it is exactly wrong for
proving a projection was any good. A number that keeps changing until the
day it is graded can always be quietly right in hindsight, and nobody
reading a scorecard built that way would be wrong to distrust it.

The only way to make that claim honestly is to **freeze the projection
before a single 2026 game is played**, publish the hash, and grade that
untouched snapshot against what actually happens across the season. That is
what `scripts/freeze_baseline.mjs` did, once, to produce `baseline.json` and
`manifest.json` in this directory. It is a forward test — the strongest
trust asset this project can own — and it is only possible until Week 1
kicks off. After that, this exact freeze can never be produced again for
2026; there is nothing to "fix" or "update" here, only something to keep.

## What's in `baseline.json`

- `leagueShape` — the default 10-team Alpine league's roster shape
  (`teams`/`rounds`/`starters`/`flex`/`superflex`/`bench`), fixed across all
  three scoring presets below.
- `formats.{standard,half,ppr}` — for each scoring preset: every player on
  that format's own ADP board, with `adp`/`posRank`/`overall`/`tier` from
  that board, plus `projPts`/`projPosRank`/`vorp` computed under that
  preset's rules, and the position-level `replacementRank`/`replacementPts`/
  `bestVor` that those figures were computed against.
- `rawProjections` — every board player's raw 2026 projection, keyed by
  Sleeper id, in the same raw-stat-component form `stats.js` stores it in
  (`PLAYER_STATS[id].p`) — i.e. *before* any scoring preset is applied. This
  is the one thing that does not vary by format.
- `schema` — `statKeys`/`projectedKeys`, so `rawProjections`' short field
  names (`ry`, `rc`, `cy`, ...) can be read without cross-referencing
  `stats.js` separately.

Every number in here was read straight out of the running app (`app.js`'s
`pointsUnder()`, `rulesForFormat()`, `replacementRank()`, `buildTiers()`,
`replacementGap()`) in a real headless browser — never reimplemented. See
`scripts/freeze_baseline.mjs`'s own header comment for why that matters.

## What's in `manifest.json`

The UTC timestamp this freeze actually ran, the git commit it ran against,
the `players.js`/`stats.js` "Generated" timestamps it captured data from,
and a SHA-256 of `baseline.json`'s exact bytes. If `baseline.json` and this
hash ever disagree, something touched the file after it was frozen —
that is a bug report, not a prompt to re-hash it.

## If you are an AI assistant (or anyone) reading this later

Do not "helpfully" run `scripts/freeze_baseline.mjs` again, and do not hand-edit
either file to fix a stat you think is wrong, add a missing player, or pick up
a roster move. Any of those would silently invalidate the one thing this
directory is for: proving, in public, what Juke projected *before* it knew
how the season went. `scripts/freeze_baseline.mjs` itself refuses to
overwrite an existing baseline for the same reason.

A mistake found in here after the fact is not a bug in this data — it is a
data point about the projection, and it belongs in whatever backtest report
eventually reads this directory, not in a diff against it.
