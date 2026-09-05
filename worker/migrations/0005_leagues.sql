-- 0005_leagues.sql — a connected league follows an account.
--
-- Juke reads a league and never writes to it. Sleeper's public API has no
-- write endpoints at all, which is what makes that promise cheap to keep
-- rather than a policy somebody has to remember: there is no token here, no
-- OAuth grant, and nothing this worker could send that would change
-- anybody's roster. The unlock cards say "Connecting is read-only. Juke
-- never edits your league" and this schema is why that is true.
--
-- One row per (account, provider, league). The header's league switcher
-- implies more than one, and a manager with two Sleeper leagues is the
-- ordinary case rather than an edge, so the key is composite from the
-- start — retrofitting a second league onto a one-row-per-user table is
-- the kind of migration this avoids by costing nothing today.
CREATE TABLE IF NOT EXISTS connected_leagues (
  clerk_id     TEXT NOT NULL REFERENCES users(clerk_id),

  -- 'sleeper' today. ESPN, Yahoo and CBS are named on every unlock card in
  -- the app, so the column exists rather than the table being called
  -- sleeper_leagues — the second provider should be a row, not a schema
  -- change.
  provider     TEXT NOT NULL,
  league_id    TEXT NOT NULL,

  -- Which member of that league this account is. Sleeper's rosters are
  -- keyed by owner_id, so without this we know the league and not the
  -- reader's place in it — and every screen the connection unlocks (your
  -- record, your starters, your FAAB) is about their roster specifically.
  owner_id     TEXT,

  /* ---- Everything below is a CACHE, not a source of truth ----

     The name, season and size are Sleeper's to change, and this copy goes
     stale the moment somebody renames their league. It is here so the
     header's league chip can draw without a round trip to Sleeper on every
     page load.

     **"and it is refreshed whenever a snapshot is fetched" is what this
     comment used to say, and it was never true.** Nothing called putLeague()
     from a snapshot route, so refreshed_at only ever moved when somebody
     re-connected a league they were already connected to — a league renamed
     on Sleeper kept its old name in Juke's header indefinitely. Corrected in
     place rather than left standing.

     It IS refreshed now, by refreshLeagueCache() from GET /me/leagues, for
     the active league only and at most hourly. What forced it was 0008's
     draft time: a stale name is a cosmetic wrong, and a stale draft time is
     a countdown confidently pointing at the wrong instant.

     Same rule store.js already states about the player pool and the news
     cache: a cache and never a source of truth. Nothing may branch on
     these values — read them to draw a label, ask Sleeper for anything
     that matters. */
  name         TEXT NOT NULL,
  season       TEXT NOT NULL,
  total_teams  INTEGER,

  connected_at INTEGER NOT NULL,
  refreshed_at INTEGER NOT NULL,

  PRIMARY KEY (clerk_id, provider, league_id)
);

-- One person's leagues, newest connection first. The only query this table
-- serves today is "what has this account connected", which the header, the
-- You screen and every room ask on load.
CREATE INDEX IF NOT EXISTS idx_connected_leagues_owner
  ON connected_leagues (clerk_id, connected_at DESC);
