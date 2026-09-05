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

  /* This was written against the `{ data } | { errors }` union that
     @clerk/backend's own internal src/tokens/verify.ts documents for
     verifyToken() — and that union is real, but it belongs to a function
     one layer further in than the one this import actually names.
     `@clerk/backend`'s package root (dist/index.mjs, what
     `import { verifyToken } from "@clerk/backend"` resolves to) exports
     `withLegacyReturn(verifyToken)`, not the raw function: on success it
     resolves to the JWT payload directly (no `.data` wrapper — `sub` sits
     at the top level), and on failure it *throws* `errors[0]` rather than
     returning an `{ errors }` object. dist/index.d.ts's own declared
     return type says so — `Promise<JwtPayload>`, not a union.

     Every previous version of this function destructured `{ data, errors }`
     off that result. On a genuinely valid, successful sign-in, `result` is
     the payload itself, so `result.data` and `result.errors` are both
     `undefined` — and `errors || !data || !data.sub` reads that as a
     refusal. That is not an edge case: it fired on every single successful
     verification, which is why every real login was being rejected while
     `wrangler tail` showed "verifyToken refused: []" — an empty errors
     array wasn't Clerk reporting zero problems, it was this file never
     reading a real one because there wasn't one to read; the union it was
     checking against does not apply to this export. */
  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    if (!payload || !payload.sub) {
      // Logged, never returned to the caller — the client only ever sees
      // { error: "unauthorized" } either way (requireUser(), draft-room.js).
      // This is purely for wrangler tail: verifyToken() resolving at all
      // but with no usable `sub` would be Clerk changing its own contract,
      // not an expired or forged token (those throw, and land below).
      console.error("verifyToken resolved without a usable subject:", JSON.stringify({
        hasPayload: !!payload,
        payloadKeys: payload ? Object.keys(payload) : null,
      }));
      return null;
    }
    return { id: payload.sub };
  } catch (err) {
    // The expected path for an expired, forged, or otherwise invalid
    // token — withLegacyReturn() throws errors[0] rather than returning
    // it, so this is not a fallback for a network failure, it is where
    // every ordinary refusal actually arrives.
    console.error("verifyToken threw:", err && err.message);
    return null;
  }
}
