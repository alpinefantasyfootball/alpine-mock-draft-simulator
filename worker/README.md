# The room

What sits behind an invite link. One Cloudflare Durable Object per draft:
everyone who follows `jukeff.com/#/draft?room=E8jeVeL` is routed to the same
object, and that object is the only thing that decides what happened.

**This is deployed**, to `juke-draft-room.jukeff.workers.dev`, and `live.js`
points at it by name. So a change to `draft-room.js` or to `../room.js` is not
live until `wrangler deploy` has run, and a client that expects it will fail
against the old one — check both sides ship together.

**The site still does not need it.** A solo mock draft opens from `file://`
with no backend at all and never opens a socket, and that is deliberate — see
the multi-user section of `CLAUDE.md`.

## What is where

| File | Role |
|---|---|
| `draft-room.js` | The Durable Object, the routing worker, and every `/account/*` route. |
| `store.js` | D1: the player-pool/headline cache (never throws) and the accounts system (allowed to throw — see **Accounts** below for why). |
| `migrations/` | The SQL. `0001_init.sql` creates `players`, `player_news` and `news_lookups`; `0002_signup.sql` adds the email-capture list; `0003_accounts.sql` adds `accounts`, `magic_links`, `sessions`, `saved_draft` and `draft_history`. |
| `wrangler.toml` | Bindings, the DO migration and the cron. One class, `DraftRoom`; one database, `juke_db`. |
| `../room.js` | Who is sitting where, what has been picked, how long is left. Pure. |
| `../draft-engine.js` | The rules of a snake draft. Pure. |

The two pure files are the point. The browser loads them as well, so a client
and the server reach the same verdict about a pick because they are running
the same code, not because two implementations were kept in step by hand.

`draft-room.js` is deliberately thin. If Cloudflare ever stops being the
right host, that file is what gets rewritten; the rules and the room move
unchanged.

## Running and testing it

Needs Node, which this project otherwise does not — the *site* has no build
step and never will, but a server is a thing you deploy. Node is installed
via winget as a user-scope package, so a **new** terminal picks it up; one
that was already open will not.

```bash
npm install -g wrangler
cd worker
wrangler dev --port 8787 --local
```

That runs the real Durable Object runtime locally, with no Cloudflare
account. In another terminal:

```bash
node worker/test-sockets.mjs
```

Thirty assertions over real sockets: two managers joining, seats, host-only
start, wrong-seat refusal, chat, a reconnect mid-draft, a stale build being
turned away — and the one that matters, two submits of the same player on
one turn producing exactly one pick.

`wrangler deploy --dry-run --outdir=<dir>` compiles without an account and is
the quickest check that the bundle is still valid.

Deployed at **https://juke-draft-room.jukeff.workers.dev**, on the free plan.
SQLite-backed Durable Objects turned out not to need the paid one — that is
what `new_sqlite_classes` in the migration buys, and it is why the binding is
declared that way rather than as `new_classes`.

```bash
wrangler deploy
JUKE_WORKER="wss://juke-draft-room.jukeff.workers.dev" node worker/test-sockets.mjs
```

The same thirty assertions run against production by setting `JUKE_WORKER`.

A freshly registered workers.dev subdomain has no certificate for a few
minutes. Until it is issued the symptom is a TLS handshake failure, which
reads like a broken deploy and is not: DNS resolves, the worker is up, and
the certificate simply has not arrived. Wait and retry before debugging
anything.

## Decisions worth knowing before changing anything

**The first person through the door creates the room** from their own setup
screen and becomes the host. Everyone after gets the room as it already is;
their settings are ignored rather than merged, because a draft cannot be half
twelve-team.

**A stale player list is turned away, not silently accepted.** The generated
data is rebuilt nightly and the CPU wobble reads a player's position on the
board, so someone who loaded the page after a rebuild would compute different
CPU picks and drift apart inside a round. The room pins the version it
started on and rejects a mismatch with both versions named.

**A dropped connection keeps its seat.** In the lobby, leaving frees the
chair. Mid-draft it stays yours and switches to auto, because a lost
connection is usually a tunnel or a locked phone, and handing someone's
roster to a stranger because their train went underground would be worse than
picking for them.

**Rejections go to one person.** A pick that fails is about that manager's
click; broadcasting it would tell nine other people about a mistake that does
not concern them.

**The room never counts down.** It records when the current pick started and
answers how long is left when asked. That is what lets a phone that was
asleep, or someone who just joined, arrive at the same number as everyone
else rather than counting from whenever they woke up.

## The two proxied routes

Neither is about the draft. Both exist because a key in client-side
JavaScript is public, so the page calls us and we call them.

- **`/giphy?q=`** — the chat GIF picker. `wrangler secret put GIPHY_KEY`.
- **`/news?player=`** — headlines on a player sheet.
  `wrangler secret put TANK01_KEY`.

Both refuse an origin they do not serve **before the key is read**, with a
403. That is the check that matters: CORS headers tell a browser whether to
let a page read a response and do nothing about the request being made, so
`curl` with a made-up Origin drank the GIPHY quota happily until
`originAllowed()` went in front of it.

With no key set, each answers `configured: false` rather than an empty list.
The two are different facts — "not wired up" and "nothing today" — and only
one is worth investigating. The news panel draws nothing either way, which is
deliberate: it is a section nobody asked to wait for, and a permanently empty
box is worse than no box.

`TANK01_BASE` overrides the upstream host and exists for the tests, which
point it at a local stub so the whole path can be driven without a key or a
network. Leave it unset in production.

`/news` answers are cached at the edge for fifteen minutes (`NEWS_TTL`), keyed
by player rather than by request URL, because the free tier is a thousand calls
a month and a draft is the same dozen players opened repeatedly. Measured at 50
requests across 5 players costing 5 upstream calls. Failures are never cached —
pinning an outage for the TTL would turn a blip into fifteen minutes of silence
— and the CORS headers are rebuilt per request rather than served from the
cached entry.

That edge cache is now the first of three tiers rather than the only one: D1
sits behind it and the provider behind that. See **The cache database** below,
which is where the arithmetic that actually protects the allowance lives.

Only the shape `{ title, summary, source, at, url }` reaches the page.
Normalising here rather than passing the provider's payload through means
swapping provider is a change to `fetchUpstreamNews()` and nothing else, and
it keeps the number of fields the page has to escape down to what it draws.
**`source` is never dropped** — we link and attribute rather than republish,
and an unattributed headline is the version of this that is not allowed.

## The cache database

D1, bound as `DB`, created as `juke_db`. Two tables that matter and one that
looks like bookkeeping and is not.

**It is a cache and never a source of truth.** `players.js` and `stats.js` are
still the board, still generated nightly by `scripts/build_players.py`, and a
room still pins the version it started on because the CPU wobble reads a
player's position in that array. A board built out of D1 instead would be the
league shape written down twice, in the one place where two clients disagreeing
forks a live draft. The worker reads these tables; the page never does.

**Nothing depends on it existing.** Every function in `store.js` returns early
on a missing `env.DB`, so `wrangler dev` with no `database_id`, and the whole
existing test suite, behave exactly as they did. That is what lets
`test-sockets.mjs` still pass 87 assertions without a database anywhere.

### The three tiers in front of Tank01

`/news` now asks three things in order, and each exists for a different reason:

1. **`caches.default`, fifteen minutes** — the *freshness* tier. Per
   colocation and evictable, so on its own the worst case is an upstream call
   per player per quarter hour per data centre.
2. **D1, twelve hours (`NEWS_DB_TTL`)** — the *quota* tier. One database,
   global, durable. This is the one that makes a thousand calls a month work:
   it caps the spend at two calls per player per day for everybody at once,
   which is about sixteen distinct players a day across a month. A D1 hit fills
   the edge cache on the way past.
3. **The provider**, and only then.

`x-juke-cache` says which answered: `hit`, `db` or `miss`.

**A cache hit has to be indistinguishable from a miss, and that took three
goes.** `usableNews()` in `store.js` is the single normalisation both paths run
— the same filter, the same dedup, the same ordering — because the divergences
each hid somewhere different: an unlinkable card dropped on the way into the
database but not on the way out of the provider; the feed's duplicate story
deduped by the primary key but not by the response; and the response in the
provider's order against a read-back sorted newest-first. Nobody would call any
of those wrong on its own, and a developer with a warm cache and a developer
with a cold one would see different pages and both look right. `published_text`
exists for the same reason: `timestamp` is for `ORDER BY` and the text is what
the card draws, and reformatting the integer for display would have been a
fourth one.

**An error is never stored; an empty answer is.** "He has no news today" is a
fact worth keeping and re-asking for it would spend the allowance on exactly
the players who have nothing — which is what `news_lookups` is for, because an
empty answer writes zero rows to `player_news` and that is indistinguishable
from never having asked. Verified by taking the stub down and confirming a
known-empty player still answers `db` with `items: []` and no `error`.

**The licence rule is in the schema.** `content` is a clipped summary with a
`CHECK (length(content) <= 400)`, `source` cannot be empty, and the url must be
http(s). We link and attribute; we do not republish, and a column that will not
physically hold an article body cannot quietly start holding one.

### The pool sync

`[triggers] crons = ["30 11 * * *"]`, half an hour after the Python pipeline, on
`scheduled()`. Measured on a real run: **4385 rows**, all 32 team defenses named
correctly. It upserts and never deletes — a player who has left the league is a
row whose `last_updated` stopped moving, not a row to remove — so a
half-succeeded fetch cannot empty the table.

**`position` is Sleeper's own value and is not the set the sync admits on.** A
row gets in if either `position` or `fantasy_positions` names a position we
draft, so 111 fullbacks are stored as `FB`, plus a few punters and corners
Sleeper tags loosely. `WHERE position IN ('QB','RB',…)` therefore returns fewer
rows than the table holds. The alternative — storing the qualifying fantasy
position — would make the column filterable and make this table disagree with
every other Sleeper-keyed thing in the project.

**CPU is the open question.** The Sleeper pool is about five megabytes and
`res.json()` parses all of it, which is real CPU rather than the I/O the plan
limits are generous about. If it trips, the fix is not to tune the parse —
there is no streaming parser without a dependency, which this project does not
add. It is to move the sync into `build_players.py`, which already fetches this
exact endpoint every morning where CPU is free, and write through D1's HTTP
API. Read the CPU time on a real run before deciding.

### Running it

```bash
cd worker
wrangler d1 migrations apply juke_db --local     # local sqlite, no account
wrangler d1 migrations apply juke_db --remote    # the real database
```

`--local` needs no account and no `database_id`; `--remote` needs the real id in
`wrangler.toml`, which `wrangler d1 info juke_db` prints. Trigger the cron
locally with `curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"`, and note
the response returns immediately because the work is in `waitUntil` — read the
log line, not the status code.

A local key goes in `worker/.dev.vars`, which is gitignored:

```
TANK01_KEY = "…"
GIPHY_KEY = "…"
RESEND_API_KEY = "…"
```

`RESEND_API_KEY` is the accounts system's own secret — see **Accounts**
below. Unlike the two above, its absence isn't invisible: with no key set,
`/account/request-link` still works locally (a dev-only response field hands
back the raw token instead of emailing it — see accountRequestLink() in
draft-room.js), but nobody receives a real email in production without it.

**`--var` on the command line works and a stale `workerd` will make you think
it does not.** `wrangler dev` leaves `workerd.exe` processes behind when its
parent is killed, two can hold port 8787 at once, and the old one answers — so
a route came back `configured: false` with the key visibly bound in the new
process's own startup log. Check `netstat -ano | grep :8787` before believing a
binding is missing.

## Accounts

Email plus a magic link, no passwords, and the server-side locker behind it
— Phase 1 of accounts, replacing the "there is still no login anywhere in
Juke" note `/signup` left for this day. `0003_accounts.sql` adds five
tables (`accounts`, `magic_links`, `sessions`, `saved_draft`,
`draft_history`); every function behind the routes below lives in
`store.js`'s own "Accounts — phase 1" section.

**Unlike the cache functions above, these are allowed to throw.** A cache
miss is survivable — the caller just asks upstream again — which is the
whole reason `syncPlayerPool()`/`cachedNews()`/etc. swallow their own
errors. An account write is not survivable the same way: if creating a
session fails, the person simply cannot sign in, and papering over that as
a silent `false` would turn a real 500 into "the link did nothing," which
is worse than an error the route can show honestly. Every account route in
`draft-room.js` therefore wraps its own store.js calls in try/catch and
answers with a real error rather than trusting the "never fails" contract
the rest of this worker follows.

**Sessions are opaque bearer tokens, hashed at rest — not a JWT.** A
signed, self-contained token can't be revoked without a denylist, which is
a database table anyway, so this skips the signing complexity and stores
the one table it would have needed regardless. Sent as a plain header
(`x-juke-session`), never a cookie: this worker and the site are different
origins, and every other client-worker exchange here already goes through
an explicit header/param instead of cookie auth (see `live.js`'s own
member/name query params for the room).

### The routes

| Route | Method | Auth | What it does |
|---|---|---|---|
| `/account/request-link` | POST `{email}` | — | Mints a magic link, emails it via Resend. `too-soon` (429) inside a 60s cooldown per address. |
| `/account/consume` | POST `{token}` | — | Redeems a magic link, creates the account if it's the first time, returns a session token. `unknown`/`used`/`expired` (400) otherwise. |
| `/account/session` | GET | session | Whether the session is still good, and the account it belongs to. |
| `/account/sign-out` | POST | session | Revokes the session. Always `{ok:true}`, even for an already-dead token. |
| `/account/migrate` | POST `{save, history}` | session | One-time adoption of a browser's local locker. `already-migrated` (409) on a second call for the same account. |
| `/account/locker` | GET | session | The server locker: `{save, history}`. |
| `/account/locker` | POST `{save?, historyEntry?}` | session | Write-through sync — one save or one new history entry per call. `save:null` clears it. |
| `/account/locker/delete` | POST `{id}` | session | Deletes one history entry. |
| `/account/delete` | POST | session | Deletes the account and everything scoped to it. Ends the calling session along with every other one on the account. |

Every route refuses an origin it doesn't serve **before** touching the
database or the session header, the same `originAllowed()` check every
other route in this file already runs first.

### The magic link itself

The email carries `https://jukeff.com/?authToken=<token>` — the query
string, never the hash. `account.js` (the client, loaded alongside
`live.js`) reads `authToken` off `location.search` on load, strips it
immediately (before the async consume even resolves, so a reload mid-flight
can't resubmit an already-spent token), and calls `/account/consume`. This
never touches `app.js`'s own hash router: `applyRoute()` has no reason to
know this exists, and doesn't need to.

### Migration and sync

`account.js` reads/writes the browser's local locker through two
`window.JukeEngine` bridge functions built for this — `rawLocalLocker()`
and `adoptServerLocker()` — never a second copy of `readSave()`/
`readHistory()` in the account script. `app.js` fires a `juke:locker-saved`
DOM event after every `saveDraft()`/`recordHistory()`/`clearSave()`/
`deleteHistoryDraft()`, the same seam `renderHeader()`'s own
`juke:header` event already draws between that file and the rest of the
page — `app.js` knows nothing about accounts, sessions, or fetch. Ignored
outright while signed out, so a solo drafter's every save costs exactly the
same network activity it always did: none.

### Sending the email

Resend's plain HTTP API — a `fetch()` call, not a package, so this adds no
dependency. `RESEND_API_KEY` (`wrangler secret put RESEND_API_KEY`) is the
only thing required; `EMAIL_FROM` is optional and defaults to Resend's own
`onboarding@resend.dev`, which sends real mail with zero DNS setup — set it
to a `jukeff.com` address once that domain is verified with Resend for a
more branded From line. With no key at all, `sendMagicLinkEmail()` returns
`false` the same way `giphySearch()`/`playerNews()` answer `configured:false`
with no key — except a magic link with nowhere to go isn't a degraded
feature the way a missing GIF picker is, so the dev-only token leak below
exists specifically to keep the whole flow testable without a real inbox.

**The dev-only token leak, and why it's safe.** With no `RESEND_API_KEY` (or
a send that failed) *and* the request coming from `localhost`/`127.0.0.1`
(the identical regex `originAllowed()` already tests local dev origins
against), `/account/request-link` hands the raw token back in the response
body as `devToken`. Gated on the literal local-origin pattern, not on "any
origin this worker will answer" — which also includes the real
`jukeff.com`/`www.jukeff.com` hosts — so this can never fire in production
regardless of whether the secret happens to be set there.

## Not done yet

- `chooseFor()` returns `null`. The CPU's real opinion needs the board, which
  is a megabyte of generated data the worker does not have. It will either be
  handed it at deploy time or ask the first connected client for it.
- No client. `app.js` does not know rooms exist yet.
- Chat is relayed but not stored, so a late joiner sees an empty room.
- GIPHY is not wired. The key must live here, not in the page — a key in
  client-side JavaScript is public.
