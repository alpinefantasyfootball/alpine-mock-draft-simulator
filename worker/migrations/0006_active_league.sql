-- 0006_active_league.sql — which of an account's leagues is the one on screen.
--
-- 0005 keyed this table (clerk_id, provider, league_id) on the argument that
-- "a manager with two Sleeper leagues is the ordinary case rather than an
-- edge", and it was right: the table has always held several. What was
-- missing is any way to say which one the app is currently showing, so
-- listLeagues() ordered by connected_at and every reader took the head —
-- meaning the active league was "the one connected most recently" and there
-- was no way to go back to the other one short of disconnecting and
-- reconnecting it.
--
-- ---- Why a timestamp rather than a flag ----
--
-- The obvious shape is `active INTEGER` on this table, or `active_league_id`
-- on users. Both make exclusivity something code has to maintain: setting one
-- means clearing the others, so a switch is two writes that must not be
-- interleaved, and disconnecting the active league leaves a user with none
-- selected until something notices.
--
-- Most-recently-selected-wins needs none of that. A switch is one UPDATE, the
-- head of the ordering is the active league by construction, and disconnecting
-- it promotes whatever was selected before it with no repair step at all.
--
-- ---- And it degrades into exactly today's behaviour ----
--
-- Backfilled from connected_at, so before anybody switches anything the order
-- is unchanged and the league that is active is the one that was already
-- being shown. A user who never opens the switcher cannot tell this ran.
--
-- The site deploys itself from git and the worker does not, so there is a
-- window where new worker code meets an unmigrated database. listLeagues()
-- falls back to the 0005 query for exactly that, rather than reporting an
-- account's leagues as none.
ALTER TABLE connected_leagues ADD COLUMN selected_at INTEGER;

UPDATE connected_leagues SET selected_at = connected_at WHERE selected_at IS NULL;

-- The ordering every read uses now. connected_at keeps its own index from
-- 0005: it is still what "newest connection" means on the You screen.
CREATE INDEX IF NOT EXISTS idx_connected_leagues_selected
  ON connected_leagues (clerk_id, selected_at DESC);
