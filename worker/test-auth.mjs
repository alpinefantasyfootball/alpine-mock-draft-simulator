/* Drive a running worker's /me route over plain HTTP.

   auth.js and store.js's touchUser() are the two halves; this covers the
   route that joins them, the same way test-sockets.mjs covers DraftRoom
   rather than re-testing room.js's own pure rules. It cannot cover the
   signed-in path — that needs a real Clerk-signed token, which nothing
   offline can produce — so every case here is a way of being signed out,
   and the one thing they all have to prove is that none of them ever
   throws or returns anything but signedIn: false.

       cd worker && wrangler dev --port 8787 --local
       node worker/test-auth.mjs

   Needs Node 22 or newer for fetch as a global. */

const BASE = process.env.JUKE_WORKER_HTTP || "http://127.0.0.1:8787";
const LOCAL_ORIGIN = "http://localhost:5173";

const fails = [];
const note = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) fails.push(`${name}\n    got  ${g}\n    want ${w}`);
  else note.push("ok  " + name);
}

async function me(headers) {
  const res = await fetch(BASE + "/me", { headers });
  let body = null;
  try { body = await res.json(); } catch (err) { /* not every status has one */ }
  return { status: res.status, body };
}

// No Origin at all — curl, a script, anything that is not this site's own
// page — is refused before a token is ever looked at. Same check /giphy,
// /news and /media already run, exercised here for the route that added it.
check("no Origin is refused outright",
      (await me({})).status, 403);

// An origin nowhere on the list, allowed or preview-patterned, is refused
// the same way. Proves the check is a real allowlist and not "anything
// with an Origin header".
check("an unrecognised Origin is refused",
      (await me({ Origin: "https://evil.example" })).status, 403);

// A Cloudflare Pages preview build — <hash>.juke-1mw.pages.dev — is what
// every branch gets before it merges to main, and it is where this exact
// feature was actually tested from. If PREVIEW_ORIGIN_RE ever stops
// matching that shape, every preview deploy loses the ability to reach an
// authenticated route with no visible error beyond a 403 in a console
// nobody but a developer opens.
check("a Cloudflare Pages preview origin is allowed through",
      (await me({ Origin: "https://a1b2c3d4.juke-1mw.pages.dev" })).status, 200);

// From here on the origin is always valid, so every remaining case is
// purely about the Authorization header — or the lack of one.

check("a valid origin with no Authorization header reads as signed out",
      await me({ Origin: LOCAL_ORIGIN }), { status: 200, body: { signedIn: false } });

check("an empty Authorization header reads as signed out",
      await me({ Origin: LOCAL_ORIGIN, Authorization: "" }),
      { status: 200, body: { signedIn: false } });

// The header this project's own auth.js expects is "Bearer <token>" —
// anything else (Basic auth, a bare token with no scheme) is not that
// shape and has to fail the same quiet way, not throw.
check("a non-Bearer Authorization header reads as signed out",
      await me({ Origin: LOCAL_ORIGIN, Authorization: "Basic dXNlcjpwYXNz" }),
      { status: 200, body: { signedIn: false } });

// This is the one that matters most: a token that is present, shaped like
// a Bearer token, and is complete nonsense. verifyToken() has to reject it
// without throwing into the route handler — a 500 here would mean anyone
// could take the whole /me route down by sending garbage.
check("a garbage Bearer token reads as signed out, not a 500",
      await me({ Origin: LOCAL_ORIGIN, Authorization: "Bearer not-a-real-token" }),
      { status: 200, body: { signedIn: false } });

// A well-formed but entirely fake JWT — three base64url segments, none of
// them signed by anything Clerk would recognise — is the shape verifyToken()
// actually has to verify a signature against, rather than bailing out on
// "this doesn't even look like a token" the way the previous case might.
const fakeJwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyX2Zha2UifQ.not-a-real-signature";
check("a well-formed but unsigned JWT reads as signed out, not a 500",
      await me({ Origin: LOCAL_ORIGIN, Authorization: "Bearer " + fakeJwt }),
      { status: 200, body: { signedIn: false } });

console.log(note.join("\n"));
console.log("");
if (fails.length) {
  console.log("FAIL " + fails.length);
  fails.forEach((f) => console.log("  x " + f));
  process.exit(1);
}
console.log(`OK — ${note.length} assertions over /me`);
