-- 0004_drafts.sql — a saved draft and a locker follow an account.
--
-- app.js already has two localStorage keys and a versioned shape for each:
-- SAVE_KEY (one in-progress draft, v: 2, saveDraft()/readSave()) and
-- HISTORY_KEY (an array of finished-draft entries, recordHistory()/
-- readHistory()). Both tables here store that exact JSON whole, in a
-- `data` column, rather than decomposing it into SQL columns of our own.
--
-- That is deliberate, not a shortcut. app.js already carries its own
-- backward-compatibility rules for both shapes — "a save written before
-- superflex existed has no such key", "entries recorded before `report`
-- existed fall back to the old live-recompute path" — and a second,
-- server-side schema would either duplicate every one of those rules or
-- drift from them the moment app.js's shape changes again. The client
-- already knows how to read its own history; the server's whole job is
-- being a reliable place to put it, keyed by who it belongs to.
CREATE TABLE IF NOT EXISTS saved_drafts (
  -- One row per person: exactly mirrors SAVE_KEY being a single
  -- localStorage entry rather than a list. A second device signing in
  -- and saving overwrites this the same way a second tab would overwrite
  -- the same localStorage key — see worker/README.md on why this is
  -- last-write-wins rather than merged.
  clerk_id   TEXT PRIMARY KEY REFERENCES users(clerk_id),
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS draft_history (
  -- recordHistory() already mints this id client-side
  -- ("h" + Date.now().toString(36) + …) before this table exists — reused
  -- rather than an AUTOINCREMENT of our own, so an entry has one id its
  -- whole life instead of a local one and a server one that could disagree.
  id           TEXT PRIMARY KEY,
  clerk_id     TEXT NOT NULL REFERENCES users(clerk_id),
  data         TEXT NOT NULL,

  -- Pulled out of `data` and duplicated as a real column for exactly one
  -- reason: ORDER BY. Every other field the Locker wants is inside the
  -- JSON and stays there.
  completed_at INTEGER NOT NULL,

  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_draft_history_owner
  ON draft_history (clerk_id, completed_at DESC);
