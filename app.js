/* ==========================================================
   Alpine Draft Room — behaviour
   Read this top to bottom. It is deliberately short.
   ========================================================== */

/* ---- 1. Grab the parts of the page we need to talk to ---- */

const tbody       = document.querySelector("#playerTable tbody");
const posButtons  = document.querySelectorAll(".pos-filter button");
const tabButtons  = document.querySelectorAll(".tabs button");
const hideDrafted = document.querySelector("#hideDrafted");
const availCount  = document.querySelector("#availCount");


/* ---- 2. Sort by ADP, then number each player at their position ----
   After this loop every player has a posRank: the best running back
   is RB1, the second best is RB2, and so on. Anaplan would give you
   this with RANK grouped by position. Here you count it yourself.  */

const board  = PLAYERS.slice().sort((a, b) => a.adp - b.adp);
const counts = {};

board.forEach(function (player) {
  counts[player.pos] = (counts[player.pos] || 0) + 1;
  player.posRank = counts[player.pos];
  player.drafted = false;
});


/* ---- 3. Which position filter is active right now ---- */

let activePos = "ALL";


/* ---- 4. Draw the player table ----
   Called every time something changes. It always rebuilds the whole
   table from scratch, which sounds wasteful and is completely fine
   at this size.                                                    */

function drawPlayers() {
  tbody.innerHTML = "";

  const visible = board.filter(function (player) {
    if (activePos !== "ALL" && player.pos !== activePos) return false;
    if (hideDrafted.checked && player.drafted) return false;
    return true;
  });

  visible.forEach(function (player) {
    const row = document.createElement("tr");
    if (player.drafted) row.className = "drafted";

    row.innerHTML = `
      <td>
        <span class="nm">${player.name}</span>
        <span class="meta">
          <span class="badge ${player.pos}">${player.pos}</span>
          ${player.team} &middot; Bye ${player.bye}
        </span>
      </td>
      <td class="num">${player.pos}${player.posRank}</td>
      <td class="num">${player.adp.toFixed(1)}</td>
      <td><button class="draft-btn">${player.drafted ? "Taken" : "Draft"}</button></td>`;

    row.querySelector(".draft-btn").addEventListener("click", function () {
      player.drafted = true;
      drawPlayers();
    });

    tbody.appendChild(row);
  });

  availCount.textContent = board.filter(function (p) { return !p.drafted; }).length;
}


/* ---- 5. Position filter buttons ---- */

posButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    posButtons.forEach(function (b) { b.classList.remove("on"); });
    button.classList.add("on");
    activePos = button.dataset.pos;
    drawPlayers();
  });
});


/* ---- 6. Hide drafted checkbox ---- */

hideDrafted.addEventListener("change", drawPlayers);


/* ---- 7. Tab bar ----
   Switching tabs is nothing more than moving one CSS class around. */

tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    tabButtons.forEach(function (b) { b.classList.remove("on"); });
    button.classList.add("on");

    document.querySelectorAll(".panel").forEach(function (panel) {
      panel.classList.remove("on");
    });
    document.querySelector("#" + button.dataset.tab).classList.add("on");
  });
});


/* ---- 8. Draw it once on load ---- */

drawPlayers();
