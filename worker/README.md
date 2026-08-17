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
| `draft-room.js` | The Durable Object. Sockets, storage, the alarm — and nothing else. |
| `wrangler.toml` | Binding and migration. One class, `DraftRoom`. |
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

Only the shape `{ title, summary, source, at, url }` reaches the page.
Normalising here rather than passing the provider's payload through means
swapping provider is a change to `fetchUpstreamNews()` and nothing else, and
it keeps the number of fields the page has to escape down to what it draws.
**`source` is never dropped** — we link and attribute rather than republish,
and an unattributed headline is the version of this that is not allowed.

## Not done yet

- `chooseFor()` returns `null`. The CPU's real opinion needs the board, which
  is a megabyte of generated data the worker does not have. It will either be
  handed it at deploy time or ask the first connected client for it.
- No client. `app.js` does not know rooms exist yet.
- Chat is relayed but not stored, so a late joiner sees an empty room.
- GIPHY is not wired. The key must live here, not in the page — a key in
  client-side JavaScript is public.
