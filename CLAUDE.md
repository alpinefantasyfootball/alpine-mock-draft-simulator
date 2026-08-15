# Juke

Juke is the brand. **The Draft Room** is the first of several planned rooms
(Waiver, Prospect, Trade, League, Strategy), and the only one that exists —
so for now the site and the Draft Room are the same thing. Name the room in
the app, not the brand: the header says "The Draft Room", Juke sits above it
in the page title and the manifest.

A fantasy football mock draft simulator, built for one specific ten-team
league and now configurable from the setup screen: 8 to 14 teams, 8 to 20
rounds, any starting lineup, and standard, half or full PPR. That original
league is still what every control defaults to.

Live at `jukeff.com`, hosted on GitHub Pages straight off `main` via the
`CNAME` file. **It serves from the domain root, not a project path** — which
is why `manifest.json` uses `start_url: "/"`. A path-scoped `start_url` here
makes the installed app launch into a 404.

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
| `style.css` | All styling. Colours defined once at the top, reused by name. |
| `app.js` | Everything else: draft engine, CPU logic, analysis, rendering. |
| `back-to-top.js` | The back-to-top button. Its own file because the how-it-works page uses it and has no reason to load `app.js`. |
| `draft-engine.js` | The rules of a snake draft — turn order, legality, the CPU wobble. No DOM, no globals, no dependencies, so a server can run the identical file. |
| `room.js` | One shared draft: seats, picks, the clock. Pure, and time is always passed in rather than read. Loaded by the worker only; the page consumes the view it sends. |
| `live.js` | The client end of a room: one socket, the invite code, and the messages. Knows nothing about the board or how anything is drawn. |
| `worker/` | The Cloudflare Durable Object behind an invite link, plus its `wrangler.toml`. Deployed to `juke-draft-room.jukeff.workers.dev`; a change here needs `wrangler deploy` before the page can use it. See `worker/README.md`. |
| `scripts/test_engine.py` | Runs `draft-engine.js` and `room.js` in node/deno/bun and asserts the rules from outside a browser. |
| `players.js` | **GENERATED.** 260 players by ADP. Never edit by hand. |
| `stats.js` | **GENERATED.** Stats, projections, depth charts by Sleeper ID. |
| `scripts/build_players.py` | The pipeline that writes the two generated files. |
| `.github/workflows/update-players.yml` | Runs the pipeline daily at 11:00 UTC. |
| `og-image.png` | **GENERATED.** 1200x630 link-preview card. Rebuild by opening `scripts/build_og.html` in a browser and clicking download. |
| `unmatched.txt` | **GENERATED.** Feed rows that failed to join, plus unscored stat keys. |

## Data

Two free feeds, no keys: **Sleeper** (players, injuries, stats back to 2018,
weekly logs, projections, depth charts) and **Fantasy Football Calculator**
(ADP, one set per scoring format, written to `players.js` as `ADP_SETS`).

**The pipeline stores raw components and no points total at all.** Scoring
lives in `app.js` (`DEFAULT_RULES` and `fantasyPoints()`), so all 38 rules are
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
  white text, `--link` is blue *as* text on a surface. Orange is two for the
  same reason: `--orange` (#ED6011) is the brand, and it is only 3.34:1
  against white, so anything putting white text on it uses `--orange-cta`
  (#C2410C, 5.18:1) instead.
- **The centred wordmark needs a breakpoint.** `.shell-inner` is
  `1fr auto 1fr`, so each side gets the same width. Below about 540px the
  sides need ~191px of links and get ~110px, and because the links are
  `nowrap` they do not shrink — they spill straight over the wordmark. Under
  700px the header keeps only the burger, the brand and Sign up; How it works,
  Log in, Install and the theme toggle move into the rooms panel.
- **The rooms panel is inside `#shellbar`.** Scope mobile hide rules to
  `.shell-inner`, not the header, or they hide the panel's copies too.
- **Nothing caches `.theme-toggle`.** There are up to three of them and one is
  rendered, so clicks are delegated and `syncThemeButton()` re-queries.

- **One header, two sets of content.** `.shellbar` and `.appbar` share a
  surface, a border and a 1120px centred column, so the Draft Room and the
  landing page read as the same site. Only `.my-turn` and `.urgent` take
  colour, and they carry their own reversed mark and white text. A CPU being
  on the clock is the resting state and must look like the homepage.

- **Two views, one hash route.** `#/` is the landing page, `#/draft` is the
  Draft Room. Hash routing because GitHub Pages has no rewrite to send a real
  `/draft` path back to `index.html`, and because it keeps the back button
  working for someone mid-draft. `applyRoute()` is the only thing that decides
  what is visible; `render()` must never fight it.
- **Leaving the draft is not discarding it.** Navigating home stops the CPU
  timer and the clock and leaves everything else alone, so nothing advances
  off-screen. Returning hands the clock back or restarts the room. Only
  "Discard draft" clears the save.
- **The rooms are written down once,** in `ROOMS` in `app.js`, and rendered
  into both the header panel and the landing grid. Adding a room is one entry.
- **Check a new class name against the existing sheet before using it.**
  The landing section was first called `.home`, which is already the header's
  home button; it inherited `display:flex` and collapsed to zero width. The
  chat avatar was first called `.avatar`, which is the player photo and is
  hidden outright inside the rail.

- **The same goes for function names, and it fails more quietly.** `app.js`
  is one scope, so a second `function initials()` does not shadow the first —
  it replaces it, whichever is declared last, with no warning anywhere. The
  chat's version was silently calling the player one, which happened to
  return something plausible for a real name and threw on an empty seat.
  `grep -n "function <name>"` before adding one.

- **The logo is navy-on-light, and the header is navy.** The mark is inlined
  rather than an `<img>` so the navy half can be reversed to white on the
  header (`.mark-body`) while the swoosh keeps its orange (`.mark-accent`).
  It is 662 × 774, not square — sizing it as a square squashes it.

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

**Do not request the new `?v=` URL until the deploy has actually landed.**
This is the one way the scheme bites you, and it is easy to do while trying
to be careful. GitHub Pages publishes `index.html` and the assets a moment
apart, so a verification poll fired too early asks for `app.js?v=<new>` while
Pages is still serving the old body at that path — and Cloudflare caches that
answer against the fresh address for the full ten minutes. New HTML, old
JavaScript, at a URL specifically designed to prevent exactly that. It has
happened once, on the profile deploy.

Wait for `curl https://jukeff.com/` to come back asking for the new version
*and* give the assets a moment after that, or verify with an extra throwaway
query (`?v=<new>&bust=1`), which reaches the origin without poisoning the
real address. If it does happen, Caching → Configuration → Custom Purge, one
URL per line, fixes it in seconds.

That window used to be four hours. It was Cloudflare's Browser Cache TTL
overriding GitHub Pages, which sends ten minutes; the zone is now set to
**Respect Existing Headers**, so `Cache-Control: max-age=600` reaches the
browser unchanged. If a stale asset ever reappears, check that setting first
— but the `?v=` is what actually closes the hole, and it works whoever is
serving the file.

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

**`top` survives when a sticky column becomes a fixed sheet.** The docked
chat sets `top: 8px`; the mobile rule sets `bottom: 0` and a height. Top plus
height is a complete answer, so the browser took it and ignored `bottom`, and
the sheet opened at the top of the screen. `top: auto` is the fix.

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
orange swoosh showing. The token is brand navy in light, white in dark, and
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

- Room over sockets: `cd worker && wrangler dev --port 8787 --local`, then
  `node worker/test-sockets.mjs` in another terminal. Fifty-two assertions
  against the real Durable Object runtime, no Cloudflare account needed.
  This is the only thing that covers sockets, storage, the alarm and the
  messages that never reach storage at all — typing is relayed, so a suite
  that only inspects state cannot see it. The room logic itself is pure and
  covered below. `npx --yes wrangler@4 dev …` works if wrangler is not
  installed globally and leaves nothing in the repo.
- Engine: `py scripts/test_engine.py` — runs `draft-engine.js` and `room.js`
  outside a browser and asserts the snake maths, the turn order, the legality
  checks, the determinism of the CPU wobble, and the parts of a room that a
  person types into: name cleaning, renaming, reaction privacy and the two
  bounds on the chat log. It needs node, deno or bun on PATH
  and says so plainly if none is there rather than looking like a failure.
  Node is installed user-scope via winget, so a new terminal sees it and an
  already-open one does not.
- Pipeline: `python scripts/build_players.py` — prints counts and writes the
  generated files. Check `unmatched.txt` afterwards. On Windows run it as
  `py scripts/build_players.py`. A bare `python` reaches the Microsoft Store
  stub and fails with "Python was not found" unless the installer's
  "Add python.exe to PATH" box was ticked, which it usually isn't.
- App: open `index.html` directly in a browser. `file://` works because the
  data files load via `<script src>` rather than fetch.
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
