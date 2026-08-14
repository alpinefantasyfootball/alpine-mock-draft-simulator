/* Drive a running worker over real WebSockets.

   room.js and draft-engine.js are pure and covered by
   scripts/test_engine.py. This covers the half that is not: sockets, storage
   between messages, the alarm, and the object actually behaving as one
   referee when two people disagree.

   The assertion that matters most sends the same player twice on the same
   turn and checks that exactly one pick lands. That is the entire reason
   any of this exists.

       cd worker && wrangler dev --port 8787 --local
       node worker/test-sockets.mjs

   Needs Node 22 or newer for WebSocket and fetch as globals. */

const BASE = process.env.JUKE_WORKER || "ws://127.0.0.1:8787";
// The same host over plain HTTP, for the one route that is not a socket.
const HTTP = BASE.replace(/^ws/, "http");
const ROOM = "testroom" + Math.floor(Math.random() * 100000);

const LEAGUE = { teams: 4, rounds: 3 };

const fails = [];
const note = [];
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) fails.push(`${name}\n    got  ${g}\n    want ${w}`);
  else note.push("ok  " + name);
}

function connect(member, name, extra) {
  const q = new URLSearchParams({
    member, name,
    league: JSON.stringify(LEAGUE),
    clock: "60",
    data: "v1",
    ...(extra || {})
  });
  const ws = new WebSocket(`${BASE}/room/${ROOM}?${q}`);
  ws.inbox = [];
  ws.addEventListener("message", (e) => ws.inbox.push(JSON.parse(e.data)));
  return new Promise((res, rej) => {
    ws.addEventListener("open", () => res(ws));
    ws.addEventListener("error", rej);
    setTimeout(() => rej(new Error("open timed out for " + member)), 5000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lastState(ws) {
  for (let i = ws.inbox.length - 1; i >= 0; i--) {
    if (ws.inbox[i].type === "state") return ws.inbox[i].room;
  }
  return null;
}
function lastOfType(ws, type) {
  for (let i = ws.inbox.length - 1; i >= 0; i--) {
    if (ws.inbox[i].type === type) return ws.inbox[i];
  }
  return null;
}

const alice = await connect("alice", "Alice");
await sleep(400);

let s = lastState(alice);
check("alice gets a state on connect", !!s, true);
check("room created in lobby", s && s.status, "lobby");
check("four chairs", s && s.seats.length, 4);
check("alice is host", s && s.isHost, true);
check("alice took seat 0", s && s.yourSeat, 0);

const bob = await connect("bob", "Bob");
await sleep(400);

s = lastState(bob);
check("bob joined", s && s.yourSeat, 1);
check("bob is not host", s && s.isHost, false);
check("bob sees two chairs taken", s && s.seats.filter((x) => x.taken).length, 2);

// alice's socket should have been told about bob without asking
s = lastState(alice);
check("alice was pushed the update", s && s.seats.filter((x) => x.taken).length, 2);
check("alice cannot see bob's member id",
      JSON.stringify(s).includes("bob") === false, true);

// non-host start is refused
bob.send(JSON.stringify({ type: "start" }));
await sleep(300);
check("non-host start refused", lastOfType(bob, "rejected")?.code, "not-your-seat");
check("still in lobby", lastState(alice)?.status, "lobby");

// host starts
alice.send(JSON.stringify({ type: "start" }));
await sleep(400);
check("drafting after host start", lastState(alice)?.status, "drafting");
check("both sockets saw it", lastState(bob)?.status, "drafting");
check("a countdown arrived", typeof lastState(bob)?.msLeft, "number");

// wrong seat is refused; seat 0 is on the clock
bob.send(JSON.stringify({ type: "pick", key: "Gibbs" }));
await sleep(300);
check("bob cannot pick on alice's turn", lastOfType(bob, "rejected")?.code, "not-your-seat");

// alice picks
alice.send(JSON.stringify({ type: "pick", key: "Gibbs" }));
await sleep(400);
s = lastState(bob);
check("pick landed for everyone", s?.picks.length, 1);
check("pick recorded to the right seat", s?.picks[0].slot, 0);
check("pick key kept", s?.picks[0].key, "Gibbs");

// THE race: both sockets send the same player on bob's turn, same tick
const before = lastState(bob).picks.length;
bob.send(JSON.stringify({ type: "pick", key: "Bijan" }));
bob.send(JSON.stringify({ type: "pick", key: "Bijan" }));
await sleep(500);
s = lastState(bob);
check("a duplicate submit adds exactly one pick", s.picks.length - before, 1);
check("second submit was rejected", lastOfType(bob, "rejected")?.code !== undefined, true);
check("no duplicate keys anywhere", new Set(s.picks.map((p) => p.key)).size, s.picks.length);

// chat relays to the other socket
alice.send(JSON.stringify({ type: "chat", text: "hello room" }));
await sleep(300);
check("chat reached bob", lastOfType(bob, "chat")?.text, "hello room");

// storage survives a reconnect: alice drops and comes back
alice.close();
await sleep(400);
const alice2 = await connect("alice", "Alice");
await sleep(500);
s = lastState(alice2);
check("room survived a reconnect", s?.picks.length >= 2, true);
check("alice keeps her seat mid-draft", s?.yourSeat, 0);
check("still drafting", s?.status, "drafting");

// a client on a different data build is turned away
const stale = await connect("carol", "Carol", { data: "v2-different" });
await sleep(400);
const rej = lastOfType(stale, "rejected");
check("stale build refused", rej?.code, "stale-data");
check("refusal names both versions",
      !!(rej?.detail?.roomVersion && rej?.detail?.yourVersion), true);

// the /state route works without a socket
const res = await fetch(`${HTTP}/room/${ROOM}/state`);
const view = await res.json();
check("state route responds", res.status, 200);
check("state route agrees on the pick count", view.picks.length, s.picks.length);

bob.close(); alice2.close(); try { stale.close(); } catch {}
await sleep(200);

console.log(note.join("\n"));
console.log("");
if (fails.length) {
  console.log("FAIL " + fails.length);
  fails.forEach((f) => console.log("  x " + f));
  process.exit(1);
}
console.log(`OK — ${note.length} assertions over real sockets`);
