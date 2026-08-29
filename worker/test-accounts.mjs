/* Drive the /account/* routes against a running worker over plain HTTP.

   Everything in worker/store.js's "Accounts — phase 1" section is plain D1
   reads and writes with no Durable Object involved, so unlike
   test-sockets.mjs this needs no WebSocket at all — just fetch, the same
   way a browser (or account.js) talks to these routes.

       cd worker && wrangler d1 migrations apply juke_db --local
       wrangler dev --port 8787 --local
       node worker/test-accounts.mjs

   Needs Node 22 or newer for fetch as a global. No RESEND_API_KEY is
   required: every request here carries a localhost Origin, which is what
   makes /account/request-link hand back `devToken` instead of emailing it
   — see accountRequestLink()'s own comment in draft-room.js for why that
   path is safe to rely on in a test but would never fire in production. */

const HTTP = (process.env.JUKE_WORKER_HTTP || "http://127.0.0.1:8787");
const ORIGIN = "http://localhost:8765"; // the local-dev regex originAllowed() and isLocalOrigin() both accept

const fails = [];
const note = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) fails.push(`${name}\n    got  ${g}\n    want ${w}`);
  else note.push("ok  " + name);
}

async function call(path, opts) {
  const headers = Object.assign({ "content-type": "application/json", "Origin": ORIGIN }, (opts && opts.headers) || {});
  const res = await fetch(HTTP + path, Object.assign({}, opts, { headers }));
  let body = null;
  try { body = await res.json(); } catch (err) {}
  return { status: res.status, body };
}

// A fresh, random address per run so a repeat run of this file never trips
// the 60-second per-email cooldown against a previous run's own rows.
const EMAIL = `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/* ---- request a link, and the cooldown ---- */

const r1 = await call("/account/request-link", { method: "POST", body: JSON.stringify({ email: EMAIL }) });
check("request-link ok", r1.body.ok, true);
check("request-link hands back a dev token on localhost", typeof r1.body.devToken, "string");
const token = r1.body.devToken;

const r2 = await call("/account/request-link", { method: "POST", body: JSON.stringify({ email: EMAIL }) });
check("a second immediate request for the same address is refused", r2.body, { ok: false, error: "too-soon" });
check("too-soon answers 429", r2.status, 429);

const rBadEmail = await call("/account/request-link", { method: "POST", body: JSON.stringify({ email: "not-an-email" }) });
check("a malformed address is refused", rBadEmail.body, { ok: false, error: "bad-email" });
check("bad-email answers 400", rBadEmail.status, 400);

const rBadOrigin = await fetch(HTTP + "/account/request-link", {
  method: "POST",
  headers: { "content-type": "application/json", "Origin": "https://evil.example" },
  body: JSON.stringify({ email: "x@example.com" })
});
check("an origin we don't serve is refused before the DB is touched", rBadOrigin.status, 403);

/* ---- consuming the link ---- */

const rUnknown = await call("/account/consume", { method: "POST", body: JSON.stringify({ token: "not-a-real-token" }) });
check("an unrecognised token", rUnknown.body, { ok: false, error: "unknown" });

const rConsume = await call("/account/consume", { method: "POST", body: JSON.stringify({ token }) });
check("consume succeeds", rConsume.body.ok, true);
check("a brand-new account has never migrated", rConsume.body.account?.migratedAt, null);
check("the account email matches what was requested", rConsume.body.account?.email, EMAIL);
const session = rConsume.body.sessionToken;
check("a session token comes back", typeof session, "string");

const rReuse = await call("/account/consume", { method: "POST", body: JSON.stringify({ token }) });
check("reusing the same link is refused", rReuse.body, { ok: false, error: "used" });
check("used answers 400", rReuse.status, 400);

/* ---- the session itself ---- */

const rSession = await call("/account/session", { headers: { "x-juke-session": session } });
check("a valid session reports signed in", rSession.body.ok, true);
check("with the same account", rSession.body.account?.email, EMAIL);

const rBadSession = await call("/account/session", { headers: { "x-juke-session": "not-a-real-session" } });
check("an invalid session is refused", rBadSession.body, { ok: false, error: "signed-out" });
check("signed-out answers 401", rBadSession.status, 401);

const rNoSession = await call("/account/session", {});
check("no session header at all is refused the same way", rNoSession.body, { ok: false, error: "signed-out" });

/* ---- the server locker: empty, then migrated, then synced ---- */

const rEmpty = await call("/account/locker", { headers: { "x-juke-session": session } });
check("a fresh account's locker is empty", rEmpty.body, { ok: true, save: null, history: [] });

const localSave = { v: 2, mySlot: 0, league: { teams: 10 }, picks: ["Player A"] };
const localHistory = [
  { id: "h1", completedAt: 1700000000000, picks: ["Player A", "Player B"] },
  { id: "h2", completedAt: 1700000001000, picks: ["Player C"] }
];

const rMigrate = await call("/account/migrate", {
  method: "POST",
  headers: { "x-juke-session": session },
  body: JSON.stringify({ save: localSave, history: localHistory })
});
check("migrating a browser's local locker", rMigrate.body, { ok: true, migratedCount: 2 });

const rMigrateAgain = await call("/account/migrate", {
  method: "POST",
  headers: { "x-juke-session": session },
  body: JSON.stringify({ save: localSave, history: localHistory })
});
check("migrating twice for the same account is refused", rMigrateAgain.body, { ok: false, error: "already-migrated" });
check("already-migrated answers 409", rMigrateAgain.status, 409);

const rAfterMigrate = await call("/account/locker", { headers: { "x-juke-session": session } });
check("the locker now holds the migrated save", rAfterMigrate.body.save, localSave);
check("and both history entries, newest first", rAfterMigrate.body.history.map((e) => e.id), ["h2", "h1"]);

// Write-through sync: one new history entry, then clearing the save.
const rPushHistory = await call("/account/locker", {
  method: "POST",
  headers: { "x-juke-session": session },
  body: JSON.stringify({ historyEntry: { id: "h3", completedAt: 1700000002000, picks: ["Player D"] } })
});
check("pushing one new history entry", rPushHistory.body, { ok: true });

const rClearSave = await call("/account/locker", {
  method: "POST",
  headers: { "x-juke-session": session },
  body: JSON.stringify({ save: null })
});
check("clearing the save", rClearSave.body, { ok: true });

const rAfterSync = await call("/account/locker", { headers: { "x-juke-session": session } });
check("the save is cleared", rAfterSync.body.save, null);
check("all three history entries are present, newest first", rAfterSync.body.history.map((e) => e.id), ["h3", "h2", "h1"]);

// Resending an entry the account already has is a no-op, not a duplicate —
// the same idempotency migrate() relies on, exercised here through the
// ongoing-sync route instead.
const rResend = await call("/account/locker", {
  method: "POST",
  headers: { "x-juke-session": session },
  body: JSON.stringify({ historyEntry: localHistory[0] })
});
check("resending an entry the account already has", rResend.body, { ok: true });
const rAfterResend = await call("/account/locker", { headers: { "x-juke-session": session } });
check("does not duplicate it", rAfterResend.body.history.length, 3);

const rDeleteEntry = await call("/account/locker/delete", {
  method: "POST",
  headers: { "x-juke-session": session },
  body: JSON.stringify({ id: "h3" })
});
check("deleting one history entry", rDeleteEntry.body, { ok: true });
const rAfterDelete = await call("/account/locker", { headers: { "x-juke-session": session } });
check("leaves the other two", rAfterDelete.body.history.map((e) => e.id), ["h2", "h1"]);

/* ---- signing out ---- */

const rSignOut = await call("/account/sign-out", { method: "POST", headers: { "x-juke-session": session } });
check("signing out", rSignOut.body, { ok: true });

const rAfterSignOut = await call("/account/session", { headers: { "x-juke-session": session } });
check("the session is dead immediately after", rAfterSignOut.body, { ok: false, error: "signed-out" });

const rSignOutAgain = await call("/account/sign-out", { method: "POST", headers: { "x-juke-session": session } });
check("signing out an already-dead session is still a success", rSignOutAgain.body, { ok: true });

/* ---- account deletion, on a second, freshly-signed-in address ---- */

const DELETE_EMAIL = `delete-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
const rLink2 = await call("/account/request-link", { method: "POST", body: JSON.stringify({ email: DELETE_EMAIL }) });
const rConsume2 = await call("/account/consume", { method: "POST", body: JSON.stringify({ token: rLink2.body.devToken }) });
const session2 = rConsume2.body.sessionToken;

const rDelete = await call("/account/delete", { method: "POST", headers: { "x-juke-session": session2 } });
check("deleting the account", rDelete.body, { ok: true });

const rAfterDeleteSession = await call("/account/session", { headers: { "x-juke-session": session2 } });
check("its session is gone too", rAfterDeleteSession.body, { ok: false, error: "signed-out" });

console.log(note.join("\n"));
console.log("");
if (fails.length) {
  console.log("FAIL " + fails.length);
  fails.forEach((f) => console.log("  x " + f));
  process.exit(1);
}
console.log(`OK — ${note.length} assertions over the account routes`);
