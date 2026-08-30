# Juke

Juke is the brand. **The Draft Room** is the first of several planned rooms
(Waiver, Prospect, Trade, League, Strategy), and the only one that exists —
so for now the site and the Draft Room are the same thing. Name the room in
the app, not the brand: the header says "The Draft Room", Juke sits above it
in the page title and the manifest.

A fantasy football mock draft simulator, built for one specific ten-team
league and now configurable from the setup screen: 4 to 24 teams, 8 to 20
rounds, any starting lineup, and standard, half or full PPR. That original
league is still what every control defaults to.

Live at `jukeff.com`, served by **Cloudflare Pages**, built from `main` on
every push. **It serves from the domain root, not a project path** — which is
why `manifest.json` uses `start_url: "/"`. A path-scoped `start_url` here makes
the installed app launch into a 404.

It was GitHub Pages until 18 August 2026, via a `CNAME` file that is now gone.
Three things moved with it and each one is written up where it belongs: the
security headers become `_headers` in this repository rather than a Cloudflare
Transform Rule, the caching behaviour changes completely (see the `?v=` section),
and there is now no reason of *hosting* for the hash route, only a reason of
scope.

**One host, not two.** Both deploy paths were live at once for a day — a push to
`main` produced a GitHub Pages build *and* a Cloudflare Pages build, and the
apex spent that day in a redirect loop while `www` was fine. If a change to the
site appears not to land, check which origin answered before checking anything
else.

## Stack

Plain HTML, CSS and JavaScript, and that rule still governs everything it
always did: `app.js`, `draft-engine.js`, `room.js`, `live.js`, `style.css`,
the worker. **No framework, no build step, no npm, no bundler** for any of
that — it is still true today, not a historical claim. Python 3 standard
library only in the pipeline. No pip dependencies.

**`web/` is the one deliberate exception, and it is scoped to the
homepage.** React, Vite, Tailwind and Framer Motion, building the marketing
page at `jukeff.com/` — not the Draft Room, not the pipeline, not the
worker. This is a real reversal of the rule above, made because the owner
is now building more pages in this stack rather than because the original
reason (a build step would put the project out of reach) stopped being
true. Everything else in this file that says "no build step" is still
correct about the thing it was said about.

**One page, two script worlds, one seam between them.** `web/index.html` is
the real page Cloudflare Pages serves. It loads the legacy files
(`app.js`, `draft-engine.js`, `live.js`, `theme.js`, `back-to-top.js`,
`players.js`, `stats.js`, `style.css`) as plain classic `<script src>`
tags, root-relative and still `?v=`-stamped exactly as before, alongside
Vite's own content-hashed, `type="module"` bundle for the React homepage.
A classic script blocks and a module script runs deferred, so `app.js`
has always finished — `window.JukeEngine` included — before React's entry
script executes; there is no timing hazard to guard against, only one to
understand. `window.JukeEngine` (set at the end of `app.js`'s boot
sequence) is the only channel between the two: `board`, `league`, `ROOMS`,
scoring, and a handful of read functions, exposed rather than
reimplemented. Scoring logic living twice, once in `app.js` and once in a
React component, is exactly the "nothing about the league shape may be
written down twice" failure this file already has a rule about — the
superflex bug was that failure in the CPU; a second scoring engine in
`web/src` would be the same failure in the browser.

**The Draft Room markup still lives inside `web/index.html`, hidden.**
`#view-home`'s *id* is what `applyRoute()` toggles, so that id stays put
and React mounts into its contents; everything `app.js` touches
unconditionally at boot (`#shellbar`, the score strip, `#homeResume`) moved
into a sibling container hidden with `display: none !important` rather
than being deleted, because `app.js` is a classic script and an unguarded
`$(id)` lookup against a missing element throws — and that exception kills
every remaining top-level statement in the file, Draft Room boot code
included. Deleting that markup outright would silently break drafting on
every page load, not just the home route.

**There used to be an `index.html` at the repository root too, kept
deliberately for one release as a fallback.** Cloudflare Pages had always
built from the repo root with no build step, so that file was what was
actually live at `jukeff.com` until the dashboard was switched to **Root
directory: `web`, Build command: `npm run build`, Output directory:
`dist`** — a manual, account-owner-only change. Deleting it before that
switch would have 404'd the whole site the moment the migration branch
reached `main`. It was removed only after the dashboard switch and the new
deploy were both confirmed live — same rule as everywhere else in this
file: prove the replacement works before deleting what it replaces, and
check the running site, not just the build log.

**Which means the "open a file, no server, no build" workflow no longer
reaches the whole app.** `web/index.html`'s legacy `<script src>` tags are
root-relative (`/app.js?v=...`) on purpose, so Vite's HTML transform leaves
them alone during a build — but a root-relative path resolves against the
filesystem root under `file://`, not against the HTML file's own folder,
so it 404s there. Opening `web/index.html` straight from disk no longer
works, and neither does opening a built `web/dist/index.html` the same
way. Something has to serve it — `vite dev`, or `web/dist` over any static
server — before either the homepage or the Draft Room render at all. This
is the real, ongoing cost of the one deliberate build-step exception in
the Stack section above, not a one-time migration hiccup.

## Files

| File | Role |
|---|---|
| `404.html` | The not-found page. **Every path in it is absolute**, because Pages serves it at whatever address missed — a relative `style.css` on `/a/b/c` misses too. |
| `_headers` | The security headers, served by the origin. Replaced a Cloudflare Transform Rule; see the hosting note. Copied into `web/dist/` at build time — Pages reads `_headers` from the output directory, not the repo root, once a build step exists. |
| `.gitattributes` | Marks the eight binaries as binary. Text is deliberately not declared. |
| `style.css` | All styling for the legacy pages (Draft Room, `404.html`, the how-it-works doc). Colours defined once at the top, reused by name. Not used by `web/src` — Tailwind owns the homepage's styling. |
| `app.js` | Everything else: draft engine, CPU logic, analysis, rendering, and — at the end of its boot sequence — `window.JukeEngine`, the bridge `web/src` reads real data through. |
| `back-to-top.js` | The back-to-top button. Its own file because the how-it-works page uses it and has no reason to load `app.js`. |
| `draft-engine.js` | The rules of a snake draft — turn order, legality, the CPU wobble. No DOM, no globals, no dependencies, so a server can run the identical file. |
| `room.js` | One shared draft: seats, picks, the clock. Pure, and time is always passed in rather than read. Loaded by the worker only; the page consumes the view it sends. Not copied into `web/dist/` — nothing client-side ever references it. |
| `live.js` | The client end of a room: one socket, the invite code, and the messages. Knows nothing about the board or how anything is drawn. |
| `worker/` | The Cloudflare Durable Object behind an invite link, plus the two proxied routes whose keys may not be in the page (`/giphy`, `/news`) and its `wrangler.toml`. Deployed to `juke-draft-room.jukeff.workers.dev`; **a change here needs `wrangler deploy`** — the site deploys itself from git and the worker does not. See `worker/README.md`. |
| `worker/store.js` | The D1 cache: Sleeper's pool and Tank01 headlines. A cache and never a source of truth, and a missing binding is a normal condition rather than a fault. |
| `worker/migrations/` | D1 schema, applied with `wrangler d1 migrations apply`. The database is not to be shaped by hand — see the note on three variants of one schema. |
| `web/index.html` | The real homepage entry Vite builds from. Loads the legacy files above as root-relative classic scripts, alongside Vite's own hashed module bundle for React. The Draft Room markup lives here too, hidden — see the Stack section. |
| `web/src/components/phone/` | The phone-only screens, mounted below `sm` (`usePhoneWidth()`): the draft room, the homepage, the Mock Drafts Lobby, the floating nav pill. Each is a different screen from its desktop counterpart rather than a narrower one — see "The mobile pass" below for why that is a product decision and what it costs. |
| `web/src/components/settings/` | The Draft Settings screen's own controls, the scoring-rule editor and the draft-order list. Split out of `DraftSettingsModal.jsx` when that file became the whole settings screen rather than a three-tab modal. |
| `web/src/` | The React homepage: `Homepage.jsx` composes `Header`, `Hero`, `ScoresStrip`, `ShowYourWorking`, `RoomsGrid`, `ClosingCta`. Every one of them reads real data through `window.JukeEngine` (or `window.DraftEngine` directly, for `pickCode()`) rather than inventing sample content — the header ticker used to be six fabricated stats and is now five real ones read off the live board. |
| `web/vite.config.js` | The Vite build config, plus a dev-server middleware that serves the same `LEGACY_FILES`/`LEGACY_DIRS` list `copy-legacy-assets.mjs` uses, from the true repo root, so `window.JukeEngine` carries real data under `vite dev` too — not just after a full build. |
| `web/scripts/copy-legacy-assets.mjs` | Copies the legacy files into `web/dist/` after `vite build`, chained as this package's `build` script. Fails loudly (`process.exit(1)`) and lists exactly what's missing rather than shipping a partial site quietly. |
| `web/package.json` | A real build, with real dependencies (React, Vite, Tailwind, Framer Motion) — unlike the repo-root `package.json`, which stays Playwright-only. This is the one place in the project a `npm install` is required before anything runs. |
| `scripts/test_engine.py` | Runs `draft-engine.js` and `room.js` in node/deno/bun and asserts the rules from outside a browser. |
| `scripts/test_crosswalk.py` | The source-id join, without the network. A bad join does not look like a failure, which is why it is not left to a pipeline run. |
| `tests/` | End-to-end tests: the real pages, in a real browser, two managers in a real room. `playwright.config.mjs` now builds `web/` and serves `web/dist` rather than the repo root, so every spec runs against the same artifact a Cloudflare Pages deploy produces. |
| `package.json` (repo root) | **Dev only.** Fetches the test runner and nothing else. Unrelated to `web/package.json` — this one still has no build step, no bundler and no runtime dependency. |
| `players.js` | **GENERATED.** 260 players by ADP. Never edit by hand. |
| `stats.js` | **GENERATED.** Stats, projections, depth charts by Sleeper ID. `pp` holds what we projected for seasons already played, so a forecast can be graded against what happened. |
| `scripts/build_players.py` | The pipeline that writes the two generated files. |
| `.github/workflows/update-players.yml` | Runs the pipeline daily at 11:00 UTC, and bumps `?v=` in `web/index.html` (not the root `index.html`) alongside `404.html` and the how-it-works doc. |
| `og-image.png` | 1200x630 link-preview card. **A designed asset now, not a generated one** — it arrived with the shark handoff. `scripts/build_og.html` still draws a plainer fallback from the same mark; running it replaces the designed card with a generated one. The copy that is actually served is `web/public/og-image.png`; see the note on the repo root below. |
| `favicon.ico`, `favicon-16.png`, `favicon-32.png` | The root favicons, named by `404.html` and all three `docs/` pages. The PNGs are rendered exports; the `.ico` is assembled from them by `scripts/build_favicon_ico.py`. Duplicated into `web/public/`, which is the copy a browser reaches. |
| `scripts/build_favicon_ico.py` | Wraps `favicon-{16,32,48}.png` in an `.ico` container, payloads unmodified. Stdlib only, no encoder, and it re-traces nothing — if the mark changes, re-render the PNGs and run it again. |
| `unmatched.txt` | **GENERATED.** Five sections: FFC rows that failed to join, players with no id at another source, **Sleeper stats we are not storing** (read this before adding a feed), Sleeper against nflverse, and the missed-field-goal reconciliation. |
| `data/baselines/2026/preseason/` | **FROZEN, not generated.** The one-shot 2026 preseason projections/VORP/tiers/ADP snapshot, hashed in `manifest.json`. Never regenerated, never hand-edited — see the Data section below and the directory's own README.md. |
| `scripts/freeze_baseline.mjs` | Wrote the frozen baseline above, once. Drives the real app in a headless browser rather than reimplementing scoring/VORP/tiers in Python — see its own header comment. Refuses to run again if a baseline already exists. |
| `data/season/<year>/week-<NN>/` | **APPEND-ONLY.** One week's real actuals, written once by `scripts/archive_week.mjs` and never touched again. See the Data section below and `data/season/README.md`. |
| `scripts/archive_week.mjs` | Writes the weekly actuals archive above. Drives the real app in a headless browser for `pointsUnder()`/`rulesForFormat()` rather than reimplementing scoring — see its own header comment. Refuses to overwrite an already-archived week without `--force`. |
| `scripts/test_archive_week.mjs` | Offline check for `archive_week.mjs`'s raw-stat mapping and the points it produces, against a synthetic, hand-computable stat line — the one part of that script this project can test without live Sleeper access. |
| `.github/workflows/archive-weekly-actuals.yml` | Runs `archive_week.mjs` weekly (Tuesdays, 14:00 UTC), after Monday Night Football and Sleeper's own box-score finalization. |

## Data

Three free feeds, no keys: **Sleeper** (players, injuries, stats back to 2018,
weekly logs, projections, depth charts), **Fantasy Football Calculator**
(ADP, one set per scoring format, written to `players.js` as `ADP_SETS`), and
**nflverse** (nflfastR's play-by-play derivatives, used to check Sleeper and
never to replace it — see "The second feed" below).

### `data/baselines/2026/preseason/` is frozen, not generated

Every other generated file in this project — `players.js`, `stats.js`,
`unmatched.txt` — is meant to be rebuilt from scratch every night, and
CLAUDE.md says so throughout. This one directory is the opposite on purpose:
`scripts/freeze_baseline.mjs` ran exactly once, before Week 1 of the 2026
season, and captured every player's raw projection, their points under all
three scoring presets, VORP and replacement level per position, the ADP
snapshot, and tier assignments — the last moment any of that could be
captured honestly, before a single game told the projection whether it was
right. `manifest.json` carries a SHA-256 of the frozen payload for exactly
that reason: to prove, later, that nothing in it was touched after the fact.

**Do not run `scripts/freeze_baseline.mjs` again, and do not hand-edit
`baseline.json` or `manifest.json`.** The script itself refuses to overwrite
an existing baseline, but that only helps if nobody deletes the files first
to "fix" one. A wrong number discovered later is a data point about the
projection, not a bug in this directory — see its own README.md for the
full argument. This is the one place in the pipeline where regenerating the
data is the mistake, not the fix.

### `data/season/<year>/week-<NN>/` is the season's actual record

`players.js`/`stats.js` are rebuilt from scratch every night, which is
exactly right for a live draft board and exactly wrong for keeping a record
of what happened in a given week — the next night's rebuild simply
overwrites it. `scripts/archive_week.mjs` runs weekly (Tuesdays, after
Monday Night Football and Sleeper's own box-score finalization) and writes
what actually happened that week — raw stats, snap/target usage where
Sleeper sends it, injury/depth-chart status at capture time, and points
under all three scoring presets — to its own directory, once. See
`data/season/README.md` for the shape and `scripts/archive_week.mjs`'s own
header comment for why it drives the real app in a headless browser rather
than reimplementing `pointsUnder()`.

**Archives are append-only.** The script refuses to overwrite an
already-archived week unless run with `--force`. This is the substrate a
projections backtest (graded against `data/baselines/2026/preseason/`) and
the future Waiver Room both need, and neither is buildable retroactively —
there is no asking Sleeper what it said about a week that has since passed.

**The pipeline stores raw components and no points total at all.** Scoring
lives in `app.js` (`DEFAULT_RULES` and `fantasyPoints()`), so all 49 rules are
editable on the setup screen and everything rescores with no rebuild.
Sleeper's own `pts_half_ppr` is discarded, as it always was, because it bakes
in assumptions we do not share.

**Every points total must go through `fantasyPoints()`.** There is no `pts`
field to read any more, so a direct read silently scores zero.

`STAT_KEYS` in `stats.js` maps each scoreable stat to its short key and is
**generated from `STAT_FIELDS`**, so the Python and JavaScript sides cannot
drift. Anything scoreable must be in `STAT_FIELDS` — a stat that was never
stored can never be rescored, and `build_players.py` fails loudly if a
`SCOREABLE` entry has nowhere to live.

**And it fails the other way too now, which it did not for a long time.**
`pointsUnder()` walks the rules object rather than the stat list, so a stat in
`SCOREABLE` with no entry in `DEFAULT_RULES` is never summed, and one missing
from `RULE_GROUPS` or `RULE_LABELS` never appears in the editor. Neither shows
up as an error — the total is simply lower than it should be.
`check_app_rules()` reads the three tables out of `app.js` and refuses to run
without all three, before any network. `unmatched.txt` has said "and give it a
default in app.js" at the head of its unstored-keys list all along; nothing
enforced it.

## The list nobody was reading

**`unmatched.txt`'s third section is the pipeline's own answer to "what is
missing", and it went unread for the entire life of the project.** It lists
every key Sleeper sends that `STAT_FIELDS` has no home for — **155 of them,
143 once the twelve `adp_*` entries are set aside** — under a heading that says
exactly what it means: anything here is a scoring rule the app could never
support.

It was found while scoping the nflverse integration below, by an audit of the
spec rather than by the spec itself. Most of what nflverse was wanted for was
already arriving from Sleeper and being thrown away: **missed field goals by distance, blocked kicks, longest kick, attempts,
red-zone targets and carries, air yards, yards after catch, drops, broken
tackles and snap counts.** All of it free — no join, no second source of truth,
no third party that can be down.

**So read that section before adding a feed.** A new source is only justified
for what is *not* on it.

**Free of a join is not free of a cost, and the second half of that sentence
had to be measured too.** All fourteen role, red-zone and snap keys were added,
the pipeline was run, and `stats.js` went from 101 KB gzipped to 183 — an 80%
increase on a plain classic `<script src>` that blocks the first paint. Broken
down by key: those fourteen are **70 KB of it**, `off_snp` and `tm_off_snp`
alone are 20.5, and **nothing in the app renders any of them.** The five
`fgmiss_*` bands that are the actual new scoring capability cost **0.7 KB**, and
the whole kicking line 3.2.

So the kicking keys ship and the fourteen do not, yet. They come back in the
change that draws them, next to the nflverse share and EPA figures they are
meant to sit beside — which is where the spec's own build order already put
them. **A stat costs a phone bytes on every load whether or not a pixel ever
shows it**, which is the same argument `WEEKLY_SEASONS` settles for weekly logs
and it lands the same way. Being already in the building is an argument about
the join, not about the payload.

### The second feed, and the three things it does add

**nflverse adds what Sleeper cannot, and it is a short list.** A statistic that
needs a denominator or a model bigger than one player's box score (share of a
team's targets or air yards, EPA, completion percentage over expected); an
independent second opinion on the numbers Sleeper already sends; and a handful
of plain box-score facts Sleeper has no key for — rushes of 20+ yards,
game-winning field goal attempts, misses from inside twenty. Only the second of
those is built today.

**The join is a name join, and that is not a compromise.** nflverse's
`players.csv` carries no Sleeper id at all, so there is no shared-identifier
tier to prefer. Measured 27 August 2026 against the 26 August board: **240 of
241 skill players match on normalised name, position and team alone**, every
one of them carrying a `gsis_id`. `link_nflverse()` reuses `index_sleeper()`
and `normalise()` for the same reason `link_source_ids()` does.

**A two-way player carries one position and it is not the fantasy one.** Travis
Hunter is `DB`/`CB` to nflverse and `WR` to us. His receiving is perfectly
present under his `gsis_id`; the position tier simply cannot see him. So the
nflverse master is filtered by *recency* and never by position, and he is the
one entry in `NFLVERSE_MATCHES`. **That table is not `MANUAL_MATCHES`** — that
one maps an FFC name to a Sleeper id and is read by `join_rows()`. Two
different joins between two different pairs of sources, and an entry in the
wrong one is a silent no-op.

**nflverse calls the Rams `LA`.** `TEAM_ALIASES` already knows, and
`clean_team()` is how you ask it. Found by a defence reconciling to zero.

### The audit never changes a stored number

Sleeper stays authoritative for everything in `STAT_FIELDS`. `pp` — the archive
of what we forecast for seasons already played — was built against it, so a
value quietly replaced from somewhere else would turn `projectionRecord()` into
a comparison between two feeds rather than between a forecast and an outcome.
The audit reports, into `unmatched.txt`, and that is all it does.

**Two definitional differences are applied rather than reported, and neither
may be "fixed" by taking nflverse's column.**

- **nflverse counts a touchdown as a first down; Sleeper does not.** Over 2025
  this explained 311 of 313 disagreements exactly — 32 of 32 passers, 161 of
  161 receivers, 118 of 120 rushers. Dropping their column into `cfd`, `rfd` or
  `pfd` would pay every league that scores first downs for every touchdown
  twice, and a receiver's total would rise by single digits and stay entirely
  plausible.
- **Sleeper counts a blocked kick as a miss; nflverse does not.** Eleven of the
  twenty board kickers agreed outright in 2025 (they had none) and the other
  nine matched exactly once `fg_blocked` was added back. Swapping their column
  in would silently forgive every block — and it would make kickers look
  *better*, which is the direction nobody checks.

**The rest agrees, and that is what makes the check worth running.** Measured
over 2025: 100% exact on passing yards, touchdowns, interceptions, attempts and
completions; carries and rushing touchdowns; receptions, receiving yards and
receiving touchdowns; every field goal made in all six distance bands; and
extra points made.

**Two feeds agreeing today is the baseline; the audit exists for the day they
stop.** It found two disagreements on its very first run, both of them Sleeper
changing its own mind years ago:

- **Sleeper's first-down definition changed between 2018 and 2020.** In 2018,
  42 of 55 first-down lines match nflverse *raw* — touchdown counted — and from
  2020 on, 91–99% match nflverse *minus* touchdowns. 2019 is the changeover and
  matches neither cleanly. So `pfd`, `rfd` or `cfd` disagreeing on an old season
  is expected; on 2024 or 2025 it is not.
- **A 60-yard field goal sat in Sleeper's 50–59 band before 2024** and in
  nflverse's 60+ band. Six kicker seasons across 2021–2023, every one a single
  kick, and the made-total always agrees.

**The disagreement rate falls steeply with recency** — 16.2% of comparisons in
2018, 4.1% in 2022, **0.3% in 2025**. Neither of the two above is fixable from
here: the history is what it is. What matters is that both are written down, so
the next thing that moves is visibly new. `AUDIT_NOTES` carries them, dated,
into the report itself.

### A season that has not started is a 404, not a fault

Every in-season nflverse file for a season not yet played returns 404 —
`stats_player`, `stats_team`, `snap_counts`, `injuries`, `pfr_advstats` and
`ftn_charting` all did for 2026 as of 27 August. Every fetch is optional and
prints its count, exactly as `PROJECTION_HISTORY` already does, so the pipeline
picks a new season up on its own the first morning after week one and nobody
edits a list. **A total nflverse outage now produces a `stats.js` identical
but for the absence of `u`** — every board number, every grade and every
projection is untouched, and the usage panel is simply not drawn. One loud
line in the log says so. Same rule the module docstring already states about
Tank01.

### The `u` block: the only thing nflverse writes

Everything else nflverse does here is a report. `build_usage()` writes exactly
one key, `u`, keyed by season the same way `s` is, and **nothing scores it** —
it is not in `STAT_FIELDS`, not in `SCOREABLE`, and `pointsUnder()` never sees
it. Ten fields: `ts`/`ays`/`wo` for target share, air-yards share and WOPR;
`ep`/`rep`/`pep` for receiving, rushing and passing EPA; `cpo` for CPOE; `r20`
for 20-yard rushes; `gwa`/`gwm` for game-winning field goals.

**It runs after the records are built and it has to.** `compact()` returns a
fresh dict assembled only from `STAT_FIELDS`, so anything merged into a record
before it runs is discarded without a word.

**All eight seasons cost 14 KB gzipped**, measured, which is why there is no
`USAGE_SEASONS` cut the way `WEEKLY_SEASONS` cuts weekly logs. Rounding on the
way in and dropping zeros is what does it — the raw values carry fifteen
decimals, and written naively the same block is over 30 KB. The marginal
season is about 1.5 KB, so trimming to three years would save four and cost
the sheet five seasons of history. `NFL_SEASONS` is `STAT_SEASONS` for the
usual reason: a `u` year with no `s` year beside it is a row the sheet cannot
place.

**Five things are deliberately not in it**, and four of them are the same
mistake in different clothes. `racr` and `pacr` are unstable and correlate
*negatively* with next season's points. `receiving_air_yards`,
`receiving_yards_after_catch` and `receiving_20` are all sent by Sleeper
already — storing nflverse's copy under an nflverse name is the trap the "do
not give an nflverse field a Sleeper key name" rule exists for, reached from
the other direction. `*_first_downs` is a different definition; see
`AUDIT_FIRST_DOWNS`. And **`games` is left out because `gp` is already in
every season block** — nflverse counts games in which the player recorded a
stat and Sleeper counts games played, so they differ on **12.9%** of seasons
(Keenan Allen 2018 is 16 against 15). Two plausible numbers for one fact, and
the sheet wants Sleeper's: *how much of the season was he here for*.

**A share is over the team's whole season, not over his own games**, verified
against nflverse's own aggregation. So a player who missed six games shows a
depressed share that is arithmetically correct and answers a different
question from the one the reader is asking — 68 stored player-seasons have
nine games or fewer and a share. It is never drawn without `gp` beside it, the
same rule `projectionRecord()` already follows and for the same reason.

**Air-yards share goes negative and that is real.** A screen pass is caught
behind the line, so the season total is signed: 126 stored values are below
zero. Anything drawing a proportion bar has to survive it, and a test pins it,
because clamping it to zero is the obvious and wrong repair.

### The Usage tab

`usageFor()` in `app.js` and `web/src/components/UsageTab.jsx`, sitting after
Projections in `PlayerProfileModal.jsx` — **Projections says how much he is
worth, Usage says why he scored what he scored**, which is the question the
sheet is actually opened for and the one the app could not answer at all.

**Which columns are meaningful is a football question and is answered in
`app.js`**, beside `logColumns()`, not in the component: a quarterback has no
target share, a kicker has nothing but his game-winners. `USAGE_COLUMNS` is
per position, and `usageFor()` formats every cell before React sees it — the
same contract `projectionSummary()` already has with `ProjectionsTab`.

**The tab is absent, not empty, when there is nothing to show.** `usageFor()`
returns null for a defence, an unjoined player, or a run where nflverse was
unreachable, and the tab is filtered out of the strip entirely. Same rule the
news tab already follows: a section nobody asked to wait for is worse as a
permanently empty panel than as no panel.

**The tab list is a filtered literal now, not an index splice.** It was
`fit ? [BASE_TABS[0], 'Draft Fit', ...BASE_TABS.slice(1)] : BASE_TABS`, which
means something different the moment a second optional tab joins the first —
and Usage is that second one. It is one ordered array with `fit && …` and
`usage && …` in place and a `.filter(Boolean)`, so the reading order is the
source order and adding a third optional tab is one line.

**Bowers is the case that justifies the GP column.** He reads 17.4% target
share in 2025 and 25.8% in 2024, which looks like a role collapsing — until
the 12 beside it says he missed five games and the share is over his team's
whole season either way. Without that column the table states a fact and
invites the wrong conclusion, which is the same failure as a kicker being
named the biggest reach.

**And the panel says out loud that it does not rank anybody.** Usage was very
nearly not built at all: measured against next season's points, no usage
metric beat points per game, and the best any of them managed *on top of*
points per game was +0.008 r. So it is on the sheet and nowhere near
`overallScore()`, `suggestions()` or `cpuChoice()`, and the tab's own footer
says so — because the next person to find these numbers will want to rank with
them.

**On a phone every research tab lives below the two actions**, strip included.
The sheet's contract is *"the numbers a pick turns on and the two actions that
follow from them, in one glance with nothing to tap through first"*, and what
that forbids is a strip placed *above* the content — which is what the desktop
card does, correctly, because a desk-side reader is not mid-pick. Below the
buttons the glance is untouched and the tabs are depth for whoever scrolls.
Measured on a 375×667 phone: the sheet caps at 85vh, Draft lands at **465px**,
and the strip is under it. Before this the phone could not reach Our Read,
Projections, Game Logs, News or the depth chart at all.

**One tab at a time rather than six panels inlined.** Inlining would put a
week-by-week log and a news request under every open, and Latest News spends
against a thousand-call monthly allowance. Our Read is selected by default:
the shortest, and the only one that is a verdict rather than a table.

**It is one strip and one set of bodies, rendered in whichever half is
alive.** A second phone-shaped copy of the same tables is the "written down
twice" rule in markup, and it drifts the first time a column changes.

**And that is what `useMinWidth` is for here.** `lg:hidden` and its opposite
are CSS, and **CSS-hidden is still mounted** — the exact thing that hook was
written for. Rendered in both halves, `LatestNewsTab` would mount twice for a
single open and ask the worker for the same player's headlines twice. Checked
by counting `<table>` elements inside `#draftroom-root`: exactly one.

**The resize path across 1024px cannot be tested in the embedded browser and
was not.** Changing the emulated viewport there fires **neither** `resize` nor
`matchMedia` `change` — verified by arming both listeners and watching the log
stay empty while the width went 375 → 1200 — so React keeps the width it
mounted with and one half renders blank. That is the harness, not the app:
both events are ordinary browser behaviour and the hook already relies on them
elsewhere. **Do not "fix" the hook against this symptom** — it is the same
shape as the wrangler crash-loop and the "network connection lost" flood, a
diagnosis about the tooling wearing a bug's clothes. Verify each width by
mounting fresh at it, which is what was done.

**Six columns fit 341px, and the scroller is there for when they do not.**
Measured at 375px for the widest set a position can produce — a quarterback's
`PASS EPA / CPOE / RUSH EPA / 20+ RUN` — the table comes out exactly 341
against a 341 scroller, with `overflow-x: auto` behind it and no sideways page
scroll. That is the rule this file already states about truncation: an element
wider than its box is only a bug when it can neither scroll nor ellipsise.

### Missed field goals are charged once, and the bands are an extra

`fgmiss` is the rule that charges a miss, it defaults to −1, and **it counts a
blocked kick** — checked against nflverse, whose `fg_missed` excludes blocks
and reconciles with ours for every kicker season once `fg_blocked` is added
back. The five `fgmiss_*` bands are an *extra* on top of it, default zero: a
missed 45-yarder increments `fgmiss` and `fgmiss_40_49` both, so a league
scaling a miss by distance sets the base on one and the increment on the
other. There is no `fgmiss_0_19` because Sleeper sends none — nobody missed
from inside twenty all last season.

**The bands count blocks too, and the first version of this section said they
did not.** That claim came from the nflverse comparison and was true of
*nflverse's* `fg_missed`, not of Sleeper's bands — a fact about one feed
written down about the other. It is checkable and was checked: `fga == fgm +
fgmiss` reconciles for all 310 kicker seasons without exception, so a block is
structurally inside `fgmiss`, and in the seasons where the bands are complete
they equal `fgmiss` exactly, so a block is inside a band as well. Adding
`fg_blkd` back on top of the bands overshoots, and the check that did it
reported 145 healthy seasons as broken on its first run.

**The symmetry with `fgm` is false and following it would break three things
silently.** Makes are stored as `fgm` and deliberately *not* scoreable, so a
made kick can only ever be charged through its band. Demoting `fgmiss` the same
way looks right and is not:

- it defaults to −1, so the change rescores **every** league rather than the few
  that opted in — `fgm` was never a rule at all, which is what makes the
  symmetry false;
- Sleeper forecasts misses only as `fgmiss_50p`, so no band would ever reach
  `PROJECTED_KEYS` and `fgmiss` would leave it — the 2026 board would charge
  nothing at all for a missed kick, which is the `fgm_50p` bug at the other end
  of the same stat;
- **the bands do not cover the history and `fgmiss` does.** They account for
  every miss from 2024 on and for 52–63% of them before that. A total that is
  whole in every season cannot be replaced by a decomposition that is whole in
  two of eight.

Every one of those is silent: `pointsUnder()` falls through to zero.

### The miss bands are lossy before 2024, and the sharp edge is the date

Measured 27 August 2026, over the kicker seasons Juke actually stores. The five
`fgmiss_*` bands account for **100.0%** of `fgmiss` in 2024 and 2025 and for
**48–70%** before — 2023 is the worst, with 28 of 54 misses in no band at all.
The boundary is sharp: no season is partly one and partly the other, so it is
Sleeper having filled in its own history rather than a definition anybody
disagrees about.

**Which is precisely why the bands are an extra on `fgmiss` and not a
replacement for it.** A league that scales a miss by distance gets a penalty
that fires on about half the misses of a pre-2024 season while `fgmiss` itself
stays whole — so the base charge is right on every season and only the
increment is short. Demote `fgmiss` and there is no whole number left anywhere.
The argument above was made before this was measured and the measurement is
what confirms it; it would have been the deciding reason on its own.

**Measure this on the pool you score, not on the league.** Across *every*
kicker Sleeper has, the six `fgm_*` bands are 9–17% short before 2024 — Daniel
Carlson's 2022 is 34 made and 23 banded. Across the pool Juke stores they are
short by **one kick, in three seasons, ever**, and in the other direction: the
bands *exceed* `fgm` by one for Jason Myers 2019, Ka'imi Fairbairn 2018 and Wil
Lutz 2018. Two honest measurements, an order of magnitude apart, because the
board carries the kickers whose history Sleeper kept best. The board-pool figure
is the one that describes what gets scored today; the league-wide one is the
warning about a kicker who joins the board tomorrow and brings a lossier history
with him.

**It hid because the totals are perfect.** `fga == fgm + fgmiss` reconciles for
all 310 kicker seasons without exception, so every number the pipeline could
reconcile *did* reconcile, and nothing had ever compared a band to the total it
decomposes. The same shape as roster construction sitting at 100 for all ten
teams: right arithmetic on a question nobody was asking. Adding the miss bands
is what made anybody aim a check at it.

**A part exceeding its whole is counted on its own, because it nets.** Three
seasons over by one against a season total that is otherwise short reads as a
−1.1% shortfall and looks like more sparse history. It is not the same fault and
cannot be repaired the same way, so `check_miss_bands()` lists it separately.

Nothing is repaired, because there is nothing here to repair it from: the kicks
Sleeper did not band are not recoverable from Sleeper, and nflverse's own bands
carry the `f60` boundary problem the audit notes already record. It is written
down, dated, and printed every run instead.

**The bands sit in their own group, and the group title is what says they are
additional.** Under "Kicking" beside "Field goal missed" they read as a
replacement for it, and a manager typing −1 into one would be charging −2 a
miss — which looks harsh rather than wrong.

**`check_miss_bands()` prints the split every run, in both directions**, and
counts a failure **only** for a season at or after `BAND_COMPLETE_FROM`. The
first version counted every lossy old season and reported 145 failures on a
pipeline that was working — which is the permanent-known-failure trap the
testing section already records: a check carrying a standing red stops being
read by the end of the week. What is expected is reported as a rate; what is
new is reported as a failure.

## The draft grade

Four components, weighted 50/25/15/10: starter strength, draft value, roster
construction, bye week safety. Each is computed for every team, scaled 0–100
against the rest of the room by `scaleAcross()`, then weighted. The grade is
a ranking inside the room, which is why somebody always gets an A+.

**Starter strength is projected points over replacement, scored against par for
the seat** — not ADP rank places, and not the raw total. Both of those were
wrong and both are written up below ("Starter strength was counting the wrong
thing", "Starter strength is scored against par for the chair"). The bars on
screen are positions within *one* room, not scores: comparing a component
across two drafts compares two different populations and means nothing.

Three of the four were wrong at once, found in one sitting in August 2026,
and they were wrong in the same direction: they all flattered picks nobody
chose to make. What follows is why each was wrong, because none of them
announced themselves.

**This section used to say "starter strength was correct throughout", and it
was the one that was wrong for longest.** See "Starter strength was counting
the wrong thing" below — it is corrected in place rather than left standing,
the same rule the rebrand section follows about orange.

**`bestLineup()` sorts by `aboveReplacement`, never by `posRank`.** A rank
inside a position cannot choose between positions, and the FLEX is a slot that
has to. Sorting by `posRank` filled it from TE19, RB25 and WR28 by taking the
tight end — 19 is a smaller number than 25 — when TE replacement is 14, so
that tight end was *below* startable and worth 0, while the running back was
five places above his own replacement and sat on the bench. (The raw figures
in this paragraph are in the rank-places unit `aboveReplacement()` used at the
time; it returns projected points now, and the ordering argument is unchanged
and stronger for it.)

Half the grade is starter strength, and it was being read off a lineup nobody
would ever field. Measured on one real roster it cost five raw points against
a room spanning 78 to 109, which is about eight points of final grade — several
places in a twelve-team room. Six of the twelve teams in that draft had it, all
six in the FLEX, all six a tight end.

This is the suggestions bug in a different function, and the lesson is the same
one: **a within-position measure cannot answer a between-position question.**
Inside a single-position slot the two orderings are identical, which is exactly
why it hid — every slot but the FLEX looked right.

### Starter strength was counting the wrong thing, in the wrong unit

Reported by the owner, 27 August 2026, as a D+ on the highest-VORP roster of
four mocks. Nothing in the grade was arithmetically wrong and every check in
this section passed. `aboveReplacement()` was:

```js
Math.max(0, replacementRank(player.pos) - player.posRank)
```

**`posRank` is ADP rank.** `buildBoard()` sorts the board by `adp` and numbers
each position off that order, so half the grade was asking "how early does the
market take him within his position", never "how good is he". The projection's
own within-position rank has been on every player all along as `projPosRank`,
and the grade never read it. Measured on the 26 August board: **Sam LaPorta is
TE12 by ADP and TE5 by projection**, so he scored 0 for a player the app
privately rates seven places inside the starting cut.

**And places are not points.** Replacement rank is `teams × slots + 1`, so the
*ceiling* is set by how deep a position is drafted rather than by what a player
is worth — measured, QB tops out at **10** places and TE at **11**, against
**24** for RB and **26** for WR. So Josh Allen at **+60.2** projected points
over replacement scored 10, and Drake London at **+18.0** scored 22: half the
grade rating London at better than twice Allen on a board that privately rates
Allen at over three times London.

**The user-visible consequence is that the app graded in one currency and
reported in another.** `replacementGap()` — points — is what the player sheet,
the Juke score and the Insights VORP matrix all show. A roster can hold the
room's best projected starters and read as the room's worst draft, and no
reader can get from one to the other. That is the same class as the standings
printing starter strength under a column of totals: a right number in the
wrong place.

It is points now, floored at 0, computed as `projPts - REPLACEMENT_PTS[pos]`.
**Deliberately not `replacementGap()` itself**, which refuses K and DST — that
refusal is about *ranking* them and the note under `UNRANKED_POSITIONS`
already says the grade is untouched by it on purpose, because a kicker really
did score those points.

**Which creates one thing to watch, and it is newly reachable rather than
new.** The VORP matrix dashes K and DST while starter strength counts them —
5 to 29 points a team, measured across a room. That contradiction existed
before and nobody could catch it, because the two were in different units and
nothing invited adding them up. Now they are the same unit, so a reader *can*
add the panel up, and the footnote has to say so. **Unifying two units makes
every previously-invisible disagreement between them checkable at once** —
budget for that, rather than being surprised by it.

**The cover term in `build` had the same defect** and moved with it: it ranked
bench receivers and backs by `posRank` too, so the cover a manager actually
wants — the player the room drafts late and the projection likes — was
invisible to it. Fixing one and not the other leaves the grade half-converted.

**Do not re-derive the old expression from the fact that replacement level is
a rank.** `replacementRank()` is still a rank and still the right way to find
*which* player sets the baseline; what may not happen again is measuring a
player's worth in distance from it.

### The printed weights were not the weights that ran

Found in the same sitting, by measuring rather than reading. `MIN_SPAN` floored
`starters` and `build` and left `value` and `byes` unfloored — so the two
components with the widest natural spread stretched across the full 0-100 on
every draft while starter strength was compressed into whatever a floored
denominator allowed. Measured as each component's share of the variance in
finishing order, across two rooms:

```
             stated   actually explained
starters      50%           ~35%
value         25%           ~36%
build         15%           ~13%
byes          10%           ~15%
```

**Draft value decided the grade more than starter strength did**, in a grade
that says on its own face that starters are worth double. A floor on one
component is never a local adjustment: scaling is what turns a raw spread into
the 0-100 the weights are applied to, so flooring one silently reweights all
four.

Every component has a floor now, in its own units and derived from its own
resolution — `{ starters: 20, value: 35, build: 20, byePenalty: 20 }`. After
the change, on the same board: **starters 55.7%, value 27.4%, build 6.5%,
byes 10.4%.** Build now under-influences, and that is the floor working rather
than failing — its raw span across a CPU-drafted room is 7, well inside its own
error, and a component that is not discriminating should not be handed 15% of
the answer.

**`MIN_SPAN.starters = 20` did not change value and its justification did.**
The old comment derived it as MAE 6.8 a player × √9 ≈ 20 *points* — correct
arithmetic, attached to a quantity that was counted in ADP rank places. The
number was right for a unit the code was not using. **A justification can be
sound and still be about something else; check the unit before trusting the
derivation.**

### Starter strength is scored against par for the chair

The points unit exposed this; it did not create it. In a room where every seat
runs the identical CPU rule — so no seat out-drafts any other — raw starter
strength spans **191 points** (seat 1 fields 362, seat 5 fields 171) and
correlates with the chair at **r −0.6**. Seat predicted finishing rank at
**+0.50**. In rank places the same room spanned 10 to 12, which read as
"identical drafters produce identical rosters" and was really "this metric
cannot see a 190-point difference".

Both facts are true at once, which is why the answer is not to shrink the
number: an early seat's lineup genuinely is worth that much more, and a grade
meant to judge *drafting* must not hand out most of a letter for where somebody
sat. So the component is **`startersVsPar`** — the seat's raw strength minus
what a straight consensus drafter would have got from that same chair. Golf's
par, or WAR's replacement, applied to a draft slot. Measured after: seat versus
finishing rank **−0.06**, and the printed weights land almost exactly
(**50.3 / 27.7 / 11.2 / 10.8** against 50/25/15/10).

**`seatParTable()` simulates par the way `shotPicks()` and
`generateThirdRoundScenario()` already simulate a room** — a local
`taken`/`have` pair, never `board[].drafted` or `state.picks` — so it runs
during a live draft without touching it, and asks `bestAvailable()` rather
than carrying a second opinion of what a seat would take. Three things about it
that are load-bearing:

- **No jitter.** `bestAvailable()` grew a `wobble` parameter for this one
  caller. Par has to be a property of the board, not of a draft: with the
  wobble in, the same roster scores differently because a reference draft it
  was never part of happened to wobble differently. Everyone else keeps it.
- **It is a table, not a number.** Par after three picks is not par after
  fourteen, and comparing a partial roster against a finished par is the
  "a component written for a finished roster behaves least like itself
  mid-draft" trap this file already records.
- **It is cached on the board, and it must be.** `bestUpgrade()` calls
  `analyseTeam()` once per available player, so an uncached simulation would
  run a full draft a hundred times to draw one panel. The key carries
  `BEST_VOR`, which is the tell for a rescoring — editing the scoring table
  rewrites every `projPts` and therefore every par.

**`starters` stays on the object as the raw sum** because that is what the
Insights VORP matrix prints per player and a reader has to be able to add that
panel up. `startersScaled` is *aliased* to `startersVsParScaled` rather than
computed separately, so no consumer sees two scaled starter figures and picks
the wrong one. The caption under the bar comes from `parText()` through the
bridge — a bar whose caption describes a different quantity from the bar is
this file's own "right value, wrong column" bug, and there were two call sites
ready to drift.

**Par may not apply the model multiplier, and the first version did.**
`bestAvailable()` applies `modelMultipliers()` unconditionally and
`cpuChoice()` never has, so par was benchmarking every seat against a
*Juke-advised* draft rather than a consensus one — a better drafter than
anybody in the room actually is. That is not a rounding error and it is not
evenly distributed: measured over ten seeds, mean `startersVsPar` ran **+80 at
seat 1 and −83 at seat 5**, a 163-point systematic residue in the one component
whose entire job is removing seat bias. `seatParTable()` passes
`{ wobble: false, model: false }` now, which makes par exactly `cpuChoice()`
unwobbled. After: the correlation between chair and mean `startersVsPar` is
**+0.05** and the residue is 79.

**The model stays on for every other caller**, `shotPicks()` especially — see
the note on why the hero shot is not an ADP slice. Par is the one place that
wants the market's opinion rather than ours.

**Par is an average over twelve wobbles, and the first version was one draft.**
A single realization is not an expectation — it is one sample with its own luck
in it. Measured: run par under twelve wobbles and a chair's own par moves with
a standard deviation of **18.9 points**, the same magnitude as the noise the
grade is trying to see through. Freezing one sample bakes that chair's luck in
permanently, as a fixed per-chair bias in every draft graded against it.

**It was visible for a while and was misread as a fact about the chairs.** The
single unwobbled par sat −4, −37, +30, +19, +23, −28, −12, +24, −18, −5 from
the twelve-wobble mean, and the residual `startersVsPar` by chair came out +4,
+40, −39, −9, −23, +32, +7, −31, +26, +7 — **the same numbers with the sign
flipped, chair for chair.** It was never chair-specific board interaction. It
was the error in par, and the tell was there to be read: a residue that is the
negative of your own baseline's error is your baseline, not your subject.
Residual spread went **79 → 20** on averaging, which is inside the standard
error twelve samples buy.

`PAR_SEEDS` is hard-coded and never `state.seed`, for the reason par exists at
all: it has to be a property of the board, the same for every client in a room
and the same tomorrow. Twelve puts the standard error of a chair's par at
18.9/√12 = 5.5, well inside `MIN_SPAN.startersVsPar`; twenty-four would buy 3.9
for twice the work. **The whole thing costs 30ms cold and 0ms warm**, measured,
so the cache carries it comfortably.

`bestAvailable()` grew `jitterOf` for this rather than the par run writing to
`board[].jitter` and restoring it. That save-and-restore is exactly the shape
`gradeAndRosterAt()` already documents as dangerous — one shared flag, several
callers, a restore that is only right if nothing else touched it meanwhile —
and a live draft is reading that field while this runs.

**What par does not remove is wobble, and that was measured rather than
assumed.** Across ten seeds, a seat's `startersVsPar` moves with a standard
deviation of **18.3 points**; drafting well rather than badly from the same
chair is worth **196**. So the luck is real and it is about a tenth of the
signal — which is why `MIN_SPAN.startersVsPar` stays at 20 rather than being
raised to cover it.

### Draft value is scored against par too, and it was the last of the seat bias

With starter strength neutralised, the chair still correlated **0.69** with raw
draft value while sitting at 0.04 against everything else — so value was the
whole of what remained. Mean value by chair ran −23, −16, −16, −10, +14, +4,
−1, −7, +12, 0: early seats reading as reaching, late seats as finding
bargains.

**It is structural, not behavioural, and that is what makes par the right
answer rather than a fudge.** Value is pick number minus board rank, and the
first pick of a draft can only ever score zero or worse because no player has a
board rank below 1. Nobody drafting from seat 1 can avoid that; a par drafter
in seat 1 cannot either, so subtracting it removes exactly the part nobody
controls and keeps the part they do.

`parRun()` accumulates value alongside lineup strength, and **it applies
`freelyChosen()` and `reachableRank()` by calling them**, on a pick-shaped
object, rather than restating what they test. analyseTeam() filters the real
picks through those same two before summing, and a par counting a different set
of picks would not be comparable to it — the sort of mismatch that reads as a
working grade for months.

Measured over ten seeds, chair against mean `valueVsPar` by chair: +2, +3, −1,
−3, −3, +5, +3, −3, −1, −2, a spread of 8 against a `MIN_SPAN` of 35, so it
contributes nothing to the scaling. And the composite finally follows:

```
chair vs mean finishing rank    −0.51  ->  −0.11
worst per-room chair vs rank     0.30  ->   0.17
influence (S/V/B/Y)      54/25/9/11, against a stated 50/25/15/10
```

**`extra` advances par for starters and deliberately not for value.** A
hypothetical additional player is counted by `bestLineup()` and so by starter
strength, but `judged` is built from `state.picks` and never sees him — so
advancing value's par by a pick he did not contribute to would charge a
simulated bargain against a roster that never took one. Nothing reads
`valueVsPar` for a hypothetical today, since `bestUpgrade()` only simulates
starters and build, which is precisely why it would have gone unnoticed.

**Raising that floor was tried against the measurement and is wrong.** It looks
like the obvious way to suppress wobble luck, and it makes every number that
matters worse: at floors of 20 / 100 / 130 / 200 the worst per-room chair
correlation goes **0.37 → 0.38 → 0.41 → 0.50** and starter strength's share of
the grade falls **0.544 → 0.524 → 0.479 → 0.376**, away from the 50% it is
supposed to carry. The deliberately unbuilt roster finishes last in 6 of 6
seeded rooms at *every* floor, so nothing is bought for it either.

### `startDraft()` does not clear `state.picks`, and a loop over seeds is a lie

The single most expensive thing in this whole pass, and it produced two
confident, precise, wrong answers before anything caught it.

`JukeEngine.startDraft()` calls `buildBoard()`, sets the seed and applies the
jitter — and never touches `state.picks`. So the *second* iteration of any
"run a draft per seed" loop finds 140 picks already sitting there,
`draftOver()` is true immediately, the while loop never executes, and the
"new" draft is byte-identical to the old one because **it is the old one**.

What that produced, both stated as measured facts:

- "changing the seed changes nothing about the draft" — six seeds, six
  identical drafts
- "jitter is inert: 0 of 140 picks differ with it zeroed"

Both false. With `state.picks.length = 0` and `board.forEach(p => p.drafted =
false)` before each run, six seeds give **six distinct drafts differing in 60
to 73 of 140 picks**, and zeroing the jitter changes **90 of 140**. The wobble
works exactly as designed.

**The tell was available and went unread for three measurements.** A no-op run
returns a draft of the right length with plausible numbers — there is nothing
malformed to notice. What gives it away is a *zero* standard deviation:
per-seat `startersVsPar` came back identical to the point across ten seeds,
which is not what any real stochastic process does. **A variance of exactly
zero across samples means the samples are the same sample**, and that is worth
checking before it means anything about the thing being measured.

It also very nearly justified deleting a working feature. The conclusion on the
table was "`DraftEngine.jitter()` is inert, the CPU wobble does not wobble" —
an interesting, plausible, well-evidenced claim about `jitter()`'s sawtooth
arithmetic, and entirely an artifact of the harness. Same shape as the wrangler
crash-loop and the "network connection lost" flood: **a diagnosis about the
tooling wearing a bug's clothes.**

Anything driving repeated drafts from the console resets both, or measures
nothing.

`tests/grade.spec.mjs` gained "the chair a manager drafts from does not decide
their grade", which asserts both halves — chair-versus-rank near zero *and* the
raw figure still seat-driven, since a par that flattened the component instead
of re-centring it would pass a one-sided check. **Confirmed against the bug**:
scaling `starters` again puts chair-versus-rank at **+0.47** and fails it.

Its older premise line asserted `rawStarterSpread < 25` and now asserts a
bounded seat-driven spread instead. **That failure was a stale threshold in a
retired unit, not a regression** — the assertion the test exists for passed
throughout, which is exactly the tell the testing section describes.

### The one that got away had no roster in it

`DraftInsightsDashboard.jsx` scanned each gap between a team's picks and named
the biggest `replacementGap()` upgrade somebody else took — a comparison
between two players with no reference to the roster being advised. Reported
from a real draft: a team holding **two elite tight ends was told it had missed
Sam LaPorta.** The subtraction was right and the advice was unusable, because a
third tight end cannot start, so those points were never available to that
roster at any price. Same failure as naming a kicker the biggest reach.

`oneThatGotAway()` lives in `app.js` now, beside the grade, and the delta is a
**substitution run through `bestLineup()`**: the roster as drafted against the
roster with that pick swapped for theirs. Swap, not add — a roster carrying
both is a team that never existed, and adding is what lets a spare tight end
look like a gain by occupying a bench spot nobody was choosing between.

Verified both directions on one board: a team holding Bowers (TE1) and McBride
(TE2) scores **+0.0** for LaPorta and **+0.0** for the next-best tight end, so
neither can be named; a team holding Loveland (TE3) and Kincaid (**TE12, worth
0**) scores **+27.9** for LaPorta, who really does displace Kincaid into the
lineup. A better tight end who beats a starter still counts, and should — the
rule is about the lineup, not about the position.

**A component may not decide this for itself.** It rendered a verdict it also
computed, which is the "written down twice" rule in React; the engine decides
and the component draws, the same contract `usageFor()` and
`projectionSummary()` already have.

**A component that is the same for every team is not in the grade.** This is
the check to run first on anything in here. `scaleAcross()` hands every team
50 when the span is zero, so a constant contributes a constant and the weight
beside it is a lie. Roster construction sat at exactly 100 for all ten teams
and had presumably done so for every draft the app had ever graded. Print the
spread of a component across the room before believing it works.

**The draft value gap is pick number minus board rank, in that order.**
`p.overall` is where the pick happened, `p.player.overall` is where the board
had him, so a player still there at 121 whom the board ranked 106 scores
**+15** — he fell fifteen picks, and that is a bargain. It was subtracting the
other way, which swapped the two callouts and, worse, meant a quarter of the
grade spent every draft rewarding reaches and punishing bargains.

It survived because everything around it was right: both callouts already
printed "picks late" for a positive gap, and the how-it-works page already
said a player taken later than his rank is a bargain. Correct prose over
inverted arithmetic reads as correct until somebody knows enough football to
notice the answer is absurd.

**Kickers and defenses are excluded from draft value and from both
callouts.** `cpuScore()` refuses a kicker before the last two rounds and a
defense before the last three, and the suggestions never offer one earlier —
so the app picks the timing, not the manager. Their ADP comes from drafts
that run more rounds than most leagues here, which routinely puts a kicker's
board rank past the last pick that exists, so taking one at all reads as
early. Measured over a ten-team, fourteen-round draft, the mean gap ran
WR +6, RB −2, QB −9, DST −12, TE −22, **K −35**, and every one of the ten
kickers scored as a reach with none neutral. Grading somebody for obeying a
rule the app enforces is not a judgement about drafting. Dropping them moved
no team more than two places, because every team drafts the same forced pair.

**Roster construction measures cover, and it has to be graded rather than a
threshold.** The old test was "fewer than starters + FLEX + 1 at the
position", which is four running backs in the default league — and the CPU's
depth allowance puts every team at exactly four. The cliff sat precisely
where the CPU stops, so it never fired once. It now asks how far from
startable the best benched player at each of RB and WR is, in places past
replacement: nothing if he could start today, the full 12 at `COVER_NONE`
places past it or with nobody there at all.

**Bye week safety counts every bad week, squared.** It used to read the worst
week and stop, so three starters out in week 6 *and* three more in week 8
scored what a single bad week scored — everything after the first was
invisible. Squared because the weeks are not interchangeable: four out at
once is a week you probably lose, three out twice is two weeks you patch from
the bench. One week of four (−80) therefore outranks two weeks of three
(−40), and two bad weeks always beat one.

**`GRADE_SCALE` is fourteen long and `TEAM_COUNTS` goes to twenty-four.** The
index is clamped. Without it a sixteen-team room printed the literal word
"undefined" in the room standings against fifteenth and sixteenth. Anything
indexing that array by finishing position needs the same clamp. Stretching
the scale to fit the room was the alternative and was rejected: it would
quietly regrade every ten-team draft, which is a bigger change than the bug.

**The room standings have no score column at all now, and the rule that used
to govern it is why.** Whatever sat between the rank and the letter had to be
the weighted total, because the table is ordered by that total and a column
showing anything else makes a strictly ranked table look broken. The reason it
is gone is the section below on the letter and the hundred — the same
requirement, followed one step further. What follows is the bug that
established the rule, and it is still the reason nothing else may go there.

It used to print starter strength — one component of four — which produced
this:

```
1  The Gibbs Ultimatum   90  A+
4  Your Team             90  B+
5  Nacua Matata          90  B
7  Purdy Vacant          90  C+
```

Four teams sharing a 90 across ranks one to seven with four different grades,
in a column that climbed and fell down a strictly ranked table. Every one of
those numbers was correct and correctly rounded. Nothing underneath was
wrong: those four really did have equal starter strength and really did
separate on the other three components. A reader has no way to know that.

**Which is the lesson worth keeping from it.** Every other bug in this
section was in the arithmetic, and reconciling a total against its parts
catches those. This one had no arithmetic to catch — a right value in the
wrong column — and it only surfaced by reading what the analysis *renders*
and comparing it to what the analysis *computes*. Do both. A grade can be
correct and still be unbelievable, and an unbelievable grade is a broken
feature: this is the same failure as a kicker being named the biggest reach.

### A letter grade may not stand next to a score out of a hundred

Reported by the owner: *why does an "A" sit above "69 / 100"?* Because the
letter is finishing position and the number was a room-relative min-max
composite — two different scales, printed an inch apart, and every reader
arrives already fluent in a third one where A means 90 and F means below 60.

**Measured on a real ten-team room: the letter agreed with the school reading
of the number beside it on 0 of 10 teams.** The A+ scored 76, the A scored 69,
and seven of the ten would have been an F by the scale the reader is actually
using. Two further consequences of indexing a fourteen-step scale by rank:
**nobody can score an F in a ten-team league** — the worst available letter is
D+ — and **somebody always gets an A+**, including in a room where every seat
drafted identically.

**Curving the letter off something absolute was measured and rejected.** With
par in place there is finally an absolute quantity to curve — `startersVsPar`
is real projected points against what a consensus drafter would have got from
that chair — so it was tried properly, against a ladder of drafters making
deliberate mistakes on a known fraction of their picks:

```
mistakes    0%     10%    20%    30%    50%    70%   100%
vsPar        0     -17    -29    -43    -65   -122   -193
SD         7.8    23.4   28.7   27.9   41.1   47.7   46.5
```

It fails for two reasons that are worth keeping. **Par is a ceiling, not a
midpoint** — `autoPickForMe()` and `cpuChoice()` return identical picks on a
stock table, so the app's own advice *is* par and nothing systematically beats
it; the best anything managed was +30, and that was wobble luck. And **the
noise swamps the signal where users live**: at a 10% mistake rate the effect is
−17 against an SD of 23. Built at 25-point bands, a normal room came out **A+
×37, A ×3 of 40**, a drafter erring on half their picks still read A+ or A−
about half the time, and one guessing on every pick never reached F. Less
informative than the ranking it would have replaced.

**Making both numbers rank-derived fails too, and the reason is structural.**
Stretch the fourteen letters across the room and print a percentile instead:
3 of 10 agree. School bands are wildly non-linear — A is the top ten points, F
is the bottom sixty — and a percentile is linear in rank. No mapping of ten
ranks onto letters satisfies both.

So the number goes and the letter stays. `A · 2nd of 10` is internally
consistent and needs no explaining, because the rank says exactly what the
letter means. Removed from the share card, both Analysis headers, the Insights
summary, the mobile `grade · score` chip, and all three standings tables.

**What deliberately stays.** The component bars' own `Weighted sum = 55.9`
line, where four bars visibly add up to it and nothing calls it a percentage —
that is the reconciliation the grade section already requires. And
`Roster construction 90 / 100`, which is a genuine component out of a hundred
with no letter beside it. The rule is about the *pairing*, not about the
number: a test asserting the total were absent would fail on the first, and one
asserting `/ 100` were absent would fail on the second.

**`shareData` no longer carries `total`.** A field left on the object that
nothing draws is an invitation to put the line back without the reasoning that
took it out.

**And `RANK_COL_W` had to be re-derived, not just left.** The share card sizes
the grade glyph to whatever the rank column leaves it, and that constant was
307 because the widest line *was* `100 / 100 weighted score`. With that line
gone the widest is `24th of 24` — measured at 206px with Archivo actually
loaded. The constant is 230 rather than 206 because **it is the clearance**:
the gap between the longest rank line and the panel is `RANK_COL_W` minus the
rank width and nothing else, so 210 produced a 6px near-miss on a 24-team card.
230 leaves 24px, the gutter the panel already keeps, and the grade still grows
from 208px to 262. **A constant derived from a string is wrong the moment that
string changes** — and it fails as a collision, not as an error.

### A weight is not a share of the outcome, and build is where they part

Asked, reasonably, to "fix build's weight" once its share of the finishing
order came out **5.1% against a printed 15%**. The measurement says the
expectation is wrong rather than the number, and the weights were deliberately
left alone.

**Influence is weight times spread, and only three of the four components have
a spread that is fixed by construction.** Measured over twelve rooms with a
human in each:

```
startersScaled  29.9      valueScaled    28.8
byePenaltyScaled 33.1     buildScaled     9.0
```

The first three go through `scaleAcross()`, which is min-max — it *stretches*
them to fill 0-100 whatever the room actually did, so their spread lands near
30 every time. `build` is its own raw score now (see the section below), so it
spreads as much as rosters genuinely differ, which is not much: most teams are
built alike.

**So equal weights cannot buy equal influence once one component stops being
stretched.** That is not a defect that appeared; it is a property that was
hidden while build was scaled like the rest. The printed-weights rule this file
already records — that 50/25/15/10 has to be what runs — was true of four
components normalised the same way, and stopped being achievable the moment one
of them was deliberately not.

**Every alternative is worse, and they were costed rather than dismissed:**

- **Raise build to 0.37**, which is what delivers 15% of the outcome. It makes
  roster construction the joint-largest weight in a grade whose entire premise
  is that starters are worth double, and it manufactures separation the data
  does not contain — the thing `MIN_SPAN` exists to prevent, reached from the
  other side.
- **Lower build to 0.05** to match the influence. It does not even do that:
  weight and influence move together, so 0.05 yields about **1.7%**, and
  chasing it converges toward zero.
- **Scale it again.** That is the 0 the owner reported, restored.

**Build's small spread is information.** A component that rarely separates
people should rarely separate people. What was actually wrong is the label: a
bar reading `wt 15%` invites being read as "15% of your grade", and for this
one it is not. The panel says so in a line under the weighted sum now, which is
the cheapest honest fix and changes no grade.

### Roster construction is the one component that is not scaled

Reported by the owner: *why is roster construction 0 on a mock I got a B and
finished 5th of 10 in?* Because `build` was going through `scaleAcross()`, and
it is the one component that should never have.

The other three are in their own units — points over par, picks over par,
squared starters off in a week — so they have to be projected onto the 0-100
the weights are applied to. **`build` is already that**: it starts at 100 and
subtracts named penalties, so it is an absolute score, comparable across rooms,
before scaling ever sees it. Putting it through a second transform is what
produced the number.

**And the second transform destroyed the information.** `scaleAcross()` is
min-max, the nine CPU seats build to one rule and cluster at the top, so a
human is the room's minimum almost every time — and the minimum is 0 by
construction. Measured over ten rooms with one realistically imperfect human in
each: **the human read 0 on eight of ten**, with raw builds of 44, 47, 54, 60,
67, 73, 76 and 79. A roster worth 79 and one worth 44 printed the same 0. It
was not a harsh number, it was an empty one. The owner's case reproduces
exactly: raw 79, scaled 0, grade B, 5th of 10.

The cliff was sharp and close to ordinary. In a typical room the raw values sit
83–98, span 15, which is under the old `MIN_SPAN.build` of 20 — so the
denominator was the floor, the midpoint sat at 90.5, and **anything at or below
81 clamped to 0**: no RB cover read 38, no RB *or* WR cover read 0.

**`buildScaled` is aliased to `build` now**, rather than the key being dropped,
because every consumer reads that name — both dashboards' bars, the
weighted-sum line that has to reconcile against them, the share card, the
specs. One name, one number, and the panel still adds up.

**The cost is real and is not hidden.** Build's share of the finishing order
falls from **13.8% to 5.1%** against a stated 15%, measured on rooms with a
human in them. That is the honest consequence of a component that varies less
than the scaling made it appear to, and it is the trade this file's own rule
asks for: a number nobody can act on is worth less than a number that moves the
grade. **Whether 15% is still the right weight is a separate question and has
not been answered.**

`MIN_SPAN` has no `build` key any more — a floor for something nothing scales
is a number nothing reads.

**The caption had to change with it.** It was `me.build + " / 100"`, which
under a raw headline is the same number twice. `buildText()` names what cost
the points instead — "no RB cover", "2 spare QB", "1 empty starting slot" — and
it lives in the engine beside the arithmetic that assigns them, the same
contract `parText()` and `usageFor()` already have. **It has to name partial
charges too**: cover is graded rather than a cliff, so naming only total
absence printed "nothing missing" on a roster scoring 86 — a caption
disagreeing with its own headline by fourteen points.

**`build` is floored at zero, because it is printed as "x / 100".** Three
rounds in, with six starting slots still empty, the bar read
`Roster construction: -8 / 100` — nine holes at fourteen each and no cover at
either running back or receiver, because there is barely a roster yet. The
sum was right; a score out of a hundred going negative reads as a broken
number rather than a bad roster.

Clamping costs nothing, which was measured rather than assumed. Sampled every
twenty picks through a full draft, the only negatives are in the opening
rounds, and there the score separates teams by whether their third pick has
come round yet — snake position, not construction. From round four on it
never approaches zero, and the number of distinct scores in the room is
identical clamped or not at every stage.

**Open the Analysis tab mid-draft, not just at the end.** Every check in this
section had been run on a completed board, and the incomplete one is a state
every user passes through on the way there. It is also where a component
built for a finished roster behaves least like itself: unfilled starting
slots are catastrophic at pick 140 and inevitable at pick 25, and the same
penalty fires either way. Zero picks is worth a look too — the panel is
supposed to say "Nothing to grade yet" rather than grade an empty room.

**How many of a position you may hold is `starters[pos]` plus the superflex,
for a quarterback.** `league.starters.QB` is 1 in a superflex league as well,
because the extra seat is a SFLEX rather than a second QB slot. Reading the
allowance straight out of `starters` therefore docked every team in a
superflex room nine points for the quarterback the format obliges them to
hold — and not as a flat charge that washes out when everyone pays it.
Dropping the second quarterback *improved* the score: on a built roster,
replacing him with a spare receiver cost five points of starter strength and
gained seven of construction. The component was paying teams to misbuild.

**And this is what the league-shape rule above is for.** `cpuScore()` has had
`league.starters.QB + league.superflex` since superflex was added, so the CPU
drafts two quarterbacks knowing the format allows two, and the grade then
marked it down for doing exactly that. One rule, written down in two places,
which drifted — precisely the failure "nothing about the league shape may be
written down twice" exists to prevent. When something here needs to know what
a league permits, check whether the engine or the CPU already answers it
before writing a second answer.

## The Juke score

Projected points above a replacement starter at that position, as a share of
the best such figure on the board. `overallScore()`, and it is the one number
the app has that a projection feed does not.

**It is a ranking against the pool, not a rating of the player, and nothing on
screen said so.** Both ends of the scale were being read as verdicts: a bare
`0` as "worthless" and a bare `100` as "perfect". Neither is what the number
means, and no reader could get from one to the other unaided.

**The pile of zeros is arithmetic, and that was measured before anything was
changed.** Around three fifths of the half-PPR board scores exactly 0 — the
majority state, not an edge case. Scored on a *fixed cohort* of the players
with a line in 2023, 2024, 2025 and a 2026 projection, so survivorship cannot
drift the answer, the share scoring zero is **the same in every one of those
real completed seasons as it is in the projection** — measured 16 August 2026
at 38.5% against 39.9% over 148 players, and 39.7% against 41.1% over 151 the
day before. A fixed rank cut against a board a couple of hundred deep, in a
league that starts about ninety players, puts most of the pool below the line
whatever happens on the field.

**Those counts move every night and the conclusion does not.** `players.js` is
regenerated daily, so any literal total written down here is stale within a
day — which is why the figures above carry a date and why the app derives
`board.length` rather than quoting one. A drifted number is not a bug; a
number without a date is. So there is nothing to correct in
the maths and re-curving the scale would be correcting football. The floor
needed a name, not a new formula.

**Two zeros are not equal, which is what `replacementGap()` exists to say.**
Michael Wilson scored 14 on last season's actuals — 181.6 points across all
seventeen games, +29.4 over replacement — and reads 0 for 2026 because his
projection falls 45 points *while projected WR replacement rises 22*. Most of
that 67-point swing is the projection compressing the field, not a judgement
about him. It stays out of `overallScore()` deliberately: `modelMultipliers()`
divides by the best score available and a negative there would invert the
discount.

**A score can rise while the points fall, and Gibbs is the case to keep.** He
actually scored 328 points last season for a Juke score of **82** — McCaffrey
was the 100 that year. His 2026 projection is 300 points, twenty-eight
*fewer*, and he scores **100**. Nothing is wrong: a projection is an average
over everything that might happen, so it shaves the extremes off everybody, and
he rises because the field beneath him was compressed further than he was. One
player explains the entire metric, which is why the sheet and the how-it-works
page both carry him.

**The number is sharper than the sport supports, so do not dress it as
precision.** Year to year across real seasons the score persists at r 0.35–0.55
(0.52–0.55 pace-adjusted at 10+ games) with a mean absolute move of 12 to 20
points, and between a quarter and two fifths of the players above zero one year
were back at zero the next. The 2026 projection sits at **r 0.79 against last
season's actuals, MAE 6.8** — roughly twice as tightly coupled to last year as
consecutive real years are to each other. It is last year, smoothed. That is
expected of a projection built knowing last year and is not a bug; it is a
reason to present a ranking rather than a measurement.

**One number may not have three names.** The strip said "Juke score", the meter
two hundred pixels below it said "Overall", the queue row said "Overall" and
the table column said "OVR" — all the same figure, with nothing connecting any
of them, so the sheet appeared to show two unrelated ratings. It is the Juke
score everywhere now. **"Overall" still appears on the sheet and correctly so:
it is the board rank in the first cell of the strip**, which is a different
fact and always was.

**The explanation already existed in the worst possible place.**
`overallReason()` had been writing exactly the right sentence all along and was
reachable only as a `title` tooltip on a table cell — which is to say not at
all on a phone, and never on the sheet somebody opens *because* they are
confused. `jukeNote()` puts it under the strip. When something is unclear on
screen, check whether the app already computes the answer before writing a
second one.

**`buildPriorSeason()` runs inside `buildProjections()`, and it has to.** Last
season is scored with the same `fantasyPoints()` under the same rules, so it
rescores when the scoring table moves exactly as everything else does — a
historical figure that ignored the editor would be the one number on the sheet
quietly describing a different league. Its replacement level is re-derived from
what actually happened rather than reused from the projection: measuring last
season against this season's baseline would call the difference a change in the
player, which is the precise error the comparison exists to expose.

**A missing season is blank, never zero.** Eighteen players on the board have
no line at all, and a 0 there would be a judgement about a season they were not
in — the same rule as "treat `0` from an API as missing".

**`pp` in `stats.js` is what we said about seasons that have since been
played.** Only the coming season's projection was ever stored and it was
overwritten nightly, so the one question worth asking of a projection — was it
any good — had no data behind it at all, and the numbers above had to be
assembled from actuals alone. `PROJECTION_HISTORY` in `build_players.py` fetches
past seasons from the same endpoint; each is optional and the counts are
printed, so a season Sleeper declines to serve is visible in the run rather
than silently absent. Even if every one comes back empty the list still earns
its place, because next year's run finds this year in it.

## Grading the projection against itself

`pp` in `stats.js` holds what we forecast for 2023, 2024 and 2025, beside what
actually happened in `s`. That made the only question worth asking of a
projection answerable for the first time.

**Check the archive is preseason before believing any of it.** Sleeper's
endpoint takes a year, and a forecast updated *during* a season would grade
itself brilliantly. It is not: every player who ended up playing four games or
fewer was still projected for a full eighteen, in all three seasons without
exception. That test is the first thing to re-run if the archive ever moves.

**The projection beats repeating last season, everywhere.** Against actual
points: r 0.83 / 0.79 / 0.72 for 2023 / 2024 / 2025, against 0.58 / 0.57 /
0.59 for last year's actuals used as this year's forecast. So the board is
built on something better than the naive alternative, which was previously an
assumption. Note the population is players on *today's* board, so anyone who
washed out of the league is missing and both predictors are flattered.

**Availability is most of the error, and it cuts both ways.** Players who
managed 15+ games: r 0.873. Under 15: r 0.617. And for the healthy group the
projection runs **20 points light** — a forecast is an expected value that
prices in injury risk, so it must undershoot everyone who avoids it. A healthy
season routinely beats its own projection and that is not a miss.

**The top of the Juke score is trustworthy and the floor is not a sentence.**
Projected 90+ finished at a median of 83, with 80% clearing 50. Of the
projected zeros, 68% finished at zero — so a third climbed out, which matches
the 35% measured from actuals alone by a different route.

### Our record on a player

`projectionRecord()` puts what we forecast beside what happened, on the Seasons
tab. It is the only number on the sheet that can be checked rather than
believed, and it is the thing a projection feed will never show you about
itself.

**Both halves go through `fantasyPoints()` under the current rules**, so it
rescores with the scoring editor like everything else. A historical figure that
ignored the editor would be the one number here quietly describing a different
league.

**Games played is not decoration, it is the honesty.** McCaffrey 2024 reads
"we said 250, he got 40, −210" and that is a true number a reader would draw
entirely the wrong conclusion from. Beside it sits a dimmed **4**. Availability
is most of the projection's error — r 0.873 at 15+ games against 0.617 below —
so the count is what separates a wrong read from a hamstring.

**A column of green needs explaining too.** The forecast runs about 20 points
light on anyone who stays fit, because it is an expected value that prices in
injury risk, so most healthy seasons beat it. Without the note under the table
that reads as a model that is simply too low rather than as one doing its job.

**A season with a forecast but no real games is not gradeable and is dropped**,
and a defense shows a dash rather than a games count — `gp: 1` on an aggregate
DST row is not one game, which is the bug `perGame()` already exists to prevent
arriving from a new direction.

### Kickers and defenses are not ranked, and that is measured

The projected order for these two has no relationship to the finishing order:
**K at r 0.37, −0.09, 0.57 and DST at 0.32, 0.06, 0.25**, against 0.58 to 0.73
for every other position. One kicker season came out backwards.

**There is a mechanical reason and it cannot be repaired from the feed.**
`PROJECTED_KEYS` already records that Sleeper forecasts only `fgm_40_49` and
`fgm_50_59` — **no field goal under forty yards at all**, which was 253 of the
406 made in 2025. Jason Myers was projected 81 points and scored 195. There is
no total FG count in the feed to subtract from, so the short kicks cannot be
recovered, and inventing them would be this pipeline recording an opinion.

This is the same family as the `fgm_50p` bug `reconcile()` fixes, at the other
end of the range, and the difference is that this one has no fix.

**About half the bias cancels in value over replacement** — a kicker and his
replacement move together — and none of the ranking noise does. No arithmetic
repairs r = −0.09, which is why the answer is to withhold the number rather
than adjust it.

**`overallScore()` returns null for `UNRANKED_POSITIONS`,** which flows exactly
as a missing projection already does: a dash on the sheet and in the table, and
`modelMultipliers()` leaving the player where the market put him rather than
pushing him down for the want of a score.

**Withholding has to be complete or it is worse than not withholding.** A
sheet that prints a dash in the strip and then says "K1 on the projection"
three lines below has told the reader to distrust a number and then argued
from it. `ourRead()` and the method note both change for these positions, and
the meter is *replaced* rather than fed a null — left alone it renders an empty
bar labelled "Very Low", which is a verdict, and further from the truth than
the number it replaced.

**The grade is deliberately untouched.** It runs on `aboveReplacement()` and a
kicker really did score those points. How a finished roster performed and how
well a forecast ranks are different questions, and only the second one failed.

**This survived `aboveReplacement()` becoming points, and it had to be kept
deliberately.** The obvious move once both are measured in points is to call
`replacementGap()` from the grade and delete the duplicated arithmetic — and
that would silently drop K and DST out of starter strength, because
`replacementGap()` honours `UNRANKED_POSITIONS` and this must not. The grade
computes `projPts - REPLACEMENT_PTS[pos]` itself for exactly that reason. Two
functions doing the same arithmetic on purpose, with the refusal in one of
them, is the point rather than an oversight.

## Team colour

One mark per club, in `TEAM_ACCENT`, used in exactly two places on the player
sheet: a ring around the headshot and a band under the header. **Nothing is
ever written on top of it, and that restriction is the whole design.**

**A team-coloured header does not survive thirty-two real teams.** Darkened
far enough to carry white text — lightness only, hue and saturation held, the
same repair the position solids had — ten pairs land below the just-noticeable
difference and 27 of the 496 pairs sit within 6 CIE76. Carolina, Detroit, the
Chargers and Houston all become the same dark teal; Dallas and Indianapolis
become one navy. You pay the whole contrast bill and lose the identity you
were buying. At brand values only 9 pairs are that close, so it is the
darkening that destroys it, and the darkening is not optional if type sits on
top: **Pittsburgh's gold is 1.76:1 against white and New Orleans' is 1.85:1.**

**So the colour goes where there is no text, and then it can be the real
brand colour.** Which is the same trade the position solids could not make —
those carry white type by definition, so they had to move.

**Seven clubs vanish into a navy header at brand value** — CHI, DAL, HOU, JAX,
NE, SEA, TEN, every one of them a navy or a near-black, because the header is
itself brand navy. Those seven take the mark the club is actually known by,
which is a substitution their own kit makes: Chicago's orange, Seattle's
green, Jacksonville's gold, Dallas silver. Raiders silver too — black is
legal against navy and reads as nothing.

**The test is perceptual distance, not contrast ratio.** A decorative mark is
not a UI control and the club is named in text beside it, so 1.4.11's 3:1 is
the wrong bar — measured that way 30 of 32 "fail", and lightening them to pass
moves 30 clubs more than 8 CIE76 off their brand, turning Cleveland brown into
orange. Measured as CIE76 against every surface the mark can touch — all three
navy stops and the card in both themes — every accent clears 12, worst case
13.6. Three pairs are effectively one colour and always will be: CIN and DEN
share a hex, ATL and HOU both use #A71930, CAR and LAC are 2.3 apart at brand.

**It reaches the stylesheet as `--team` on the header, never as a fill.** Same
pattern as `--mark-ink` on a `<use>`. `:root` would be the wrong home: these
are somebody else's colours and there are thirty-two of them. The default
lives on `.sheet-head` so a club with no mark still draws a ring and a band.

**Clear it, do not merely set it.** The sheet is one element reused for every
player, so a sheet opened after Pittsburgh's inherits gold unless the property
is removed. `openSheet()` removes rather than blanks.

**A ring is a `box-shadow`, not a `border`.** Everything is
`box-sizing: border-box`, so a border leaves the outer circle at 62px and eats
three pixels out of the *inside* — `clientWidth` drops to 56 and the headshot
is inset and shrunk. A test asserting the outer rect passes either way and
proves nothing, which is what the first version of it did.

## The suggestions

`suggestions()` ranks by `(adp + jitter)` times need times risk times the
model's opinion, lowest first. The last of those four is new and is the only
one that answers to the scoring table.

**Everything else on the page rescores when the rules change; this did not.**
Setting receptions to five points moved every number printed on a suggestion
card and none of the order, because the order was ADP, need and risk and none
of the three has heard of a scoring rule. With the editor open the app was
computing a better answer than the one it was giving.

**It has to be `overallScore()`, not `marketGap()`.** `marketGap` compares a
player with his own position's market, so it can say "this receiver is
underrated among receivers" and can never say "receivers are worth more than
backs now" — which is the only thing five points a catch changes. It was
tried that way first and the list did not move, because the elite are WR1 and
RB1 on both measures under any rules. `overallScore()` is points above
replacement at his own position measured against the best such figure on the
board, so it compares *across* positions.

**It has to be measured against the best player still available, not
`BEST_VOR`.** `overallScore()` is a share of `BEST_VOR`, which is fixed for
the whole draft, so by the fifth round everyone left scores single figures and
a multiplier taken straight off it collapses to a 6% spread across the
candidate list — which reorders nothing. Against the best still on the board
the range holds at every stage. Both of these were measured before being
believed, and both first attempts looked reasonable and did nothing.

**The multiplier only ever pulls a player up, and it is capped at
`MODEL_CAP`.** A rated player buys a discount on his draft position, up to a
quarter of it; an unrated one stays exactly where the market put him. No
centre point to argue about, and a player with no projection scores `null` and
is left alone rather than pushed down for the want of one. The cap is there
because ADP is the one input that knows when a player will actually be gone,
and advice that forgets that is not advice.

**And it only applies when the scoring table has left the one ADP was drawn
from.** `scoringIsStock()` is the gate. FFC publishes one ADP set per format
and the pipeline picks the set by `league.scoring`, so on a standard, half or
full PPR table the market already saw these rules — discounting a player again
for a projection built from those same rules counts one fact twice. It was
unconditional at first and that is the bug this gate fixes; the measurement is
below.

**`cpuChoice()` deliberately never sees any of this.** The CPU teams are meant
to behave like a room drafting off a market, and in a shared room every client
has to reach the same answer for an empty chair.

On a stock table your suggestions and `cpuChoice()` now reach the same answer
again, and that is the gate above rather than a regression — measured over ten
pinned seeds they agree on every seat and every seed. They diverge exactly
where the scoring table does. The how-it-works page says this in those terms;
it has been rewritten twice now, once when the model arrived and once when the
gate did, and it must not be left describing the other one.

### Tried and rejected: pricing depth by `aboveReplacement`

`needMultiplier()` bands purely on how many of a position you hold, so it
cannot tell McBride from Juwan Johnson — and the grade says those two are the
difference between second in the room and eleventh. The obvious repair is to
ask *would he actually start for me* instead of *how many do I have*:

```js
if (have >= need + 2) return 1.45;                 // hoarding, whoever he is
return aboveReplacement(player) > 0 ? 1.00 : 1.45; // depth only if startable
```

It was built, and it was one-sided by construction — the count bands were left
alone, so nothing could be promoted and the CPU could not be made to reach.
Then it was measured across eleven pinned seeds, at the first and eleventh
seats of a twelve-team draft, my seat drafting each way:

**Starter strength never improved once.** It fell in nine of eleven and tied
in two. Finishing rank got worse more often than better — five places worse on
one seed. It did do exactly what it was built to do, cutting unstartable
bench bodies from five to four, and that bought nothing at all.

**Because replacement level is a yardstick for starters, and a bench pick is
not a starting decision.** Below replacement *today* is not worthless: a bench
spot is a lottery ticket on somebody being startable in November, and pricing
it by who could start in September throws that away. It also goes flat exactly
where it was meant to help — by the closing rounds almost everyone left is
below replacement, so the multiplier stops discriminating and only distorts
the middle rounds, where a third running back just under the line is a
perfectly good pick.

The same number being right in the grade and wrong here is not a
contradiction. The grade is scoring who *starts*. This is choosing who to
*hold*. **Do not reach for `aboveReplacement` again without re-reading this.**

**The unit changed underneath this and the conclusion did not.** It returned
ADP rank places when the experiment above was run and returns projected points
now (see "Starter strength was counting the wrong thing"), so the `> 0` test in
that snippet still means the same thing — startable today or not — and every
reason it failed is about *what question is being asked of a bench pick*, not
about how the answer is scaled. The measurement was not re-run and does not
need to be. If anyone does re-run it, the eleven pinned seeds are the bar.

**Whether it helps is a measurable question, so measure it.** Same seed, same
computer teams, your seat drafting each way, across pinned seeds. A suggestion
change that cannot show this is a change to the numbers, not to the advice.

**This section used to record that the model multiplier passed that test, and
re-run against today's board it fails it.** Ten pinned seeds, stock half-PPR:

```
with the multiplier:     mean finishing rank 9.30, starter strength 83.0
without it:              mean finishing rank 6.20, starter strength 87.3
```

Stronger starting lineup without it in **10 of 10**, and with it the advice
never once outranked `cpuChoice()` at the same seat — it finished last in the
room in five of eight unpinned runs. Whether that is drift in the data or an
error in the original measurement is not recoverable now, and the lesson is
the one this file keeps arriving at: **a measurement is true of the board it
was taken on.** Re-run it before trusting a number in here that decides
behaviour.

**At five points a reception the sign flips, which is what saved the feature
from being deleted.** The first fix was to remove the term outright, and it was
wrong for a reason worth keeping: measured only under the default league, which
is the one scenario the term was never for.

```
rec 0.5   with 82.0 / rank 9.33      without 87.0 / rank 5.50
rec 5     with 90.7 / rank 5.17      without 87.0 / rank 5.50
```

The "without" row is identical at both, because without it the advice does not
answer to the scoring table at all — the exact complaint at the top of this
section, reproduced. So the term is neither good nor bad in general. It is
right precisely when ADP is wrong, which is what `scoringIsStock()` tests.

**It looked like a tight end problem and it was not.** The advice held 2.3
tight ends to `cpuChoice()`'s 1.8, and `overallScore()` is points above
replacement at a player's own position — TE replacement is low, so a second and
third keep scoring well while `bestLineup()` can start one. The discount was
therefore gated on still having a startable slot at that position, twice:
strictly on `league.starters`, and again granting the FLEX to RB and WR only.
Both brought tight ends to 1.8 and **neither improved the roster at all**
(rank 9.40, starter strength 82.6). Fixing the symptom moved nothing, which is
what said the term was mispriced rather than misaimed. Do not re-derive this
gate from roster slots without re-reading that.

**`shotPicks()` applies the multiplier unconditionally and should keep doing
so.** It is what puts an elite quarterback and two tight ends in the hero shot
rather than the forty-name ADP slice that came out two colours. A picture is
not a roster and being wrong about who to draft costs it nothing — so a global
`MODEL_CAP = 0` is the wrong shape of fix and would regress the landing page.

**And the whole thing surfaced from a test nobody trusted.** `grade.spec.mjs`
asserts an advised roster out-totals a deliberately unbuilt one, and it had
been failing intermittently — which reads as flake, because the seed is random
per draft. It was not flake. It was this, firing about six times in ten.

## Latest news

Headlines on a player sheet, under "Our read", through the worker. The order
on screen is the order of the argument: ours first, because it is the thing no
feed has, then the wire.

**We link, we do not republish.** A headline, one clipped line, the source's
name and an outbound link. Reproducing the body is what a licence buys;
aggregating a headline and linking back is not that. **`source` is never
dropped** — an unattributed headline is the version of this we may not show,
so it falls back to the provider's own name rather than to an empty string.
This is the narrow exception to "don't republish news"; the Don't rule still
stands for article bodies, expert rankings and analyst commentary.

**The key lives in the worker.** Same rule as `GIPHY_KEY`, same route shape,
same `originAllowed()` refusal *before the key is read* — CORS tells a browser
whether it may read a response and does nothing about the request being made.
The two proxy functions are separate, so the origin check is a call each has
to remember; `test-sockets.mjs` asserts both rather than assuming one covers
the other.

**No key answers `configured: false`, not an empty list.** "Not wired up" and
"nothing today" are different facts and only one is worth investigating. The
panel draws nothing either way — no message, no spinner. A section nobody
asked to wait for is worse as a permanently empty box than as no box, which
is why this differs from the GIF picker, where a button was pressed and
silence would be a bug.

**It fails by disappearing** — the score strip's contract, and now the second
runtime dependency on somebody else's server. Never throws, never blocks a
render, never leaves a gap. The catch on the fetch is the contract rather than
politeness: a rejected promise here surfaces as an unhandled rejection on a
page that is otherwise fine.

**Escape every field, and check the link.** This is the third thing on the
page written by someone outside the project, after chat and the ESPN strip,
and it lands in `innerHTML`. `safeNewsUrl()` parses with `URL` and keeps only
http(s) — the same rule as the GIF host and for a worse reason: a
`javascript:` href is an outside party running script in the page. Verified by
putting `<img src=x onerror=…>` and a `javascript:` link through the real path
and checking no element is built and nothing runs.

**Which player an answer belongs to is checked when it lands, not when it was
asked for.** The sheet is one element reused for everybody, so a slow response
for a player the reader has closed renders into whoever is open now. Nothing
else in the app would catch it.

**And a test for that race is easy to write so that it cannot fail.** Holding
a single `release` variable is the obvious shape and is wrong: the second
`openSheet()` overwrites it, so resolving settles the *second* player's own
request, which is not a race and passes against an app with no guard at all.
Collect the pending resolvers and settle only the first. This was written the
wrong way first and the run that caught it looked like an app bug.

**It has a tab of its own, and the tab is hidden until headlines arrive.**
It began under "Our read" on the Overview tab, which put six cards between the
model's read and the meters that follow it. `renderNews()` reveals the tab and
hides it again on every open — the sheet is one element reused for everybody,
so a tab left showing from the last player opens onto *his* headlines under
this player's name, and the reader has to click before finding out. That is
worse than the panel equivalent, not better.

**The reset toggles by view name, not by index.** It was `i === 0`, which
stopped meaning "Overview" the moment a hidden tab sat second in the strip.

**The source is the link's hostname when the provider does not name one.**
Measured against the real feed rather than guessed: Tank01 returns a title, a
link and an image, and no source field at all — so the first version named
*them* on every card, which is wrong twice. They are the aggregator, not the
author, and "TANK01" tells a reader nothing about whether to trust the line.
The link is the honest answer, parsed with `URL` rather than a regex.

**A field with no value is empty; it does not borrow one.** `at` fell back to
`playerID`, so every card on a real sheet read "TANK01 · 4429795". Anything
that does not look like a date is dropped rather than printed.

**News is asked for by the provider's id, never by a name.** `x` on a stats
record holds this player's id at other sources, built nightly by
`link_source_ids()`. A name search at request time is how one Josh Allen ends
up wearing the other one's news — and every number on the sheet around it
would still be right, so nobody would catch it.

**No id means no news, and no fallback.** Not a name lookup, not league-wide
headlines dressed as his. Somebody else's news under a player's name is the
one outcome worse than an empty panel. The pipeline has already written him
into `unmatched.txt`, which is where that fact belongs.

**The crosswalk prefers an identifier both sides already agree on.** Tank01
carries `sleeperBotID` on its MLB rosters and very likely on its NFL ones; when
it is there the join is a dictionary lookup with nothing to get wrong. The
name/position/team fallback exists for when it is not, and it **reuses
`index_sleeper()` and `normalise()`** rather than reimplementing them — a
second normaliser that drifted from the first is the same class of bug as a
league shape written down twice. The run prints which route each link came
from, and says so loudly if every one came from a name.

**Two of theirs claiming one of ours stores neither.** Picking one is a coin
flip that serves the wrong player's news, so a collision is reported and both
are dropped.

**One call, not thirty-two.** `getNFLPlayerList` is the whole league; per-team
rosters would be 32 × 30 = 960 calls a month against a 1,000 free tier and
would spend the entire allowance on the crosswalk that exists to serve the
news.

**Count what survived, not what was attempted.** The first version tallied as
it went, so a collision printed "linked 0 … (1 on sleeperBotID)" and a
duplicated row counted twice. A count that disagrees with the data it
describes is how you stop believing the run output — which is the only thing
standing between a quiet bad join and a user finding it.

**The nightly workflow needs the key too, and forgetting it fails silently.**
`update-players.yml` regenerates `stats.js` from scratch every morning, so a
run without `TANK01_KEY` does not fail — it quietly drops every `x` id a keyed
run had written, and player news stops working overnight with nothing in the
log that looks like a fault. The secret is set once under Settings → Secrets
and variables → Actions; the workflow passes it in `env:` on the rebuild step.
**A manual local run does not bump `?v=`.** Only the workflow does that, so a
rebuild you run by hand and commit yourself is new data behind a cached
address — which is the same "a rebuild nobody sees" failure, reached from the
other direction.

**The route caches, and that is what makes it affordable.** Without it the
provider is called once per sheet opened, and a draft is the same dozen
players opened over and over. The free tier is a thousand calls a month, so
sweeping the board once — 201 players with an id — is a fifth of the allowance
in a sitting. Measured: 50 requests across 5 players cost **5 upstream calls**
rather than 50. Fifteen minutes, in `NEWS_TTL`.

**The cache key is built, not taken from the request.** `caches.default` keys
on the whole URL, so the real request — which carries an Origin and could
carry anything a client appends — would produce one entry per way of asking
rather than one per player. `newsCacheKey()` canonicalises it.

**A cached entry carries no CORS headers, and the response is rebuilt.** Which
origin may read a response is a per-request decision, and serving one caller's
`access-control-allow-origin` to another turns it into a shared one. The body
is the only thing worth keeping; the headers are put back per request, and the
origin refusal still happens before the cache is ever consulted.

**An error is never cached, and an empty answer is.** "He has no news today"
is a fact worth keeping, and re-asking for it would spend the allowance on
exactly the players who have nothing. Caching a failure would pin an upstream
blip for the whole TTL and turn a moment's outage into a quarter hour of
silence — the same line `configured` already draws between "not wired up" and
"nothing today". Tested by taking the provider down, asking for a new player,
bringing it back and checking the next ask is a miss that returns real items.

**`TANK01_BASE` points the worker at a stub.** The provider cannot be reached
from a test and a key cannot live in the repo, so the whole path — worker,
normalisation, escaping, rendering — is driven against a local server serving
a canned, deliberately hostile payload. Everything above was measured that
way, not reasoned about.

## Conventions

- `app.js` is organised in numbered sections. Keep new code in the right one.
- `render()` rebuilds every panel from scratch on any change. There are no
  partial updates. This is fine at this size and keeps state bugs away.
- Click handling is delegated from `document`, because the DOM is constantly
  rebuilt. Don't attach listeners to elements inside a render function.
- Comments explain *why*, not *what*. The owner reads this code to learn.
- **Two themes, one set of names.** `:root` holds the dark values and is
  therefore the default; `:root[data-theme="light"]` overrides them. A new
  rule may only name a colour that is the same under both themes — brand
  navy, a position solid, or white on top of one of those. Anything else
  has to become a token in both blocks, or it will be invisible in one of
  them. Blue is two tokens for this reason: `--blue` always sits under
  white text, `--link` is blue *as* text on a surface.

  Teal cannot take the same fix, which is worth knowing before reaching for
  it again. `--teal` (#00E5FF) is only 1.54:1 against white — even further
  off than orange, the colour it replaced on 20 August 2026, ever was — and
  darkening it the way `--orange-cta` darkened orange has no good stop:
  white needs L≈28% (measured #00808F, 4.68:1) on a hue that starts at
  L=50%, which reads as a different, muddier colour rather than the same
  one under white text. `--teal-cta` is `--teal` itself, unchanged, and the
  text on it is dark (`--teal-cta-ink`, #0B0E14) instead — the fix
  `web/src/components/DraftLocker.jsx` and a dozen other React components
  already use for the identical value under Tailwind's `teal-500`.
- **A border-bottom is inside the box, so symmetric padding is not symmetric
  space.** `.sheet-tabs` had an even `9px 12px` and the selected pill measured
  9px of clearance above it and 10 below, because the 1px border sits within
  the element. Small enough to be invisible as a number and quite visible as a
  lopsided chip — it was spotted by eye before it was measured. The padding is
  `9px 12px 8px` now, so 8 + the border is the 9 the top already had.
- **Two scales and two faces, and no rule below them may write a raw px or
  name a typeface.** Eight type steps — 10, 12, 14, 16, 19, 23, 32, 42 — five
  radii — 4, 8, 12, 16, pill — and `--font-display` / `--font-body`. They live
  in their own `:root` block above the colours, because they do not move
  between themes and should not be read as if they might.

  The faces joined them for the third instance of the same lesson: they were
  written out as literals 43 times, and the proof it mattered is that three of
  those were in page-local `<style>` blocks — two in a 404 page written an hour
  earlier — which a find-and-replace across `style.css` would have left behind,
  in the one place nobody looks. **A comment naming a face is the same drift as
  a rule naming one**, so the wordmark's note was rewritten with them.

  They replaced 26 font sizes and 15 radii: every half step from 8.5px to
  16px and every integer from 2 to 12, each chosen per element by eye. The
  draft room rendered eleven sizes at once, nine of them between 8.5 and 13.
  **Every individual choice was defensible and the set was not** — nothing
  shared a size, so nothing read as belonging to the same family, and that
  is a thing a visitor feels without being able to name.

  Radii divide by the job, not by taste: an inline mark, a control, a card,
  an overlay. `50%` stays where a circle is genuinely wanted.

  The check is one line in the console, and it should come back 8 and 5:
  the count of distinct `fontSize` and `borderRadius` across everything
  rendered. Anything off the scale is a rule that forgot, and an icon-only
  button with no `font-size` at all counts — Chrome gives it 13.333px, so
  `.theme-toggle`, `.to-top` and `.home` each carry one that changes
  nothing on screen and keeps that audit honest.
- **One primary action colour, and it is `--teal-cta`.** It was
  `--orange-cta` from the rebrand until 20 August 2026, when the owner
  retired orange from the palette entirely; see "The rebrand" for the case
  that was made for orange at the time, and the postscript on it below.
  Teal means act; blue means state — focus rings, the selected tab, the
  header when the clock is yours. **This is why the accent may not also be
  a surface** — an orange hero band was built and it swallowed the CTA
  whole, back when orange held this job, and the lesson transferred intact:
  see "Tried and rejected: orange as a surface"; the 4px rule across the
  top of both headers is the whole of what the accent gets outside a
  control.

  The act/state split itself was hard won, under the original colour. `.cta`
  was orange and `.primary` blue for a long time, which meant the same
  control was two colours depending on the screen: "Resume" on a saved draft
  was orange on the landing page and blue three lines into the draft view,
  from the same two words in the same codebase.

  **`.draft-btn` is blue on purpose and is not an oversight.** The rule is
  about *the primary action* — the one thing a screen is asking for — and
  that is a row control repeated on every player in a 200-row table. Two
  hundred teal buttons is wallpaper, and it would outshout the actual
  primary on the same screen, which is the point of having one. The split
  is by rank, not by whether a control does something.
- **The setup screen leads with the two settings people change and folds
  the rest away.** It asked 68 questions before it would let anybody draft
  — fourteen selects and forty-four scoring inputs — with the Start button
  under all of it. Six controls are visible now; nothing was removed.

  Three `.setupbox` disclosures — League, Scoring, Draft with friends —
  each carrying a summary of what is inside, so shut is still informative.
  That summary comes from `league` through `leagueSummary()` and
  `scoringLabel()`, never from a second copy of the same lookup.

  **Anything that can refuse the Start button has to say so outside the box
  that caused it.** Every check in `setupProblem()` lives inside League, so
  `refreshSetup()` writes the reason to `#setupProblemMsg` beside the button
  *and* forces the box open. A disabled button whose explanation is folded
  away is worse than the wall of controls this replaced. It opens and never
  closes itself: shutting the box the moment the arithmetic came right would
  take the screen away mid-edit.

  **This describes the markup, not what a solo drafter sees any more.**
  `web/src/components/DraftSettings.jsx` replaced it — league size, scoring,
  pick clock and draft position only, real roster construction left at
  whatever it already is — mounted into `#setup-root` beside the original,
  which stays in the DOM `display:none !important` for the same reason
  `#shellbar` does: unguarded listeners on `#randomizeBtn`/`#startBtn`/the
  `LOCKABLE` ids throw on a missing element and take app.js's boot sequence
  down with them. Everything this section describes — `setupProblem()`,
  `leagueSummary()`, the League/Scoring/Draft-with-friends disclosures — is
  still real and still runs, just unreachable by a mouse. "Draft with
  friends" has no React equivalent yet and is reachable from neither screen;
  redesigning it is scoped into the mock-draft-room pass, not this one.
  `window.JukeEngine` grew `setLeague`, `setupProblem`, `teamCounts`,
  `scoringNames`, `startDraft`, `resumeDraft` and `clearSave` for this —
  `startDraft()` is the Start button's own sequence with `readSetup()`'s DOM
  read removed, since React already calls `setLeague()` directly.
- **The hero product shot is generated, not an image.** `renderHeroShot()`
  draws the opening rounds of a real board from the same `board` array, the
  same valuation and the same position solids the draft uses. A PNG would be
  a file to rebuild every time the design or the nightly data moved, and it
  would be wrong the first time somebody forgot. This one has nothing in it
  to keep in sync.

  **It drafts rather than slices, because ADP is an average and no single
  draft looks like an average.** It used to be `board[i]` — the first forty
  names in ADP order — and that is a real board that no room has ever
  produced. A position that goes early in half the rooms and late in the
  other half averages to the middle, where it loses to the backs and
  receivers that go at the same spot in every room; so the top forty by ADP
  is 18 RB, 21 WR, 1 QB and **no tight end at all**, and the graphic was two
  colours. The elite quarterback goes in the third round of a real ten-team
  draft and the two tight ends worth having go in the fourth, which is a
  thing anybody who has drafted knows on sight — and the reason the picture
  read as synthetic without anybody being able to say why.

  `shotPicks()` runs fifty picks in snake order, each seat valuing the board
  the way `suggestions()` does: ADP, need, injury risk and the model. Two of
  those move the scarce positions, for different reasons. **The model prices
  them** — `overallScore()` is points above replacement measured *across*
  positions, so it can say an elite tight end beats the twenty-fifth
  receiver, which is what an ADP average smooths away and what the product
  claims to know. **Need is what makes a seat stop taking backs** — a fourth
  running back is past the starting requirement and loses the 0.80, so the QB
  and TE still on it finally win a pick, which is why a real fifth round has
  quarterbacks in it and an ADP slice never does. `MODEL_CAP` keeps the first
  of those to a quarter of a player's price, so it stays a nudge off the
  market: the quarterback moves 30 → 23, the tight ends out of round five into
  round four, and the first two rounds barely move.

  **Five rounds, not four, and the fade is why.** The mask starts dissolving
  at 46%, so at four rounds the fourth row is the one being eaten — and the
  fourth row is where the tight ends land. The only two cells on the board
  that are not a back or a receiver arrived as ghosts. A fifth round costs
  37px, moves nothing above it, and gives the fade a row of its own.

  Nothing in it is a name: whoever tonight's data says is QB1 and TE1 is who
  turns up.

  It is the one place in the app where something overflows and can neither
  scroll nor ellipsise — the phone crop, where ten columns wide enough for a
  surname cannot fit and 31px columns would not be a picture of anything.
  That is deliberate and it is the *only* exception: the clipped part is
  decoration with a duplicate one click away, not content with no way to
  reach it. Anything else that trips that check is still a bug.

  **A card here is a name and a club, and that is an editorial decision
  rather than a rule.** The shot is an *excerpt* of the board — five rounds of
  fourteen, ten teams fixed, no faces — so what it leaves out gets decided per
  item, not settled once by "match the product".

  The faces are out on cost: fifty headshots is fifty requests to somebody
  else's server on the first paint of the marketing page, for decoration the
  mask starts dissolving at 46%. The landing page loads no third-party image
  at all, and a test asserts that.

  **The arrow and the pick number were carried over from the board and did not
  survive being looked at.** They shipped for one commit and the owner's first
  reaction to the rendered page was that it looked jumbled, which was right.

  **The pick numbers zigzag.** Row one runs `1.01 → 1.10` left to right and row
  two runs `2.10 → 2.01` back the other way — correct, and on the working board
  it is something a drafter actively tracks. On a graphic somebody glances at,
  it is fifty four-character numbers alternating direction with no pattern for
  the eye to hold.

  **And there was no way to demote them.** The usual repair for two elements
  competing is to make one smaller or dimmer. Both are shut here: `--fs-2xs` is
  the bottom of the type scale, and dimming is precisely the opacity bug that
  had to be removed from this file and the board's. So the pick number would
  have competed with the player's name at equal weight for ever, in a 103×54px
  box whose whole job is the name.

  **`shortName()` stays**, which is the half of that change that worked:
  "J. Gibbs" reads as a person where "Gibbs" read as a row in a table.

  **The lesson is about the frame, not the elements.** "It draws the board
  card" was written as though matching the product were the goal, and it is
  not — the shot has about two seconds to say *this is a real draft board,
  colour-coded, with real players*. Every true fact added to a cell with room
  in it costs some of that. A test now asserts exactly two elements per card,
  because the pull is always towards adding one more.

  **The phone floor is 70px, and the initial is why.** At 58px, with a surname
  alone, 38 of the 50 names fitted. The card carries "G. Pickens" now, about
  14px more, and at 58px that collapses to **11 of 50** — a board of "G. Pic…"
  and "A. Bro…", which is not truncation but a different graphic. 70px gives 40
  of 50 and still shows 4.8 of the ten columns. It stayed at 70 when the foot
  came off, because the foot never decided it: it wanted 41px at its widest and
  the names want more.

  **The shot is ten teams whatever the visitor has set, and the test for that
  has to call the function.** `renderHeroShot()` runs once at startup, when
  `league.teams` is still the default ten, so a version reading `league.teams`
  draws an identical shot and no page-level check can separate them. It is a
  latent bug rather than a live one. **A mutation that passes is not a test** —
  the first version of this one did, and its comment claimed otherwise.

  **A flex column compresses rather than overflows, so clipping does not
  report as clipping.** The row height was set to 48px against a card wanting
  54, and the `POS · TEAM` line was cut in half on every cell — with
  `scrollHeight === clientHeight`, so an overflow sweep saw nothing at all.
  Measure a free-standing clone of the card against the row instead, which is
  what the test does.
- **The centred wordmark needs a breakpoint.** `.shell-inner` is
  `1fr auto 1fr`, so each side gets the same width. Below about 540px the
  sides need ~191px of links and get ~110px, and because the links are
  `nowrap` they do not shrink — they spill straight over the wordmark. Under
  700px the header keeps only the burger, the brand and Sign up; How it works,
  Log in, Install and the theme toggle move into the rooms panel.
- **A padding that stands in for a fixed header's height has to be as
  responsive as the header is.** `Header.jsx` is two rows at lg+ (h-16 nav
  plus the h-9 ticker, 101px) and one row below it (h-14, ticker
  `hidden lg:block`, 57px) — and two separate values were written for the
  desktop number alone: `<main>`'s `pt-[108px]` in `Homepage.jsx` and
  `scroll-padding-top: 108px` in `index.css`. So a phone got 51px of padding
  over nothing, which stacked on Hero's own top padding and put the mobile
  handoff's eyebrow at 206px where artboard 1a puts it at 92 — a screenful of
  empty page above the hero — while every anchor click landed half a screen
  short of the section it named.

  **It cannot be caught by looking at either number.** Both were correct for
  the header they were written against, nothing overflowed, nothing threw,
  and the page reads as designed-with-a-lot-of-air rather than as broken.
  What finds it is measuring the gap between the header's own bottom edge and
  the first thing under it, which is what `phone.spec.mjs` now asserts — the
  relationship, never an absolute offset, or the test has to be rewritten
  every time the header's height moves.

- **The rooms panel is inside `#shellbar`.** Scope mobile hide rules to
  `.shell-inner`, not the header, or they hide the panel's copies too.
- **A `<select>` draws its arrow inside the padding, so padding cannot buy
  room for the text.** Three dropdowns across a `.field-row` is comfortable
  while the options are `QB 1` and `RB 2`. The league row's options are words,
  and at 375px each select gets 96px: `14 rounds` wants 67px of it and the
  arrow wants about 16 more, so the text finishes hard against the arrow.
  Widening `padding-right` looks like the fix and does nothing — the arrow
  moves with it. The row needs *width*, so `.field-row.wordy` wraps to two
  lines under 480px. 481px still fits three across with 25px to spare, which
  is where that number came from. The class says `wordy` rather than
  `league-row` because the shape of the options is the reason, not the row.
- **Nothing caches `.theme-toggle`.** There are up to three of them and one is
  rendered, so clicks are delegated and `syncThemeButton()` re-queries.

- **One header, two sets of content.** `.shellbar` and `.appbar` share a
  surface, a border and a 1120px centred column, so the Draft Room and the
  landing page read as the same site. Only `.my-turn` and `.urgent` take
  colour, and they carry their own reversed mark and white text. A CPU being
  on the clock is the resting state and must look like the homepage.

- **The navy band starts below the header, and that is the rule above
  holding.** The landing page was two tones ten points apart — `--page`
  under `--card` — across a thousand square pixels, with the one saturated
  thing on it being the CTA at 0.8% of the area. `.hero-band` is the second
  surface, and it is brand navy specifically because `--navy-deep`, `--navy`
  and `--navy-glow` are byte-identical in both blocks. **That is what lets
  everything inside it name white and the `--band-*` values directly**, the
  same licence `.appbar.my-turn` already uses.

  Making the header navy too would read better and would mean making
  `.appbar` navy with it, which is a change to the draft room rather than to
  the landing page. The seam is handled with an inset shadow instead, so the
  header casts onto the band rather than mismatching against it.

  Full bleed by nesting — `.hero-band` > `.band-inner`, with the 1120px
  column moved out of `.landing` — **never by `100vw`**, which counts the
  scrollbar and starts overflowing sideways on whichever machine shows one.

  Its bottom fade is the one value in that block that moves between themes,
  and it has to: the band's job at that edge is to arrive at whatever page
  it is sitting on. **Anything laid over that fade needs clearance**, which
  is what `.hero-band .hero`'s bottom padding is for — `--band-ink-mid` over
  a light-theme fade loses its contrast on the way down. The product shot is
  the exception and fades itself, on purpose, with its own mask.

- **Two views, one hash route.** `#/` is the landing page, `#/draft-room` is
  the Draft Room. `applyRoute()` is the only thing that decides what is
  visible; `render()` must never fight it.

  **`#/draft` is retired, and it was a whole second product.** It was the
  Draft Room, and every feature built since the React rewrite — the new
  settings screen, the Locker, Draft Fit, the Insights dashboard, the
  horizontal desktop layout — exists only on `#/draft-room`. The old route
  went on rendering `#view-app` perfectly happily, which is what made it
  dangerous: somebody landing there saw a working draft room, just last
  month's one, with nothing on screen to say so. It was still reachable from
  a bookmark, a shared link, and — the live path — the homepage's own resume
  banner, which pointed at it until this change. Reported as "my friend is
  still seeing the old draft room", which is exactly what was happening.

  `applyRoute()` redirects it now. **The redirect lives at the router, not
  at the callers**, because the callers were never the whole problem: a link
  somebody saved last week is, and no edit to `app.js` reaches that. It uses
  `location.replace()` so the dead route cannot become a back-button trap
  bouncing between the two rooms.

  **And it has to carry the hash's own query.** An invite is
  `#/draft?room=ABC1`, and `route()` strips the query to decide the path — so
  a redirect to a bare `#/draft-room` silently drops the room code and lands
  a guest on an empty setup screen instead of in the draft they were invited
  to. Every invite sent before the change is that shape, which is most of the
  reason the redirect exists at all. `tests/room.spec.mjs` keeps one guest
  join on the **old** link shape on purpose, as the regression test for it;
  the comment there says not to modernise it.

  **`#view-app` is unreachable, not deleted.** `app.js` is a classic script
  and `renderHeader()`, `renderInvite()` and a dozen listeners still write
  into those ids on every render — deleting the markup throws and takes the
  whole boot sequence with it, drafting included. Same rule as `#shellbar`
  and the legacy `.setup`. Unreachable is the goal; absent is a different and
  much larger change.

  Hash routing was originally forced: GitHub Pages has no rewrite to send a
  real `/draft` path back to `index.html`. **That constraint is gone** — a
  `_redirects` file on Cloudflare Pages does exactly that rewrite. What holds
  it in place now is the second reason, which was always the better one: the
  hash keeps the back button working for somebody mid-draft, and every saved
  link, every invite and the installed app's `start_url` are written the way
  they are today. Moving to real paths is a feature with a migration, not a
  tidy-up, and it should be done deliberately or not at all.
- **Leaving the draft is not discarding it.** Navigating home stops the CPU
  timer and the clock and leaves everything else alone, so nothing advances
  off-screen. Returning hands the clock back or restarts the room. Only
  "Discard draft" clears the save.
- **The rooms are written down once,** in `ROOMS` in `app.js`, and rendered
  into both the header panel and the landing page. Adding a room is one entry.

  **On the landing page they turn through a door.** It was a grid of six cards
  with five greyed out, which is the worst available framing of a roadmap: it
  reads as five things that are missing. A door you have not opened yet is the
  same fact told properly, and the placard promises nothing the data does not
  say — `live` and `season` come straight from `ROOMS`, so it cannot overclaim.

  Drawn in CSS, no image, for the reason written beside the product shot: a
  picture is a file to rebuild every time the palette moves, and it is wrong the
  first time somebody forgets.

  **Three things about it that are invisible when they break.**

  **`overflow` on any ancestor between `.doorway` and `.door` flattens the 3D.**
  Any value but `visible` establishes a flattening context that
  `transform-style: preserve-3d` cannot cross, so the transform still applies
  and the door squashes instead of swinging. The interior clips; the frame must
  not. A width check alone does not catch this — the panel narrows either way.
  What separates them is **height**: under perspective a door swung towards the
  reader draws *taller* than at rest, and flattened it does not move at all.

  **`margin: 0 auto` on the doorway collapses it to nothing.** An auto margin on
  a grid item defeats the default `stretch` and makes the item shrink-wrap its
  content — and every child of `.doorway` is absolutely positioned, so its
  intrinsic width is zero. At phone width the whole thing vanished while still
  computing a perfectly healthy `max-width: 320px`. `justify-self` instead, and
  test the measured box rather than the style.

  **The door opens *towards* the reader, and that is deliberate.** Away is what
  it really does seen from inside the room, and at that angle it is edge-on,
  unlit and invisible — correct physics, no picture. Towards costs about 47% of
  the frame, which is why the interior text starts at half and the frame is
  wider than it looks like it needs to be. Anything written under the swing is
  hidden by the thing that is supposed to be revealing it.

  **A colour inside the room is a literal, not a token.** `--band-ink` is
  declared on `.hero-band`, not on `:root`, so naming it out here resolved to
  nothing — the property fell back to inherit and the room's name picked up the
  page's dark ink and disappeared against a dark interior in the light theme.
  The room carries its own ground in both themes, which is exactly the case
  where white may be named directly.
- **A room is a name and takes a capital. So does the landing section: "The
  Rooms". Everywhere else in a sentence, "rooms" is a common noun and stays
  lowercase.**

  So: "The Draft Room", "The Waiver Room", and the heading "The Rooms" — but
  "all six rooms", "shared rooms", "as rooms arrive".

  The grammar on its own would keep the heading lowercase, the way "the cars"
  sits under "the Ford Mustang", and it did until the owner decided otherwise.
  That is a brand call rather than a correction: it makes the set of rooms a
  named surface of the product instead of a description of what is below the
  fold. Juke is still the brand above it, which is why the individual rooms
  keep their own names underneath and nothing else in the prose changes.

  The header button reading "Rooms" is not evidence either way. It is the
  first word of a nav label, which is capitalised whatever the word is doing —
  "How it works" sits beside it in sentence case for the same reason.

  There is exactly one heading, in `index.html`, and after this change every
  *visible* use of the word on the landing page is capitalised: the nav
  button, the heading, and the six room names. The lowercase uses are all in
  comments and in this file — real prose about the project rather than copy
  anybody reads on the page. So a sentence that needs the common noun still
  gets a small r; there simply is not one on screen today.
- **A position is one hue at three lightnesses, and which one depends on
  what sits on top of it.** `POS_MATTE` is the flat fill and takes dark ink
  only; `POS_SOLID` is the same hue darkened until WHITE clears it;
  `POS_BADGE` is the tint, as literal Tailwind classes naming the same hexes.
  Reaching for the wrong one does not throw — it draws a mark nobody can see,
  which is how a deep gold bar ended up invisible on a dark panel and gold
  ended up at 1.06 on a light cell. See "The matte position palette".
- **Check a new class name against the existing sheet before using it.**
  The landing section was first called `.home`, which is already the header's
  home button; it inherited `display:flex` and collapsed to zero width. The
  chat avatar was first called `.avatar`, which is the player photo and is
  hidden outright inside the rail.

- **And a bare element selector in `style.css` reaches into React, where no
  class name collides at all.** `style.css:1323` is
  `table { background: var(--card) }`, and that sheet is a plain `<link>` on
  the same document `#draftroom-root` mounts into — so every `<table>` in
  `web/src` inherited it, and `--card` is white under
  `:root[data-theme="light"]` while the cells stayed `text-white/70`.
  **Measured at 1.0:1, white on white, on four tabs** — Analysis, Game Logs,
  Projections and Usage — reachable through the app's own theme control.

  Tailwind's classes are fixed hex and the legacy tokens are theme-swapped
  variables, so the two systems disagree only in the theme nobody building the
  React room is looking at. The `thead` survived because it carries its own
  `bg-slate-sunk/60`, which is what made it read as a table with its data
  missing rather than as an obviously broken panel.

  Fixed by giving each table an explicit `bg-slate-panel`, **not** by scoping
  the legacy rule: `404.html` and the three `docs/` pages are styled by that
  same sheet, so narrowing the selector to fix React risks the pages nobody
  visits on purpose. An explicit surface is also what stops the next bare
  element selector reaching in. **A React component is not isolated from
  `style.css` — grep it for the tag before trusting a Tailwind background**,
  and check the theme you are not developing in.

- **The same goes for function names, and it fails more quietly.** `app.js`
  is one scope, so a second `function initials()` does not shadow the first —
  it replaces it, whichever is declared last, with no warning anywhere. The
  chat's version was silently calling the player one, which happened to
  return something plausible for a real name and threw on an empty seat.
  `grep -n "function <name>"` before adding one.

- **The logo is navy-on-light, and the header is navy.** The mark is inlined
  rather than an `<img>` so the navy half can be reversed to white on the
  header (`.mark-body`) while the swoosh keeps its accent colour
  (`.mark-accent`, teal since 20 August 2026, orange before it). It is
  662 × 774, not square — sizing it as a square squashes it.

## Hard-won rules — do not undo these

**A pick number is not a seat number, and for half the board they are the
same.** `pickCode()` returned the seat, so every even round came out mirrored:
in a ten-team league the first pick of round two was labelled `2.10` and the
last was labelled `2.01`. Odd rounds were correct, which is why it lasted as
long as the app has existed — at any moment half the board agreed with it.

The mirror lives in `DraftEngine.pickInRound()` now and nowhere else, because
the board was computing its own copy of it inline. Anything holding a round
and a seat and wanting a label asks the engine.

**The tell was two correct numbers side by side disagreeing.** The header
prints `Pick 2.10 (11 Overall)`, and 11 overall in a ten-team league can only
be the first pick of round two. Nothing about the arithmetic was wrong —
`pickInfo()` had the seat right the whole time — only what the result was
called. That is the same failure as the standings printing starter strength
under a column of totals, and it is found the same way: read what the screen
says and check it against what the app computed.

**Uniqueness is the obvious test and it does not catch this.** Reading the
seat still hands out every code in a round exactly once, because each overall
number in a round has its own seat — the set is right and only the assignment
is backwards. What catches it is that a pick code must be derivable from the
overall number and the league size alone, with no reference to the snake at
all. Test that property, not the count.

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

**`gp` on a projection is not a games count for every position.** Sleeper
forecasts a team defense as one aggregate row stamped `gp: 1`, where every
other position carries the real projected week count. Dividing by it made
every DST's per-game figure identical to its season total — Pittsburgh read
93 points and 93.0 per game. Per-game figures go through `perGame(points,
games)`, which takes the denominator explicitly and prints a dash rather
than dividing by a fallback, and DST rows get theirs from `projGames()`.
Kickers were never affected: they carry the same `gp` as skill players.

**Sleeper's projections are coarser than its actuals, and the pipeline has to
reconcile that.** Season and weekly lines carry `fgm_50_59` and `fgm_60p`;
projections carry only the combined `fgm_50p`, and express misses solely as
`fgmiss_50p`. Reading the fine-grained keys alone silently drops every
projected 50-yard field goal — 183 of them — and makes kickers look far worse
than they are. `reconcile()` folds the coarse keys in. Check any new stat
across all three feeds before trusting it.

**A `window.JukeEngine` entry is only as safe as its own guard, not its
caller's.** Every bare `DraftEngine` reference in `app.js` was already
guarded — `typeof DraftEngine === "undefined" ? fallback : DraftEngine.x(…)`
— except two: `nextPicksFor()` and `inProgressSummary()`. Both were safe for
as long as they had only ever been called in response to a click (Resume,
Start), by which point the deferred boot (`draft-engine.js`/`players.js`/
`stats.js`, loaded via `requestIdleCallback`, not a blocking `<script>`) had
always finished. `DraftLocker.jsx` broke that assumption: it calls
`engine.inProgressSummary()` on mount, gated only on `window.JukeEngine`
existing — true almost immediately, since `app.js` is a blocking classic
script — never on `dataReady()`, which is the actual promise that
`draft-engine.js` has landed. A cold, direct load of `#/draft-room` with a
save already on disk hit this reliably: `ReferenceError: DraftEngine is not
defined`, before any interaction. Navigating there by hash-change from an
already-open homepage never showed it, because by then the deferred files
had had time to land — which is what made it look like a routing bug before
it looked like a timing one. Fixed the same way the rest of the file already
was: the guard belongs on the function itself, not on each caller, because
nothing about `window.JukeEngine` existing implies the deferred data does.
Any new entry added to the bridge that touches `DraftEngine`, `PLAYERS` or
`STAT_KEYS` needs the same guard rather than trusting a React call site to
check `dataReady()` first — `ScoringDemoCard.jsx` and `TakeAPick.jsx` do
check it, and were fine; the bug was in the two bridge functions that had no
guard of their own to fall back on.

**Bump `?v=` in `index.html` on every deploy that changes a file it loads.**
Everything the page asks for is cached, so without a version in the address a
returning visitor runs today's HTML against Tuesday's JavaScript. That does
not fail as a blank page. It fails as a page that half works: the shared room
shipped with `renderChat` in the new `app.js` and the chat panel hidden in
the markup, so anyone who had visited before got a room with no chat window
at all and nothing in the console to say why. One number, changed in
`index.html` and `docs/draft-room-how-it-works.html`, in every `?v=` on the
page. A query string rather than renamed files, because renaming needs a
manifest and a manifest is a build step. The daily workflow bumps it too,
when it commits new player data — a nightly rebuild behind a cache is a
rebuild nobody sees.

**Which makes the daily bump a merge conflict with every branch that also
bumped it.** The nightly rewrites `?v=` in those same two files at 11:00 UTC,
and they are the two files any change to an asset has to touch. So a pull
request does not have to be stale to collide — it only has to exist at 11:00.
The design pass was open for **one hour** and came back `CONFLICTING`, four
hunks in `index.html` and three in the how-it-works page, every one of them a
version string and nothing else.

The resolution is the branch's stamp, being the newer of the two, but **prove
that before taking it rather than after**:

```bash
BASE=$(git merge-base <branch> origin/main)
git diff $BASE origin/main -- index.html docs/draft-room-how-it-works.html
```

If the only thing main changed in those files is `?v=`, taking the branch
whole loses nothing. Merge main *into* the branch and the branch is then
`--ours` — worth saying out loud, because merging the other way round makes
`--ours` main and throws away the edit you are trying to land.

If main changed anything else in them, the two have to be reconciled by hand
and taking either side blind silently drops one of them. The check is two
seconds and it is the difference between a resolution and a guess.

Merging the same day is the actual fix. A pull request here decays on a
schedule.

**And a clone that has been fetching is not a clone that has pulled.** GitHub
Desktop fetches roughly hourly, so `origin/main` sits perfectly current while
the working copy is days behind and every file on disk is stale. Twelve
commits and two days of it read exactly like changes that never merged.
`git status` says `[behind 12]` when that is what has happened, and
`git log --oneline main..origin/main` says what is missing. Check that before
concluding anything is stuck.

**The site deploys itself and the worker does not, and that gap is invisible.**
Cloudflare Pages builds from git on every push, so a merge is a deploy. The
worker is not in that build: it ships only when somebody runs
`wrangler deploy -c worker/wrangler.toml`. The D1 cache was merged, correct,
and doing nothing at all because of it — the route answered normally, the edge
cache even reported `miss` then `hit`, and the only thing that gave it away was
querying the database and finding zero rows after a miss that should have
written some. **Ask the database, not the response**: a worker change that is
merged but not deployed looks exactly like one that is working.

**Nothing in the *output directory* is unpublished.** Pages serves that
directory as it finds it and has no ignore list, so anything in it is live on
the domain whether or not a page links to it. A 1.4MB piece of logo artwork sat
at `jukeff.com/image_71380e33.png` for six days, referenced by nothing,
returning 200 to anybody who asked. A `brand/` directory would have been just
as public and harder to notice. Assets that are not the site belong somewhere
that is not the site.

**The repository root stopped being that directory, and the reverse of this
rule bit before anybody noticed the rule had changed.** Once the dashboard
moved to **Root directory: `web`, Output: `dist`**, the only things served are
what Vite emits, what `web/public/` holds, and what
`copy-legacy-assets.mjs` copies. `og-image.png` and the three root favicons are
in none of those lists, so `og:image` — the absolute
`https://jukeff.com/og-image.png` baked into every link preview — has been a
404 at the origin ever since, along with every favicon `404.html` and the three
`docs/` pages name.

**And it did not look like a 404, which is the part worth keeping.** Asking for
`https://jukeff.com/og-image.png` returned **200** — from a Cloudflare edge
entry left over from the GitHub Pages era, still being served long after the
origin behind it stopped existing. The giveaway was a byte count: 53,637 served
against 53,569 in `HEAD`, so the thing answering was not even this
repository's copy. `favicon.ico` did the same; `favicon-16.png` and
`favicon-32.png` had simply been evicted and 404'd honestly, which is why the
set looked half-broken rather than uniformly wrong.

**So the check is `?cb=`, and it is the same throwaway query the deploy note
above already prescribes** — `/og-image.png?cb=1` misses the cache entry,
reaches the origin, and returns the plain 404 the bare URL was hiding. This is
the third distinct shape of the caching trap in this file: stale HTML against
fresh assets under GitHub Pages, fresh HTML against a deleted content-hashed
bundle under Cloudflare, and now an edge entry outliving its origin entirely.
All three are the same instruction. **Ask with a query string before believing
a file is deployed.**

**Anything a page names with a leading `/` therefore has to be under
`web/public/` or in `LEGACY_FILES`.** There is no third place. The root copies
of `og-image.png` and the favicons are kept because that is where git has
always held them and where `scripts/build_og.html` and
`scripts/build_favicon_ico.py` write — but they reach nobody on their own, and
a change made only there is a change nobody sees.

**A redirect rule can be named for the opposite of what it does.** `jukeff.com`
spent a day in an infinite loop — every path, 301 to itself — behind a rule
called "Redirect Root to WWW" whose target was `https://jukeff.com`. The `www.`
was never typed. The name is what makes it hard to see: it reads as correct in
a list, and the rule matched and redirected exactly as configured.

The diagnosis is worth keeping, because it separates a broken *rule* from a
broken *host*. If DNS resolves, TLS completes on a certificate issued for that
exact hostname, and the response carries the zone's own security headers, then
everything downstream is provisioned and waiting — whatever is wrong happens
before the origin is reached. **Cloudflare only issues a per-hostname
certificate for an attached, verified custom domain**, so the certificate alone
is evidence the host is fine.

And prefer disabling a rule to editing one. The apex came back on a single
toggle, instantly reversible, with `www` untouched throughout because the rule
never matched it. Fixing the target *and* the direction in one edit would have
changed two things at once on a site that was down.

**Cloudflare Pages sends `Cache-Control: public, max-age=0, must-revalidate`
on everything, and that changes what `?v=` is for.** Measured 18 August 2026 on
both `index.html` and `app.js?v=…`: max-age zero, an `ETag`, and
`cf-cache-status: REVALIDATED`. So a browser re-asks about every file on every
load and gets a 304 when nothing moved. There is no ten-minute window any more
and no four-hour one; there is a round trip per asset instead.

**The old trap is gone with it, and it is worth knowing why rather than just
that.** Under GitHub Pages, `index.html` and the assets published a moment
apart, so a verification poll fired too early asked for `app.js?v=<new>` while
the old body was still at that path — and Cloudflare then cached that answer
against the fresh address for the full ten minutes. New HTML, old JavaScript,
at a URL designed to prevent exactly that. It happened once, on the profile
deploy. **A Cloudflare Pages deployment is an atomic snapshot**, so the HTML
and the assets it names go live together and there is no window to race. That
is the platform's contract rather than something measured here, and it is the
single biggest operational improvement from the move.

**The inverse trap arrived with `web/`, and atomicity is what creates it.**
Vite's bundle is content-hashed into its filename, so a deploy does not
overwrite `assets/index-<hash>.js` — it publishes a new name and the old name
stops existing. Measured on the 20 August 2026 merge: the previous build's
`assets/index-b37N_smL.js` returned **404** the moment the new deployment
promoted, while `assets/index-DYBRJTZj.js` returned 200. So a browser holding
the *previous* `index.html` asks for a bundle that is gone. Old HTML, missing
JavaScript — the exact mirror of the GitHub Pages trap above, and reached
because deploys are atomic rather than despite it.

**It fails as a blank Draft Room with a 404 and nothing else.** React never
mounts, so `#draftroom-root` is empty and every legacy script beside it loads
fine at the old `?v=` — which reads as "the page is broken" rather than "this
tab is stale". It cost a wrong conclusion about a deploy that was in fact
healthy: the same page loaded as `?cb=…` was correct in every respect.

**It is bounded, and the bound is the header rather than the hash.** `/` serves
`Cache-Control: public, max-age=0, must-revalidate`, so an ordinary navigation
revalidates and gets the new HTML; only a browser reusing a cached HTML
response *without* revalidating — an already-open tab, bfcache — can hold the
dead reference. That is the same narrow case the throwaway-query note below
already covers, so there is nothing to fix and one thing to know: **`?v=`
cannot help here.** It stamps the legacy files, and the file that goes missing
is the one Vite named itself.

**Which is also why the `immutable` idea below stays shut.** It is written
about `/app.js`, but the assets that would benefit most are the hashed ones —
and pinning a year against a filename that is deleted on the next deploy makes
this failure permanent for anyone who cached the HTML beside it.

**Keep bumping `?v=` anyway.** It costs one number, it is what makes an asset
address change when its content changes, and it is the only part of this that
does not depend on who is serving the file — which is the whole reason it
survived the move unchanged. It is also the precondition for the improvement
below.

**The obvious next win is `immutable`, and it has a trap in it.** Assets under
a `?v=` stamp are immutable by construction, so `max-age=31536000, immutable`
would remove the revalidation round trip entirely. `_headers` matches on
**path, not query**, so that rule would apply to `/app.js` however it is
addressed — and a deploy that changed `app.js` *without* bumping the stamp
would then be cached for a year in every browser that had loaded it. The
nightly always bumps. A hand-run rebuild does not, which this file already
warns about in the section above. Do not set this until that hole is closed.

**Verifying a deploy is now simpler, and the throwaway query is still the
honest way to do it.** `curl https://jukeff.com/` shows the new version as soon
as the deployment promotes. A browser tab you already had open may still
disagree, because it holds its own cache and a forced reload does not always
clear it — after the how-it-works rewrite one kept serving the previous copy
until it was loaded as `…draft-room-how-it-works.html?cb=1`. So do not conclude
a deploy failed because a tab disagrees with `curl`.

**`og:image` must be an absolute URL, and it is baked to `jukeff.com`.**
Link previews are fetched by Slack, iMessage and Twitter from their own
servers, so a relative path resolves to nothing. If the domain ever changes,
`index.html` and `manifest.json` both need updating.

**Scores come from ESPN, and nothing else does.** Sleeper's schedule feed
carries no scores at all — only home, away, date and status — so the strip
uses ESPN's public scoreboard endpoint. It is a third feed, it is
undocumented, and it is the only thing in Juke that depends on someone
else's server at run time. So it fails by disappearing: down, slow, blocked,
or changed shape all end at `strip.hidden = true`. It also renders nothing
when there are no games, which is most of February to August. Never let it
throw, never let it show an error, and never let it block a render.

**Escape every chat message, and every name attached to one.** Chat is the
only text on the page written by another person rather than by our own
pipeline, and `renderChat()` puts it in `innerHTML`. It all goes through
`escHtml()` first. This is not a style preference: without it, one manager
can put a script tag in everyone else's draft. Verified by sending
`<img src=x onerror=...>` through a real room and checking no image element
is created and nothing runs.

**A name is the second thing on the page somebody else wrote.** Chat was the
first, and for a while it was the only one, which made the seat list safe by
accident: every chair said "Manager" or "CPU" and we wrote both. The moment
names became real, `renderInvite()` was putting a person's typing straight
into `innerHTML`. Anywhere a name is drawn — the seat list, a message header,
an avatar, the typing line, the "took seat 4" announcement — it is escaped,
and the room cleans it first: control characters out, tabs and line breaks to
a space (dropping a newline turns "Chase\nCantwell" into one word, which is a
different name, not a safer one), collapsed, trimmed, then cut to 20.

**Reactions are stored as member ids and never sent as them.** A chat line
keeps `reacts: { "🔥": [memberId, ...] }`, and `viewFor()` turns that into
`{ emoji, count, you }` before it leaves. That is the same rule the rest of
the view follows and the reason it exists: a client that has never been told
another member's id cannot impersonate them by echoing it back. The emoji is
checked against `REACTIONS` for the same reason a GIF host is — otherwise it
is an arbitrary string, per person, per message, in a room strangers can be
invited into.

**Typing never touches state.** It is relayed to the other sockets and
forgotten. Storing it would mean a Durable Object write per keystroke to
record something that is true for two seconds, and it is a lie the instant a
connection drops. The seat comes from the socket, never from the message, so
"seat 4 is typing" about somebody else is not a claim the room honours.

**Picks are not chat messages; the client merges them in.** `room.picks`
already carries every pick with a timestamp, so `chatStream()` interleaves
them by `at` rather than the room storing them twice. The version that stored
them looked fine for a round and then wasn't: 140 picks through a
fixed-length log pushes every real message out by about round three.

**The chat log is bounded in bytes as well as lines.** The whole room is
written to storage on every action and a Durable Object value has a hard
ceiling. Five hundred characters is a legal message, so 200 of them do not
fit beside the picks and the league — a line count alone does not bound the
write.

**An author `display` beats `[hidden]`.** The chat dock is hidden from
JavaScript and given `display: flex` by CSS, and the CSS wins — a solo draft
grew a chat panel for a room it was not in. Anything that is both toggled by
the `hidden` property and given a display in the stylesheet needs
`[hidden] { display: none }` or `:not([hidden])` on the display rule.

**`top` survives every change of `position`, and it has now caused two
different bugs.** The docked chat sets `position: sticky; top: 8px`, and both
of the rules that re-position it inherited that 8px:

- *As a fixed sheet:* the mobile rule sets `bottom: 0` and a height. Top plus
  height is a complete answer, so the browser took it and ignored `bottom`,
  and the sheet opened at the top of the screen.
- *As a relative block:* the lobby rule changes only `position`, and `top`
  applies just as happily to a relatively positioned box — as an 8px shove
  downwards with the layout box left where it was. So the dock hung 8px below
  its own slot and sat on top of the Start button beneath it. Eight dead
  pixels on the button the whole screen exists to get you to press.

`top: auto` is the fix in both. **Changing `position` on a shared rule means
auditing `top`, `right`, `bottom` and `left` with it** — they do not stop
applying, they change meaning, and nothing warns you.

**Every field is 16px on a touch screen, because iOS zooms anything smaller.**
Safari zooms the page in when a field under 16px takes focus and does not zoom
back out, so typing one line of chat left the whole draft magnified and the
manager pinching their way back — every time they said anything. Every field
in the app was under it: the selects at 14.5, chat and the GIF search at 12.5.

Those three sizes no longer exist. The type scale below puts `--fs-base` at
16px and every field on it, so the rule is now a floor the design already
meets rather than an exception fighting it. **Leave the rule in.** It costs
nothing while the scale holds and it is the only thing standing between a
field added in a hurry and a magnified draft.

It is one rule under `@media (pointer: coarse)`, with `!important`, and both
parts are deliberate. Coarse pointers only, so desktop typography is
untouched. `!important` because every field here is styled through a class and
`.chatform input` beats a bare `input` — the first version of the rule moved
the selects, silently left the chat box, the name and the player search where
they were, and looked like it had worked. This is a floor under the design
rather than an opinion competing with it, and a field added later inherits it
without anybody remembering this exists.

The other fix is `maximum-scale=1` on the viewport. It works and it is worse:
it buys this by taking pinch-zoom from everybody, including people who need it
to read the page at all.

**`scrollWidth > clientWidth` is what correct truncation looks like too.**
Sweeping the page for elements wider than their box is a good way to find a
phone layout that leaks, but on its own it reports every properly ellipsised
label as a fault. A board header for a team called
"Bone-Thugs-N-Montgomery" is 123px of name in a 74px cell and is behaving
perfectly: `overflow: hidden`, `text-overflow: ellipsis`, `white-space:
nowrap`. The question is not whether an element overflows, it is whether it
can either **scroll** (`overflow-x` is `auto` or `scroll`) or **ellipsise**.
Anything that overflows and can do neither is the real leak. Filtered that
way, the whole app comes back clean at 375px and the board's three inner
scrollers — the tab strip, the action bar and the grid — show up as the
scrollers they are.

**A monospace box stops being code the moment its lines become sentences.**
The formulas on the how-it-works page are prose now, which made them long
enough to wrap on a phone, and a wrapped line starting hard against the left
edge reads as the next step of the sum rather than the rest of the current
one — three steps looking like five. Each line is its own `div` inside
`.formula` with a hanging indent, so a continuation sits in from the margin.
Nothing wraps at desktop width, so the indent never shows there.

**A GIF address from chat is a claim, not a fact.** It arrives from another
manager exactly as a message does, and it ends up in an `img src`. Only
GIPHY's own media is allowed, checked with `URL` rather than a substring —
`https://evil.com/?x=giphy.com` contains the string and is not GIPHY, and
`giphy.com.evil.com` is a different site entirely. Checked twice: `cleanGif()`
in the room before it is stored, `safeGif()` in the page before a browser is
asked to fetch it.

**The GIPHY key lives in the worker and nowhere else.** In the page it would
be readable by anyone who opened dev tools. `wrangler secret put GIPHY_KEY`,
or the dashboard, and the worker proxies the search. With no key it answers
`configured:false` so the picker says GIFs are not set up rather than showing
an empty search.

**Escape anything that comes from ESPN.** Every other string on the page is
generated by our own pipeline and goes into `innerHTML` as-is. The score
strip is the exception, so team names and status text run through
`escHtml()` first. Do not follow the surrounding style here.

**Anything an API gives us that we don't use should be visible, not silent.**
Unmatched players and unscored stat keys both get written to `unmatched.txt`
rather than dropped.

**CSS cannot reach inside `<use>`.** The mark is one `<symbol>` cloned into
each header, and `<use>` builds a shadow tree that descendant selectors do
not match — `.appbar .mark-body` silently matches nothing. Custom properties
*do* inherit into it, so per-header overrides set a variable on the `<svg>`
(`.appbar .mark { --mark-ink: #fff }`), never a `fill` on the path.

**The logo is navy-on-light, so it needs `--mark-ink`, not a fixed fill.**
Hardcoding white made it invisible on every light surface, with only the
swoosh showing. The token is brand navy in light, white in dark, and
forced white on the navy draft bar.

**Weekly logs are keyed by season; season totals are not.** `stat.w` is
`{ "2025": [...], "2024": [...] }`, two years, and `stat.s` is every season
back to 2018. They answer different questions: the career table wants depth
and costs nothing extra, week-by-week wants recency and costs about 184KB a
season in a file that is a plain script tag on a page with no build step.
Five years of weekly rows would put a megabyte of render-blocking JSON in
front of a phone. `WEEKLY_SEASONS` in `build_players.py` is the one place to
change it, and `logYears()` draws a selector of the years a player actually
has rather than five tabs with three of them dead.

**Sleeper stores height as inches**, a bare number from 67 to 78 across the
whole pool, with no quote form anywhere in it. `heightText()` renders it. A
team defense has no height, weight, age or college — it is eleven people —
so `bioLine()` gives it its own line rather than a strip of dashes, and
`ourRead()` calls it "this defense" rather than "him".

## The board card

Five things per cell: who, what and where, which way the pick order is
travelling, which pick it was, and a face. It was a surname and a position.

**This section describes the LEGACY board.** The React board's cell is a flat
`POS_MATTE` fill with dark ink on it now — see "The matte position palette"
above for what moved and why every mark on the cell had to invert with it.
The rules below about the arrow, the row owning the height, headshots costing
nothing per render and empty cells being centred are all still true of both.

**The arrow is there for the turn, which is the one thing the numbers do not
tell you on sight.** Down on the last pick of a round, along the way its round
runs otherwise — and it asks `DraftEngine.pickInRound()` rather than deriving
the mirror again, which is the third caller and the reason that function
exists.

**A defense keeps its club.** `lastName()` drops the word "Defense", so
initialising what is left gives "L. Chargers", which is nobody: the first word
of a team name is not a first name.

**`avatar()` is deliberately not reused for the face.** It draws initials
underneath as a fallback and carries `.avatar`, which is hidden outright inside
the rail and is the player photo on the sheet. A 20px board face wants neither,
and a missing photo draws nothing at all — 140 grey circles is a worse board
than 140 cards, six of which have no picture.

**The row owns the height, not the cell.** A row is as tall as its tallest
cell, so a floor on the cell gives a uniform board only while the floor happens
to exceed the card's natural height. Set at 56 against cards that came out 58,
the board had two row heights and every row jumped 2px the moment its first
pick landed — on a pane that is simultaneously trying to keep the live pick
centred. `grid-auto-rows` states it once; `grid-template-rows: auto` leaves the
header sizing to itself.

**140 headshots cost one request each and nothing per render.** Measured:
`renderBoard()` goes 5.3ms to 15.2ms and the whole `render()` 34ms to 41ms,
once per pick — and across ~90 rebuilds the browser made exactly 140 requests,
because the DOM churn re-uses the cache. The board being rebuilt from scratch
on every change is not a reason to fear images on it.

**Centring the empty cells was not cosmetic tidying.** They were pinned to the
top, which was 6px above and 25 below at 42px and became 6 above and 41 below
at 58. Nobody would have called the old one wrong; the new one read as a number
that had slipped its box.

## Contrast

Every one of these was found in a single sweep, and none of them announced
itself. The app looked fine throughout. **The bar is 4.5:1 for anything
under 24px — or under 18.66px bold — which is very nearly all of it**, and
a sweep that uses 18px, or 14px bold, is measuring a rule that does not
exist and will pass things that fail.

**`--ink-light` is pinned by `--fill`, not by taste.** It is the tertiary
tone, used 58 times, almost always at `--fs-2xs` or `--fs-xs`. It missed on
every surface it lands on: 4.43 on `--sunken`, 4.18 on `--card`, 3.83 on
`--well`, 3.54 on `--fill` — and the light theme, which nobody had checked,
bottomed out at **2.31**. 122 elements across the two.

**Fixing the tertiary tone forced the secondary along with it.** In light,
`--ink-light` has to reach `#5E6A76` to clear `--fill`, and `--ink-mid` was
sitting at `#5A6875` — 4.83 against 5.00. Two tones 0.17 apart is one tone
with two names, so `--ink-mid` moved to `#4C5763`. **The ramp is set from
the bottom in both themes**: the tertiary is whatever the worst surface
allows, and the secondary is placed above it. Body text getting darker in
light is the side effect and it is the right one.

`--fill-hi` looks like a fifth failing surface at 3.02 and is not: every
rule that hovers to it either sets `--ink` or starts from `--ink-mid`,
which clears it at 5.30. Check what a token is actually paired with before
solving for it.

**Four of the six position solids failed under the white text they are
documented as always carrying.** TE 2.68, WR 3.12, QB 3.96, RB 3.97 — 80
elements — with only K (4.52) and DST (4.86) passing. They are darkened by
lightness alone, hue and saturation held, so the board colour-codes exactly
as it did: the closest pair is RB/DST and it separates by 25 in CIE76
against a just-noticeable threshold near 2.3. TE moved most, by 19.

**So four of these are no longer the values sampled off the logo artwork,
and that is not a drift to correct.** Five seat colours were the same hex
and carried the same fault; they took the same values. **A seventh position
or a ninth seat needs white checked against it before it is added.**

**Every stop in a gradient must clear white on its own.** `--hdr-cyan` was
`#12A3DC` — 2.88, the worst in the app — under a header carrying a 16px
headline, a 12px pick line and a 10px label. It sits at 130%, so it is
never fully painted, and it is tempting to check only the colour the box
actually reaches. **Do not tie the requirement to a stop percentage**: move
the stop later and the contrast silently breaks. With every stop passing,
any interpolation between them passes too.

**Translucent white on a saturated surface is a false economy.** The header
labels were `rgba(255,255,255,.82)` and `.68`, measuring 2.95 and **2.48** —
the worst contrast on the screen somebody stares at while their own clock
runs down. At a 4.6 backdrop the minimum workable alpha is **0.98**, and
even a solid `#F2F6F9` only reaches 4.27. There is no opacity that reads as
secondary and stays legible; the choice is not a real one. Hierarchy on a
strong colour comes from size and weight.

**And `opacity` is a third way to lie about a colour, after alpha and
gradients.** The board card's `POS · TEAM` line carried `opacity: .85` for as
long as the board has existed, measuring 3.74 (QB), 3.79 (RB), 3.82 (WR and
TE), 3.81 (K) and 4.02 (DST) — all six under the bar, on every card on screen.
It survived every sweep this project has run, including the one that caught the
header labels above, because a walker reading `color` sees `#fff` and reports
4.62: the opacity is a property on the *element*, not a channel in the colour,
so it never appears in the value being measured.

The solids are darkened to put white at exactly 4.6, which is the other half of
it — there is no margin to spend, so *any* translucency takes them under.
**A sweep has to composite `opacity` against the backdrop the same way it
composites alpha**, and `tests/board-card.spec.mjs` now does.

**A disabled control is exempt, which is how a regression hid in one.**
`.primary:disabled` was white on `--ink-light` at 3.88. Lightening
`--ink-light` to clear its own bar dropped that to **2.83**, and no sweep
would ever have caught it, because WCAG excuses inactive controls. It is
muted text on a muted fill now. **Fixing a token can degrade something the
rules do not check** — when a token moves, look at what else names it.

**Sweep with the real backdrop, or the answer is noise in both
directions.** A walker that reads `backgroundColor` cannot see a gradient:
on `.appbar.my-turn` it falls through to `--card` and reports white-on-white
at 1.07, which is not a failure, and on the navy band it reported the hero
slogan at 4.30 when the slogan actually sits over the flat `--navy-deep`
region and measures 5.15. **Both a false alarm and a real miss came out of
the same shortcut.** Composite the alpha, and interpolate the gradient at
the element's own position.

## The rebrand, and the three things that did not survive it

Measured on 18 August 2026 by running `getComputedStyle` over six live
competitor sites and weighting each colour by the screen area it covers — the
values as shipped, not as published in a brand guide.

**Juke was wearing Sleeper's clothes, and the evidence was two decisions
rather than a vibe.** Same two typefaces, exactly: Poppins for display and
Inter for body. Ground within nine points of lightness — Juke `#0E151E`
against Sleeper `#05091D`, cards `#18212D` against `#131B38`, blue-grey
secondary text on both. Three of the seven platforms surveyed were on Poppins.

Two things fell out of the survey that are worth keeping:

- **Five of six competitors use a light ground.** Dark navy is not what
  fantasy football looks like; it is what *Sleeper* looks like, and Juke
  defaulted to dark. Underdog is the most distinctive brand in the category
  and went the other way entirely — white, `#FFFF00`, a heavy condensed face.
- **Nobody uses orange.** It is the one unclaimed position in the category and
  Juke already held it in the mark.

**Type is the fastest identity signal, which is why the face went first.** It
is read before anything is consciously looked at. The risk was apparent size,
because a condensed face usually costs it — measured at 42px against Poppins,
Barlow Condensed came out **cap height 107%, x-height 116%, width 83%**.
Taller *and* narrower, so headings did not weaken, 10 and 12px text gained a
sixth of its x-height, and board cells gained horizontal room. No type-scale
adjustment was needed, which was checked rather than hoped.

**Moving a ground means holding luminance, not HSL lightness.** They are not
the same thing: luminance weights green heavily, so shifting hue at constant
lightness silently walks every contrast ratio in the section above. Solved for
matched luminance instead, the whole contrast section stayed true word for
word — page 15.46 against a documented 15.43, `--ink-light` on `--fill` 4.84
against 4.85, and the gold ring **9.51 against a documented 9.5**, because an
empty cell *is* `--fill` and `--fill` kept its luminance. Do it this way and
there is nothing to re-derive.

**Cleveland is the club that runs out of room first.** All 32 accents still
clear the documented 12 CIE76 bar against the card, worst Green Bay at 14.3.
But Cleveland went 29.2 to 19.1 on a neutral ground and 16.7 on the warmer one
that was rejected. Warming the ground pulls the warm clubs closer, and brown
against a warm charcoal is the pair that fails first.

### Tried and rejected: a warm ground

The first attempt was hue 28 at 13% saturation, and it read sepia. **Orange is
hue 21, so a warm ground is analogous to it** — the accent stopped fighting the
background and the CTA went quiet.

The bind is worth understanding before anybody tries again: orange's complement
is about 201, and Sleeper occupies 214 to 233. **The best ground for this accent
is roughly where the competitor already lives.** A considered neutral is the way
out of that, which is why the ground is 5% saturation and not 0 — near
indistinguishable from grey on screen, still lets the orange carry, and a bias
toward the accent is what separates a chosen neutral from an inherited one.

### Tried and rejected: orange as a surface

An orange hero band was built, screenshotted and thrown away. It **swallowed
the CTA whole** and took the eyebrow with it, and the product shot's position
solids fought the ground.

**A colour cannot be the ground and the call to action at once.** Orange is
load-bearing under the one-primary-action rule, so flooding a surface with it
forces a different CTA colour, which breaks the rule that took real work to
establish.

So the survey's own conclusion — *orange is only about 1% of the landing page,
spend more of it* — **was wrong, and is retracted here.** The 1% is not
under-use. It is what makes the accent work. What orange can have is somewhere
nothing is clickable and the area is tiny, which is the 4px rule across the top
of `.shellbar` and `.appbar`.

### Tried and rejected: position colour as a left rail

Both variants were built against a real board and neither earned its place:

- **Neutral cell with a 3px rail.** Prettier, calmer, higher-contrast text —
  and at working zoom the rails are nearly invisible. Scanning the grid for
  position runs is what a draft board is *for*, and it stops working.
- **Tinted fill with a 4px rail**, reusing the `--*-bg` / `--*-fg` pair the
  badges and avatars already use. Better, still worse than the solids: those
  tints were drawn for 20px badges and read muddy at cell size.

**The argument for it was that a rail frees the cell to carry white text at
full contrast, and that solved a problem which does not exist.** The six solids
were already darkened until white clears 4.6:1 on each — measured, documented
and passing. Trading a working information channel for a fix that had already
been made is a bad trade, and it is the shape of mistake to watch for: a
redesign justified by a constraint that was lifted years ago.

### What did work, and why the pattern is worth copying

Three of six proposals died on contact. The two that shipped were the ones with
a **measurable invariant** — a font swap that could be checked against cap
height, and a recolour that could be checked against luminance. The three that
died were the ones justified by taste or by a stale constraint.

Prototype in the browser before writing to the file. Every rejection above cost
one injected stylesheet and one screenshot, and none of them touched the
repository.

### Orange retired, two days later

Everything above is the record of 18 August, and it argued for *keeping*
orange — "the one unclaimed position in the category." It was still right,
on its own terms, on the day it was written. The owner reversed it anyway on
20 August: the palette runs on teal now, `--orange` / `--orange-cta` became
`--teal` / `--teal-cta`, and every rule and comment in this file that named
orange as the *current* accent has been rewritten in place to name teal —
rather than left standing to describe a colour nobody ships any more.

Nothing above is corrected a second time. The survey's findings are still
true — the category still has no orange in it, and Juke's own mark still
did — they simply stopped being the deciding argument once a different
preference outranked them. The lesson the rejected experiments taught
outlived the colour they were taught on: an accent still cannot be the
ground and the call to action at once, which is exactly why teal is not a
hero-band surface either, and the scarcity that "made the accent work"
applies to whichever hue is holding the job this month.

**Teal was not invented for this.** `#00E5FF` was already load-bearing in
two places before this change touched the legacy stylesheet at all: it is
the lightest stop of the draft room header's own my-turn gradient
(`web/src/components/AppHeader.jsx`, from the header redesign) and it is
the accent in the newer J-monogram app icons (`web/public/juke-favicon.svg`,
`juke-app-icon-*.png`, `juke-app-icon-gradient.svg` — paired there with a
purple `#7B1FA2` this rule does not otherwise use). Retargeting `--orange`
to that same value connects a colour three parts of the app already agreed
on, rather than choosing a fourth nobody had measured.

**One thing this pass could not reach, and it stayed unreached for two more
brand generations.** `favicon.ico`, `favicon-16.png` and `favicon-32.png` at
the repo root are rendered PNG/ICO, not CSS-driven elements, so they went on
showing the shield's swoosh in the original orange while the app showed first
a goalpost and then a shark. `404.html` and all three `docs/` pages link them
directly. That is the general lesson rather than a footnote about orange: **a
raster export is invisible to every pass this project knows how to run**, so
it does not drift a little, it stays exactly where it was until somebody goes
and looks. The shark swap is what finally replaced them, and the sentence
"no tool here rasterises an icon" was true and beside the point — the `.ico`
never needed rasterising, only a container, which `scripts/build_favicon_ico.py`
now writes in forty lines of stdlib around the PNGs' own bytes.

**The first attempt at `--teal-cta` repeated the exact mistake this section
just finished describing, aimed at a new colour.** It measured `--teal`
against white (1.54:1, hopeless), reached for the nearest already-verified
darker stop — the header's own `#0F7C8E`, 4.89:1 — and shipped it without
checking the one thing that mattered: whether it still read as *the same
teal* next to the rest of the app. It didn't. Sat beside
`web/src/components/DraftLocker.jsx`'s "In Progress" pill or
`DraftBoardGrid.jsx`'s "YOU" marker — both full-strength `teal-500` under
dark text — a button in `#0F7C8E` reads as a different, muted colour
entirely, which is exactly what a person looking at the actual screen
said. **A number clearing a bar is not the same claim as a colour matching
its neighbours**, and only one of those was checked.

There is no darkened stop of this hue that clears both: white needs
L≈28% (`#00808F`, 4.68:1) against a swoosh sitting at L=50%, which is a
visibly different, muddier colour, not a legal darkening of the same one.
`--teal-cta` is `--teal` itself now — no darkening at all — and
`--teal-cta-ink` (`#0B0E14`, 12.56:1 on it) carries the text instead,
which is the fix `DraftLocker.jsx` and a dozen other React components
already shipped, under Tailwind's `obsidian` and this same hex, before the
legacy stylesheet caught up to its own product. Check the actual screen
next to the actual other elements on it, not only the arithmetic — the
lesson the rebrand survey exists to teach, learned a second time on a
smaller colour.

**The second attempt matched the wrong neighbour, not just the wrong
value.** Flat `teal-500` under `obsidian` text is real and it is
consistent — but it is DraftLocker.jsx's "In Progress" pill and
DraftBoardGrid.jsx's "YOU" marker, both *tabs and status indicators*, and
`web/src/components/LobbyBar.jsx`'s Start Draft button is neither: it is a
call to action, the same one as Hero.jsx's "Start a Mock Draft" — whose
own comment already called it "the product's actual 'start' button" — and
as Header.jsx's "Sign Up", RoomPanel.jsx's "Create a room" and
DraftLocker.jsx's own "Start your first mock" a few pixels below the pill
that was copied instead. All eleven of those are one identical class
string: `bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2]`, white text,
`shadow-glass`, `hover:scale-105` with a glow. That is the CTA idiom; flat
teal-on-dark is the tab idiom; and a button can sit one pixel from a tab
wearing the same base hue without being the same kind of control. Two
correct facts about a colour — it clears contrast, it matches *something*
on screen — are not the same as matching the thing doing its own job.

This one stays React-only. The legacy stylesheet has no gradient-button
convention anywhere — every `.cta` and `.primary` on it has always been a
single flat hue, orange then teal, and `--teal-cta` staying flat (this
section, above) is that system being internally consistent with itself,
not an unfixed case of the same miss. Introducing a gradient there would
be grafting a Tailwind-side idiom onto a codebase that has never used one
for a button, which is a bigger and different change than "match the
button that does the same job" asks for.

## The shark

The goalpost monogram is gone. The mark is a shark, and **no colour token
moved to make room for it** — that was the deciding argument between the three
options, not a happy accident. The product teal `#00E5FF` and the shark
artwork's own aqua `#84E4E4` are the same hue, 186 against 180, differing only
in saturation, so the mark rendered in `#00E5FF` is not a compromise reading of
somebody else's palette. `tailwind.config.js`, `index.css` and
`draftRoomPositions.js` came out of the swap with empty diffs, and that is a
check to re-run rather than a claim to trust.

**The mark is 564:352 and height is always derived from width.** 1.602:1, where
the goalpost was 0.96:1 — so the lockup is about 10px wider at every size:
measured 105px at `size={21}` and 90px at `size={18}`. `markWidth` went from
`size * 1.15` to `size * 1.7` and the lockup gap tightened from `0.48` to
`0.42` to give some of it back.

**The path data stays out of the bundle, and that is what the `<img>` and the
CSS mask are for.** The artwork is ~24KB. Colour variants load as `<img src>`;
`mono` is a `mask-image` over `background-color: currentColor`, because an
`<img>` cannot inherit a colour and inlining the geometry to get that back
would put the 24KB in the JavaScript. Verified after the swap: the built chunk
names the four SVG URLs and carries none of their geometry.

**Below 28px the component swaps itself to the silhouette, and below 12px it
draws nothing.** The three-value face does not survive smaller, and rendering
mush was the previous artwork's failure mode. **This threshold is a trap for
call sites that pass a width rather than a `size`.** `AppHeader.jsx` asked for
`width={20}` — which is below it, so the mark would have rendered as a
`currentColor` silhouette whether or not `mono` was set, quietly dropping the
resting state's teal and falsifying the comment directly above it promising a
two-value mark. It is 28 now, which is the smallest width that keeps the face.
A handoff saying "no call site needs editing" is a claim about the *signature*,
not about the values already being passed through it.

**A variant per ground, not one file you recolour.** In the supplied artwork
the eyes, teeth and jaw were filled with the canvas colour, so the mark only
worked on one background. Every file declares its negative value explicitly,
which is why `juke-mark-light.svg` and `juke-mark-fg.svg` exist as files rather
than as a `fill` override. **That is what makes an `<img>` mark theme-blind**:
the inline SVG it replaced on `404.html` took `var(--mark-ink)` and
`var(--teal)` and reversed itself, and an `<img>` cannot. That page carries two
of them and swaps on `:root[data-theme="light"]`; the `docs/` headers carry one,
because `.appbar` is navy under both themes.

**The mark may now stand alone, and that is the one rule that changed.** The
goalpost read as a plain U without its wordmark, so mark-only was restricted to
favicons and tiles. The shark is a distinct silhouette, so `variant="mark"` is
legitimate in avatars, badges and a bar that has run out of room — which is the
first fix to reach for when one has.

**`DraftCockpitHeader.jsx` has run out of room, and the mark is not why.**
Measured at 640px with a draft in progress and the clock mine: the controls
block ends at 685px against a 640px bar. Take the logo out altogether and it
ends at 616 — so it fits without a logo and overflowed by 35px with the
goalpost, before the shark added its 10. At 768px the `md:flex` tab nav joins
in and the bar needs **941px** before it stops clipping. Mark-only brings 640px
back to 622 and fixes it; nothing about the logo fixes 768. **The bar wants a
real answer at `md`, and the logo is 95px of a 173px problem there.**

**The handoff named the wrong component for that check, which is worth knowing
before trusting the next one.** It said to verify `DraftRoomStatusBar.jsx` at
`sm`, and nothing has imported that file since `DraftCockpitHeader.jsx` took
over both of its call sites. Its own 375px comment budgeted `81 (logo)` against
markup carrying `hidden shrink-0 sm:block` a few lines below — the arithmetic
had been wrong since that class went on. A handoff's paths are read off the
repository at some moment and go stale like anything else; check what actually
renders before measuring it.

## The draft room header

**`web/src/components/AppHeader.jsx` replaced `.appbar` visually, and every
rule below is still what it draws from.** Same reason `DraftSettings.jsx`
replaced `.setup` rather than deleting it: `.appbar-inner` is hidden
`display:none !important`, not removed, because `renderHeader()` writes into
`#statusLine`/`#pickText`/`#leagueLabel`/etc. on every render, tick and pause
toggle, and unguarded top-level listeners on `#homeBtn`/`#soundBtn`/
`themeBtns()` throw on a missing element. `renderHeader()` itself now calls a
pure `headerInfo()` first and paints its result — the same function
`window.JukeEngine.headerInfo()` bridges to React, so the branching below (my
turn, urgent, whose turn, the clock, the pick code) is computed exactly once.
`headerInfo()` fires `window.dispatchEvent(new Event("juke:header"))` at the
end of every call, which is what tells the React header to re-read rather
than poll.

**Which means the tests in `appbar.spec.mjs` verify `headerInfo()`'s output
via the hidden legacy DOM, not the React header's own rendering.** They still
matter — a wrong `headerInfo()` is wrong for both — but nothing here
automatically catches a React-side rendering bug that disagrees with data
`headerInfo()` got right. That was checked by hand across all five states
(resting, my-turn, urgent, someone-else's-turn, draft-over) plus real
computed-contrast measurements on the two new gradients, not by a new spec.

**The new gradients are not the old ones, and had to be measured the same
way.** My-turn uses a deep teal ramp (`#0A4650` → `#0E6B78` → `#0F7C8E`,
10.47 / 6.19 / 4.89 against white) rather than brand teal (`#00E5FF`), which
measures nowhere close to 4.5:1 — the obvious first choice for the lightest
stop, `#12889C`, measured 4.18 and had to be darkened further, same story as
`--hdr-cyan` originally being `#12A3DC` at 2.88. Urgent reuses the legacy red
ramp exactly (10.30 / 6.19 / 4.60) rather than reinventing verified-safe
values for no reason. And the labels are solid white when lit, not
translucent — `text-white/80` measures the same false economy this section
already found once, below.

**Three stacked bars is 153px before a player's name.** A 57px header, a 53px
tab row and a 43px action bar, on a 900px screen — 17% of it spent on
furniture, and the action bar held four controls nobody presses twice in a
draft. Tabs and actions share one band now: navigation left, the things you do
to the draft right. **The 43px goes to the board rather than being pocketed**,
so nothing below it moves and the board gains a whole round — it showed 5.9 of
fourteen.

**The band carries the paint and the `hidden` flag; neither child does.** An
empty band still draws its background and its bottom border, so the wrapper
has to be the thing that hides. And the two were only ever shown and hidden
together, in four places — two flags that must agree is one flag with a second
copy.

**They stack again below 760px.** The tab strip already scrolls sideways
there, and feeding the actions into the same scroller puts "Discard draft"
behind five tabs.

**A logo in the corner is the way out only to somebody who already knows
that.** `#homeBtn` had been the mark alone, doing two jobs and announcing the
second. It is a chevron and the mark in one control now — one way out rather
than two competing in a 390px bar.

**What draft this is belongs in the header, because the setup screen folds
away.** Four rounds in there was no way to check whether this was a 14-round
league without leaving it. It comes from `leagueSummary()`, which is the
string the shut setup box already shows — never a second copy of the same
lookup. It stands down under 760px: it is reference rather than state, so it
is the first of the four things on that bar that can wait.

**Sound is synthesised, not played from a file.** Three cues do not justify
the first binary assets in a repository that has none, a tone generated in the
page cannot 404 or be served stale behind a cache, and it costs no request.
Same argument as the door being drawn and the product shot generated. The
`AudioContext` is made on the first gesture that needs it and never at load —
one created at load sits suspended for ever, so the first cue is silent with
nothing to say why. It never throws: Web Audio is a runtime dependency on
somebody's hardware, and it fails by going quiet the way the score strip fails
by disappearing.

**`soundCue()` fires on the change, not on the state.** `renderHeader()` runs
on every pick, every tick and every rebuild, so "is it my turn" is true
hundreds of times for one turn.

**A class is not a style; it is a control.** The sound button was given
`theme-toggle` to inherit its look, and that class is what `themeBtns()`
selects, what `syncThemeButton()` writes `aria-pressed` onto, and what the
delegated handler switches the theme on. It loaded showing "on" it had never
been given and would have changed the theme when pressed. The shared shape is
`.hdrbtn` now and each button keeps its own name. This is the `.home` /
`.avatar` / `initials()` collision again — except **checking the stylesheet
for the name would not have found it**, because the clash was in behaviour.
Grep the script too.

**A media query carries no specificity.** The phone rules for `.count` were
written *above* the rules they override and changed nothing, while
`matchMedia` agreed the query matched — which reads exactly like a rule that
is not applying at all. Source order still decides at equal weight.

**And the label and the value measure the same width, so trimming either
alone does nothing.** "Time left" and "0:59" are both 60px; the block is as
wide as its widest child either way. Two reasonable-looking fixes moved the
header by zero pixels before both together moved it by seven.

**The pick is the fact and the state is the label.** The bar led with "You're
on the clock!" at 16px bold and buried the pick underneath at 12px — and by the
time that sentence is readable the whole header has turned blue, so the largest
type on it was saying what the colour said first. The pick number takes the
19px display line now and the state drops to a 10px caps label above it; in the
resting state that same slot carries whose turn it is. One structure, two
contents, and it came out **61px against the 62 it replaced**, because the
padding moved off `.appbar-inner` and into the four segments.

**`--seg` is a property, not a colour.** The dividers between those segments
have to survive three grounds — the resting card, the blue gradient and the red
one — so the state blocks override it, the same way `--mark-ink` reverses the
logo. The first build used a flat `rgba(255,255,255,.16)`: right on the two
gradients, nearly invisible on the resting card, completely invisible in light.
Same class as naming `--band-ink` outside `.hero-band`.

**Two traps for whoever measures this bar next, both of which produced a
convincing wrong answer.** A draft opens on *your own turn*, so `.appbar`
already carries `.my-turn` — a check reading "the resting state" without
stripping it measures one ground three times and calls it three, which is how
the divider test first passed against nothing at all. And `.appbar` transitions
`color`, so a reading taken in a non-compositing pane without killing
transitions reports the value it is moving *from*: that produced a 2.93 and a
1.01 on a header that was perfectly legible.

**Run `python scripts/check_css.py` after moving a block, and do not count
braces.** A slice that ended at the first `}` after a one-line rule left a
media query open *and* an orphan `}` where the block used to be — so every
rule below the query silently became conditional on a phone width. The board's
gold rings vanished at desktop and nothing looked wrong.

It happened twice in one sitting, and the second time is the lesson: **the
brace count balanced both times.** An unclosed block and a stray closer cancel
exactly, so `count("{") === count("}")` passes a file it should reject. The
script walks the depth instead, which catches each half on its own — a `}` at
depth zero, and a non-zero depth at the end.

The tell in the browser is a rule that is demonstrably matching and doing
nothing: `matchMedia` agrees the query applies, the computed style disagrees.
That reads like a specificity problem and is not one.

## Claim and proof

Three claims down the landing page with the thing each one claims running
beside them. It replaced three paragraphs — claims with nothing to check them
against, which is the weakest thing a page can say about a product whose whole
pitch is that its numbers are inspectable.

**Every stage runs on live data, and that is the rule the section exists
under.** The same `board`, the same projections and the same `pointsUnder()`
the draft room uses. A hand-written table of plausible names is
indistinguishable on screen tonight and wrong the first morning the pipeline
moves — the same argument that keeps the product shot generated and the door
drawn rather than photographed. Nothing in it is a name anybody chose.

**`pointsUnder(block, rules)` takes its rule table rather than reading
`league.rules`.** That is what lets one screen price the same player under
standard, half and full PPR at once without swapping a global the whole draft
reads and swapping it back — which works until something throws halfway
through. `fantasyPoints()` is now a one-line call into it and no arithmetic
moved.

**A proof whose subject cannot move is worse than no proof.** The scoring
claim first sorted the board by projected points, which is six quarterbacks:
every row correct, and not one of them changing by a single point across the
three settings, under a headline reading "change a rule, every number moves".
The pool is now filtered by `s.p[STAT_KEYS.rec] > 0` — the players the rule
can actually touch, asked of the data rather than of a list of positions. At
0 the top six are all backs; at 1 point a catch, three receivers are in and
Derrick Henry is gone.

**A cross-position measure cannot be demonstrated on one position.** The Juke
score stage had the same origin bug and a worse consequence: top four by raw
points is four quarterbacks, and the entire purpose of points above
replacement is to say an elite tight end beats the twenty-fifth receiver. It
takes the best player at each position now. Allen projecting 406 points and
scoring 48 beside Gibbs projecting 300 and scoring 100 *is* the argument.

**A stage with nothing to say draws nothing.** `paintProof()` falls through to
the next claim when a builder returns `""`, bounded by the number of claims so
a short board cannot spin. Same contract as the score strip: it fails by
disappearing rather than leaving a heading over an empty frame.

**The stage has a floor height.** Three stages of different lengths in a box
that sizes to its contents makes the section grow and shrink under the reader
every seven seconds and walks everything below it up and down the page.

**`scoringFormats()` is a function, not a const.** It derives from
`REC_BY_FORMAT` and `SCORING_NAMES` — a third list of the same three formats
would be the copy nobody remembers — and it sits near the top of the file
where a `const` reading either of those would be inside their temporal dead
zone and throw on load.

## The homepage redesign

A full layout and messaging pass on the marketing homepage, from an external
design handoff — a single sticky header instead of a stacked logo/marquee/
scores bar, a readable 3×2 room grid instead of a one-card-visible coverflow
carousel, and copy repositioned from draft-prep tool to season-long platform.
Two things from it are worth keeping past the redesign itself.

**Every hex the handoff specified was close to but not identical to the
existing brand colours, and matching it literally would have put a second
teal next to the real one.** `#22d3ee`/`#7c5cff` versus the existing
`--teal`/`--purple` (`#00E5FF`/`#7B1FA2`) — near enough to read as the same
colour family, different enough that a CTA on the homepage and the identical
CTA one click later in the Draft Room would visibly disagree. Resolved as a
hybrid: every CTA, the "Live" state, and the logo stayed on the existing
teal/purple exactly as the Draft Room and `JukeLogo.jsx` already use them —
the handoff's own Assets section already said to swap in the real production
mark rather than its own placeholder, which is the same argument extended to
every other CTA-adjacent colour on the page. The handoff's mint (`#5eead4`)
and a new sky blue (`#38bdf8`) landed as genuinely new, homepage-only
*secondary* accents instead — the overline, background glow, chip labels —
the same way `POS_BADGE` already carries six distinct hues without any of
them competing with the one CTA colour. Position chips themselves were left
alone on purpose: `POS_BADGE` is documented as "the one hue reference for
the whole site now, not just the draft room," already shared by this same
homepage's `ShowYourWorking.jsx`, and re-theming RB/WR to the handoff's own
chip colours would have been exactly the "a position reads a different
colour depending which page you're looking at" bug that file exists to
prevent — reopened from a design brief that had no way to know it was there.

**A same-page anchor nav did not work, and the reason had nothing to do with
the nav.** Every link — `#rooms`, `#proof`, `#scores` — updated
`location.hash` correctly and then the page snapped straight back to the
top instead of landing on the section. `applyRoute()` ends in an
unconditional `window.scrollTo(0, 0)`, right for a real route change
(leaving the Draft Room, arriving at `#/`) and wrong for anything else — it
fights the browser's own native scroll-to-anchor on every `hashchange`,
including one that just landed nowhere near a route. This was already true
of Hero.jsx's pre-existing "Explore The Rooms" link — `#rooms` existed as a
target before this redesign — it just had one caller instead of a whole nav
depending on it, so nobody had gone looking. Fixed by not calling
`applyRoute()` at all from the `hashchange` listener when the new hash
doesn't start with `#/`: every real route in this app is `#/something`, so
that's a clean, complete test for "is this actually a route" rather than a
guess. The boot-time `applyRoute()` call is a separate, unguarded call site
on purpose — a fresh page load landing directly on `#rooms` from a bookmark
still needs the view-visibility toggle to run once, just not on every
anchor click after that.

`RoomNavigation.jsx`'s 3D coverflow carousel — the touch/keyboard/resize
handling included — is gone, replaced by `RoomsGrid.jsx`, a plain CSS grid.
Nothing about the "door" CSS this file documented at length was touched by
this: that prose is about the legacy plain-HTML homepage's own `.doorway`/
`.door` markup, a different system already retired when Cloudflare Pages
started building from `web/` — this carousel was a separate, React-only
implementation with no relation to it. `ROOMS` in `app.js` gained a `lead`
field (the short imperative line each card leads with) and reordered to run
chronologically across a season — Prospect, Draft, Waiver, Trade, Strategy,
League — rather than live-room-first; confirmed safe first, the same way
any reorder here should be: nothing indexes `ROOMS` positionally.

## Whose it is, and where the draft is

Two marks on the board, and they were one colour between them.

**Gold is identity, and it is the third meaning after teal and blue.**
Teal acts, blue states — and *whose* is neither. It had been blue in four of
the six places a seat is marked, navy in a fifth and translucent white in the
sixth, while blue was simultaneously carrying focus rings, the selected tab,
`--link`, `.draft-btn` and the header when the clock is yours. A colour doing
five jobs is not a signal. `--mine` is the mark now, everywhere a seat is
yours: the board column and its head, the pick cards, the pick lines, the
standings row and the product shot.

**`--mine` is a mark and never type.** #FFD166 is 1.4:1 as text on a light
card. The chat author's name stays `--link` for that reason, and it is not an
inconsistency: that is a name in a paragraph, not a ring on a cell.

**A ring on the board is a pair, because no single colour can survive what it
lands on.** It sits on six position solids — which are fixed across themes —
*and* on an empty cell, which is near-black in dark and near-white in light.
Measured: gold clears 3:1 on every solid (3.2 at worst) and 9.5 on a dark
empty cell, and reaches **1.26** on a light one. The keyline `--ring-edge` is
the exact complement — 4.1 on the solids, 16.7 on a light cell, 1.2 on a dark
one. So the ring is 2px of colour with 1px of keyline inside it, one half
always has the surface, and the two clear 11.7 against each other so the pair
always reads as an edge. `--live-ring` is white and takes the identical
construction for the identical reason.

The bar here is 1.4.11's **3:1**, not 4.5 — these are marks rather than text,
which is the one place in this project where the lower bar is the right one.
Do not "fix" the pair by finding a single colour. There isn't one, and the
arithmetic above is why.

**Both are inset `box-shadow`, never a `border` and never an `outline`.** A
border is inside the box under `box-sizing: border-box`, so the 2px dashed
border the live cell used to carry ate 2px of its padding — that cell was 4px
narrower inside than every other cell on the board and its text sat 2px high.
An outline does not follow `border-radius` in every engine and cannot be
layered, which the keyline needs. Same family as the ring-versus-border note
on the player sheet headshot.

**`mine` goes on an empty cell too, and that is the whole feature.** The class
only ever went on a filled one, so the board marked where you had *been* and
never where you were *going* — and when you pick again is the one question a
snake board exists to answer. Four rounds out in a twelve-team room it was a
counting exercise done by hand. Nothing failed and nothing logged: every cell
that was marked was marked correctly, which is why no check caught it. This is
the dead-control failure from the rail's "My Team" row in a different shape —
the defect is in what is *absent*, and absence renders, contrasts and passes.

**Your own turn draws both rings, nested.** It is the one cell on the board
where the two facts coincide, and letting either win throws the other away.

**What each team holds is on the board, and which positions get counted is
derived.** `FORCED_LATE` already names the two the app schedules itself, so
`COUNTED_POSITIONS` is `POSITIONS` minus those — listing QB, RB, WR and TE
would be the league shape written down a second time. Counting a kicker is
eight columns of "0" until the closing rounds and eight of "1" after them.

**Each count carries its own ground, and that is the whole reason it is a chip
rather than coloured text.** White on a position solid is the contract those
colours were darkened to meet, so the header behind it is never part of the
sum. Colouring the text was measured first and does not survive: the
light-theme `--*-fg` tones run 4.85–5.69 on `--board-hd` and **2.15–2.52 on
the navy of `.hd.me`** — so the one team a manager looks at most is the one
that fails, in one theme only.

**The overall pick number goes on an undrafted cell and nowhere else.** On a
filled one it is a sixth fact in a 74px box answering a question nobody has;
on an empty one it turns "when do I pick again" from arithmetic into reading.
It comes from `DraftEngine.overallOf()` — the mirror lives inside that, and a
caller holding a round and a seat must never work it out again. **Test the
property, not the arithmetic**: a corner number is right when
`pickCode(overall, teams)` equals the code printed in the same cell. Checking
`overallOf()` against a second copy of `overallOf()` proves nothing, and the
seat-versus-pick-number bug is exactly what this catches.

**The direction arrow is on every cell, and it was on drafted ones only.**
Same failure as the gold column, found in the same screenshot: the snake was
legible over the half of the board that had already happened and not over the
half still to be played. That is backwards — the turn matters *before* the
picks land, which is when somebody is working out whether their wait is one
pick or nineteen. It yields to the clock and only to the clock; two facts in a
74px box is one too many and the countdown is the one being watched.

## The mobile pass: one product on a phone, another on a desk

The owner's instruction was "all of these changes will be for MOBILE ONLY.
Our website should have a different offering altogether." That is a product
decision rather than a responsive-layout one, and it is now true of three
screens: the homepage, the Lobby and the draft menu each render something
genuinely different below `sm` (640px, `usePhoneWidth()`) rather than the
same markup at a narrower width.

**Nothing is deleted to make room for it.** The desktop marketing homepage,
the analytics Lobby and the anchored kebab dropdown are all untouched above
`sm`, and every one of them is still reachable from the phone: the Lobby's
dashboard is a button press away from the phone's Mock Drafts screen, and it
is the *same component*, not a cut-down copy.

### The homepage is chosen by CSS, and that is a hydration decision

`scripts/prerender.mjs` writes real server-rendered markup into `#root` and
`main.jsx` hydrates onto it. A width-dependent **branch** cannot survive
that: the server has no `window`, so it renders the desktop tree, and a
phone's first client render disagrees. React patches a mismatch by
re-rendering the subtree — which on a phone is one visible frame of desktop
layout before the phone one replaces it, which is exactly what the prerender
exists to prevent.

So both trees are prerendered and `sm:hidden` / `hidden sm:block` picks
between them. **The cost is real and is named in the file**: the desktop tree
still MOUNTS on a phone, because CSS-hidden is still mounted — the rule
`useMinWidth` exists for, arriving from a new direction. That is the same
work today's homepage already did on a phone, so nothing got slower; it
simply did not get faster. If it ever needs to, the fix is to prerender two
documents, not to move this back to a hook.

**The Draft Room does not have this problem and uses a hook.** `DraftRoom` is
its own React root, mounted into `#draftroom-root`, which the prerender never
touches — so `usePhoneWidth()` is free there and always was.

### The floating nav pill, and the clearance that came with it

`MobileAppTabBar`'s flush, edge-to-edge bar became
`phone/FloatingNavPill.jsx`: detached, blurred, floating above the safe area.
A bar welded to the bottom edge sits in the same visual layer as the
browser's own toolbar and reads as furniture; a floating one reads as the
app. The old file is a **re-export**, so there is still exactly one nav to
change when a tab is added.

**A `fixed` pill costs the page no layout height, so nothing under it gets
clearance for free the way a flush bar's own height gave it.**
`NAV_PILL_CLEARANCE` is exported for that reason and every screen that
scrolls under the pill reserves it. Reserving it in the Lobby's scroll
container *as well* would double it on the phone screen and leave the desktop
dashboard padded for a bar that is `sm:hidden` — so the clearance moved onto
the screens themselves.

### Behavioural hooks, because labels keep moving

Three `data-*` attributes were added purely so tests stop breaking on copy:
`data-start-draft`, `data-hero-eyebrow` and `data-pick-code`. Each one exists
because a rename failed a test about something else.

- The start button has been called "Enter Draft Room", "Start draft", "Start
  mock draft" and now "Start a mock draft". `phone.spec.mjs` carried a regex
  of every previous name and missed the fourth by one word.
- The hero eyebrow was found by matching the slogan's own words. That broke
  once on case (the text is uppercased in CSS and title case in the source)
  and again when the phone homepage drew it as a `<p>` with an icon rather
  than a bare `<span>`.
- The pick code was found by `span.font-plex`, on the strength of a comment
  saying that class "names nothing else on a card" — true until the matte
  redesign made the position abbreviation mono too, which doubled the count
  and reported 86 codes against 43 picks.

**None of those three tests was about the thing that broke it.** An attribute
says what an element IS; a class or a label says what it currently looks like
or reads. Anchor on the first.

## The matte position palette

The six position hues are unchanged — QB orange, RB emerald, WR blue, TE
fuchsia, K gold, DST indigo. What changed is that all three renderings of a
position are now **one hue at three lightnesses**, where they used to be a
Tailwind stock scale and two separate hand-picked hex maps.

- **`POS_MATTE`** — the flat pastel a board cell is painted with. Dark ink on
  top, never white.
- **`POS_MATTE_INK`** — `#0E1116`, the only ink a matte fill may carry.
- **`POS_SOLID`** — the same hues darkened by lightness alone until white
  clears 4.6:1, for the places that carry white type.
- **`POS_BADGE`** — literal Tailwind classes naming the new `pos-*` tokens in
  `tailwind.config.js`, which are the identical hexes as `POS_MATTE`.

**The drift this ended was invisible by construction.** `POS_BADGE` named
`orange-500`/`orange-300` while `POS_SOLID` carried a hand-picked hex, so a
position wore two colours that only looked related — and a tint and a solid
are never side by side long enough to compare. `shareCard.js` had a third
copy, as hex, with a comment arguing that a canvas cannot read a class name
so a commented copy was "the honest option rather than pretending there's a
shared source." The premise was wrong: it is a module in the same bundle and
can import the map. What it cannot read is the *Tailwind theme*, which is a
different thing. The copy had already drifted.

### The board cell inverted, and everything on it had to invert with it

The cell was `POS_SOLID` at 14% alpha. It was diluted because a colour dark
enough for white text is far too heavy to paint 140 cells with — so six hues
read as six tints of the same charcoal. A matte pastel with near-black ink is
the opposite weight and needs no diluting.

**Which means every mark on the cell moved to the other end of the value
scale.** The name, the pick code, the club and the arrow are `POS_MATTE_INK`
rather than white; the ADP delta is dark green/red rather than brand
teal/rose; the injury dot carries its own `onMatte` value because
`INJURY_META`'s `dot` is a light value built for a dark panel (amber-400 on
the gold K fill is very nearly invisible). **A light-on-dark mark left behind
on a light fill does not throw. It just becomes unreadable.**

**Solve against every fill, not an average, and not to the bar itself.** A
colour drawn on a per-player background has to clear all six — the "every
stop in a gradient must clear white on its own" rule in a new shape. The
first pair of value colours was solved to exactly 4.5 and the model said 4.53
worst case; **measured on the real rendered board, with transitions killed
and ancestor `opacity` composited, it came back 4.37.** The browser is the
authority. The lesson is not to distrust the model but not to spend its
entire margin: solve past the bar so a small disagreement cannot cross it.
Both values are solved to 5.0 now and measure 5.37 worst case in a browser.

The same happened to the meta line: 0.55 alpha read correctly as secondary
and measured 3.22, 0.72 cleared by six hundredths, and it is 0.78 now.

### The gold ring needed its keyline back, and a test said so in advance

`board-marks.spec.mjs` carried this comment against the assertion that the
board's ground is dark in both themes: *"if this ever stops being true, the
pair has to come back and this is the line that says so."* It was written
about a hypothetical light theme. What actually falsified it was making the
**cells** light while the ground stayed dark — a direction that assertion
could not see, so it would have gone on passing while gold measured **1.06**
on a real card.

The React board's single gold edge is a gold-then-keyline pair now, the
identical construction `style.css`'s own `.board .cell.mine` has always used.
Measured: gold clears 10.45 on an empty cell and 1.02–1.55 on the six fills;
the keyline `#0B1017` clears 8.53–12.91 on the fills and 1.27 on an empty
one. Exact complements, so one half always has the surface, and the two clear
each other at 13.23.

**Box shadows paint first-on-top, so the 2px gold is listed before the 3px
keyline** — the keyline's own outer 2px is covered by the gold and what
remains visible is the 1px just inside it. Swap the order and the keyline
covers the gold entirely.

**And the test now measures the pair rather than half of it.** It asserted
`ratio(gold, surface) >= 3`, which was right when every filled cell was dark
and is measuring half a mark now. It takes `max(gold, keyline)` against each
surface, plus the two against each other.

## Draft types are real, and the engine takes a config

`draft-engine.js` accepts a **config object anywhere it took a bare `teams`
number**, and one function decides whether a round runs backwards:

- **linear** — never. Every round runs seat 1 to seat N.
- **snake** — even rounds.
- **snake + third-round reversal** — rounds one and two are an ordinary
  snake, round three repeats round two's direction instead of flipping back,
  and it snakes normally from there. So from round three on the parity is
  inverted: `round >= 3 ? round % 2 === 1 : round % 2 === 0`.

**A bare number still means a plain snake**, which is not backwards
compatibility for its own sake — it is what lets a caller holding only a team
count ask for a pick code, and what keeps every existing call site in
`app.js`, `room.js` and the worker correct rather than quietly drawing round
three the old way. **Pass the league object wherever the ORDER matters.**

**`round % 2 === 0` is no longer a legal direction test anywhere.** It was
inlined in `boardArrow()` on both boards, and it is right for a plain snake
and wrong for the other two — a board asked for a team count alone draws
confident arrows pointing the wrong way on cells whose pick numbers are
simultaneously correct. That is the seat-versus-pick-number bug exactly: two
right numbers side by side disagreeing. `DraftEngine.reversedRound()` is
exported so nothing has to re-derive it.

**Auction is listed in `DRAFT_TYPES` and marked unavailable, deliberately.**
It is not a setting — it is a second draft mode end to end (a budget per
team, a nomination order, live bidding, a bid clock, and a CPU that values a
player in dollars rather than in board position). A control that silently ran
a snake draft under an "Auction" label would be a whole wrong product behind
a right label. It is listed rather than hidden because a settings screen
showing two options where the category has three tells a visitor the product
does not know about the third.

### Three more things the league now carries

**`playerPool`** — all / rookies / vets, read off Sleeper's own `years_exp`,
which is already `exp` in `stats.js` on every matched player. No pipeline
change and no second source. **A player with no `exp` is kept in BOTH
filtered pools**: 27 board rows have no stats record, team defenses have no
years of experience, and a defense is neither a rookie nor a veteran in any
sense a drafter means. Dropping them would leave a league that starts a D/ST
with no legal pick for the slot. `undefined` is missing, and missing is not
evidence of anything — the other half of "treat `0` from an API as missing".

The filter lives inside `adpSet()`, so `poolSize()` and therefore
`setupProblem()` validate against the array `buildBoard()` will actually map
over. There are 38 rookies on a 232-player board, so rookies-only is a
three-round draft; the settings screen prints the count beside the control
rather than letting the Start button refuse with the reason nowhere near the
cause.

**`superflex`** is a scoring preset that is not a scoring format. It draws
full PPR's ADP set — FFC publishes three sets and none of them is superflex —
and what it actually changes is `league.superflex`, plus the round that has
to come with it. `SCORING_PRESET` carries a `note` saying so on screen,
because a superflex board genuinely underrates quarterbacks and a drafter is
better off being told than finding out in round three. `ADP_FORMAT` maps a
preset to a set through a named function rather than indexing `ADP_SETS`
directly, so a new preset with no entry is a preset nobody decided the board
for, rather than one silently falling through to the default.

**`cpuAutopick`** — whether a human seat whose clock runs out gets drafted
for. This has always happened and was never a setting. Off, the clock reaches
0:00 and the seat stays yours. **CPU seats are untouched in both states**:
they are not users running out of time, and a room that stops moving because
a setting about humans was switched off is a deadlock.

## The Draft Settings screen

The three-tab modal (Roster / Scoring / Seats) is the whole settings screen
now — draft name, draft type, third round reversal, scoring, teams, available
players, time per pick, CPU autopick, roster construction, draft order, and
the scoring-rule editor folded away at the bottom.

**One component at every width**: a full-screen sheet below `sm`, a centred
modal above it. A second copy of ten sections is the "written down twice"
rule in markup and it drifts the first time one of them changes.

**Save is a dismiss, not a commit.** Every control writes through to the one
real `league` the moment it is pressed, because that is what keeps the board,
the summary line and `setupProblem()` agreeing with the screen while somebody
is still reading it. What Save genuinely guards is that refusal, which it
reports in place instead of closing onto a Start button that will not press.

**Draft order stopped being a dead control.** Its solo branch was a read-only
list with a paragraph explaining there was nothing to do. It takes a seat and
randomizes now, through `setMySlot()`/`randomizeOrder()`, which refuse in a
room — where the same section is the host's real seat-swap and goes through
`swapSeats()` because the room is the thing that decides. **Randomising solo
moves one seat, not the whole array**: the other chairs are CPUs drafting to
one rule, so permuting them changes nothing anybody can observe, and a
shuffle of the whole list would be a lie dressed as a feature.

**`shapeExtras()` prints only what is not the default.** A summary listing
every setting is a settings screen with worse formatting; a summary listing
none of the unusual ones lets somebody sit in a linear rookies-only draft
under a header reading "10 teams · 14 rounds · Half PPR".

## The phone draft room's own controls

**A crosshair, not an auto-follow.** The board is a real scroller in both axes
and nothing ever pulled it back to the live pick. It centres the current cell
in the board's own scroller — `getBoundingClientRect()` differenced against
the scroller's, never `offsetTop`, and it returns early when already within
4px, both of which are hard-won rules this file already records for the
legacy board. It is a **counter** prop rather than a boolean, because
pressing it twice in a row has to scroll twice.

Deliberately not an automatic follow: that is a bug this project has already
shipped and removed once, where a reader was pulled back to the live pick two
or three times a second for as long as they kept trying to look elsewhere.

**The auto-pick ribbon lives inside the header**, drawn only when auto-pick is
on. Everything on that screen is `fixed` and stacked by hand — the board is
pinned to the header's height and the sheet's ceiling is measured from it —
so a ribbon as a separate fixed element would need both of those to know
about it independently.

**And the header measures and reports its own height.** It was a hardcoded
106, which is only right on a device with a notch:
`pt-[env(safe-area-inset-top)]` is 0 everywhere else, so the real header is
about 65 and **the board started 41px below where the header ended**. Found by
looking at a screenshot, not by anything failing. A `ResizeObserver` rather
than a read at mount, because the height genuinely changes while the screen
is up — the ribbon appears and disappears with auto-pick.

### The bottom sheet: nearest-snap was the wrong question

The collapsed snap was 188px, which is a shorter sheet still covering the
last four rounds of a fourteen-round board — and those are the rounds
somebody swiping the sheet down is trying to see. It is **58px** now: the drag
handle and the tab row and nothing else. The safe-area inset is padding
*inside* the sheet rather than folded into that number, or it double-counts
on the devices that have one.

**Release asks three questions in order, and each exists for a gesture the
next one gets wrong.** The snaps are 412px apart, so nearest-snap-by-distance
meant a decisive 84px swipe down released 328px from collapsed and went back
where it came from — measured, doing exactly the gesture the reference app
collapses on. The sheet was not ignoring small movements, it was ignoring
most real ones.

1. **Flicked** (above 550 px/s): direction is the whole message, distance is
   irrelevant. One snap that way.
2. **Travelled** past 56px in one direction: land on the nearest snap, but
   never back on the one it started from.
3. **Otherwise** nearest, which for a small movement is where it started — so
   an accidental nudge springs back.

Together those produce all three behaviours without special-casing any of
them, and the release velocity is carried into the settle spring rather than
starting a fresh one from zero.

**A stale closure was a real hazard here.** "One snap from where this gesture
started" cannot read `snapIndex` off the prop the handler closed over; it is
a ref, for the same reason the settings modal's seat swap already uses one.

## The gear menu, and notifications that do something

The kebab dropdown is a bottom **action sheet** below `sm` and the anchored
dropdown above it, from one array of items — a phone-specific copy of the
list is the thing that ends up missing an item after the next change.

**Pause is back, which reverses a decision recorded here.** It was cut with
Undo and "Auto-draft the rest" by a product review that found all three
buried in a kebab menu and reasoned a mock draft does not need them. The
argument was about the menu rather than about the control: a list you reach
by pressing a gear, that reads like a list of things you can do to this
draft, is exactly where somebody looks for Pause. Undo and auto-draft-the-rest
stay gone, still for their own reasons.

**"End draft" is not the header's X.** The X steps away and keeps the draft
resumable; End draft finishes it — the remaining picks are drafted, it is
recorded and graded like any completed draft, and you land on the report with
it in the locker. Two controls meaning "back to the Lobby" in different words
is the duplicate-affordance problem. The confirm says the pick count out
loud, because "End draft" does not on its own tell anybody that 137 picks are
about to happen. **Never offered in a room**: "the rest" there is other
people's teams.

### Notifications are the Notification API, not a stored preference

The obvious cheap version is two switches over `localStorage` that do
nothing, and that is the dead-control failure this project has shipped once
already — worse here, because somebody turns a notification toggle on and
then trusts it.

The point is one moment: your pick arrives while the tab is not the one you
are looking at, which is precisely when the sound cue and the header turning
teal reach nobody. There is no push service and none is needed — the page is
open, it is just not in front.

Three things it will not do, each the difference between a useful
notification and one that gets the permission revoked. **It never fires while
the tab is visible.** **It fires on the CHANGE, not the state** — `myTurn` is
true for hundreds of renders per turn, the same shape `soundCue()`'s own
comment already records. **It replaces rather than stacks**, one `tag` per
kind.

**Draft mentions watches the room's own `chatStream()` and needs a priming
pass.** Joining a room hands you the whole existing chat log at once, so
without one, every mention from before you arrived fires on connect. It
tracks the newest message **by id, not by count**: the chat log is bounded in
lines and bytes and drops old messages off the front, so a length comparison
would go quiet the moment the log started rolling — silently, and only in the
long drafts where somebody has most likely stopped watching the tab.

**Three states the screen reports rather than assumes**: no API at all
(iOS only has it for an installed site, and the note says so), permission
denied (which Juke cannot undo from here, so it says that instead of offering
a switch that points at itself), and granted.

## The phone Lobby is a launcher, and the dashboard is a press away

The desktop Lobby is a real analytics dashboard — three KPI tiles, a
twelve-cell tendencies grid, a recommendation engine, a heatmap and a history
table. On a 390px phone all twelve cells stack into one column and the button
the screen exists to offer ends up past the fourth chart.

`MockDraftsPhone.jsx` is what `#/drafts` is below `sm`: start, resume, and
what you have already run. **Nothing is lost.** "Your insights" mounts the
identical `DraftLocker`, and a history row opens that component's own report
path through a new `initialAnalyzeId` prop rather than a second entry point —
the frozen-report-first path is the whole reason a reopened draft and the
grade it was recorded with cannot disagree, and skipping it would silently
reintroduce exactly that.

**`historySummary()` resolves a stored name against the LIVE board**, which is
how a name becomes a position and a headshot — and the board is empty until
`players.js` lands, which is deferred rather than blocking. Read once on
mount, every row came back with a null position and drew a grey dash where
its colour belongs: the names were right, because those are stored, and only
the resolved fields were missing. It reads the engine tick. **Anything that
resolves against `board` needs the same treatment.**

**An early return is a wall no hook may sit behind.** `DraftLocker`'s new
effect was placed after its own `if (!engine) return null`, so the hook count
changed between renders and React threw on the first press of the button that
mounts it. It is keyed on `engine` rather than `[]` for a second reason:
`analyze` is a const further down the same function, in its temporal dead
zone on exactly the render that early return takes.

## Security

The zone is set beyond Cloudflare's defaults, and the defaults were not
good enough:

- **SSL/TLS is Full (Strict)**, not Full. Full encrypts to the origin but
  validates nothing, so anything that can answer as GitHub Pages is
  accepted — Cloudflare's own warning says so.
- **Minimum TLS is 1.2.** The default is 1.0. Measured before changing it:
  1,680 requests on 1.3, 92 on 1.2, none below.
- **HSTS**, six months, no `includeSubDomains`, no preload. Preload is
  months to exit, so it is a decision for when there is something to lose.
- **A "Security headers" Transform Rule** sets `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` and the CSP. `X-Content-Type-Options`
  comes from the No-Sniff toggle in the HSTS dialog instead. GitHub Pages
  cannot set headers at all, so Cloudflare is the only place these can live.

**The CSP is enforced. Of Cloudflare's own two injections, one is allowed by
name and the other is blocked on purpose.** Driving the whole app against the
policy — player photos from sleepercdn, the ESPN scoreboard, the worker over
https and wss, a GIPHY image — produces zero violations, and always did. What
kept the policy report-only was Cloudflare injecting script into our pages,
and the two it injects end differently because they are different kinds of
script:

- **The Web Analytics beacon is an ordinary external script,** so the host
  goes in `script-src`. Allow `https://static.cloudflareinsights.com`, the
  bare host — **not the path Cloudflare's own docs give you.** The real `src`
  is `beacon.min.js/v4513226c…`, a version segment *after* the filename, and
  a CSP source whose path does not end in `/` has to match exactly, so
  `…/beacon.min.js` matches nothing at all. The beacon reports to
  `/cdn-cgi/rum` on our own domain, which `connect-src 'self'` already
  covers; the `cloudflareinsights.com` connect host in the docs is for sites
  that embed the beacon by hand.
- **The bot-detection script is inline,** so no host can allow it, and it
  cannot be hashed either: the body carries `r:'<cf-ray>'`, unique per
  request, so the hash the console helpfully offers is stale before you can
  paste it. It has no nonce for the reason below. So it is **blocked, on
  purpose**, and the only cost is console noise wherever a browser reports it.
  Nothing else: the script never runs, `window.__CF$cv$params` is undefined
  after load, and no part of the app has ever depended on it. The alternative
  was `'unsafe-inline'` in `script-src`, which would hand any injected chat
  message the run of the page — the single thing this file is most arranged to
  prevent. A line in a console nobody but us opens is a much smaller price.

**The blocked script is doing nothing anyway, and that took two toggles to
establish.** Bot Fight Mode is **off** and JavaScript Detections is **off**,
both under Security → Bots — and the injection continues regardless. Turning
off JavaScript Detections alone changes nothing, because Cloudflare's own docs
say "for Bot Fight Mode customers, JavaScript Detections is automatically
enabled and cannot be disabled". Turning Bot Fight Mode off as well should
have ended it, and did not: the free plan is currently injecting the script
with both switches off and the card still reporting "JS Detections: On". That
is a Cloudflare bug with open community reports, not a setting anybody missed.
So the script we block is a leftover of a feature that is switched off. When
Cloudflare fixes it the two console errors disappear on their own, and nothing
here needs changing.

**A nonce cannot rescue that, and the reason is circular.** It looks like it
should work, and the usual objection does not apply here: a nonce normally has
to reach the script tags too and a Transform Rule cannot touch the body, but
every script on our pages is an external `src` from `'self'` and wants no
nonce, so the header would be the whole job. Cloudflare does parse the CSP it
is about to send and stamp the value onto its own injections. It was tried, as
a dynamic header value, and `uuidv4(cf.random_seed)` did produce a fresh nonce
per request:

```
concat("… script-src 'self' 'nonce-", uuidv4(cf.random_seed), "' https://static.cloudflareinsights.com; …")
```

The injected `<script>` came back with no `nonce` attribute on it at all. Bot
detection injects **before** response-header Transform Rules run, so there was
no header yet to read a nonce out of. Cloudflare's propagation works on a CSP
the *origin* sent — and our origin is GitHub Pages, which cannot send headers,
which is the whole reason the CSP is a Transform Rule. A `<meta>` CSP is not a
way out either: Cloudflare documents JavaScript Detections as unsupported with
nonces set that way.

**Change the value before you change the header name.** Put a new value on
`Content-Security-Policy-Report-Only` first and reload: an empty console is
the only evidence worth having. Only then rename the header. Enforcing first
and reading the console afterwards learns the same fact far too late — and
this is exactly how the nonce turned out to be worthless, cheaply, instead of
expensively.

**Keep it enforceable.** No inline `<script>`, no `onerror=` or other inline
handlers — that is why the theme switch is `theme.js`, why avatars use
`data-drop-on-error` and a captured listener, and why back-to-top takes
`data-auto` instead of a one-line call. `style-src` does allow
`'unsafe-inline'`, because inline `style` attributes are everywhere and style
injection is a far smaller problem than script injection.

**The worker refuses, it does not just withhold.** CORS headers tell a
browser whether to let a page read a response and do nothing about the
request being made — `curl` with a made-up Origin drank the GIPHY quota
happily. `originAllowed()` returns 403 before the key is touched. Forty
actions per socket per ten seconds are allowed, which is far above a real
draft and far below a script; a flood is refused, never disconnected,
because a client with a runaway loop should lose the message and not the
draft. Limiting *room creation* is not done and belongs on the edge, not in
the room.

**Never sort `board` in place.** `DraftEngine.jitter()` reads a player's
position in it, so the order of that array is an input to what every CPU
does — and in a room, every client has to agree on it. Sorting it to draw a
table would change the draft, and change it differently depending on which
column somebody clicked. `sortedPlayers()` sorts a copy, and the filter
before it already returns one.

**A missing number is not a small number, and sorting is where that bites.**
Ascending "rushing yards" must not open with two hundred players who have no
rushing projection at all. Blanks go last in both directions.

**Sleeper shows a TAR column their own projections do not fill** — it reads
0 for every player, Bijan and Ja'Marr included. We show REC instead, which
is projected, is what PPR actually scores, and is a number rather than a
zero. Copy the layout, not the gap in it.

**`display: flex` on a `<td>` stops it being a table cell.** It no longer
stretches to the height of its row and sizes to its own content, so its
bottom border lands above everybody else's — a step in the divider starting
exactly where that column does. This was `.rowacts` for months. Lay a cell's
contents out with inline-block, or wrap them in a div and flex that.

**A sticky table cell needs `border-collapse: separate`, and no
`overflow: hidden` on the table.** With collapsed borders Chrome accepts the
rule — the computed style says `sticky` — and scrolls the cell away anyway,
because the table owns the borders. `overflow: hidden` (there to clip a
corner radius) makes the table its own scroll container, so the cell sticks
to the table rather than to `.tblscroll`. The player grid overrides both.
Collapse also overrides an explicit cell width, which is how the pinned name
column ended up offset against a rank column that was not the width it had
been told to be.

**`offsetTop` is not a distance to the scroller.** It is the distance to the
nearest *positioned* ancestor, and nothing between a board cell and
`#boardScroll` is positioned — so `scrollBoardToLive()` was reading a figure
measured from `<body>`, 207px too large. One mistake, two symptoms that
looked unrelated: the board sat about four rounds past the live pick, because
207px is roughly four rows; and it twitched on every CPU pick, because
anything above the board changing height — the ticker arriving, the header
turning blue for your turn — moves the board down the page, which moved a
number that was never supposed to be about the page. Both went away by
measuring `getBoundingClientRect()` against the scroller's own rect. Do not
"fix" this by adding `position: relative` to the scroller; that makes
`offsetTop` correct today and silently wrong again the next time someone
changes positioning.

**Do not re-ask for a scroll you are already at.** `render()` rebuilds the
board on every change, and `scrollTo({behavior:"smooth"})` starts an
animation whether or not the target moved. During a run of CPU picks that is
a new animation every few hundred milliseconds. `scrollBoardToLive()` returns
early when the target is within 4px of where it already is, which is what
takes the board from "moves constantly" to "moves once per round".

**`:last-of-type` counts element types, not classes.** Every child of the
board grid is a `div`, so `.cell.mine:last-of-type` matches the last cell on
the board and only helps when the bottom-right chair happens to be yours. For
"the last one matching this class", use `querySelectorAll` and take the end.

**`scrollBy({behavior})` beats the stylesheet.** A `prefers-reduced-motion`
rule on the container does not apply to a programmatic scroll that asks for
`smooth`, so the score arrows check the media query themselves.

**Inline SVG needs explicit `width` and `height` attributes**, not just CSS.
A cached stylesheet once let the logo expand to fill the entire screen.

## Testing

- **"Local wrangler crash-loops on this machine" was never true, and it cost
  a day.** It was carried across sessions as a known fact, quoted as the
  reason the room suite could not be run locally, and repeated in a commit
  message. Wrangler starts fine and always did: `Ready on
  http://127.0.0.1:8787`, and `worker/test-sockets.mjs` passes its 87
  assertions against it. Three unrelated things were being read as one
  symptom.

  **An orphaned `wrangler dev` outlives the run that started it.** Kill a
  Playwright run, and its `webServer` children keep going — one was found
  still alive and still respawning `workerd` several hours later. The next
  run then finds port 8787 occupied, and `reuseExistingServer` adopts the
  zombie, so you are testing against whatever that process was started with.

  **`pkill` from Git Bash does not reach these processes.** It reports
  success and kills nothing, so cleanup that looks done is not, and the
  measurement afterwards is against the thing you thought you had stopped.
  That produced a confidently wrong result mid-diagnosis: an "is a stray
  server rejected?" check that passed because a surviving worker was quietly
  answering for it. Use PowerShell — `Get-Process workerd | Stop-Process
  -Force`, plus the `node.exe` whose command line contains `wrangler`.

  **And the flood of `Uncaught Error: Network connection lost.` was a
  browser tab.** A tab left on a room invite reconnects on a backoff, because
  `live.js` is built to; every attempt was one line in the log. The log
  stopped growing the moment the tab was navigated away. A repeating error is
  not evidence of a loop in the thing printing it.

  **The lesson is the one this file keeps arriving at from new directions.**
  Every check that mattered here was one command — which process holds the
  port, what is its parent, does the log still grow. None was run for a day,
  because the conclusion was already written down. **A diagnosis inherited
  from an earlier session is a claim, not a fact**, and the older it is the
  more it deserves the two seconds it takes to re-check.

- **A single-socket send has to be wrapped, the same as a broadcast.**
  `send()` and `relay()` always caught a dead socket; `reject()` and the two
  other per-socket sends did not. That is backwards — a refusal is sent
  milliseconds after the upgrade, to a client that had a reason to give up,
  so it is the path *most* likely to find the socket already gone. Every
  attempt threw an uncaught error inside the Durable Object, which is not
  free: it fills the log the next real fault has to be found in. `tell()` is
  the guarded single-socket send now. Measured: twelve connect-and-drop
  refusals produced twelve uncaught errors before, and none after.

  Two still appear when Playwright force-closes a browser mid-upgrade. That
  is a client vanishing between `accept()` and the response, it is not a
  loop, and it has not been chased further.

- **The worker's `webServer` entry checks identity, not occupancy.** With
  `port: 8787`, `reuseExistingServer` accepts anything listening — during one
  session it adopted a `python -m http.server` as the draft room, and the
  suite then tested a static file server. It uses
  `url: "http://127.0.0.1:8787/news?id=1"` instead: our worker answers **403**
  there (`originAllowed()` refusing before the key is read) and Playwright
  counts 400–403 as ready, while a stray server answers 404 and is refused.
  Verified in both directions, which is the only way a check like this means
  anything.

- Room over sockets: `cd worker && wrangler dev --port 8787 --local`, then
  `node worker/test-sockets.mjs` in another terminal. Seventy-six assertions
  against the real Durable Object runtime, no Cloudflare account needed.
  This is the only thing that covers sockets, storage, the alarm and the
  messages that never reach storage at all — typing is relayed, so a suite
  that only inspects state cannot see it. The room logic itself is pure and
  covered below. `npx --yes wrangler@4 dev …` works if wrangler is not
  installed globally and leaves nothing in the repo.

  **It is also the only thing that checks the adapter passes the sender
  through.** `test_engine.py` proves `Room.pause()` refuses a guest, and that
  proof is worthless if the worker calls it without a member — which is
  exactly what it did, undetected, for as long as `pause` existed. A host
  check the adapter never gives a member to is not a check, so the host-only
  messages are asserted here, over a socket, and not only against the pure
  room. Anything gated on *who sent it* belongs in both suites.

  Run it against production after a deploy, too:
  `JUKE_WORKER=wss://juke-draft-room.jukeff.workers.dev node worker/test-sockets.mjs`.
- Engine: `py scripts/test_engine.py` — runs `draft-engine.js` and `room.js`
  outside a browser and asserts the snake maths, the turn order, the legality
  checks, the determinism of the CPU wobble, and the parts of a room that a
  person types into: name cleaning, renaming, reaction privacy and the two
  bounds on the chat log. It needs node, deno or bun on PATH
  and says so plainly if none is there rather than looking like a failure.
  Node is installed user-scope via winget, so a new terminal sees it and an
  already-open one does not.
- Stylesheet: `python scripts/check_css.py` — brace depth through
  `style.css`. Two lines of output and it takes no arguments; run it after
  moving a block. Counting braces does not do this job and demonstrably
  passed a broken file twice.
- Crosswalk: `python scripts/test_crosswalk.py` — the source-id join against a
  handful of players, including two Josh Allens, a collision and a player
  neither side shares; the nflverse join with its two-way player and its
  `LA`/`LAR` case; the audit applying both known definitions and mutating
  nothing; and `check_app_rules()` against the real `app.js`.
  Needs nothing but the standard library. **It cannot reach `app.js`'s rule
  tables except through `check_app_rules()`** — `test_engine.py` is the only
  suite with a JavaScript host and it loads `draft-engine.js` and `room.js`,
  never `app.js` — which is why that guard lives in the build rather than
  here.
- Pipeline: `python scripts/build_players.py` — prints counts and writes the
  generated files. Check `unmatched.txt` afterwards. **`TANK01_KEY` in the
  environment is optional**: without it the crosswalk is skipped, the build is
  otherwise identical, and news stays off. On Windows run it as
  `py scripts/build_players.py`. A bare `python` reaches the Microsoft Store
  stub and fails with "Python was not found" unless the installer's
  "Add python.exe to PATH" box was ticked, which it usually isn't.
- App: `cd web && npm run dev`, or build and serve `web/dist` over any
  static server. Opening a file directly no longer works — see the Stack
  section on why `file://` broke once the legacy scripts became
  root-relative.
- **This checkout is regularly open in more than one Claude session at once,
  and every whole-tree git command is a hazard because of it.**

  Four incidents in one night, none of which reached production and all of
  which cost time:

  - `git add -A` swept **41,379 lines** of another session's untracked
    `src/data/ep_weekly_*.csv` into an unrelated commit. Caught on the stat
    line before pushing.
  - `git stash push -- web/src` took another session's in-flight edits with
    it. The pop restored them, but that was luck: the same trick lost this
    session's own `DraftInsightsDashboard.jsx` edits an hour later.
  - Another session's `b057176` "Sitewide font consistency" **committed and
    pushed this session's uncommitted React work**, because it staged the
    whole tree too. The grade-visual change is now recorded under a commit
    titled about fonts.
  - A `vite dev` started before another session edited `tailwind.config.js`
    served CSS generated from a config that no longer existed — see the
    Tailwind note below.

  **`.claude/hooks/block-whole-tree-git.py` now refuses `git add -A`,
  `git add --all`, `git add .` and the writing forms of `git stash`**, wired
  as a `PreToolUse` hook in `.claude/settings.json`. `git stash list` and
  `git stash show` still work, because reading is how you find out what a
  previous session left behind. Nothing else is blocked.

  Two things about it worth knowing before changing it. **It is Python, not
  the usual `jq` one-liner, because `jq` is not installed on this machine** —
  a hook written against a missing binary does not fail loudly, it simply
  never fires, which is the worst possible outcome for a guardrail. And it
  **fails open**: unparseable input exits 0 with no output, because a guard
  that blocks work when it cannot read its own input is worse than the hazard
  it guards against.

  **The hook is a backstop, not the fix.** The fix is that a second session
  should work in a worktree — `.claude/worktrees/` already holds four, so the
  machinery exists and simply was not used. Stage explicit paths, never the
  tree, and restart any dev server after another session touches config.

- **A long-lived `vite dev` does not reload `tailwind.config.js`, and the way
  it fails looks like a design regression rather than a stale server.**

  Reported as sharp white borders around a dozen homepage elements, and it
  was neither white nor a border anybody had written. `border-line-hairline`
  resolves through `colors.line.hairline`, and when that token is missing from
  the config the *generator has already run*, so the utility contributes no
  colour rule at all — only the `border` width — and the colour falls through
  to Tailwind's own preflight default, `#e5e7eb`. Measured: **31 elements
  computing `rgb(229, 231, 235)` where the token says `rgb(37, 41, 48)`.**

  Nothing was wrong with the page. The server had been up since before another
  session added those tokens, so it was serving CSS generated from a config
  that no longer existed on disk. Stopping and restarting it took the count
  from 31 to 0.

  **Ask the deployed stylesheet before hunting through commits.** The built CSS
  names every utility it generated, so one request settles whether the token is
  real:

  ```bash
  curl -s https://jukeff.com/assets/index-<hash>.css | grep -o "border-line-hairline{[^}]*}"
  ```

  It came back correct on the first try, which turned what looked like a
  thirteen-commit bisect into a two-minute answer.

  **This is the fourth time in this file that the tooling has worn a bug's
  clothes**, after the wrangler crash-loop, `startDraft()` not clearing
  `state.picks`, and a `git stash` in a shared checkout. The tell is the same
  every time: the symptom is real, reproducible, and describes a fault in
  something nobody changed. It is most likely here whenever two sessions share
  the repository, because design tokens are exactly what the *other* session
  edits while yours has a server up — so restart the preview after any change
  to `tailwind.config.js`, whoever made it.
- **In a headless or hidden browser, disable transitions before you measure
  a colour.** A pane that is not compositing produces no frames, so a CSS
  transition never advances — it sits frozen at its starting value, and
  `getComputedStyle` reports that old value indefinitely. It does not look
  like an artifact. It looks like a bug, with a plausible cause.

  It manufactured two in one session. `.room` has `transition: border-color`,
  so removing the `live` class left the border reading teal forever and
  looked like a specificity problem. `.appbar` has `transition: color`, so
  the my-turn header reported `--ink` rather than `#fff` and a rule was
  nearly added to "fix" a headline that was already white.

  `document.head.appendChild` a `* { transition: none !important }` style,
  measure, then remove it. And note that `requestAnimationFrame` never fires
  in such a pane either, so anything awaiting one hangs until the tool times
  out — `setTimeout` still works.

  The same pane cannot take screenshots, which is worth saying plainly:
  **everything above can be verified this way and none of it is a substitute
  for looking.** A grade can be correct and unbelievable; so can a colour.
- **Point the same suite at what is deployed, after deploying it.**

  ```bash
  JUKE_SITE=https://jukeff.com \
  JUKE_WORKER_HTTP=https://juke-draft-room.jukeff.workers.dev \
  npx playwright test tests/room.spec.mjs
  ```

  The socket suite has had `JUKE_WORKER` since it was written and this one had
  no equivalent, so the one thing nobody could run was the one thing worth
  running after a deploy: a full room draft against the real worker, over the
  real CSP, through Cloudflare. **Local is where a bug is found; live is where
  it is confirmed gone**, and they are not the same claim — the room deadlock
  at pick 86 was a rate limit that localhost is too fast to reach.

  The two variables move together. `live.js` picks its worker off the address
  bar — localhost means `127.0.0.1:8787`, anything else means the deployed one
  — so pointing the page at production while the assertions watch a local
  worker tests two rooms and reconciles neither. `webServer` is skipped
  entirely when the site is not local, because waiting on a port nobody will
  listen on times the run out before it starts.

  `SITE` and `WORKER_HTTP` live in `tests/helpers.mjs` and are re-exported by
  `playwright.config.mjs`. They used to be declared in both, which is the same
  fact in two places and would have failed as a suite quietly testing a server
  nobody was running.

- **A test that asserts an absence cannot be pointed at production.**
  `news.spec.mjs` has one — with no provider key the panel and the tab stay
  hidden — and the deployed worker has a key, so aimed at production it **fails
  by succeeding**: the panel opens, the tab appears, and the run reports a
  regression that is really a configured provider. It was the only red in 87
  against the live site, and it is the worst kind of red, because a suite
  carrying a permanent known failure stops being read at all.

  It skips on `LOCAL_WORKER` now. **Verify a skip in both directions or it is a
  deletion.** A skip that fires everywhere is indistinguishable in the output
  from one that fires correctly — a dash and a test name — and the suite goes
  green having quietly stopped checking. Both were run: against production,
  1 skipped and 6 passed; locally against the keyless `wrangler dev` the suite
  starts itself, 7 passed.

  `LOCAL_SITE` and `LOCAL_WORKER` are two exports rather than one because they
  answer different questions. The config asks about the **site**, because that
  is what decides whether there are servers to start; this asks about the
  **worker**, because that is where the key lives. They move together in any
  sane run, and deriving one from the other would be the wrong fact answering
  the right question.

- **Do not pipe the run into `tee`.** A pipeline's exit status is the last
  command's, so `npx playwright test | tee log` reports **0 on a red run** —
  which is exactly what happened the first time this suite was pointed at
  production, and the failure was only noticed by reading the output. An
  exit code that lies is worse in verification tooling than anywhere else,
  because the whole point of the tool is to be believed. Redirect to a file
  instead, or `set -o pipefail`.

- **Regenerating `og-image.png` needs node, not a click.** The card is drawn to
  a canvas by `scripts/build_og.html`, which hangs the PNG off a download link.
  That works in a real browser and does not work in a headless or sandboxed one
  — the click lands a `.tmp` in Downloads that is cleaned up before it is
  renamed. Playwright runs in node and has a filesystem, so it reads the same
  data URL and writes the bytes: same artifact, no manual step, and no new
  dependency, because the test runner is already here.

  **Refuse to write if the face did not load.** `document.fonts.check` before
  reading the canvas — a share card silently generated in a fallback is worse
  than not regenerating one, because it looks finished and fails in somebody
  else's link preview.

  And read the PNG signature and dimensions back off the file afterwards. A
  byte count proves a file was written, not that it is an image.

- **This repository lives in OneDrive, and OneDrive puts files back.** It is
  already recorded for `desktop.ini`; it also happens to real assets. A freshly
  committed `og-image.png` was replaced by an older copy *after* the commit, so
  `git status` showed it dirty and the working file no longer matched the blob.

  The tell is the timestamp: the file's mtime was two minutes **older** than the
  commit. Nothing this side of a restore does that.

  It briefly looked like line-ending corruption and was not, which is the more
  useful half of the lesson. A CRLF filter would rewrite the `0D 0A` inside the
  PNG signature itself, and the signature was intact and the chunks walked
  cleanly to `IEND`. **Check the signature before blaming the filter.** The
  committed blob was correct throughout and so was the deployed card;
  `git checkout --` on the path was the whole repair.

- **CI is two workflows, and neither is a gate.** `tests.yml` runs the two
  Python suites on `pull_request` and on `push` to main — a floor, and it does
  not cover itself. `browser-tests.yml` runs the Playwright suite daily at
  12:30 UTC against the deployed site, which is a smoke alarm rather than a
  gate: it tells you the morning after something rots, and blocks nothing. The
  browser suite is still deliberately out of `tests.yml`. Three things follow
  that have each cost something:

  - **A pull request opened after its last push has no checks at all.** The
    workflow fires on the `pull_request` event, so a branch pushed first and
    turned into a PR afterwards shows `no checks reported` and sits there
    looking reviewed. The design pass was open for an hour that way, with 996
    lines of CSS and 598 of JavaScript that nothing had run.
  - **`update-players.yml` is unproven by any pull request.** It runs on
    `schedule` and `workflow_dispatch` only, so a change to it is not
    exercised until 11:00 UTC or until somebody presses the button.
  - **The browser suite used to rot, because nothing ran it on a schedule.**
    `browser-tests.yml` does now — 12:30 UTC daily, against `jukeff.com`,
    ninety minutes after the nightly commits new data and triggers its Pages
    build, so it tests the day's deployed site rather than racing the deploy
    that produces it. It is not a gate and is not in `tests.yml`: seventeen
    minutes is too heavy for every push, and the thing that was missing was
    never a gate but a *notification* — a scheduled failure emails the owner,
    which is what "red for days and nobody was told" needed.

    **It runs against the deployed site, not a local build**, which is what
    keeps the job to node and a browser: `playwright.config.mjs` skips its
    whole `webServer` block when the site is not local, so there is no web/
    build, no python static server and no wrangler beside it to break. It also
    covers the deploy — a promoted build that 404s its own content-hashed
    bundle is exactly this file's inverse caching trap, and no local run can
    see it. The cost is the one keyless news test, which skips itself against a
    keyed worker: **expect "1 skipped" every run and investigate its absence,
    not its presence.**

    The rot it exists to catch: `phone.spec.mjs` was found four-red on 27
    August, and every one of the four was a spec describing a screen the
    product had since changed —
    "Start mock draft" no longer stopping at a second "Start draft"
    (deliberately: the confirm step was removed), the entry screen becoming
    room-only, `Roster` leaving the tab bar for a pane inside Players, the
    still-to-fill block moving to Decide's own Team pane, and a `<span>`
    becoming a `<div>`. **Not one of them was an app bug.** They had been red
    for days and nobody was told, which is the failure — a suite that is only
    run by hand is a suite that reports last week's product.

    **The tell is the shape of the failure.** A stale spec fails by not
    finding something ("no button reading Start draft", "Cannot read
    properties of undefined") or by asserting an arrangement that has been
    deliberately improved. A real regression fails on a number that moved
    while the thing it measures still exists. Check which before changing
    anything, and check the app in a browser rather than reading the diff:
    three of these four looked like layout regressions in the output.

    **Anchor on behaviour, not on class strings.** The rewrites match the
    scroller by its computed `overflow-y`, the selected tab by either teal
    marker the two navs use, and a row by a name off the live board — every
    one of the four broke on a selector that described markup rather than
    the property under test.
  - **Pressing that button is not free.** The job rebuilds `players.js` and
    `stats.js`, commits if the feeds moved, rewrites every `?v=` and triggers
    a Pages deploy. It is a real data commit, so run it to answer a question
    worth a commit.

  **When bumping the action versions, the thing to check in this repository is
  `persist-credentials`.** `update-players.yml` ends in `git push`, and
  `actions/checkout@v6` changed where credentials are persisted — the default
  is still `true`, verified in v7.0.1's own `action.yml` and then verified
  again by dispatching the workflow and watching the push land. Read the notes
  for every major you skip, not just the one you land on: v5 was the node24
  bump, v6 moved the credentials, v7 blocked fork checkouts for
  `pull_request_target` and `workflow_run`, which this repository does not use.

- **End to end: `npm install` once, then `npx playwright test`.** Ninety tests
  across nineteen spec files, and it starts the static server and
  `wrangler dev` itself when it is pointed at localhost.

  Measured 27 August 2026 against production: **89 passed, 1 skipped, 0
  failed, in 16.4 minutes** on one worker. The skip is the news test that
  asserts an absence and correctly stands down against a keyed worker. This
  used to say "about five minutes", which was true of a smaller suite and is
  the kind of figure that drifts silently — hence the date, the same rule the
  Juke score section states about any number written down here.

  It drives the real pages in a real browser — a solo draft at both shapes, a
  full two-manager room draft to completion, a dropped socket reconnecting,
  leaving and rejoining, the phone layout, what the player sheet says about
  the Juke score, that every club's colour is drawn where no text can land on
  it, that a news payload cannot put script in the page, that the positions we
  refuse to rank are refused consistently, and — since the design pass — that
  the door is door-shaped rather than book-shaped, that a board cell is a
  card, what the draft header says, and that a claim on the landing page
  carries its proof.

  **The static server is `py` on Windows and `python3` everywhere else**, picked
  in `playwright.config.mjs` from `process.platform`. It was `py` outright,
  which is the Windows launcher and exists nowhere else, so on Linux or macOS
  the whole suite died with "py: not found" before a single test ran — a
  failure that looks like a broken harness rather than a missing interpreter.

  It is the only tool here that is not plain Python or plain JavaScript, and
  it earns that: everything it covers lives in the browser, so neither
  existing suite can reach any of it. `package.json` exists for this and
  nothing else — **the app still has no build step and no dependency**, and
  nothing under `node_modules/` is served, imported or needed to run the site.

  Three things about it worth knowing before changing it:

  - **A manager is a browser context, not a tab.** Contexts have their own
    `localStorage`, so their own `juke.member`. Two tabs share one id and the
    room is right to treat them as one person with two sockets.
  - **`state` is a top-level `const`, so it is not on `window`.** Waiting for
    `window.state` waits forever on a page that is working perfectly; refer to
    it unqualified, as the app's own code does.
  - **A test that changes the league has to open the League box first.**
    `page.selectOption` waits for the control to be visible and the setup
    controls sit inside a collapsed `<details>` now, so eight tests went red
    on `#teamCount` until `openLeagueBox()` went in front of them. That is
    the real journey, not a workaround — a person opens it too.

    `page.evaluate` does not care: `runSoloDraft` sets values through the
    DOM and `createRoom` calls `.click()` directly, so both still work on a
    control nobody can see. Which is worth knowing in both directions —
    it is also why a harness can pass a screen a person cannot use.

  When adding a test, check it fails against the bug it is meant to catch —
  put the bug back for one run. Every test in there was written against a real
  failure and confirmed to go red without the fix.

  **And disable the HTTP cache while you do it, or the answer is noise.**
  `app.js?v=` is a fixed address between deploys, which is the whole point of
  it — but a bug-back run edits `app.js` without touching the version, so the
  browser is entitled to serve the body it already has. Five mutations in a row
  came back failing all six tests, including tests the mutation could not
  possibly reach, and every one of those runs was measuring some mixture of the
  patched file and the cached one. It does not look like a caching problem; it
  looks like a suite with no discrimination at all.

  Launch with `--disable-application-cache --disk-cache-size=1` and set
  `Cache-Control: no-cache` on the context. Done that way each mutation flips
  exactly the property its own test asserts and nothing else, which is the
  result that means something. Same trap as the deploy note in the caching
  section, reached from the other direction.

- **A room draft has to be run to the end, with two clients, before anything
  touching a room is believed.** Solo drafts have been driven to completion
  since the beginning and a shared one never had been — which is how a room
  that deadlocks at pick 86 shipped, and why it took an unattended full draft
  rather than a bug report to find it. The two members need **two origins**:
  `localhost:8765` and `127.0.0.1:8765` have separate `localStorage` and so
  separate member ids, where two tabs on one origin are correctly treated as
  one manager with two sockets. Assert at the end:

  - 140 picks, 140 distinct players, 14 a team, snake order intact;
  - **no rejections on either socket.** This is the one that matters. Wrap
    `Live.pick`/`Live.autoPick` and listen for `type: "rejected"` — a room
    can be rejecting half of what a client sends and look perfectly healthy
    right up until it stops;
  - **the sum of what each client sent equals the picks on the board**, with
    every client's own-seat count matching its own picks. That single line is
    what proves nobody drafted for anybody else;
  - the gaps between picks. A median under 100ms is not a fast draft, it is
    a client in a loop, and it will find the rate limiter.

  Drive the second client from its **socket messages, not a timer**: a hidden
  tab has its timers throttled to about once a minute, and that is the
  harness stalling, not the app.

- Before claiming a change works, run a full simulated draft and confirm
  140 picks, no duplicate players, 14 per team, no kicker before round 13.
  Then run one at a different shape — 12 teams, 15 rounds, full PPR, **bench
  6** — and confirm 180 picks, 15 per team, one QB each and no kicker before
  round 14.

  The bench matters and this file used to leave it out. The default lineup is
  eight starters plus a FLEX plus five bench, which is fourteen roster spots,
  so fifteen rounds would draft a fifteenth player with nowhere to put him.
  `setupProblem()` catches it and the Start button refuses — correctly, and
  for several sessions this instruction quietly described a league the app
  will not run.

  **Drive it through the Start button, and assert `state.started` afterwards.**
  Calling `autoDraftRest()` straight from the console drafts a full board
  whether or not a draft was ever started, so a harness that skips the button
  will happily "pass" a configuration the app rejects — which is exactly how
  the missing bench went unnoticed. The picks it produces are real; the run
  is not.

  If the console reports an error naming something the source no longer
  contains, you are looking at a cached `app.js`, not a real failure. Hard
  reload, or serve the folder over `python -m http.server` and use that.

- Grade: after any change to `analyseTeam()`, count the distinct values each
  component takes across the room, not just your own card. Three of the four
  were broken at once and every one of them still rendered a plausible bar on
  a plausible-looking grade — the tell was in the spread, where roster
  construction was the same number for all ten teams. Reconcile a total
  against its own parts too; both are two lines in the console:

  ```js
  const all = analyseDraft(), w = WEIGHTS;
  ["startersScaled","valueScaled","buildScaled","byePenaltyScaled"]
    .forEach(k => console.log(k, new Set(all.map(t => Math.round(t[k]))).size));
  console.log("totals reconcile", all.every(t => Math.abs(
    t.startersScaled*w.starters + t.valueScaled*w.value +
    t.buildScaled*w.build + t.byePenaltyScaled*w.byes - t.total) < 1e-9));
  ```

  And run one draft at more than fourteen teams. The grade scale is fourteen
  long, the team count goes to twenty-four, and that is a shape nothing else
  in the routine covers.

  Then read the panel and check it against those numbers, because the snippet
  above cannot see the whole class of bug where the arithmetic is right and
  the screen is wrong. The standings printed starter strength for months in a
  table sorted by the weighted total, and every check that only looks at
  computed values passes that happily. Scrape the table and compare:

  ```js
  const all = analyseDraft();
  const shown = [...document.querySelectorAll("table.standings tr")]
    .map(tr => [...tr.children].map(td => td.textContent.trim()));
  console.log("standings match totals", shown.every(r =>
    +r[2] === Math.round(all.find(t => t.rank === +r[0]).total)));
  console.log("column descends", shown.map(r => +r[2])
    .every((v, i, a) => i === 0 || v <= a[i - 1]));
  ```

  Do all of that **twice**: once on the finished board and once about three
  rounds in. Everything in the grade section had only ever been checked on a
  completed draft, which is how a bar reading `-8 / 100` survived — mid-draft
  is where a component written for a finished roster behaves least like
  itself. `autoDraftRest()` gets you the end state; for the middle, step the
  clock forward by hand:

  ```js
  let g = 0;
  while (state.picks.length < 25 && g++ < 60) {
    const c = onTheClock();
    makePick(cpuChoice(c.slot, c.round));
  }
  render();
  ```

  And if you sweep the rendered text for `NaN`, match it case-sensitively.
  `/nan/i` hits the running back **Monangai**, which cost a few minutes
  chasing a bug that was a regex.

  **Run a superflex draft as well.** The two shapes above are the only ones
  the routine covers, and the whole grade had been checked against nothing
  else — which is how a component that pays teams to misbuild a superflex
  roster survived. Superflex is `SFLEX 1` and one extra round, two clicks
  from the default. The thing to assert is that holding what the format
  requires costs nothing, and that giving it up does not help:

  ```js
  const s = 0, saved = state.picks.slice(), before = analyseTeam(s).build;
  const qbs = state.picks.filter(p => p.slot === s && p.player.pos === "QB")
    .sort((a, b) => a.player.posRank - b.player.posRank);
  const spare = board.find(p => p.pos === "WR" && !p.drafted);
  state.picks = state.picks.map(p => p === qbs[1] ? { ...p, player: spare } : p);
  console.log("breaking it helps?", analyseTeam(s).build > before);  // must be false
  state.picks = saved;
  ```

  Any league setting that changes what a roster is allowed to hold deserves
  the same treatment. A grade that rewards a worse roster is worse than no
  grade, and it will not show up in a spread or a reconciliation.

### The suite goes stale, and it fails exactly like a broken app

Measured 27 August 2026: **nine tests across seven spec files failing against
production, and not one had a bug behind it.** Every single failure was a UI
change nobody had updated the tests for. The app was fine throughout.

That is the thing worth keeping, because it is the opposite of what a red
suite is supposed to mean. This project's whole testing argument is that a
failing test is evidence about the product — and for one afternoon it was
evidence about its own age instead. A suite in that state is worse than no
suite, for the reason the permanent-known-failure note above already gives:
what nobody believes, nobody reads.

**Most of it traced to one collapse.** The two-step "entry screen, then claim
a chair on the seat board" is gone — the Lobby's "Start mock draft" starts the
draft outright, and the seat and scoring are selects on that same panel. Four
separate things in the suite were still walking the old path: a second "Start
draft" button, a claim-chip seat board, a `"Order"` tab that is `"Seats"` now,
and an "Auto-draft the rest" menu item that a product review cut along with
Pause and Undo. None of those announced themselves as removals; they
announced themselves as tests that hung or read `undefined`.

**A test can measure the wrong thing rather than the wrong value, and that
looks far more alarming.** Two of the nine looked like real defects and were
not:

- `news.spec.mjs` counts elements built from a deliberately hostile payload
  and reported **two `<img>`**. They were the player's own headshot: `PANEL`
  finds the first `.overflow-y-auto` holding a link, which is the full-screen
  player sheet now rather than the news list. Zero images inside the news
  items, and the hostile markup arrived as text and stayed text. The check is
  scoped to the headline cards now — where an element built from the payload
  would actually land — and `<script>` stays panel-wide on purpose.
- `share-card.spec.mjs` said Archivo was drawn but never requested. Archivo
  moved to self-hosting (`/fonts/archivo-variable-latin.woff2`, preloaded,
  `@font-face` in `index.css`); the test only ever parsed `index.html`'s
  Google Fonts `family=` query. It reads both sources now.

**And `PANEL` claimed a third one, months later, in the same file.** The
keyless test asserted the panel says "no recent headlines" and reported the
message missing. `LatestNewsTab.jsx` was rendering it the whole time: `PANEL`
resolves to the full-screen sheet, as above, and the assertion read
`.slice(0, 60)` of it — sixty characters of that sheet is
**"JUKE · PLAYERS · BOARD · DECIDE · ANALYSIS · Autopick · RND 1 OF 14"**,
chrome rather than content. It now reads the message off the sheet where the
component puts it. The scope did not change, because `PANEL` was resolving to
that element anyway; only the truncation went.

**Two lessons, and the second is the one that keeps costing.** A shared helper
that silently widened its scope broke three assertions across two sittings, so
when a selector in this file surprises you, check what it *resolves to* before
believing what it *reports* — one `console.log` of `panel.innerText` would have
ended each of the three in a minute. And **a `.slice()` inside an assertion is
a filter nobody reads as one**: it turned a correct check into one that could
only ever see the header. Assert on the whole string and let `toContain` do the
narrowing.

**Both were settled by asking the live page, not by reasoning.** Dumping the
two images showed `sleepercdn.../9221.jpg` twice; running `shareCard.js`'s own
`usable()` probe in a real browser returned true for Archivo. Neither needed
a code change. **A test asserting an absence has to be re-checked against the
running app before it is believed**, which is the same instruction the
`?cb=` note gives about deployment and the `LOCAL_WORKER` skip gives about
news.

### Six stale specs, one predicted failure, and the fix that outlives both

The mobile pass turned six specs red. Five were stale in the ordinary way —
a label moved, a tab became a section, an element changed from a `<span>` to
a `<p>`. **The tell is the one this file already records**: they failed by
not finding something, on properties that had nothing to do with what broke
them. A test about whether the Start button is coverable failed on the
button's name; a test about the gap under the fixed header failed on which
element the eyebrow is; a test about pick codes failed because the position
abbreviation became mono.

**A seventh failure was mine, and it is the case trap again.** Replacing
`/Randomize order/` with `/Randomize/` looked like the whole fix; the button
is title case in the source and uppercased in CSS, so `innerText` hands back
`RANDOMIZE` and the case-sensitive match found nothing. The *negative*
assertion ("a guest is not offered the shuffle") passed either way, which is
what hid it — a negative that matches nothing passes for the wrong reason,
and it had been doing so since the label lost its second word. What caught it
was adding the positive: **assert that the thing you are checking the absence
of is present for somebody**, or the absence means nothing. That is the third
appearance of this trap in this file, after `/nan/i` catching Monangai and the
hero eyebrow's own uppercase slogan.

**The repair was not to update the selectors.** Each of those three now
matches a `data-*` attribute the app carries deliberately —
`data-start-draft`, `data-hero-eyebrow`, `data-pick-code` — because updating
a label match only buys until the next rename, and the start button alone has
had four names. An attribute says what an element IS. That is this file's own
"anchor on behaviour, not on class strings" rule, applied to the identity of
the element rather than to how it is found.

**The sixth was a real prediction coming true**, and it is the best argument
in this file for writing down what an assertion rests on.
`board-marks.spec.mjs` asserted that the board's ground is dark in both
themes, with a comment saying that is the precondition a single gold ring
rests on and "if this ever stops being true, the pair has to come back and
this is the line that says so". It stopped being true from a direction the
comment did not anticipate — the cells went light while the ground stayed
dark — so **that assertion would have gone on passing** while gold measured
1.06 on a real card. What actually caught it was the contrast assertion
beside it. The precondition is no longer load-bearing and is no longer the
guard; the pair is measured directly instead.

**And one failed for being right.** The sheet's tallest snap was pinned to
558 — a 664px viewport minus a header hardcoded at 106px. The header measures
itself now, so the honest cap is 588, and that assertion would have gone red
for the fix exactly as loudly as for a regression. It derives the cap from
the header's real height now. **Assert the relationship, never an absolute
offset** — the same rule this file already states about the padding that
stands in for a fixed header's height, learned again on the number underneath
it.

### `actionTimeout` was unset, and that is why a stale locator cost six minutes

`playwright.config.mjs` set none, so the default was **no ceiling at all**. A
locator action against an element that never appears waits for ever, and the
*test* timeout is what eventually fires — six minutes later, blaming the whole
test rather than the line, with nothing in the output naming what was waited
for. `isEnabled()` is the sharpest form: the question has an answer, `false`,
and the default behaviour is to wait for a different one instead. One removed
button took down `grade`, `journey` and `solo` that way and read as three
broken tests.

**It is `30 * 1000`, and the number is not free choice.** The option is not
scoped to actions the way its name suggests: Playwright applies it through
`setDefaultTimeout()`, the default for *every* method taking a timeout,
`page.waitForFunction()` included. It was set to 15s first, which did not
merely bound what was unbounded — it quietly halved every wait in the suite
that never asked for one, and `room.spec.mjs` went red within one run. 30s is
Playwright's own default, so nothing that already worked is shortened while
the unbounded case still collapses to thirty seconds and names the action.

**Guard an optional control with `count()`, never with `isEnabled()`.** The
first is a fact about this screen; the second is a question that hangs.

### Two waits that had been passing on luck

Tightening the default exposed both. Neither was caused by it — both were
waits that never said what they were waiting for and inherited whatever the
global happened to be.

**A wait has to be sized for the thing it waits on.** `"leaving the draft
leaves the room"` waits for the opening pick of a real two-manager draft, and
nobody picks first there: the guest is playing as a human, the host's autopick
is never turned on, so the first pick only lands when a 60s `clockLength` runs
out and the room takes the seat. No default could reach that. It carries 90s
explicitly now — **not** "fixed" by giving the host autopick, which would make
it fast by quietly changing the scenario under test.

**`createRoom()` returned a code, and the callers all wanted a seat.**
`codeInUrl()` goes true the instant the worker answers, because `createRoom()`
writes the hash itself then. The host's own seat arrives later, on the
broadcast after their join — so there is a window where the room is real,
reachable by its link, and **seat 0 is still empty**, and `join()` hands a new
member the first free chair (`freeSeat()`, `room.js`). A guest arriving inside
it took the host's seat and `"the guest is seat 1"` failed with `0`,
intermittently, reading as a flake in the room rather than as a fixture
handing out the code before it was safe to use.

**That window is unreachable in life**, which is why it had never been seen: a
person copies the link and sends it, which is seconds, and the host is seated
long before anyone clicks. A test hands the code straight to a second browser,
so it hits the one race a human cannot. The helper waits for a seat now. When
a room test flakes, suspect the fixture's definition of "ready" before
suspecting the room.

### Desktop and mobile both mount, so a label matches twice

**And there are two whole HOMEPAGES in the document now, not just two
renderings of one control.** `journey.spec.mjs` clicked
`a[href="#/drafts"]` and took `.first()`, which after the mobile pass is a
link inside the phone homepage — `sm:hidden` at desktop width, first in
document order, a zero box. It clicked nothing for a minute and timed out
at the action. `:visible` is the same fix as everywhere else in this
section; what is new is that the duplicate can be a page rather than a
button, so a selector that names a destination rather than a control is
just as exposed.

`Analysis`, `Draft options` and the lobby gear each render in a desktop bar
and again in a `lg:hidden` mobile one. Both are in the DOM — **CSS-hidden is
still mounted**, the rule `useMinWidth` already exists for — so matching on
the label alone is a Playwright strict-mode violation rather than a missing
control. `:visible` is the fix, and it says what the test means: the one a
person can see at this width.

**And `page.evaluate(...).find(...).click()` is the wrong shape for anything
that renders on a socket.** It runs once, so an element a beat away is
`undefined` and the failure reads `Cannot read properties of undefined
(reading 'click')` — a control that does not exist, rather than one that is
not there *yet*. A locator auto-waits. The guest reaches the lobby bar as soon
as `Live.room()` reports a seat, which is the socket answering and not the bar
having rendered.

### An AI test agent matches text case-insensitively unless told not to

Worth writing down beside the `Monangai` note above, because a second tool
found the same trap from a new direction. A TestSprite assertion reading "no
`NaN` is visible" failed on a perfectly healthy player sheet: **six matches,
every one of them a surname** — Kyle Mo**nan**gai and Kee**nan** Allen. A real
browser found **zero** case-sensitive `NaN` on the same page.

So an assertion handed to a language model has to say *case-sensitive* and
name the expected near-misses, or it reports the sport's own spelling as a
bug. The same instruction that keeps `/nan/i` out of a console sweep applies
to prose.

### Finding out whether a commit is really gone

`git branch --contains` answers "which refs hold this SHA", which is not the
question when a branch has been rebased on its way to the remote. A commit
here looked unique and unpushed by that test, and the identical change was
already on `origin` under a different SHA and already merged into `main`.
**`git patch-id --stable` compares content, and `git cherry main <branch>`
marks with `-` anything already upstream by content.** Ask those before
calling work at risk — and before force-pushing anything on top of it.

## Don't

- Don't add a framework, bundler, or npm dependency.
- Don't scrape or republish expert rankings, news articles or analyst
  commentary. That content belongs to the sites that produce it.
- Don't commit secrets. There are none in this project and there shouldn't be.
  This gets harder, not easier, once there is a backend: a GIPHY key in
  client-side JavaScript is public, so it proxies through the server.

## Multi-user drafting

This file used to say don't. The owner has decided otherwise, so the rule is
replaced by the terms it happens on.

**Solo mock drafts stay exactly as they are.** Static, no backend, opening
from `file://`, working offline, free to run. Multiplayer is a *mode*, not a
conversion, and the fallback stays a complete product rather than a degraded
one. Anything that makes a solo draft depend on a server is out.

**The rules live in `draft-engine.js` and only there.** With one drafter the
browser deciding what is legal is fine, because there is nobody to disagree
with. With ten people the server has to decide, and the server and every
client have to reach the same verdict, or two managers take the same player
milliseconds apart and the room forks. That is why the engine has no DOM, no
globals and no imports: so both sides can run the identical file.

**The host's browser is the CPU.** The worker has no board — a megabyte of
generated data — so the opinion for an empty chair is worked out where the
board already is and submitted as a normal pick. `Room.hostPick()` still
checks it really is the host and really an auto seat, so authority stays on
the server while the knowledge stays on the client. The cost: CPU seats stall
if the host closes the tab. Visible rather than silent, and better than
shipping the board to a Durable Object.

**In a room the browser stops deciding.** `draftAndAdvance()` sends the intent
and returns; the board only moves when the room broadcasts. The local clock
and the CPU animation loop both switch off, because a second timer counting
locally disagrees with the room within seconds.

**The CPU wobble is arithmetic, not randomness,** for the same reason —
`DraftEngine.jitter()` must give every participant the same answer. It reads
a player's board position, so a room has to pin the data version it started
with. The files are rebuilt nightly and a mid-draft change would drift the
boards apart.

### "The browser stops deciding" has to be applied everywhere, not once

The rule above was written for `draftAndAdvance()` and applied to
`draftAndAdvance()`. Three other places went on deciding, and each one was a
bug somebody hit in a real draft with a real friend on the other phone.

**`autoDraftRest()` drafted the whole board.** Solo that is exactly right —
"the rest" is nine CPUs and nobody minds. In a room "the rest" is other
people's teams, and it filled all ten of them, locally, so the host was
looking at a completed draft the room had never heard of. In a room it is now
an autopilot on your own chair: one pick per turn, submitted through the same
door as any other pick, everybody else untouched. The label was half the bug
— "Auto-draft the rest" is a promise the app cannot keep in a room — so it
reads "Auto-draft my picks" there, and toggles off.

**`goHome()` cleared the local draft and stayed in the room.** The next
broadcast put the draft straight back and `enterDraftUI()` returned you to
it, at the room's real position. Pressing "New mock draft" and landing back in
the old one is not a stale screen; it is the app refusing to leave. Leaving
the draft screen now leaves the room — a real departure, chair to the CPU,
exactly as closing the tab has always been — and it is recoverable because
rejoining reclaims the seat.

**An invite code arriving without a page load did nothing.** Joining happened
once, at startup, which covers a link opened into a fresh tab and nothing
else. A tab already on the site only changes its hash. That became reachable
the moment leaving a room started clearing the code out of the address: the
way back in is the link, and the link was the case that did not work.
`hashchange` now joins when the code differs from the one we are in.

### Joining a room means taking all of its league, not part of it

`adoptRoom()` compared one field:

```js
if (room.league && room.league.teams !== league.teams) { ... }
```

Ten teams either side and it adopted nothing — so a joiner kept their own
rounds, lineup, bench, clock and **scoring**, and scoring is not a preference.
It picks the ADP set, and the sets are not the same people: **standard 207,
half 221, full PPR 260**. A half-PPR joiner in a full-PPR room therefore had a
board missing 39 of the players that room could legally draft, defenses and
kickers among them.

Every one of those picks arrived at `board.find(p => p.name === rp.key)`,
missed, and hit `if (!player) return;` — dropped without a word. That is four
separate symptoms from one line:

- **a CPU seat that appears to skip its turn**, which is a blank cell where a
  pick should be, reported from a real draft as exactly that;
- **a draft that can never finish on that screen.** 139 of 140 means
  `draftOver()` stays false forever, so the Analysis tab sits on "Grade so
  far — 3 of 10" for a draft the room completed minutes ago;
- **a full board rebuild on every broadcast**, chat messages included, because
  `state.picks.length !== room.picks.length` can no longer ever be false;
- **a setup screen still describing the last room you made**, which is what it
  felt like from the outside and has nothing obviously to do with any of the
  above.

The league is adopted whole now, `sameLeague()` compares the keys the *room*
sent rather than ours — comparing ours means an older room missing a key
reports a difference adopting can never close, and rebuilds forever — and a
key that still does not resolve says so in the console instead of leaving a
hole for somebody to find in the last round.

**A silent `return` on unresolvable data is how a wrong board looks right.**
Nothing about that draft appeared broken until the very end.

### Everything the room decides has to be locked, not just the five obvious ones

`LOCKABLE` named five controls. A league is far more than five, and the
starting lineup, the bench and all thirty-eight scoring rules were left open to
anybody in the room — each of them wired to `refreshSetup()` → `readSetup()` →
`buildBoard()`. So a guest could rebuild their own board out from under the
draft they were in, and nothing on screen said so: their replacement levels,
suggestions and grade simply stopped describing everybody else's draft, and
`adoptRoom()` cannot put it back, because a room only ever broadcasts the
league it was created with.

Locked for the **host** too. The wobble reads board position and every client
has to agree, so the shape is fixed the moment the room exists. Changing it
means a new room.

The scoring editor is locked by sweeping `#scoringFields` rather than by name,
and `renderScoringFields()` re-applies it — those inputs are new elements every
time it runs, so a lock set on the previous set has already been thrown away.

**A control that cannot act must not merely fail; it must not be offered.**
Pause, Undo and "Discard draft" were all on screen for everybody in a room and
all three were the browser deciding:

- **Pause was a local flag that sent nothing.** The room went on counting and
  handed the seat to the CPU while the header read "Paused". It is a message
  now, and `Room.pause()` has the host check it never had — nothing had caught
  that, because no client had ever sent the message.
- **Undo rolled picks off the local copy** and the next broadcast put them
  back. There is no shared undo and there should not be one. It is hidden in a
  room.
- **"Discard draft" discarded nobody's draft.** What it did was walk you out
  of the room, so it says "Leave the room" there. The label was the bug.

### A clock everyone is waiting on has to be a clock everyone can see

`clockRunnable()` answered two questions with one condition, and one of them
was wrong. "Should this browser be counting" is only ever your own turn in a
solo draft — running out of it drafts for you. "Is there a countdown worth
drawing" is true for the whole room on anybody's turn, and the page was using
the first to answer the second. Nine managers out of ten watched a clock they
could not see, in both places it is drawn: the header and the live board cell.

`clockShowing()` is now the display question and `clockRunnable()` stays the
authority question. In a room the countdown is **painted, never counted**:
`startRoomTicking()` walks the last `msLeft` down between broadcasts — which
arrive on picks and messages, not once a second, so a clock drawn only from
those sits still for a minute and then jumps — and it never drafts. Running out
is the room's business.

`resetClock()` asks `hasRoom()` rather than `inRoom()`, because a dropped
socket is still a room and a browser answering "no" would start counting on its
own and draft for a seat it no longer speaks for.

### Following the live pick is a default, not a rule

`render()` rebuilds the board on every change — one per CPU pick — and
`scrollBoardToLive()` re-centred every time without asking where the reader had
put it. So scrolling up to look at round one during a run of CPU picks was
impossible: measured at round 12, somebody at the top of the board was pulled
back to 316px two or three times a second, for as long as they kept trying.

`boardFollow` holds it. **The `scroll` event cannot be what frees it** — a
smooth programmatic scroll fires a stream of them and the board would free
itself on its own animation — so it listens for `wheel`, `touchstart`,
`pointerdown` and `keydown`, which only a person produces. It resumes on its
own when the reader scrolls back to the live pick, which needs no separate
gesture to mean "done looking", and your own turn takes the lead back **once**
rather than continuously, or scrolling during your own pick would be undone as
briskly as during anybody else's.

### Hiding a thing is not the same as putting it away

`.draftshell > .chatslot:not(:empty)` claims a 330px column, and `:empty` is
about child *nodes* — a slot holding a dock with `hidden` on it is not empty.
`renderChat()` hid the dock when there was no room and left it where it was, so
leaving a room and starting a solo draft in the same tab kept the whole column:
**330px of nothing beside the board, and the board down from 1391px to 1061px
to pay for it.** `placeChat()` parks it back outside the grid now.

Same family as "an author `display` beats `[hidden]`", and the same lesson:
`hidden` is a rendering hint, and layout questions are answered by where a node
actually is.

### A shared board is a board nine other people are reading

The Value and Reach chips are the app reading the board for you before you
commit, which is right in a solo mock and is scouting for the entire room in a
shared one. In a room they come off the Players tab and are said in the ticker
after the pick instead — to the one manager who has already made the decision.
`marketChip()` is the single renderer for both, so the two can't drift.

### Blue text is a promise too

The rail's bench row ended in `<span class="rtm">My Team</span>`, coloured
`--link`, sitting at the end of the one row whose entire job is to say *there
are players here I am not showing you*. Nothing listened to it. It had never
been clickable on any screen the app has, and it was reported from the
installed desktop app only because that is where somebody sat down and tried.

**Nothing about it looked wrong, because looking right was the whole defect.**
A dead control is invisible to every check this project runs: it renders, it
contrasts, it does not overflow, no console error, no failing assertion. The
only thing that finds it is pressing it.

It is a `<button>` now, delegated — `renderRail()` rebuilds that row on every
pick, so a listener attached to the element would be discarded seconds after it
was set.

**And it could not have worked without `goToTab()` existing first.** Switching
tabs was three lines inside the tab strip's own click handler, so the only
thing in the app able to change tabs was the tab strip; anything else had to
write "which tab is on" down a second time. That is why the row got a colour
and no behaviour — the behaviour had nowhere to come from. A control that
cannot reach the thing it names is a design problem before it is a bug, and
the fix is to give the destination a name, not to copy the three lines.

Setting the panel without the strip is its own small lie: the app is then on a
tab its own nav says it is not. `goToTab()` does both, and the test asserts
both.

### A fraction is a promise about its denominator

The position filter doubles as the roster-need display, and it printed
`have/starters` in every state with the count turning `--good` once the
starting slot was filled. At tight end that is a green **"1/1"** the moment you
take one — a success colour on a fraction that reads as a ceiling — when
`maxAt("TE")` is 3 and a backup tight end is an ordinary pick.

It was reported from a real draft as *the app would not let me take a second
one*, and the app had let him take anything he liked: the Draft button on an
available tight end is disabled only when the clock is not yours, there were
nineteen on the board at the time, and `suggestions()` had simply not offered
one in its top six. **Nothing was broken except the sentence the screen was
saying.** That is the same failure as a kicker being named the biggest reach —
a correct number that no reader can arrive at the right conclusion from.

So the denominator is only drawn while it is still owed. A requirement you have
met is discharged, and continuing to print it as a fraction invents a limit
that does not exist; what replaces it is the count alone, in the muted tone,
until the position is genuinely full. **The stylesheet had already written the
rule, one line above the rule that broke it** — "a filled slot is the normal
case and does not need to shout about itself" — which is worth noticing,
because a comment contradicting the declaration underneath it is a bug someone
has already half-found.

**`atPositionCap()` asks `needMultiplier()` rather than answering again.** The
cap is not one rule: `maxAt()` for the skill positions, the starting
requirement for a kicker or a defense, `starters.QB + superflex` for a
quarterback. Writing that down a second time is precisely how the superflex bug
happened. The last round is passed in so the K and DST *timing* gates do not
fire — this is a question about a roster, not about when a kicker becomes
legal.

And when a test asks "was it my turn", **read it before the test stuffs the
roster, not after.** Pushing picks straight into `state.picks` to reach a cap
moves whose turn it is, so an answer collected at the end of the block is about
the board the harness built rather than the one it drove. That cost a red run
on a test whose subject was fine.

### A filter is a lens, never a decision

`suggestions()` is filtered by the position chip on the panel, and
`autoPickForMe()` read that list. So a manager looking at tight ends who
already held their three got an empty list — and "Auto-draft the rest" read
empty as *there is nothing left to draft* and abandoned the remaining rounds
without a word. Reported from a real draft: eleventh of twelve, stopped in the
ninth round of fourteen.

**`autoPickForMe()` now takes `suggestions("ALL")`, never the filtered list.**
Consulting the chip first and falling back looked like the respectful version
and is worse: leave the panel on K, walk away, and the clock hands you a
kicker in the fifth round. That was caught by the test written for the bug
above — the fix had a bug of its own, and one run of the suite found it. The
queue is where "what I actually want" lives; a chip is where you happen to be
looking.

**And the button now either finishes the draft or the board is empty.** Both
branches of the loop fall back to `bestLeft()`, and a rejected pick breaks out
instead of being retried identically until the guard runs down — which looked
exactly like stopping halfway, because it was. `cpuChoice()` itself is left
alone: every client in a room has to agree with it, so the fallback lives in
the solo loop, where nobody else is watching.

**Any preference that can empty a list can end a draft.** The roster caps in
`maxAt()` are the same shape of thing — they exist to stop the CPU hoarding
tight ends, not to decide your draft is over — which is why the last resort
ignores those too.

### A safety limit the app trips on itself

The worst of the four was not reported by anyone, because it does not look
like a bug until it is fatal. A full ten-team room draft, run end to end,
**stopped dead at pick 86** with an empty chair on the clock and every client
waiting on a browser that was waiting on them.

The chain, which is worth reading in full because no single link is wrong:

1. `adoptRoom()` cleared `autoInFlight` on every broadcast carrying a pick, so
   the host's CPU driver sent the next one the moment the last came back.
   Measured on localhost: **a pick every 25ms**, a whole round inside a
   second.
2. The worker allows **forty actions per socket per ten seconds**. That
   comment says "which no person reaches", and it is right — but the host's
   browser is not a person, and it reaches it in the second round.
3. The room answered `too-fast`. **A rejection goes to one socket and causes
   no broadcast.**
4. The driver only ever ran *on* a broadcast. With none coming, it never ran
   again. The two-second timer cleared the flag but nothing retried — and
   permission to try again is not a try.
5. The clock was off, so no alarm woke the room either.

Four correct-looking pieces, one dead draft. The fixes: the driver is still
woken by the broadcast, because **a timer cannot be the engine** — a
background tab has its timers clamped to a second and eventually to one a
minute, and the host's phone is in a pocket for most of a draft — but it
refuses to send twice inside `AUTO_PICK_MS`, and it keeps one retry timer as a
backstop so a rejection, a lost broadcast or a momentary nothing-to-do cannot
be the end of the chain.

**Anything the app does on your behalf has to fit inside the limits the app
imposes on you.** The rate limiter was written thinking about an attacker and
a person, and the host's own browser is neither.

### A dropped socket is the normal path, not an edge case

A phone closes a WebSocket the moment the browser stops being the front app.
So the drop is not a failure to design around — it is step three of the
feature: create the room, copy the link, **leave the browser to send it**.
Everything below was one report from one real draft on one phone, and all of
it is that single second.

**The page reconnects itself.** It did not, at all: nothing in `live.js`
reopened a socket, so a drop was permanent until somebody reopened the link.
Backoff for a worker that is genuinely down, and an immediate retry on
`visibilitychange`, `online` and `pageshow` — coming back to the tab is the
strongest evidence there is that now is the moment, and it is exactly when it
happens. `open()` is split from `connect()` so a retry does not clear
`live.room`: that is the last thing the room said and the whole page is drawn
from it, so wiping it to reopen a socket blanks the seat list and the chat
log for as long as the socket takes.

**"In a room" is `Live.room()`. "The socket is up right now" is
`Live.active()`.** They are not the same question and the start button asked
the wrong one. With a dropped socket `inRoom()` is false, so the handler fell
past the room branch into the one below it — and the branch below it starts a
**solo** draft. Not a degraded shared draft: a different draft, on the host's
phone, against CPUs, while everybody else sat on "Waiting for the host…"
until they gave up. `renderInvite()` had the same bug and dressed it: keyed on
the socket, it unlocked every setup control and relabelled the button "Start
your draft", so the app cheerfully offered the wrong draft. Both now key on
the room, and the button says "Reconnecting…" and is disabled while the
socket is down.

**A control that cannot act has to say so.** Chat is all socket messages, so
all of it stops working on a drop — and it stopped silently: the box still
invited a message, Send did nothing whatsoever, and the line was neither sent
nor kept. "Nothing happens" is how it was reported, and that is the correct
description. The whole footer now goes dead together with one line saying
why. The one honest signal that already existed — `#inviteStatus` reading
"Lost the connection" — was a grey hint contradicted by every control around
it, which is not far off no signal at all.

**Coming back has to undo exactly what leaving did.** `leave()` marks the
chair `auto` so the room keeps moving without you, which is right. `join()`
did not clear it, and could not even find the chair: `leave()` deletes the
member record, so a returning manager took the "new person" branch, which
mid-draft assigns no seat at all. The seat stayed theirs and stayed `auto`,
so the host's browser went on drafting for someone sitting there watching it
happen — no error, no message, visible only as picks they never made. This
one had never bitten because nothing reconnected on its own; making
reconnection work is what turned a dormant bug into the common path.

**The member record outlives the connection.** It is the only thing that can
tell a reconnection from an arrival — the lobby frees a dropped chair, so
"had no seat a moment ago" is true of both — and without it every trip to the
messages app and back added another "took seat 1" to the log. `leave()` keeps
the record and forgets its chair; the worker announces on the record, not on
the seat.

**Two members in one browser: use two origins.** `localhost:8765` and
`127.0.0.1:8765` are different origins with different `localStorage`, so they
hold different `juke.member` ids and the room treats them as two people. Two
tabs on the same origin share the id and the worker correctly treats them as
one manager with two sockets, which tests nothing about a second person — and
overwriting the id in one tab breaks the other the next time it reconnects.
