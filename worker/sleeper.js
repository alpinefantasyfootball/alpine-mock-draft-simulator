/* Sleeper, read-only, through the worker.

   ---- Why the browser does not talk to Sleeper directly ----

   It could: the API is public, needs no key, and sends permissive CORS —
   verified from a real browser, not assumed. Three reasons it goes through
   here anyway.

   The connection has to live somewhere per-account, which is D1, which is
   this worker. Once the worker is in the path for the write, having the
   page fetch the reads from somewhere else is two paths to one feature.

   A league snapshot is four upstream calls (league, rosters, users, state)
   and the answers change slowly — a roster moves on waiver day, not on page
   load. Cached here, one reader costs Sleeper four calls a minute at worst
   instead of four per navigation.

   And it keeps `api.sleeper.app` out of the page's `connect-src`. The CSP
   is enforced (see CLAUDE.md's Security section) and every host in it is a
   run-time dependency the page cannot render without; ESPN's scoreboard is
   the only one today and it is documented as such. One is a considered
   exception. Two is a pattern.

   ---- Nothing here can write ----

   Every function below is a GET. Sleeper's public API has no write
   endpoints, so "read-only" is a property of the surface rather than a
   discipline this file has to keep — which is what makes the promise on
   every unlock card ("Juke never edits your league") cheap to honour.

   ---- Failure is a value, never a throw ----

   Same contract as store.js: an unreachable Sleeper, a changed response
   shape and a username that does not exist all answer null or an empty
   list. A caller then treats "could not connect" and "no such user"
   identically at the boundary and tells them apart by the shape it got
   back, rather than by catching. */

const BASE = "https://api.sleeper.app/v1";

// Long enough that a page navigation is free, short enough that a waiver
// claim shows up while somebody is still looking at the screen. The news
// route's own TTL is 900s for a feed that changes far less often.
export const SNAPSHOT_TTL = 120;

// A league with more of these than a real league has is a malformed
// response or somebody else's problem, not something to render.
const MAX_ROSTERS = 32;

async function getJson(path) {
  try {
    const res = await fetch(BASE + path, { headers: { accept: "application/json" } });
    // Sleeper answers 404 with an empty body for an unknown user, and
    // `null` (valid JSON) for an unknown league — both are "no", and
    // neither is an error worth logging.
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("sleeper fetch failed:", path, err && err.message);
    return null;
  }
}

/* The current NFL week, which is what "Wk 3" in the header chip means.

   Not derived from a calendar here. Sleeper publishes its own idea of the
   week and every league on it is scored against that, so computing a
   second one from the date would put the chip and the league's own
   matchups one apart in exactly the weeks that are ambiguous — the ones
   either side of a Tuesday rollover. */
export function nflState() {
  return getJson("/state/nfl");
}

/* A username to the leagues behind it, in one call from the page's side.

   Sleeper needs two requests for this (username -> user_id -> leagues) and
   the connect screen has no use for the first on its own, so they are
   joined here rather than the client making two round trips and holding an
   id it does not otherwise want.

   Answers `{ user: null, leagues: [] }` for a username that does not
   exist, which is the same shape as a Sleeper outage on purpose: the
   screen says "we could not find that username" either way, and guessing
   which it was would be a worse message than the honest one. */
export async function lookupUser(username, season) {
  const user = await getJson("/user/" + encodeURIComponent(username));
  if (!user || !user.user_id) return { user: null, leagues: [] };

  const raw = await getJson(
    "/user/" + encodeURIComponent(user.user_id) + "/leagues/nfl/" + encodeURIComponent(season)
  );
  const leagues = Array.isArray(raw) ? raw : [];

  return {
    user: { userId: String(user.user_id), name: user.display_name || user.username || username },
    // Only the fields the picker draws. The full league object carries
    // scoring settings, roster positions, draft ids and more, and none of
    // that belongs in a list somebody is choosing a name from — it is
    // fetched again, whole, once they have chosen.
    leagues: leagues.slice(0, 50).map((l) => ({
      leagueId: String(l.league_id),
      name: String(l.name || "Untitled league"),
      season: String(l.season || season),
      totalTeams: Number(l.total_rosters) || null,
      avatar: l.avatar || null,
    })),
  };
}

/* Everything a connected league's screens need, in one object.

   Four upstream calls in parallel rather than in sequence: they do not
   depend on each other, and a snapshot that takes four round trips end to
   end is the difference between a screen that appears and one that
   assembles itself.

   Returns null if the league itself could not be read. A missing rosters
   or users array is survivable and comes back empty — the standings table
   then draws nothing rather than the page failing — but a league that does
   not answer at all is a league that is not there, and saying so is more
   useful than an empty table under its name. */
export async function leagueSnapshot(leagueId) {
  const id = encodeURIComponent(leagueId);
  const [league, rosters, users, state] = await Promise.all([
    getJson("/league/" + id),
    getJson("/league/" + id + "/rosters"),
    getJson("/league/" + id + "/users"),
    nflState(),
  ]);

  if (!league || !league.league_id) return null;

  const byOwner = new Map();
  (Array.isArray(users) ? users : []).forEach((u) => {
    if (u && u.user_id) byOwner.set(String(u.user_id), u);
  });

  const teams = (Array.isArray(rosters) ? rosters : []).slice(0, MAX_ROSTERS).map((r) => {
    const owner = byOwner.get(String(r.owner_id)) || {};
    const s = r.settings || {};
    // Sleeper splits points into whole and hundredths across two fields.
    // Joined here rather than in the component, so nothing downstream has
    // to know that fpts_decimal exists.
    const pts = (n, dec) => Number(n || 0) + Number(dec || 0) / 100;
    return {
      rosterId: Number(r.roster_id) || null,
      ownerId: r.owner_id ? String(r.owner_id) : null,
      // metadata.team_name is what a manager typed; display_name is their
      // account. The team name is the one on the standings sheet in every
      // fantasy app, so it leads and the account name is the fallback.
      teamName: (owner.metadata && owner.metadata.team_name) || owner.display_name || "Unclaimed",
      manager: owner.display_name || null,
      avatar: owner.avatar || null,
      wins: Number(s.wins) || 0,
      losses: Number(s.losses) || 0,
      ties: Number(s.ties) || 0,
      pointsFor: pts(s.fpts, s.fpts_decimal),
      pointsAgainst: pts(s.fpts_against, s.fpts_against_decimal),
      // The roster itself, as Sleeper player ids — which are the same ids
      // players.js and stats.js are keyed by, so these map straight onto
      // Juke's own projections with no crosswalk. That identity is the
      // whole reason a connected league is worth anything here.
      players: Array.isArray(r.players) ? r.players.map(String) : [],
      starters: Array.isArray(r.starters) ? r.starters.map(String) : [],
    };
  });

  return {
    leagueId: String(league.league_id),
    name: String(league.name || "Untitled league"),
    season: String(league.season || ""),
    totalTeams: Number(league.total_rosters) || teams.length,
    week: state && Number(state.week) ? Number(state.week) : null,
    seasonType: (state && state.season_type) || null,
    // The two settings a room actually branches on. Everything else in
    // league.settings stays at Sleeper until something needs it.
    waiverBudget: Number((league.settings || {}).waiver_budget) || null,
    playoffTeams: Number((league.settings || {}).playoff_teams) || null,
    teams,
  };
}
