/* ==========================================================
   Juke — The Draft Room, behaviour

   Read the section headers first. Each one does one job.
   ========================================================== */


/* ---- 1. League settings ---------------------------------
   One object describes the league, and everything else in
   this file is worked out from it. The setup screen writes
   to it before a draft starts.

   The rule to keep: never write a league number down twice.
   The old code had ten teams spelled out in a dozen places
   and a hand-picked replacement level that only made sense
   for one of them.                                        */

const league = {
  teams: 10,
  rounds: 14,
  starters: { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 },
  flex: 1,           // one FLEX, drawn from RB / WR / TE
  superflex: 0,      // a FLEX a quarterback may also fill; 1 makes it 2QB
  bench: 5,
  scoring: "half",   // "standard" | "half" | "ppr" — also picks the ADP set
  rules: null        // the scoring table; filled in below, editable on setup
};

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];

/* What a position is called on screen, as opposed to the key it is stored
   under. Only one of them differs, and that one difference was written out
   three times — so the roster, the board legend and the starting-lineup
   controls all said "D/ST" while the two position filters said "DST". */
function posLabel(pos) { return pos === "DST" ? "D/ST" : pos; }

// The order starting slots are listed and filled, with FLEX after the
// positions it draws from so the better player lands in the named slot.
const SLOT_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "SFLEX", "DST", "K"];

// Which positions can fill a slot. FLEX is the classic RB/WR/TE; SFLEX adds
// the quarterback, and that one extra entry is the whole of what a superflex
// league is. Written down once because the starting lineup, the draft grade
// and the CPU all ask the question, and three answers that could drift apart
// is exactly the kind of quiet bug this file is organised to avoid.
const SLOT_ELIGIBLE = {
  FLEX:  ["RB", "WR", "TE"],
  SFLEX: ["QB", "RB", "WR", "TE"]
};

function fillsSlot(player, slot) {
  const eligible = SLOT_ELIGIBLE[slot];
  return eligible ? eligible.indexOf(player.pos) >= 0 : player.pos === slot;
}

// How many of a slot the league starts. Flex kinds live beside the named
// positions rather than inside league.starters, because they are not
// positions and counting them as one breaks every per-position sum.
function slotCount(slot) {
  if (slot === "FLEX")  return league.flex;
  if (slot === "SFLEX") return league.superflex;
  return league.starters[slot] || 0;
}

function totalPicks()   { return DraftEngine.totalPicks(league); }
function starterCount() { return POSITIONS.reduce((n, pos) => n + league.starters[pos], 0); }
function flexCount()    { return league.flex + league.superflex; }
function rosterSize()   { return starterCount() + flexCount() + league.bench; }

// The starting lineup, expanded into one entry per slot:
// QB, RB, RB, WR, WR, TE, FLEX, DST, K for the default settings.
function lineupSlots() {
  const slots = [];
  SLOT_ORDER.forEach(function (slot) {
    const n = slotCount(slot);
    for (let i = 0; i < n; i++) slots.push(slot);
  });
  return slots;
}

// A player carrying one of these has been ruled out. CPU teams never
// take them and they never appear in your suggestions.
const RULED_OUT = ["O", "IR", "SUS", "NFI", "DNR"];

// Available, but carrying real risk. Everyone drafts them later.
const RISKY = ["D", "PUP"];

// How many of a position a CPU team will ever hold: its starters, its share
// of the FLEX, and enough depth to look like a real roster. The tight numbers
// on TE, K and DST are what stop a team hoarding them.
const DEPTH_ALLOWANCE = { QB: 3, RB: 5, WR: 5, TE: 2, K: 2, DST: 2 };

function maxAt(pos) {
  const flexShare = (pos === "RB" || pos === "WR") ? league.flex : 0;
  // A superflex is a second startable quarterback, so it lifts the ceiling on
  // how many a team will hold. Without this a CPU stops at one and a
  // superflex league drafts like a normal one.
  const superShare = pos === "QB" ? league.superflex : 0;
  return league.starters[pos] + flexShare + superShare + DEPTH_ALLOWANCE[pos];
}

// Replacement level: the last player at a position who would realistically
// start somewhere in the league. It has to be derived, because it moves with
// team count and FLEX slots, and it feeds the draft grade, the Juke score
// and value over replacement. The FLEX shares are how often each position
// actually wins that slot, which is why RB and WR run so much deeper.
const FLEX_SHARE = { RB: 0.40, WR: 0.55, TE: 0.05 };

// A superflex is won by a quarterback almost every time — that is the point
// of the format, and it is why quarterbacks go two rounds earlier in one.
// The remainder is the handful of managers who take the better skill player.
const SFLEX_SHARE = { QB: 0.85, RB: 0.05, WR: 0.09, TE: 0.01 };

function replacementRank(pos) {
  const base = league.teams * (league.starters[pos] || 0);
  const flex = league.teams * league.flex * (FLEX_SHARE[pos] || 0);
  const sflex = league.teams * league.superflex * (SFLEX_SHARE[pos] || 0);
  return Math.round(base + flex + sflex) + 1;
}

// The same ranks written out in prose, for the method notes on the page.
// They used to be typed into the copy by hand, which is exactly how the copy
// and the maths drifted apart.
function replacementText() {
  return POSITIONS
    .map((pos) => posLabel(pos) + replacementRank(pos))
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");
}

/* The starting lineup in prose, derived the same way and for the same note.
   The ranks above are worked out from this shape and nothing else, so a note
   naming the room but not the lineup explains the least interesting half: on
   a custom lineup it printed "QB21 ... for this 10-team league with a FLEX",
   and there is no way to get from that to two starting quarterbacks. TE2 is
   stranger still until you know the league starts no tight end.

   Built from SLOT_ORDER so the FLEX and the superflex appear in the order
   they are filled, and so a slot added there is never missing here. */
function lineupText() {
  return SLOT_ORDER
    .filter((slot) => slotCount(slot) > 0)
    .map((slot) => slotCount(slot) + " " + posLabel(slot))
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");
}

const REPLACEMENT_PTS = {};

// The best value over replacement anywhere on the board. Every Juke score
// is a percentage of it, so it is worked out once per build in
// buildProjections() rather than per player.
let BEST_VOR = 0;

// One per seat, up to the largest league the setup screen offers. The list
// used to stop at fourteen, which was exactly the old maximum — so raising
// the cap without extending it here would have handed CPU_NAMES[s] an
// undefined and thrown on .split() while drawing the board.
const CPU_NAMES = [
  "Wild Goose Chase", "Bijan Mustard", "Nacua Matata", "The Gibbs Ultimatum",
  "Kupp of Joe", "Purdy Vacant", "Hurts So Good", "Saquon For The Team",
  "Lambo No. 5", "Bone-Thugs-N-Montgomery", "Alvin and the Chipmunks",
  "Better Call Saquon", "A League of Their Mahomes", "Tua Fast Tua Furious",
  "Kelce Grammer", "Show Me Your TDs", "Breece Lightning", "Chubb Rock",
  "Waddle I Do", "Jeanty's Inferno", "Bowers to the People", "Hall of a Guy",
  "Jefferson Airplane", "London Calling", "McConkey Business",
  "Achane Reaction", "Odunze the Road Again", "Higgins Boson",
  "Pitts and Pieces", "Burrow Deep", "The Fresh Prince of Bel-Aiyuk",
  "Nix on the Beach"
];

// Never indexes past the end. The list is long enough for every league the
// screen offers, but a seat without a name should read plainly rather than
// take the board render down with it.
function cpuName(slot) {
  return CPU_NAMES[slot] || "Team " + (slot + 1);
}


/* ---- 2. Page elements ---------------------------------- */

const $ = (id) => document.getElementById(id);

const appbar     = $("appbar");
const statusLine = $("statusLine");
const pickLabel  = $("pickLabel");
const pickText   = $("pickText");
const leagueLabel = $("leagueLabel");
const countBlock = $("countBlock");
const rightLabel = $("rightLabel");
const rightValue = $("rightValue");
const shellbar   = $("shellbar");
const actionbar  = $("actionbar");
/* The band both of those sit in. It carries the hidden flag for the pair,
   rather than each of them carrying its own: they have only ever been shown
   and hidden together, in four places, and two flags that must agree is one
   flag with a second copy. It also has to be the wrapper that hides — an
   empty band still draws its background and its bottom border. */
const tabrow     = $("tabrow");

// Toggles live in both headers and, on a phone, inside the rooms panel, which
// is rendered rather than static. So nothing caches the set: it is queried when
// it is needed and clicks are delegated.
const themeBtns = () => document.querySelectorAll(".theme-toggle");


/* ---- 2b. Light and dark ---------------------------------
   Dark is the default, and it is the default in the
   stylesheet rather than here: :root carries the dark
   values and only data-theme="light" overrides them. So a
   reader who has never touched the toggle gets a dark page
   even before this file has loaded, and nothing has to be
   applied on boot.

   The head of index.html re-applies a saved choice before
   the first paint. All this section does is flip it and
   write it down.                                          */

const THEME_KEY = "draftroom.theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function setTheme(theme) {
  // The dark theme is the absence of an attribute, not a value of it, so
  // that a saved choice and the default can never disagree.
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else                   document.documentElement.removeAttribute("data-theme");

  try { localStorage.setItem(THEME_KEY, theme); } catch (err) {}   // private browsing
  syncThemeButton();
}

// The button says what it will do, not what is on screen, because that is
// what a screen reader user needs to hear before pressing it.
function syncThemeButton() {
  const dark = currentTheme() === "dark";
  const label = dark ? "Switch to the light theme" : "Switch to the dark theme";
  themeBtns().forEach(function (btn) {
    btn.setAttribute("aria-pressed", String(dark));
    btn.setAttribute("aria-label", label);
    btn.title = label;
  });
}

syncThemeButton();


/* ---- 2b. Sound ------------------------------------------
   Three cues, synthesised in the page. No audio files, and
   that is a decision rather than a shortcut: three tones do
   not justify the first binary assets in a repository that
   has none, a generated tone cannot 404 or be served stale
   behind a cache, and it costs no request on a page that
   currently loads no third-party media at all. Same
   argument as the door being drawn and the product shot
   being generated.

   A draft is the one screen in this app where somebody
   legitimately looks away — the whole point of a clock is
   that it runs while you are doing something else — so this
   is the one screen where sound earns its place. It is off
   until asked for, and the preference is remembered.     */

const SOUND_KEY = "draftroom.sound";

let soundWanted = false;
try { soundWanted = localStorage.getItem(SOUND_KEY) === "on"; } catch (err) {}

/* One context, made on the first gesture that needs it and never before.

   Browsers refuse to start an AudioContext outside a user gesture, and one
   created at load sits in "suspended" for ever — so the first cue would be
   silent with nothing to say why. Pressing the toggle is a gesture, and so is
   starting a draft. */
let audio = null;

function audioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;                 // no Web Audio: the app is unaffected
  if (!audio) audio = new Ctx();
  if (audio.state === "suspended") audio.resume();
  return audio;
}

/* A note. Sine rather than square, and an envelope rather than a straight
   gain: an abrupt start or stop on a raw oscillator is a click, which is
   audible as a fault rather than as a sound somebody chose. */
function tone(freq, startAt, ms, peak) {
  const ctx = audioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const t0 = ctx.currentTime + startAt;
  const t1 = t0 + ms / 1000;

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t1);

  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

/* Never throws, and that is the contract rather than politeness. Web Audio
   is a runtime dependency on the browser's own hardware — a device with no
   output, a context the browser declines to resume, a policy we did not
   anticipate — and none of that may reach a draft. It fails by going quiet,
   the same way the score strip fails by disappearing. */
function play(cue) {
  if (!soundWanted) return;
  try {
    if (cue === "turn") { tone(587.33, 0, 110, 0.16); tone(880.00, 0.10, 190, 0.16); }
    else if (cue === "tick") { tone(1046.50, 0, 55, 0.09); }
    else if (cue === "done") {
      tone(523.25, 0, 220, 0.13); tone(659.25, 0.09, 220, 0.13); tone(783.99, 0.18, 320, 0.13);
    }
  } catch (err) {}
}

/* What has already been said, so a cue fires on the change rather than on
   every render. renderHeader() runs on every pick, every tick and every
   rebuild, so "is it my turn" is true hundreds of times for one turn. */
const saidAt = { mine: false, tick: null, over: false };

function soundCue() {
  if (!state.started) { saidAt.mine = false; saidAt.tick = null; saidAt.over = false; return; }

  if (draftOver()) {
    if (!saidAt.over) { saidAt.over = true; play("done"); }
    return;
  }

  const mine = isMyTurn();
  if (mine && !saidAt.mine) play("turn");
  saidAt.mine = mine;

  /* The last five seconds, once each. Only on your own clock: a countdown
     running against somebody else is not a thing to be hurried by, and in a
     twelve-team room it would tick sixty times a round. */
  const left = state.timeLeft;
  if (mine && clockShowing() && !state.paused && left > 0 && left <= 5) {
    if (saidAt.tick !== left) { saidAt.tick = left; play("tick"); }
  } else {
    saidAt.tick = null;
  }
}

function syncSoundButton() {
  const btn = $("soundBtn");
  if (!btn) return;
  const label = soundWanted ? "Turn draft sounds off" : "Turn draft sounds on";
  btn.setAttribute("aria-pressed", String(soundWanted));
  btn.setAttribute("aria-label", label);
  btn.title = label;
}

function toggleSound() {
  soundWanted = !soundWanted;
  try { localStorage.setItem(SOUND_KEY, soundWanted ? "on" : "off"); } catch (err) {}
  syncSoundButton();
  // The press is the gesture that lets the context start, and hearing the
  // thing you just switched on is the only confirmation worth giving.
  if (soundWanted) play("turn");
}

syncSoundButton();


/* ---- 2c. The site shell ---------------------------------
   Two views behind one hash route: the landing page at "#/"
   and the Draft Room at "#/draft-room".

   "#/draft" was the Draft Room and is retired -- applyRoute()
   redirects it. Its markup (#view-app) is still here and still
   written to on every render; it is unreachable, not deleted.

   Hash routing rather than real paths. It was forced at first
   -- GitHub Pages has no rewrite to send /draft back to
   index.html -- and that constraint went away with the move to
   Cloudflare Pages, where a _redirects file does exactly that.

   What holds it now is the reason that was always better: the
   hash keeps the back button working, which matters most to the
   person pressing it mid-draft. Every saved link, every invite
   and the installed app's start_url are also written this way,
   so real paths are a feature with a migration behind them
   rather than a tidy-up.                                    */

/* The three phases of a fantasy season, in the order they happen.

   These are a sequence, not a set of buckets, and the landing page draws
   them that way — left to right, rooms stacked under each. A season arc says
   "this covers the whole year" without a line of marketing copy, which a row
   of badges on a flat grid cannot. */
const SEASONS = ["Pre-season", "In-season", "Post-season"];

/* Every room, its phase, and what it is for.

   The blurbs are the short version of the real thing, so they have to
   describe all of it. An earlier set was written from the room names alone
   and each one covered about half its room: the Waiver Room without the
   roster, the Strategy Room as draft-only, the Trade Room evaluating but not
   simulating, and the Prospect Room described as dynasty value, which is not
   what college-to-NFL scouting is at all.

   The League Room genuinely spans in-season and post-season. It is filed
   under the later one because the wrap-up is the part that is distinctly
   its own — power rankings mid-season overlap with what the other rooms
   already tell you — and because that leaves no phase standing empty. */
const ROOMS = [
  // #/draft-room, not #/draft: that's the legacy vanilla route
  // applyRoute() still toggles (#view-app, hidden-not-deleted DOM — see
  // CLAUDE.md), but every real Draft Room feature built since the React
  // rewrite only exists on #/draft-room (DraftRoom.jsx, outside
  // applyRoute() entirely — see main.jsx). This one string is read by both
  // the header's rooms panel and the homepage's room-door section (see
  // RoomNavigation.jsx), so it was the single place sending every "start a
  // draft" entry point in the product back to the old page.
  { name: "The Draft Room", href: "#/draft-room", live: true, season: "Pre-season",
    blurb: "Mock drafts against a board that knows ADP, tiers and replacement level." },
  { name: "The Prospect Room", live: false, season: "Pre-season",
    blurb: "College production turned into an NFL projection, before the rookie drafts." },

  { name: "The Waiver Room", live: false, season: "In-season",
    blurb: "Set your roster and price a claim — FAAB, priority, and who is worth the bid." },
  { name: "The Trade Room", live: false, season: "In-season",
    blurb: "Value both sides of a deal, then play out what it does to your season." },
  { name: "The Strategy Room", live: false, season: "In-season",
    blurb: "A plan for the draft, the roster and the weekly lineup." },

  { name: "The League Room", live: false, season: "Post-season",
    blurb: "Analytics across the whole league, from playoff odds to the final wrap-up." }
];

/* ---------- the product shot ----------

   A first-time visitor never saw what this app looks like. The landing page
   had no image of any kind — not one <img> and not one illustrative <svg> —
   so the most persuasive thing the project has built was invisible until
   somebody committed to a draft to see it.

   This draws the opening rounds of a real board: the same `board` array the
   draft reads, valued the way the draft values it, in real snake order, in the
   position colours the app uses everywhere else. It is a screenshot that
   cannot go stale, because there is nothing in it to keep in sync.

   Ten teams because that is the league this was built for and the shape the
   setup screen still defaults to.

   Five rounds because four stops one row short of the tight ends. The elite
   quarterback lands in the third and the two tight ends worth having in the
   fourth, so at four rounds the fourth is the row the mask is busy dissolving
   and the only two cells that are not a back or a receiver arrive as ghosts.
   A fifth round costs 37px, moves nothing above it — the button and the
   headline both sit above the shot — and gives the fade a row of its own to
   eat, which is what it is for. */
const SHOT_TEAMS = 10;
const SHOT_ROUNDS = 5;
const SHOT_MINE = 3;      // one column reads as yours, the way a real board does

/* The shot used to be `board[i]` — the opening names in ADP order, laid out in
   snake order. That is a real board and it is the wrong one, because **ADP is
   an average and no single draft looks like an average.** A position that goes
   early in half the rooms and late in the other half averages to the middle,
   where it loses to the run of backs and receivers that go at the same spot in
   every room. Measured on today's data, the top forty by ADP is eighteen RB,
   twenty-one WR and one QB — no tight end at all — so the graphic was two
   colours and a single red cell, and it read as synthetic to anybody who has
   drafted. The tight ends are there at 41 and 43, one row past the crop.

   So the shot drafts rather than slices: fifty picks, snake order, each seat
   valuing the board the way `suggestions()` does — ADP, need, injury risk and
   the app's own model.

   Two of those four are what move the scarce positions up, and they move them
   for different reasons. **The model prices them.** `overallScore()` is points
   above replacement measured *across* positions, so it can say an elite tight
   end beats the twenty-fifth receiver — which is exactly what an ADP average
   smooths away and exactly what the product claims to know. **Need is what
   makes a seat stop taking backs.** A fourth running back is past the starting
   requirement and loses the 0.80, so once a seat has its starters the QB and
   TE still on 0.80 finally win a pick — which is why a real room's fifth round
   has quarterbacks in it and an ADP slice never does.

   Neither is a thumb on the scale. `MODEL_CAP` holds the model to a quarter of
   a player's price, so this is a nudge off the market rather than a different
   board: measured on today's data the quarterback moves from 30 to 23 and the
   tight ends from 41 and 43 into the fourth round, while the first two rounds
   barely move at all.

   Which makes this a better advert as well as a better picture. The headline
   above it says the numbers are already done, and the board underneath is now
   drawn by those numbers rather than by the market they improve on.

   Nothing here is a name. Whoever the nightly data says is QB1 and TE1 is who
   turns up, so there is still nothing in this graphic to keep in sync. */
function shotPicks() {
  const taken = {};                                    // name -> true
  const have  = [];                                    // seat -> pos -> count
  for (let s = 0; s < SHOT_TEAMS; s++) have.push({});

  const picks = [];
  for (let n = 1; n <= SHOT_TEAMS * SHOT_ROUNDS; n++) {
    // One implementation of what a snake draft is, the same one the room runs.
    const c = DraftEngine.pickInfo(n, SHOT_TEAMS);
    const pool = board.filter((p) => !taken[p.name] && !isRuledOut(p));
    if (!pool.length) break;

    const modelMultiplier = modelMultipliers(pool);
    let best = null, bestScore = Infinity;
    pool.forEach(function (p) {
      const score = (p.adp + p.jitter)
        * needFromCount(have[c.slot][p.pos] || 0, p.pos, c.round)
        * (isRisky(p) ? 1.35 : 1)
        * modelMultiplier(p);
      if (score < bestScore) { bestScore = score; best = p; }
    });

    taken[best.name] = true;
    have[c.slot][best.pos] = (have[c.slot][best.pos] || 0) + 1;
    picks[n - 1] = best;
  }
  return picks;
}

function closeRooms() {
  $("roomsPanel").hidden = true;
  $("roomsBtn").setAttribute("aria-expanded", "false");
}

function toggleRooms() {
  const opening = $("roomsPanel").hidden;
  $("roomsPanel").hidden = !opening;
  $("roomsBtn").setAttribute("aria-expanded", String(opening));
}


/* ---- the route ---- */

/* The hash can now carry an invite code — #/draft?room=ABC — so the path
   is read up to the query rather than compared whole. #/draft on its own
   still means what it always did. */
/* "draft-legacy" is not a route anybody is meant to find. #/draft is retired
   and redirects (see applyRoute), but the vanilla board it used to show is
   still live code - app.js renders into it on every tick - and it still has
   about twenty tests written against it that encode real, hard-won lessons:
   the row-height rule, the face that removes itself, the gold ring pair.
   Retiring the route without a door would have quietly deleted all of them,
   which is a much bigger decision than the one being made here.

   So the old view keeps an address that only the suite uses. Nothing in the
   product links to it and nothing should. It goes away when those specs are
   rewritten against the React board, which is real work and is not this
   change. */
function route() {
  const path = location.hash.replace(/^#\/?/, "").split("?")[0];
  return (path === "draft" || path === "draft-legacy") ? "draft" : "home";
}

// No callers today. Kept pointing at the live route so it cannot
// quietly resurrect the retired one if something calls it later.
function go(where) { location.hash = where === "draft" ? "#/draft-room" : "#/"; }

/* #/draft-room is the new React draft room (web/src/components/DraftRoom.jsx,
   mounted into #draftroom-root — see the comment beside that id in
   web/index.html). It owns its own visibility and hash-watching entirely,
   deliberately outside #view-app/#view-home's toggle, so route() itself
   must keep meaning what it always has ("draft" vs "home") for its other
   four callers (app.js:1643, 1671, 4010, 4955) — this only needs to stop
   applyRoute() from treating #/draft-room as "home" and tearing down a
   live room/clock/sim underneath it. */
function onDraftRoomRoute() {
  const path = location.hash.replace(/^#\/?/, "").split("?")[0];
  return path === "draft-room";
}

function applyRoute() {
  /* #/draft is retired. Every Draft Room feature built since the React
     rewrite lives only on #/draft-room, so the old route was a second,
     older product still reachable from a bookmark, a shared link, or the
     resume banner - and it looked enough like the real thing that somebody
     landing there would not know they were on it.

     The redirect sits at the router rather than at each caller because the
     callers are not the whole problem: a link someone saved last week is,
     and no amount of editing this file reaches that. replace() rather than
     assignment, so the dead route does not become a back-button trap
     between the two rooms.

     The #view-app markup stays exactly where it is. It is unreachable now,
     not deleted - app.js is a classic script and renderHeader(),
     renderInvite() and a dozen listeners still write into those ids on
     every render, so deleting them throws and takes the whole boot
     sequence with it. Unreachable is the goal; absent is a different and
     much larger change. */
  if (location.hash.replace(/^#\/?/, "").split("?")[0] === "draft") {
    /* Carry the hash's own query across. An invite link is
       "#/draft?room=ABC1" and route() strips the query to decide the path,
       so redirecting to a bare "#/draft-room" would silently drop the room
       code and drop a guest onto an empty setup screen instead of into the
       draft they were invited to. Every invite sent before today is exactly
       that shape, which is the whole reason this redirect exists. */
    const q = location.hash.indexOf("?");
    const tail = q >= 0 ? location.hash.slice(q) : "";
    location.replace(location.pathname + location.search + "#/draft-room" + tail);
    return;
  }

  const onDraft = route() === "draft";

  shellbar.hidden = onDraft;
  appbar.hidden   = !onDraft;
  $("view-home").hidden = onDraft;
  $("view-app").hidden  = !onDraft;
  tabrow.hidden = !(onDraft && state.started);

  if (onDraftRoomRoute()) {
    // #draftroom-root owns its own visibility and lifecycle entirely — see
    // the comment at web/index.html beside that id. Nothing to do here.
  } else if (!onDraft) {
    // Leaving is not discarding. The draft stays in memory and in the save;
    // only the clock and the CPU timer stop, so nothing advances off-screen
    // while you are reading the landing page.
    closeRooms();
    stopSim();
    stopClock();
    state.lastPick = null;
    renderHome();
  } else if (state.started && !draftOver()) {
    // Coming back: either hand you the clock, or let the room carry on.
    if (isMyTurn()) resetClock(); else runCPUs();
  }

  render();
  window.scrollTo(0, 0);
}


/* ---- the landing page ---- */

function renderHome() {
  // Provenance, not a sales line. "Free" and "no account" are already in the
  // hero sentence, and the rooms section already says the data refreshes.
  $("homeMeta").textContent = typeof PLAYERS_META === "undefined" ? "" :
    PLAYERS_META.count + " players · ADP and projections refreshed " +
    PLAYERS_META.generated;

  // A saved draft is the most useful thing this page can offer someone, so it
  // sits above the rooms rather than being buried on the setup screen.
  loadScores();

  const bar = $("homeResume");
  const data = readSave();
  if (!data || !data.picks.length) { bar.hidden = true; return; }

  const saved = data.league;
  const total = saved.teams * saved.rounds;
  const made  = data.picks.length;
  const done  = made >= total;

  bar.hidden = false;
  bar.innerHTML =
    "<div><p><b>" + (done ? "Your finished draft" : "You have a draft in progress") + "</b></p>" +
    '<p class="sub">' + settingsText(saved) + " \u00b7 " + made + " of " + total + " picks</p></div>" +
    '<div class="btnrow"><a class="cta" href="#/draft-room">' +
    (done ? "Reopen it" : "Resume") + "</a></div>";
}


/* ---- installing, and the things that do not exist yet ---- */

// The browser decides whether an install is on offer; we only stash the event
// and reveal the button once it is. Chrome and Edge fire this, iOS Safari
// never does, so there the button simply never appears rather than lying.
let installPrompt = null;

function showInstall(on) {
  document.querySelectorAll(".js-install").forEach(function (b) { b.hidden = !on; });
}

window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  installPrompt = e;
  showInstall(true);
});

window.addEventListener("appinstalled", function () {
  installPrompt = null;
  showInstall(false);
});

function notYet(title, body) {
  $("soonTitle").textContent = title;
  $("soonBody").textContent = body;
  $("soonDlg").showModal();
}



/* ---- 2d. The score strip --------------------------------
   The only part of Juke that depends on a third party at
   run time. Two rules follow from that:

   It fails silently. If the feed is down, slow, blocked or
   has changed shape, the strip hides and the page is exactly
   what it was before. A scoreboard is not worth an error.

   It renders nothing in the offseason. No games means no
   strip, rather than an empty frame for the five months
   between February and August.

   ESPN rather than Sleeper because Sleeper's schedule feed
   carries no scores at all — only home, away, date and
   status. Checked, not assumed. ESPN's endpoint is public
   and permissive about CORS, but it is undocumented, so
   treat a shape change as expected rather than surprising. */

const SCORES_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

// The response is ~220KB, which is more than the whole app. Once a minute is
// plenty for a strip you glance at, and it keeps route changes free.
const SCORES_TTL = 60000;

// Everything below comes from someone else's server, so it is escaped before
// it goes anywhere near innerHTML. Nothing else in this file needs this,
// because every other string is generated by our own pipeline.
function escHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gameFrom(event) {
  const c = event && event.competitions && event.competitions[0];
  if (!c || !c.competitors) return null;
  const status = (c.status && c.status.type) || {};
  const away = c.competitors.filter((x) => x.homeAway === "away")[0];
  const home = c.competitors.filter((x) => x.homeAway === "home")[0];
  if (!away || !home) return null;
  return {
    away: away.team && away.team.abbreviation,
    home: home.team && home.team.abbreviation,
    awayScore: away.score,
    homeScore: home.score,
    state: status.state,                       // "pre" | "in" | "post"
    detail: status.shortDetail || ""
  };
}

function cachedScores() {
  try {
    const raw = JSON.parse(sessionStorage.getItem("juke.scores"));
    return raw && (Date.now() - raw.at) < SCORES_TTL ? raw.games : null;
  } catch (err) { return null; }
}

function renderScores(games) {
  const strip = $("scoreStrip");
  if (!games || !games.length) { $("scoreWrap").hidden = true; return; }

  strip.innerHTML = games.map(function (g) {
    // Before kickoff there is nothing to lead by, so no side is emphasised.
    const live = g.state !== "pre";
    const a = Number(g.awayScore), h = Number(g.homeScore);
    const row = (team, score, lead) =>
      '<div class="game-row' + (lead ? " lead" : "") + '">' +
        '<span class="tm">' + escHtml(team) + "</span>" +
        '<span class="sc">' + (live ? escHtml(score) : "") + "</span>" +
      "</div>";
    return '<div class="game">' +
      row(g.away, g.awayScore, live && a > h) +
      row(g.home, g.homeScore, live && h > a) +
      '<div class="game-st' + (g.state === "in" ? " live" : "") + '">' +
        escHtml(g.detail) + "</div>" +
    "</div>";
  }).join("");

  $("scoreWrap").hidden = false;
  updateScoreEnds();
}

// Which end has more behind it. Drives the fades and the arrows, so the
// row never claims there is more to see when there is not.
function updateScoreEnds() {
  const strip = $("scoreStrip");
  const max = strip.scrollWidth - strip.clientWidth;
  $("scoreWrap").classList.toggle("more-left", strip.scrollLeft > 4);
  $("scoreWrap").classList.toggle("more-right", strip.scrollLeft < max - 4);
}

function nudgeScores(direction) {
  const strip = $("scoreStrip");
  // scrollBy's own behavior beats the stylesheet, so the reduced-motion
  // guard on .scores would not apply here unless it is asked for again.
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  strip.scrollBy({
    left: direction * strip.clientWidth * 0.8,
    behavior: still ? "auto" : "smooth"
  });
}

// DOM-free half of the fetch, so anything holding a real board (the
// draft room, and now the JukeEngine bridge below) can ask for scores
// without a #scoreStrip to write into. loadScores() is the DOM half.
function fetchScores() {
  const cached = cachedScores();
  if (cached) return Promise.resolve(cached);

  return fetch(SCORES_URL, { mode: "cors" })
    .then(function (res) {
      if (!res.ok) throw new Error("scores " + res.status);
      return res.json();
    })
    .then(function (data) {
      const games = (data.events || []).map(gameFrom).filter(Boolean);
      try {
        sessionStorage.setItem("juke.scores", JSON.stringify({ at: Date.now(), games }));
      } catch (err) {}                          // private mode, or a full quota
      return games;
    });
}

function loadScores() {
  fetchScores().then(renderScores).catch(function () {
    $("scoreWrap").hidden = true;
  });
}

/* ---- 3. The player board -------------------------------
   One sorted copy of the ADP set that matches the league's
   scoring. Every player gets a position rank (RB1, RB2...)
   and a small random jitter that stays fixed for the whole
   draft, so undoing a pick doesn't reshuffle how the CPUs
   think.

   Full PPR moves receivers up and backs down, so the board
   is rebuilt from the right set when a draft starts rather
   than being fixed at load.                               */

let board = [];

const DEFAULT_SET = "half";

// players.js may predate ADP_SETS, or a set may be missing if Fantasy
// Football Calculator was down when the pipeline ran. Fall back rather
// than leaving the app with no players at all.
function adpSet() {
  if (typeof ADP_SETS === "undefined") return PLAYERS;
  return ADP_SETS[league.scoring] || ADP_SETS[DEFAULT_SET] || PLAYERS;
}

// How many picks the selected set can actually support. A 14-team, 15-round
// draft wants 210 players and the standard set only carries 205, so this is
// what the setup screen validates against.
function poolSize() { return adpSet().length; }

function buildBoard() {
  // Copied, not referenced: posRank, tier and drafted belong to this draft,
  // not to the generated data, which gets read again on a restart.
  board = adpSet().map((p) => Object.assign({}, p));
  board.sort((a, b) => a.adp - b.adp);

  const counts = {};
  board.forEach(function (player, i) {
    counts[player.pos] = (counts[player.pos] || 0) + 1;
    player.posRank = counts[player.pos];
    player.overall = i + 1;
    player.drafted = false;
    player.jitter  = 0;
  });

  buildTiers();
  buildProjections();
}


/* ---- 4. State ------------------------------------------ */

const state = {
  mySlot: 0,        // 0-indexed draft position
  clockLength: 60,  // seconds, 0 means no clock
  started: false,
  picks: [],        // { overall, round, slot, player }
  timeLeft: 0,
  timerId: null,
  paused: false,
  seed: 0,            // fixes the CPU wobble so a resumed draft behaves the same
  simTimer: null,     // handle for the CPU pick animation
  simulating: false,
  lastPick: null,     // the pick currently shown in the ticker
  /* Auto-drafting your own seat in a shared room. Solo has no use for it —
     there the button drafts the remaining board in one go and finishes — but
     in a room "the rest" cannot mean everybody's picks, so it becomes a
     standing instruction about one chair and has to be remembered between
     turns. Deliberately not saved: it is a decision about the next few
     minutes, and coming back to a draft still on autopilot is a nasty
     surprise. */
  autoMe: false,
  // Players you want, in the order you want them. Names rather than objects
  // for the same reason picks are: the board is rebuilt from the generated
  // data on every restart, so a held reference would go stale while a name
  // can be re-resolved or honestly reported as gone.
  queue: [],
  // Players you're tracking rather than planning to draft — a different
  // thing from the queue, which is the actual plan the clock falls back
  // to. Unlike the queue this is never pruned when someone else takes a
  // player: the watchlist's whole point is noticing that happened, not
  // reflecting only who is still available.
  watchlist: [],
  filterSuggest: "ALL",
  filterPlayers: "ALL",
  search: "",
  // Which column the player table is ordered by, and which way. ADP ascending
  // is the board's own order, so this starts where the list has always been.
  sort: { key: "adp", dir: 1 }
};


/* ---- 5. Snake maths ------------------------------------
   Overall pick 1 is round 1 slot 1. In even rounds the
   order reverses, which is the only thing that makes a
   snake draft a snake.                                     */

/* These are wrappers over draft-engine.js, which holds the rules with no
   reference to `league` or `state`. The wrappers exist so every call site in
   this file reads the way it always did, while there is exactly one
   implementation of what a snake draft is — the same one a server will run
   when a room has more than one person in it. */

function pickInfo(overall)  { return DraftEngine.pickInfo(overall, league.teams); }
function currentOverall()   { return state.picks.length + 1; }
function draftOver()        { return DraftEngine.draftOver(league, state.picks.length); }
function onTheClock()       { return DraftEngine.onTheClock(league, state.picks.length); }
function isMyTurn()         { const c = onTheClock(); return c !== null && c.slot === state.mySlot; }

function teamLabel(slot) {
  return slot === state.mySlot ? "Your Team" : cpuName(slot);
}

function pickCode(overall) { return DraftEngine.pickCode(overall, league.teams); }

function picksUntilMyTurn() {
  return DraftEngine.picksUntil(league, state.picks.length, state.mySlot);
}


/* ---- 6. Roster helpers --------------------------------- */

function rosterOf(slot) {
  return state.picks.filter((p) => p.slot === slot).map((p) => p.player);
}

function countAt(slot, pos) {
  return rosterOf(slot).filter((p) => p.pos === pos).length;
}


/* ---- 7. How a CPU team values a player -----------------
   Lower score wins. We start from ADP and multiply it by
   how badly the team needs that position. A team missing a
   starting RB will reach for one; a team with four already
   will not.                                                */

/* Split from needMultiplier() so a roster that is not in `state.picks` can ask
   the same question. The hero shot drafts a whole room nobody is sitting in,
   which has no slots to look up and must not touch the real draft. Every
   league-shape decision stays here rather than being restated by the caller,
   which is the point — the superflex bug was this rule written down twice. */
function needFromCount(have, pos, round) {
  if (have >= maxAt(pos)) return 999;              // roster limit

  // Kickers and defenses go at the very end of any draft, so the cutoffs are
  // measured back from the last round rather than written down as 13 and 12.
  if (pos === "K"   && round < league.rounds - 1) return 999;
  if (pos === "DST" && round < league.rounds - 2) return 999;

  // One of each is enough, whatever "enough" is set to. A superflex league
  // that starts two quarterbacks gets two.
  if (pos === "QB"  && have >= league.starters.QB + league.superflex) return 999;
  if (pos === "K"   && have >= league.starters.K)   return 999;
  if (pos === "DST" && have >= league.starters.DST) return 999;

  const need = league.starters[pos] || 0;
  if (have < need)       return 0.80;   // still filling a starting slot
  if (have < need + 2)   return 1.00;   // sensible depth
  return 1.45;                          // hoarding
}

function needMultiplier(slot, pos, round) {
  return needFromCount(countAt(slot, pos), pos, round);
}

function cpuChoice(slot, round) {
  let best = null;
  let bestScore = Infinity;

  board.forEach(function (player) {
    if (player.drafted) return;
    if (isRuledOut(player)) return;                    // never draft someone who is out
    const risk = isRisky(player) ? 1.35 : 1;           // discount the questionable ones
    const score = (player.adp + player.jitter) * needMultiplier(slot, player.pos, round) * risk;
    if (score < bestScore) { bestScore = score; best = player; }
  });

  return best;
}


/* ---- 8. Actions ---------------------------------------- */

/* Every pick goes through the engine's legality check, including the ones
   this app makes for itself. With one drafter the answer is never a
   surprise, but a rule the client only enforces when it feels like it is a
   rule the server cannot trust, and the whole point of the engine is that
   both sides reach the same verdict. */
function makePick(player) {
  const c = onTheClock();
  const taken = state.picks.map((p) => p.player.name);
  const reject = DraftEngine.rejectPick(
    league, state.picks.length, c ? c.slot : -1,
    player && player.name, taken);
  if (reject) return reject;

  player.drafted = true;
  state.picks.push({ overall: currentOverall(), round: c.round, slot: c.slot, player: player });
  return null;
}

/* CPU picks are made one at a time on a timer instead of all at
   once in a loop, so you can watch the board fill in. setTimeout
   schedules a single future call; each step schedules the next
   one, which is how you write a paced loop in a browser without
   freezing the page.                                            */

/* Milliseconds between CPU picks. This was 750, which put nearly seven
   seconds between your turns in a ten-team league and made the wait the
   most noticeable thing about the draft. 350 halves that without turning
   the board into a blur: the ticker's own entrance animation runs for
   280ms, so a pick still finishes announcing itself before the next one
   lands. Below about 300 they start treading on each other. */
const CPU_DELAY = 350;

// Deterministic pseudo-random offset of roughly -3 to +3 ADP places.
function applyJitter() {
  board.forEach(function (p) {
    p.jitter = DraftEngine.jitter(p.overall, state.seed);
  });
}

/* One chain, always.

   state.simTimer holds a single handle, so scheduling a step while another is
   already pending does not replace it - it *orphans* it. The old chain keeps
   firing, untracked, and stopSim() can then only ever cancel the newest one.
   Every orphan doubles the rate the board moves at.

   It shows up as the draft accelerating and going erratic the moment autopick
   is switched on: measured on a real 140-pick draft, CPU picks held a steady
   ~370ms for a full round, then fell to a median of 108ms with a spread of 18
   to 389 once autopick started making my picks. The proof it was chains and
   not a slow render: calling stopSim() at pick 75 left the draft running, and
   it made 18 more picks in the next two seconds.

   Clearing before scheduling makes the invariant true by construction rather
   than by every caller remembering it. */
function scheduleCpuStep() {
  if (state.simTimer) clearTimeout(state.simTimer);
  state.simTimer = setTimeout(cpuStep, CPU_DELAY);
}

function stopSim() {
  if (state.simTimer) { clearTimeout(state.simTimer); state.simTimer = null; }
  state.simulating = false;
}

function cpuStep() {
  if (draftOver() || isMyTurn()) {   // handing the clock back to you
    stopSim();
    state.lastPick = null;
    resetClock();
    showResumeBar();
render();
    return;
  }

  const c = onTheClock();
  const choice = cpuChoice(c.slot, c.round);
  if (!choice) { stopSim(); render(); return; }

  makePick(choice);
  state.lastPick = state.picks[state.picks.length - 1];

  // If that pick handed the turn back, put the clock on the board before
  // drawing rather than waiting for the next step to do it. Otherwise this
  // render paints "You're on the clock" with a stale timeLeft of 0, which
  // the header reads as ten seconds left and turns red — a warning flash on
  // a clock that has not started. It lasted a full CPU_DELAY.
  if (isMyTurn()) resetClock();

  render();

  scheduleCpuStep();
}

function runCPUs() {
  if (inRoom()) return;
  stopClock();
  if (draftOver() || isMyTurn()) { resetClock(); render(); return; }
  state.simulating = true;
  render();
  scheduleCpuStep();
}

// Jump straight to your turn without watching the rest.
function skipSim() {
  stopSim();
  let guard = 0;
  while (!draftOver() && !isMyTurn() && guard++ < totalPicks()) {
    const c = onTheClock();
    const choice = cpuChoice(c.slot, c.round);
    if (!choice) break;
    makePick(choice);
  }
  state.lastPick = null;
  resetClock();
  render();
}

/* ---- 8b. A shared room ----------------------------------

   Everything above works with no network at all, and that does
   not change: a solo draft never opens a socket. This section
   is what happens when a manager asks for a room.

   The one idea worth holding on to is that the browser stops
   deciding. Solo, draftAndAdvance() takes the player and moves
   on. In a room it sends the intent and waits, and the board
   only moves when the room says it did. That is the whole
   reason two people cannot take the same player.            */

/* "The socket is up right now" and "we are in a room" are different questions,
   and answering the second with the first is what once started a private solo
   draft on the host's phone while everybody else waited. inRoom() is the one
   to ask before *sending* anything; hasRoom() is the one to ask before
   deciding what this browser is allowed to decide for itself. */
function inRoom() { return typeof Live !== "undefined" && Live.active(); }
function hasRoom() { return typeof Live !== "undefined" && !!Live.room(); }

/* The host's browser is the CPU for every empty chair. The worker has no
   board, so the opinion is worked out here, where it already lives, and sent
   like any other pick — the room checks it really is the host and really an
   empty seat before accepting it.

   Only one pick is in flight at a time, and the wait afterwards is a real
   one. It used to be released by the next broadcast, which sounds right and
   deadlocked a live draft:

     - a pick arrives back, the flag clears, the next goes out immediately.
       Measured on localhost that is a pick every 25ms, and a whole round of
       CPU picks lands inside a second;
     - the worker allows forty actions per socket per ten seconds — a limit
       written for a person, and the host's browser is not one — so the room
       started answering `too-fast`;
     - a rejection goes to one socket and causes no broadcast. The driver
       only ever ran *on* a broadcast, so with none coming it had nothing to
       run on;
     - the clock was off, so no alarm woke the room either.

   The draft stopped dead at pick 86 with an empty chair on the clock and
   every client sitting there waiting for a browser that was waiting for them.

   So the driver is still woken by the broadcast — a *timer* cannot be the
   engine here, because a background tab has its timers clamped to a second
   and eventually to one a minute, and the host's phone is in someone's pocket
   for most of a draft — but it now refuses to send twice inside
   AUTO_PICK_MS. Broadcast-driven for liveness, time-gated for pace, with one
   retry timer as a backstop so a rejected pick, a lost broadcast or a
   momentary nothing-to-do can no longer be the end of the chain.

   The backstop is the part that makes this self-healing. Permission to try
   again is not a try, and that distinction is the whole bug above. */
const AUTO_PICK_MS = 500;   // 2/sec against the room's 4/sec ceiling

let autoInFlight = false;
let lastAutoAt = 0;
let autoRetry = null;

function scheduleAutoRetry(ms) {
  if (autoRetry) clearTimeout(autoRetry);
  autoRetry = setTimeout(function () { autoRetry = null; driveRoomCPUs(); }, ms);
}

function driveRoomCPUs() {
  const room = Live.room();
  if (!room || !room.isHost || room.status !== "drafting" || autoInFlight) return;

  const c = DraftEngine.onTheClock(room.league, room.picks.length);
  if (!c) return;

  const chair = room.seats[c.slot];
  const mine = chair && chair.you;
  const expired = room.msLeft !== null && room.msLeft <= 0;

  // An empty chair, or anyone whose clock has run out — including me.
  if (chair && chair.taken && !chair.auto && !expired) return;

  // Too soon after the last one: come back rather than dropping it, or this
  // turn waits for a broadcast that has no reason to arrive.
  const since = Date.now() - lastAutoAt;
  if (since < AUTO_PICK_MS) { scheduleAutoRetry(AUTO_PICK_MS - since); return; }

  const choice = mine ? autoPickForMe() : cpuChoice(c.slot, c.round);
  if (!choice) return;

  autoInFlight = true;
  lastAutoAt = Date.now();
  Live.autoPick(choice.name);
  scheduleAutoRetry(AUTO_PICK_MS + 2000);
}

/* Your own seat, drafting itself, when you have asked it to.

   Deliberately separate from driveRoomCPUs() above even though the shape is
   the same. That one is the *host* standing in for chairs nobody is sitting
   in, and it runs on one machine for the whole room; this is any manager
   asking for their own chair to be played, and it runs on theirs. Merging
   them would put "am I the host" and "is this my seat" in one condition, and
   they answer to different people. */
let myAutoInFlight = false;

function driveMyAutopilot() {
  const room = Live.room();
  if (!state.autoMe || !room || room.status !== "drafting" || myAutoInFlight) return;

  const c = DraftEngine.onTheClock(room.league, room.picks.length);
  if (!c || c.slot !== room.yourSeat) return;      // not your turn: nothing to do

  const choice = autoPickForMe();
  if (!choice) return;

  myAutoInFlight = true;
  Live.pick(choice.name);
  // Released on a timer rather than on the next state, because a rejected
  // pick — somebody took him a tenth of a second earlier — still has to be
  // followed by another attempt or the seat stalls until the clock expires.
  setTimeout(function () { myAutoInFlight = false; driveMyAutopilot(); }, 1200);
}

/* Take the room's word for it. The room sends a pick list of names; this
   turns them back into board players. Rebuilt only when the count differs,
   because a state arrives on every seat change and every chat message too. */
/* Does the room's league match ours, key for key?

   Only the keys the *room* sent are compared. A room made by an older build
   may not carry all of them, and Object.assign leaves ours in place for those
   — so comparing our keys instead would report a difference that adopting can
   never close, and rebuild the board on every broadcast forever. */
function sameLeague(theirs, ours) {
  return Object.keys(theirs).every(function (key) {
    return JSON.stringify(theirs[key]) === JSON.stringify(ours[key]);
  });
}

function adoptRoom(room) {
  if (!room) return;

  /* Joining someone else's room means drafting their league, not yours — all
     of it. This compared team counts alone, so a room that differed in
     anything else left the joiner on their own settings, and one of those
     settings decides which players exist.

     `scoring` picks the ADP set, and the sets are not the same people: 221 in
     half PPR against 260 in full. So a half-PPR joiner in a full-PPR room had
     a board missing 39 of the players that room could draft — including
     defenses and kickers, which is the last round. Every one of them arrived
     below as a key nothing matched and was dropped without a word, which
     reads on the board as a CPU seat that skipped its turn, and leaves the
     draft permanently one pick short of finishing: draftOver() never goes
     true, so the Analysis tab is stuck on "Grade so far" for a draft the room
     finished minutes ago.

     The board has to be rebuilt for any of it, not only for scoring —
     replacement level, tiers and every projection are worked out from the
     lineup and the scoring table — and rebuilding clears the drafted flags,
     so the picks below have to be re-applied whether or not the count moved. */
  let rebuilt = false;

  if (room.league && !sameLeague(room.league, league)) {
    Object.assign(league, JSON.parse(JSON.stringify(room.league)));
    buildBoard();
    rebuilt = true;

    /* The setup screen is drawn from `league` and does not read it again on
       its own, so without this it goes on showing the shape of whatever room
       you were in last — which is what a joiner saw instead of the room they
       had just walked into.

       lastFormat moves with it. readSetup() treats a changed format as "the
       user just picked a new one" and resets the reception rule to that
       format's default, which would throw away the host's edited scoring the
       next time anything on the screen was touched. */
    fillSetupControls();
    renderScoringFields();
    lastFormat = league.scoring;
  }

  if (room.yourSeat >= 0) state.mySlot = room.yourSeat;
  state.clockLength = room.clockLength;
  state.seed = room.seed;
  state.started = room.status !== "lobby";
  // The room's, not ours. Pausing is the host's and arrives back like every
  // other fact about a shared draft.
  state.paused = !!room.paused;

  if (rebuilt || state.picks.length !== room.picks.length) {
    applyJitter();
    board.forEach(function (p) { p.drafted = false; });
    state.picks = [];

    /* A key nothing matches used to return quietly, which is how the bug
       above stayed invisible for a whole draft. It should not be reachable
       now that the league is adopted whole, and if it ever is again the board
       is wrong in a way nobody can see — so it says so once per pick rather
       than leaving a hole for somebody to find in the last round. */
    room.picks.forEach(function (rp) {
      const player = board.find((p) => p.name === rp.key);
      if (!player) {
        console.warn("Room pick " + rp.overall + " (" + rp.key +
                     ") is not on this board — the leagues have drifted apart.");
        return;
      }
      player.drafted = true;
      state.picks.push({
        overall: rp.overall, round: rp.round, slot: rp.slot, player: player
      });
    });

    pruneQueue();
    state.lastPick = state.picks.length ? state.picks[state.picks.length - 1] : null;
    /* A pick landed, so nothing of ours is in flight any more. This releases
       the *one at a time* guard and nothing else: the pace is a clock now,
       kept in driveRoomCPUs(), because this line on its own is what let the
       host fire a pick every 25ms and trip the room's rate limit. */
    autoInFlight = false;
  }

  // The room owns the countdown, so the local clock only mirrors it. Nothing
  // here starts a timer: renderHeader() reads state.timeLeft.
  state.timeLeft = room.msLeft === null ? 0 : Math.ceil(room.msLeft / 1000);
}

/* Chat is the only thing on this page written by somebody else.

   Everything else — every player name, every team, every label — comes out of
   our own pipeline and goes into innerHTML as it is. A message does not, and
   the same rule the score strip follows applies here with far more force:
   escape it. This is the one place where not doing so would hand another
   manager a script tag in your draft.

   Names too. A name is typed by a person and is no safer than the message. */
/* Only GIPHY's own media may be put in an img src. Same check the room
   makes, kept here as well because the room is the authority and this is
   what actually asks a browser to fetch the address. Parsed rather than
   pattern-matched: "https://evil.com/?x=giphy.com" contains the string and
   is not GIPHY. */
function safeGif(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "giphy.com" && !host.endsWith(".giphy.com")) return null;
    return url.href;
  } catch (err) {
    return null;
  }
}

/* ---- room chat ------------------------------------------

   What the room stores is a flat list of things people said. What a draft
   chat has to read like is a conversation with a draft happening in it, so
   this is where the two are put back together:

   - picks are merged in from room.picks rather than stored as messages,
     because the room already has every one of them and writing them down
     twice would push the actual conversation out of a fixed-length log by
     about the third round;
   - consecutive lines from one person collapse under one name, the way every
     chat written since about 2013 does it;
   - reactions hang off a message instead of becoming six more messages.

   Everything a person typed still goes through escHtml() on the way in. That
   is not a style choice here — see the note above safeGif(). */

const chatUI = {
  seenId: 0,          // the newest line drawn while the log was at the bottom
  unread: 0,
  pinned: true,       // is the log sitting on the newest line
  open: false,        // the mobile sheet
  typing: {},         // seat -> when we stop believing it
  sweep: null,
  sentTypingAt: 0
};

/* Two minutes of silence, or a change of speaker, starts a new block. Short
   enough that "ok" ten minutes later is not filed under the same breath as
   the sentence before it. */
const GROUP_MS = 2 * 60 * 1000;

/* Believed for four seconds and then not. The sender re-sends while they are
   still typing, so this lapses on its own if they close the tab mid-word
   rather than leaving a ghost typing forever. */
const TYPING_MS = 4000;

/* The most recent slice of the stream, not all of it. A full room carries up
   to two hundred messages and a hundred and eighty picks, and render()
   rebuilds every panel on every state change — including one per pick. */
const CHAT_DRAW = 140;

function chatTime(at) {
  if (!at) return "";
  const d = new Date(at);
  let h = d.getHours();
  const suffix = h < 12 ? "am" : "pm";
  h = h % 12 || 12;
  return h + ":" + String(d.getMinutes()).padStart(2, "0") + suffix;
}

/* A seat's name, preferred live over the one recorded on the message, so
   somebody who renames themselves is renamed everywhere the moment they do
   it rather than only on what they say next.

   Null when nobody has typed one, rather than "Seat 4". The caller decides
   what to show — and the avatar wants the seat number rather than the
   initials of the words "Seat 4", which is how it briefly read as "S4". */
function seatName(room, seat, fallback) {
  if (seat < 0) return fallback || null;
  const chair = room.seats && room.seats[seat];
  return (chair && chair.name) || fallback || null;
}

function seatLabel(room, seat, fallback) {
  return seatName(room, seat, fallback) ||
         (seat >= 0 ? "Seat " + (seat + 1) : "Someone");
}

/* Initials for the avatar. Two words give two letters, one gives one, and a
   seat with nobody's name on it gives its number — which is still an
   identity, and is what a chair in an invite link has until someone types
   into the name box.

   Not initials(). There is already one of those for player photos, it is
   declared later in this file, and a second function declaration with the
   same name silently wins — so this was quietly calling the player one,
   which throws on a null name. Check a new name against the file. */
function seatInitials(name, seat) {
  if (!name) return String(seat + 1);
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map(function (w) { return w[0].toUpperCase(); }).join("");
}

/* One list, in the order things actually happened. Picks carry `at` already,
   which is what makes this possible without the room storing anything new. */
function chatStream(room) {
  const out = [];

  (room.chat || []).forEach(function (m) {
    out.push({
      kind: m.system ? "system" : "said",
      id: m.id, seat: m.seat, name: m.name, text: m.text,
      gif: m.gif, at: m.at, reacts: m.reacts
    });
  });

  (room.picks || []).forEach(function (p) {
    out.push({
      kind: "pick", seat: p.slot, at: p.at,
      round: p.round, overall: p.overall, player: p.key
    });
  });

  out.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  return out.length > CHAT_DRAW ? out.slice(-CHAT_DRAW) : out;
}

function chatReactRow(entry, room) {
  if (!entry.reacts || !entry.reacts.length) return "";
  const buttons = entry.reacts.map(function (r) {
    return `<button type="button" class="reactchip${r.you ? " on" : ""}"
        data-react="${entry.id}" data-emoji="${escHtml(r.emoji)}"
        aria-label="${r.count} reacted ${escHtml(r.emoji)}"
      >${escHtml(r.emoji)}<b>${r.count}</b></button>`;
  }).join("");
  return `<div class="reactrow">${buttons}</div>`;
}

function chatSaidHtml(entry, room, grouped) {
  const mine = entry.seat >= 0 && entry.seat === room.yourSeat;
  const named = seatName(room, entry.seat, entry.name);
  const who = seatLabel(room, entry.seat, entry.name);

  /* The room already refused anything that is not GIPHY's own media, so this
     is the second of two checks rather than the only one. It is here because
     the room is the authority and this is the thing that actually asks a
     browser to fetch the address — and an old room, or a future one, should
     not be able to talk this page into loading from somewhere else. */
  const gif = safeGif(entry.gif);

  const body =
    (entry.text ? `<span class="msgtext">${escHtml(entry.text)}</span>` : "") +
    (gif ? `<img class="chatgif" src="${escHtml(gif)}" alt="" loading="lazy">` : "") +
    chatReactRow(entry, room);

  // The picker is opened from the message, so it needs somewhere to hang.
  const tools = `<button type="button" class="reactadd" data-addreact="${entry.id}"
      aria-label="React to this message">+</button>`;

  if (grouped) {
    return `<div class="msg grouped${mine ? " mine" : ""}" data-line="${entry.id}">
        <span class="msgwhen">${escHtml(chatTime(entry.at))}</span>
        <div class="msgbody">${body}</div>${tools}
      </div>`;
  }

  return `<div class="msg${mine ? " mine" : ""}" data-line="${entry.id}">
      <span class="chatav av${entry.seat >= 0 ? entry.seat % 8 : 0}"
            aria-hidden="true">${escHtml(seatInitials(named, entry.seat))}</span>
      <div class="msgbody">
        <p class="msgwho">${escHtml(who)}<span class="msgwhen">${escHtml(chatTime(entry.at))}</span></p>
        ${body}
      </div>${tools}
    </div>`;
}

function chatPickHtml(entry, room) {
  const who = seatLabel(room, entry.seat, null);
  const mine = entry.seat >= 0 && entry.seat === room.yourSeat;

  /* A player name is ours, out of the generated board, so it is the one
     string here that does not strictly need escaping. It gets it anyway —
     the alternative is a reader having to know which of two adjacent
     interpolations is the safe one. */
  /* The engine's own code, not round-plus-overall. Written by hand this read
     "4.40" for the fortieth pick of a ten-team draft, which is round four,
     pick ten — and the header two inches above it was saying "4.10 (40
     Overall)" at the same time. One draft, two numbering schemes. */
  const teams = (room.league && room.league.teams) || league.teams;

  return `<div class="pickline${mine ? " mine" : ""}">
      <span class="pickno">${DraftEngine.pickCode(entry.overall, teams)}</span>
      <span class="picktext"><b>${escHtml(who)}</b> drafted ${escHtml(entry.player)}</span>
      <span class="msgwhen">${escHtml(chatTime(entry.at))}</span>
    </div>`;
}

/* ---- the end of a draft ---------------------------------

   The analysis is what the whole thing was for — the hero promises a grade
   afterwards that shows its working — and until now it sat behind a tab you
   had to know to press. The last pick lands, three buttons quietly change in
   the action bar, and nothing else says it is over.

   So it opens itself. A tab rather than a dialog, deliberately: the analysis
   is a grade, four bars, two callouts, a bye strip, a standings table and a
   method note, which is a page rather than something to read inside a box.
   And a dialog would need dismissing, which puts the most valuable screen in
   the app one stray click from gone. Switching tabs leaves everything where
   it was — the board is one press away and nothing has to be closed. */
function revealAnalysis() {
  showPanel("tab-grades");
  document.querySelectorAll(".tabs button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.tab === "tab-grades");
  });
  window.scrollTo(0, 0);
}

/* Whether the draft was already over last time we looked.

   This has to be an edge, not a state. render() runs on every change, so
   acting on "the draft is over" would drag you back to the analysis every
   time you clicked away from it — including the click you just made to look
   at the board. Acting on "the draft just became over" fires once. */
let draftWasOver = false;

// Seeded by whatever establishes a draft, so that adopting a finished board
// is not mistaken for one finishing under you.
function noteDraftPhase() { draftWasOver = state.started && draftOver(); }

function checkDraftFinished() {
  const over = state.started && draftOver();
  if (over && !draftWasOver) { revealAnalysis(); recordHistory(); }
  draftWasOver = over;
}

/* Off the setup screen and into the draft. Its own function because two
   things reach it: pressing Start in a solo draft, and — in a room — the
   broadcast saying the host has begun, which is the only signal a guest
   ever gets. */
function enterDraftUI() {
  tabrow.hidden = false;
  showPanel("tab-suggest");
  document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.remove("on"); });
  document.querySelector('.tabs button[data-tab="tab-suggest"]').classList.add("on");
  window.scrollTo(0, 0);
}

function renderChat() {
  const dock = $("chatDock");
  const room = typeof Live === "undefined" ? null : Live.room();

  if (!room) {
    dock.hidden = true;
    $("chatFab").hidden = true;
    // Moved out, not just hidden. See placeChat() — a hidden dock left in the
    // draft slot keeps its column and takes 330px off the board.
    placeChat();
    return;
  }
  dock.hidden = false;
  placeChat();

  const log = $("chatLog");
  const stream = chatStream(room);

  /* Is the chat actually on screen? On a phone it is a sheet, and a closed
     sheet is the one moment unread messages matter most — but a hidden log
     has no height, so "am I scrolled to the bottom" answers yes and clears
     the count that the launcher's badge exists to show.

     Asked of the computed style rather than of a matchMedia copy of the
     breakpoint, so the answer comes from the stylesheet that actually
     decides it and there is only one of it. */
  const onScreen = getComputedStyle(dock).display !== "none";

  // Measured before the rebuild, because the rebuild is what destroys it.
  const wasPinned = onScreen &&
    log.scrollHeight - log.scrollTop - log.clientHeight < 48;

  if (!stream.length) {
    log.innerHTML = `<p class="chatempty">Nobody has said anything yet.</p>`;
  } else {
    let lastSeat = null;
    let lastAt = 0;
    let lastKind = null;

    log.innerHTML = stream.map(function (entry) {
      if (entry.kind === "system") {
        lastSeat = null; lastKind = "system";
        return `<p class="chatline system">${escHtml(entry.text)}</p>`;
      }
      if (entry.kind === "pick") {
        lastSeat = null; lastKind = "pick";
        return chatPickHtml(entry, room);
      }

      const grouped = lastKind === "said" && entry.seat === lastSeat &&
                      entry.at - lastAt < GROUP_MS;
      lastSeat = entry.seat; lastAt = entry.at; lastKind = "said";
      return chatSaidHtml(entry, room, grouped);
    }).join("");
  }

  const newest = stream.reduce(function (top, e) {
    return e.id && e.id > top ? e.id : top;
  }, 0);

  /* Pinned to the newest line, but only if it was pinned already. Yanking
     somebody to the bottom while they are reading back is how a chat becomes
     a thing people stop opening. What arrives while they are up there is
     counted instead, and offered. */
  if (onScreen && (wasPinned || chatUI.pinned)) {
    log.scrollTop = log.scrollHeight;
    chatUI.pinned = true;
    chatUI.seenId = newest;
    chatUI.unread = 0;
  } else {
    chatUI.unread = stream.filter(function (e) {
      return e.kind === "said" && e.id > chatUI.seenId &&
             e.seat !== room.yourSeat;
    }).length;
  }

  renderChatMeta(room);
}

/* The bits around the log: who is here, who is typing, what you have missed.
   Separate from the log itself because a typing indicator changes several
   times a second and rebuilding a hundred messages for it would be silly. */
function renderChatMeta(room) {
  if (!room) return;

  const taken = room.seats.filter(function (s) { return s.taken; }).length;
  $("chatPresence").textContent =
    taken + (taken === 1 ? " manager" : " managers") + " here";

  // Only people we still believe. The sweep below expires them.
  const now = Date.now();
  const names = Object.keys(chatUI.typing)
    .filter(function (seat) { return chatUI.typing[seat] > now; })
    .map(function (seat) { return seatLabel(room, Number(seat), null); });

  $("chatTyping").textContent =
    names.length === 0 ? "" :
    names.length === 1 ? names[0] + " is typing…" :
    names.length === 2 ? names[0] + " and " + names[1] + " are typing…" :
    "Several managers are typing…";

  /* Whether the chat can actually reach anyone.

     Everything in the dock is a socket message, so all of it stops working
     when one drops — and it used to stop working silently: the box still
     invited a message, Send did nothing at all, and the line was neither sent
     nor kept. A control that cannot act should say so rather than swallow the
     click, so the whole footer goes dead together and one line explains it. */
  const connected = inRoom();
  $("chatOffline").hidden = connected;
  $("chatInput").disabled = !connected;
  $("chatSend").disabled = !connected;
  $("gifBtn").disabled = !connected;
  Array.prototype.forEach.call(
    $("chatReactions").querySelectorAll("button"),
    function (b) { b.disabled = !connected; });

  const jump = $("chatJump");
  jump.hidden = chatUI.unread === 0;
  jump.textContent = chatUI.unread + " new " +
    (chatUI.unread === 1 ? "message" : "messages") + " ↓";

  const badge = $("chatBadge");
  badge.hidden = chatUI.unread === 0;
  badge.textContent = chatUI.unread > 9 ? "9+" : String(chatUI.unread);

  /* The launcher is only ever for the draft, and only ever on a narrow
     screen — CSS decides the second part. Not in the lobby, where the dock is
     a plain block in the setup form and a button to open something already
     open is just a button that appears to do nothing. */
  $("chatFab").hidden = !(state.started && route() === "draft");
}

/* One dock, two homes. Moved rather than duplicated, because it holds a
   scroll position, a half-typed message and possibly an open GIF search, and
   two copies would mean deciding which of those is the real one every time
   the draft starts.

   Only ever moved when the destination actually changes: appendChild on the
   parent a focused input is inside blurs it, and re-blurring the chat box on
   every broadcast would make it unusable. */
function placeChat() {
  const dock = $("chatDock");

  /* Parked outside the draft grid when there is no room to talk in, and this
     is the whole of a bug that made a solo draft look wrong.

     `.draftshell > .chatslot:not(:empty)` claims a 330px column, and `:empty`
     is about child *nodes* — a slot holding a dock with `hidden` on it is not
     empty. So leaving a room and starting a solo draft in the same tab left
     the dock behind, hiding it and keeping its column: 330px of nothing beside
     the board, and the board itself down from 1391px to 1061px to pay for it.

     Hiding a thing is not the same as putting it away. Same family as the
     rule about `[hidden]` losing to an author `display`, and the same fix —
     make the DOM say what is actually true. */
  const slot = !hasRoom()
    ? $("view-app")
    : $(state.started && route() === "draft" ? "draftChatSlot" : "lobbyChatSlot");

  if (slot && dock.parentNode !== slot) slot.appendChild(dock);
}

function onRoomChange() {
  const room = Live.room();

  /* Whether the draft has begun, asked before and after, because the answer
     changing is the thing that has to move everybody off the setup screen.

     The button cannot do it. In a room it sends the intent and returns, and
     the nine other managers never press it at all — so the transition has to
     hang off the broadcast, which is the only thing all ten of us see. It
     did not, and the draft ran behind a setup form for everyone. */
  const wasStarted = state.started;

  adoptRoom(room);
  if (!wasStarted && state.started) enterDraftUI();

  renderInvite();
  renderChat();
  render();
  driveRoomCPUs();
  driveMyAutopilot();

  /* The room's countdown, restarted against the figure that just arrived —
     adoptRoom() has the number, this is only what makes it move between
     broadcasts.

     Last, and deliberately below the two drivers. Those are the liveness of
     the entire room: the host's browser is what plays every empty chair, and
     it runs on the broadcast. Anything new placed above them is a new way for
     one thrown exception to stop a draft ten people are sitting in — which is
     the shape of the deadlock at pick 86, and painting a clock is not worth
     re-opening it. */
  resetClock();
}

/* Somebody is typing. Recorded with an expiry rather than a flag, so a
   manager who starts a sentence and then locks their phone stops being
   described as typing four seconds later instead of forever. */
function onRoomTyping(msg) {
  if (msg.seat < 0) return;

  if (msg.on) chatUI.typing[msg.seat] = Date.now() + TYPING_MS;
  else delete chatUI.typing[msg.seat];

  renderChatMeta(Live.room());
  startTypingSweep();
}

/* One timer, running only while somebody is actually typing. The expiry
   above is what makes a stale indicator impossible; this is only what makes
   it disappear on time rather than at the next broadcast. */
function startTypingSweep() {
  if (chatUI.sweep) return;
  chatUI.sweep = setInterval(function () {
    const now = Date.now();
    let live = 0;
    Object.keys(chatUI.typing).forEach(function (seat) {
      if (chatUI.typing[seat] > now) live++;
      else delete chatUI.typing[seat];
    });
    renderChatMeta(Live.room());
    if (!live) { clearInterval(chatUI.sweep); chatUI.sweep = null; }
  }, 1000);
}

/* ---- the queue ------------------------------------------

   Suggestions are what the model thinks. The queue is what you
   think, which is a different thing and worth somewhere to
   put it: between your turns is when a drafter actually makes
   a plan, and until now there was nowhere to record one.     */

function queueIndex(name) { return state.queue.indexOf(name); }

function queued(player) { return queueIndex(player.name) >= 0; }

function queueToggle(name) {
  const at = queueIndex(name);
  if (at >= 0) state.queue.splice(at, 1);
  else state.queue.push(name);
}

// Up is toward the front, which is the way the list reads.
function queueMove(name, delta) {
  const at = queueIndex(name);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= state.queue.length) return;
  state.queue.splice(to, 0, state.queue.splice(at, 1)[0]);
}

function watchlistIndex(name) { return state.watchlist.indexOf(name); }

function watchlisted(player) { return watchlistIndex(player.name) >= 0; }

function watchlistToggle(name) {
  const at = watchlistIndex(name);
  if (at >= 0) state.watchlist.splice(at, 1);
  else state.watchlist.push(name);
}

// Someone else taking your man is the normal case, not an error, so he
// leaves quietly rather than sitting there as a row you cannot draft.
function pruneQueue() {
  state.queue = state.queue.filter(function (name) {
    const player = board.find((p) => p.name === name);
    return player && !player.drafted;
  });
}

// The first player in your queue still on the board. This is what the clock
// takes when it runs out, in preference to the computed suggestion — being
// away from the screen should not throw away the plan you made before you
// left it.
function queueTop() {
  for (let i = 0; i < state.queue.length; i++) {
    const player = board.find((p) => p.name === state.queue[i]);
    if (player && !player.drafted && !isRuledOut(player)) return player;
  }
  return null;
}

// What to take on my behalf when I am not the one choosing. Order matters:
// my own list first, the model's opinion second.
/* What to take on my behalf when I am not the one choosing.

   Four answers, in falling order of how much they know about what you want,
   because this must always have one. It used to be
   `queueTop() || suggestions()[0] || null`, and that `null` stopped a draft
   dead: `suggestions()` is filtered by the position chip on the panel, so a
   manager who tapped "TE" and already held their three tight ends had an
   empty list — and "Auto-draft the rest" read that as "there is nothing left
   to draft" and abandoned the remaining rounds without a word. Reported from
   a real draft, stopping in the ninth round of fourteen.

   The chip is a way of *looking* at the board, not a rule about what may be
   drafted, so it is not consulted here at all — `suggestions("ALL")`, always.

   Consulting it first and falling back looked like the respectful version and
   was worse: leave the panel on K, walk away, and the clock hands you a
   kicker in the fifth round. Caught by the test written for the bug above,
   which is the argument for writing it. A filter that can lose you a draft is
   not deference, and the queue is already where "what I actually want" lives.

   The roster caps go the same way at the last step: they exist to stop the
   CPU hoarding tight ends, not to decide that your draft is over. */
function autoPickForMe() {
  return queueTop()               // the plan you actually made
      || suggestions("ALL")[0]    // the model's opinion, whatever you were looking at
      || bestLeft();              // and failing that, simply the best man left
}

/* The best player still on the board, ignoring every preference there is.

   A last resort, and it only has to beat one thing: a draft that stops
   halfway. K and DST come last even here, because the whole app already
   refuses them until the closing rounds and a kicker in the sixth would read
   as a bug in its own right — but they are still better than nothing if the
   board somehow holds nothing else.

   `board` is in ADP order and must never be sorted in place, so this filters,
   which already returns a copy. */
function bestLeft() {
  const left = board.filter(function (p) { return !p.drafted && !isRuledOut(p); });
  if (!left.length) return null;
  const skill = left.filter(function (p) { return p.pos !== "K" && p.pos !== "DST"; });
  return skill.length ? skill[0] : left[0];
}

function draftAndAdvance(player) {
  // In a room this is a request, not a decision. Nothing changes locally:
  // the board moves when the room broadcasts, which is what stops two
  // managers ending up with different boards.
  if (inRoom()) { Live.pick(player.name); return; }

  makePick(player);
  state.lastPick = state.picks[state.picks.length - 1];
  pruneQueue();
  render();
  runCPUs();
}

function undo() {
  stopSim();
  state.lastPick = null;
  if (state.picks.length === 0) return;
  // Roll back past the CPU picks and my previous pick, so it's my turn again.
  do {
    const last = state.picks.pop();
    last.player.drafted = false;
  } while (state.picks.length > 0 && !isMyTurn());
  pruneQueue();
  resetClock();
  render();
}

function autoDraftRest() {
  stopSim();
  stopClock();
  state.lastPick = null;

  /* In a room this is a request about one chair, not a decision about ten.

     The loop below drafts every remaining pick on the board, which is exactly
     right on your own machine and completely wrong in a room: it filled in
     nine other managers' teams — two of them people sitting there with the
     app open — and did it locally, so the host was looking at a finished
     draft the room had never heard of. The next broadcast then rolled all of
     it back, which is the same bug wearing a different coat.

     So in a room it becomes an autopilot on your seat: submitted as ordinary
     picks, one per turn, through the same door as any other pick, and the
     board still only moves when the room says so. Everyone else drafts for
     themselves. It toggles, because "I am going to be away for ten minutes"
     stops being true and there has to be a way back. */
  if (inRoom()) {
    state.autoMe = !state.autoMe;
    render();
    driveMyAutopilot();
    return;
  }

  let guard = 0;
  while (!draftOver() && guard++ < totalPicks()) {
    const c = onTheClock();
    /* My seats follow my queue before the model's opinion, exactly as the
       clock does. Auto-drafting the rest should not quietly throw away the
       plan I made. Every other seat is still the CPU's own choice.

       Both fall back to the best player left rather than to nothing.
       `cpuChoice()` is left alone to answer however it answers — every client
       in a room has to agree with it, so it is not a thing to loosen — and
       the fallback lives here, where it only affects a draft nobody else is
       in. The rule this enforces is that the button either finishes the
       draft or the board is empty. There is no third outcome, and there used
       to be: it stopped in round nine and said nothing. */
    const choice = (c.slot === state.mySlot
      ? autoPickForMe()
      : cpuChoice(c.slot, c.round)) || bestLeft();
    if (!choice) break;
    // A rejected pick would otherwise be retried identically until the guard
    // ran out, which looks exactly like stopping halfway.
    if (makePick(choice)) break;
    pruneQueue();
  }
  render();
}

/* Leaving the draft room and throwing the draft away are two different
   things, and the old single "Restart" did both. goHome() leaves the save
   alone, so the setup screen offers the draft straight back — which is what
   you want after a completed mock, when the finished board is worth keeping. */

function goHome() {
  stopSim();
  stopClock();
  state.autoMe = false;

  /* Leaving the draft screen has to mean leaving the room, and it did not.

     Everything below clears the local draft — and in a room the local draft
     is a copy, so the very next broadcast put it all back and `enterDraftUI()`
     dropped you into the draft again at the room's real position. Pressing a
     button that says "New mock draft" and landing back in the old one is not
     a stale screen; it is the app refusing to leave.

     So the room is left first. That is a real departure — the chair goes to
     the CPU exactly as it does when a tab is closed — and it is recoverable
     the same way: reopening the invite link reclaims the seat and takes it
     off auto. The room code comes out of the address too, so a reload lands
     on the setup screen rather than walking straight back in. */
  if (typeof Live !== "undefined" && Live.room()) {
    Live.disconnect();
    if (location.hash.indexOf("room=") >= 0) location.hash = "#/draft-room";
    renderInvite();
    renderChat();
  }

  openRailSheet(false);   // a sheet left open over the landing page
  state.lastPick = null;
  board.forEach((p) => { p.drafted = false; p.jitter = 0; });
  state.picks = [];
  state.started = false;
  state.paused = false;
  tabrow.hidden = true;
  showPanel("tab-setup");
  // Back to the setup screen, where the league can be changed again, so the
  // board is rebuilt rather than just redrawn.
  refreshSetup();
  window.scrollTo(0, 0);
}

// The destructive one. Clear first, so the resume bar has nothing to offer.
function restart() {
  clearSave();
  goHome();
}

// The mark in the header. Mid-draft this is a surprising place to land, so
// it asks first; once the draft is over there is nothing to interrupt.


/* ---- 9. The pick clock ---------------------------------
   setInterval runs a function once a second. When the clock
   hits zero we draft the top suggestion, which is exactly
   what FantasyPros does.                                   */

function stopClock() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}

/* Two different questions that used to be one.

   `clockRunnable()` is "should this browser be counting" — and only your own
   turn in a solo draft ever is, because that is the only countdown a solo
   draft has and running out of it drafts for you.

   `clockShowing()` is "is there a countdown worth drawing", which in a room is
   true on everybody's turn. The room already sends msLeft to every client and
   adoptRoom() already mirrors it into state.timeLeft; the page simply refused
   to draw it unless the seat was yours, so nine people out of ten watched a
   clock they could not see. */
function clockRunnable() {
  return state.clockLength > 0 && !draftOver() && !hasRoom() && isMyTurn();
}

function clockShowing() {
  if (!state.clockLength || draftOver() || !state.started) return false;
  return hasRoom() || isMyTurn();
}

// Start counting down from whatever is on the clock right now.
function startTicking() {
  stopClock();
  state.timerId = setInterval(function () {
    state.timeLeft--;
    if (state.timeLeft <= 0) {
      stopClock();
      const auto = autoPickForMe();
      if (auto) draftAndAdvance(auto);
    } else {
      renderHeader();
      tickBoardClock();
    }
  }, 1000);
}

/* One cell, once a second. This is the same exception renderHeader() already
   is: render() rebuilds everything on a change, and a clock tick is not a
   change to the draft — it is the same board with a different number on it.
   Rebuilding a 24-by-20 grid every second to move one digit would be a lot
   of work to say the same thing. Silently does nothing when the board is not
   the panel on screen, because getElementById simply will not find it. */
function tickBoardClock() {
  const cell = $("boardClock");
  if (cell && clockShowing()) cell.textContent = clockText();
}

/* A room's clock, painted rather than counted.

   The room is the authority and sends msLeft with every broadcast — but a
   broadcast happens on a pick or a message, not once a second, so a clock
   drawn only from those sits still for a minute and then jumps. This walks
   the last known figure down in between and is corrected by the next
   broadcast. It never drafts: running out is the room's business, and the
   host's browser is what answers for it. */
function startRoomTicking() {
  stopClock();
  state.timerId = setInterval(function () {
    if (state.timeLeft > 0) state.timeLeft--;
    renderHeader();
    tickBoardClock();
  }, 1000);
}

// Put a fresh clock on the board. Called after every pick.
function resetClock() {
  stopClock();

  /* The room counts for everyone in a shared draft, and a second timer
     deciding things locally would disagree with it within a few seconds. So
     nothing here starts a countdown that can act — only one that draws.

     hasRoom() rather than inRoom(): a dropped socket is still a room, and a
     browser that answered "no" to that would start counting on its own and
     draft for a seat it no longer speaks for. */
  if (hasRoom()) {
    if (clockShowing() && !state.paused) startRoomTicking();
    return;
  }

  if (!clockRunnable()) return;
  state.timeLeft = state.clockLength;
  if (!state.paused) startTicking();
}

/* Pausing only stops the countdown. You can still draft while paused, and the
   pause survives until you turn it back off.

   In a room it is a message, not a flag. It used to be neither: the local
   value flipped, the header read "Paused", and the room went on counting
   down and handed the seat to the CPU underneath it. The room refuses it from
   anyone but the host, and the answer comes back as room.paused like every
   other fact about a shared draft — so nothing is set here at all. */
function togglePause() {
  if (hasRoom()) { Live.pause(!state.paused); return; }

  state.paused = !state.paused;
  if (state.paused) {
    stopClock();
  } else if (clockRunnable()) {
    startTicking();
  }
  renderPauseButton();
  renderHeader();
}

// Pause, undo and auto-draft are all meaningless once the last pick is in.
// Rather than leave four dead controls sitting there, the bar becomes the
// one thing you actually want next.
/* Three of these were the browser deciding things it does not get to decide
   in a room, and all three were offered to everybody in it.

   - Undo rolls picks off the local copy. In a room the local copy is a
     drawing of somebody else's record, so it un-drafted players for you and
     the next broadcast put them straight back. There is no shared undo and
     there should not be one: a draft ten people are in is not a thing one of
     them reverses. It goes away.
   - Pause is the host's, and it is now a message rather than a local flag —
     see togglePause(). Everyone else sees the state it produces.
   - "Discard draft" did not discard anybody's draft but yours, and what it
     actually did in a room was walk you out of it. The label is the bug: it
     reads as destroying a shared draft and it reads as an act, so it says
     what it does. */
function renderActionBar() {
  const done = draftOver();
  const room = hasRoom();
  const host = room && !!Live.room().isHost;

  $("newDraftBtn").hidden = !done;
  $("pauseBtn").hidden    = done || (room && !host);
  $("undoBtn").hidden     = done || room;
  $("autoBtn").hidden     = done;

  const quit = $("restartBtn");
  quit.textContent = room ? "Leave the room" : "Discard draft";
  quit.classList.toggle("danger", !room);

  if (!done) { renderPauseButton(); renderAutoButton(); }
}

/* "Auto-draft the rest" is the truth on your own machine and a promise the
   app cannot keep in a room, where the rest is nine other people's business.
   The label was part of the bug, not decoration on top of it: it is what said
   the button would fill in the whole board, and in a room it did. */
function renderAutoButton() {
  const btn = $("autoBtn");
  if (!inRoom()) { btn.textContent = "Auto-draft the rest"; return; }
  btn.textContent = state.autoMe ? "Stop auto-drafting" : "Auto-draft my picks";
}

function renderPauseButton() {
  const button = $("pauseBtn");
  button.textContent = state.paused ? "Resume clock" : "Pause clock";
  button.classList.toggle("active", state.paused);
  button.disabled = state.clockLength === 0;
}

function clockText() {
  const m = Math.floor(state.timeLeft / 60);
  const s = state.timeLeft % 60;
  return m + ":" + String(s).padStart(2, "0");
}


/* ---- 10. Suggestions -----------------------------------
   The same scoring the CPUs use, but applied to your roster
   — so it recommends what your team actually needs.        */

/* The model's opinion, as a multiplier beside need and risk.

   Everything else on the page answers to the scoring rules — the Juke score,
   replacement level, the whole grade — and this did not. Suggestions were ADP
   times need times risk, so setting receptions to five points changed every
   number printed on a card and none of the order: with the editor open the
   app was computing a better answer than the one it was giving.

   It has to be the Juke score, not marketGap(). marketGap compares a player with
   his own position's market, so it says "this receiver is underrated among
   receivers" and cannot say "receivers are worth more than backs now" — which
   is the only thing five points a catch changes. Tried it that way first and
   the list did not move, because the elite are WR1 and RB1 on both measures
   whatever the rules. overallScore() is points above replacement at his own
   position against the best such figure anywhere on the board, so it compares
   across positions and answers to every rule in the table.

   A multiplier, so it sits with need and risk rather than beside them in
   different units, and it only ever pulls up: a player the model rates gets a
   discount on his price, one it does not rate stays exactly where the market
   put him. No centre point to argue about, and no player is pushed down for
   want of a projection — those score null and are left alone.

   Capped, because ADP is the one thing here that knows when a player will
   actually be gone, and advice that forgets that is not advice. */
const MODEL_CAP = 0.25;   // the market still decides the shape of the list

/* Measured against the best player still available, not the best the board
   ever held. overallScore() is a share of BEST_VOR, which is fixed for the
   whole draft, so by the fifth round everyone left scores single figures and
   a multiplier taken straight off it collapses to nothing — a 6% spread
   across the entire candidate list, which reorders exactly nothing. Measured
   that before believing it.

   Against the best still on the board it keeps its range at every stage: the
   best-rated player available always earns the full discount and the ones
   with nothing to say for them pay full price. */
function modelMultipliers(pool) {
  const best = pool.reduce(function (top, p) {
    const ovr = overallScore(p);
    return ovr !== null && ovr > top ? ovr : top;
  }, 0);

  return function (player) {
    if (!best) return 1;                       // nobody has a projection
    const ovr = overallScore(player);
    if (ovr === null) return 1;                // no opinion, leave him at market
    return 1 - Math.min(1, ovr / best) * MODEL_CAP;
  };
}

/* `filter` overrides the chip that happens to be showing. The panel passes
   nothing and gets what the reader asked for; anything picking on your behalf
   passes "ALL", because which position you were last *looking at* is not a
   rule about what you may draft. */
function suggestions(filter) {
  const c = onTheClock();
  const round = c ? c.round : league.rounds;
  const only = filter === undefined ? state.filterSuggest : filter;

  const pool = board.filter(function (p) {
    if (p.drafted) return false;
    if (isRuledOut(p)) return false;
    if (only !== "ALL" && p.pos !== only) return false;
    if (countAt(state.mySlot, p.pos) >= maxAt(p.pos)) return false;
    return true;
  });

  const modelMultiplier = modelMultipliers(pool);

  return pool
    .map(function (p) {
      const risk = isRisky(p) ? 1.35 : 1;
      return { player: p, score: (p.adp + p.jitter)
                 * needMultiplier(state.mySlot, p.pos, round)
                 * risk
                 * modelMultiplier(p) };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map((x) => x.player);
}


/* ---- 9b. Tiers -----------------------------------------

   A tier is a run of players at one position with no
   meaningful gap between them. The break is proportional to
   ADP because gaps are tight at the top of the board and
   wide at the bottom: two picks apart means something at
   pick 5 and nothing at pick 120.                          */

const MAX_TIER_SIZE = 6;

function buildTiers() {
  POSITIONS.forEach(function (pos) {
    const list = board.filter((p) => p.pos === pos);   // already ADP sorted
    let tier = 1, sizeSoFar = 0;

    list.forEach(function (p, i) {
      if (i > 0) {
        const gap = p.adp - list[i - 1].adp;
        const threshold = Math.max(2, list[i - 1].adp * 0.13);
        // Gaps between players stop growing as fast as ADP does, so deep in
        // the board nothing ever clears the threshold and one tier swallows
        // half the position. The size cap is what keeps a tier actionable.
        if (gap >= threshold || sizeSoFar >= MAX_TIER_SIZE) { tier++; sizeSoFar = 0; }
      }
      p.tier = tier;
      sizeSoFar++;
    });
  });
}

// How many players are left in this player's tier at his position.
function tierRemaining(player) {
  return board.filter((p) => p.pos === player.pos && p.tier === player.tier && !p.drafted).length;
}

// How many players already on my roster share this bye week.
function byeShare(player) {
  return rosterOf(state.mySlot).filter((p) => p.bye === player.bye).length;
}

/* Everything on the player sheet describes a player. Nothing on it describes
   a *decision*: every number in the drawer reads identically at pick 1 and at
   pick 140, with an empty roster or four running backs already on it. The one
   question somebody actually opens a sheet to answer mid-draft — should I take
   him, now, with this roster — had no answer anywhere.

   It lives here rather than in the drawer because every part of it is a
   question about the league's shape, and that may not be written down twice:
   the cap is needMultiplier()'s (see atPositionCap — the cap is maxAt() for a
   skill position, the starting requirement for a K or DST, and starters.QB
   plus the superflex for a quarterback, which is precisely the split that
   caused the superflex grading bug), the lineup is bestLineup()'s, and the
   snake is DraftEngine's. React gets the answer, never the rules.

   Returns null before a draft is running: there is no roster to fit against
   and no next pick to wait for, so every field would be a fact about nothing. */
function draftFit(player) {
  if (!state.started || !player) return null;

  const pos = player.pos;
  const mine = rosterOf(state.mySlot);
  const nextOverall = nextPickFor(state.mySlot);

  /* Would he start for me today. This is `aboveReplacement` used as the
     yardstick it actually is — CLAUDE.md's warning is about pricing *depth
     picks* with it in needMultiplier(), where a bench spot is a lottery
     ticket rather than a starting decision. Asking whether a player cracks
     the lineup is the one question replacement level exists to answer, and
     bestLineup() is asked directly rather than re-deriving it. */
  const withHim = bestLineup(mine.concat([player]));
  const startsNow = withHim.some((s) => s.player === player);

  return {
    /* How many comparable players are left, and how long the wait is. The
       two only mean something together: eight left in his tier is patience
       when you pick again in three, and a gamble when you pick again in
       nineteen. */
    tierLeft: tierRemaining(player),
    posLeft: board.filter((p) => p.pos === pos && !p.drafted).length,
    nextOverall: nextOverall,
    picksAway: nextOverall === null ? null : nextOverall - (state.picks.length + 1),

    /* Whether the market expects him to survive that wait. His own ADP
       against the pick I next hold — not a probability, which the data does
       not support, just the two numbers side by side. */
    adp: typeof player.adp === "number" ? player.adp : null,

    have: countAt(state.mySlot, pos),
    atCap: atPositionCap(pos),
    startsNow: startsNow,

    /* A bye clash counts starters I already hold in his week. byeShare()
       answers it and the grade's own bye component is built on the same
       idea, so this is a read of an existing measure rather than a second
       one. */
    byeClash: byeShare(player),
    bye: player.bye || null,

    /* Underrated or overrated *within his own position* — board rank against
       the projection's rank. It cannot compare across positions and is not
       asked to: overallScore() already does that job on the Our Read tab.

       Null for the positions we refuse to rank. Withholding has to be
       complete or it is worse than not withholding: a sheet that prints a
       dash in the Juke score strip and then hands out a market verdict three
       lines below has told the reader to distrust a number and then argued
       from it. K ranks at r 0.37 / -0.09 / 0.57 and DST at 0.32 / 0.06 /
       0.25 — marketGap() rests on projPosRank, which is the very ordering
       those numbers say is noise. */
    unranked: UNRANKED_POSITIONS.indexOf(pos) >= 0,
    market: UNRANKED_POSITIONS.indexOf(pos) >= 0 ? null : marketGap(player),

    /* The round this position becomes a pick the app would actually make.
       Derived by asking needFromCount() itself rather than repeating "last
       round minus one" — those cutoffs are already measured back from
       league.rounds in one place, and a second copy is exactly the league
       shape written down twice. Null for everything but K and DST, which
       are the only positions the app schedules on the manager's behalf. */
    legalFromRound: earliestRoundFor(pos),
    /* Null once the board is full: onTheClock() has no pick to describe and
       returns null, and reading .round off it threw — on the player sheet,
       opened on a finished draft, which is precisely when somebody browses
       what is left. The timing banner reads a null round as "no longer a
       question", which it is. */
    round: onClockRound()
  };
}

/* The first round in which a position is not gated out on timing alone.
   Asked with an empty roster at that position, so a 999 can only be the
   timing rule rather than a roster cap. Returns null when nothing gates it,
   which is every position except the two the app drafts for you. */
function onClockRound() {
  const now = DraftEngine.onTheClock(league, state.picks.length);
  return now ? now.round : null;
}

function earliestRoundFor(pos) {
  if (!FORCED_LATE[pos]) return null;
  for (let r = 1; r <= league.rounds; r++) {
    if (needFromCount(0, pos, r) !== 999) return r;
  }
  return null;
}

/* The next pick this seat holds, as an overall number, or null if the draft
   has none left for them. Walks forward from the current pick rather than
   doing arithmetic on the snake — DraftEngine.onTheClock() already owns turn
   order, and a second derivation of it is the seat-versus-pick-number bug
   waiting to happen. */
function nextPickFor(slot) {
  const total = league.teams * league.rounds;
  for (let overall = state.picks.length + 1; overall <= total; overall++) {
    if (DraftEngine.onTheClock(league, overall - 1).slot === slot) return overall;
  }
  return null;
}


/* ---- 10a. Player stats and draft signals ---------------

   Everything here is computed, not asserted. There is no
   panel of experts behind it: it is projections, depth chart
   position, age and injury status, weighted and shown.     */

/* ---- Scoring ------------------------------------------

   stats.js holds raw components and no points total at all.
   The rules live here, which is what makes them editable:
   change a value and every projection, season and week
   rescores on the next render, with no rebuild.

   STAT_KEYS comes from stats.js and says which short key
   holds which stat. It is generated from the pipeline's own
   field list so the two can never drift apart.            */

// Generic on purpose: six points for a touchdown however it was scored.
// This is the starting point, not the law — the setup screen edits a copy.
const DEFAULT_RULES = {
  pass_yd: 0.04, pass_td: 6, pass_int: -2, pass_2pt: 2,
  // Every rule added since the original 38 defaults to zero, so the board a
  // returning drafter sees is identical until they choose otherwise. What
  // they buy is the ability to describe their league, not a changed one.
  pass_att: 0, pass_cmp: 0, pass_fd: 0,
  rush_yd: 0.1, rush_td: 6, rush_2pt: 2, rush_fd: 0,
  rec: 0.5, rec_yd: 0.1, rec_td: 6, rec_2pt: 2, rec_fd: 0, rec_40p: 0,
  fum_lost: -2, kr_td: 6, pr_td: 6,
  xpm: 1, xpmiss: -1, fgmiss: -1,
  fgm_0_19: 3, fgm_20_29: 3, fgm_30_39: 3,
  fgm_40_49: 4, fgm_50_59: 5, fgm_60p: 6,
  sack: 1, int: 2, fum_rec: 2, safe: 2,
  def_td: 6, def_st_td: 6, blk_kick: 2, def_2pt: 2,
  pts_allow_0: 5, pts_allow_1_6: 4, pts_allow_7_13: 3,
  pts_allow_14_20: 1, pts_allow_21_27: 0,
  pts_allow_28_34: -1, pts_allow_35p: -4
};

// The format dropdown is a preset over one rule. Everything else it leaves
// alone, so a custom table survives switching between standard and PPR.
const REC_BY_FORMAT = { standard: 0, half: 0.5, ppr: 1 };

function rulesForFormat(fmt) {
  const rec = REC_BY_FORMAT[fmt];
  return Object.assign({}, DEFAULT_RULES, { rec: rec === undefined ? 0.5 : rec });
}

// Seeded here rather than in the league object itself, because the defaults
// are defined in this section and a const cannot be read before it exists.
league.rules = rulesForFormat(league.scoring);

// Defaults to the league on screen, but takes a format so a saved draft can
// be described in its own terms.
/* The scoring formats, named once.

   These were written down three times — Title Case in the setup dropdown,
   lower case here, and a third copy inside scoringSummary() — so the same
   league read as "Half PPR" in one place and "half PPR" two inches below it.
   The dropdown is filled from this now and every label goes through it, so
   the three cannot disagree again.

   Title Case throughout, because "Half PPR" is the industry's name for the
   thing rather than a description of it, and because a format name appears
   far more often as a label or a chip than inside a sentence. */
const SCORING_NAMES = { standard: "Standard", half: "Half PPR", ppr: "Full PPR" };

function scoringLabel(scoring) {
  const s = scoring || league.scoring;
  return SCORING_NAMES[s] || String(s || "");
}

// True when a stat line represents a game or season that actually happened.
// Asked of the raw data rather than of a points total, because a real week
// can legitimately score zero and a week that never happened cannot be told
// apart from it any other way.
function didPlay(block) {
  if (!block) return false;
  return Object.keys(block).some((k) => k !== "w" && k !== "gp" && block[k]);
}

/* Scoring, under a rule table handed in rather than read off the league.

   Split out of fantasyPoints() so the landing page can price the same player
   under standard, half and full PPR at once without swapping league.rules and
   swapping it back — which is a global the whole draft reads, and restoring it
   correctly is the kind of thing that works until an exception is thrown
   halfway through. Nothing about the arithmetic moved. */
function pointsUnder(block, rules) {
  if (!block) return 0;
  let total = 0;
  Object.keys(rules).forEach(function (rule) {
    const key = STAT_KEYS[rule];
    const value = key ? block[key] : 0;
    if (value) total += value * rules[rule];
  });
  // A tenth of a point, the precision the raw data arrives in.
  return Math.round(total * 10) / 10;
}

function fantasyPoints(block) {
  return pointsUnder(block, league.rules);
}

// Points per game, formatted, from a games count the caller has to supply.
// It is deliberately impossible to call this without naming the denominator:
// the DST bug was a divisor picked up implicitly from whatever the feed had
// put in gp. No games means no per-game figure, so it prints a dash rather
// than dividing by a fallback of one and echoing the season total back.
function perGame(points, games) {
  return games > 0 ? (points / games).toFixed(1) : "&mdash;";
}

// Season keys, oldest first. Nothing here assumes which years exist.
function seasonKeys(stat) {
  return stat && stat.s ? Object.keys(stat.s).sort() : [];
}

/* ---- what we said, against what happened ------------------

   `pp` holds the preseason forecast for seasons that have since been played,
   beside the actuals in `s`. Every other number on this sheet is a claim about
   the future; this is the only one that can be checked, and it is the thing no
   projection feed shows you about itself.

   Both sides go through fantasyPoints() under the current rules, so this
   rescores with the scoring editor exactly as the rest of the sheet does. A
   historical figure that ignored the editor would be the one number here
   quietly describing a different league.

   **Games played is not decoration.** Measured across all three archived
   seasons, availability is most of the error: players who managed 15+ games
   came in at r 0.873, under 15 at r 0.617. A forecast missed by 210 points
   because somebody tore a hamstring in week four is a different claim from one
   that was wrong about the player, and a table that shows only the miss lets a
   reader draw the wrong conclusion from a true number.

   **And the projection runs light on anyone who stays fit** — 20 points on
   average for the 15+ group. That is not a flaw to correct: a projection is an
   expected value that prices in injury risk, so it must undershoot everyone
   who avoids it. The note under the table says so, because otherwise a column
   of green "+" figures reads as a model that is simply too low. */
function projectionRecord(player) {
  const s = statOf(player);
  if (!s || !s.pp || !s.s) return [];

  return Object.keys(s.pp).sort().reverse().map(function (year) {
    const said = s.pp[year], did = s.s[year];
    // A season he was not in has nothing to grade. Same rule as everywhere
    // else: absent, never zero.
    if (!did || !did.gp) return null;
    const proj = fantasyPoints(said);
    const act = fantasyPoints(did);
    return {
      year: year,
      proj: proj,
      act: act,
      diff: act - proj,
      // A team defense is one aggregate row stamped gp:1, so its game count is
      // not a game count. projGames() exists for exactly this and the answer
      // here is to show nothing rather than "1".
      games: player.pos === "DST" ? null : did.gp
    };
  }).filter(Boolean);
}

function projectionRecordHtml(player) {
  const rows = projectionRecord(player);
  if (!rows.length) return "";

  const body = rows.map(function (r) {
    const up = r.diff >= 0;
    /* Fifteen games is the line the measurement was taken at, and it is why
       the count is here: below it, the miss is mostly about availability. */
    const short = r.games !== null && r.games < 15;
    return `<tr>
      <td>${r.year}</td>
      <td>${Math.round(r.proj)}</td>
      <td>${Math.round(r.act)}</td>
      <td class="${up ? "beat" : "missed"}">${up ? "+" : "&minus;"}${Math.abs(Math.round(r.diff))}</td>
      <td class="${short ? "short" : ""}">${r.games === null ? "&mdash;" : r.games}</td>
    </tr>`;
  }).join("");

  return `<p class="section-label">Our record on ${player.pos === "DST" ? "this defense" : "him"}
      &middot; ${scoringLabel()}</p>
    <div class="tblscroll"><table class="logtbl record">
      <thead><tr><th>Year</th><th>We said</th><th>He got</th><th>Diff</th><th>GP</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <p class="method">What we projected before each season, against what actually happened,
      both scored under your current rules. A projection is an average over everything that
      might happen, so it prices in the chance of injury &mdash; which means a player who
      stays fit routinely beats it. Across these seasons the forecast ran about 20 points
      light on anyone who managed fifteen games or more, and most of the large misses below
      that line are availability rather than a wrong read.</p>`;
}

// The most recent season in which the player actually appeared.
function lastSeason(stat) {
  const keys = seasonKeys(stat).filter((y) => stat.s[y].gp > 0);
  return keys.length ? stat.s[keys[keys.length - 1]] : null;
}

// The two most recent seasons with a real sample, used for the trend signal.
// A player who missed all of last year still gets compared on the two years
// he did play, rather than silently losing the signal.
function trendPair(stat) {
  const played = seasonKeys(stat)
    .filter((y) => stat.s[y].gp >= 6)
    .map((y) => stat.s[y]);
  return played.length >= 2 ? played.slice(-2) : null;
}

function statOf(player) {
  if (typeof PLAYER_STATS === "undefined" || !player.id) return null;
  return PLAYER_STATS[player.id] || null;
}

// How many games a projection covers. Sleeper forecasts a team defense as
// one aggregate row and stamps it gp:1, where every other position carries
// the real projected week count — so dividing by gp made a DST's per-game
// figure identical to its season total. Pittsburgh read 93 and 93.0.
//
// Which number applies is a question about the position, never about the
// value the feed happened to send: a skill player really can be projected
// for one game, and a defense with gp:1 is not playing one game.
let PROJ_WEEKS = 0;

// The horizon is read back off the rows that do carry it rather than written
// down here, because Sleeper has used both 17 and 18 across seasons and a
// number hardcoded now would silently drift from every other row later.
function findProjectionWeeks() {
  const counts = {};
  board.forEach(function (p) {
    const s = statOf(p);
    const gp = p.pos !== "DST" && s && s.p ? s.p.gp : 0;
    if (gp > 1) counts[gp] = (counts[gp] || 0) + 1;
  });
  const common = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  // Nothing usable leaves this at 0, which perGame() renders as a dash.
  PROJ_WEEKS = common ? Number(common) : 0;
}

function projGames(pos, block) {
  if (!block || !block.gp) return 0;
  return pos === "DST" ? PROJ_WEEKS : block.gp;
}

// Projected points under this app's scoring, and each player's rank at
// their position by projection rather than by ADP.
function buildProjections() {
  findProjectionWeeks();

  board.forEach(function (p) {
    const s = statOf(p);
    // Sleeper returns zero-filled rows for players it has no forecast for,
    // and counting those as real projections once dragged replacement level
    // toward zero and made everybody else look elite. Games projected is the
    // marker, asked of the raw data — a scoring change must never be able to
    // turn a missing projection into a real one, or the other way round.
    p.projPts = s && s.p && s.p.gp > 0 ? fantasyPoints(s.p) : null;
  });

  POSITIONS.forEach(function (pos) {
    const ranked = board
      .filter((p) => p.pos === pos && p.projPts !== null)
      .sort((a, b) => b.projPts - a.projPts);

    ranked.forEach(function (p, i) { p.projPosRank = i + 1; });

    const rank = replacementRank(pos);
    const cut = Math.min(rank, ranked.length) - 1;
    REPLACEMENT_PTS[pos] = cut >= 0 && ranked[cut] ? ranked[cut].projPts : 0;
    if (ranked.length < rank && ranked.length) {
      REPLACEMENT_PTS[pos] = ranked[ranked.length - 1].projPts;
    }
  });

  // The best value-over-replacement on the board, which is the denominator
  // every Juke score is measured against. It is computed once here rather
  // than inside draftSignals(), because the player list now asks for a score
  // on every row: recomputing it per call made that O(n^2) over the pool.
  // It has to come after the loop above, since it reads REPLACEMENT_PTS.
  BEST_VOR = Math.max.apply(null, board.map((p) =>
    p.projPts === null ? 0 : p.projPts - (REPLACEMENT_PTS[p.pos] || 0)));

  buildPriorSeason();
}

/* ---- last season, scored the same way ---------------------

   The score is a share of the best value over replacement on the board, and
   nothing on screen said so — so a bare 100 read as a rating of the player
   rather than a ranking against the room. Gibbs is the whole argument for
   this: he is projected for 300 points having actually scored 328, and his
   score goes *up* from 82 to 100, because the projection compresses everyone
   below him. Two numbers side by side teach that in four words. One cannot.

   Measured before it was built. Over the fixed cohort of players with a line
   in 2023, 2024, 2025 and a 2026 projection, the share scoring zero is the
   same in every real season as it is in the projection — 38.5% against 39.9%
   on 16 August 2026 — so the pile of zeros is what this formula does to a
   board a couple of hundred deep in a league that starts about ninety
   players, not something the projection invented. Nothing to correct in the
   maths; the number just needed saying out loud. (The totals move nightly
   with the data; the conclusion has not.)

   This runs at the end of buildProjections() rather than lazily, for the
   reason the note above BEST_VOR gives: the sheet and the table both ask per
   player, and a pass per call is O(n^2) over the pool. It also means a
   scoring change rescores history too, which is the property the rest of the
   app already has and this would look broken without. */
let PRIOR_SEASON = null;
let PRIOR_BEST_VOR = 0;
const PRIOR_REPLACEMENT_PTS = {};

// The most recent completed season anywhere in the data, derived rather than
// written down: the pipeline's STAT_SEASONS moves every year and a literal
// here would silently go stale the first January nobody remembered it.
function latestStatSeason() {
  let latest = null;
  board.forEach(function (p) {
    const s = statOf(p);
    if (!s || !s.s) return;
    Object.keys(s.s).forEach(function (yr) {
      if (latest === null || yr > latest) latest = yr;
    });
  });
  return latest;
}

function buildPriorSeason() {
  PRIOR_SEASON = latestStatSeason();
  POSITIONS.forEach(function (pos) { PRIOR_REPLACEMENT_PTS[pos] = 0; });
  PRIOR_BEST_VOR = 0;

  board.forEach(function (p) {
    const s = statOf(p);
    const line = PRIOR_SEASON && s && s.s ? s.s[PRIOR_SEASON] : null;
    // Same test the projection gets, and for the same reason: a season the
    // player was not in the league is absent, never a zero.
    const played = line && line.gp > 0;
    p.priorPts = played ? fantasyPoints(line) : null;
    p.priorGames = played ? line.gp : null;
  });

  // Replacement level is re-derived from what actually happened, at the same
  // ranks. Reusing the projection's replacement points would measure last
  // season against this season's baseline and call the difference a change in
  // the player — which is exactly the error the whole feature exists to expose.
  POSITIONS.forEach(function (pos) {
    const ranked = board
      .filter((p) => p.pos === pos && p.priorPts !== null)
      .sort((a, b) => b.priorPts - a.priorPts);

    const rank = replacementRank(pos);
    const cut = Math.min(rank, ranked.length) - 1;
    PRIOR_REPLACEMENT_PTS[pos] = cut >= 0 && ranked[cut] ? ranked[cut].priorPts : 0;
    if (ranked.length < rank && ranked.length) {
      PRIOR_REPLACEMENT_PTS[pos] = ranked[ranked.length - 1].priorPts;
    }
  });

  PRIOR_BEST_VOR = Math.max.apply(null, board.map((p) =>
    p.priorPts === null ? 0 : p.priorPts - (PRIOR_REPLACEMENT_PTS[p.pos] || 0)));
}

// Last season's Juke score, on the same scale. Null for anyone who did not
// play it — the eighteen rookies on the board have no line at all, and a zero
// there would be a judgement about a season they were not in.
function priorScore(player) {
  if (!player || player.priorPts === null || player.priorPts === undefined) return null;
  const vor = player.priorPts - (PRIOR_REPLACEMENT_PTS[player.pos] || 0);
  return Math.max(0, Math.min(100, (vor / (PRIOR_BEST_VOR || 1)) * 100));
}

function label(score) {
  return score >= 75 ? "Very High" : score >= 55 ? "High"
       : score >= 35 ? "Medium"    : score >= 18 ? "Low" : "Very Low";
}

// Value over replacement, as a score out of 100. Split out of draftSignals()
// because the player list wants this on every row, where the reasons, the
// upside model and the bust model would all be work thrown away.
/* Positions the projection cannot rank, so we decline to score them.

   Backtested against three seasons of archived forecasts — what Sleeper said
   before the season, against what happened — the projected order for these two
   has no relationship to the finishing order:

       K    r = 0.37, -0.09, 0.57      (2023, 2024, 2025)
       DST  r = 0.32,  0.06, 0.25

   2024's kickers were *negatively* correlated. Every other position lands
   between 0.58 and 0.73.

   There is a mechanical reason underneath and it cannot be repaired from the
   feed. Sleeper forecasts only `fgm_40_49` and `fgm_50_59` — no field goal
   under forty yards at all, which was 253 of the 406 made in 2025. Every
   kicker is therefore projected far too low, and there is no total to subtract
   from to recover the rest, so inventing them would be this pipeline recording
   an opinion instead of a fact. About half the shortfall cancels in value over
   replacement, because a kicker and his replacement move together; none of the
   ranking noise does, and no amount of arithmetic fixes r = -0.09.

   Returning null rather than a number is the same answer this already gives a
   player with no projection, and it flows the same way: the sheet and the
   table print a dash, and modelMultipliers() leaves him exactly where the
   market put him rather than pushing him down for the want of a score.

   The grade is deliberately untouched. It runs on aboveReplacement(), and a
   kicker really did score those points — how a finished roster performed and
   how well a forecast ranks are different questions. */
const UNRANKED_POSITIONS = ["K", "DST"];

function overallScore(player) {
  if (!player || player.projPts === null || player.projPts === undefined) return null;
  if (UNRANKED_POSITIONS.indexOf(player.pos) >= 0) return null;
  const vor = player.projPts - (REPLACEMENT_PTS[player.pos] || 0);
  return Math.max(0, Math.min(100, (vor / (BEST_VOR || 1)) * 100));
}

/* The same figure before the clamp, which is the only one that can tell two
   zeros apart. Roughly three fifths of the board scores exactly 0, so the
   floor is the majority state rather than an edge case, and a receiver one
   point below replacement prints what a receiver sixty points below prints.

   Michael Wilson is the case that made this worth having. He scored 14 on
   last season's actuals — 181.6 points across all seventeen games, +29.4 over
   replacement — and reads 0 for 2026 because his projection falls 45 points
   while projected WR replacement *rises* 22. Most of that swing is the
   projection compressing the field, not a verdict on him, and "0" cannot say
   so. It stays out of overallScore(): modelMultipliers() divides by the best
   score available and a negative there would invert the discount. */
function replacementGap(player) {
  if (!player || player.projPts === null || player.projPts === undefined) return null;
  // Same refusal as overallScore(). This is that figure before the clamp, so
  // a position we will not rank has no gap to report either.
  if (UNRANKED_POSITIONS.indexOf(player.pos) >= 0) return null;
  return player.projPts - (REPLACEMENT_PTS[player.pos] || 0);
}

/* The reasoning behind a score, said in one line. Built from figures already
   sitting on the player after buildProjections() rather than by calling
   draftSignals(), which would run the upside and bust models and allocate
   three arrays of prose for every row on the board.

   This is the thing the app has that a projection feed does not, and until
   now it was only readable by opening a player — which meant opening a
   player to find out whether he was worth opening. */
function overallReason(player) {
  if (player.projPts === null) {
    return "No 2026 projection for this player yet, so there is nothing to score him on.";
  }

  const vor = Math.round(player.projPts - (REPLACEMENT_PTS[player.pos] || 0));
  const parts = [Math.round(player.projPts) + " projected points, " +
                 (vor >= 0 ? "+" : "") + vor + " against a replacement " + player.pos];

  if (player.projPosRank) {
    parts.push("projects " + posLabel(player.pos) + player.projPosRank +
               ", drafted as " + posLabel(player.pos) + player.posRank);
  }
  return parts.join(". ") + ".";
}

// How far the projection disagrees with the market. Four places at a position
// is the same threshold draftSignals() treats as meaningful, kept in one place
// so the row and the sheet cannot tell different stories about a player.
const MARKET_GAP = 4;

function marketGap(player) {
  return player.projPosRank ? player.posRank - player.projPosRank : 0;
}

function draftSignals(player) {
  const s = statOf(player);
  if (!s || player.projPts === null) return null;

  const reasons = { overall: [], upside: [], bust: [] };

  // ---- Juke score: value over a replacement starter, in your scoring ----
  const vor = player.projPts - (REPLACEMENT_PTS[player.pos] || 0);
  const overall = overallScore(player);
  if (overall === null) {
    reasons.overall.push("the projection cannot rank this position, so we do not score it");
  } else {
    reasons.overall.push(Math.round(player.projPts) + " projected points, " +
      (vor >= 0 ? "+" : "") + Math.round(vor) + " vs a replacement " + player.pos);
  }

  // How far the projections disagree with the market, at his position.
  const gap = player.projPosRank ? (player.posRank - player.projPosRank) : 0;

  // ---- Upside ----
  let upside = 20;
  if (gap >= 4)  { upside += Math.min(35, gap * 2.5);
                   reasons.upside.push("projects " + posLabel(player.pos) + player.projPosRank +
                     " but drafted as " + posLabel(player.pos) + player.posRank); }
  if (s.exp !== undefined && s.exp <= 3) { upside += 18; reasons.upside.push(
      s.exp === 0 ? "rookie" : s.exp + " years in the league"); }
  if (s.order === 1) { upside += 14; reasons.upside.push("first on the depth chart"); }
  if (s.age && s.age <= 24) { upside += 10; reasons.upside.push("age " + s.age); }

  const pair = trendPair(s);
  if (pair) {
    const a = fantasyPoints(pair[0]) / pair[0].gp, b = fantasyPoints(pair[1]) / pair[1].gp;
    if (a > 0 && b > a * 1.2) { upside += 15;
      reasons.upside.push("points per game up " + Math.round((b / a - 1) * 100) + "% across his last two full seasons"); }
  }
  upside = Math.max(0, Math.min(100, upside));

  // ---- Bust ----
  let bust = 12;
  if (gap <= -4) { bust += Math.min(35, Math.abs(gap) * 2.5);
                   reasons.bust.push("drafted as " + posLabel(player.pos) + player.posRank +
                     " but projects only " + posLabel(player.pos) + player.projPosRank); }
  if (isRuledOut(player)) { bust += 40; reasons.bust.push("ruled out"); }
  // Through injuryWords() so the meters agree with the prose above them.
  // "Q designation" and "listed questionable" on the same screen read as two
  // different facts about the same player.
  else if (isRisky(player)) { bust += 22; reasons.bust.push("listed " + injuryWords(player.inj)); }
  else if (player.inj) { bust += 12; reasons.bust.push("listed " + injuryWords(player.inj)); }

  if (s.age) {
    if (player.pos === "RB" && s.age >= 28) { bust += 20; reasons.bust.push("age " + s.age + " at running back"); }
    else if ((player.pos === "WR" || player.pos === "TE") && s.age >= 31) { bust += 15; reasons.bust.push("age " + s.age); }
    else if (player.pos === "QB" && s.age >= 36) { bust += 12; reasons.bust.push("age " + s.age); }
  }
  if (s.order && s.order >= 2) { bust += 15; reasons.bust.push("number " + s.order + " on the depth chart"); }
  const recent = lastSeason(s);
  if (recent && recent.gp <= 12) { bust += 14; reasons.bust.push("only " + recent.gp + " games in his last active season"); }

  // A long record of missed time is worth more than one bad year.
  const durable = seasonKeys(s).filter((y) => s.s[y].gp > 0);
  if (durable.length >= 3) {
    const missed = durable.filter((y) => s.s[y].gp <= 13).length;
    if (missed >= durable.length / 2) { bust += 12;
      reasons.bust.push("missed real time in " + missed + " of " + durable.length + " seasons"); }
  }
  bust = Math.max(0, Math.min(100, bust));

  return { overall: overall, upside: upside, bust: bust, reasons: reasons, stats: s };
}


/* ---- 10b. Draft analysis -------------------------------

   Four components, each computed the same way for every
   team, then min-max scaled across the room so a grade is
   always relative to the people you actually drafted with.

   No black box: every number below is printed on the page.  */

const WEIGHTS = { starters: 0.50, value: 0.25, build: 0.15, byes: 0.10 };

// Long enough for a 14-team room. The first ten are unchanged, so a
// ten-team draft grades exactly as it did before.
const GRADE_SCALE = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-",
                     "D+", "D", "D-", "F+", "F"];

// How much better than a replacement-level starter this player is,
// measured in places up the positional board.
function aboveReplacement(player) {
  return Math.max(0, replacementRank(player.pos) - player.posRank);
}

// The best legal starting lineup a roster can field.
/* Who actually starts.

   Sorted by `aboveReplacement`, not by `posRank`, and the difference only
   shows in a slot more than one position can fill — which is to say in the
   slot where it matters. `posRank` is a rank *inside* a position, so using it
   to choose between positions compares numbers drawn on different scales:
   asked to fill a FLEX from TE19, RB25 and WR28 it takes the tight end,
   because 19 is a smaller number than 25.

   Measured on a real roster, that put Juwan Johnson (TE19, and TE
   replacement is 14, so he is *below* a startable tight end and worth 0) in
   the FLEX ahead of David Montgomery (RB25 against an RB replacement of 30,
   so worth 5). Five points of starter strength left on the bench, in the
   component that is half the grade, on a team that came last in its room.

   `aboveReplacement` is the currency the rest of the grade already counts in
   and it knows how deep each position runs, which is the whole reason it
   exists. Inside a single-position slot the two orderings are identical, so
   nothing else moves.

   This is the same mistake the suggestions had, in a different function: a
   within-position measure cannot answer a between-position question. */
function bestLineup(roster) {
  const used = [];
  const slots = lineupSlots();

  return slots.map(function (slot) {
    const eligible = roster.filter(function (p) {
      if (used.indexOf(p) >= 0) return false;
      return fillsSlot(p, slot);
    }).sort(function (a, b) {
      const gap = aboveReplacement(b) - aboveReplacement(a);
      // Ties on the same worth fall back to the board's own order, so the
      // lineup is stable rather than depending on roster order.
      return gap !== 0 ? gap : a.overall - b.overall;
    });

    const pick = eligible[0] || null;
    if (pick) used.push(pick);
    return { slot: slot, player: pick };
  });
}

/* Kickers and defenses are drafted when the app says they may be, not when
   the manager decides. cpuScore() refuses a kicker before the last two rounds
   and a defense before the last three, and the suggestions never offer them
   earlier — so their draft slot is the rule's, not yours.

   Judging them on ADP then punishes obeying that rule. Their ADP comes from
   drafts that run more rounds than most leagues set up here, so a kicker's
   board rank routinely lands past the last pick that exists: in a measured
   ten-team, fourteen-round draft every one of the ten kickers scored as a
   reach, averaging 35 picks early, and not a single one came out neutral.
   The "biggest reach" callout was therefore a lottery among kickers rather
   than anything about drafting.

   So the two of them sit out of draft value and out of both callouts. It is
   not a thumb on the scale: recomputed across a full room, dropping them
   moved no team more than two places, because every team drafts the same
   forced pair. It removes a constant that was drowning the signal. */
const FORCED_LATE = { K: true, DST: true };
function freelyChosen(p) { return !FORCED_LATE[p.player.pos]; }

/* The label under the bye bar. It used to name the worst week and stop,
   which was the same blind spot the score had: a lineup with two bad weeks
   read as though it had one. Two are named, and beyond that it says how many
   more there are rather than running a list along the bar. */
function byeSummary(badWeeks) {
  if (!badWeeks || !badWeeks.length) return "no bad weeks";

  const first = `${badWeeks[0].off} starters off in week ${badWeeks[0].week}`;
  if (badWeeks.length === 1) return first;
  if (badWeeks.length === 2) return `${first}, ${badWeeks[1].off} in week ${badWeeks[1].week}`;
  return `${first}, and ${badWeeks.length - 1} more bad weeks`;
}

function analyseTeam(slot) {
  const roster = rosterOf(slot);
  const picks  = state.picks.filter((p) => p.slot === slot);
  const judged = picks.filter(freelyChosen);
  const lineup = bestLineup(roster);

  // 1. starter strength
  let starters = 0;
  lineup.forEach(function (s) { if (s.player) starters += aboveReplacement(s.player); });

  /* 2. draft value: taken later than the board said = a bargain.

     The subtraction is pick number minus board rank, and it has to be that
     way round. `p.overall` is where the pick happened, `p.player.overall` is
     where the board had him, so a player still there at 121 whom the board
     ranked 106 gives +15: he fell fifteen picks and that is the bargain the
     comment describes. Reversed, as this was, every bargain scored negative
     and every reach scored positive — a quarter of the grade rewarding
     exactly what it was written to punish. */
  let value = 0;
  judged.forEach(function (p) { value += (p.overall - p.player.overall); });

  /* 3. roster construction.

     Three ways a roster can be badly built: a starting slot you cannot fill,
     a spot spent on somebody you can never start, and no cover behind the
     positions you start most of.

     The third one used to be a threshold — "fewer than starters + FLEX + 1"
     — and it never once fired, because it sits exactly where the CPU's own
     depth allowance lands every team. Measured across a full room: all ten
     teams held four running backs, one quarterback, one kicker, one defense,
     and every one of them scored a flat 100. Fifteen per cent of the grade
     was a constant, which is the same as not being in the grade at all.

     So cover is graded rather than a cliff, and it asks the question a
     manager actually has: if a starter goes down, how far from startable is
     the next man up? That is the best benched player at the position,
     measured in places past replacement — nought if he could start today,
     the full penalty if there is nobody there at all. Across the same room
     it separated ten teams into nine distinct scores. */
  const COVER_NONE = 15;   // places past replacement at which cover is no cover
  const COVER_COST = 12;   // most that one uncovered position can cost

  let build = 100;
  lineup.forEach(function (s) { if (!s.player) build -= 14; });          // hole in the lineup
  ["QB", "K", "DST"].forEach(function (pos) {
    /* A second kicker is wasted; a second quarterback is only wasted in a
       league that starts one. That was always the intent and the sum did not
       carry it: `league.starters.QB` is 1 in a superflex league too, since
       the extra seat is a SFLEX rather than a second QB slot. So every team
       in a superflex room was docked nine for the quarterback the format
       obliges them to hold — and worse than a flat charge, dropping him
       *improved* the score. Tested on a built roster: taking the second
       quarterback out and putting a spare receiver there cost five points of
       starter strength and gained seven of construction.

       `cpuScore()` has had the right expression all along, which is why the
       CPU drafts two and then got marked down for it. */
    const allowed = league.starters[pos] + (pos === "QB" ? league.superflex : 0);
    build -= Math.max(0, countAt(slot, pos) - allowed) * 9;
  });

  const benched = roster.filter(function (p) {
    return !lineup.some(function (s) { return s.player === p; });
  });
  ["RB", "WR"].forEach(function (pos) {
    if (!league.starters[pos]) return;      // a league that starts none needs none
    const best = benched
      .filter(function (p) { return p.pos === pos; })
      .sort(function (a, b) { return a.posRank - b.posRank; })[0];
    // Nobody behind them is the same as cover that could never play.
    const past = best ? best.posRank - replacementRank(pos) : COVER_NONE;
    build -= COVER_COST * Math.min(1, Math.max(0, past) / COVER_NONE);
  });
  /* Floored, because it is printed as "x / 100" and a negative score out of
     a hundred reads as a broken number rather than a bad roster. Three rounds
     in, with six lineup slots still empty, it was showing "-8 / 100".

     Nothing is lost by it. Measured across a draft at every twenty picks, the
     only negatives are in the opening rounds, and there the score separates
     teams by whether their third pick has come round yet — snake position,
     not construction. From round four on it never goes near zero, and
     clamping changes the number of distinct scores in the room at no stage of
     the draft. A team that ends with seven starting slots unfilled floors at
     zero, which is the right end of the scale for it anyway. */
  build = Math.max(0, Math.round(build));

  /* 4. bye week exposure, judged on the starting lineup only, because a
     bench player on a bye costs nothing.

     Every bad week counts, not just the worst one. It used to read the worst
     week and stop, so a lineup with three starters out in week 6 *and* three
     more out in week 8 scored exactly the same as one with a single bad week
     — the second was invisible. Measured across a room that left the whole
     component with three distinct values among ten teams.

     Squared, because the weeks are not interchangeable. Four starters out at
     once is a week you probably lose; three out twice is two weeks you can
     patch from the bench. So a week costs the square of how many are missing
     beyond the second, and a fourth man out costs four times what a third
     does rather than twice. */
  const byes = {};
  lineup.forEach(function (s) { if (s.player) byes[s.player.bye] = (byes[s.player.bye] || 0) + 1; });

  const badWeeks = Object.keys(byes)
    .map(function (week) { return { week: Number(week), off: byes[week] }; })
    .filter(function (w) { return w.off > 2; })
    .sort(function (a, b) { return b.off - a.off || a.week - b.week; });

  let byeCost = 0;
  badWeeks.forEach(function (w) { byeCost += Math.pow(w.off - 2, 2); });

  // Kept for the label, which names the week somebody actually has to survive.
  const worstBye  = badWeeks.length ? badWeeks[0].off  : 0;
  const worstWeek = badWeeks.length ? badWeeks[0].week : null;

  /* Biggest bargain and biggest reach, on the same signed gap as above:
     positive means he was still there long after the board said he would be
     gone, negative means you went and got him early. The two callouts that
     print these already say "picks late" for a positive gap and "picks
     early" for a negative one, so they have been describing this convention
     correctly the whole time the arithmetic was inverted underneath them. */
  let bargain = null, reach = null;
  judged.forEach(function (p) {
    const gap = p.overall - p.player.overall;
    if (!bargain || gap > bargain.gap) bargain = { pick: p, gap: gap };
    if (!reach   || gap < reach.gap)   reach   = { pick: p, gap: gap };
  });
  /* A reach is a pick you went and got early. If the worst gap on the board
     is zero or better then nothing was reached for, and naming the least
     positive pick "biggest reach" reads as an accusation about a pick that
     landed exactly where the board wanted it. Mid-draft, with three or four
     picks all near their rank, that was the usual outcome. */
  if (reach && reach.gap >= 0) reach = null;

  return { slot: slot, roster: roster, lineup: lineup, byes: byes,
           starters: starters, value: value, build: build,
           byePenalty: -byeCost * 20,
           worstBye: worstBye, worstWeek: worstWeek, badWeeks: badWeeks,
           bargain: bargain, reach: reach };
}

// Scale a raw component onto 0-100 relative to the rest of the room.
function scaleAcross(all, key) {
  const values = all.map((t) => t[key]);
  const low = Math.min.apply(null, values);
  const high = Math.max.apply(null, values);
  const span = high - low;
  all.forEach(function (t) {
    t[key + "Scaled"] = span === 0 ? 50 : ((t[key] - low) / span) * 100;
  });
}

function analyseDraft() {
  const all = [];
  for (let i = 0; i < league.teams; i++) all.push(analyseTeam(i));

  ["starters", "value", "build", "byePenalty"].forEach((k) => scaleAcross(all, k));

  all.forEach(function (t) {
    t.total = t.startersScaled  * WEIGHTS.starters
            + t.valueScaled     * WEIGHTS.value
            + t.buildScaled     * WEIGHTS.build
            + t.byePenaltyScaled * WEIGHTS.byes;
  });

  all.slice().sort((a, b) => b.total - a.total).forEach(function (t, i) {
    t.rank = i + 1;
    /* Clamped, because the scale is fourteen long and TEAM_COUNTS goes to
       twenty-four. A sixteen-team room put the word "undefined" in the
       standings against fifteenth and sixteenth, on screen, for anyone who
       set one up. Everything at fourteen teams or fewer is unchanged; past
       that the bottom of the room shares an F, which is honest — they are
       all last in a room bigger than the scale was drawn for. */
    t.grade = GRADE_SCALE[Math.min(i, GRADE_SCALE.length - 1)];
  });

  return all;
}


/* ---- 11. Rendering ------------------------------------- */

function lastName(name) {
  const parts = name.split(" ").filter(function (w) {
    return ["Jr.", "Sr.", "II", "III", "IV", "Defense"].indexOf(w) < 0;
  });
  return parts[parts.length - 1];
}

/* "J. Cook" — the form a draft board uses, because a surname alone stops
   being an answer the moment two of them share it.

   A defense keeps its club. `lastName()` already drops the word "Defense", so
   initialising what is left produces "L. Chargers", which is nobody: the first
   word of a team name is not a first name. This is the same rule as deciding a
   player's type from `player.pos` rather than from the shape of their data. */
function shortName(player) {
  if (player.pos === "DST") return lastName(player.name);
  const parts = player.name.trim().split(/\s+/);
  if (parts.length < 2) return player.name;
  return parts[0][0] + ". " + lastName(player.name);
}

function initials(name) {
  const parts = name.replace(/[^A-Za-z .'-]/g, "").split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function photoUrl(player) {
  if (!player.id) return "";
  return player.pos === "DST"
    ? "https://sleepercdn.com/images/team_logos/nfl/" + player.team.toLowerCase() + ".png"
    : "https://sleepercdn.com/content/nfl/players/thumb/" + player.id + ".jpg";
}

/* ---- team colour ------------------------------------------

   One mark per club, used only where nothing is written on top of it: the
   ring around the headshot and the band under the sheet header. That
   restriction is the whole design, and it came out of measuring the
   alternative rather than from taste.

   **A team-coloured header does not survive thirty-two real teams.** Darkened
   far enough to carry white text — lightness only, hue and saturation held,
   the same repair the position solids had — ten pairs land below the
   just-noticeable difference and twenty-seven of the 496 pairs sit within 6
   CIE76. Carolina, Detroit, the Chargers and Houston all become the same dark
   teal; Dallas and Indianapolis become one navy. You pay the entire contrast
   bill and lose the identity you were buying, which is the opposite of what
   this is for. Pittsburgh's gold is 1.76:1 against white and New Orleans' is
   1.85:1, so there is no version of that header that simply works.

   Kept at full brand value against the navy header instead, seven vanish into
   it — CHI, DAL, HOU, JAX, NE, SEA and TEN, every one of them a club whose
   primary is a navy or a near-black. Those seven take the mark the club is
   actually known by, which is a substitution their own kit makes: Chicago's
   orange, Seattle's green, Jacksonville's gold. Raiders silver for the same
   reason — black is legal on navy and reads as nothing.

   Measured at those values, every accent clears 12 CIE76 against all three
   navy stops and against the card in both themes, worst case 13.6. Three
   pairs are still effectively one colour and always will be: CIN and DEN
   share a hex, ATL and HOU both use #A71930, CAR and LAC are 2.3 apart at
   brand. The club is named in text beside the mark, so a shared colour costs
   nothing a reader can be misled by.

   Not a token in `:root`, because these are somebody else's colours rather
   than ours and there are thirty-two of them. It reaches the stylesheet as
   `--team` on the header, the same way `--mark-ink` reaches a `<use>`. */
const TEAM_ACCENT = {
  ARI: "#97233F", ATL: "#A71930", BAL: "#241773", BUF: "#00338D",
  CAR: "#0085CA", CHI: "#C83803", CIN: "#FB4F14", CLE: "#311D00",
  DAL: "#869397", DEN: "#FB4F14", DET: "#0076B6", GB:  "#203731",
  HOU: "#A71930", IND: "#002C5F", JAX: "#D7A22A", KC:  "#E31837",
  LAC: "#0080C6", LAR: "#003594", LV:  "#A5ACAF", MIA: "#008E97",
  MIN: "#4F2683", NE:  "#C60C30", NO:  "#D3BC8D", NYG: "#0B2265",
  NYJ: "#125740", PHI: "#004C54", PIT: "#FFB612", SEA: "#69BE28",
  SF:  "#AA0000", TB:  "#D50A0A", TEN: "#4B92DB", WAS: "#5A1414"
};

// A free agent has no club and no colour. The stylesheet falls back to
// --navy-lift rather than to nothing, so the ring and the band are always
// drawn and only their colour changes.
function teamAccent(player) {
  return (player && TEAM_ACCENT[player.team]) || "";
}

function avatar(player, small) {
  const url = photoUrl(player);
  const photo = url
    ? `<img src="${url}" alt="" loading="lazy" data-drop-on-error
         class="${player.pos === "DST" ? "logo" : ""}">`
    : "";
  return `<div class="avatar ${player.pos}${small ? " sm" : ""}">${initials(player.name)}${photo}</div>`;
}

// Renders the little O / Q / PUP chip, or nothing at all.
function injBadge(player) {
  return player.inj ? `<span class="inj ${player.inj}">${player.inj}</span>` : "";
}

function isRuledOut(player) { return RULED_OUT.indexOf(player.inj) >= 0; }
function isRisky(player)    { return RISKY.indexOf(player.inj) >= 0; }

// ADP feeds lag injury news by days. A player still going inside the
// top 150 who has already been ruled out is worth shouting about.
function adpConflict(player) { return isRuledOut(player) && player.adp <= 150; }

/* Everything renderHeader() needs to decide, as data rather than as DOM
   writes — so the React header (web/src/components/AppHeader.jsx) reads the
   exact same branching this one paints from, rather than a second copy of
   it. Every helper called here already existed for renderHeader() alone;
   none of this is new business logic. */
function headerInfo() {
  if (!state.started) return { started: false };

  /* What this draft is, beside what it is doing. The shape was only ever on
     the setup screen, which folds away the moment a draft starts, so four
     rounds in there was no way to check whether this was a 14-round league
     without leaving it. Through leagueSummary(), never a second copy of the
     same lookup — it is the string the setup box already shows shut. */
  const leagueSum = leagueSummary();

  if (draftOver()) {
    return {
      started: true, over: true, myTurn: false, urgent: false,
      leagueSummary: leagueSum,
      statusLine: "Draft complete",
      pickText: totalPicks() + " picks made",
      rightLabel: "Rounds", rightValue: String(league.rounds)
    };
  }

  const overall = currentOverall();

  if (isMyTurn()) {
    const urgent = !!state.clockLength && !state.paused && state.timeLeft <= 10;
    return {
      started: true, over: false, myTurn: true, urgent,
      leagueSummary: leagueSum,
      statusLine: "You're on the clock!",
      pickText: "Pick " + pickCode(overall) + " (" + overall + " Overall)",
      rightLabel: state.clockLength ? (state.paused ? "Paused" : "Time left") : "Available",
      rightValue: state.clockLength ? clockText() : String(board.filter((p) => !p.drafted).length)
    };
  }

  /* Somebody else is up. Solo that is a CPU with no countdown of its own, so
     the useful number is how long until you are back; in a room there is a
     real clock running on a real person and it belongs on screen for
     everybody, not only for whoever it is running against.

     "Your turn in" moves onto the status line rather than being dropped —
     it is the other thing worth knowing while you wait, and the right-hand
     block only has room for one. */
  const gap = picksUntilMyTurn();
  const showClock = hasRoom() && clockShowing();

  return {
    started: true, over: false, myTurn: false, urgent: false,
    leagueSummary: leagueSum,
    statusLine: teamLabel(pickInfo(overall).slot) + (showClock && gap ? " · you are in " + gap : ""),
    pickText: "Pick " + pickCode(overall) + " (" + overall + " Overall)",
    rightLabel: showClock ? (state.paused ? "Paused" : "Time left") : "Your turn in",
    rightValue: showClock ? clockText() : String(gap)
  };
}

function renderHeader() {
  const info = headerInfo();
  appbar.className = "appbar";

  // The pick line and the counter both describe a draft in progress, so
  // before one starts the header is just the name and the theme toggle.
  // The player count lives under the setup card, on the freshness line,
  // which is where the rest of the data's provenance already is.
  pickLabel.hidden  = !info.started;
  countBlock.hidden = !info.started;

  if (!info.started) {
    statusLine.textContent = "The Draft Room";
    soundCue();                      // resets what has been said
    window.dispatchEvent(new Event("juke:header"));
    return;
  }

  leagueLabel.textContent = info.leagueSummary;
  statusLine.textContent  = info.statusLine;
  pickText.textContent    = info.pickText;
  rightLabel.textContent  = info.rightLabel;
  rightValue.textContent  = info.rightValue;
  appbar.classList.add(info.myTurn ? (info.urgent ? "urgent" : "my-turn") : "live");

  /* Last, and out of every branch above rather than at the top: the cues are
     about the state this render has just settled on, and a draft that has
     ended is not a turn that has started. */
  soundCue();
  window.dispatchEvent(new Event("juke:header"));
}

// "Last one in the tier" is the most actionable thing a draft board can
// tell you: it turns "take the best player" into "take him now or lose
// the whole tier".
function tierChip(player) {
  const left = tierRemaining(player);
  if (left === 1) return `<span class="chip last">Last in ${player.pos} tier ${player.tier}</span>`;
  if (left === 2) return `<span class="chip thin">2 left in ${player.pos} tier ${player.tier}</span>`;
  return `<span class="chip tier">${left} left in tier ${player.tier}</span>`;
}

function byeChip(player) {
  const shared = byeShare(player);
  if (shared < 2) return "";
  return `<span class="chip bye">Would be your ${shared + 1}${shared + 1 === 3 ? "rd" : "th"} on bye ${player.bye}</span>`;
}

function renderSuggestions() {
  const list = suggestions();
  const holder = $("suggestList");

  if (draftOver()) {
    holder.innerHTML = `<div class="empty"><p class="empty-title">Draft complete</p>
      <p class="empty-sub">Check My Team to see how the roster came out, or Analysis
        for your grade. This board stays saved, so you can reopen it later.</p>
      <button class="primary" data-action="new-draft">New mock draft</button></div>`;
    return;
  }

  const nextPick = currentOverall();

  holder.innerHTML = list.map(function (p, i) {
    const value = p.overall - nextPick;
    const valueText = value > 3
      ? `<span class="value-up">falling &mdash; ${value} picks past value</span>`
      : `<span class="value-down">on the board at ${p.overall}</span>`;

    return `
      <div class="sug ${i === 0 ? "top" : ""}">
        ${avatar(p)}
        <div class="sug-body">
          <div class="sug-name name-link" data-player="${p.name}">${p.name}</div>
          <div class="sug-meta">
            <span class="badge ${p.pos}">${posLabel(p.pos)}</span> ${p.team} &middot; Bye ${p.bye} ${injBadge(p)}
          </div>
          <div class="sug-stats">Overall ${p.overall} (${posLabel(p.pos)}${p.posRank}) &middot; ADP ${p.adp.toFixed(1)} &middot; ${valueText}</div>
          <div class="sug-meta" style="margin-top:5px">
            ${tierChip(p)}
            ${byeChip(p)}
          </div>
        </div>
        <button class="draft-btn" data-draft="${p.name}" ${isMyTurn() ? "" : "disabled"}>Draft</button>
      </div>`;
  }).join("");
}

/* Is this app finished offering me this position?

   Asked of the CPU's own valuation rather than answered a second time here.
   needMultiplier() returns 999 at the roster cap, and the cap is not one rule:
   it is maxAt() for the skill positions, but the starting requirement for a
   kicker or a defense, and starters + superflex for a quarterback. Writing
   that down again is exactly how the superflex bug happened — one rule in two
   places, left to drift.

   The last round is passed in so the K and DST *timing* gates do not fire.
   This is a question about the roster, not about when a kicker becomes legal. */
function atPositionCap(pos) {
  return needMultiplier(state.mySlot, pos, league.rounds) === 999;
}

/* The position filter doubles as the roster-need display: the control you
   already reach for to narrow the list is also the one that tells you what
   you are still missing. It saves a trip to My Team on every pick.

   Both numbers are derived, never written down — the need comes from
   league.starters and the total from rosterSize(), so an unusual lineup
   reports itself correctly with no extra code.

   It only carries counts once a draft is running. Before that there is no
   roster to be short of, and showing pool sizes here would give one control
   two different meanings.

   ---- and a fraction is a promise about the denominator ----

   This printed `have/starters` in every state, in green once the starting slot
   was filled. At tight end that is a green "1/1" the moment you take one — a
   success colour on a fraction that reads as a ceiling, when the app will
   happily let you hold three and a backup tight end is a perfectly ordinary
   pick. It was reported from a real draft as the app refusing a second one,
   and the app had refused nothing: the Draft button was never disabled once,
   and there were nineteen tight ends on the board at the time.

   So the denominator is only shown while it is still owed. A requirement you
   have met is discharged, and continuing to print it as a fraction invents a
   limit that does not exist. What replaces it is the honest limit — the count
   alone until atPositionCap() says the app really has stopped offering them.

   The stylesheet already said this, one line above the rule that did the
   opposite: "a filled slot is the normal case and does not need to shout
   about itself." */
function renderPlayerFilter() {
  const filled = rosterOf(state.mySlot).length;

  $("playerFilter").querySelectorAll("button").forEach(function (button) {
    const pos = button.dataset.pos;
    const label = pos === "ALL" ? "All" : posLabel(pos);

    if (!state.started) {
      button.innerHTML = label;
      button.classList.remove("short", "met", "full");
      button.removeAttribute("title");
      return;
    }

    const all = pos === "ALL";
    const have = all ? filled : countAt(state.mySlot, pos);
    const need = all ? rosterSize() : (league.starters[pos] || 0);
    const short = have < need;

    /* "All" keeps its fraction throughout, because there the denominator is a
       real ceiling: rosterSize() is how many players you may end up with, and
       running out of spots is a thing that actually happens to you. */
    const full = all ? have >= need : atPositionCap(pos);
    const count = short || all ? `${have}/${need}` : String(have);

    button.innerHTML = `${label}<span class="need">${count}</span>`;

    /* "All" counts roster spots, not starting slots, so it needs its own
       wording — the shared sentence read "13 more ALL to fill your starting
       lineup", which is wrong about the number and about the noun. */
    const left = need - have;
    if (all) {
      button.title = short
        ? `${left} roster ${left === 1 ? "spot" : "spots"} still to fill`
        : "Your roster is full";
    } else if (short) {
      button.title = `${left} more ${posLabel(pos)} to fill your starting lineup`;
    } else if (full) {
      button.title = `You are holding as many ${posLabel(pos)} as this draft will suggest`;
    } else {
      button.removeAttribute("title");
    }

    /* Short of a starting slot is the actionable state. "Full" is the only
       other one worth marking, and it is the one that used to be a lie. */
    button.classList.toggle("short", short);
    button.classList.toggle("met", !short && !full);
    button.classList.toggle("full", full && !short);
  });
}

function renderQueue() {
  const holder = $("queueList");

  // The rail heading carries the count, now that the queue lives there and
  // no longer has a tab of its own to put it on.
  $("railQueueHead").textContent =
    state.queue.length ? `Your queue · ${state.queue.length}` : "Your queue";

  if (!state.queue.length) {
    holder.innerHTML = `<div class="empty">
      <p class="empty-title">Nothing queued</p>
      <p class="empty-sub">Star a player to line him up. This is your order, not the
        model's &mdash; and if the clock runs out while you are away, the top of it is
        what gets drafted for you.</p></div>`;
    return;
  }

  holder.innerHTML = state.queue.map(function (name, i) {
    const p = board.find((x) => x.name === name);
    if (!p) return "";
    const score = overallScore(p);
    return `
      <div class="qrow${i === 0 ? " next" : ""}">
        <span class="qn">${i + 1}</span>
        ${avatar(p, true)}
        <div class="qbody">
          <div class="qname name-link" data-player="${p.name}">${p.name}</div>
          <div class="qmeta">
            <span class="badge ${p.pos}">${posLabel(p.pos)}</span> ${p.team} &middot; ADP ${p.adp.toFixed(1)}
            &middot; Juke ${score === null ? "&mdash;" : Math.round(score)} ${injBadge(p)}
          </div>
        </div>
        <div class="qmoves">
          <button class="qmove" data-qup="${p.name}" ${i === 0 ? "disabled" : ""}
                  aria-label="Move ${p.name} up">&uarr;</button>
          <button class="qmove" data-qdown="${p.name}" ${i === state.queue.length - 1 ? "disabled" : ""}
                  aria-label="Move ${p.name} down">&darr;</button>
        </div>
        <button class="draft-btn" data-draft="${p.name}" ${isMyTurn() ? "" : "disabled"}>Draft</button>
      </div>`;
  }).join("");
}

/* ---- the player table ------------------------------------

   The columns, written down once. The header, the group bands above it, the
   cells and the sort all read this list, so adding a column is one entry
   rather than four edits that can disagree.

   `get` returns a number or null, and null always means "we do not have
   this", never zero. That distinction is the whole reason the sort below
   pushes blanks to the bottom in both directions: a quarterback with no
   rushing projection is not the worst rusher on the board, he is absent from
   the question.

   Targets are deliberately not here. Sleeper shows a TAR column and their
   own projections do not fill it — it reads 0 for every player, Bijan and
   Ja'Marr included. Receptions are projected, are the thing PPR actually
   scores, and are a number rather than a zero. */
function projOf(p) {
  const s = statOf(p);
  return (s && s.p && s.p.gp > 0) ? s.p : null;
}

function projStat(p, key) {
  const pr = projOf(p);
  const v = pr ? pr[key] : undefined;
  return (v === undefined || v === null) ? null : v;
}

const PLAYER_COLS = [
  /* The two that stay put while the stats scroll under them. Pinning the
     name without the rank would leave the rank sliding out from behind it,
     so both are sticky and the rank has a fixed width to sit the name
     against. */
  { key: "rk",   label: "RK",  title: "Rank by ADP", stick: "rk",
    get: (p) => p.overall },
  { key: "name", label: "Player", text: true, stick: "name",
    get: (p) => p.name },
  { key: "adp",  label: "ADP", title: "Average draft position",
    get: (p) => p.adp,   fmt: (v) => v.toFixed(1) },
  { key: "bye",  label: "BYE", get: (p) => p.bye },
  { key: "ovr",  label: "JUKE", title: "The Juke score: projected points above the last startable player at this position, as a share of the best such figure on the board",
    get: (p) => overallScore(p), fmt: (v) => Math.round(v), ours: true },

  { group: "Proj", key: "pts", label: "PTS", title: "Projected points under your scoring",
    get: (p) => p.projPts, fmt: (v) => Math.round(v) },
  { group: "Proj", key: "avg", label: "AVG", title: "Projected points per game",
    /* Through the same denominator the sheet uses. A team defense is
       forecast as one aggregate row stamped gp:1, so dividing by the raw
       figure would print a per-game number equal to the season total. */
    get: function (p) {
      const g = projGames(p.pos, projOf(p));
      return (p.projPts === null || !g) ? null : p.projPts / g;
    },
    fmt: (v) => v.toFixed(1) },

  { group: "Rushing",   key: "ra", label: "ATT", get: (p) => projStat(p, "ra") },
  { group: "Rushing",   key: "ry", label: "YDS", get: (p) => projStat(p, "ry") },
  { group: "Rushing",   key: "rt", label: "TD",  get: (p) => projStat(p, "rt") },

  { group: "Receiving", key: "rc", label: "REC", get: (p) => projStat(p, "rc") },
  { group: "Receiving", key: "cy", label: "YDS", get: (p) => projStat(p, "cy") },
  { group: "Receiving", key: "ct", label: "TD",  get: (p) => projStat(p, "ct") },

  { group: "Passing",   key: "pa", label: "ATT", get: (p) => projStat(p, "pa") },
  { group: "Passing",   key: "py", label: "YDS", get: (p) => projStat(p, "py") },
  { group: "Passing",   key: "pt", label: "TD",  get: (p) => projStat(p, "pt") }
];

function colByKey(key) {
  return PLAYER_COLS.filter(function (c) { return c.key === key; })[0];
}

/* Two rows: the bands, then the columns. Both generated from PLAYER_COLS, so
   a colspan can never fall out of step with the columns underneath it. */
function renderPlayerHead() {
  const head = $("playerHead");
  if (!head) return;

  // One cell per column and one for the actions, and not a single one more:
  // a band row a column too wide shifts every heading off its numbers.
  let bands = "";
  let i = 0;
  while (i < PLAYER_COLS.length) {
    const c = PLAYER_COLS[i];
    if (!c.group) {
      bands += `<th class="${c.stick ? "stick " + c.stick : ""}"></th>`;
      i++;
      continue;
    }
    let span = 0;
    while (i + span < PLAYER_COLS.length && PLAYER_COLS[i + span].group === c.group) span++;
    bands += `<th class="band" colspan="${span}">${c.group}</th>`;
    i += span;
  }
  bands += `<th></th>`;

  const cols = PLAYER_COLS.map(function (c) {
    const on = state.sort.key === c.key;
    const arrow = on ? (state.sort.dir === 1 ? " ▲" : " ▼") : "";
    const cls = (c.stick ? "stick " + c.stick : "num") +
                " sortable" + (on ? " sorted" : "") + (c.ours ? " ours" : "");
    return `<th class="${cls}"
        data-sort="${c.key}" tabindex="0" role="button"
        aria-sort="${on ? (state.sort.dir === 1 ? "ascending" : "descending") : "none"}"
        ${c.title ? `title="${escHtml(c.title)}"` : ""}>${c.label}${arrow}</th>`;
  }).join("");

  head.innerHTML = `<tr class="bandrow">${bands}</tr><tr>${cols}<th></th></tr>`;
}

/* Sorted on a copy, always.

   board is not just a list to draw — DraftEngine.jitter() reads a player's
   position in it to work out the CPU wobble, and every client in a room has
   to reach the same answer. Sorting it in place to draw a table would change
   what the CPUs do, and change it differently for whoever happened to click
   a column header. */
function sortedPlayers(list) {
  const col = colByKey(state.sort.key) || colByKey("adp");
  const dir = state.sort.dir;

  return list.slice().sort(function (a, b) {
    const av = col.get(a), bv = col.get(b);

    // Missing is missing in both directions. A player with no projection
    // does not belong at the top of "fewest rushing yards".
    const an = av === null || av === undefined;
    const bn = bv === null || bv === undefined;
    if (an && bn) return a.adp - b.adp;
    if (an) return 1;
    if (bn) return -1;

    if (col.text) return String(av).localeCompare(String(bv)) * dir;
    if (av !== bv) return (av - bv) * dir;

    // A stable tiebreak, so equal numbers do not reshuffle between renders.
    return a.adp - b.adp;
  });
}

function renderPlayers() {
  const tbody = document.querySelector("#playerTable tbody");
  const hide  = $("hideDrafted").checked;

  renderPlayerFilter();
  renderPlayerHead();

  const term = state.search.trim().toLowerCase();

  const visible = sortedPlayers(board.filter(function (p) {
    if (state.filterPlayers !== "ALL" && p.pos !== state.filterPlayers) return false;
    if (hide && p.drafted) return false;
    if (term && p.name.toLowerCase().indexOf(term) < 0
             && p.team.toLowerCase().indexOf(term) < 0) return false;
    return true;
  }));

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="${PLAYER_COLS.length + 1}"
      style="text-align:center;color:var(--ink-light);padding:26px">
      No players match that search.</td></tr>`;
    return;
  }

  tbody.innerHTML = visible.map(function (p) {
    // The Juke score was only ever visible inside the player sheet, which meant
    // opening a player to find out whether he was worth opening. It is the
    // one number this app has that the ADP feed does not, so it belongs on
    // the row. A dash where there is no projection, never a zero.
    const score = overallScore(p);
    const scoreCell = score === null ? "&mdash;" : Math.round(score);

    // Where the model and the market disagree enough to be worth saying out
    // loud. Off the board entirely in a room — see marketChip().
    const gapChip = hasRoom() ? "" : marketChip(p);

    const cells = PLAYER_COLS.map(function (c) {
      if (c.text) {
        // Team and positional rank are one idea and wrap as one. As a bare
        // text node they were an anonymous box no selector could reach, so
        // the stylesheet's "never break inside a piece" rule silently missed
        // them and "ATL · WR5" folded into three stacked lines on a phone.
        return `<td class="stick name">
            <span class="nm name-link" data-player="${p.name}">${p.name}</span>
            <span class="meta"><span class="badge ${p.pos}">${posLabel(p.pos)}</span> <span class="ident">${p.team} &middot; ${posLabel(p.pos)}${p.posRank}</span>
              ${injBadge(p)} <span class="chip tier">T${p.tier}</span>${gapChip}</span>
          </td>`;
      }

      const v = c.get(p);
      // A dash, never a zero. The two mean opposite things and this table is
      // now sortable, which makes conflating them a wrong answer rather than
      // an ugly one.
      if (v === null || v === undefined) return `<td class="num">&mdash;</td>`;

      const shown = c.fmt ? c.fmt(v) : v;
      if (c.stick) return `<td class="stick ${c.stick} num">${shown}</td>`;
      if (c.key === "ovr") {
        return `<td class="num ovr ${v >= 55 ? "good" : ""}"
            title="${overallReason(p)}">${shown}</td>`;
      }
      return `<td class="num${c.group ? " stat" : ""}">${shown}</td>`;
    }).join("");

    return `
      <tr class="${p.drafted ? "drafted" : ""} ${adpConflict(p) ? "conflict" : ""}">
        ${cells}
        <td class="rowacts">
          ${p.drafted ? "" : `<button class="star${queued(p) ? " on" : ""}" data-queue="${p.name}"
            aria-pressed="${queued(p)}"
            aria-label="${queued(p) ? "Remove " + p.name + " from your queue" : "Add " + p.name + " to your queue"}"
            title="${queued(p) ? "In your queue" : "Add to your queue"}">&#9733;</button>`}
          <button class="draft-btn" data-draft="${p.name}"
             ${p.drafted || !isMyTurn() ? "disabled" : ""}>${p.drafted ? "Taken" : "Draft"}</button>
        </td>
      </tr>`;
  }).join("");
}

/* Which way the pick order leaves this cell.

   A snake board is read for its turns, and the turn is the one thing the
   numbers alone make you work out: the last pick of a round hands straight
   over to the first pick of the next, which is why the two ends of the room
   pick twice in a row and the middle never does. So the last pick of any
   round points down and everything else points the way its round runs.

   `pickInRound` rather than a second copy of the mirror — the whole point of
   putting it in the engine was that this is the third place that wants it.

   `teams` is a parameter rather than read from `league`, because the hero shot
   draws a fixed ten-team room whatever league the visitor has set up. One
   function for both boards: the landing page claiming a different snake from
   the product is the drift this signature exists to prevent. */
/* What a team has, at a glance, under its name on the board.

   The one thing a board cannot otherwise tell you is what everybody else
   still needs, and it is in `state.picks` already — so this is a read of data
   the app has rather than anything new. It is what makes the column above a
   pick legible: three running backs and no quarterback is a team about to
   take a quarterback.

   **Which positions get counted is derived, not listed.** FORCED_LATE already
   names the two the app itself schedules — cpuScore() refuses a kicker before
   the last two rounds and a defense before the last three, and the
   suggestions never offer one earlier. Counting a position nobody is choosing
   is eight columns of "0 0" until the closing rounds and then eight of "1 1".
   Listing QB, RB, WR and TE here instead would be the league shape written
   down a second time, which is the failure this project has already paid for
   twice.

   **Each count carries its own ground, and that is what makes it safe.** A
   chip is white on a position solid, which is the contract those colours were
   darkened to meet, so it does not matter whether it lands on the board head
   or on the navy of your own column — the header behind it is never part of
   the sum. Colouring the *text* instead was measured first and does not
   survive: the light-theme --*-fg tones are 4.85 to 5.69 on --board-hd and
   2.15 to 2.52 on your own column's navy, so the one team a manager looks at
   most would be the one that failed. */
const COUNTED_POSITIONS = POSITIONS.filter(function (p) { return !FORCED_LATE[p]; });

function rosterStrip(slot) {
  return '<span class="hd-roster">' + COUNTED_POSITIONS.map(function (pos) {
    const n = countAt(slot, pos);
    // Empty is drawn as empty rather than dropped: a gap where a chip should
    // be is the fact somebody is reading this strip for.
    return `<span class="hd-pos ${n ? pos : "none"}">${n}</span>`;
  }).join("") + "</span>";
}

function boardArrow(round, slot, teams) {
  if (DraftEngine.pickInRound(round, slot, teams) === teams) return "&darr;";
  return round % 2 === 0 ? "&larr;" : "&rarr;";
}

/* The headshot, or nothing at all.

   `avatar()` is deliberately not reused. It draws initials underneath as a
   fallback and carries the `.avatar` class, which is hidden outright inside
   the rail and is the player photo on the sheet — a 20px board face wants
   neither. Nothing is drawn when there is no id, rather than a placeholder:
   140 grey circles is a worse board than 140 cards, six of which have no
   picture.

   `data-drop-on-error` is how a 404 disappears. It has to be that rather than
   an inline `onerror`, because an inline handler is a script the CSP would
   have to allow, and allowing those means allowing the ones somebody else
   writes into a chat message. */
function boardFace(player) {
  const url = photoUrl(player);
  return url
    ? `<img class="cell-face" src="${url}" alt="" loading="lazy" data-drop-on-error>`
    : "";
}

function renderBoard() {
  const grid = $("boardGrid");

  // One column per team plus the round gutter. The stylesheet carries a
  // ten-team default for the moment before this runs; the real count is
  // only known once the league is set, so it is written here.
  grid.style.gridTemplateColumns = `30px repeat(${league.teams}, minmax(74px, 1fr))`;
  grid.style.minWidth = (30 + league.teams * 77) + "px";

  let html = `<div class="hd"></div>`;

  for (let s = 0; s < league.teams; s++) {
    html += `<div class="hd ${s === state.mySlot ? "me" : ""}">` +
              `<span class="hd-name">${s === state.mySlot ? "YOU" : cpuName(s).split(" ")[0]}</span>` +
              rosterStrip(s) +
            `</div>`;
  }

  for (let r = 1; r <= league.rounds; r++) {
    html += `<div class="rd">${r}</div>`;
    for (let s = 0; s < league.teams; s++) {
      const pick = state.picks.find((p) => p.round === r && p.slot === s);
      if (pick) {
        const p = pick.player;
        html += `<div class="cell ${p.pos} ${s === state.mySlot ? "mine" : ""}">
                   <b>${shortName(p)}</b><s>${p.pos} &middot; ${p.team}</s>
                   <span class="cell-foot">
                     <span class="cell-dir" aria-hidden="true">${boardArrow(r, s, league.teams)}</span>
                     <span class="cell-pick">${pickCode(pick.overall)}</span>
                     ${boardFace(p)}
                   </span></div>`;
      } else {
        const c = onTheClock();
        const isNow = c && c.round === r && c.slot === s;
        /* Which pick of the round this is, not which seat. The engine owns
           that mirror — this line used to be `s + 1`, which is the same fact
           written down twice and drifting in the half of the board where the
           two disagree. */
        const inRound = DraftEngine.pickInRound(r, s, league.teams);

        /* `mine` goes on an empty cell too, and that is the half of this
           that was missing. The class only ever went on a filled one, so the
           board marked where you had been and not where you were going —
           which is the one question a snake board exists to answer, and four
           rounds out in a twelve-team room it was a counting exercise done
           by hand. The gold column is drawn from the same `state.mySlot` the
           header already uses. */
        const isMine = s === state.mySlot;

        /* The arrow goes on an empty cell too, and it is the same argument
           as the gold column beside it. A drafted cell has always carried the
           direction the order is travelling; an undrafted one carried a bare
           code, so the snake was legible over the half of the board that has
           already happened and not over the half you are about to play. That
           is backwards — the turn matters *before* the picks land, which is
           when you are working out whether the wait is one pick or nineteen.

           It yields to the clock, and only to the clock. The cell on the
           clock shows the countdown instead — two facts in a 74px box is one
           too many, and the countdown is the one somebody is watching. When
           there is no clock to show, that cell takes the arrow like any
           other. */
        const face = isNow && clockShowing()
          ? clockText()
          : `<span class="cell-dir" aria-hidden="true">${boardArrow(r, s, league.teams)}</span>` +
            `<span class="cell-pick">${r}.${String(inRound).padStart(2, "0")}</span>`;

        /* How far away this pick is, which "5.01" cannot say on its own.

           Only on a cell nobody has drafted yet. On a filled one it is the
           sixth fact in a 74px box and answers a question nobody has — the
           pick already happened. On an empty one it turns "when do I pick
           again" from arithmetic into reading, which is the same thing the
           gold column and the arrow are for.

           DraftEngine.overallOf() rather than the sum written out here: the
           mirror is inside it, and a caller holding a round and a seat must
           never work that out again. */
        const ovr = `<span class="cell-ovr">${DraftEngine.overallOf(r, s, league.teams)}</span>`;

        // The cell on the clock is the clock. Looking away from where the
        // pick lands to find out how long is left is the thing this removes.
        html += `<div class="cell empty ${isNow ? "now" : ""} ${isMine ? "mine" : ""}"${isNow ? ' id="boardClock"' : ""}>${ovr}${face}</div>`;
      }
    }
  }

  grid.innerHTML = html;
  scrollBoardToLive();
}

/* A persistent board is only useful if it is showing the round being drafted.
   Fourteen rounds do not fit above the working area, so the pane scrolls and
   this keeps the live pick in the middle of it.

   The media query is asked here rather than left to the stylesheet, because
   a prefers-reduced-motion rule does not apply to a programmatic scroll that
   asks for "smooth" — the same reason the score arrows check it themselves. */
/* Following the live pick is the default, and it stays the default until the
   reader disagrees with it.

   Until now that disagreement lasted about 350ms. render() rebuilds the board
   on every change — one per CPU pick — and this re-centred every time with
   nothing asked about where the reader had put it, so scrolling up to check
   round one during a run of CPU picks was simply not possible: measured at
   round 12, somebody sitting at the top of the board was pulled back to 316px
   two or three times a second, for as long as they kept trying.

   Only real input frees it. A scroll event cannot be used for this — a smooth
   programmatic scroll fires a stream of them and would free the board on its
   own animation — so it listens for the things only a person does. */
const boardFollow = { on: true, atPick: -1 };

function freeBoardScroll() { boardFollow.on = false; }

function scrollBoardToLive() {
  const scroller = $("boardScroll");
  if (!scroller) return;

  /* Your own turn takes the lead back, once. Once rather than continuously,
     or scrolling up to check a bye week *during your own pick* would be undone
     as briskly as during anybody else's — the same bug wearing your name. */
  if (isMyTurn() && boardFollow.atPick !== state.picks.length) boardFollow.on = true;
  boardFollow.atPick = state.picks.length;

  /* The cell on the clock, or failing that the last one of mine.

     querySelectorAll rather than `.cell.mine:last-of-type`, which does not
     mean what it looks like: every child of the grid is a div, so
     :last-of-type matches only the very last cell on the board, and the
     fallback fired only in the one case where the bottom-right chair
     happened to be yours. */
  const mine = scroller.querySelectorAll(".cell.mine");
  const cell = scroller.querySelector(".cell.now") || mine[mine.length - 1];
  if (!cell) return;

  /* Measured with rects, not offsetTop.

     offsetTop is the distance to the nearest *positioned* ancestor, and
     nothing between a cell and this scroller is positioned — so it was being
     reported against <body> and came back 207px too large. One mistake, two
     symptoms. The board sat four rounds past the live pick, because 207px is
     about four rows. And it twitched on every CPU pick, because anything
     above the board changing height — the pick ticker arriving, the header
     switching to your turn — moves the board down the page, which moved a
     number that was never supposed to be about the page. */
  const cellBox = cell.getBoundingClientRect();
  const viewBox = scroller.getBoundingClientRect();
  const centred = scroller.scrollTop + (cellBox.top - viewBox.top) -
                  (scroller.clientHeight - cellBox.height) / 2;

  // Clamped here rather than left to the browser, so the comparison below is
  // against the position we would actually end up at.
  const target = Math.max(0, Math.min(centred,
                                      scroller.scrollHeight - scroller.clientHeight));

  /* Already there. Worth checking, because render() rebuilds the board on
     every change and asking for a scroll we are already at still starts an
     animation — and an animation every time a CPU picks is the jitter.

     It is also how following resumes on its own: scrolling back to the live
     pick is the reader saying they are done looking, and it needs no separate
     gesture to mean that. */
  if (Math.abs(target - scroller.scrollTop) < 4) { boardFollow.on = true; return; }

  if (!boardFollow.on) return;

  const smooth = !(window.matchMedia &&
                   window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  scroller.scrollTo({ top: target, behavior: smooth ? "smooth" : "auto" });
}

/* The starting lineup, with the best eligible player seated in each slot,
   and whoever is left over. Written once because the rail and the full
   My Team view both need it and two answers to "who is starting" that could
   drift apart is exactly the bug this file is organised to avoid.

   Roster order is draft order, so the first eligible player wins the slot —
   which is why the FLEX ends up holding whoever was taken later rather than
   whoever is worse.

   Takes an optional slot so the React Team tab can seat any manager's
   roster, not just yours — added for the mobile redesign's "check anyone's
   team" tab, without a second copy of the fill-order logic the grade and
   the legacy My Team view both already depend on being correct. */
function seatedLineup(slot) {
  const seat = slot === undefined ? state.mySlot : slot;
  const mine = rosterOf(seat).slice();
  const used = [];

  const seats = lineupSlots().map(function (slot) {
    const pick = mine.find(function (p) {
      return used.indexOf(p) < 0 && fillsSlot(p, slot);
    }) || null;
    if (pick) used.push(pick);
    return { slot: slot, player: pick };
  });

  return { seats: seats, bench: mine.filter((p) => used.indexOf(p) < 0) };
}

function renderTeam() {
  const lineup = seatedLineup();

  $("startersList").innerHTML =
    lineup.seats.map((s) => rosterRow(posLabel(s.slot), s.player, false)).join("");

  // The bench is however many seats are left once the starters are seated.
  const benchRows = [];
  for (let i = 0; i < league.bench; i++) {
    benchRows.push(rosterRow("BN", lineup.bench[i] || null, true));
  }
  $("benchList").innerHTML = benchRows.join("");
}

/* The rail: the two things you check between picks, never more than a glance
   away. It is the starting lineup only — the bench is a full-view question,
   and a rail that lists twenty rows stops being scannable.

   Which is a good rule that was telling a lie. The heading counts the whole
   roster, so it read "Your roster · 14 of 14" above a list of nine, and the
   five it did not mention looked like five it had lost. The last row now
   says how many are on the bench, so the list adds up to the number above
   it without the rail growing the twenty rows this comment is about. */
function renderRail() {
  const lineup = seatedLineup();
  const held = rosterOf(state.mySlot).length;

  $("railRosterHead").textContent = `Your roster · ${held} of ${rosterSize()}`;

  /* The launcher answers the commonest question without being opened. It is
     shown on the same terms as the chat's: only in a started draft, because
     there is no roster to glance at before one. */
  $("railFab").hidden = !(state.started && route() === "draft");
  $("railFabText").textContent = `Roster ${held}/${rosterSize()}`;

  /* A real button, because it always looked like one. This row exists to say
     the rail is not showing you everything, so the way to the rest of it
     belongs on the row — it just has to actually go there. */
  const benched = lineup.bench.length;
  const benchRow = benched
    ? `<li class="benchsum"><span class="rslot BN">BN</span>
         <span class="rfill">${benched} on the bench</span>
         <button type="button" class="rtm" data-goto-tab="tab-team"
           aria-label="See all ${held} players on My Team">My Team</button></li>`
    : "";

  $("railRoster").innerHTML = lineup.seats.map(function (s) {
    const label = posLabel(s.slot);
    if (!s.player) {
      return `<li class="empty"><span class="rslot ${s.slot}">${label}</span>
                <span class="rfill none">Empty</span></li>`;
    }
    return `<li><span class="rslot ${s.slot}">${label}</span>
        <span class="rfill name-link" data-player="${s.player.name}">${lastName(s.player.name)}</span>
        <span class="rtm">${s.player.pos} &middot; ${s.player.team}</span></li>`;
  }).join("") + benchRow;
}

function rosterRow(slotName, player, isBench) {
  if (!player) {
    return `<li><span class="slot ${isBench ? "bn" : ""}">${slotName}</span><span class="skeleton"></span></li>`;
  }
  const pick = state.picks.find((p) => p.player === player);
  return `<li>
      <span class="slot ${isBench ? "bn" : ""}">${slotName}</span>
      ${avatar(player, true)}
      <div>
        <div class="rname name-link" data-player="${player.name}">${player.name}</div>
        <div class="rmeta"><span class="badge ${player.pos}">${posLabel(player.pos)}</span> ${player.team} &middot; Bye ${player.bye} ${injBadge(player)}</div>
      </div>
      <span class="rpick">${pickCode(pick.overall)}</span>
    </li>`;
}

function renderPicks() {
  const holder = $("picksList");

  if (state.picks.length === 0) {
    holder.innerHTML = `<div class="empty"><p class="empty-title">No picks yet</p>
      <p class="empty-sub">Each selection will appear here, most recent first.</p></div>`;
    return;
  }

  const recent = state.picks.slice().reverse();
  let html = "";
  let lastRound = null;

  recent.forEach(function (pick) {
    if (pick.round !== lastRound) {
      html += `<div class="round-divider">Round ${pick.round}</div>`;
      lastRound = pick.round;
    }
    html += `
      <div class="pick-card ${pick.slot === state.mySlot ? "mine" : ""}">
        <span class="pick-no">${pickCode(pick.overall)}</span>
        ${avatar(pick.player, true)}
        <div>
          <div class="pick-team">${teamLabel(pick.slot)}</div>
          <div class="pick-name name-link" data-player="${pick.player.name}">${pick.player.name}</div>
          <div class="pick-meta"><span class="badge ${pick.player.pos}">${posLabel(pick.player.pos)}</span> ${pick.player.team} &middot; Bye ${pick.player.bye}</div>
        </div>
      </div>`;
  });

  holder.innerHTML = html;
}

/* A run is the thing that changes a draft plan, and it is entirely readable
   from picks already stored: if the last seven picks were five backs, the
   backs are going, and waiting a round costs you one.

   Seven is a window wide enough to be a trend and short enough to still be
   happening. Five of it is a clear majority without needing a near-sweep,
   which at these sizes almost never occurs. Under a third of the window
   there is nothing to say, so it says nothing. */
const RUN_WINDOW = 7;
const RUN_THRESHOLD = 5;

const RUN_NOUNS = {
  QB: "quarterbacks", RB: "backs", WR: "receivers",
  TE: "tight ends", K: "kickers", DST: "defenses"
};

function currentRun() {
  if (state.picks.length < RUN_WINDOW) return null;

  const recent = state.picks.slice(-RUN_WINDOW);
  const counts = {};
  recent.forEach(function (p) {
    counts[p.player.pos] = (counts[p.player.pos] || 0) + 1;
  });

  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  if (!top || counts[top] < RUN_THRESHOLD) return null;
  return { pos: top, count: counts[top] };
}

/* Where the model and the market disagree enough to be worth saying out loud.
   Only at the threshold, because a chip on every row is a chip on no row.

   Solo it sits on the player row, which is where you want it: it is the app
   reading the board for you before you commit. In a room the same chip on the
   same shared list is the app reading the board for *everybody*, including the
   nine people who have not thought about that player yet — so it comes off the
   board there and is said in the ticker instead, after the pick, to the one
   manager who has already made the decision. */
function marketChip(player) {
  const gap = marketGap(player);
  if (gap >= MARKET_GAP) {
    return `<span class="chip val">Value &middot; projects ${posLabel(player.pos)}${player.projPosRank}</span>`;
  }
  if (gap <= -MARKET_GAP) {
    return `<span class="chip reach">Reach &middot; projects ${posLabel(player.pos)}${player.projPosRank}</span>`;
  }
  return "";
}

function renderTicker() {
  const ticker = $("ticker");
  const pick = state.lastPick;

  if (!pick) { ticker.hidden = true; return; }

  const run = currentRun();
  const runNote = run
    ? `<span class="run"><b>${run.count} of the last ${RUN_WINDOW}</b> were ` +
      `${RUN_NOUNS[run.pos] || run.pos}</span>`
    : "";

  ticker.hidden = false;
  ticker.innerHTML = `
    <span class="tick-pick">${pickCode(pick.overall)}</span>
    ${avatar(pick.player, true)}
    <div class="tick-body">
      <div class="tick-team">${teamLabel(pick.slot)} selected</div>
      <div class="tick-name">
        ${pick.player.name}
        <span class="badge ${pick.player.pos}">${posLabel(pick.player.pos)}</span>
        <span class="tick-tm">${pick.player.team} &middot; Bye ${pick.player.bye}</span>
        ${injBadge(pick.player)}
        ${pick.slot === state.mySlot ? marketChip(pick.player) : ""}
      </div>
    </div>
    ${runNote}
    ${state.simulating ? '<button class="mini" id="skipBtn">Skip &raquo;</button>' : ""}`;
}

function bar(label, detail, percent, tone) {
  const width = Math.max(2, Math.min(100, percent));
  return `<div class="bar-row">
      <div class="bar-head"><b>${label}</b><span>${detail}</span></div>
      <div class="bar-track"><div class="bar-fill ${tone}" style="width:${width}%"></div></div>
    </div>`;
}

function renderGrades() {
  const body = $("gradesBody");

  if (state.picks.length < league.teams) {
    body.innerHTML = `<div class="empty"><p class="empty-title">Nothing to grade yet</p>
      <p class="empty-sub">Analysis appears once the first round is done, and updates after every pick.</p></div>`;
    return;
  }

  const all = analyseDraft();
  const me  = all[state.mySlot];
  const done = draftOver();

  const tone = (v) => v >= 66 ? "good" : v >= 33 ? "" : "bad";

  let html = `
    <div class="grade-hero">
      <div class="grade-letter">${me.grade}</div>
      <div>
        <h3>${done ? "Final grade" : "Grade so far"} &mdash; ${me.rank} of ${league.teams}</h3>
        <p>${done ? "Draft complete." : "Updates after every pick."}
           Graded against the ${league.teams - 1} teams in this room, not against the league at large.</p>
      </div>
    </div>

    <div class="bars">
      ${bar("Starter strength", Math.round(me.starters) + " pts above replacement",
            me.startersScaled, tone(me.startersScaled))}
      ${bar("Draft value", (me.value >= 0 ? "+" : "") + me.value + " picks, K and D/ST aside",
            me.valueScaled, tone(me.valueScaled))}
      ${bar("Roster construction", me.build + " / 100",
            me.buildScaled, tone(me.buildScaled))}
      ${bar("Bye week safety", byeSummary(me.badWeeks),
            me.byePenaltyScaled, tone(me.byePenaltyScaled))}
    </div>`;

  /* Each callout stands on its own. They used to render as a pair or not at
     all, so a draft with nothing reached for lost its best value too. */
  if (me.bargain || me.reach) {
    html += `<div class="callouts">`;
    if (me.bargain) {
      html += `<div class="callout good">
        <div class="lbl">Best value</div>
        <div class="val">${me.bargain.pick.player.name}</div>
        <div class="sub">Taken at ${pickCode(me.bargain.pick.overall)}, board had him ${me.bargain.pick.player.overall}${me.bargain.gap > 0 ? " &mdash; " + me.bargain.gap + " picks late" : ""}</div>
      </div>`;
    }
    if (me.reach) {
      html += `<div class="callout ${me.reach.gap < -8 ? "bad" : ""}">
        <div class="lbl">Biggest reach</div>
        <div class="val">${me.reach.pick.player.name}</div>
        <div class="sub">Taken at ${pickCode(me.reach.pick.overall)}, board had him ${me.reach.pick.player.overall} &mdash; ${Math.abs(me.reach.gap)} picks early</div>
      </div>`;
    }
    html += `</div>`;
  }

  // bye week strip, weeks 5 to 14
  let strip = "";
  for (let w = 5; w <= 14; w++) {
    const n = me.byes[w] || 0;
    strip += `<i class="${n >= 4 ? "w4" : n === 3 ? "w3" : n === 2 ? "w2" : ""}">${w}</i>`;
  }
  html += `<p class="section-label">Starters on bye, by week</p><div class="byebar">${strip}</div>`;

  // standings
  html += `<p class="section-label" style="margin-top:20px">Room standings</p>
    <table class="standings"><tbody>`;
  /* The number between the rank and the letter is the weighted total, which
     is what the room is ordered by and what the letter is handed out for.
     It used to print starter strength — one component of four — so the
     column climbed and fell down a table that was strictly ranked, and four
     teams sharing a starter strength of 90 sat at ranks 1, 4, 5 and 7 with
     four different grades. It read as a sorting bug. The other three
     components are on the bars above; this column is the answer they add up
     to. */
  all.slice().sort((a, b) => a.rank - b.rank).forEach(function (t) {
    html += `<tr class="${t.slot === state.mySlot ? "me" : ""}">
        <td class="rk">${t.rank}</td>
        <td>${teamLabel(t.slot)}</td>
        <td class="num">${Math.round(t.total)}</td>
        <td class="gr">${t.grade}</td>
      </tr>`;
  });
  html += `</tbody></table>

    <p class="method">Starter strength is 50% of the grade: every starter scored by how many
    places above replacement level they rank at their position, where replacement is
    ${replacementText()} for this ${league.teams}-team league, which starts ${lineupText()}.
    Draft value is 25%: how far each
    player fell past their ADP when you took them, counting only the picks you were free to
    time &mdash; kickers and defenses are left out, because the room will not let anyone take
    one before the closing rounds and their ADP is set by longer drafts than this one.
    Roster construction is 15%, docking unfilled
    starting slots, spots spent on a quarterback, kicker or defense you can never start, and how
    far from startable your best benched running back and receiver are &mdash; nothing if either
    could start today. Bye week safety is the last 10%, charging every week that leaves more than
    two starters out &mdash; by the square of how many are missing beyond the second, so one week
    with four off costs more than two weeks with three.
    Each component is scaled against the other ${league.teams - 1} teams before weighting.</p>`;

  body.innerHTML = html;
}

/* ---- 11b. Player detail sheet -------------------------- */

let sheetPlayer = null;

function meter(name, score, tone, why) {
  const filled = Math.round(score / 20);
  let segs = "";
  for (let i = 0; i < 5; i++) segs += `<i class="${i < filled ? "on" : ""}"></i>`;
  return `<div class="sig ${tone}">
      <div class="sig-head"><b>${name}</b><span>${label(score)}</span></div>
      <div class="sig-seg">${segs}</div>
      ${why.length ? `<p class="sig-why">${why.join(" &middot; ")}</p>` : ""}
    </div>`;
}

// Decide which columns a stat table shows. Driven by position, with two
// extras that only appear when there is something in them: passing for a
// non-quarterback trick play, and returns for anyone who runs kicks back.
// Most keys map straight onto the stored data. Return touchdowns are the
// exception: they are stored separately for kicks and punts and combined here.
function cellValue(row, key) {
  if (key === "rtd") {
    const total = (row.krt || 0) + (row.prt || 0);
    return total || undefined;
  }
  return row[key];
}

function logColumns(player, sample, isSeason) {
  const firstHead = isSeason ? "Year" : "Wk";
  const has = (k) => sample.some((row) => row && row[k]);

  let head = [firstHead, "Pts"];
  let keys = ["w", "pts"];

  if (player.pos === "QB") {
    head = head.concat(["Att", "Cmp", "PaYd", "PaTD", "INT", "RuAtt", "RuYd", "RuTD"]);
    keys = keys.concat(["pa", "pc", "py", "pt", "pi", "ra", "ry", "rt"]);
  } else if (player.pos === "K") {
    head = head.concat(["FG", "XP"]);
    keys = keys.concat(["fg", "xp"]);
  } else if (player.pos === "DST") {
    head = head.concat(["Sack", "INT", "FumRec"]);
    keys = keys.concat(["sk", "in", "fr"]);
  } else {
    // RB, WR and TE all get the full receiving AND rushing line. A back who
    // catches 80 passes and a receiver who takes jet sweeps both matter.
    head = head.concat(["Tgt", "Rec", "RecYd", "RecTD", "RuAtt", "RuYd", "RuTD"]);
    keys = keys.concat(["tg", "rc", "cy", "ct", "ra", "ry", "rt"]);

    if (has("pa")) {   // the occasional trick-play pass
      head = head.concat(["PaYd", "PaTD"]);
      keys = keys.concat(["py", "pt"]);
    }
  }

  if (player.pos !== "DST" && (has("kry") || has("pry") || has("krt") || has("prt"))) {
    head = head.concat(["KRYd", "PRYd", "RetTD"]);
    keys = keys.concat(["kry", "pry", "rtd"]);
  }

  if (player.pos !== "DST" && player.pos !== "K" && has("fl")) {
    head = head.concat(["FumL"]);
    keys = keys.concat(["fl"]);
  }

  return { head: head, keys: keys };
}

/* Sleeper stores height as a plain count of inches — 67 through 78 across
   our whole pool, no quote forms at all — so it is ours to render. A team
   defense has neither, which is why every part of this line is optional
   rather than dashed out. */
function heightText(inches) {
  const n = Number(inches);
  if (!n || n < 40 || n > 90) return null;
  return Math.floor(n / 12) + "'" + (n % 12) + '"';
}

/* Injury codes as words. The badge on the row has room for two letters and
   the profile has room for the meaning, and "Carrying an Q designation" is
   not a sentence. */
/* The table lives inside the function rather than beside it, and that is
   deliberate. draftSignals() calls this from line 1784 and the top-level
   render() runs at line 730 — both before this point in the file. A function
   declaration hoists and is callable from anywhere; a `const` beside it
   would still be in the temporal dead zone at that moment and would throw.
   Rebuilding six keys per call costs nothing at this rate. */
function injuryWords(code) {
  const words = { Q: "questionable", D: "doubtful", O: "out",
                  IR: "injured reserve", PUP: "physically unable to perform",
                  SUS: "suspended", NA: "not active" };
  return words[code] || String(code);
}

function bioLine(player, s) {
  /* A team defense has no age, height or college, and there is no honest
     dash to print for them — it is eleven people. It gets the one line that
     is true of it instead, rather than an empty strip under the name. */
  if (player.pos === "DST") {
    return `${player.team} team defense &middot; bye ${player.bye}`;
  }
  if (!s) return `ADP ${player.adp.toFixed(1)}`;

  const bits = [];
  if (s.age) bits.push("Age " + s.age);
  const ht = heightText(s.ht);
  if (ht) bits.push(ht);
  if (s.wt) bits.push(s.wt + " lb");
  if (s.exp !== undefined) bits.push(s.exp === 0 ? "Rookie" : s.exp + " yrs exp");
  if (s.col) bits.push(escHtml(s.col));
  if (s.depth) bits.push(s.depth + (s.order ? " #" + s.order : ""));

  return bits.join(" &middot; ");
}

/* The line Sleeper puts under a player's name: where he ranks, and where the
   market has him. Ours differs in one way worth keeping — their "% rostered"
   is telemetry from their own userbase, which we have no equivalent of and
   would be guessing at. What we can say instead is what our model thinks,
   which is the thing they cannot. */
function rankRow(player) {
  const score = overallScore(player);
  /* "Overall" is the board rank here and has always meant that. The score
     beside it used to carry the same word in the queue, the meter and the
     table header, so the strip and the meter below it were the same number
     under two names with nothing saying so. One name now — the score is the
     Juke score everywhere, and this cell keeps Overall for the rank. */
  const cells = [
    ["#" + player.overall, "Overall"],
    [posLabel(player.pos) + player.posRank, "Position"],
    [player.adp.toFixed(1), "ADP"],
    ["T" + player.tier, "Tier"],
    [score === null ? "&mdash;" : Math.round(score), "Juke score"]
  ];
  return `<div class="rankrow">` + cells.map(function (c) {
    return `<div class="rankcell"><b>${c[0]}</b><span>${c[1]}</span></div>`;
  }).join("") + `</div>` + jukeNote(player);
}

/* What the number in that strip actually means, next to the number itself.
   The sheet did explain it — in the method paragraph under three meters, past
   the fold, using the other name — which is a long way from the figure that
   raised the question.

   Both halves are derived from work already done: overallReason() has existed
   all along and was reachable only as a `title` tooltip on a table cell, which
   is to say not at all on a phone. */
function jukeNote(player) {
  const bits = [];

  /* A position we decline to rank says so first, and then stops. The lines
     below are all about a score that does not exist here, and "projects K3,
     drafted as K1" invites exactly the comparison the backtest says is
     worthless. */
  if (player.projPts !== null && overallScore(player) === null) {
    return `<p class="jukenote"><b>Not rated</b> &mdash; the projection ranks this
      position no better than chance, measured against three seasons of our own
      forecasts, so the Juke score is left blank rather than guessed at.</p>`;
  }

  const gap = replacementGap(player);
  if (gap !== null && gap < 0) {
    /* What a clamped zero is actually saying. Below replacement is not the
       same as worthless: of the players who scored zero on 2024 actuals, 35%
       were above it a year later and nine of them reached 25.

       The size of the gap is deliberately not repeated here — the sentence
       after this one already carries it, and printing "below replacement by
       37 points · 137 projected points, -37 against a replacement WR" says
       the same number twice in a row. This clause exists to give the floor a
       name and a landmark; the arithmetic belongs to the line that follows. */
    bits.push(`<b>Below replacement</b> &mdash; startable ${posLabel(player.pos)}
      territory begins at ${posLabel(player.pos)}${replacementRank(player.pos)}
      on this board`);
  }

  // Trailing full stop off, because these are joined by a middot: a sentence
  // ending "drafted as WR37. · Scored 14" reads as a typo rather than a list.
  bits.push(escHtml(overallReason(player)).replace(/\.\s*$/, ""));

  const was = priorScore(player);
  if (was !== null && PRIOR_SEASON) {
    const move = projectionMove(player);
    bits.push(`Scored <b>${Math.round(was)}</b> on ${PRIOR_SEASON} actuals
      (${player.priorGames} game${player.priorGames === 1 ? "" : "s"})${move}`);
  } else if (PRIOR_SEASON) {
    bits.push(`No ${PRIOR_SEASON} season to compare against, so this is the
      projection alone`);
  }

  return `<p class="jukenote">${bits.join(" &middot; ")}</p>`;
}

// Which way the model is betting, and only when the move is big enough to be
// worth a reader's attention. Year-to-year movement in this score is large by
// nature — across real consecutive seasons the mean absolute change is 12 to
// 20 points — so a threshold under that would call noise a bet.
function projectionMove(player) {
  const now = overallScore(player), was = priorScore(player);
  if (now === null || was === null) return "";
  const d = Math.round(now - was);
  if (Math.abs(d) < 15) return "";
  return d > 0 ? `, so the projection is <b>up ${d}</b> on him`
               : `, so the projection is <b>down ${Math.abs(d)}</b> on him`;
}

/* ---- week by week ----------------------------------------

   Logs are stored keyed by season now, so a player gets a selector of the
   years he actually has: three for a rookie's worth of history, both for a
   veteran, none at all for someone outside the weekly cut. Sleeper shows a
   fixed row of five and greys out the ones a player never played; showing
   only what exists says the same thing without the dead tabs. */
let sheetLogPick = null;

function logYears(s) {
  return (s && s.w) ? Object.keys(s.w).sort().reverse() : [];
}

// The year on screen: whatever was last chosen if this player has it, else
// his most recent. Reset per player so opening a rookie after a veteran does
// not land on a year the rookie has never seen.
function sheetLogYear(s) {
  const years = logYears(s);
  if (!years.length) return null;
  return years.indexOf(sheetLogPick) >= 0 ? sheetLogPick : years[0];
}

function logsHtml(player, s, year) {
  const years = logYears(s);
  if (!years.length || !year) {
    return `<div class="nodata">No week-by-week logs stored for this player.</div>`;
  }

  const weeks = s.w[year] || [];
  const picker = years.length < 2 ? "" :
    `<div class="yearpick">` + years.map(function (y) {
      return `<button type="button" class="${y === year ? "on" : ""}" data-logyear="${y}">${y}</button>`;
    }).join("") + `</div>`;

  // Whether a week happened is a question about the raw data, never about
  // what it scored, so both checks go through didPlay(). Listing a handful of
  // stats by hand would call a week blank for anyone whose only contribution
  // was outside that list.
  const played = weeks.filter(didPlay);
  const scored = played.reduce((a, g) => a + fantasyPoints(g), 0);
  // The heading goes through perGame() so an all-bye log reads as a dash
  // rather than a confident 0.0; avg stays a number for the cell tones.
  const avg = played.length ? scored / played.length : 0;
  const cols = logColumns(player, weeks);

  const rows = weeks.map(function (g) {
    const blank = !didPlay(g);
    const points = fantasyPoints(g);
    const cells = cols.keys.map(function (k) {
      const v = k === "w" ? g.w : k === "pts" ? points : cellValue(g, k);
      const tone = k === "pts" && !blank
        ? (points >= avg * 1.4 ? "hi" : points <= avg * 0.5 ? "lo" : "") : "";
      return `<td class="${tone}">${v === undefined ? "&mdash;" : v}</td>`;
    }).join("");
    return `<tr class="${blank ? "bye" : ""}">${cells}</tr>`;
  }).join("");

  return `${picker}
    <p class="section-label">${year} week by week &middot; ${perGame(scored, played.length)} per game played</p>
    <div class="tblscroll"><table class="logtbl">
      <thead><tr>${cols.head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

/* ---- latest news -----------------------------------------

   Headlines about this player, fetched through the worker so the provider's
   key is never in the page. It sits directly under "Our read" on purpose:
   ours first, because it is the thing no feed has, then the wire.

   **It is a link, not a reprint.** Headline, one clipped line, the source's
   name and an outbound link. Reproducing the body is what a licence buys; an
   aggregator's headline and a link back is not that, and the attribution is
   not decoration — an unsourced headline is the version we may not show.

   **Every field is escaped.** This is the third thing on the page written by
   somebody outside this project, after chat and the ESPN strip, and it lands
   in innerHTML. The same rule applies for the same reason.

   **It never blocks, never throws and fails by disappearing** — the score
   strip's contract. A sheet opens with the panel hidden and it only appears
   if headlines arrive. No spinner: a permanently-empty box on a page that is
   otherwise complete is worse than no box, and this is a section a reader
   never asked to wait for. */
const newsCache = new Map();
const NEWS_SUMMARY_MAX = 200;

/* What stands in for the meter at a position we will not score.

   An empty bar reading "Very Low" is what a null produces if you let it
   through, and that is a verdict rather than an abstention — the one reading
   further from the truth than the number it replaced. Saying nothing at all
   is not right either: the meter is missing and the reader deserves to know
   it was removed on purpose. */
function unratedNote(player) {
  const what = player.pos === "DST" ? "defenses" : "kickers";
  return `<div class="sig unrated">
      <div class="sig-head"><b>Juke score</b><span>Not rated</span></div>
      <p class="sig-why">Graded against three seasons of our own past forecasts,
        the projection ranks ${what} no better than chance &mdash; one of those
        seasons came out backwards. Rather than print a number we know carries
        no signal, we leave it blank. The projected points below are still real,
        and ${player.pos === "DST" ? "a defense" : "a kicker"} is worth taking
        late whoever it is.</p>
    </div>`;
}

function newsSlot() {
  // Hidden until there is something to say. The stylesheet gives .newsbox a
  // display, so it carries its own [hidden] rule — an author display beats
  // the property, which is how a solo draft once grew a chat panel.
  return `<div class="newsbox" id="newsPanel" hidden></div>`;
}

function newsHtml(items) {
  // No heading: the tab is the heading. It carried one while this lived under
  // Our read on the Overview tab, where it needed to announce itself.
  return items.map(function (n) {
    const when = escHtml(String(n.at || "").slice(0, 24));
    return `<a class="newsitem" href="${escHtml(safeNewsUrl(n.url))}"
               target="_blank" rel="noopener noreferrer">
        <span class="newshead">${escHtml(n.title)}</span>
        ${n.summary ? `<span class="newssum">${escHtml(String(n.summary).slice(0, NEWS_SUMMARY_MAX))}</span>` : ""}
        <span class="newsfoot">${escHtml(n.source)}${when ? " &middot; " + when : ""}</span>
      </a>`;
  }).join("") +
  `<p class="readnote">Headlines from our news provider, linked rather than
     reproduced. Juke does not write these and does not endorse them.</p>`;
}

// One worker-supplied item, turned into exactly what the React news tab
// renders — the URL check (safeNewsUrl) and the clipping (NEWS_SUMMARY_MAX)
// live here rather than in React, for the same reason sourceId() does: a
// field from a feed we do not control is not something to re-check in two
// places. Returns null for anything missing a title or a safe link, the
// same filter newsHtml() already applies before it draws a card.
function newsItemView(n) {
  if (!n || !n.title) return null;
  const url = safeNewsUrl(n.url);
  if (!url) return null;
  return {
    title: n.title,
    summary: n.summary ? String(n.summary).slice(0, NEWS_SUMMARY_MAX) : "",
    source: n.source || "",
    when: String(n.at || "").slice(0, 24),
    url: url
  };
}

/* A link from a feed is a claim, not a fact — the same rule the GIF host gets,
   and checked the same way with URL rather than a substring. Anything that is
   not plain http(s) is dropped: a javascript: or data: href here would be an
   outside party running script in the page, which is the one thing this
   codebase is most arranged to prevent. */
function safeNewsUrl(url) {
  try {
    const u = new URL(String(url), location.href);
    return (u.protocol === "https:" || u.protocol === "http:") ? u.href : "";
  } catch (err) {
    return "";
  }
}

/* This player's id at another source, from the crosswalk the pipeline builds.

   The whole point of holding it is that nothing has to match on a name while
   somebody is reading a profile. A name search at request time is how one Josh
   Allen ends up wearing the other one's news — and every number on the sheet
   around it would still be correct, so nobody would catch it. */
function sourceId(player, source) {
  const s = statOf(player);
  return (s && s.x && s.x[source]) || "";
}

function renderNews(player) {
  const panel = $("newsPanel");
  const tab = $("newsTab");
  if (!panel || !player) return;

  /* Hidden first, every time. The sheet is one element reused for everybody,
     so a tab left showing from the last player is a tab that opens onto his
     headlines under this player's name. */
  panel.hidden = true;
  panel.innerHTML = "";
  if (tab) tab.hidden = true;

  if (typeof Live === "undefined" || !Live.news) return;

  /* No id, no news. Deliberately not a fallback to a name or to league-wide
     headlines: an empty panel is a player we could not link, and the pipeline
     has already written him into unmatched.txt. Showing somebody else's news
     under his name is the one outcome worse than showing none. */
  const theirId = sourceId(player, "tank");
  if (!theirId) return;

  const key = player.id || player.name;

  /* Which player this answer belongs to, checked when it lands rather than
     when it was asked for. A slow response for the player you just closed
     would otherwise render into the sheet you have open now — the sheet is
     one element reused for everybody, so nothing else would have caught it. */
  const draw = function (data) {
    if (!sheetPlayer || (sheetPlayer.id || sheetPlayer.name) !== key) return;
    const items = (data && data.items || []).filter((n) => n && n.title && safeNewsUrl(n.url));
    if (!items.length) return;
    const live = $("newsPanel");
    if (!live) return;
    live.innerHTML = newsHtml(items);
    live.hidden = false;
    const liveTab = $("newsTab");
    if (liveTab) liveTab.hidden = false;
  };

  if (newsCache.has(key)) { draw(newsCache.get(key)); return; }

  Live.news(theirId).then(function (data) {
    // Cached per player for the session, because a draft opens the same sheet
    // repeatedly and a headline does not change inside one.
    newsCache.set(key, data);
    draw(data);
  }).catch(function () { /* the panel simply stays hidden */ });
}

/* ---- our read --------------------------------------------

   Sleeper fills a whole column of a player profile with wire copy from
   Rotowire. We cannot republish that and would not want to — see the note in
   CLAUDE.md — but the space is the most valuable on the page, and leaving it
   empty concedes the comparison.

   So this is the thing we have that a feed does not: the model, saying in
   sentences what the meters below say in bars. Every clause is derived from
   figures already computed for this player. Nothing here is fetched, nothing
   is an opinion typed by a person, and nothing claims to be news. */
function ourRead(player, s, sig) {
  const lines = [];

  /* A team defense is not a "him". Every other position in this pool is a
     person and the NFL's are all men, so "him" is accurate there and reads
     better than the alternatives; a defense gets its own phrasing rather
     than a pronoun. */
  const them = player.pos === "DST" ? "this defense" : "him";
  const They = player.pos === "DST" ? "This defense is" : "He is";

  // Where the market and the model disagree, which is the whole game.
  const gap = marketGap(player);
  /* At a position we decline to score, the projected rank is the very thing
     the backtest found worthless — so "K1 on the projection" is an argument
     from a number we have just told the reader not to trust. The timing is
     what actually matters here, and the app already enforces it. */
  if (overallScore(player) === null && player.projPts !== null) {
    lines.push(`The projection cannot separate ${player.pos === "DST" ? "defenses" : "kickers"}
      well enough to be worth acting on, so take one late and take whoever is
      there. This one is drafted around <b>${posLabel(player.pos)}${player.posRank}</b>.`);
  } else if (player.projPosRank) {
    if (gap >= MARKET_GAP) {
      lines.push(`The board has ${them} at <b>${posLabel(player.pos)}${player.posRank}</b> and the projection
        says <b>${posLabel(player.pos)}${player.projPosRank}</b> — ${gap} places of daylight in your favour.
        That is the kind of gap that pays for a pick.`);
    } else if (gap <= -MARKET_GAP) {
      lines.push(`The room is drafting ${them} at <b>${posLabel(player.pos)}${player.posRank}</b> and the
        projection only supports <b>${posLabel(player.pos)}${player.projPosRank}</b>. Taking ${them} here
        means paying ${Math.abs(gap)} places above what the numbers carry.`);
    } else {
      lines.push(`Priced about right: <b>${posLabel(player.pos)}${player.posRank}</b> on the board,
        <b>${posLabel(player.pos)}${player.projPosRank}</b> on the projection.`);
    }
  }

  // Tier scarcity — the reason to reach a round early, or wait one out.
  const left = board.filter(function (o) {
    return !o.drafted && o.pos === player.pos && o.tier === player.tier;
  }).length;
  if (left > 0) {
    lines.push(left === 1
      ? `${They} the <b>last ${player.pos} in tier ${player.tier}</b>. After ${them} the drop is a
         tier, not a pick.`
      : `<b>${left} ${player.pos}s left in tier ${player.tier}</b>, so the position does not force
         your hand yet.`);
  }

  // Where he sits on his own depth chart, which is the cheapest available
  // read on whether the projection has a route to happening.
  if (s && s.depth && s.order) {
    lines.push(s.order === 1
      ? `Listed <b>first on the ${player.team} depth chart</b> at ${s.depth}.`
      : `Listed <b>${s.order}${s.order === 2 ? "nd" : s.order === 3 ? "rd" : "th"}</b>
         at ${s.depth} for ${player.team}, which is the risk the projection is carrying.`);
  }

  if (player.inj) {
    lines.push(`Listed <b>${escHtml(injuryWords(player.inj))}</b>. The model docks for it; how much
      it should worry you is a question about your bench, not about ${them}.`);
  }

  // Availability, from games actually played rather than from a narrative.
  const last = lastSeason(s);
  if (last && last.gp !== undefined && last.gp < 14) {
    lines.push(`Played <b>${last.gp} games</b> last season. A projection is a per-season number
      and it assumes ${player.pos === "DST" ? "a full one" : "he is on the field for it"}.`);
  }

  if (!lines.length) return "";

  return `<div class="ourread">
      <p class="section-label">Our read</p>
      ${lines.map((l) => `<p>${l}</p>`).join("")}
      <p class="readnote">Worked out from this board and these projections, under your scoring.
        It is one model's opinion, not a wire report and not a consensus.</p>
    </div>`;
}

/* ---- data for the React player card ---------------------

   web/src/components/PlayerProfileDrawer.jsx has always had these four
   tabs; they carried placeholder copy because the real data lives here and
   nothing had bridged it yet. Each function below reuses the exact same
   helpers openSheet() already builds the legacy sheet from — logColumns(),
   cellValue(), didPlay(), logYears(), sourceId() — rather than a second
   reading of the same stats, which is the "nothing about the league shape
   may be written down twice" rule applied to a player's data instead. */

// The current season's projected stat line — points, per-game, position
// rank, the gap against where the board has him, and the underlying
// counting stats for his position (logColumns() picks those the same way
// it picks a week's columns, given a one-row sample).
function projectionSummary(player) {
  const s = statOf(player);
  const p = s && s.p;
  if (!p || !p.gp) return null;

  const cols = logColumns(player, [p]);
  const stats = cols.keys
    .map((k, i) => ({ key: k, label: cols.head[i], value: cellValue(p, k) }))
    .filter((row) => row.key !== "w" && row.key !== "pts" && row.value !== undefined);

  return {
    points: Math.round(fantasyPoints(p)),
    perGame: perGame(fantasyPoints(p), projGames(player.pos, p)),
    posRank: player.projPosRank ? posLabel(player.pos) + player.projPosRank : null,
    // Positive means the projection likes him better than the board does —
    // same sign convention as the draft-value gap elsewhere on the sheet.
    vsAdp: player.projPosRank ? player.posRank - player.projPosRank : null,
    stats: stats
  };
}

// Week-by-week actuals for one year, defaulting to the most recent year
// this player has, plus the list of years so the tab can draw its own
// picker. Mirrors logsHtml() exactly, but returns rows rather than markup
// — React owns how a row is drawn, this only owns which weeks and which
// columns are correct for this player.
function gameLogFor(player, year) {
  const s = statOf(player);
  const years = logYears(s);
  const y = years.indexOf(year) >= 0 ? year : years[0];
  if (!y) return { years: years, year: null, head: [], rows: [], perGameAvg: null };

  const weeks = s.w[y] || [];
  const cols = logColumns(player, weeks);
  const played = weeks.filter(didPlay);
  const scored = played.reduce((a, g) => a + fantasyPoints(g), 0);
  const avg = played.length ? scored / played.length : 0;

  const rows = weeks.map(function (g) {
    const blank = !didPlay(g);
    const points = fantasyPoints(g);
    return {
      blank: blank,
      tone: blank ? "" : points >= avg * 1.4 ? "hi" : points <= avg * 0.5 ? "lo" : "",
      cells: cols.keys.map(function (k) {
        const v = k === "w" ? g.w : k === "pts" ? Math.round(points) : cellValue(g, k);
        return v === undefined ? null : v;
      })
    };
  });

  return { years: years, year: y, head: cols.head, rows: rows, perGameAvg: perGame(scored, played.length) };
}

// Every drafted-pool teammate who carries a depth-chart entry, grouped by
// position group and ordered within it — the exact grouping openSheet()
// already built, just handed back as data instead of painted into one.
function depthChartFor(player) {
  const mates = board.filter(function (other) {
    const os = statOf(other);
    return other.team === player.team && os && os.depth;
  });
  if (!mates.length) return null;

  const groups = {};
  mates.forEach(function (m) {
    const g = statOf(m).depth;
    (groups[g] = groups[g] || []).push(m);
  });

  return Object.keys(groups).sort().map(function (g) {
    const list = groups[g].sort((a, b) => (statOf(a).order || 9) - (statOf(b).order || 9));
    return {
      group: g,
      players: list.map(function (m) {
        return {
          name: m.name,
          pos: m.pos,
          order: statOf(m).order || null,
          adp: m.adp,
          isSelf: m === player
        };
      })
    };
  });
}

function openSheet(player) {
  sheetPlayer = player;
  const s = statOf(player);
  const sig = draftSignals(player);

  /* The club's colour, handed to the stylesheet as a property rather than as
     a fill. Set on the header so both the ring and the band below it inherit
     one value, and removed rather than blanked for a player with no club, so
     the rule falls back to its own default instead of to an empty string. */
  const accent = teamAccent(player);
  if (accent) $("sheetHead").style.setProperty("--team", accent);
  else $("sheetHead").style.removeProperty("--team");

  $("sheetHead").innerHTML = `
    ${avatar(player)}
    <div>
      <h3>${player.name}</h3>
      <div class="sub">
        <span class="badge ${player.pos}">${posLabel(player.pos)}</span>
        ${player.team} &middot; Bye ${player.bye} ${injBadge(player)}
      </div>
      <div class="facts">
        ${bioLine(player, s)}
      </div>
      ${rankRow(player)}
    </div>
    <button class="sheet-close" id="sheetClose">&times;</button>`;

  // ---------- overview ----------
  let overview;
  if (!sig) {
    overview = `<div class="nodata">No projection or stat history for this player yet.
      The data refresh fills this in for anyone Sleeper carries.</div>`;
  } else {
    const p = sig.stats.p || {};
    overview = `
      ${ourRead(player, s, sig)}
      ${sig.overall === null
          ? unratedNote(player)
          : meter("Juke score", sig.overall, sig.overall >= 55 ? "good" : "", sig.reasons.overall)}
      ${meter("Upside",  sig.upside,  sig.upside  >= 55 ? "good" : "", sig.reasons.upside)}
      ${meter("Bust risk", sig.bust,  sig.bust >= 55 ? "bad" : sig.bust >= 35 ? "warn" : "", sig.reasons.bust)}

      <p class="section-label">2026 projection &middot; ${scoringLabel()}</p>
      <div class="statgrid">
        <div class="statbox"><div class="k">Points</div><div class="v">${Math.round(fantasyPoints(p))}</div></div>
        <div class="statbox"><div class="k">Per game</div><div class="v">${perGame(fantasyPoints(p), projGames(player.pos, p))}</div></div>
        <div class="statbox"><div class="k">Pos rank</div><div class="v">${player.projPosRank ? posLabel(player.pos) + player.projPosRank : "&mdash;"}</div></div>
        <div class="statbox"><div class="k">vs ADP</div><div class="v">${player.projPosRank ? (player.posRank - player.projPosRank >= 0 ? "+" : "") + (player.posRank - player.projPosRank) : "&mdash;"}</div></div>
      </div>
      <p class="method">${overallScore(player) === null ? `Kickers and defenses carry no Juke
      score: measured against three seasons of archived forecasts the projection ranks them no
      better than chance, so the number is withheld rather than guessed at. Everything else on
      this sheet &mdash; the projection, the history, the depth chart &mdash; is unaffected.` : ``}
      ${overallScore(player) !== null ? `The Juke score is projected points above the last startable player at
      this position in a ${league.teams}-team league &mdash; ${player.pos}${replacementRank(player.pos)} on
      this board &mdash; as a share of the best such figure anywhere on it. It is a ranking against
      the rest of the pool, so somebody always scores 100, and most of the ${board.length} players
      here score nothing at all &mdash; this league only ever starts
      ${league.teams * (starterCount() + flexCount())} of them at once.` : ``}
      Upside and bust risk weigh how far the projection disagrees with ADP,
      plus experience, age, depth chart position, injury designation and last season's availability.
      This is one model, not a consensus of analysts.</p>`;
  }

  // ---------- game logs ----------
  // Column set is chosen from player.pos, never from whether a stat happens
  // to be present. A running back who threw one trick-play pass is still a
  // running back, and needs his receiving line.
  const logs = logsHtml(player, s, sheetLogYear(s));

  // ---------- seasons ----------
  let seasons;
  if (!s || (!s.s && !s.p)) {
    seasons = `<div class="nodata">No season history stored for this player.</div>`;
  } else {
    const years = seasonKeys(s).map((y) => [y, s.s[y]]);
    if (s.p) years.push(["2026 proj", s.p]);

    /* Which columns to show is decided from a sample of every line we have,
       so a column is not dropped because the one season on screen happened
       to be empty. s.w is keyed by season now, so this walks the years
       rather than concatenating an array. */
    const sample = years.map((y) => y[1]);
    logYears(s).forEach(function (y) { sample.push.apply(sample, s.w[y]); });
    const cols = logColumns(player, sample, true);

    const rows = years.map(function (entry) {
      const y = entry[1];
      const cells = cols.keys.map(function (k) {
        if (k === "w") return `<td>${entry[0]}</td>`;
        const v = k === "pts" ? Math.round(fantasyPoints(y)) : cellValue(y, k);
        return `<td>${v === undefined ? "&mdash;" : v}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    const span = seasonKeys(s);
    seasons = projectionRecordHtml(player) +
      `<p class="section-label">${span.length ? span[0] + " to " + span[span.length - 1] : "Career"}
      &middot; ${scoringLabel()}, 6 points per touchdown</p>
      <div class="tblscroll"><table class="logtbl">
        <thead><tr>${cols.head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  // ---------- depth chart ----------
  const mates = board.filter(function (other) {
    const os = statOf(other);
    return other.team === player.team && os && os.depth;
  });

  let depth;
  if (!mates.length) {
    depth = `<div class="nodata">No depth chart data for ${player.team}.</div>`;
  } else {
    const groups = {};
    mates.forEach(function (m) {
      const g = statOf(m).depth;
      (groups[g] = groups[g] || []).push(m);
    });
    depth = Object.keys(groups).sort().map(function (g) {
      const list = groups[g].sort((a, b) => (statOf(a).order || 9) - (statOf(b).order || 9));
      return `<div class="depthcol"><h5>${g}</h5>` + list.map(function (m) {
        return `<div class="depthrow ${m === player ? "self" : ""}">
            <span class="ord">${statOf(m).order || "&ndash;"}</span>
            <span class="badge ${m.pos}">${posLabel(m.pos)}</span>
            <span>${m.name}</span>
            <span class="rpick">ADP ${m.adp.toFixed(1)}</span>
          </div>`;
      }).join("") + `</div>`;
    }).join("");
    depth += `<p class="method">Only players inside the draftable pool appear here,
      so this is the fantasy-relevant depth chart rather than the full roster.</p>`;
  }

  $("sheetBody").innerHTML = `
    <div class="sheet-view on" id="v-overview">${overview}</div>
    <div class="sheet-view" id="v-news">${newsSlot()}</div>
    <div class="sheet-view" id="v-logs">${logs}</div>
    <div class="sheet-view" id="v-seasons">${seasons}</div>
    <div class="sheet-view" id="v-depth">${depth}</div>`;

  /* Back to Overview on every open. By view name rather than by index: a
     hidden Latest News tab sits second in the strip, so "the first button" and
     "the tab we want" stopped being the same thing. */
  document.querySelectorAll("#sheetTabs button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.view === "v-overview");
  });
  document.querySelectorAll(".sheet-view").forEach(function (v) {
    v.classList.toggle("on", v.id === "v-overview");
  });

  $("sheet").hidden = false;
  $("sheetBackdrop").hidden = false;
  $("sheetBody").scrollTop = 0;

  // After the panel exists in the DOM and after the sheet is on screen: this
  // fills in later, over the network, and must never be something the sheet
  // waits for.
  renderNews(player);
}

function closeSheet() {
  sheetPlayer = null;
  $("sheet").hidden = true;
  $("sheetBackdrop").hidden = true;
}

function render() {
  renderHeader();
  renderTicker();
  renderGrades();
  if (state.started) renderActionBar();
  // The shell is the board and the rail, which only mean anything once a
  // draft is running. Before that the setup screen has the page to itself.
  $("draftShell").hidden = !(route() === "draft" && state.started);

  renderSuggestions();
  renderQueue();
  renderRail();
  // In here rather than only on a broadcast, because the dock has to follow
  // the route: it lives beside the setup screen in the lobby and beside the
  // board once the draft is running. Cheap when there is no room at all.
  renderChat();
  renderPlayers();
  renderBoard();
  renderTeam();
  renderPicks();
  saveDraft();

  /* Last, and after saveDraft(), because it can change which panel is on
     screen and everything above it should have drawn first. One call here
     covers every route to the final pick — your own, the CPU loop,
     auto-drafting the rest, and a room broadcasting that it is done. */
  checkDraftFinished();
}


/* ---- 11c. Saving and resuming --------------------------

   The whole draft is a slot, a clock length, a random seed
   and an ordered list of player names. That is small enough
   to keep in the browser, so a refresh no longer destroys a
   draft in progress.                                       */

const SAVE_KEY = "alpine-draft-room-v1";

// Every setting that changes the shape of the board, in one string. Two
// drafts with the same fingerprint can be swapped; two without cannot,
// because the snake maths, the round count and the ADP set all differ.
function settingsFingerprint(cfg) {
  // `|| 0` rather than the bare value: a draft saved before superflex existed
  // has no such key, and it was a league with no superflex, so reading it as
  // zero is both the correct shape and what keeps that save resumable.
  return [cfg.teams, cfg.rounds, cfg.scoring, cfg.flex, cfg.superflex || 0, cfg.bench]
    .concat(POSITIONS.map((pos) => cfg.starters[pos]))
    .join("-");
}

// Turned back into something a human can read, for the refusal message.
function settingsText(cfg) {
  return `${cfg.teams} teams · ${cfg.rounds} rounds · ${scoringLabel(cfg.scoring)}`;
}

function saveDraft() {
  if (!state.started) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 2,
      mySlot: state.mySlot,
      clockLength: state.clockLength,
      paused: state.paused,
      seed: state.seed,
      // Stored whole, not just as a fingerprint, so the resume banner can
      // describe the saved league and the refusal can name what it wants.
      league: JSON.parse(JSON.stringify(league)),
      fingerprint: settingsFingerprint(league),
      picks: state.picks.map((p) => p.player.name),
      queue: state.queue.slice(),
      watchlist: state.watchlist.slice(),
      savedAt: Date.now()
    }));
  } catch (err) {
    // Private browsing and full quotas both land here. Losing the save is
    // not worth breaking the draft over.
  }
}

// Version 1 saves carry no league at all and were all ten-team, fourteen
// round, half PPR. Rather than guess, they are simply not resumable.
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!(data && data.v === 2 && data.picks && data.league)) return null;
    // A save written before superflex existed has no such key, and every
    // sum that reads it would come out NaN. It was a league without one,
    // so fill in what it actually was rather than refusing the save.
    if (data.league.superflex === undefined) data.league.superflex = 0;
    return data;
  } catch (err) {
    return null;
  }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
}

function resumeDraft(data) {
  // Resuming into different settings would corrupt the board: the snake turns
  // in different places, the rounds run out at a different pick, and a full
  // PPR board is not in the same order. Refuse, but keep the save, because
  // unlike a stale player list this one is fixed by setting the dropdowns back.
  if (data.fingerprint !== settingsFingerprint(league)) {
    alert("That draft was a " + settingsText(data.league) + " league, and the " +
          "setup screen is currently set to " + settingsText(league) + ".\n\n" +
          "Set it back to match and the draft will resume. Nothing has been lost.");
    return;
  }

  // The player list is regenerated every morning. If a saved pick no longer
  // resolves, the board would be corrupt, so refuse rather than half-restore.
  const resolved = data.picks.map((name) => board.find((p) => p.name === name));
  if (resolved.some((p) => !p)) {
    clearSave();
    alert("That draft could not be restored because the player list has been " +
          "updated since it was saved. Starting fresh.");
    showResumeBar();
    return;
  }

  state.mySlot = data.mySlot;
  state.clockLength = data.clockLength;
  state.paused = !!data.paused;
  state.seed = data.seed;
  state.started = true;

  applyJitter();
  board.forEach((p) => { p.drafted = false; });
  state.picks = [];
  resolved.forEach(function (player) { makePick(player); });

  // Saves written before the queue existed have no such key, and a plan is
  // worth restoring rather than refusing a draft over. pruneQueue() drops
  // anyone taken while the tab was closed, or dropped from the feed since.
  state.queue = Array.isArray(data.queue) ? data.queue.slice() : [];
  pruneQueue();
  // Not pruned the way the queue is — a watchlist entry that's since been
  // drafted is exactly the kind of thing worth still seeing on reopen.
  state.watchlist = Array.isArray(data.watchlist) ? data.watchlist.slice() : [];

  tabrow.hidden = false;
  $("resumeBar").hidden = true;

  /* A finished draft reopens on its analysis, not on suggestions — the
     landing page called it "your finished draft", so the reason to reopen
     one is to look at the result, and the suggestion list is exhausted by
     then anyway. An unfinished one picks up where it left off. */
  if (draftOver()) {
    revealAnalysis();
  } else {
    showPanel("tab-suggest");
    document.querySelectorAll(".tabs button").forEach((b, i) => b.classList.toggle("on", i === 0));
  }

  // Seeded before the render below, so reopening a finished board is not
  // read as one that has only just finished.
  noteDraftPhase();

  resetClock();
  render();
  window.scrollTo(0, 0);
}


/* ---- 11d. Draft history ---------------------------------

   The Locker's data: one entry per draft that has actually finished, kept
   next to the single save above it but never overwritten by it — a save is
   the one draft you could still be sitting in, history is everything you've
   already walked away from. Same browser-local storage, same reason: there
   is no account and no server copy of either. */

const HISTORY_KEY = "juke.draft-history.v1";
const HISTORY_LIMIT = 25;

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

function writeHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (err) {}
}

// Fired from the same edge revealAnalysis() is — "just became over", not
// "is over" — so reopening an already-finished draft (Resume, or the Locker
// itself) never records it a second time. The grade is computed and stored
// now, while board/league/state are still the ones this draft was actually
// played on: recomputing it later would mean rebuilding a whole historical
// board — a different ADP set, a different snake shape — just to draw one
// card in a list.
function recordHistory() {
  const mine = analyseDraft()[state.mySlot];
  const round1 = state.picks.find((p) => p.slot === state.mySlot && p.round === 1);
  const list = readHistory();
  list.unshift({
    id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    completedAt: Date.now(),
    mySlot: state.mySlot,
    clockLength: state.clockLength,
    seed: state.seed,
    league: JSON.parse(JSON.stringify(league)),
    // Names, not player objects — same reason saveDraft() stores them this
    // way: the board is rebuilt from tonight's data on every load, so a held
    // reference would go stale while a name can be re-resolved.
    picks: state.picks.map((p) => p.player.name),
    projectedRank: mine ? mine.rank : null,
    round1Pick: round1 ? round1.player.name : null
  });
  writeHistory(list.slice(0, HISTORY_LIMIT));
}

// What a Locker card actually shows, derived rather than stored, so a label
// can never drift from the function that already knows how to say it —
// scoringLabel() and ordinal() are the same lookups the setup screen and
// the board already use.
// "10-Team Half PPR" — one place for this, so the finished-draft cards
// below and the one still-in-progress card (which has no history entry to
// read it from) can never print it two different ways.
function leagueTypeLabel(cfg) {
  return cfg.teams + "-Team " + scoringLabel(cfg.scoring);
}

function historySummary(entry) {
  return {
    id: entry.id,
    leagueType: leagueTypeLabel(entry.league),
    pickPosition: ordinal(entry.mySlot + 1),
    dateCompleted: new Date(entry.completedAt)
      .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }),
    projectedRank: entry.projectedRank ? ordinal(entry.projectedRank) : "—",
    round1Pick: entry.round1Pick || null
  };
}

// The Locker's "In progress" card. Null once there's nothing to resume, or
// once the one save slot has actually finished — that draft already has its
// own entry in history by the time this is asked, and showing it here too
// would put the same draft behind two different buttons in two different
// tabs of the same panel.
function inProgressSummary() {
  const data = readSave();
  if (!data || !data.picks || !data.picks.length) return null;
  const total = data.league.teams * data.league.rounds;
  if (data.picks.length >= total) return null;
  return {
    leagueType: leagueTypeLabel(data.league),
    pickPosition: ordinal(data.mySlot + 1),
    made: data.picks.length,
    total: total
  };
}

// Resumes the one saved draft from the Locker. resumeDraft() below refuses
// unless the live league already matches the save's fingerprint — a rule
// that made sense when the same screen held both the dropdowns and the
// Resume button, so a person could be told to set them back. The Locker has
// no dropdowns of its own to blame, so this forces `league` to the save's
// own shape first (the one real league object, same as setLeague() and
// openHistoryDraft()) and rebuilds the board against it — after which
// resumeDraft()'s own fingerprint check is comparing a league against
// itself and always passes, so its refusal branch is simply never reached
// from here.
function resumeSavedDraft() {
  const data = readSave();
  if (!data) return false;
  Object.assign(league, JSON.parse(JSON.stringify(data.league)));
  if (league.superflex === undefined) league.superflex = 0;
  buildBoard();
  resumeDraft(data);
  return true;
}

// Reopens a finished draft from the Locker onto the Analysis tab. Unlike
// resumeDraft() above, this never refuses on a settings mismatch — there is
// no "change the dropdowns to match" step for a history card, it just opens
// — so it forces `league` to the shape the draft was actually played under
// first (the one real league object, same as setLeague()), then rebuilds
// the board against it before touching anything else live.
function openHistoryDraft(id) {
  const entry = readHistory().find((h) => h.id === id);
  if (!entry) return false;

  const entryLeague = JSON.parse(JSON.stringify(entry.league));
  if (entryLeague.superflex === undefined) entryLeague.superflex = 0;

  // Checked against the entry's own ADP set before anything live changes —
  // the player list is regenerated every morning, and a name that has since
  // fallen off the board must not leave the real setup screen half-mutated
  // on the way to failing.
  const set = (typeof ADP_SETS !== "undefined" &&
    (ADP_SETS[entryLeague.scoring] || ADP_SETS[DEFAULT_SET])) || PLAYERS;
  const names = new Set(set.map((p) => p.name));
  if (entry.picks.some((name) => !names.has(name))) {
    alert("That draft could not be reopened because the player list has " +
          "changed since it finished.");
    return false;
  }

  Object.assign(league, entryLeague);
  buildBoard();
  const resolved = entry.picks.map((name) => board.find((p) => p.name === name));

  state.mySlot      = entry.mySlot;
  state.clockLength = entry.clockLength;
  state.paused      = false;
  state.seed        = entry.seed;
  state.started     = true;

  applyJitter();
  state.picks = [];
  resolved.forEach(function (player) { makePick(player); });
  state.queue = [];
  state.watchlist = [];

  tabrow.hidden = false;
  revealAnalysis();
  // Seeded before the render below, so reopening a finished board is not
  // read as one that has only just finished — same reason resumeDraft() does
  // this in the same order.
  noteDraftPhase();
  resetClock();
  render();
  window.scrollTo(0, 0);
  return true;
}

function showResumeBar() {
  const bar = $("resumeBar");
  const data = readSave();
  if (!data || !data.picks.length) { bar.hidden = true; return; }

  // Described in the saved league's own terms, not the one on screen, so a
  // mismatch is visible before the Resume button is ever pressed.
  const saved = data.league;
  const total = saved.teams * saved.rounds;
  const made = data.picks.length;
  const round = Math.min(saved.rounds, Math.floor(made / saved.teams) + 1);
  const when = new Date(data.savedAt);
  const done = made >= total;
  const matches = data.fingerprint === settingsFingerprint(league);

  bar.hidden = false;
  bar.innerHTML = `
    <h4>${done ? "Finished draft saved" : "Draft in progress"}</h4>
    <p>Slot ${data.mySlot + 1} &middot; ${made} of ${total} picks
       ${done ? "" : "&middot; round " + round} &middot; saved
       ${when.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
    <p>${settingsText(saved)}${matches ? "" : " &middot; does not match the settings below"}</p>
    <div class="btnrow">
      <button class="primary" id="resumeBtn">${done ? "Reopen it" : "Resume"}</button>
      <button class="ghost" id="discardBtn">Discard</button>
    </div>`;
}


/* ---- 12. Tabs ------------------------------------------ */

function showPanel(id) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("on"));
  $(id).classList.add("on");
}


/* ---- 13. The setup screen ------------------------------

   The controls write into `league`, and everything else in
   the file reads from it. The board is rebuilt on every
   change so the player count in the header, and the ADP the
   Players tab shows, always match what is selected.        */

const suffix = ["th", "st", "nd", "rd"];
const slotSelect = $("draftSlot");

// Fill a select from a list of values. The label carries the position, so
// each control says what it is without needing a label of its own.
function fillList(select, values, chosen, labeller) {
  select.innerHTML = values.map((v) =>
    `<option value="${v}"${v === chosen ? " selected" : ""}>${labeller(v)}</option>`
  ).join("");
}

// Every contiguous range in the setup screen goes through the list version,
// so there is one place that knows how to build an option.
function fillRange(select, from, to, chosen, labeller) {
  const values = [];
  for (let i = from; i <= to; i++) values.push(i);
  fillList(select, values, chosen, labeller);
}

// Team counts are even, because a snake draft with an odd number of seats is
// a shape no real league uses and every one of these adds a column to the
// board. Sleeper offers the same set up to 24 and then jumps to 32; ours
// stops at 24 for a reason the setup screen explains when you get there —
// the ADP feed carries roughly 210 to 260 players, and 32 seats cannot fill
// even eight rounds out of that.
const TEAM_COUNTS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

function ordinal(i) {
  const s = (i % 100 > 10 && i % 100 < 14) ? "th" : (suffix[i % 10] || "th");
  return i + s;
}

// The draft position dropdown has to be rebuilt whenever the team count
// changes, and the slot kept if it still exists in the smaller league.
// Slots are 0-indexed everywhere else, so the option values are too, and
// only the label is counted from one.
function fillSlotOptions() {
  const keep = Math.min(Number(slotSelect.value || 0), league.teams - 1);
  fillRange(slotSelect, 0, league.teams - 1, keep, (i) => ordinal(i + 1));
  slotSelect.value = keep;
}

const SLOT_LIMITS = { QB: 2, RB: 4, WR: 5, TE: 3, K: 2, DST: 2 };

/* ---- the scoring editor ----

   Fields are generated from the rule table rather than written out in the
   markup, so a rule added to DEFAULT_RULES appears here automatically and
   the two can never disagree about what exists.                          */

const RULE_GROUPS = [
  ["Passing",  ["pass_yd", "pass_td", "pass_int", "pass_2pt",
                "pass_att", "pass_cmp", "pass_fd"]],
  ["Rushing",  ["rush_yd", "rush_td", "rush_2pt", "rush_fd"]],
  ["Receiving", ["rec", "rec_yd", "rec_td", "rec_2pt", "rec_fd", "rec_40p"]],
  ["Turnovers and returns", ["fum_lost", "kr_td", "pr_td"]],
  ["Kicking",  ["xpm", "xpmiss", "fgmiss", "fgm_0_19", "fgm_20_29",
                "fgm_30_39", "fgm_40_49", "fgm_50_59", "fgm_60p"]],
  ["Defense and special teams",
               ["sack", "int", "fum_rec", "safe", "def_td", "def_st_td",
                "blk_kick", "def_2pt"]],
  ["Points allowed by a defense",
               ["pts_allow_0", "pts_allow_1_6", "pts_allow_7_13",
                "pts_allow_14_20", "pts_allow_21_27", "pts_allow_28_34",
                "pts_allow_35p"]]
];

const RULE_LABELS = {
  pass_yd: "Per passing yard", pass_td: "Passing TD",
  pass_int: "Interception thrown", pass_2pt: "Passing 2-pt",
  pass_att: "Per pass attempt", pass_cmp: "Per completion",
  pass_fd: "Passing first down",
  rush_yd: "Per rushing yard", rush_td: "Rushing TD", rush_2pt: "Rushing 2-pt",
  rush_fd: "Rushing first down",
  rec: "Per reception", rec_yd: "Per receiving yard",
  rec_td: "Receiving TD", rec_2pt: "Receiving 2-pt",
  rec_fd: "Receiving first down", rec_40p: "Catch of 40+ yards",
  fum_lost: "Fumble lost", kr_td: "Kick return TD", pr_td: "Punt return TD",
  xpm: "Extra point", xpmiss: "Extra point missed", fgmiss: "Field goal missed",
  fgm_0_19: "FG 0–19", fgm_20_29: "FG 20–29", fgm_30_39: "FG 30–39",
  fgm_40_49: "FG 40–49", fgm_50_59: "FG 50–59", fgm_60p: "FG 60+",
  sack: "Sack", int: "Interception", fum_rec: "Fumble recovered",
  safe: "Safety", def_td: "Defensive TD", def_st_td: "Special teams TD",
  blk_kick: "Blocked kick", def_2pt: "2-pt return",
  pts_allow_0: "Shutout", pts_allow_1_6: "1–6 allowed",
  pts_allow_7_13: "7–13 allowed", pts_allow_14_20: "14–20 allowed",
  pts_allow_21_27: "21–27 allowed", pts_allow_28_34: "28–34 allowed",
  pts_allow_35p: "35+ allowed"
};

// Rebuilt only when the values change underneath the user — on load, on a
// reset, and when the format preset moves the reception rule. Never on every
// keystroke, because that would steal focus mid-edit.
// True when the 2026 forecast actually carries this stat. The set is measured
// by the pipeline rather than written down here, so it stays honest the
// season Sleeper starts or stops projecting something. Missing file, or an
// older stats.js without the list, means we cannot tell — and claiming a rule
// is history-only when it is not would be worse than saying nothing.
function movesProjection(rule) {
  if (typeof PROJECTED_KEYS === "undefined") return true;
  return PROJECTED_KEYS.indexOf(rule) >= 0;
}

/* Yardage rules are the ones nobody thinks about as a multiplier. A league
   says "a point every 25 yards", not "0.04 a yard", and asking for 0.04 is
   how you get 0.4 typed by mistake and a quarterback projected for three
   thousand points. So these three take the divisor and show the multiplier
   underneath, which is the number the scoring engine actually uses. */
const PER_YARD_RULES = ["pass_yd", "rush_yd", "rec_yd"];

// 25 yards a point reads back as 0.04 exactly; a third of a yard does not.
// Four decimals is past the precision the raw data arrives in, so rounding
// there cannot lose a rule anyone would write.
function pointsFromDivisor(yards) {
  const n = Number(yards);
  if (!n || n <= 0 || !isFinite(n)) return 0;
  return Math.round((1 / n) * 10000) / 10000;
}

// The divisor that produced a multiplier, for redrawing the control. Blank
// rather than Infinity when the rule scores nothing, because "every 0 yards"
// is not a thing a person can read.
function divisorFromPoints(points) {
  const n = Number(points);
  if (!n || n <= 0 || !isFinite(n)) return "";
  return Math.round((1 / n) * 100) / 100;
}

function renderScoringFields() {
  $("scoringFields").innerHTML = RULE_GROUPS.map(function (group) {
    const rows = group[1].map(function (rule) {
      // A rule Sleeper does not forecast still scores every past season and
      // every week-by-week line correctly. It just adds nothing to the 2026
      // projection, which is what the board is ranked on — so the editor
      // says so on the rule itself rather than in a paragraph underneath
      // that nobody reads while they are editing a number.
      const history = !movesProjection(rule);
      const tip = history
        ? ' title="Sleeper does not forecast this stat. The rule scores past seasons and weekly logs, but adds nothing to the 2026 projection the board is ranked on."'
        : "";
      const mark = history ? '<i class="past">past only</i>' : "";

      if (PER_YARD_RULES.indexOf(rule) >= 0) {
        return `<label class="rule per-yard${history ? " history-only" : ""}"${tip}>
            <span>${RULE_LABELS[rule] || rule}${mark}</span>
            <span class="divisor">
              <i>1 pt every</i>
              <input type="number" step="1" min="1" data-divisor="${rule}"
                     value="${divisorFromPoints(league.rules[rule])}">
              <i>yds</i>
              <b>${league.rules[rule] || 0} per yard</b>
            </span>
          </label>`;
      }

      return `<label class="rule${history ? " history-only" : ""}"${tip}>
          <span>${RULE_LABELS[rule] || rule}${mark}</span>
          <input type="number" step="0.01" data-rule="${rule}" value="${league.rules[rule]}">
        </label>`;
    }).join("");
    return `<p class="section-label">${group[0]}</p><div class="rulegrid">${rows}</div>`;
  }).join("") +
  `<p class="hint">Historical seasons and weeks carry every stat above.
   Sleeper's projections are coarser, so anything marked <i class="past">past only</i>
   scores a player's record correctly and adds nothing to his 2026 projection
   &mdash; which is what this board is ranked on.</p>`;

  /* These inputs are new elements every time, so a lock set on the last set of
     them has just been thrown away. Re-applied here rather than at the call
     sites: this function is called from five places and one of them forgetting
     is a scoring editor that quietly works again in somebody else's room. */
  if (typeof Live !== "undefined" && Live.room()) lockScoring(true);
}

/* Read off the rules rather than off league.scoring, and deliberately: the
   scoring editor can set points per catch to anything, and a league that has
   been edited to 0.75 is not any of the three named formats. So the name is
   used when the number matches one exactly, and the number speaks for itself
   when it does not. */
function scoringSummary() {
  const r = league.rules;
  const format = Object.keys(REC_BY_FORMAT)
    .filter(function (k) { return REC_BY_FORMAT[k] === r.rec; })[0];
  const rec = format ? SCORING_NAMES[format] : r.rec + " per catch";
  return `${rec} · ${r.pass_td} pt passing TD · ${r.rush_td} pt rushing TD`;
}

/* What the League box says while it is shut. Built from `league` like
   everything else, so it cannot describe a different league from the one the
   controls inside it hold — the same reason scoringSummary() exists. */
function leagueSummary() {
  // scoringLabel(), not SCORING_NAMES directly — the same lookup with the
  // same fallback already exists and drifting from it is how the dropdown
  // and the scoring summary once disagreed about the same league.
  return `${league.teams} teams · ${league.rounds} rounds · ${scoringLabel()}`;
}

function fillSetupControls() {
  fillList($("teamCount"), TEAM_COUNTS, league.teams, (i) => i + " teams");
  // Filled from SCORING_NAMES rather than written into the markup, so the
  // dropdown cannot drift from the labels the rest of the app prints.
  fillList($("scoring"), Object.keys(SCORING_NAMES), league.scoring,
           (k) => SCORING_NAMES[k]);
  fillRange($("roundCount"), 8, 20, league.rounds, (i) => i + " rounds");
  POSITIONS.forEach(function (pos) {
    const label = posLabel(pos);
    fillRange($("start" + pos), 0, SLOT_LIMITS[pos], league.starters[pos],
              (i) => label + " " + i);
  });
  fillRange($("startFLEX"), 0, 3, league.flex, (i) => "FLEX " + i);
  fillRange($("startSFLEX"), 0, 2, league.superflex, (i) => "SFLEX " + i);
  fillRange($("benchCount"), 0, 12, league.bench, (i) => "BN " + i);
  fillSlotOptions();
}

// Tracks the format across reads, so the reception preset applies once when
// the dropdown moves rather than on every refresh.
let lastFormat = league.scoring;

// Read every control into `league`. Called on any change, so the object is
// the single description of the league from that moment on.
function readSetup() {
  league.teams   = Number($("teamCount").value);
  league.rounds  = Number($("roundCount").value);
  league.scoring = $("scoring").value;
  // The format preset owns exactly one rule, and only at the moment it
  // changes. Applying it on every read would overwrite a hand-edited
  // reception value the instant anything else on the screen moved.
  if (league.scoring !== lastFormat) {
    league.rules.rec = REC_BY_FORMAT[league.scoring];
    lastFormat = league.scoring;
    renderScoringFields();
  }
  league.flex      = Number($("startFLEX").value);
  league.superflex = Number($("startSFLEX").value);
  league.bench   = Number($("benchCount").value);
  POSITIONS.forEach(function (pos) {
    league.starters[pos] = Number($("start" + pos).value);
  });
}

/* Two ways a league can be impossible rather than merely unusual:
   the roster does not add up to the rounds being drafted, or the draft
   wants more players than the ADP set actually carries. Either one is
   reported here and blocks the start rather than failing mid-draft. */
function setupProblem() {
  const filled = rosterSize();
  if (filled !== league.rounds) {
    return `${starterCount()} starters + ${flexCount()} FLEX + ${league.bench} bench ` +
           `= ${filled} roster spots, but the draft runs ${league.rounds} rounds.`;
  }
  if (totalPicks() > poolSize()) {
    return `${league.teams} teams over ${league.rounds} rounds is ${totalPicks()} picks, ` +
           `and the ${league.scoring === "half" ? "half PPR" : league.scoring} board only ` +
           `carries ${poolSize()} players.`;
  }
  return "";
}

function refreshSetup() {
  if (state.started) return;
  readSetup();
  fillSlotOptions();

  const problem = setupProblem();
  const note = $("rosterSum");
  note.textContent = problem ||
    `${starterCount()} starters + ${flexCount()} FLEX + ${league.bench} bench ` +
    `= ${league.rounds} rounds, ${totalPicks()} picks.`;
  note.classList.toggle("bad", !!problem);
  $("startBtn").disabled = !!problem;
  $("scoringSummary").textContent = scoringSummary();
  $("leagueSummary").textContent = leagueSummary();

  /* The League box is shut by default, and everything that can refuse the
     Start button lives inside it. So the reason is repeated next to the
     button, and the box is opened so the control that needs changing is
     actually on screen — a disabled button whose explanation is folded away
     is worse than the wall of controls the box replaced.

     Opened, never closed: once somebody has it open they are working in it,
     and having it shut itself the moment the arithmetic came right would
     take the screen away mid-edit. */
  const msg = $("setupProblemMsg");
  msg.textContent = problem;
  msg.hidden = !problem;
  if (problem) $("leagueBox").open = true;

  // Scoring decides which ADP set the board comes from, so it has to be
  // rebuilt here rather than only when the draft starts.
  buildBoard();
  showResumeBar();
  render();
}

fillSetupControls();
renderScoringFields();

// Delegated, and on change rather than input, so the board is rebuilt when a
// value is committed instead of on every keystroke.
$("scoringFields").addEventListener("change", function (e) {
  const data = e.target.dataset;
  if (!data) return;

  // A yardage field carries the divisor a league actually says out loud;
  // the engine wants the multiplier, so it is converted on the way in and
  // the fields are redrawn so the "per yard" line under it stays true.
  if (data.divisor) {
    league.rules[data.divisor] = pointsFromDivisor(e.target.value);
    renderScoringFields();
    refreshSetup();
    return;
  }

  if (!data.rule) return;
  const value = Number(e.target.value);
  league.rules[data.rule] = isNaN(value) ? 0 : value;
  refreshSetup();
});

$("resetScoring").addEventListener("click", function () {
  league.rules = rulesForFormat(league.scoring);
  renderScoringFields();
  refreshSetup();
});

["teamCount", "roundCount", "scoring", "startFLEX", "startSFLEX", "benchCount"]
  .concat(POSITIONS.map((pos) => "start" + pos))
  .forEach(function (id) {
    $(id).addEventListener("change", refreshSetup);
  });

// PLAYERS_META only exists once players.js has been generated, so
// check for it rather than assuming.
(function showFreshness() {
  const note = $("freshness");
  if (typeof PLAYERS_META === "undefined") { note.textContent = ""; return; }
  const flagged = PLAYERS_META.flagged
    ? " \u00b7 " + PLAYERS_META.flagged + " injury designations"
    : "";
  note.textContent = PLAYERS_META.count + " players \u00b7 data " +
                     PLAYERS_META.generated + flagged;
})();

/* ---- the invite panel ----------------------------------- */

/* The controls a room owns once you are in one. Named here so locking and
   unlocking cannot drift apart — the bug that shipped first was exactly
   that: one path set them, the other returned before clearing them.

   This was five controls, and the shape of a league is far more than five.
   The starting lineup, the bench and all thirty-eight scoring rules were left
   open, and every one of them runs refreshSetup() → readSetup() → buildBoard()
   — so a manager who had joined somebody else's room could rebuild their own
   board out from under it. Nothing about it looked wrong on screen: their
   replacement levels, suggestions and grade simply stopped describing the
   draft everybody else was in, and adoptRoom() could not put it back, because
   a room only broadcasts the league it was created with.

   Locked for the host too, not only for joiners. The CPU wobble reads a
   player's position on the board and every client has to reach the same
   answer, so the shape is fixed the moment the room exists — for whoever made
   it as much as for whoever joined. Changing it means a new room. */
const LOCKABLE = ["teamCount", "roundCount", "scoring", "pickClock", "draftSlot",
                  "startFLEX", "startSFLEX", "benchCount"]
  .concat(POSITIONS.map((pos) => "start" + pos));

/* The scoring editor is thirty-eight fields drawn by renderScoringFields(),
   so it is locked by sweeping it rather than by name. Re-queried each time,
   because those inputs are rebuilt whenever a rule changes. */
function lockScoring(locked) {
  $("scoringFields").querySelectorAll("input, select").forEach(function (field) {
    field.disabled = locked;
  });
  $("resetScoring").disabled = locked;
}

/* What a room is called: its host, or its invite code until they have typed a
   name. Nothing is stored for it — the room derives it from the host's member
   record, which is a name they have already given and the room has already
   cleaned, so it follows them if they rename themselves.

   The box's own label carries it, rather than a heading of its own. That label
   is the first line of the panel and it is where a joiner was reading the
   settings of whatever room they had last made, which is what made a room feel
   like the wrong one. */
function roomTitle(room) {
  if (!room) return "Draft with friends";
  if (room.hostName) return room.hostName + "'s Draft Room";
  return Live.state().code ? "Draft Room " + Live.state().code : "The Draft Room";
}

/* Setting the draft order. Which seat the host has picked up, and nothing
   else — the swap itself is the room's to perform, and the seat list only
   moves when it says so, exactly as the board does for a pick.

   Declared above renderInvite() rather than beside its handlers, because a
   `const` is in its temporal dead zone until the line runs and renderInvite()
   reads this one. */
const seatOrder = { held: null };

const STATUS_TEXT = {
  connecting:   "Connecting…",
  reconnecting: "Reconnecting to the room — your seat is held.",
  closed:       "Lost the connection. Reopen the link to rejoin — your seat is held.",
  rejected:     "Could not join."
};

const REJECT_TEXT = {
  "stale-data": "This room started on an older player list than the one you have. " +
                "Whoever created it should reload the page and make a new room.",
  "bad-league": "That room could not be created. Check the league settings and try again."
};

function renderInvite() {
  const box = $("inviteLive");
  const startRow = $("inviteStart");

  /* No worker to talk to yet. Better to say so than to offer a button
     that opens a socket into nothing, which fails as a connection that
     never arrives and reads exactly like a bug. */
  if (typeof Live === "undefined" || !Live.configured()) {
    box.hidden = true;
    startRow.hidden = true;
    $("inviteHint").textContent =
      "Not set up yet. Drafting with friends needs the room deployed once — " +
      "see worker/README.md. Solo mock drafts are unaffected.";
    return;
  }

  const room = typeof Live === "undefined" ? null : Live.room();
  const status = typeof Live === "undefined" ? "off" : Live.status();

  // Locking is undone here as well as set below, because leaving a room
  // comes through this branch and an early return left every control
  // disabled with nothing on screen explaining why.
  // The summary of the Draft with friends box, which is where the old
  // <label> went when that section was collapsed.
  const label = $("friendsTitle");

  // A host who has just made a room came here to send a link, so the box
  // opens itself rather than making them go and find it. Only ever opened:
  // somebody who closes it mid-room has said something, and reopening it on
  // the next broadcast would be an argument rather than a feature.
  if (status !== "off") $("friendsBox").open = true;

  if (status === "off") {
    box.hidden = true;
    startRow.hidden = false;
    label.textContent = roomTitle(null);
    LOCKABLE.forEach(function (id) { $(id).disabled = false; });
    lockScoring(false);
    $("startBtn").disabled = false;
    $("startBtn").textContent = "Start your draft";
    return;
  }

  startRow.hidden = true;
  box.hidden = false;
  label.textContent = roomTitle(room);
  $("inviteLink").value = Live.link() || "";

  const reason = Live.reason();
  let text = STATUS_TEXT[status] || "";
  if (reason && REJECT_TEXT[reason]) text = REJECT_TEXT[reason];

  /* Draft order is the host's, and only while the room is still filling up.
     Once a pick exists the snake order is what those picks *mean*, so moving a
     chair would rewrite whose they were. */
  const canOrder = !!room && room.isHost && room.status === "lobby";

  if (status === "open" && room) {
    const taken = room.seats.filter((s) => s.taken).length;
    text = taken === 1
      ? "You are the only one here. The other " + (room.seats.length - 1) +
        " seats will be drafted by the CPU unless somebody takes them."
      : taken + " of " + room.seats.length + " seats taken. The rest are CPU.";
    if (room.status !== "lobby") text = "Drafting. " + text;
    if (canOrder) {
      text += seatOrder.held === null
        ? " Drag a seat, or tap two, to set the draft order."
        : " Now tap the seat to swap it with.";
    }
  }
  $("inviteStatus").textContent = text;

  /* A seat's name is typed by a person, so it is escaped exactly as a chat
     message is. This list used to be safe by accident — every chair said
     "Manager" or "CPU", both of which we wrote — and stopped being the moment
     names became real. Names are not a display detail; they are the second
     piece of text on this page that somebody else wrote.

     For the host it is a row of buttons rather than a row of spans. Draggable
     for a mouse, and tap-one-then-tap-another for a phone — the host is very
     often on one, and HTML5 drag and drop does not exist on touch at all, so
     the drag alone would be a feature that works on the machine it was built
     on and nowhere else. Both paths end at the same swap. */
  $("seatList").innerHTML = !room ? "" : room.seats.map(function (s) {
    const who = s.you ? "You" : s.taken ? escHtml(s.name || "Manager") : "CPU";
    const kind = s.you ? "you" : s.taken ? "human" : "";

    if (!canOrder) {
      return `<span class="seat ${kind}"><b>${s.index + 1}</b>${who}</span>`;
    }

    const held = seatOrder.held === s.index;
    return `<button type="button" class="seat ${kind} movable${held ? " held" : ""}"
        draggable="true" data-seat="${s.index}" aria-pressed="${held}"
        aria-label="Seat ${s.index + 1}, ${who}. Tap to move.">
        <b>${s.index + 1}</b>${who}</button>`;
  }).join("");

  /* The room owns the shape once you are in one, so the controls that would
     change it out from under everybody are locked rather than lying.

     Being in a room is `room`, not `status === "open"`. A socket that has
     dropped is being reconnected and the room is still there — and the
     difference matters far more than it looks, because this is also what the
     start button reads. Keyed on the socket, a phone that had been backgrounded
     for ten seconds came back with every control unlocked and a button
     offering to start a draft, and the button meant the solo one. */
  const locked = !!room;
  LOCKABLE.forEach(function (id) { $(id).disabled = locked; });
  lockScoring(locked);

  const startBtn = $("startBtn");
  if (!locked) {
    startBtn.textContent = "Start your draft";
    startBtn.disabled = false;
  } else if (status !== "open") {
    // Nothing can be started while the room cannot hear us, and a button that
    // says otherwise is the one that started a private draft nine people were
    // waiting on.
    startBtn.textContent = "Reconnecting…";
    startBtn.disabled = true;
  } else {
    startBtn.textContent = room.isHost
      ? "Start the draft for everyone"
      : "Waiting for the host…";
    startBtn.disabled = !room.isHost;
  }
}

function joinRoom(code, asHost) {
  Live.onChange(onRoomChange);
  Live.onTyping(onRoomTyping);
  Live.connect(code, {
    // Null means "use the stored one", which live.js does. Typing a name into
    // the setup screen before creating a room is the normal way round.
    name: null,
    league: asHost ? JSON.parse(JSON.stringify(league)) : {},
    clock: asHost ? league.clockLength || Number($("pickClock").value) : 0,
    dataVersion: (typeof PLAYERS_META !== "undefined" && PLAYERS_META.generated) || ""
  });
  renderInvite();
}

$("createRoomBtn").addEventListener("click", function () {
  readSetup();
  if (setupProblem()) { refreshSetup(); return; }
  const code = Live.newCode();
  // The code goes in the address bar as well as the box, so the browser's
  // own share and bookmark both do the right thing.
  location.hash = "#/draft?room=" + code;
  joinRoom(code, true);
});

function seatAt(target) {
  const button = target && target.closest && target.closest(".seat[data-seat]");
  return button ? Number(button.dataset.seat) : null;
}

function swapSeatsTo(index) {
  if (index === null || seatOrder.held === null) return;
  if (index !== seatOrder.held) Live.swapSeats(seatOrder.held, index);
  seatOrder.held = null;
  // Drawn now rather than waiting for the broadcast, so the seat lets go under
  // the finger. A rejected swap is corrected by the state that follows.
  renderInvite();
}

/* Delegated from document, because renderInvite() rebuilds every one of these
   buttons on every broadcast — a chat message included — and a listener
   attached to one of them would be thrown away seconds after it was set. */
document.addEventListener("click", function (e) {
  const index = seatAt(e.target);
  if (index === null) return;

  if (seatOrder.held === null || seatOrder.held === index) {
    // Tapping the held seat again puts it back down rather than swapping it
    // with itself, which is the only way out of a tap you did not mean.
    seatOrder.held = seatOrder.held === index ? null : index;
    renderInvite();
    return;
  }
  swapSeatsTo(index);
});

document.addEventListener("dragstart", function (e) {
  const index = seatAt(e.target);
  if (index === null) return;
  seatOrder.held = index;
  /* Firefox will not start a drag at all unless something is set, and the
     seat index goes in as well as being held above so a drag that somehow
     outlives this page's state still knows what it is carrying. */
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", String(index)); } catch (err) {}
  }
  renderInvite();
});

// A drop target has to say it is one, and the way to say so is to cancel the
// dragover. Without this the drop event never fires and nothing happens.
document.addEventListener("dragover", function (e) {
  if (seatOrder.held === null || seatAt(e.target) === null) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
});

document.addEventListener("drop", function (e) {
  const index = seatAt(e.target);
  if (index === null || seatOrder.held === null) return;
  e.preventDefault();
  swapSeatsTo(index);
});

// A drag abandoned over the page, or off it. The seat stays picked up for the
// tap path, so this only tidies the drag's own visual state.
document.addEventListener("dragend", function (e) {
  if (seatAt(e.target) !== null) renderInvite();
});

$("copyLinkBtn").addEventListener("click", function () {
  const field = $("inviteLink");
  const button = this;
  const done = function () {
    button.textContent = "Copied";
    setTimeout(function () { button.textContent = "Copy"; }, 1600);
  };
  // The clipboard API needs a secure context, which file:// is not, so the
  // old selection trick stays as the fallback rather than the button doing
  // nothing for anyone who opened the page from disk.
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(field.value).then(done, function () {
      field.select(); document.execCommand("copy"); done();
    });
  } else {
    field.select(); document.execCommand("copy"); done();
  }
});

$("leaveRoomBtn").addEventListener("click", function () {
  Live.disconnect();
  location.hash = "#/draft-room";
  renderInvite();
  renderChat();
  refreshSetup();
});

/* ---- the GIF picker ----
   Searched through the worker, because the GIPHY key is server-side. With no
   key set the worker answers configured:false and this says so rather than
   showing an empty grid that looks like a search with no results. */
let gifTimer = null;

function renderGifs(payload) {
  const holder = $("gifResults");

  if (!payload.configured) {
    holder.innerHTML = `<p class="chatempty">GIFs are not set up for this room yet.</p>`;
    return;
  }
  if (payload.error) {
    holder.innerHTML = `<p class="chatempty">GIPHY did not answer. Try again in a moment.</p>`;
    return;
  }
  if (!payload.results.length) {
    holder.innerHTML = `<p class="chatempty">Nothing found.</p>`;
    return;
  }

  // Every address is checked before it becomes an img src, exactly as the
  // ones arriving over chat are: a reply from the worker is still data.
  holder.innerHTML = payload.results.map(function (g) {
    const url = safeGif(g.url);
    if (!url) return "";
    return `<button type="button" class="gifpick" data-gif="${escHtml(url)}">
        <img src="${escHtml(url)}" alt="${escHtml(g.alt || "GIF")}" loading="lazy">
      </button>`;
  }).join("");
}

$("gifBtn").addEventListener("click", function () {
  const box = $("gifBox");
  box.hidden = !box.hidden;
  if (!box.hidden) {
    $("gifQuery").focus();
    $("gifResults").innerHTML = `<p class="chatempty">Type to search.</p>`;
  }
});

$("gifClose").addEventListener("click", function () { $("gifBox").hidden = true; });

$("gifQuery").addEventListener("input", function () {
  const q = this.value.trim();
  // Debounced, so typing "touchdown" is one search rather than nine.
  if (gifTimer) clearTimeout(gifTimer);
  if (!q) { $("gifResults").innerHTML = `<p class="chatempty">Type to search.</p>`; return; }
  gifTimer = setTimeout(function () {
    Live.gifSearch(q).then(renderGifs);
  }, 350);
});

$("gifResults").addEventListener("click", function (e) {
  const button = e.target.closest ? e.target.closest("[data-gif]") : null;
  if (!button || !inRoom()) return;
  Live.chat($("chatInput").value.trim(), button.dataset.gif);
  $("chatInput").value = "";
  $("gifBox").hidden = true;
});

$("chatForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const field = $("chatInput");
  const text = field.value.trim();
  if (!text || !inRoom()) return;
  Live.chat(text);
  field.value = "";
  // Sending is the clearest possible signal that you have stopped typing.
  chatUI.sentTypingAt = 0;
  Live.typing(false);
  // Kept focused, because a draft chat is a conversation and reaching back
  // for the box between every line is how people stop bothering.
  field.focus();
});

/* Typing, told to the room on a leading edge and then not again for two
   seconds. A message per keystroke would be a message per keystroke for
   everybody else in the room as well, and the thing it conveys — somebody is
   mid-sentence — does not get truer for being repeated. */
$("chatInput").addEventListener("input", function () {
  if (!inRoom()) return;

  if (!this.value) {
    if (chatUI.sentTypingAt) { chatUI.sentTypingAt = 0; Live.typing(false); }
    return;
  }

  const now = Date.now();
  if (now - chatUI.sentTypingAt < 2000) return;
  chatUI.sentTypingAt = now;
  Live.typing(true);
});

// One-tap lines. A draft moves fast enough that typing "nice pick" is often
// more effort than the thought deserves.
$("chatReactions").addEventListener("click", function (e) {
  const button = e.target.closest ? e.target.closest("[data-say]") : null;
  if (!button || !inRoom()) return;
  Live.chat(button.dataset.say);
});

/* ---- reacting to a message ------------------------------

   Delegated from the log, because renderChat() rebuilds all of it on every
   broadcast and a listener attached to a message would not survive the next
   thing anybody said. */
$("chatLog").addEventListener("click", function (e) {
  if (!e.target.closest || !inRoom()) return;

  /* An existing chip, or one in the picker: pressing it adds yours, pressing
     it again takes it back. Closing here rather than leaving it to the
     rebuild, because the click that chose the emoji is inside the picker and
     so does not reach the dismiss handler below. */
  const chip = e.target.closest("[data-react]");
  if (chip) {
    Live.react(Number(chip.dataset.react), chip.dataset.emoji);
    closeReactPicker();
    return;
  }

  const add = e.target.closest("[data-addreact]");
  if (add) { openReactPicker(add); return; }
});

/* The little row of faces that opens off a message. Built on demand and
   thrown away on the next click anywhere, rather than rendered into every
   message — a hundred and forty messages would mean eight hundred buttons
   nobody has asked for yet. */
function openReactPicker(anchor) {
  closeReactPicker();

  const room = Live.room();
  const list = (room && room.reactions) || [];
  const id = anchor.dataset.addreact;

  const pop = document.createElement("div");
  pop.className = "reactpicker";
  pop.id = "reactPicker";
  pop.innerHTML = list.map(function (emoji) {
    return `<button type="button" data-react="${escHtml(id)}"
        data-emoji="${escHtml(emoji)}">${escHtml(emoji)}</button>`;
  }).join("");

  anchor.parentNode.appendChild(pop);
}

function closeReactPicker() {
  const open = $("reactPicker");
  if (open && open.parentNode) open.parentNode.removeChild(open);
}

// Anywhere else closes it. Registered on document because the picker is
// inside a log that is rebuilt from scratch several times a minute.
document.addEventListener("click", function (e) {
  if (e.target.closest && e.target.closest("#reactPicker, [data-addreact]")) return;
  closeReactPicker();
});

/* ---- reading back, and what you missed ------------------ */

$("chatLog").addEventListener("scroll", function () {
  const atBottom = this.scrollHeight - this.scrollTop - this.clientHeight < 48;
  if (atBottom === chatUI.pinned) return;

  chatUI.pinned = atBottom;
  if (!atBottom) return;

  // Catching up is the same as having read it.
  const room = Live.room();
  if (room) {
    chatUI.seenId = (room.chat || []).reduce(function (top, m) {
      return m.id > top ? m.id : top;
    }, 0);
  }
  chatUI.unread = 0;
  renderChatMeta(room);
});

$("chatJump").addEventListener("click", function () {
  const log = $("chatLog");
  log.scrollTop = log.scrollHeight;   // the scroll handler does the rest
});

/* ---- the mobile sheet -----------------------------------

   On a phone the dock covers the board rather than sitting beside it, so it
   needs a way in and a way out. Both are inert on a desktop, where CSS keeps
   the dock docked and the launcher hidden. */
function openChatSheet(on) {
  chatUI.open = on;
  document.body.classList.toggle("chat-open", on);
  if (!on) return;

  const log = $("chatLog");
  log.scrollTop = log.scrollHeight;
  chatUI.pinned = true;
  chatUI.unread = 0;

  // Opening the sheet is reading it. Marked here as well as on the next
  // render, so nothing counts as missed in the gap between the two.
  const room = Live.room();
  if (room) {
    chatUI.seenId = (room.chat || []).reduce(function (top, m) {
      return m.id > top ? m.id : top;
    }, 0);
  }
  renderChatMeta(room);
}

$("chatFab").addEventListener("click", function () { openChatSheet(!chatUI.open); });

/* The rail sheet. Only a body class, because unlike the chat there is no
   scroll position or unread count to look after — the rail is rebuilt by
   render() every time anything changes, and it reads correctly whether the
   sheet was open or shut. Closing on a draft is deliberate: drafting from
   the queue is the reason the sheet exists, and leaving it over the board
   afterwards hides the thing you just changed. */
function openRailSheet(on) {
  document.body.classList.toggle("rail-open", on);
}
$("railFab").addEventListener("click", function () { openRailSheet(true); });
$("railDismiss").addEventListener("click", function () { openRailSheet(false); });
$("chatDismiss").addEventListener("click", function () { openChatSheet(false); });

/* ---- your name ------------------------------------------

   Stored on the way past, so the next room already knows it. Sent to the
   room as well when there is one, which is what moves it onto the chair and
   onto everything already said. */
$("displayName").addEventListener("change", function () {
  this.value = Live.setName(this.value);
});

/* Enter in the name box means "that's my name", not "submit the setup
   screen" — which, on a form-less div, would otherwise do nothing at all and
   read as the field being broken. */
$("displayName").addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  this.value = Live.setName(this.value);
  this.blur();
});

$("randomizeBtn").addEventListener("click", function () {
  slotSelect.value = Math.floor(Math.random() * league.teams);
});

$("startBtn").addEventListener("click", function () {
  readSetup();
  if (setupProblem()) { refreshSetup(); return; }   // belt and braces; the button is disabled too

  /* In a room the host asks and everyone starts together; the state that
     comes back is what actually begins the draft.

     Asked of the room rather than of the socket. `inRoom()` is "the socket is
     open right now", and a dropped socket is a normal second of a draft on a
     phone — so falling through on it meant falling through to the branch
     below, which starts a *solo* draft. That is not a degraded shared draft;
     it is a different draft, on the host's phone, while everybody else sits
     on "Waiting for the host…" until they give up. The button is disabled
     while reconnecting, so this is the belt to that pair of braces. */
  if (typeof Live !== "undefined" && Live.room()) {
    if (inRoom()) Live.start();
    else renderInvite();
    return;
  }

  state.mySlot      = Number(slotSelect.value);
  state.clockLength = Number($("pickClock").value);
  state.started     = true;

  // Built here as well as on every setup change, because this is the point
  // the league stops moving and the ranks and tiers become the ones the
  // whole draft is judged against.
  buildBoard();

  // A seeded wobble, so no two mocks are identical but a resumed draft
  // reproduces the one you were in.
  state.seed = Math.floor(Math.random() * 1000000);
  applyJitter();

  enterDraftUI();
  render();
  runCPUs();
});

// resume / discard live inside a re-rendered banner, so they are delegated
document.addEventListener("click", function (e) {
  if (e.target.id === "resumeBtn") { const d = readSave(); if (d) resumeDraft(d); }
  if (e.target.id === "discardBtn") { clearSave(); showResumeBar(); }
});

/* The year buttons on the game logs. Delegated from the sheet body, which
   openSheet() rewrites wholesale, and it repaints only the logs view rather
   than reopening the sheet — reopening would throw away which tab you were
   on to change something inside that tab. */
$("sheetBody").addEventListener("click", function (e) {
  const btn = e.target.closest ? e.target.closest("[data-logyear]") : null;
  if (!btn || !sheetPlayer) return;
  sheetLogPick = btn.dataset.logyear;
  const s = statOf(sheetPlayer);
  $("v-logs").innerHTML = logsHtml(sheetPlayer, s, sheetLogYear(s));
});

/* A player photo that 404s removes itself, leaving the initials underneath.

   This was an inline onerror="this.remove()" on every avatar, which is a
   script a Content-Security-Policy has to be told to allow — and allowing
   inline handlers means allowing the ones an attacker writes too.

   Registered with capture: true because `error` does not bubble. It fires on
   the <img> and stops, so a listener on document only ever sees it on the
   way down. Delegated rather than bound per image because render() creates
   these by the hundred and throws them away again. */
document.addEventListener("error", function (e) {
  const el = e.target;
  if (el && el.tagName === "IMG" && el.hasAttribute("data-drop-on-error")) {
    el.remove();
  }
}, true);

$("sheetBackdrop").addEventListener("click", closeSheet);

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeSheet();
});

$("sheetTabs").addEventListener("click", function (e) {
  if (e.target.tagName !== "BUTTON") return;
  this.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  e.target.classList.add("on");
  document.querySelectorAll(".sheet-view").forEach((v) => v.classList.remove("on"));
  $(e.target.dataset.view).classList.add("on");
});

// Neither header is rebuilt by render(), so these can hold direct listeners
// rather than going through the delegated handler below.
// The mark now leaves for the landing page rather than discarding: the draft
// stays in memory and in the save, and the route change is what goes back.
$("homeBtn").addEventListener("click", function () { go("home"); });

document.addEventListener("click", function (e) {
  const btn = e.target.closest ? e.target.closest("#soundBtn") : null;
  if (btn) toggleSound();
});

// Delegated, because the panel's toggle does not exist until the rooms are
// rendered, and the same goes for its Log in and Install.
document.addEventListener("click", function (e) {
  if (e.target.closest(".theme-toggle")) {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  }
});
$("scoreStrip").addEventListener("scroll", updateScoreEnds, { passive: true });
window.addEventListener("resize", updateScoreEnds);
$("scoreLeft").addEventListener("click", function () { nudgeScores(-1); });
$("scoreRight").addEventListener("click", function () { nudgeScores(1); });

$("roomsBtn").addEventListener("click", toggleRooms);

// A panel that opens on click should close the same way, from anywhere.
document.addEventListener("click", function (e) {
  if (!$("roomsPanel").hidden && !e.target.closest("#roomsPanel, #roomsBtn")) closeRooms();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeRooms();
});

document.addEventListener("click", function (e) {
  if (!e.target.closest(".js-install") || !installPrompt) return;
  installPrompt.prompt();
  installPrompt.userChoice.finally(function () {
    installPrompt = null;
    showInstall(false);
  });
});

// Honest rather than absent: the buttons are part of where this is going, and
// saying so beats a dead click or a form that posts into the void.
document.addEventListener("click", function (e) {
  if (!e.target.closest(".js-login")) return;
  notYet("Accounts are not live yet",
         "There is nothing to log into so far. Your drafts save to this device, " +
         "so you can close the tab and pick up where you left off.");
});

$("signupBtn").addEventListener("click", function () {
  notYet("Sign-up is coming",
         "Juke does not have accounts yet. Everything here is free and needs no " +
         "sign-up, and your drafts already save to this device.");
});

/* An invite code arriving in the address bar without a page load.

   Joining a room used to happen once, at startup, which is right for a link
   opened from a message into a fresh tab and wrong for every other way the
   same link arrives. A tab already on the site only changes its hash — no
   load, no startup, no join — so tapping the invite a second time did
   nothing at all. That became reachable the moment leaving a room started
   clearing the code out of the address: the way back in is the link, and the
   link is exactly the case that did not work.

   Guarded on the code differing from the one we are already in, because
   applyRoute() runs on every hash change and rejoining the room you are
   sitting in would drop the socket mid-draft. */
window.addEventListener("hashchange", function () {
  const code = typeof Live === "undefined" ? null : Live.codeInUrl();
  const now = typeof Live === "undefined" ? null : Live.state().code;
  if (code && code !== now) joinRoom(code, false);
  applyRoute();
});

$("pauseBtn").addEventListener("click", togglePause);

/* Directly on the scroller rather than delegated from document, and that is
   safe here for once: render() replaces #boardGrid's innerHTML, never
   #boardScroll itself, so this element outlives every rebuild.

   Three events because there are three ways to move a scroller by hand, and
   `scroll` is not one that can be used — see the note on boardFollow. Passive,
   because none of them is being cancelled and a non-passive wheel listener on
   a scroll container costs a frame. */
["wheel", "touchstart", "pointerdown"].forEach(function (event) {
  $("boardScroll").addEventListener(event, freeBoardScroll, { passive: true });
});
// Arrow keys, Page Up and Home all scroll a focused container too.
$("boardScroll").addEventListener("keydown", freeBoardScroll);
$("undoBtn").addEventListener("click", undo);
$("autoBtn").addEventListener("click", autoDraftRest);
$("restartBtn").addEventListener("click", restart);
$("hideDrafted").addEventListener("change", renderPlayers);

// Density is a class on the table rather than a re-render: the rows do not
// change, only how much air they sit in.
$("roomyRows").addEventListener("change", function () {
  $("playerTable").classList.toggle("compact", !this.checked);
});

$("playerSearch").addEventListener("input", function () {
  state.search = this.value;
  renderPlayers();
});

/* Clicking a column sorts by it; clicking the same one again turns it round.

   Delegated from the head rather than bound per header, because
   renderPlayerHead() rewrites both rows on every render — including the one
   that happens as a result of this very click.

   A new column starts in the direction that puts the interesting end first:
   most yards, most touchdowns, best score. ADP, rank and bye are the
   exceptions, where low is the interesting end and always has been. */
const SORT_ASCENDING_FIRST = ["rk", "adp", "bye", "name"];

function sortPlayersBy(key) {
  if (!colByKey(key)) return;
  if (state.sort.key === key) {
    state.sort.dir = -state.sort.dir;
  } else {
    state.sort.key = key;
    state.sort.dir = SORT_ASCENDING_FIRST.indexOf(key) >= 0 ? 1 : -1;
  }
  renderPlayers();
}

$("playerHead").addEventListener("click", function (e) {
  const th = e.target.closest ? e.target.closest("[data-sort]") : null;
  if (th) sortPlayersBy(th.dataset.sort);
});

// The headers are reachable by keyboard, so they have to answer to it.
$("playerHead").addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  const th = e.target.closest ? e.target.closest("[data-sort]") : null;
  if (!th) return;
  e.preventDefault();
  sortPlayersBy(th.dataset.sort);
});

// One listener on the whole page catches every Draft button,
// including buttons that don't exist yet. This is called
// event delegation and it saves re-attaching listeners on
// every redraw.
document.addEventListener("click", function (event) {
  if (event.target.id === "skipBtn") { skipSim(); return; }
  if (event.target.id === "sheetClose") { closeSheet(); return; }

  // Two buttons say "New mock draft": one in the action bar, one in the
  // finished-draft panel. Delegated, because the second is rebuilt on
  // every render and a directly attached listener would not survive it.
  if (event.target.dataset && event.target.dataset.action === "new-draft") {
    goHome();
    return;
  }

  // Queue controls, delegated because the rows they sit in are rebuilt on
  // every render and a directly attached listener would not survive it.
  const q = event.target.closest ? event.target.closest("[data-queue]") : null;
  if (q) { queueToggle(q.dataset.queue); render(); return; }

  const up = event.target.closest ? event.target.closest("[data-qup]") : null;
  if (up) { queueMove(up.dataset.qup, -1); render(); return; }

  const down = event.target.closest ? event.target.closest("[data-qdown]") : null;
  if (down) { queueMove(down.dataset.qdown, 1); render(); return; }

  const link = event.target.closest ? event.target.closest("[data-player]") : null;
  if (link) {
    const chosen = board.find((p) => p.name === link.dataset.player);
    if (chosen) openSheet(chosen);
    return;
  }
  const name = event.target.dataset ? event.target.dataset.draft : null;
  if (!name || !isMyTurn()) return;
  const player = board.find((p) => p.name === name && !p.drafted);
  if (player) {
    // Drafting from the queue is why the sheet opens, so it gets out of the
    // way once you have. Harmless on a wide screen, where the class does
    // nothing at all.
    openRailSheet(false);
    draftAndAdvance(player);
  }
});

/* Going to a tab, which used to be three lines living inside one static
   button's click handler — so the only thing in the app that could change tabs
   was the tab strip itself. Anything else wanting to send you somewhere had to
   either write "which tab is on" down a second time or, as the rail did, look
   like a link and do nothing at all. */
function goToTab(id) {
  document.querySelectorAll(".tabs button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.tab === id);
  });
  showPanel(id);
}

document.querySelectorAll(".tabs button").forEach(function (button) {
  button.addEventListener("click", function () { goToTab(button.dataset.tab); });
});

/* The rail's way through to the full roster.

   It was a `<span class="rtm">My Team</span>`: blue, sitting at the end of the
   one row that says there are players it is not showing you, and wired to
   nothing. It read as a link on every screen the app has — it was only
   reported from the installed desktop app because that is where somebody sat
   and tried to click it.

   Delegated, because renderRail() rebuilds that row on every render — one per
   pick — so a listener attached to the element would be thrown away seconds
   after it was set. */
document.addEventListener("click", function (e) {
  const go = e.target.closest && e.target.closest("[data-goto-tab]");
  if (!go) return;
  goToTab(go.dataset.gotoTab);
  // On a phone the rail is a sheet lying over the board, so it has to get out
  // of the way of the panel it just opened.
  openRailSheet(false);
});

$("suggestFilter").addEventListener("click", function (e) {
  if (e.target.tagName !== "BUTTON") return;
  this.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  e.target.classList.add("on");
  state.filterSuggest = e.target.dataset.pos;
  renderSuggestions();
});

$("playerFilter").addEventListener("click", function (e) {
  // closest(), not tagName: these buttons now hold a <span> with the
  // have/need count, and a click landing on that text is still a click on
  // the button as far as the person doing it is concerned.
  const button = e.target.closest ? e.target.closest("button") : null;
  if (!button || !this.contains(button)) return;
  this.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  button.classList.add("on");
  state.filterPlayers = button.dataset.pos;
  renderPlayers();
});

/* The working panels move inside the split, so the rail can sit beside them
   rather than under them. Done here rather than in the markup because the
   setup screen is a panel too and has to stay outside it: setup is the page
   before a draft, not a column within one. */
["tab-suggest", "tab-players", "tab-team", "tab-picks", "tab-grades"]
  .forEach(function (id) { $("workMain").appendChild($(id)); });

// Everything above this line is a definition. This reads the setup screen,
// builds the board from the matching ADP set, and draws the page.
refreshSetup();

// The route has the last word on what is visible, so it runs after the
// setup screen has been built rather than before.
applyRoute();

/* The one deliberate seam between this file and anything built with a
   bundler (the React homepage lives at web/, and loads as a module script,
   so it does not share this file's top-level scope the way players.js and
   stats.js do). Nothing here is a second implementation of a rule — every
   entry is the same function or the same live reference the rest of this
   file already uses, handed out rather than duplicated. board() and
   rooms() return live references on purpose: call them fresh on each use
   rather than caching across a route change, the same way this file does. */
window.JukeEngine = {
  board:        () => board,
  league:       () => league,
  rooms:        () => ROOMS,
  overallScore: overallScore,
  shotPicks:    shotPicks,
  fetchScores:  fetchScores,
  readSave:     readSave,
  settingsText: settingsText,
  notYet:       notYet,
  shortName:    shortName,
  statOf:       statOf,
  pointsUnder:  pointsUnder,
  rulesForFormat: rulesForFormat,
  statKeys:     () => (typeof STAT_KEYS === "undefined" ? null : STAT_KEYS),
  forcedLate:   () => FORCED_LATE,
  playersMeta:  () => (typeof PLAYERS_META === "undefined" ? null : PLAYERS_META),
  // Added for the React settings page (web/src/components/DraftSettings.jsx).
  // setLeague patches the one real league object rather than a second copy of
  // it — the same object readSetup() has always written to.
  teamCounts:   () => TEAM_COUNTS,
  scoringNames: () => SCORING_NAMES,
  setLeague: function (patch) {
    Object.assign(league, patch);
    // The format preset owns exactly one rule, at the moment it is chosen —
    // same side effect readSetup() has always applied, kept in one place.
    if (patch.scoring) league.rules.rec = REC_BY_FORMAT[patch.scoring];
    // readSetup() re-reads teams/scoring off these same two legacy <select>
    // elements every time refreshSetup() runs — goHome() among other places
    // — and until this line it always won: the legacy controls are hidden
    // and nothing else in this file writes to them any more, so they sat
    // frozen at whatever fillSetupControls() drew at boot, and the next
    // refreshSetup() silently reverted whatever this function had just set.
    // Mirroring the value here is what makes `league` the one real object in
    // both directions, not just this one.
    if (patch.teams !== undefined)   $("teamCount").value = String(patch.teams);
    if (patch.scoring !== undefined) $("scoring").value = patch.scoring;
  },
  setupProblem: setupProblem,
  resumeDraft:  resumeDraft,
  clearSave:    clearSave,
  // Added for the Draft Locker (web/src/components/DraftLocker.jsx). Summary
  // objects, not raw history entries — a card needs a label and a date, not
  // a league object and a picks array to derive one from itself.
  historyList:  () => readHistory().map(historySummary),
  openHistoryDraft: openHistoryDraft,
  inProgressSummary: inProgressSummary,
  resumeSavedDraft:  resumeSavedDraft,
  // Added for the Draft Insights Dashboard (DraftInsightsDashboard.jsx).
  // The exact grade the legacy Analysis tab paints — same weights, same
  // scaleAcross(), same clamped letter scale — handed out whole so the
  // React view can never disagree with the standings about what anyone
  // scored. Indexed by slot, like analyseDraft() has always returned it.
  draftAnalysis: () => analyseDraft(),
  // Everything the Start button does, minus the DOM read readSetup() used to
  // do — React already wrote the league directly via setLeague(). mySlot is
  // 0-indexed, matching slotSelect's own values (label is 1st, value is 0).
  startDraft: function (opts) {
    if (typeof Live !== "undefined" && Live.room()) {
      if (inRoom()) { Live.start(); return true; }
      renderInvite();
      return false;
    }
    if (setupProblem()) return false;
    state.mySlot      = opts.mySlot;
    state.clockLength = opts.clockLength;
    state.started     = true;
    buildBoard();
    state.seed = Math.floor(Math.random() * 1000000);
    applyJitter();
    enterDraftUI();
    render();
    runCPUs();
    return true;
  },
  // Added for the React header (web/src/components/AppHeader.jsx), which
  // replaces .appbar the same way DraftSettings.jsx replaced .setup — hidden
  // rather than deleted, for the same unguarded-listener reason. headerInfo()
  // is the exact branching renderHeader() itself now runs (see the comment
  // above that function); nothing here recomputes it a second way. The
  // "juke:header" event fires from renderHeader() itself, on every render,
  // tick and pause toggle — the same cadence the legacy DOM writes already
  // ran on — so the header can re-read rather than poll.
  headerInfo: headerInfo,
  // Added for the React draft room page (web/src/components/DraftRoom.jsx).
  // All four are reads of state that already exists, not a second copy of
  // it: picks() and mySlot() are the same state.picks/state.mySlot the
  // legacy board and rail already read directly, and teamLabel()/
  // seatedLineup() are the exact functions that already decide a seat's
  // name and a roster's starter/bench split — seatedLineup() is where the
  // FLEX gets filled correctly (see the bestLineup() note in CLAUDE.md
  // about sorting by posRank instead of aboveReplacement), so the roster
  // dock reads it rather than re-deciding which bench player counts as
  // which slot. onTheClock() and pickCode() are not re-bridged here because
  // they are already pure/global on window.DraftEngine — call
  // DraftEngine.onTheClock(league(), picks().length) and
  // DraftEngine.pickCode(overall, league().teams) directly.
  picks:        () => state.picks,
  mySlot:       () => state.mySlot,
  teamLabel:    teamLabel,
  seatedLineup: seatedLineup,
  // Added for the React queue sidebar (PlayerQueueSidebar.jsx). photoUrl()
  // and initials() are the exact functions avatar() already calls, so a
  // real headshot (or its initials fallback) is never drawn a second way.
  // FLEX is a roster slot, not a player.pos, and SLOT_ELIGIBLE.FLEX is the
  // one place that says which positions fill it — bridged rather than
  // hand-copied so a future SFLEX/roster change can't drift the two apart.
  photoUrl:      photoUrl,
  initials:      initials,
  flexPositions: () => SLOT_ELIGIBLE.FLEX,
  // Added for the React player card's four tabs (PlayerProfileDrawer.jsx),
  // wiring it to the same data the legacy sheet's Overview/Game Logs/Depth
  // Chart views already read — see the comment above these four functions.
  // Latest News goes through window.Live.news() directly (already global,
  // same as window.DraftEngine) rather than a bridge entry of its own, but
  // sourceId()/safeNewsUrl() are: the first is how it finds the right id to
  // ask for, the second is the one thing standing between a hostile feed
  // and a javascript: link in the page, and neither may be re-typed in React.
  projectionSummary: projectionSummary,
  gameLogFor:        gameLogFor,
  depthChartFor:     depthChartFor,
  sourceId:          sourceId,
  newsItemView:      newsItemView,
  /* Added for the player card's "Our Read" tab — the model explaining
     itself, which is the thing this app has that a projection feed does
     not. Every one of these is the same function the legacy sheet paints
     from, never a second reading of the same stats.

     jukeReadout() is the one addition: the legacy sheet builds this
     explanation as HTML in three places (jukeNote(), the meters, the
     unrated note), and React cannot use any of it. Rather than let a
     second explanation of the Juke score grow up in JSX — the exact
     "one number, three names" failure CLAUDE.md already records — the
     decisions are made here, once, and handed over as data.

     The zero handling is the load-bearing part. A clamped 0 is the
     majority state of the board by arithmetic, not a fault (measured
     against three real completed seasons: the same share scored zero
     there as in the projection), so it must never appear as a bare
     number. gap carries replacementGap() — the un-clamped figure that
     is the only thing able to tell a receiver one point below
     replacement from one sixty below — and floorNote names the floor. */
  jukeReadout: function (player) {
    const score = overallScore(player);
    const sig = draftSignals(player);
    const gap = replacementGap(player);
    const unranked = player.projPts !== null && score === null;
    return {
      score: score,
      label: score === null ? null : label(score),
      // Un-clamped points above/below a replacement starter. Two zeros
      // are not equal and this is what says so.
      gap: gap === null ? null : Math.round(gap),
      replacementRank: posLabel(player.pos) + replacementRank(player.pos),
      reason: overallReason(player),
      unranked: unranked,
      // Why a position is refused, rather than a silent dash.
      unrankedNote: unranked
        ? 'Measured against three seasons of our own archived forecasts, the projection ranks ' +
          (player.pos === 'DST' ? 'defenses' : 'kickers') +
          ' no better than chance — one of those seasons came out backwards. The number is ' +
          'withheld rather than guessed at; the projected points are still real.'
        : null,
      upside: sig ? Math.round(sig.upside) : null,
      upsideLabel: sig ? label(sig.upside) : null,
      upsideWhy: sig ? sig.reasons.upside : [],
      bust: sig ? Math.round(sig.bust) : null,
      bustLabel: sig ? label(sig.bust) : null,
      bustWhy: sig ? sig.reasons.bust : [],
      priorScore: priorScore(player) === null ? null : Math.round(priorScore(player)),
      priorSeason: PRIOR_SEASON,
      priorGames: player.priorGames === undefined ? null : player.priorGames,
      boardSize: board.length,
      // What the app itself starts, for the "most of the board scores
      // nothing and that is arithmetic" explanation.
      startersInPlay: league.teams * (starterCount() + flexCount()),
      teams: league.teams
    };
  },
  projectionRecord: projectionRecord,
  marketGap:        marketGap,
  // Added for the queue sidebar's "Juke Value Assistant" card
  // (PlayerQueueSidebar.jsx). All three are the exact real functions
  // already driving the legacy Suggestions tab and the tier chips on the
  // board — suggestions('ALL') ignores state.filterSuggest on purpose
  // (see the autoPickForMe() note in CLAUDE.md about a filter being a lens
  // and never a decision: the card is recommending across every position,
  // not whatever the queue's own pill happens to be set to right now).
  // replacementGap() is the un-clamped points-above-replacement figure
  // overallScore() divides down to a 0-100 share internally — already
  // named "vor" in its own source. tierRemaining() is what tierChip()
  // already prints on the legacy board ("2 left in tier 1"), not a new
  // scarcity metric invented for this card.
  suggestions:     suggestions,
  replacementGap:  replacementGap,
  tierRemaining:   tierRemaining,

  /* The scoring editor, as data rather than as markup.

     renderScoringFields() draws thirty-eight fields straight into
     #scoringFields, which is inside the legacy setup screen and therefore
     display:none - so the one thing here a competitor does not have has been
     unreachable by mouse since DraftSettings.jsx replaced that screen. This
     hands React what it needs to draw the same editor: the groups, the
     labels, which rules are per-yard, and which ones Sleeper does not
     forecast so the board's ranking cannot move when you change them.

     It is the metadata that crosses, never the arithmetic. fantasyPoints()
     and DEFAULT_RULES stay the only place a rule means anything - a second
     scoring table in web/src is the exact failure CLAUDE.md's "nothing about
     the league shape may be written down twice" exists to prevent. */
  scoringEditor: function () {
    return RULE_GROUPS.map(function (group) {
      return {
        title: group[0],
        rules: group[1].map(function (rule) {
          return {
            key: rule,
            label: RULE_LABELS[rule] || rule,
            value: league.rules[rule] || 0,
            perYard: PER_YARD_RULES.indexOf(rule) >= 0,
            divisor: PER_YARD_RULES.indexOf(rule) >= 0
              ? divisorFromPoints(league.rules[rule]) : null,
            // A rule Sleeper does not forecast still scores every past
            // season correctly; it just cannot move the projection the board
            // is ranked on. The editor says so on the rule itself.
            historyOnly: !movesProjection(rule)
          };
        })
      };
    });
  },

  /* One rule, then rebuild. Per-yard rules are entered as "1 point every N
     yards" because that is how a league writes them down, and converted here
     rather than in the component - pointsFromDivisor() is the existing
     conversion and there is no reason for a second one. */
  setScoringRule: function (key, value, asDivisor) {
    const next = asDivisor ? pointsFromDivisor(value) : Number(value);
    if (!isFinite(next)) return false;
    league.rules[key] = next;
    buildBoard();
    render();
    return true;
  },

  resetScoringRules: function () {
    league.rules = Object.assign({}, DEFAULT_RULES);
    buildBoard();
    render();
    return true;
  },

  /* The starting lineup, as the league actually holds it. Every consumer
     reads this rather than keeping its own idea of what a roster is. */
  lineup: function () {
    return {
      starters: Object.assign({}, league.starters),
      flex: league.flex,
      superflex: league.superflex,
      bench: league.bench,
      rounds: league.rounds
    };
  },
  // Whether to take him *now*, with this roster, at this pick — the one
  // question the sheet could not answer, because every other number on it
  // reads the same at pick 1 and pick 140. Computed engine-side so the cap,
  // the lineup and the snake stay written down once. Null before a draft
  // starts, which the tab renders as its own state rather than as zeros.
  draftFit:        draftFit,
  // The Draft button's real submission path. Wraps draftAndAdvance() rather
  // than reimplementing it — that one function already knows the solo vs.
  // room difference (mutate locally and kick off runCPUs(), or send
  // Live.pick() and wait for the room to broadcast), so this stays the only
  // place a pick is ever submitted, same as the legacy Draft buttons.
  //
  // draftAndAdvance()/makePick() do not check state.mySlot on their own:
  // makePick() passes onTheClock().slot as the "seat" to DraftEngine's
  // rejectPick(), which trivially matches itself, so NOT_YOUR_TURN can
  // never fire from that call site. The legacy UI never notices because its
  // Draft buttons are only ever rendered while isMyTurn() is true. A React
  // button has no equivalent structural guarantee, so the turn check is
  // repeated here rather than trusted to the caller — the same reasoning as
  // "the engine is where legality lives, not each caller" elsewhere in this
  // file. Returns null on success, or a DraftEngine.REJECT.* reason string.
  draftPlayer: function (player) {
    if (!isMyTurn()) return "not-your-turn";
    draftAndAdvance(player);
    return null;
  },
  // The Autopick toggle's real path — and room vs. solo are asymmetric on
  // purpose, the same way autoDraftRest() already treats them differently.
  // A room has a real, persistent "keep drafting for me" flag already
  // (state.autoMe), driven by driveMyAutopilot() — which the room's own
  // broadcast handler already re-invokes after every update (see the call
  // beside adoptRoom() a few hundred lines up), so toggling the flag once
  // here is enough; nothing further has to be re-triggered from React.
  // Solo has no equivalent flag to toggle — "Auto-draft the rest" there is
  // a one-shot loop that finishes the whole draft immediately, not a
  // resumable per-turn toggle, so it is not what a persistent "Autopick:
  // ON" switch should mean. The page drives its own turn-by-turn loop for
  // that case instead, off autoPickForMe() — bridged here as a pure read,
  // the exact function (queueTop() -> suggestions()[0] -> bestLeft()) that
  // autoDraftRest()'s own solo loop already uses for my seat, so a second
  // "what would I draft" rule never gets invented in React.
  inRoom: inRoom,
  autoMe:  () => state.autoMe,
  toggleRoomAutopilot: function () {
    if (!inRoom()) return state.autoMe;
    state.autoMe = !state.autoMe;
    render();
    driveMyAutopilot();
    return state.autoMe;
  },
  autoPickForMe: autoPickForMe,
  // Undo, Pause and Discard for the React draft room page — reusing the
  // exact functions the legacy action bar calls, including the visibility
  // rules renderActionBar() already encodes (see CLAUDE.md's "Everything
  // the room decides has to be locked" section): Undo is solo-only — in a
  // room it un-drafts a copy the next broadcast overwrites anyway, so it
  // has to be hidden rather than merely made to fail. Pause is the host's
  // in a room (togglePause() already refuses anyone else via Live.pause()
  // being ignored server-side, but the button should not be offered in the
  // first place, same reasoning as Undo). Neither state.paused nor "am I
  // the host" existed on the bridge before this, so both are added as
  // plain reads.
  undo: undo,
  paused: () => state.paused,
  // renderPauseButton() disables the button at clockLength 0 — pausing a
  // clock that was never running is meaningless — so this is bridged too,
  // rather than the Pause control here always being clickable when the
  // legacy one sometimes isn't.
  clockLength: () => state.clockLength,
  /* The pick clock is state, not league - it is per-drafter rather than part
     of the board's shape, which is why a room broadcasts it separately. The
     settings modal wrote league.clock for two commits and read it back as
     undefined every time: a control that looked live, moved, and changed
     nothing. Setting it before a draft is what startDraft() then carries. */
  setClockLength: function (seconds) {
    const n = Number(seconds);
    if (!isFinite(n) || n < 0) return false;
    state.clockLength = n;
    render();
    return true;
  },
  hasRoom: hasRoom,
  isHost: () => hasRoom() && !!Live.room().isHost,
  draftOver: draftOver,
  // restart() is clearSave() + goHome() — the exact real "Discard draft" /
  // "Leave the room" action (the label itself is real too: renderActionBar()
  // already picks between them by hasRoom(), reused here rather than
  // re-deciding it). goHome() disconnects a room first if one is active, so
  // this is a real departure, not a local reset that the next broadcast
  // undoes.
  restart: restart,
  // Rooms and chat, for the React draft room page. None of this is a
  // second implementation of Live/room.js — every entry below is either a
  // plain read off Live or a direct call into the exact function the
  // legacy lobby already uses.
  //
  // The one real design decision: Live.onChange()/Live.onTyping() are
  // single-slot callbacks (see live.js), not an event bus, so this file
  // never calls them a second time from here — doing that would silently
  // replace onRoomChange() and stop adoptRoom()/driveRoomCPUs()/
  // driveMyAutopilot()/resetClock() from ever running again. createRoom()
  // and joinRoomByCode() below both go through the real joinRoom(), the
  // one function that already registers Live.onChange(onRoomChange) and
  // Live.onTyping(onRoomTyping) correctly — and onRoomChange() already
  // ends by calling render(), which already fires "juke:header" via
  // renderHeader(). So this page's existing useJukeTick() hook picks up
  // every room change (a pick, a chat line, a seat swap) for free; no
  // second event is needed. onTyping() below is the one exception: its
  // only existing consumer (onRoomTyping) just feeds a typing indicator in
  // the legacy, permanently-hidden chat dock, so replacing that single
  // slot from React has no visible legacy consequence — unlike onChange.
  room: () => Live.room(),
  liveStatus: () => Live.status(),
  liveReason: () => Live.reason(),
  codeInUrl: () => Live.codeInUrl(),
  memberId: () => Live.memberId(),
  myName: () => Live.name(),
  setMyName: (name) => Live.setName(name),
  // The real createRoomBtn sequence, minus readSetup(): that call exists
  // there to pull league settings out of legacy DOM inputs this page
  // never renders, and this page's ConfigureDraftForm already keeps the
  // one real `league` object current via setLeague() on every change — a
  // second read off empty/default DOM elements would overwrite an
  // already-correct league with defaults, not update it.
  createRoom: function () {
    if (setupProblem()) return null;
    const code = Live.newCode();
    location.hash = "#/draft-room?room=" + code;
    joinRoom(code, true);
    return code;
  },
  joinRoomByCode: function (code) {
    if (!code) return;
    location.hash = "#/draft-room?room=" + code;
    joinRoom(code, false);
  },
  // Mirrors leaveRoomBtn's handler, minus its redirect to #/draft — this
  // page stays on its own route and only drops ?room= from the hash, so a
  // reload lands back on setup rather than rejoining what was just left
  // on purpose (same reasoning goHome() already documents for Discard).
  leaveRoom: function () {
    Live.disconnect();
    location.hash = "#/draft-room";
    renderInvite();
    renderChat();
  },
  sendChat: (text, gif) => Live.chat(text, gif || null),
  sendReaction: (id, emoji) => Live.react(id, emoji),
  onTyping: (fn) => Live.onTyping(fn),
  sendTyping: (on) => Live.typing(!!on),
  claimSeat: (seat) => Live.claimSeat(seat),
  swapSeats: (a, b) => Live.swapSeats(a, b),
  gifSearch: (q) => Live.gifSearch(q),
  safeGif: safeGif,
  // chatStream() is the real merge of room.chat and room.picks into one
  // timeline by `at` — picks are not chat messages, and this is the same
  // function that keeps the legacy dock from storing them twice (see
  // CLAUDE.md). Bridged directly rather than re-merged in React.
  chatStream: chatStream,
  // The real queue — state.queue is an array of player names, and these
  // four are the exact functions the legacy rail's star/move buttons
  // already call (queueToggle()/queueMove() themselves don't render;
  // the caller does, same as the legacy delegated click handler does
  // here). queueTop() is what autoPickForMe() and the clock-expiry pick
  // already prefer over the model's own opinion — starring a player here
  // is the same real plan, not a second, cosmetic-only "favorites" list.
  queue: () => state.queue,
  queued: queued,
  queueToggle: function (name) { queueToggle(name); render(); },
  queueMove: function (name, delta) { queueMove(name, delta); render(); },
  // A separate list from the queue on purpose — see the comment on
  // state.watchlist. No move/reorder pair: order carries no meaning here,
  // unlike the queue, so there is nothing for queueMove()'s equivalent to do.
  watchlist: () => state.watchlist,
  watchlisted: watchlisted,
  watchlistToggle: function (name) { watchlistToggle(name); render(); },
  currentTheme: currentTheme,
  setTheme:     setTheme,
  soundWanted:  () => soundWanted,
  toggleSound:  toggleSound,
  togglePause:  togglePause,
  // Added for the React Analysis tab (web/src/components/AnalysisTab.jsx).
  // analyseDraft() is the real grade computation — every component, scaled
  // and weighted, exactly as renderGrades() reads it — called fresh on
  // each render, same as the legacy panel. Its own `.lineup` field is
  // built by bestLineup() (sorts by aboveReplacement, so it resolves the
  // FLEX correctly between positions), which is NOT seatedLineup() —
  // RosterDock's prop above is the other one, on purpose (it fills slots
  // in draft order). A caller here must read analyseDraft()'s own
  // .lineup, never mix in seatedLineup(), or it silently reproduces the
  // exact starter-strength bug CLAUDE.md documents as already fixed once.
  // byeSummary()/replacementText()/lineupText() are the prose helpers
  // renderGrades()'s bye label and method note already use verbatim —
  // bridged so that prose is never re-derived in React.
  analyseDraft: analyseDraft,
  byeSummary: byeSummary,
  replacementText: replacementText,
  lineupText: lineupText
};

/* An invite code in the address bar means someone followed a link, so the
   room is joined before anything else happens. Not the host: the room
   already exists and already has a shape, and this browser's setup screen
   has no say in it. */
(function () {
  // Filled before anything connects, so a link followed from a text message
  // arrives in the room already wearing the name from last time.
  $("displayName").value = Live.name();

  const code = Live.codeInUrl();
  if (code) joinRoom(code, false);
  renderInvite();
})();

// Back to top, twice: once for the page, which is what the landing view and
// every draft panel scroll, and once for the player sheet, which is the only
// thing in here that scrolls inside itself. The sheet's copy is mounted on
// .sheet rather than on the scrolling body, so it stays put instead of
// riding the content up. Both survive a render() because neither lives
// inside a panel that render() rebuilds.
backToTop();
backToTop({
  target: $("sheetBody"), mount: $("sheet"), className: "in-sheet",
  // The sheet has a few hundred pixels of travel at most, never the page's
  // several thousand, so it earns the button sooner. The default threshold
  // is measured for a full page and would sit past the end of most sheets.
  showAfter: 200
});
