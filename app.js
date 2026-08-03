const players = [
  { name: "Jahmyr Gibbs",       pos: "RB", team: "DET", bye: 6,  adp: 1.5 },
  { name: "Bijan Robinson",     pos: "RB", team: "ATL", bye: 11, adp: 2.0 },
  { name: "Puka Nacua",         pos: "WR", team: "LAR", bye: 11, adp: 2.7 },
  { name: "Ja'Marr Chase",      pos: "WR", team: "CIN", bye: 6,  adp: 4.1 },
  { name: "Jaxon Smith-Njigba", pos: "WR", team: "SEA", bye: 11, adp: 5.2 }
];

const tbody = document.querySelector("#players tbody");

players.forEach(function (player) {
  const row = document.createElement("tr");
  row.innerHTML =
    "<td>" + player.name + "</td>" +
    "<td>" + player.pos  + "</td>" +
    "<td>" + player.team + "</td>" +
    "<td>" + player.bye  + "</td>" +
    "<td>" + player.adp.toFixed(1) + "</td>";
  tbody.appendChild(row);
});
