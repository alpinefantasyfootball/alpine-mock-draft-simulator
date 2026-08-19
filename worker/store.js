/* ==========================================================
   Juke — the cache database

   D1, bound as `DB`. Two things live in it: Sleeper's player pool,
   refreshed on a cron, and Tank01 headlines, written as a
   side-effect of serving them.

   Three rules hold everywhere in this file.

   **A missing binding is a normal condition, not a fault.** `wrangler dev`
   with no database_id, a keyless local run, the tests that drive the news
   path against a stub — none of those have a database and all of them must
   keep working exactly as they did. Every function here answers "no" to an
   absent `env.DB` rather than throwing, so nothing above it needs to know
   whether the cache exists.

   **Nothing here ever throws.** The news route's contract is that it fails by
   disappearing — the same contract the score strip has. A rejected promise on
   this path is an unhandled rejection on a page that is otherwise fine, so
   every call is wrapped and the failure is a return value.

   **This is a cache and never a source of truth.** players.js and stats.js are
   the board, generated nightly, and a room pins the version it started on
   because the CPU wobble reads a player's position in that array. A board
   built from here instead would be the league shape written down twice, in
   the one place where two clients disagreeing forks a live draft.
   ========================================================== */

/* SQLite has no date type, so every timestamp in this database is epoch
   seconds. Milliseconds would be the JavaScript-shaped choice and buys
   precision nothing here needs — these are cache clocks measured in hours. */
export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/* ----------------------------------------------------------
   The player pool
   ---------------------------------------------------------- */

const SLEEPER_POOL = "https://api.sleeper.app/v1/players/nfl";

/* The same escape hatch TANK01_BASE already is, for the same reason.

   The real endpoint is about five megabytes of live data, so a test that used
   it would be slow, would need the network, and could never assert a count —
   the pool moves every day. `SLEEPER_BASE` lets test-store.mjs serve a small
   canned pool with the awkward rows in it on purpose: a team defense, which
   has no full_name and whose id is the club code, and a fullback who qualifies
   on fantasy_positions rather than on position.

   It is read per call rather than closed over, because `env` is per request. */
function poolUrl(env) {
  return (env && env.SLEEPER_BASE) || SLEEPER_POOL;
}

/* The positions this app drafts, and nothing else.

   Sleeper's pool is every player it has ever heard of — around eleven
   thousand rows, most of them long-snappers and practice-squad linemen that
   no fantasy league starts. Filtering here rather than storing it all is the
   difference between four thousand rows a night and eleven thousand, and the
   rows we would be keeping cannot appear on any board this app builds.

   It is a literal rather than derived from POSITIONS in app.js because that
   file is the *page*, and the worker does not load it. Whichever way round
   that dependency ran would be the worse of the two. */
const POOL_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];

/* D1 allows 100 bound parameters per statement. Five columns a row puts the
   ceiling at exactly twenty, which is the wrong number to pick: a sixth column
   added later would silently start truncating a batch. Sixteen leaves room. */
const ROWS_PER_STATEMENT = 16;
const STATEMENTS_PER_BATCH = 40;

/* Refresh the pool. Returns a count, or null when there is no database.

   **Upsert, never replace.** A DELETE-then-INSERT is the obvious shape and
   loses the whole table if the fetch half-succeeds. It is also unnecessary: a
   player who has left the league is not a row that needs removing, he is a row
   whose `last_updated` stopped moving, which is a fact worth being able to
   read. Nothing here reads a stale row and the pool is bounded at a few
   thousand, so there is no growth to prune.

   **CPU is the thing to watch, and it has not been measured yet.** The
   response is about five megabytes and `res.json()` parses all of it before a
   single row is written, which is real CPU rather than the I/O the plan limits
   are generous about. If this is what trips, the answer is not to micro-tune
   the parse — there is no streaming JSON parser available without adding a
   dependency, which this project does not do. It is to move the sync into
   scripts/build_players.py, which already fetches this exact endpoint every
   morning where CPU costs nothing, and have it write through D1's HTTP API.
   Read the CPU time on a real run before deciding. */
export async function syncPlayerPool(env) {
  if (!env.DB) return null;

  try {
    const res = await fetch(poolUrl(env), {
      headers: { "accept": "application/json" }
    });
    if (!res.ok) throw new Error("sleeper " + res.status);

    const pool = await res.json();
    const rows = poolRows(pool, nowSeconds());
    if (!rows.length) throw new Error("sleeper returned no usable rows");

    let written = 0;
    for (const batch of chunk(chunk(rows, ROWS_PER_STATEMENT), STATEMENTS_PER_BATCH)) {
      await env.DB.batch(batch.map((group) => upsertPlayers(env, group)));
      written += batch.reduce((n, group) => n + group.length, 0);
    }
    return written;
  } catch (err) {
    /* Logged, not thrown. A cron that throws is a red mark in the dashboard
       and a cache that is one day staler, and only one of those two is worth
       anything — but the log line is how you find out which morning it
       stopped, so it is not swallowed silently either. */
    console.error("player pool sync failed:", err && err.message);
    return null;
  }
}

/* Sleeper's payload is an object keyed by id, so this walks values.

   A team defense is the row to be careful with: its id is the club code
   ("PIT"), and it carries no `full_name`, so a naive read stores a nameless
   row. It is eleven people rather than a person — the same reason bioLine()
   gives a defense its own line instead of a strip of dashes. */
function poolRows(pool, stamp) {
  const rows = [];
  for (const id of Object.keys(pool || {})) {
    const p = pool[id] || {};
    const pos = String(p.position || "").toUpperCase();
    const fantasy = Array.isArray(p.fantasy_positions) ? p.fantasy_positions : [];

    const drafted = POOL_POSITIONS.indexOf(pos) >= 0 ||
                    fantasy.some((f) => POOL_POSITIONS.indexOf(String(f).toUpperCase()) >= 0);
    if (!drafted) continue;

    const name = String(
      p.full_name ||
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      id
    ).trim().slice(0, 80);
    if (!name) continue;

    rows.push([
      String(id).slice(0, 24),
      name,
      pos || null,
      p.team ? String(p.team).toUpperCase().slice(0, 8) : null,
      stamp
    ]);
  }
  return rows;
}

function upsertPlayers(env, group) {
  const values = group.map(() => "(?, ?, ?, ?, ?)").join(", ");
  return env.DB.prepare(
    "INSERT INTO players (player_id, name, position, team, last_updated) VALUES " +
    values +
    " ON CONFLICT(player_id) DO UPDATE SET" +
    "   name = excluded.name," +
    "   position = excluded.position," +
    "   team = excluded.team," +
    "   last_updated = excluded.last_updated"
  ).bind(...group.flat());
}

/* ----------------------------------------------------------
   Headlines
   ---------------------------------------------------------- */

/* Whether a headline is one we may show at all.

   Three conditions, and each is a rule from elsewhere in the project rather
   than a preference:

   - **A title**, or there is nothing to draw.
   - **A source**, because we link and attribute rather than republish, and an
     unattributed headline is the version of this feature that is not allowed.
   - **An http(s) link**, because a `javascript:` href is an outside party
     running script in the page, and because a card the page will refuse to
     build is a card that should never have been sent to it.

   It lives here, next to the CHECK constraints that encode the same three
   rules, and `fetchUpstreamNews()` imports it rather than writing a second
   copy. That is not tidiness: the two paths have to agree exactly or a cache
   hit renders a different set of cards from a cache miss, which is a
   difference only the readers who happen to hit the cache ever see. The first
   version of this filtered on the way *into* the database and not on the way
   out of the provider, and a cold ask returned five cards where a warm one
   returned four.

   safeNewsUrl() in the page still checks the link before building an anchor.
   Both ends of the rule are cheap, and the page cannot assume the worker is
   the only thing that ever talks to it. */
export function showableNews(item) {
  if (!item || !item.title || !item.source) return false;
  return /^https?:\/\//i.test(String(item.url || ""));
}

/* The list, exactly as it will be served — from either tier.

   This is the whole answer to "a cache hit must be indistinguishable from a
   cache miss", and it took three goes to get there because the divergences
   hide in different places:

   - **the filter**, which dropped an unlinkable card on the way into the
     database and not on the way out of the provider;
   - **the duplicate**, because the primary key is (player, url) and the feed
     really does return one story twice under two headlines — so the database
     kept three where the response carried four;
   - **the order**, because the response was in the provider's order and
     `cachedNews()` reads back newest-first. Nobody would call either wrong,
     and they are not the same list.

   Every one of those is invisible to whoever is testing, because a developer
   with a warm cache and a developer with a cold one see different things and
   both look right. So the normalisation happens once, here, and both paths
   call it.

   Sorted newest-first with the link as the tiebreaker, which is what the
   ORDER BY in cachedNews() sorts by, so two headlines stamped the same day
   cannot come back in one order from the provider and the other from D1. */
export function usableNews(list) {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(list) ? list : []) {
    if (!showableNews(item)) continue;
    const url = String(item.url).slice(0, 400);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(item);
  }

  return out.sort(function (a, b) {
    const at = publishedSeconds(a.at);
    const bt = publishedSeconds(b.at);
    if (at !== bt) return bt - at;
    return String(a.url) < String(b.url) ? -1 : 1;
  });
}

/* Twelve hours, and the number comes from the allowance rather than from
   taste.

   Tank01's free tier is a thousand calls a month. The edge cache in front of
   this is fifteen minutes, which is the freshness tier and is per-colocation
   and evictable — so on its own the worst case is one upstream call per
   player per quarter hour per data centre, and a board sweep of 201 players
   is a fifth of the month in one sitting. This tier is the quota tier: it is
   global, it survives eviction, and a floor of twelve hours caps the spend at
   two calls per player per day.

   Which is the arithmetic to redo before changing it. 1000 / 30 days / 2 calls
   is about **sixteen distinct players a day**, which is a drafting session or
   two and not a board sweep. Halving this to six hours halves that to eight.
   Headlines matter most on a game day and change hourly at most, so the
   freshness being traded away is small and the allowance being protected is
   the whole feature. */
const NEWS_DB_TTL = 43200;

/* What we have on file, or null.

   Null means "ask upstream" and covers three different situations on purpose:
   no database, nothing stored, and stored-but-stale. The caller does the same
   thing in all three, so distinguishing them here would be a distinction with
   nowhere to go.

   An empty `items` array is *not* null, and that is the point of the lookups
   table. "He has no news today" is an answer, and re-asking for it would spend
   the allowance on exactly the players who have nothing to say. */
export async function cachedNews(env, playerId) {
  if (!env.DB) return null;

  try {
    const key = playerId || "none";
    const floor = nowSeconds() - NEWS_DB_TTL;

    const lookup = await env.DB
      .prepare("SELECT fetched_at FROM news_lookups WHERE player_id = ? AND fetched_at > ?")
      .bind(key, floor)
      .first();
    if (!lookup) return null;

    /* Ordered by the article's own date, newest first, with the rows that
       carried no date last rather than first. A missing timestamp is 0, and 0
       sorted as a number is the oldest thing in the table — which is the
       correct end for it, because a headline with no date is the one we can
       say least about. This is the same rule sortedPlayers() follows: a
       missing number is not a small number. */
    const rows = await env.DB.prepare(
      "SELECT news_id, headline, content, source, published_text" +
      " FROM player_news WHERE player_id = ?" +
      " ORDER BY timestamp DESC LIMIT 20"
    ).bind(key).all();

    /* The shape fetchUpstreamNews() returns, field for field. A cache hit and a
       cache miss have to be indistinguishable to the page — `at` is the
       provider's own string out of published_text rather than the sortable
       integer reformatted, because the integer is for the ORDER BY above and
       has no business on a card. */
    /* Back through the same normalisation the upstream path uses, and that is
       not belt-and-braces — without it a cache hit and a cache miss really do
       hand the page different orders.

       `ORDER BY timestamp DESC` has no tie-break, and `publishedSeconds()`
       maps a missing date to 0, so every undated headline ties at zero and
       comes back in whatever order the rows happen to sit in. usableNews()
       breaks that tie on the url. Tank01 sends no date on plenty of items —
       that is why `at` had to stop falling back to the player id — so the tie
       is the common case rather than a corner of one, and the difference is
       visible only to the readers who happen to hit the cache, which is the
       hardest kind of difference to ever notice.

       The filter and the dedup it also applies are already guaranteed here by
       the CHECK constraints and the composite primary key. The ordering is the
       one that was actually diverging. */
    return usableNews((rows.results || []).map((r) => ({
      title: r.headline,
      summary: r.content || "",
      source: r.source,
      at: r.published_text || "",
      url: r.news_id
    })));
  } catch (err) {
    /* A cache miss, as far as the caller is concerned. A database that is down
       must cost a sheet its cached headlines and nothing else. */
    console.error("news cache read failed:", err && err.message);
    return null;
  }
}

/* Keep what we just fetched. Returns whether it was kept.

   Called through ctx.waitUntil(), so it runs after the response has gone. The
   reader is not waiting on a write to a cache that exists to make *later*
   readers faster, and a write that fails must not turn a served answer into an
   error.

   The player's rows are replaced rather than merged, in one batch so it is one
   transaction. A story that has dropped off the feed has dropped off the feed;
   merging would accumulate every headline a player ever had and quietly serve
   last month's alongside this morning's. */
export async function storeNews(env, playerId, items) {
  if (!env.DB) return false;

  const key = playerId || "none";
  const stamp = nowSeconds();
  const list = Array.isArray(items) ? items : [];

  try {
    /* The same normalisation the response went through.

       Which looks redundant and is not, twice over. This table's CHECK
       constraints refuse an unshowable row, and a batch is one transaction, so
       a single bad row does not fail itself — it throws away every good row
       beside it. And the primary key is (player_id, url), so one repeated
       article inside a batch is the same all-or-nothing failure. */
    const kept = usableNews(list);

    /* `item_count` counts what survived, not what arrived. A count that
       disagrees with the rows beside it is how you stop believing the cache,
       which is the same reason link_source_ids() tallies the join after the
       fact rather than as it goes. */
    const statements = [
      env.DB.prepare("DELETE FROM player_news WHERE player_id = ?").bind(key),
      env.DB.prepare(
        "INSERT INTO news_lookups (player_id, fetched_at, item_count) VALUES (?, ?, ?)" +
        " ON CONFLICT(player_id) DO UPDATE SET" +
        "   fetched_at = excluded.fetched_at," +
        "   item_count = excluded.item_count"
      ).bind(key, stamp, kept.length)
    ];

    for (const item of kept) {
      const url = String(item.url).slice(0, 400);

      statements.push(env.DB.prepare(
        "INSERT INTO player_news" +
        " (news_id, player_id, headline, content, source, url," +
        "  timestamp, published_text, fetched_at)" +
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        url,
        key,
        String(item.title).slice(0, 200),
        String(item.summary || "").slice(0, 400),
        String(item.source).slice(0, 60),
        url,
        publishedSeconds(item.at),
        String(item.at || "").slice(0, 40),
        stamp
      ));
    }

    await env.DB.batch(statements);
    return true;
  } catch (err) {
    console.error("news cache write failed:", err && err.message);
    return false;
  }
}

/* The provider's date as epoch seconds, or 0.

   `Date.parse` on a string the provider did not promise is a date returns NaN,
   and NaN bound to an INTEGER column is not an error anybody sees — it is a
   row that sorts unpredictably for ever. A field with no usable value is 0,
   which the ORDER BY above puts last on purpose. */
function publishedSeconds(raw) {
  if (!raw) return 0;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/* ----------------------------------------------------------
   Small things
   ---------------------------------------------------------- */

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
