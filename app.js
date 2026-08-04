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
          <div class="sug-name">${p.name}</div>
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
          <span class="nm">${p.name}</span>
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
        <div class="rname">${player.name}</div>
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
          <div class="pick-name">${pick.player.name}</div>
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
