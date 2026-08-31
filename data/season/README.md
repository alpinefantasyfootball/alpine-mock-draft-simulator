# Weekly actuals archive

Written by `scripts/archive_week.mjs`, on a schedule (`.github/workflows/
archive-weekly-actuals.yml`, Tuesdays at 14:00 UTC). Each completed NFL week
gets its own directory:

```
data/season/<season>/week-<NN>/
  actuals.json    every player with a stat line that week
  manifest.json   when this was captured, from what git commit, and a
                  SHA-256 of actuals.json -- same shape as
                  data/baselines/2026/preseason/manifest.json
```

`week-<NN>` is zero-padded (`week-01` .. `week-18`) so directories sort in
order.

## Why this exists

`players.js`/`stats.js` are rebuilt from scratch every night (see CLAUDE.md)
-- exactly right for a live draft board, and it means nothing about a given
week survives once the next night's rebuild runs. This directory is the
season's actual record: what really happened, captured once per week and
never touched again. It is the substrate a projections backtest (graded
against `data/baselines/2026/preseason/`) and the future Waiver Room both
need, and neither can be built retroactively -- there is no way to ask
Sleeper "what did you say about week 3" after week 9 has happened.

**Archives are append-only.** `scripts/archive_week.mjs` refuses to
overwrite a week that already has a `manifest.json`, unless run with
`--force`. Nobody should need that flag in the ordinary course of a season;
if a week's archive turns out to be wrong, that is usually a fact worth
keeping (Sleeper corrected something, say) rather than a reason to erase
the original capture.

## `actuals.json`'s shape

```jsonc
{
  "season": 2026,
  "week": 3,
  "players": [
    {
      "id": "9221",              // Sleeper player id
      "name": "Jahmyr Gibbs",
      "pos": "RB",
      "team": "DET",             // the team on that week's own stat row,
                                  // not necessarily this player's CURRENT
                                  // team -- this is what makes an in-season
                                  // trade visible in the archive
      "injuryStatus": "",        // Sleeper's raw status at capture time
                                  // (not app.js's single-letter code --
                                  // this is a record of what Sleeper said,
                                  // not an opinion about how to render it)
      "depthChartPosition": "RB",
      "depthChartOrder": 1,
      "stats": { "ry": 89, "rt": 1, "rc": 4, "cy": 22, "..." : "..." },
                                  // short-keyed the same way stats.js is --
                                  // see STAT_KEYS in stats.js for what each
                                  // key means. Raw components only, exactly
                                  // the rule CLAUDE.md states for the
                                  // nightly pipeline: no points total baked
                                  // in, so a league's own scoring rules can
                                  // be applied to history later too.
      "usage": {
        "targets": 5,             // rec_tgt, raw
        "offSnaps": 41, "teamOffSnaps": 63, "offSnapShare": 0.651,
        "defSnaps": 0, "teamDefSnaps": 0, "stSnaps": 2, "teamStSnaps": 11
      },
      "points": { "standard": 14.2, "half": 16.2, "ppr": 18.2 }
    }
  ]
}
```

**`usage` has no `targetShare`.** Sleeper's weekly feed sends a player's own
target count but no team-level target total to divide it by -- that is
exactly the gap nflverse's `u` block exists to fill for season totals (see
CLAUDE.md's "second feed" section), and there is no equivalent here yet.
Fabricating one by summing every other player's `targets` on the same team
that week would be a real computation this file doesn't do today; `targets`
is stored raw so a later pass can do it properly, against a real roster
join, rather than this script quietly guessing.

**`offSnapShare` is the one usage figure computed here**, because Sleeper
sends both halves of it on the player's own row (`off_snp`/`tm_off_snp`) --
no cross-player join needed, unlike targets.

**Every points figure is computed by the real app**, not reimplemented:
`scripts/archive_week.mjs` drives `app.js`'s own `pointsUnder()`/
`rulesForFormat()` in a headless browser, the same way
`scripts/freeze_baseline.mjs` does for the preseason baseline. See that
script's header comment for why.

## What isn't here yet

This directory exists to make sure the data survives the season. Nothing
reads it yet -- no backtest page, no Waiver Room. That is deliberate: both
need at least a few weeks of real archive to say anything, and building
either against zero weeks of data would be building against a guess.
