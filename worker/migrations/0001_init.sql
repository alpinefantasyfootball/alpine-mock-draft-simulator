-- 0001_init.sql — the two cache tables.
--
-- This database is a *cache*, and that word is load-bearing. Nothing in here
-- is a source of truth: `players.js` and `stats.js` are generated nightly by
-- scripts/build_players.py and are what the draft board is built from, and a
-- room pins the data version it started on because the CPU wobble reads a
-- player's position in that array. A second player list that the board could
-- read would be the league shape written down twice, in the one place where
-- two clients disagreeing forks a live draft.
--
-- So: the worker reads these tables. The page never does.

-- Sleeper's pool, as much of it as we have any use for server-side.
--
-- Keyed by Sleeper's own id, because that is the id every other generated
-- file in this project is keyed by (stats.js is `by Sleeper ID`), so a row
-- here joins to what already exists without a translation step.
CREATE TABLE IF NOT EXISTS players (
  player_id    TEXT PRIMARY KEY,
  name         TEXT NOT NULL,

  -- Sleeper's own position, unaltered, which is not the same set as the one the
  -- sync admits on. A row gets in if either `position` or `fantasy_positions`
  -- names a position we draft, so a fullback whose fantasy_positions is ["RB"]
  -- is stored with position 'FB' — measured at 111 of those, plus a handful of
  -- punters and corners Sleeper tags loosely.
  --
  -- So `WHERE position IN ('QB','RB','WR','TE','K','DEF')` returns *fewer* rows
  -- than the table holds, and that is the trap worth knowing about before
  -- writing a query against this column. Storing the qualifying fantasy
  -- position instead would make the column filterable and would make this
  -- table disagree with every other Sleeper-keyed thing in the project, which
  -- is the worse of the two.
  position     TEXT,

  team         TEXT,

  -- Epoch seconds, not a string. SQLite has no date type, so a TEXT date is
  -- a thing every comparison has to parse; an integer sorts and subtracts as
  -- it is. It is also the only staleness signal here: the sync upserts and
  -- never deletes, so a player who has left the league is not a missing row,
  -- he is a row whose last_updated stopped moving.
  last_updated INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_position     ON players (position);
CREATE INDEX IF NOT EXISTS idx_players_team         ON players (team);
CREATE INDEX IF NOT EXISTS idx_players_last_updated ON players (last_updated);

-- Headlines, cached.
--
-- `player_id` here is the *provider's* id, not Sleeper's, and that is
-- deliberate rather than sloppy: /news is asked for by the Tank01 id that
-- link_source_ids() writes into `x` on a stats record, because a name search
-- at request time is how one Josh Allen ends up wearing the other one's news.
-- Which is exactly why there is no foreign key to players(player_id) — the
-- two columns are ids from two different sources and constraining one to the
-- other would refuse every legitimate row.
CREATE TABLE IF NOT EXISTS player_news (
  news_id    TEXT NOT NULL,
  player_id  TEXT NOT NULL,
  headline   TEXT NOT NULL,

  -- The clipped summary, and only ever that. We link and attribute; we do not
  -- republish. Reproducing an article body is what a licence buys, so the
  -- length limit is a CHECK rather than a comment — a column that will not
  -- physically hold an article cannot quietly start holding one.
  content    TEXT NOT NULL DEFAULT '',

  -- Never dropped. An unattributed headline is the version of this feature we
  -- are not allowed to show, so it is NOT NULL with a length floor rather
  -- than a nullable column somebody defaults to ''.
  source     TEXT NOT NULL,
  url        TEXT NOT NULL,

  -- When the provider says it was published, as epoch seconds, for sorting.
  -- 0 when it did not say, because a field with no value is empty and does not
  -- borrow one — the same rule that stopped every card reading
  -- "TANK01 · 4429795". 0 sorts last, which is the right end for a headline
  -- we can say least about.
  timestamp  INTEGER NOT NULL DEFAULT 0,

  -- And what the provider literally said, which is what the page draws.
  --
  -- Two columns for one fact, deliberately. The integer is for ORDER BY and is
  -- useless on screen; the text is for the card and is useless for sorting. If
  -- only the integer were stored, a cache hit would render a date this worker
  -- reformatted while a miss rendered the provider's own string — the same
  -- answer in two shapes, differing only for the readers who happen to hit the
  -- cache, which is the hardest kind of difference to ever notice.
  published_text TEXT NOT NULL DEFAULT '',

  -- When *we* asked. This is the TTL clock; `timestamp` is the article's own
  -- date and is no use for deciding whether to re-ask.
  fetched_at INTEGER NOT NULL,

  -- The provider returns no id of any kind, so news_id is the article link:
  -- the one field that is unique per article and already required. Composite
  -- with player_id because one article legitimately attaches to two players —
  -- a trade is news about both ends of it — and a bare url primary key would
  -- make the second player's copy a conflict and throw his news away.
  PRIMARY KEY (player_id, news_id),

  CHECK (length(headline) > 0),
  CHECK (length(content) <= 400),
  CHECK (length(source) > 0),
  CHECK (url LIKE 'http://%' OR url LIKE 'https://%')
);

CREATE INDEX IF NOT EXISTS idx_news_player  ON player_news (player_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_news_fetched ON player_news (fetched_at);

-- When we last asked about a player, whatever the answer was.
--
-- Not in the ask, and the cache does not work without it. "He has no news
-- today" is a fact worth keeping — re-asking for it would spend the allowance
-- on exactly the players who have nothing — and an empty answer stores zero
-- rows in player_news, which is byte-for-byte indistinguishable from never
-- having asked. That is the same line `configured` already draws between "not
-- wired up" and "nothing today", and it needs somewhere to be recorded.
CREATE TABLE IF NOT EXISTS news_lookups (
  player_id  TEXT PRIMARY KEY,
  fetched_at INTEGER NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0
);
