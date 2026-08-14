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
  bench: 5,
  scoring: "half",   // "standard" | "half" | "ppr" — also picks the ADP set
  rules: null        // the scoring table; filled in below, editable on setup
};

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];

// The order starting slots are listed and filled, with FLEX after the
// positions it draws from so the better player lands in the named slot.
const SLOT_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];

function totalPicks()   { return league.teams * league.rounds; }
function starterCount() { return POSITIONS.reduce((n, pos) => n + league.starters[pos], 0); }
function rosterSize()   { return starterCount() + league.flex + league.bench; }

// The starting lineup, expanded into one entry per slot:
// QB, RB, RB, WR, WR, TE, FLEX, DST, K for the default settings.
function lineupSlots() {
  const slots = [];
  SLOT_ORDER.forEach(function (slot) {
    const n = slot === "FLEX" ? league.flex : (league.starters[slot] || 0);
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
  return league.starters[pos] + flexShare + DEPTH_ALLOWANCE[pos];
}

// Replacement level: the last player at a position who would realistically
// start somewhere in the league. It has to be derived, because it moves with
// team count and FLEX slots, and it feeds the draft grade, the Overall signal
// and value over replacement. The FLEX shares are how often each position
// actually wins that slot, which is why RB and WR run so much deeper.
const FLEX_SHARE = { RB: 0.40, WR: 0.55, TE: 0.05 };

function replacementRank(pos) {
  const base = league.teams * (league.starters[pos] || 0);
  const flex = league.teams * league.flex * (FLEX_SHARE[pos] || 0);
  return Math.round(base + flex) + 1;
}

// The same ranks written out in prose, for the method notes on the page.
// They used to be typed into the copy by hand, which is exactly how the copy
// and the maths drifted apart.
function replacementText() {
  return POSITIONS
    .map((pos) => (pos === "DST" ? "D/ST" : pos) + replacementRank(pos))
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");
}

const REPLACEMENT_PTS = {};

// Fourteen, because a 14-team league needs a name for every seat.
const CPU_NAMES = [
  "Wild Goose Chase", "Bijan Mustard", "Nacua Matata", "The Gibbs Ultimatum",
  "Kupp of Joe", "Purdy Vacant", "Hurts So Good", "Saquon For The Team",
  "Lambo No. 5", "Bone-Thugs-N-Montgomery", "Alvin and the Chipmunks",
  "Better Call Saquon", "A League of Their Mahomes", "Tua Fast Tua Furious"
];


/* ---- 2. Page elements ---------------------------------- */

const $ = (id) => document.getElementById(id);

const appbar     = $("appbar");
const statusLine = $("statusLine");
const pickLabel  = $("pickLabel");
const countBlock = $("countBlock");
const rightLabel = $("rightLabel");
const rightValue = $("rightValue");
const themeBtn   = $("themeBtn");
const tabsNav    = $("tabs");
const actionbar  = $("actionbar");


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
  themeBtn.setAttribute("aria-pressed", String(dark));
  themeBtn.setAttribute("aria-label", dark ? "Switch to the light theme" : "Switch to the dark theme");
  themeBtn.title = themeBtn.getAttribute("aria-label");
}

syncThemeButton();


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
  filterSuggest: "ALL",
  filterPlayers: "ALL",
  search: ""
};


/* ---- 5. Snake maths ------------------------------------
   Overall pick 1 is round 1 slot 1. In even rounds the
   order reverses, which is the only thing that makes a
   snake draft a snake.                                     */

function pickInfo(overall) {
  const round   = Math.ceil(overall / league.teams);
  const inRound = overall - (round - 1) * league.teams;
  const slot    = (round % 2 === 0) ? (league.teams + 1 - inRound) : inRound;
  return { round: round, slot: slot - 1 };
}

function currentOverall() { return state.picks.length + 1; }
function draftOver()      { return state.picks.length >= totalPicks(); }
function onTheClock()     { return draftOver() ? null : pickInfo(currentOverall()); }
function isMyTurn()       { const c = onTheClock(); return c !== null && c.slot === state.mySlot; }

function teamLabel(slot) {
  return slot === state.mySlot ? "Your Team" : CPU_NAMES[slot];
}

function pickCode(overall) {
  const p = pickInfo(overall);
  return p.round + "." + String(p.slot + 1).padStart(2, "0");
}

function picksUntilMyTurn() {
  let n = currentOverall();
  let gap = 0;
  while (n <= totalPicks() && pickInfo(n).slot !== state.mySlot) { n++; gap++; }
  return gap;
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

function needMultiplier(slot, pos, round) {
  const have = countAt(slot, pos);

  if (have >= maxAt(pos)) return 999;              // roster limit

  // Kickers and defences go at the very end of any draft, so the cutoffs are
  // measured back from the last round rather than written down as 13 and 12.
  if (pos === "K"   && round < league.rounds - 1) return 999;
  if (pos === "DST" && round < league.rounds - 2) return 999;

  // One of each is enough, whatever "enough" is set to. A superflex league
  // that starts two quarterbacks gets two.
  if (pos === "QB"  && have >= league.starters.QB)  return 999;
  if (pos === "K"   && have >= league.starters.K)   return 999;
  if (pos === "DST" && have >= league.starters.DST) return 999;

  const need = league.starters[pos] || 0;
  if (have < need)       return 0.80;   // still filling a starting slot
  if (have < need + 2)   return 1.00;   // sensible depth
  return 1.45;                          // hoarding
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

function makePick(player) {
  const c = onTheClock();
  if (!c || player.drafted) return;

  player.drafted = true;
  state.picks.push({ overall: currentOverall(), round: c.round, slot: c.slot, player: player });
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
    const n = (p.overall * 7919 + state.seed * 104729) % 1000;
    p.jitter = (n / 1000) * 6 - 3;
  });
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

  state.simTimer = setTimeout(cpuStep, CPU_DELAY);
}

function runCPUs() {
  stopClock();
  if (draftOver() || isMyTurn()) { resetClock(); render(); return; }
  state.simulating = true;
  render();
  state.simTimer = setTimeout(cpuStep, CPU_DELAY);
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

function draftAndAdvance(player) {
  makePick(player);
  state.lastPick = state.picks[state.picks.length - 1];
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
  resetClock();
  render();
}

function autoDraftRest() {
  stopSim();
  stopClock();
  state.lastPick = null;
  let guard = 0;
  while (!draftOver() && guard++ < totalPicks()) {
    const c = onTheClock();
    const choice = cpuChoice(c.slot, c.round);
    if (!choice) break;
    makePick(choice);
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
  state.lastPick = null;
  board.forEach((p) => { p.drafted = false; p.jitter = 0; });
  state.picks = [];
  state.started = false;
  state.paused = false;
  tabsNav.hidden = true;
  actionbar.hidden = true;
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
function leaveForHome() {
  if (state.started && !draftOver() &&
      !confirm("Leave this draft?\n\nIt stays saved, and the setup screen will " +
               "offer to resume it.")) return;
  goHome();
}


/* ---- 9. The pick clock ---------------------------------
   setInterval runs a function once a second. When the clock
   hits zero we draft the top suggestion, which is exactly
   what FantasyPros does.                                   */

function stopClock() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}

function clockRunnable() {
  return state.clockLength > 0 && !draftOver() && isMyTurn();
}

// Start counting down from whatever is on the clock right now.
function startTicking() {
  stopClock();
  state.timerId = setInterval(function () {
    state.timeLeft--;
    if (state.timeLeft <= 0) {
      stopClock();
      const auto = suggestions()[0];
      if (auto) draftAndAdvance(auto);
    } else {
      renderHeader();
    }
  }, 1000);
}

// Put a fresh clock on the board. Called after every pick.
function resetClock() {
  stopClock();
  if (!clockRunnable()) return;
  state.timeLeft = state.clockLength;
  if (!state.paused) startTicking();
}

// Pausing only stops the countdown. You can still draft while
// paused, and the pause survives until you turn it back off.
function togglePause() {
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
function renderActionBar() {
  const done = draftOver();
  $("newDraftBtn").hidden = !done;
  $("pauseBtn").hidden    = done;
  $("undoBtn").hidden     = done;
  $("autoBtn").hidden     = done;
  if (!done) renderPauseButton();
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

function suggestions() {
  const c = onTheClock();
  const round = c ? c.round : league.rounds;

  return board
    .filter(function (p) {
      if (p.drafted) return false;
      if (isRuledOut(p)) return false;
      if (state.filterSuggest !== "ALL" && p.pos !== state.filterSuggest) return false;
      if (countAt(state.mySlot, p.pos) >= maxAt(p.pos)) return false;
      return true;
    })
    .map(function (p) {
      const risk = isRisky(p) ? 1.35 : 1;
      return { player: p, score: (p.adp + p.jitter) * needMultiplier(state.mySlot, p.pos, round) * risk };
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
  rush_yd: 0.1, rush_td: 6, rush_2pt: 2,
  rec: 0.5, rec_yd: 0.1, rec_td: 6, rec_2pt: 2,
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
function scoringLabel(scoring) {
  const s = scoring || league.scoring;
  return s === "ppr" ? "full PPR" : s === "standard" ? "standard" : "half PPR";
}

// True when a stat line represents a game or season that actually happened.
// Asked of the raw data rather than of a points total, because a real week
// can legitimately score zero and a week that never happened cannot be told
// apart from it any other way.
function didPlay(block) {
  if (!block) return false;
  return Object.keys(block).some((k) => k !== "w" && k !== "gp" && block[k]);
}

function fantasyPoints(block) {
  if (!block) return 0;
  let total = 0;
  Object.keys(league.rules).forEach(function (rule) {
    const key = STAT_KEYS[rule];
    const value = key ? block[key] : 0;
    if (value) total += value * league.rules[rule];
  });
  // A tenth of a point, the precision the raw data arrives in.
  return Math.round(total * 10) / 10;
}

// Season keys, oldest first. Nothing here assumes which years exist.
function seasonKeys(stat) {
  return stat && stat.s ? Object.keys(stat.s).sort() : [];
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

// Projected points under this app's scoring, and each player's rank at
// their position by projection rather than by ADP.
function buildProjections() {
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
}

function label(score) {
  return score >= 75 ? "Very High" : score >= 55 ? "High"
       : score >= 35 ? "Medium"    : score >= 18 ? "Low" : "Very Low";
}

function draftSignals(player) {
  const s = statOf(player);
  if (!s || player.projPts === null) return null;

  const reasons = { overall: [], upside: [], bust: [] };

  // ---- Overall: value over a replacement starter, in your scoring ----
  const vor = player.projPts - (REPLACEMENT_PTS[player.pos] || 0);
  const best = Math.max.apply(null, board.map((p) =>
    p.projPts === null ? 0 : p.projPts - (REPLACEMENT_PTS[p.pos] || 0)));
  const overall = Math.max(0, Math.min(100, (vor / (best || 1)) * 100));
  reasons.overall.push(Math.round(player.projPts) + " projected points, " +
    (vor >= 0 ? "+" : "") + Math.round(vor) + " vs a replacement " + player.pos);

  // How far the projections disagree with the market, at his position.
  const gap = player.projPosRank ? (player.posRank - player.projPosRank) : 0;

  // ---- Upside ----
  let upside = 20;
  if (gap >= 4)  { upside += Math.min(35, gap * 2.5);
                   reasons.upside.push("projects " + player.pos + player.projPosRank +
                     " but drafted as " + player.pos + player.posRank); }
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
                   reasons.bust.push("drafted as " + player.pos + player.posRank +
                     " but projects only " + player.pos + player.projPosRank); }
  if (isRuledOut(player)) { bust += 40; reasons.bust.push("ruled out"); }
  else if (isRisky(player)) { bust += 22; reasons.bust.push("carrying a " + player.inj + " designation"); }
  else if (player.inj) { bust += 12; reasons.bust.push(player.inj + " designation"); }

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
function bestLineup(roster) {
  const used = [];
  const slots = lineupSlots();

  return slots.map(function (slot) {
    const eligible = roster.filter(function (p) {
      if (used.indexOf(p) >= 0) return false;
      return slot === "FLEX" ? ["RB", "WR", "TE"].indexOf(p.pos) >= 0 : p.pos === slot;
    }).sort((a, b) => a.posRank - b.posRank);

    const pick = eligible[0] || null;
    if (pick) used.push(pick);
    return { slot: slot, player: pick };
  });
}

function analyseTeam(slot) {
  const roster = rosterOf(slot);
  const picks  = state.picks.filter((p) => p.slot === slot);
  const lineup = bestLineup(roster);

  // 1. starter strength
  let starters = 0;
  lineup.forEach(function (s) { if (s.player) starters += aboveReplacement(s.player); });

  // 2. draft value: taken later than the board said = a bargain
  let value = 0;
  picks.forEach(function (p) { value += (p.player.overall - p.overall); });

  // 3. roster construction
  let build = 100;
  lineup.forEach(function (s) { if (!s.player) build -= 14; });          // hole in the lineup
  ["QB", "K", "DST"].forEach(function (pos) {
    // A second kicker is wasted; a second quarterback is only wasted in a
    // league that starts one, which is why this counts past the starters.
    build -= Math.max(0, countAt(slot, pos) - league.starters[pos]) * 9;
  });
  // Thin at the two positions you start most of, once the FLEX is counted.
  ["RB", "WR"].forEach(function (pos) {
    if (countAt(slot, pos) < league.starters[pos] + league.flex + 1) build -= 6;
  });

  // 4. bye week exposure, judged on the starting nine only
  const byes = {};
  lineup.forEach(function (s) { if (s.player) byes[s.player.bye] = (byes[s.player.bye] || 0) + 1; });
  let worstBye = 0, worstWeek = null;
  Object.keys(byes).forEach(function (week) {
    if (byes[week] > worstBye) { worstBye = byes[week]; worstWeek = Number(week); }
  });

  // biggest bargain and biggest reach
  let bargain = null, reach = null;
  picks.forEach(function (p) {
    const gap = p.player.overall - p.overall;
    if (!bargain || gap > bargain.gap) bargain = { pick: p, gap: gap };
    if (!reach   || gap < reach.gap)   reach   = { pick: p, gap: gap };
  });

  return { slot: slot, roster: roster, lineup: lineup, byes: byes,
           starters: starters, value: value, build: build,
           byePenalty: -Math.max(0, worstBye - 2) * 20,
           worstBye: worstBye, worstWeek: worstWeek,
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
    t.grade = GRADE_SCALE[i];
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

function avatar(player, small) {
  const url = photoUrl(player);
  const photo = url
    ? `<img src="${url}" alt="" loading="lazy" class="${player.pos === "DST" ? "logo" : ""}" onerror="this.remove()">`
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

function renderHeader() {
  appbar.className = "appbar";

  // The pick line and the counter both describe a draft in progress, so
  // before one starts the header is just the name and the theme toggle.
  // The player count lives under the setup card, on the freshness line,
  // which is where the rest of the data's provenance already is.
  pickLabel.hidden  = !state.started;
  countBlock.hidden = !state.started;

  if (!state.started) {
    statusLine.textContent = "The Draft Room";
    return;
  }

  if (draftOver()) {
    appbar.classList.add("live");
    statusLine.textContent = "Draft complete";
    pickLabel.textContent  = totalPicks() + " picks made";
    rightLabel.textContent = "Rounds";
    rightValue.textContent = league.rounds;
    return;
  }

  const overall = currentOverall();

  if (isMyTurn()) {
    const urgent = state.clockLength && !state.paused && state.timeLeft <= 10;
    appbar.classList.add(urgent ? "urgent" : "my-turn");
    statusLine.textContent = "You're on the clock!";
    pickLabel.textContent  = "Pick " + pickCode(overall) + " (" + overall + " Overall)";
    if (state.clockLength) {
      rightLabel.textContent = state.paused ? "Paused" : "Time left";
      rightValue.textContent = clockText();
    } else {
      rightLabel.textContent = "Available";
      rightValue.textContent = board.filter((p) => !p.drafted).length;
    }
  } else {
    appbar.classList.add("live");
    statusLine.textContent = teamLabel(pickInfo(overall).slot);
    pickLabel.textContent  = "Pick " + pickCode(overall) + " (" + overall + " Overall)";
    rightLabel.textContent = "Your turn in";
    rightValue.textContent = picksUntilMyTurn();
  }
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
            <span class="badge ${p.pos}">${p.pos}</span> ${p.team} &middot; Bye ${p.bye} ${injBadge(p)}
          </div>
          <div class="sug-stats">Overall ${p.overall} (${p.pos}${p.posRank}) &middot; ADP ${p.adp.toFixed(1)} &middot; ${valueText}</div>
          <div class="sug-meta" style="margin-top:5px">
            ${tierChip(p)}
            ${byeChip(p)}
          </div>
        </div>
        <button class="draft-btn" data-draft="${p.name}" ${isMyTurn() ? "" : "disabled"}>Draft</button>
      </div>`;
  }).join("");
}

function renderPlayers() {
  const tbody = document.querySelector("#playerTable tbody");
  const hide  = $("hideDrafted").checked;

  const term = state.search.trim().toLowerCase();

  const visible = board.filter(function (p) {
    if (state.filterPlayers !== "ALL" && p.pos !== state.filterPlayers) return false;
    if (hide && p.drafted) return false;
    if (term && p.name.toLowerCase().indexOf(term) < 0
             && p.team.toLowerCase().indexOf(term) < 0) return false;
    return true;
  });

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--ink-light);padding:26px">
      No players match that search.</td></tr>`;
    return;
  }

  tbody.innerHTML = visible.map(function (p) {
    return `
      <tr class="${p.drafted ? "drafted" : ""} ${adpConflict(p) ? "conflict" : ""}">
        <td>
          <span class="nm name-link" data-player="${p.name}">${p.name}</span>
          <span class="meta"><span class="badge ${p.pos}">${p.pos}</span> ${p.team} &middot; Bye ${p.bye}
            ${injBadge(p)} <span class="chip tier">T${p.tier}</span></span>
        </td>
        <td class="num">${p.pos}${p.posRank}</td>
        <td class="num">${p.adp.toFixed(1)}</td>
        <td><button class="draft-btn" data-draft="${p.name}"
             ${p.drafted || !isMyTurn() ? "disabled" : ""}>${p.drafted ? "Taken" : "Draft"}</button></td>
      </tr>`;
  }).join("");
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
    html += `<div class="hd ${s === state.mySlot ? "me" : ""}">${s === state.mySlot ? "YOU" : CPU_NAMES[s].split(" ")[0]}</div>`;
  }

  for (let r = 1; r <= league.rounds; r++) {
    html += `<div class="rd">${r}</div>`;
    for (let s = 0; s < league.teams; s++) {
      const pick = state.picks.find((p) => p.round === r && p.slot === s);
      if (pick) {
        const last = lastName(pick.player.name);
        html += `<div class="cell ${pick.player.pos} ${s === state.mySlot ? "mine" : ""}">
                   <b>${last}</b><s>${pick.player.pos} &middot; ${pick.player.team}</s></div>`;
      } else {
        const c = onTheClock();
        const isNow = c && c.round === r && c.slot === s;
        html += `<div class="cell empty ${isNow ? "now" : ""}">${r}.${String(s + 1).padStart(2, "0")}</div>`;
      }
    }
  }

  grid.innerHTML = html;
}

function renderTeam() {
  const mine = rosterOf(state.mySlot).slice();
  const used = [];

  const rows = lineupSlots().map(function (slot) {
    const eligible = mine.filter(function (p) {
      if (used.indexOf(p) >= 0) return false;
      return slot === "FLEX" ? ["RB", "WR", "TE"].indexOf(p.pos) >= 0 : p.pos === slot;
    });
    const pick = eligible[0] || null;
    if (pick) used.push(pick);
    return rosterRow(slot, pick, false);
  });

  $("startersList").innerHTML = rows.join("");

  // The bench is however many seats are left once the starters are seated.
  const bench = mine.filter((p) => used.indexOf(p) < 0);
  const benchRows = [];
  for (let i = 0; i < league.bench; i++) benchRows.push(rosterRow("BN", bench[i] || null, true));
  $("benchList").innerHTML = benchRows.join("");
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
        <div class="rmeta"><span class="badge ${player.pos}">${player.pos}</span> ${player.team} &middot; Bye ${player.bye} ${injBadge(player)}</div>
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
          <div class="pick-meta"><span class="badge ${pick.player.pos}">${pick.player.pos}</span> ${pick.player.team} &middot; Bye ${pick.player.bye}</div>
        </div>
      </div>`;
  });

  holder.innerHTML = html;
}

function renderTicker() {
  const ticker = $("ticker");
  const pick = state.lastPick;

  if (!pick) { ticker.hidden = true; return; }

  ticker.hidden = false;
  ticker.innerHTML = `
    <span class="tick-pick">${pickCode(pick.overall)}</span>
    ${avatar(pick.player, true)}
    <div class="tick-body">
      <div class="tick-team">${teamLabel(pick.slot)} selected</div>
      <div class="tick-name">
        ${pick.player.name}
        <span class="badge ${pick.player.pos}">${pick.player.pos}</span>
        <span class="tick-tm">${pick.player.team} &middot; Bye ${pick.player.bye}</span>
        ${injBadge(pick.player)}
      </div>
    </div>
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
      ${bar("Draft value", (me.value >= 0 ? "+" : "") + me.value + " picks of ADP value",
            me.valueScaled, tone(me.valueScaled))}
      ${bar("Roster construction", me.build + " / 100",
            me.buildScaled, tone(me.buildScaled))}
      ${bar("Bye week safety",
            me.worstBye >= 3 ? me.worstBye + " starters off in week " + me.worstWeek : "no bad weeks",
            me.byePenaltyScaled, tone(me.byePenaltyScaled))}
    </div>`;

  if (me.bargain && me.reach) {
    html += `<div class="callouts">
      <div class="callout good">
        <div class="lbl">Best value</div>
        <div class="val">${me.bargain.pick.player.name}</div>
        <div class="sub">Taken at ${pickCode(me.bargain.pick.overall)}, board had him ${me.bargain.pick.player.overall}${me.bargain.gap > 0 ? " &mdash; " + me.bargain.gap + " picks late" : ""}</div>
      </div>
      <div class="callout ${me.reach.gap < -8 ? "bad" : ""}">
        <div class="lbl">Biggest reach</div>
        <div class="val">${me.reach.pick.player.name}</div>
        <div class="sub">Taken at ${pickCode(me.reach.pick.overall)}, board had him ${me.reach.pick.player.overall}${me.reach.gap < 0 ? " &mdash; " + Math.abs(me.reach.gap) + " picks early" : ""}</div>
      </div>
    </div>`;
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
  all.slice().sort((a, b) => a.rank - b.rank).forEach(function (t) {
    html += `<tr class="${t.slot === state.mySlot ? "me" : ""}">
        <td class="rk">${t.rank}</td>
        <td>${teamLabel(t.slot)}</td>
        <td class="num">${Math.round(t.starters)}</td>
        <td class="gr">${t.grade}</td>
      </tr>`;
  });
  html += `</tbody></table>

    <p class="method">Starter strength is 50% of the grade: every starter scored by how many
    places above replacement level they rank at their position, where replacement is
    ${replacementText()} for this ${league.teams}-team league${league.flex ? " with a FLEX" : ""}.
    Draft value is 25%: how far each
    player fell past their ADP when you took them. Roster construction is 15%, docking unfilled
    starting slots, duplicate quarterbacks, kickers or defenses, and thin running back or receiver
    depth. Bye week safety is the last 10%, penalising any week with more than two starters off.
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

function openSheet(player) {
  sheetPlayer = player;
  const s = statOf(player);
  const sig = draftSignals(player);

  $("sheetHead").innerHTML = `
    ${avatar(player)}
    <div>
      <h3>${player.name}</h3>
      <div class="sub">
        <span class="badge ${player.pos}">${player.pos}</span>
        ${player.team} &middot; Bye ${player.bye} ${injBadge(player)}
      </div>
      <div class="facts">
        ADP ${player.adp.toFixed(1)} &middot; ${player.pos}${player.posRank}
        ${s && s.age ? " &middot; age " + s.age : ""}
        ${s && s.exp !== undefined ? " &middot; " + (s.exp === 0 ? "rookie" : s.exp + " yrs") : ""}
        ${s && s.depth ? " &middot; " + s.depth + (s.order ? " #" + s.order : "") : ""}
      </div>
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
      ${meter("Overall", sig.overall, sig.overall >= 55 ? "good" : "", sig.reasons.overall)}
      ${meter("Upside",  sig.upside,  sig.upside  >= 55 ? "good" : "", sig.reasons.upside)}
      ${meter("Bust risk", sig.bust,  sig.bust >= 55 ? "bad" : sig.bust >= 35 ? "warn" : "", sig.reasons.bust)}

      <p class="section-label">2026 projection &middot; ${scoringLabel()}</p>
      <div class="statgrid">
        <div class="statbox"><div class="k">Points</div><div class="v">${Math.round(fantasyPoints(p))}</div></div>
        <div class="statbox"><div class="k">Per game</div><div class="v">${p.gp ? (fantasyPoints(p) / p.gp).toFixed(1) : "&mdash;"}</div></div>
        <div class="statbox"><div class="k">Pos rank</div><div class="v">${player.projPosRank ? player.pos + player.projPosRank : "&mdash;"}</div></div>
        <div class="statbox"><div class="k">vs ADP</div><div class="v">${player.projPosRank ? (player.posRank - player.projPosRank >= 0 ? "+" : "") + (player.posRank - player.projPosRank) : "&mdash;"}</div></div>
      </div>
      <p class="method">Overall is projected points above the last startable player at this position
      in a ${league.teams}-team league, ${player.pos}${replacementRank(player.pos)} on this board.
      Upside and bust risk weigh how far the projection disagrees with ADP,
      plus experience, age, depth chart position, injury designation and last season's availability.
      This is one model, not a consensus of analysts.</p>`;
  }

  // ---------- game logs ----------
  // Column set is chosen from player.pos, never from whether a stat happens
  // to be present. A running back who threw one trick-play pass is still a
  // running back, and needs his receiving line.
  let logs;
  if (!s || !s.w || !s.w.length) {
    logs = `<div class="nodata">No week-by-week logs stored for this player.</div>`;
  } else {
    // Whether a week happened is a question about the raw data, never about
    // what it scored, so both checks go through didPlay(). The old version
    // listed a handful of stats by hand and would have called a week blank
    // for anyone whose only contribution was outside that list.
    const played = s.w.filter(didPlay);
    const avg = played.length ? played.reduce((a, g) => a + fantasyPoints(g), 0) / played.length : 0;
    const cols = logColumns(player, s.w);

    const rows = s.w.map(function (g) {
      const blank = !didPlay(g);
      const points = fantasyPoints(g);
      const cells = cols.keys.map(function (k, i) {
        const v = k === "w" ? g.w : k === "pts" ? points : cellValue(g, k);
        const tone = k === "pts" && !blank
          ? (points >= avg * 1.4 ? "hi" : points <= avg * 0.5 ? "lo" : "") : "";
        return `<td class="${tone}">${v === undefined ? "&mdash;" : v}</td>`;
      }).join("");
      return `<tr class="${blank ? "bye" : ""}">${cells}</tr>`;
    }).join("");

    logs = `<p class="section-label">2025 week by week &middot; ${avg.toFixed(1)} per game played</p>
      <div class="tblscroll"><table class="logtbl">
        <thead><tr>${cols.head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  // ---------- seasons ----------
  let seasons;
  if (!s || (!s.s && !s.p)) {
    seasons = `<div class="nodata">No season history stored for this player.</div>`;
  } else {
    const years = seasonKeys(s).map((y) => [y, s.s[y]]);
    if (s.p) years.push(["2026 proj", s.p]);

    const sample = years.map((y) => y[1]);
    if (s.w) sample.push.apply(sample, s.w);
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
    seasons = `<p class="section-label">${span.length ? span[0] + " to " + span[span.length - 1] : "Career"}
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
            <span class="badge ${m.pos}">${m.pos}</span>
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
    <div class="sheet-view" id="v-logs">${logs}</div>
    <div class="sheet-view" id="v-seasons">${seasons}</div>
    <div class="sheet-view" id="v-depth">${depth}</div>`;

  document.querySelectorAll("#sheetTabs button").forEach(function (b, i) {
    b.classList.toggle("on", i === 0);
  });

  $("sheet").hidden = false;
  $("sheetBackdrop").hidden = false;
  $("sheetBody").scrollTop = 0;
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
  renderSuggestions();
  renderPlayers();
  renderBoard();
  renderTeam();
  renderPicks();
  saveDraft();
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
  return [cfg.teams, cfg.rounds, cfg.scoring, cfg.flex, cfg.bench]
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
    return data && data.v === 2 && data.picks && data.league ? data : null;
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

  tabsNav.hidden = false;
  actionbar.hidden = false;
  $("resumeBar").hidden = true;
  showPanel("tab-suggest");
  document.querySelectorAll(".tabs button").forEach((b, i) => b.classList.toggle("on", i === 0));

  resetClock();
  render();
  window.scrollTo(0, 0);
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

// Fill a select with a range of numbers. The label carries the position, so
// each control says what it is without needing a label of its own.
function fillRange(select, from, to, chosen, labeller) {
  let html = "";
  for (let i = from; i <= to; i++) {
    html += `<option value="${i}"${i === chosen ? " selected" : ""}>${labeller(i)}</option>`;
  }
  select.innerHTML = html;
}

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
  ["Passing",  ["pass_yd", "pass_td", "pass_int", "pass_2pt"]],
  ["Rushing",  ["rush_yd", "rush_td", "rush_2pt"]],
  ["Receiving", ["rec", "rec_yd", "rec_td", "rec_2pt"]],
  ["Turnovers and returns", ["fum_lost", "kr_td", "pr_td"]],
  ["Kicking",  ["xpm", "xpmiss", "fgmiss", "fgm_0_19", "fgm_20_29",
                "fgm_30_39", "fgm_40_49", "fgm_50_59", "fgm_60p"]],
  ["Defence and special teams",
               ["sack", "int", "fum_rec", "safe", "def_td", "def_st_td",
                "blk_kick", "def_2pt"]],
  ["Points allowed by a defence",
               ["pts_allow_0", "pts_allow_1_6", "pts_allow_7_13",
                "pts_allow_14_20", "pts_allow_21_27", "pts_allow_28_34",
                "pts_allow_35p"]]
];

const RULE_LABELS = {
  pass_yd: "Per passing yard", pass_td: "Passing TD",
  pass_int: "Interception thrown", pass_2pt: "Passing 2-pt",
  rush_yd: "Per rushing yard", rush_td: "Rushing TD", rush_2pt: "Rushing 2-pt",
  rec: "Per reception", rec_yd: "Per receiving yard",
  rec_td: "Receiving TD", rec_2pt: "Receiving 2-pt",
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
function renderScoringFields() {
  $("scoringFields").innerHTML = RULE_GROUPS.map(function (group) {
    const rows = group[1].map(function (rule) {
      return `<label class="rule">
          <span>${RULE_LABELS[rule] || rule}</span>
          <input type="number" step="0.01" data-rule="${rule}" value="${league.rules[rule]}">
        </label>`;
    }).join("");
    return `<p class="section-label">${group[0]}</p><div class="rulegrid">${rows}</div>`;
  }).join("") +
  `<p class="hint">Historical seasons and weeks carry every stat above.
   Sleeper's projections are coarser: they do not forecast defensive
   touchdowns, safeties or points allowed, so those rules move a player's
   past far more than his 2026 projection.</p>`;
}

function scoringSummary() {
  const r = league.rules;
  const rec = r.rec === 1 ? "full PPR" : r.rec === 0.5 ? "half PPR"
            : r.rec === 0 ? "no PPR" : r.rec + " per catch";
  return `${rec} · ${r.pass_td} pt passing TD · ${r.rush_td} pt rushing TD`;
}

function fillSetupControls() {
  fillRange($("roundCount"), 8, 20, league.rounds, (i) => i + " rounds");
  POSITIONS.forEach(function (pos) {
    const label = pos === "DST" ? "D/ST" : pos;
    fillRange($("start" + pos), 0, SLOT_LIMITS[pos], league.starters[pos],
              (i) => label + " " + i);
  });
  fillRange($("startFLEX"), 0, 3, league.flex, (i) => "FLEX " + i);
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
  league.flex    = Number($("startFLEX").value);
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
    return `${starterCount()} starters + ${league.flex} FLEX + ${league.bench} bench ` +
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
    `${starterCount()} starters + ${league.flex} FLEX + ${league.bench} bench ` +
    `= ${league.rounds} rounds, ${totalPicks()} picks.`;
  note.classList.toggle("bad", !!problem);
  $("startBtn").disabled = !!problem;
  $("scoringSummary").textContent = scoringSummary();

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
  const rule = e.target.dataset && e.target.dataset.rule;
  if (!rule) return;
  const value = Number(e.target.value);
  league.rules[rule] = isNaN(value) ? 0 : value;
  refreshSetup();
});

$("resetScoring").addEventListener("click", function () {
  league.rules = rulesForFormat(league.scoring);
  renderScoringFields();
  refreshSetup();
});

["teamCount", "roundCount", "scoring", "startFLEX", "benchCount"]
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

$("randomizeBtn").addEventListener("click", function () {
  slotSelect.value = Math.floor(Math.random() * league.teams);
});

$("startBtn").addEventListener("click", function () {
  readSetup();
  if (setupProblem()) { refreshSetup(); return; }   // belt and braces; the button is disabled too

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

  tabsNav.hidden   = false;
  actionbar.hidden = false;
  showPanel("tab-suggest");
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("on"));
  document.querySelector('.tabs button[data-tab="tab-suggest"]').classList.add("on");

  render();
  runCPUs();
  window.scrollTo(0, 0);
});

// resume / discard live inside a re-rendered banner, so they are delegated
document.addEventListener("click", function (e) {
  if (e.target.id === "resumeBtn") { const d = readSave(); if (d) resumeDraft(d); }
  if (e.target.id === "discardBtn") { clearSave(); showResumeBar(); }
});

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

// The header is never rebuilt by render(), so these two can hold a direct
// listener rather than going through the delegated handler below.
$("homeBtn").addEventListener("click", leaveForHome);
themeBtn.addEventListener("click", function () {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
});
$("pauseBtn").addEventListener("click", togglePause);
$("undoBtn").addEventListener("click", undo);
$("autoBtn").addEventListener("click", autoDraftRest);
$("restartBtn").addEventListener("click", restart);
$("hideDrafted").addEventListener("change", renderPlayers);

$("playerSearch").addEventListener("input", function () {
  state.search = this.value;
  renderPlayers();
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

  const link = event.target.closest ? event.target.closest("[data-player]") : null;
  if (link) {
    const chosen = board.find((p) => p.name === link.dataset.player);
    if (chosen) openSheet(chosen);
    return;
  }
  const name = event.target.dataset ? event.target.dataset.draft : null;
  if (!name || !isMyTurn()) return;
  const player = board.find((p) => p.name === name && !p.drafted);
  if (player) draftAndAdvance(player);
});

document.querySelectorAll(".tabs button").forEach(function (button) {
  button.addEventListener("click", function () {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("on"));
    button.classList.add("on");
    showPanel(button.dataset.tab);
  });
});

$("suggestFilter").addEventListener("click", function (e) {
  if (e.target.tagName !== "BUTTON") return;
  this.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  e.target.classList.add("on");
  state.filterSuggest = e.target.dataset.pos;
  renderSuggestions();
});

$("playerFilter").addEventListener("click", function (e) {
  if (e.target.tagName !== "BUTTON") return;
  this.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
  e.target.classList.add("on");
  state.filterPlayers = e.target.dataset.pos;
  renderPlayers();
});

// Everything above this line is a definition. This reads the setup screen,
// builds the board from the matching ADP set, and draws the page.
refreshSetup();
