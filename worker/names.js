/* One normaliser, because a crosswalk needs both sides to agree.

   `build_players.py`'s `normalise()` is the original and this is its twin
   in JavaScript. It exists as its own module rather than living in the
   first file that needed it, because two files need it for the SAME join:
   store.js writes the key when it caches Sleeper's pool, and espn.js reads
   it when it resolves an ESPN roster. A normaliser that drifted between
   those two would not throw — it would simply stop matching, and a roster
   that comes up a few players short looks exactly like a roster.

   That is the failure `link_nflverse()` avoids by reusing `index_sleeper()`
   rather than writing a second one, and this is the same decision in a
   language boundary instead of a module boundary.

   ---- Kept identical to the Python on purpose ----

     text = unicodedata.normalize("NFKD", name or "")
     text = "".join(c for c in text if not unicodedata.combining(c)).lower()
     text = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", " ", text)
     return re.sub(r"[^a-z]", "", text)

   JavaScript has no `unicodedata`, so "strip combining marks" is NFD
   followed by the U+0300–U+036F range, which is what the Python does. NFD
   rather than NFKD is deliberate and is the one deviation: the trailing
   `[^a-z]` strip discards everything the compatibility half of NFKD would
   have folded, so the two agree on every output while NFD does less work.

   ---- The suffix rule is the half that earns its keep ----

   Measured 5 September 2026 against a real ESPN league's rosters and
   Sleeper's own pool: an exact name match covers 114 of 128 skill players,
   and **twelve of the fourteen misses are suffixes alone** — ESPN writes
   "Marvin Harrison Jr.", "Brian Thomas Jr.", "Travis Etienne Jr.",
   "Michael Pittman Jr.", "Kenneth Walker III", "Chris Godwin Jr.",
   "Kyle Pitts Sr." and Sleeper stores none of them that way.

   So the suffix strip is not tidying. Without it the join drops a tenth of
   every roster, and it drops it precisely at the top of the draft, where a
   missing player is most visible and least excusable. */

export function normalise(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, " ")
    .replace(/[^a-z]/g, "");
}
