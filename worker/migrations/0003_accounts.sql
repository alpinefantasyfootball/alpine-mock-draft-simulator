-- 0003_accounts.sql — real accounts: email + magic link, sessions, and the
-- server-side locker.
--
-- Phase 1 of accounts, replacing the "no login anywhere" note 0002_signup.sql
-- left for this day. Five tables, and each is scoped as narrowly as the thing
-- it does:
--
--   accounts       one row per person: an email and when they signed up.
--   magic_links    one-time sign-in tokens, hashed at rest.
--   sessions       long-lived, revocable bearer tokens, also hashed at rest.
--   saved_draft    the in-progress save, one per account -- mirrors
--                  localStorage's SAVE_KEY.
--   draft_history  completed mocks, many per account -- mirrors
--                  localStorage's HISTORY_KEY entries.
--
-- Both locker tables store their payload as a JSON blob rather than as
-- columns. The shape of a save/history entry lives in app.js
-- (saveDraft()/recordHistory()) and nowhere else -- re-encoding it as SQL
-- columns here would be exactly the "league shape written down twice"
-- mistake CLAUDE.md already has a rule against, just for the locker's shape
-- instead. The server's job is to hold the blob durably and hand it back
-- unchanged, not to understand it.
--
-- Nothing here is a source of truth for what a draft *is* -- the frozen
-- report inside a history entry, the picks, the league config -- all of
-- that is still exactly what app.js already produces. This is the account
-- system, not a second engine.

CREATE TABLE IF NOT EXISTS accounts (
  -- A random id rather than AUTOINCREMENT, so a session/locker row can name
  -- an account without anything downstream being able to infer how many
  -- accounts exist or in what order, the way a sequential id would leak.
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,

  -- Set once, the moment the local-mocks-adopted migration actually runs for
  -- this account -- never on account creation itself. NULL means "this
  -- account has never completed a migration": the client is safe to send
  -- its local locker for adoption. Non-NULL means a repeat sign-in, on any
  -- device, must not re-migrate -- see account.js's own comment on exactly
  -- this idempotency requirement ("do not silently discard and do not
  -- silently duplicate on repeat sign-ins").
  migrated_at INTEGER
);

-- One-time sign-in tokens. token_hash is SHA-256 of the actual token, the
-- same reason a password is never stored in plain text: the raw token is a
-- bearer credential for fifteen minutes, and a database dump must not hand
-- one over usable. The email is denormalised onto the row (rather than
-- joined through accounts) because a link can be requested for an address
-- that has no account yet -- consuming it is what creates one.
CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,

  -- NULL until consumed, then set once. A second /account/consume with the
  -- same token has to answer "already used" rather than silently minting a
  -- second session for whoever asks first -- see the reused-link acceptance
  -- criterion.
  used_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_magic_links_email   ON magic_links (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links (expires_at);

-- Long-lived, revocable sessions. Hashed at rest for the same reason as
-- magic_links above -- this is the credential every authenticated request
-- carries, so a database dump must not be a list of live bearer tokens.
--
-- Not a JWT. A signed, self-contained token cannot be revoked without a
-- denylist, which is a database table anyway -- so this project skips the
-- signing complexity and stores the one table it would have needed regardless.
-- "Least infrastructure for the most reliability," the same reasoning the
-- Phase 1 plan gives for magic links over passwords, applied a second time
-- to sessions.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  account_id   TEXT NOT NULL REFERENCES accounts (id),
  created_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,

  -- NULL while live. A visible "sign out" sets this rather than deleting
  -- the row, so a session can't be reused between the moment it's revoked
  -- and any read that might still be racing it -- one flag, checked
  -- everywhere a session is validated, same shape as magic_links.used_at.
  revoked_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions (account_id);

-- The in-progress save. One row per account -- a fresh sign-in-and-save
-- replaces it outright, the same way localStorage's SAVE_KEY holds exactly
-- one draft and a new one overwrites the last.
CREATE TABLE IF NOT EXISTS saved_draft (
  account_id TEXT PRIMARY KEY REFERENCES accounts (id),
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Completed mocks. id is the entry's own client-generated id (recordHistory()
-- in app.js: "h" + a timestamp + a random suffix) rather than a fresh
-- server-side one -- reusing it is what makes migration idempotent: sending
-- the same local history twice (a retried request, a second device that
-- happens to hold the same entries) is INSERT OR IGNORE against a primary
-- key it already has, not a duplicate row.
--
-- The key is (account_id, id), not id alone. id is only *practically*
-- unique -- a timestamp plus Math.random(), not a UUID -- so two different
-- accounts can in principle generate the same one, and a bare `id PRIMARY
-- KEY` would let the second account's INSERT OR IGNORE silently vanish
-- against the first account's row rather than the collision it actually is.
-- Found by test-accounts.mjs against real (if manufactured) fixture ids.
CREATE TABLE IF NOT EXISTS draft_history (
  id           TEXT NOT NULL,
  account_id   TEXT NOT NULL REFERENCES accounts (id),
  data         TEXT NOT NULL,

  -- Denormalised out of the JSON blob, same reasoning as player_news'
  -- timestamp column: this is what ORDER BY and the HISTORY_LIMIT prune
  -- need, and neither is worth a JSON parse per row to get to.
  completed_at INTEGER NOT NULL,

  PRIMARY KEY (account_id, id)
);
CREATE INDEX IF NOT EXISTS idx_draft_history_account ON draft_history (account_id, completed_at DESC);
