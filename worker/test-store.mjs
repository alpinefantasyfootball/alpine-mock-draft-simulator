/* The write path's own foreign key, tested without a Clerk token.

   `saved_drafts.clerk_id` and `draft_history.clerk_id` both carry
   `REFERENCES users(clerk_id)`, and D1 enforces it — an insert against a
   clerk_id with no users row fails with `FOREIGN KEY constraint failed`.
   That row was only ever created by touchUser(), which is only called
   from `GET /me`, which nothing on the client has ever called. So every
   save and every history entry failed the moment it reached D1, for every
   account, from the day sync shipped.

   It was invisible to everything this project runs. test-auth.mjs covers
   only the signed-out path by construction (nothing offline can sign a
   Clerk token), the route answered a perfectly healthy 200, and every
   layer under it reports failure as a falsy value — so the page could say
   "could not reach your account" and nothing could say why.

   This is the level that can be tested offline: not whether D1 accepts the
   write, which needs a real database, but whether store.js ISSUES the user
   upsert alongside it. A stub binding records what was prepared. The
   database's own half is verified separately and once, by hand:

       wrangler d1 migrations apply juke_db --local -c worker/wrangler.toml
       wrangler d1 execute juke_db --local -c worker/wrangler.toml \
         --command "INSERT INTO draft_history (id,clerk_id,data,completed_at,updated_at) \
                    VALUES ('p','nobody','{}',1,1)"
       -> FOREIGN KEY constraint failed

       node worker/test-store.mjs

   Needs Node 22 or newer. */

import { putSavedDraft, putHistoryEntry } from "./store.js";

const fails = [];
const note = [];
function check(name, cond) {
  if (cond) note.push("ok  " + name);
  else fails.push(name);
}

/* A D1 stub that records every statement prepared and every batch run.
   Deliberately not a mock of SQLite — this asserts what store.js asks for,
   which is the thing that was wrong. */
function stubDb() {
  const prepared = [];
  const batches = [];
  const db = {
    prepare(sql) {
      const stmt = { sql, bound: null, bind(...a) { stmt.bound = a; return stmt }, async run() { return { success: true } } };
      prepared.push(stmt);
      return stmt;
    },
    async batch(stmts) { batches.push(stmts); return stmts.map(() => ({ success: true })); },
  };
  return { env: { DB: db }, prepared, batches };
}

for (const [label, call] of [
  ["a saved draft", (env) => putSavedDraft(env, "user_1", '{"v":2}')],
  ["a history entry", (env) => putHistoryEntry(env, "user_1", "h1", '{"id":"h1"}', 123)],
]) {
  const { env, prepared, batches } = stubDb();
  const ok = await call(env);

  check(`${label}: reports success`, ok === true);
  check(`${label}: goes out as one batch, not two round trips`, batches.length === 1);

  const sql = prepared.map((s) => s.sql).join("\n");
  check(`${label}: creates the users row the foreign key requires`, /INSERT INTO users/.test(sql));
  check(`${label}: and does not error on a user who already exists`,
        /INSERT INTO users[\s\S]*ON CONFLICT\(clerk_id\) DO UPDATE/.test(sql));

  // The user upsert has to be IN the batch and BEFORE the row that
  // references it: a batch is ordered, and the foreign key is checked per
  // statement as it runs.
  const inBatch = batches[0] || [];
  check(`${label}: the user upsert is inside the batch`, inBatch.length === 2);
  check(`${label}: and runs before the row that references it`,
        /INSERT INTO users/.test(inBatch[0] ? inBatch[0].sql : ""));
  // By presence, not by position: saved_drafts binds clerk_id first and
  // draft_history binds it second (its own id leads). Asserting bound[0]
  // for both passed the draft and failed the history — the test being
  // wrong about a column order, which is exactly the kind of thing a
  // stub-based test invents if you let it describe the shape rather than
  // the property.
  check(`${label}: both statements are for the same account`,
        inBatch[0] && inBatch[1] &&
        inBatch[0].bound.includes("user_1") && inBatch[1].bound.includes("user_1"));
}

// A missing binding is still a normal condition, not a fault — the rule
// this file's own module docstring already states for every function here.
{
  const ok = await putSavedDraft({}, "user_1", "{}");
  check("no D1 binding answers false rather than throwing", ok === false);
}

note.forEach((n) => console.log(n));
if (fails.length) {
  console.error("\nFAILED:\n" + fails.map((f) => "  " + f).join("\n"));
  process.exit(1);
}
console.log(`\nOK — ${note.length} assertions`);
