/* ==========================================================
   Alpine Draft Room — behaviour

   Read the section headers first. Each one does one job.
   ========================================================== */


/* ---- 1. League settings ---------------------------------
   Hardcoded on purpose. FantasyPros needs four screens of
   configuration because it serves every league on earth.
   We serve one, so these are just constants.              */

const TEAM_COUNT  = 10;
const ROUNDS      = 14;
const TOTAL_PICKS = TEAM_COUNT * ROUNDS;

const STARTERS = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DST: 1 };  // plus 1 FLEX
const MAX_POS  = { QB: 4, RB: 8, WR: 8, TE: 3, K: 3, DST: 3 };

// A player carrying one of these has been ruled out. CPU teams never
// take them and they never appear in your suggestions.
const RULED_OUT = ["O", "IR", "SUS", "NFI", "DNR"];

// Available, but carrying real risk. Everyone drafts them later.
const RISKY = ["D", "PUP"];

// Same idea as REPLACEMENT below, but used by the projection maths,
// which has to run before the analysis section is reached.
const REPLACEMENT_LEVEL = { QB: 11, RB: 25, WR: 28, TE: 11, K: 11, DST: 11 };
const REPLACEMENT_PTS = {};

const CPU_NAMES = [
  "Wild Goose Chase", "Bijan Mustard", "Nacua Matata", "The Gibbs Ultimatum",
  "Kupp of Joe", "Purdy Vacant", "Hurts So Good", "Saquon For The Team",
  "Lambo No. 5", "Bone-Thugs-N-Montgomery"
];


/* ---- 2. Page elements ---------------------------------- */

const $ = (id) => document.getElementById(id);

const appbar     = $("appbar");
const statusLine = $("statusLine");
const pickLabel  = $("pickLabel");
const rightLabel = $("rightLabel");
const rightValue = $("rightValue");
const tabsNav    = $("tabs");
const actionbar  = $("actionbar");


/* ---- 3. The player board -------------------------------
   One sorted copy of PLAYERS. Every player gets a position
   rank (RB1, RB2...) and a small random jitter that stays
   fixed for the whole draft, so undoing a pick doesn't
   reshuffle how the CPUs think.                           */

const board  = PLAYERS.slice().sort((a, b) => a.adp - b.adp);
const counts = {};

board.forEach(function (player, i) {
  counts[player.pos] = (counts[player.pos] || 0) + 1;
  player.posRank = counts[player.pos];
  player.overall = i + 1;
  player.drafted = false;
  player.jitter  = 0;
});


/* ---- 4. State ------------------------------------------ */

const state = {
  mySlot: 0,        // 0-indexed draft position
  clockLength: 60,  // seconds, 0 means no clock
  started: false,
  picks: [],        // { overall, round, slot, player }
  timeLeft: 0,
  timerId: null,
  paused: false,
  simTimer: null,     // handle for the CPU pick animation
  simulating: false,
  lastPick: null,     // the pick currently shown in the ticker
  filterSuggest: "ALL",
  filterPlayers: "ALL"
};


/* ---- 5. Snake maths ------------------------------------
   Overall pick 1 is round 1 slot 1. In even rounds the
   order reverses, which is the only thing that makes a
   snake draft a snake.                                     */

function pickInfo(overall) {
  const round   = Math.ceil(overall / TEAM_COUNT);
  const inRound = overall - (round - 1) * TEAM_COUNT;
  const slot    = (round % 2 === 0) ? (TEAM_COUNT + 1 - inRound) : inRound;
  return { round: round, slot: slot - 1 };
}

function currentOverall() { return state.picks.length + 1; }
function draftOver()      { return state.picks.length >= TOTAL_PICKS; }
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
  while (n <= TOTAL_PICKS && pickInfo(n).slot !== state.mySlot) { n++; gap++; }
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

  if (have >= MAX_POS[pos])          return 999;   // roster limit
  if (pos === "K"   && round < 13)   return 999;   // nobody drafts a kicker early
  if (pos === "DST" && round < 12)   return 999;
  if (pos === "QB"  && have >= 1)    return 999;   // one QB is enough in a 10-teamer
  if (pos === "K"   && have >= 1)    return 999;   // never two kickers
  if (pos === "DST" && have >= 1)    return 999;   // never two defenses

  const need = STARTERS[pos] || 0;
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

const CPU_DELAY = 750;   // milliseconds between CPU picks

function stopSim() {
  if (state.simTimer) { clearTimeout(state.simTimer); state.simTimer = null; }
  state.simulating = false;
}

function cpuStep() {
  if (draftOver() || isMyTurn()) {   // handing the clock back to you
    stopSim();
    state.lastPick = null;
    resetClock();
    render();
    return;
  }

  const c = onTheClock();
  const choice = cpuChoice(c.slot, c.round);
  if (!choice) { stopSim(); render(); return; }

  makePick(choice);
  state.lastPick = state.picks[state.picks.length - 1];
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
  while (!draftOver() && !isMyTurn() && guard++ < TOTAL_PICKS) {
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
  while (!draftOver() && guard++ < TOTAL_PICKS) {
    const c = onTheClock();
    const choice = cpuChoice(c.slot, c.round);
    if (!choice) break;
    makePick(choice);
  }
  render();
}

function restart() {
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
  render();
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
  const round = c ? c.round : ROUNDS;

  return board
    .filter(function (p) {
      if (p.drafted) return false;
      if (isRuledOut(p)) return false;
      if (state.filterSuggest !== "ALL" && p.pos !== state.filterSuggest) return false;
      if (countAt(state.mySlot, p.pos) >= MAX_POS[p.pos]) return false;
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


/* ---- 10a. Player stats and draft signals ---------------

   Everything here is computed, not asserted. There is no
   panel of experts behind it: it is projections, depth chart
   position, age and injury status, weighted and shown.     */

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

// Projected points under Alpine scoring, and each player's rank at
// their position by projection rather than by ADP.
(function buildProjections() {
  board.forEach(function (p) {
    const s = statOf(p);
    // A projection of zero means Sleeper has no real forecast, not that the
    // player will score nothing. Treating it as valid would drag replacement
    // level toward zero and make every other player look elite.
    p.projPts = s && s.p && s.p.pts > 0 ? s.p.pts : null;
  });

  Object.keys(REPLACEMENT_LEVEL).forEach(function (pos) {
    const ranked = board
      .filter((p) => p.pos === pos && p.projPts !== null)
      .sort((a, b) => b.projPts - a.projPts);

    ranked.forEach(function (p, i) { p.projPosRank = i + 1; });

    const cut = Math.min(REPLACEMENT_LEVEL[pos], ranked.length) - 1;
    REPLACEMENT_PTS[pos] = cut >= 0 && ranked[cut] ? ranked[cut].projPts : 0;
    if (ranked.length < REPLACEMENT_LEVEL[pos] && ranked.length) {
      REPLACEMENT_PTS[pos] = ranked[ranked.length - 1].projPts;
    }
  });
})();

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
    const a = pair[0].pts / pair[0].gp, b = pair[1].pts / pair[1].gp;
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

   Four components, each computed the same way for all ten
   teams, then min-max scaled across the room so a grade is
   always relative to the people you actually drafted with.

   No black box: every number below is printed on the page.  */

// The worst player at each position who would realistically start
// somewhere in a 10-team league. RB and WR run past 20 because the
// FLEX pulls extra starters from those two pools.
const REPLACEMENT = { QB: 11, RB: 25, WR: 28, TE: 11, K: 11, DST: 11 };

const WEIGHTS = { starters: 0.50, value: 0.25, build: 0.15, byes: 0.10 };

const GRADE_SCALE = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+"];

// How much better than a replacement-level starter this player is,
// measured in places up the positional board.
function aboveReplacement(player) {
  return Math.max(0, (REPLACEMENT[player.pos] || 11) - player.posRank);
}

// The best legal starting nine a roster can field.
function bestLineup(roster) {
  const used = [];
  const slots = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "DST", "K"];

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
    build -= Math.max(0, countAt(slot, pos) - 1) * 9;                    // wasted duplicate
  });
  if (countAt(slot, "RB") < 4) build -= 6;
  if (countAt(slot, "WR") < 4) build -= 6;

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

// Scale a raw component onto 0-100 relative to the other nine teams.
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
  for (let i = 0; i < TEAM_COUNT; i++) all.push(analyseTeam(i));

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

  if (!state.started) {
    statusLine.textContent = "Alpine Draft Room";
    pickLabel.textContent  = "Set up your draft below";
    rightLabel.textContent = "Players";
    rightValue.textContent = board.length;
    return;
  }

  if (draftOver()) {
    appbar.classList.add("live");
    statusLine.textContent = "Draft complete";
    pickLabel.textContent  = TOTAL_PICKS + " picks made";
    rightLabel.textContent = "Rounds";
    rightValue.textContent = ROUNDS;
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

function renderSuggestions() {
  const list = suggestions();
  const holder = $("suggestList");

  if (draftOver()) {
    holder.innerHTML = `<div class="empty"><p class="empty-title">Draft complete</p>
      <p class="empty-sub">Check My Team to see how the roster came out.</p></div>`;
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
        </div>
        <button class="draft-btn" data-draft="${p.name}" ${isMyTurn() ? "" : "disabled"}>Draft</button>
      </div>`;
  }).join("");
}

function renderPlayers() {
  const tbody = document.querySelector("#playerTable tbody");
  const hide  = $("hideDrafted").checked;

  const visible = board.filter(function (p) {
    if (state.filterPlayers !== "ALL" && p.pos !== state.filterPlayers) return false;
    if (hide && p.drafted) return false;
    return true;
  });

  tbody.innerHTML = visible.map(function (p) {
    return `
      <tr class="${p.drafted ? "drafted" : ""} ${adpConflict(p) ? "conflict" : ""}">
        <td>
          <span class="nm name-link" data-player="${p.name}">${p.name}</span>
          <span class="meta"><span class="badge ${p.pos}">${p.pos}</span> ${p.team} &middot; Bye ${p.bye} ${injBadge(p)}</span>
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
  let html = `<div class="hd"></div>`;

  for (let s = 0; s < TEAM_COUNT; s++) {
    html += `<div class="hd ${s === state.mySlot ? "me" : ""}">${s === state.mySlot ? "YOU" : CPU_NAMES[s].split(" ")[0]}</div>`;
  }

  for (let r = 1; r <= ROUNDS; r++) {
    html += `<div class="rd">${r}</div>`;
    for (let s = 0; s < TEAM_COUNT; s++) {
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
  const slots = [["QB", "QB"], ["RB", "RB"], ["RB", "RB"], ["WR", "WR"], ["WR", "WR"],
                 ["TE", "TE"], ["FLEX", "FLEX"], ["DST", "DST"], ["K", "K"]];

  const rows = slots.map(function (s) {
    const eligible = mine.filter(function (p) {
      if (used.indexOf(p) >= 0) return false;
      return s[1] === "FLEX" ? ["RB", "WR", "TE"].indexOf(p.pos) >= 0 : p.pos === s[1];
    });
    const pick = eligible[0] || null;
    if (pick) used.push(pick);
    return rosterRow(s[0], pick, false);
  });

  $("startersList").innerHTML = rows.join("");

  const bench = mine.filter((p) => used.indexOf(p) < 0);
  const benchRows = [];
  for (let i = 0; i < 5; i++) benchRows.push(rosterRow("BN", bench[i] || null, true));
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

  if (state.picks.length < TEAM_COUNT) {
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
        <h3>${done ? "Final grade" : "Grade so far"} &mdash; ${me.rank} of ${TEAM_COUNT}</h3>
        <p>${done ? "Draft complete." : "Updates after every pick."}
           Graded against the nine teams in this room, not against the league at large.</p>
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
    places above replacement level they rank at their position, where replacement is QB11, RB25,
    WR28, TE11, K11 and D/ST11 for a ten-team league with a FLEX. Draft value is 25%: how far each
    player fell past their ADP when you took them. Roster construction is 15%, docking unfilled
    starting slots, duplicate quarterbacks, kickers or defenses, and thin running back or receiver
    depth. Bye week safety is the last 10%, penalising any week with more than two starters off.
    Each component is scaled against the other nine teams before weighting.</p>`;

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

      <p class="section-label">2026 projection, Alpine scoring</p>
      <div class="statgrid">
        <div class="statbox"><div class="k">Points</div><div class="v">${Math.round(p.pts || 0)}</div></div>
        <div class="statbox"><div class="k">Per game</div><div class="v">${p.gp ? (p.pts / p.gp).toFixed(1) : "&mdash;"}</div></div>
        <div class="statbox"><div class="k">Pos rank</div><div class="v">${player.projPosRank ? player.pos + player.projPosRank : "&mdash;"}</div></div>
        <div class="statbox"><div class="k">vs ADP</div><div class="v">${player.projPosRank ? (player.posRank - player.projPosRank >= 0 ? "+" : "") + (player.posRank - player.projPosRank) : "&mdash;"}</div></div>
      </div>
      <p class="method">Overall is projected points above the last startable player at this position
      in a ten-team league. Upside and bust risk weigh how far the projection disagrees with ADP,
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
    const played = s.w.filter((g) => g.pts !== 0 || g.rc || g.ra || g.pa || g.fg || g.sk);
    const avg = played.length ? played.reduce((a, g) => a + g.pts, 0) / played.length : 0;
    const cols = logColumns(player, s.w);

    const rows = s.w.map(function (g) {
      const blank = g.pts === 0 && !g.rc && !g.ra && !g.pa && !g.fg && !g.sk && !g.kr;
      const cells = cols.keys.map(function (k, i) {
        const v = k === "w" ? g.w : k === "pts" ? g.pts : cellValue(g, k);
        const tone = k === "pts" && !blank
          ? (g.pts >= avg * 1.4 ? "hi" : g.pts <= avg * 0.5 ? "lo" : "") : "";
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
        const v = k === "pts" ? Math.round(y.pts || 0) : cellValue(y, k);
        return `<td>${v === undefined ? "&mdash;" : v}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    const span = seasonKeys(s);
    seasons = `<p class="section-label">${span.length ? span[0] + " to " + span[span.length - 1] : "Career"}
      &middot; scored under Alpine rules, not Sleeper's defaults</p>
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
  if (state.started) renderPauseButton();
  renderSuggestions();
  renderPlayers();
  renderBoard();
  renderTeam();
  renderPicks();
}


/* ---- 12. Tabs ------------------------------------------ */

function showPanel(id) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("on"));
  $(id).classList.add("on");
}


/* ---- 13. Wiring ---------------------------------------- */

// Fill the draft position dropdown with 1st through 10th.
const suffix = ["th", "st", "nd", "rd"];
const slotSelect = $("draftSlot");
for (let i = 1; i <= TEAM_COUNT; i++) {
  const s = (i % 100 > 10 && i % 100 < 14) ? "th" : (suffix[i % 10] || "th");
  slotSelect.innerHTML += `<option value="${i - 1}">${i}${s}</option>`;
}

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
  slotSelect.value = Math.floor(Math.random() * TEAM_COUNT);
});

$("startBtn").addEventListener("click", function () {
  state.mySlot      = Number(slotSelect.value);
  state.clockLength = Number($("pickClock").value);
  state.started     = true;

  // Give every player a small random wobble so no two mocks are identical.
  board.forEach((p) => { p.jitter = (Math.random() - 0.5) * 6; });

  tabsNav.hidden   = false;
  actionbar.hidden = false;
  showPanel("tab-suggest");
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.remove("on"));
  document.querySelector('.tabs button[data-tab="tab-suggest"]').classList.add("on");

  render();
  runCPUs();
  window.scrollTo(0, 0);
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

$("pauseBtn").addEventListener("click", togglePause);
$("undoBtn").addEventListener("click", undo);
$("autoBtn").addEventListener("click", autoDraftRest);
$("restartBtn").addEventListener("click", restart);
$("hideDrafted").addEventListener("change", renderPlayers);

// One listener on the whole page catches every Draft button,
// including buttons that don't exist yet. This is called
// event delegation and it saves re-attaching listeners on
// every redraw.
document.addEventListener("click", function (event) {
  if (event.target.id === "skipBtn") { skipSim(); return; }
  if (event.target.id === "sheetClose") { closeSheet(); return; }

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

render();
