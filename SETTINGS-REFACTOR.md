# Task: configurable draft settings

Right now the league shape is hardcoded to one ten-team league. This makes it
configurable from the setup screen. Read `CLAUDE.md` first.

**Do Phase 1 only unless told otherwise. Phase 2 is a separate decision.**

---

## Phase 1 — league shape and matching ADP

### 1.1 One config object

Replace the scattered constants in `app.js` with a single object, and derive
everything else from it. Current constants and where they live:

| Constant | References | Notes |
|---|---|---|
| `TEAM_COUNT` | 13 | Snake maths, board grid, sequencing, analysis |
| `ROUNDS` | 6 | |
| `TOTAL_PICKS` | 8 | Derived: teams × rounds |
| `STARTERS` | 2 | `{ QB:1, RB:2, WR:2, TE:1, K:1, DST:1 }`, FLEX is implicit |
| `MAX_POS` | 3 | CPU roster limits |
| `REPLACEMENT` / `REPLACEMENT_LEVEL` | 3 + 3 | **Must become derived — see 1.2** |
| `CPU_NAMES` | 3 | Fixed list of 10; must cover up to 14 |

Two hardcoded starting-lineup arrays must be built from config instead:
`bestLineup()` (~line 583) and `renderTeam()` (~line 879). Both currently
literal `["QB","RB","RB","WR","WR","TE","FLEX","DST","K"]`.

Suggested shape:

```js
const league = {
  teams: 10,
  rounds: 14,
  starters: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 },
  flex: 1,                 // RB / WR / TE eligible
  bench: 5,                // display only; rounds is authoritative
  scoring: "half"          // "standard" | "half" | "ppr"
};
```

Validate that `starters` total + `flex` + `bench` equals `rounds`. If the user
sets a combination that doesn't add up, show the mismatch on the setup screen
and don't start the draft.

### 1.2 Replacement levels must be derived, not literal

This is the only non-mechanical part of Phase 1, and the most important.

The current values (QB11, RB25, WR28, TE11, K11, DST11) were worked out by hand
for a ten-team, 2-WR-plus-FLEX league. They silently become wrong the moment
team count or flex slots change, and they feed the draft grade, the Overall
signal and value over replacement. Replace with:

```js
const FLEX_SHARE = { RB: 0.40, WR: 0.55, TE: 0.05 };

function replacementRank(pos) {
  const base = league.teams * (league.starters[pos] || 0);
  const flex = league.teams * league.flex * (FLEX_SHARE[pos] || 0);
  return Math.round(base + flex) + 1;
}
```

Sanity check against the current league: this yields QB11, RB25, WR27, TE12,
K11, DST11 versus the hand-picked 11/25/28/11/11/11. Close enough that grades
stay comparable, and now correct for any configuration.

### 1.3 CPU team names

The list has exactly 10. Extend to at least 14 so a 12- or 14-team league
doesn't produce blank or undefined team names. Keep them harmless.

### 1.4 ADP must match the settings

Currently `build_players.py` fetches one endpoint: 10-team half-PPR. A 12-team
full-PPR mock would draft against 10-team half-PPR ADP, which moves real
players by a round or more and corrupts the CPU logic, the suggestions and the
value component of the grade.

Fantasy Football Calculator takes both as parameters:

```
https://fantasyfootballcalculator.com/api/v1/adp/{format}?teams={n}&year=2026&position=all
```

`format` is `standard`, `half-ppr` or `ppr`. `teams` accepts 8, 10, 12, 14.

- Fetch the combinations that matter: teams 8/10/12/14 × formats standard/half-ppr/ppr.
- Write them into `players.js` as a map keyed `"10-half"`, `"12-ppr"` and so on,
  each holding the ordered player list for that setting.
- Keep a default key so the app still works if a combination is missing.
- The app selects the matching set when the draft starts, then computes
  `posRank`, `overall` and tiers from *that* set.
- Be careful with file size. If it grows past roughly 1 MB, cut the number of
  combinations rather than the number of players per combination.

Verify: the same player should have a different ADP in the 10-team and 14-team
sets. If they're identical, the parameters aren't being applied.

### 1.5 Saved drafts

`SAVE_KEY` in `app.js` is `"alpine-draft-room-v1"`. Resuming a draft into
different settings would corrupt the board. Add a settings fingerprint to the
saved payload and refuse to resume when it doesn't match the current config,
with a clear message. The existing "player list changed" refusal is the pattern
to follow.

### 1.6 Setup screen

Add controls for teams, rounds, scoring format, and each roster slot count.
Keep the existing draft position and pick clock controls. Use only what's
already in the stylesheet — selects, the `.locked` panel styling, `.primary`
buttons. Preserve the current visual language; don't introduce a new one.

Default every control to the current Alpine settings so the common case is
still one click.

---

## Phase 2 — custom scoring — DO NOT BUILD WITHOUT ASKING

Recorded here so the design isn't lost. All scoring currently happens in
`build_players.py`, and fantasy points are baked into `stats.js` before the
browser sees them. **21 of the 36 scoring inputs are not stored at all** —
every field-goal distance bucket, every defensive component, all two-point
conversions. So the browser cannot rescore a player today.

Making scoring configurable means:

1. Expand `STAT_FIELDS` in `build_players.py` to store every scoreable raw
   component, not just the display-worthy ones.
2. Move the `SCORING` table and `fantasy_points()` from Python into `app.js`.
3. Have the pipeline store raw stats only, and the app apply the rules.
4. Add a scoring editor to the setup screen.

That is the right architecture regardless — a data pipeline should record
facts, not opinions about how to value them. It's roughly half a day and it
invalidates the existing `stats.js`, so it needs its own pass.

---

## Definition of done for Phase 1

- [ ] `python scripts/build_players.py` runs clean; `unmatched.txt` has no
      top-100 players in it.
- [ ] Default settings produce a draft identical in shape to today's.
- [ ] A 12-team, 15-round mock completes: 180 picks, no duplicates, 15 per team,
      no kicker before the last two rounds, every team exactly one QB.
- [ ] Draft grades still produce ten distinct letters in a 12-team league.
- [ ] Replacement ranks change when team count changes — print them and check.
- [ ] Resuming a saved draft into different settings is refused, not corrupted.
- [ ] Tier chips, bye warnings and the player sheet all still work.
- [ ] `docs/draft-room-how-it-works.html` updated where it states fixed numbers
      (sections 03, 04 and 06 all quote ten teams and the literal replacement
      ranks).
