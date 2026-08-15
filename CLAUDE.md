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
| `tests/` | End-to-end tests: the real pages, in a real browser, two managers in a real room. `playwright.config.mjs` starts both servers itself. |
| `package.json` | **Dev only.** Fetches the test runner and nothing else. The app still has no build step, no bundler and no runtime dependency. |
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

## The draft grade

Four components, weighted 50/25/15/10: starter strength, draft value, roster
construction, bye week safety. Each is computed for every team, scaled 0–100
against the rest of the room by `scaleAcross()`, then weighted. The grade is
a ranking inside the room, which is why somebody always gets an A+.

Three of the four were wrong at once, found in one sitting in August 2026,
and they were wrong in the same direction: they all flattered picks nobody
chose to make. Starter strength was correct throughout. What follows is why
each was wrong, because none of them announced themselves.

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

**The number in the room standings is the weighted total, and it has to be.**
The table is ordered by that total and the letter is handed out for finishing
position, so a column sitting between the two that shows anything else makes
the table look broken. It used to print starter strength — one component of
four — which produced this:

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
and advice that forgets that is not advice. Under default scoring it barely
moves — at pick one it swaps the sixth name and reaches no further than ADP 7
— and grows more assertive late, which is where ADP is noisiest.

**`cpuChoice()` deliberately never sees any of this.** The CPU teams are meant
to behave like a room drafting off a market, and in a shared room every client
has to reach the same answer for an empty chair. Your suggestions and the CPU
no longer share one formula, which is why the how-it-works page had to be
changed too — it previously implied they did.

**Whether it helps is a measurable question, so measure it.** Same seed, same
computer teams, your seat drafting each way, across pinned seeds: starter
strength rose every time by four to five points and the finishing rank
improved every time. Draft value moved both ways, which is the tell that it is
finding value rather than reaching. A suggestion change that cannot show this
is a change to the numbers, not to the advice.

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

**The pages themselves carry no `?v=`, so checking a deploy needs the same
throwaway query.** `?v=` protects everything `index.html` *loads* and can do
nothing for `index.html` itself, or for
`docs/draft-room-how-it-works.html` — those are cached under their own plain
addresses for the same ten minutes. `curl` will show you the new page while
the browser sitting next to it still shows the old one, because they hold
separate caches, and a forced reload does not always clear the browser's:
after the how-it-works rewrite the tab kept serving the previous copy until
it was loaded as `…draft-room-how-it-works.html?cb=1`. So when the change is
to a page rather than to an asset, verify it with a throwaway query too, and
do not conclude a deploy failed because a tab you already had open disagrees
with `curl`. Only the assets get a version; the pages get patience.

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
- **End to end: `npm install` once, then `npx playwright test`.** Ten tests,
  about three minutes, and it starts the static server and `wrangler dev`
  itself. It drives the real pages in a real browser — a solo draft at both
  shapes, a full two-manager room draft to completion, a dropped socket
  reconnecting, leaving and rejoining, and the phone layout.

  It is the only tool here that is not plain Python or plain JavaScript, and
  it earns that: everything it covers lives in the browser, so neither
  existing suite can reach any of it. `package.json` exists for this and
  nothing else — **the app still has no build step and no dependency**, and
  nothing under `node_modules/` is served, imported or needed to run the site.

  Two things about it worth knowing before changing it:

  - **A manager is a browser context, not a tab.** Contexts have their own
    `localStorage`, so their own `juke.member`. Two tabs share one id and the
    room is right to treat them as one person with two sockets.
  - **`state` is a top-level `const`, so it is not on `window`.** Waiting for
    `window.state` waits forever on a page that is working perfectly; refer to
    it unqualified, as the app's own code does.

  When adding a test, check it fails against the bug it is meant to catch —
  put the bug back for one run. Every test in there was written against a real
  failure and confirmed to go red without the fix.

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
