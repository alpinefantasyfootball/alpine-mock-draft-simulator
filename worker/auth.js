/* Clerk session verification.

   Clerk owns login, signup and sessions entirely on the client
   (web/src/clerkConfig.js, SiteNav.jsx's AccountButtons) — this is the one
   place the worker has to be sure who is actually asking. The client
   attaches a short-lived session token as `Authorization: Bearer <token>`
   (Clerk's own useAuth().getToken()), and verifiedUser() below checks it
   against Clerk's own keys and nothing else. Same refuse-before-you-touch-
   anything shape originAllowed() already uses for /giphy, /news and /media
   — the difference is what is being refused: a request from the wrong
   origin there, a request from nobody in particular here.

   No secret key configured answers null rather than throwing — the same
   "answer no to a missing binding" contract every function in store.js
   already uses for a missing D1 binding — so a checkout with no
   CLERK_SECRET_KEY set behaves like every request is signed out rather
   than crashing every route that calls this. */
import { verifyToken } from "@clerk/backend";

export async function verifiedUser(request, env) {
  if (!env.CLERK_SECRET_KEY) return null;

  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  /* verifyToken() does not throw on an invalid token — its own type
     signature says so, `{ data } | { errors }`, which disagrees with the
     try/catch shown in Clerk's own doc comment for this function. Both
     are handled rather than trusting either: the explicit `errors` check
     is what actually catches an expired or forged token, and the
     try/catch is what stands in if a network call to fetch Clerk's JWKS
     fails outright. Either way this returns null, never throws — a caller
     here has to be able to treat "invalid token" and "no token at all"
     identically, the same way originAllowed()'s callers do. */
  try {
    const { data, errors } = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    if (errors || !data || !data.sub) {
      // Logged, never returned to the caller — the client only ever sees
      // { error: "unauthorized" } either way (requireUser(), draft-room.js),
      // the same refusal for an expired token as for a forged one. This is
      // purely for wrangler tail: a verification that fails for the wrong
      // reason (a secret key mismatch, say) looks identical to a normal
      // expired-token refusal from the outside, and the two need different
      // fixes.
      console.error("verifyToken refused:", JSON.stringify((errors || []).map((e) => ({
        message: e && e.message, reason: e && e.reason
      }))));
      return null;
    }
    return { id: data.sub };
  } catch (err) {
    console.error("verifyToken threw:", err && err.message);
    return null;
  }
}
