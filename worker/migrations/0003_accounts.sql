-- 0003_accounts.sql — real accounts.
--
-- Clerk owns identity entirely: signup, login, password/OAuth, sessions,
-- email verification, all of it. This table is not a second copy of any of
-- that — it is the one row Juke itself needs per person, keyed by the id
-- Clerk already issues, so something Juke owns (a saved draft, not built
-- yet — see CLAUDE.md's Phase 4) has somewhere to belong.
--
-- Deliberately just an id and two timestamps for now. A display name and
-- email are not stored here: the client already has both, verified, from
-- its own Clerk session (useUser()) the moment someone is signed in, so a
-- second copy fetched and cached worker-side would be exactly the "two
-- sources of truth for one fact" this project's CLAUDE.md keeps finding
-- bugs in elsewhere. If a future feature needs Juke's own copy — a locker
-- that has to render without asking Clerk again, say — that is the
-- moment to add the columns and the fetch that fills them, not before.
CREATE TABLE IF NOT EXISTS users (
  clerk_id     TEXT PRIMARY KEY,
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at);
