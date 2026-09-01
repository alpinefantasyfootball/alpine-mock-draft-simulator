-- 0002_signup.sql — the email capture list.
--
-- Phase 0 of accounts: there is still no login anywhere in Juke, and this
-- table does not create one. It is a mailing list of one column plus
-- provenance — an email, which dead end asked for it, and when — so that
-- the day accounts exist, Juke can tell everyone who asked to be told.
-- Nothing on the page ever reads this table; the worker only ever writes
-- to it.
CREATE TABLE IF NOT EXISTS signups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,

  -- Which dead end asked — "header", "locker", "room:waiver", and so on.
  -- A fixed set the client controls rather than free text, so this column
  -- stays meaningful without a lookup table to keep it honest.
  source     TEXT NOT NULL,

  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signups_created ON signups (created_at);
