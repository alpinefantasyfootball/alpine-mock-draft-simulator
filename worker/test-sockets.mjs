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

/* Wait for a thing to become true rather than for a number of milliseconds.

   The first version slept 400ms after each send, which is generous against
   localhost and not always enough against a worker at the other end of a real
   network — the suite failed once on production and passed on a retry, which
   is the worst kind of test. Polling a condition makes it as fast as the
   connection allows and as patient as it needs to be. */
async function until(label, test, ms = 8000) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    let got;
    try { got = test(); } catch (err) { got = undefined; }
    if (got !== undefined && got !== false && got !== null) return got;
    await sleep(60);
  }
  fails.push(label + " timed out after " + ms + "ms");
  return undefined;
}

function lastState(ws) {
  for (let i = ws.inbox.length - 1; i >= 0; i--) {
    if (ws.inbox[i].type === "state") return ws.inbox[i].room;
  }
  return null;
}
// How many of a kind have arrived. Needed wherever "has one arrived?" is the
// wrong question because an earlier one is already sitting in the inbox.
function countOfType(ws, type) {
  return ws.inbox.filter((m) => m.type === type).length;
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

/* alice picks.

   Waited for rather than slept through. A fixed 400ms is comfortable against
   localhost and a coin toss against a worker at the other end of a real
   network — this crashed on production reading picks[0] of an empty list,
   which is the failure the until() helper was written for and which the note
   above it already warns about. Any fixed sleep before an assertion about a
   broadcast is the same bug waiting to happen. */
alice.send(JSON.stringify({ type: "pick", key: "Gibbs" }));
s = await until("alice's pick reaches bob", () => {
  const st = lastState(bob);
  return st && st.picks.length === 1 ? st : false;
}) || { picks: [] };
check("pick landed for everyone", s.picks.length, 1);
check("pick recorded to the right seat", s.picks[0]?.slot, 0);
check("pick key kept", s.picks[0]?.key, "Gibbs");

// THE race: both sockets send the same player on bob's turn, same tick
const before = lastState(bob).picks.length;
/* A *new* rejection, counted rather than looked up. bob already carries one
   from the wrong-seat check above, so waiting for "a rejection to exist"
   returned instantly and the assertion read the picks before either send had
   been decided. */
const rejectsBefore = countOfType(bob, "rejected");
bob.send(JSON.stringify({ type: "pick", key: "Bijan" }));
bob.send(JSON.stringify({ type: "pick", key: "Bijan" }));
// One of the two must be refused, so a second rejection means both have been
// decided — a pick count alone could catch the first one mid-flight.
await until("the duplicate is decided",
            () => countOfType(bob, "rejected") > rejectsBefore);
s = lastState(bob);
check("a duplicate submit adds exactly one pick", s.picks.length - before, 1);
check("second submit was rejected", lastOfType(bob, "rejected")?.code !== undefined, true);
check("no duplicate keys anywhere", new Set(s.picks.map((p) => p.key)).size, s.picks.length);

// chat lives in the room, not a relay, so it arrives in the state and a
// late joiner gets the history rather than silence
alice.send(JSON.stringify({ type: "chat", text: "hello room" }));
const chat = await until("chat arrives at bob", () => {
  const c = (lastState(bob) || {}).chat || [];
  return c.length && c[c.length - 1].text === "hello room" ? c : false;
}) || [];
check("chat reached bob", chat[chat.length - 1]?.text, "hello room");
check("chat carries a seat, never a member id",
      JSON.stringify(chat).includes("alice") === false, true);

// markup typed by a manager stays a string all the way through
alice.send(JSON.stringify({ type: "chat", text: "<img src=x onerror=alert(1)>" }));
const withMarkup = await until("markup message arrives", () => {
  const c = (lastState(bob) || {}).chat || [];
  const last = c[c.length - 1];
  return last && last.text.startsWith("<img") ? last : false;
}) || {};
check("markup is stored verbatim, escaping is the client's job",
      withMarkup.text, "<img src=x onerror=alert(1)>");

// a GIF from GIPHY survives; anything else is dropped before it is stored
alice.send(JSON.stringify({ type: "chat", text: "look",
  gif: "https://media1.giphy.com/media/abc/giphy.gif" }));
const withGif = await until("gif message arrives", () => {
  const c = (lastState(bob) || {}).chat || [];
  const last = c[c.length - 1];
  return last && last.text === "look" ? last : false;
}) || {};
check("giphy media kept", withGif.gif, "https://media1.giphy.com/media/abc/giphy.gif");

alice.send(JSON.stringify({ type: "chat", text: "sneaky",
  gif: "https://giphy.com.evil.example/x.gif" }));
const spoofed = await until("spoofed gif message arrives", () => {
  const c = (lastState(bob) || {}).chat || [];
  const last = c[c.length - 1];
  return last && last.text === "sneaky" ? last : false;
}) || {};
check("lookalike host dropped, message kept", spoofed.gif, null);

// an empty message is refused rather than filling the log with blanks
const beforeBlank = lastState(bob).chat.length;
alice.send(JSON.stringify({ type: "chat", text: "   " }));
await sleep(300);
check("blank message ignored", lastState(bob).chat.length, beforeBlank);

/* ---- names ----

   The name is what everything else in the chat hangs off. It arrives on the
   query string at connect and can be changed at any point after. */
check("the name from the query string reached the chair",
      lastState(bob).seats[0].name, "Alice");

alice.send(JSON.stringify({ type: "rename", name: "  Coach   Al  " }));
const renamed = await until("rename reaches bob", () => {
  const st = lastState(bob);
  return st && st.seats[0].name === "Coach Al" ? st : false;
}) || {};
check("a name is cleaned server-side", renamed.seats?.[0].name, "Coach Al");
check("renaming rewrites what was already said",
      (renamed.chat || []).filter((m) => !m.system && m.seat === 0)
        .every((m) => m.name === "Coach Al"), true);

/* ---- reactions ----

   Stored against a message id and reported as a count plus whether it was
   you. The count is the point; who reacted is nobody's business, because
   telling anyone would mean handing out member ids. */
const target = lastState(bob).chat.filter((m) => !m.system)[0];
check("a stored message carries an id", typeof target?.id, "number");

bob.send(JSON.stringify({ type: "react", id: target.id, emoji: "\u{1F525}" }));
const reacted = await until("reaction reaches alice", () => {
  const line = (lastState(alice) || {}).chat?.find((m) => m.id === target.id);
  return line && line.reacts ? line : false;
}) || {};
check("alice sees the count and that it was not her",
      reacted.reacts, [{ emoji: "\u{1F525}", count: 1, you: false }]);
check("bob sees that it was him",
      lastState(bob).chat.find((m) => m.id === target.id).reacts,
      [{ emoji: "\u{1F525}", count: 1, you: true }]);
check("a reaction leaks no member id",
      JSON.stringify(lastState(alice)).includes("bob") === false, true);

bob.send(JSON.stringify({ type: "react", id: target.id, emoji: "not-an-emoji" }));
await sleep(300);
check("an unlisted reaction is refused", lastOfType(bob, "rejected")?.code, "bad-reaction");

bob.send(JSON.stringify({ type: "react", id: target.id, emoji: "\u{1F525}" }));
const unreacted = await until("reaction is taken back", () => {
  const line = (lastState(alice) || {}).chat?.find((m) => m.id === target.id);
  return line && !line.reacts ? line : false;
}) || {};
check("pressing the same reaction twice removes it", unreacted.reacts, null);

/* ---- typing ----

   The one message that never touches state. It is relayed to the other
   sockets and forgotten, because storing it would mean a Durable Object
   write per keystroke to record something true for two seconds. */
const chatLenBeforeTyping = lastState(bob).chat.length;
const bobInboxBefore = bob.inbox.length;

alice.send(JSON.stringify({ type: "typing", on: true }));
const typing = await until("typing reaches bob", () => lastOfType(bob, "typing")) || {};
check("typing carries the sender's seat", typing.seat, 0);
check("typing carries the name, so it can be drawn", typing.name, "Coach Al");
check("typing is not stored in the room", lastState(bob).chat.length, chatLenBeforeTyping);
check("typing did not cause a state broadcast",
      bob.inbox.slice(bobInboxBefore).some((m) => m.type === "state"), false);

// and it does not come back to the person doing it
const aliceInboxBefore = alice.inbox.length;
alice.send(JSON.stringify({ type: "typing", on: true }));
await sleep(300);
check("the typist is not told about themselves",
      alice.inbox.slice(aliceInboxBefore).some((m) => m.type === "typing"), false);

/* A client claiming somebody else is typing gets its own seat used anyway.
   The seat is looked up from the socket, never taken from the message. */
bob.send(JSON.stringify({ type: "typing", on: true, seat: 0 }));
const claimed = await until("bob's typing reaches alice",
  () => lastOfType(alice, "typing")) || {};
check("the seat comes from the socket, not the message", claimed.seat, 1);

// storage survives a reconnect: alice drops and comes back
alice.close();
await sleep(400);
const alice2 = await connect("alice", "Alice");
await sleep(500);
s = lastState(alice2);
check("room survived a reconnect", s?.picks.length >= 2, true);
check("alice keeps her seat mid-draft", s?.yourSeat, 0);
check("still drafting", s?.status, "drafting");

/* And she is drafting for herself again.

   A drop hands the chair to the CPU so the room keeps moving without her,
   which is right; coming back has to hand it straight back, which it did not.
   The seat was still hers and still marked auto, so the host's browser went
   on picking for a manager who was sitting there watching it happen — a
   failure with no error anywhere, visible only as picks she never made.

   It went unnoticed because nothing used to reconnect on its own: you got
   here by reopening the link, which is rare enough that nobody did it twice.
   The page retries by itself now, so this is the common path, not the odd
   one. */
check("a returning manager stops being auto", s?.seats[0].auto, false);
check("and the chair is still hers", s?.seats[0].taken, true);

/* Coming back is not arriving. The lobby frees a dropped chair, so "had no
   seat a moment ago" is true of a reconnection too — and announcing on that
   put "took seat 1" in the log every time a phone went to the messages app
   and back, which is exactly what the person creating the room does. */
const arrivals = (lastState(alice2).chat || [])
  .filter((m) => m.system && /took seat/.test(m.text || ""));
check("a reconnect is not announced as an arrival",
      arrivals.filter((m) => /Alice|Coach Al/.test(m.text)).length, 1);

// somebody arriving late reads what the room already said
const lateChat = lastState(alice2).chat || [];
check("a late joiner gets the history", lateChat.length > 0, true);
check("history includes the arrival lines",
      lateChat.some((m) => m.system === true), true);

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

/* ---- the GIPHY proxy is not open ----

   CORS headers tell a browser whether to let a page read a response. They do
   nothing about the request being made, so withholding them stopped nobody:
   curl with a made-up Origin came back with a full result set and a little
   more of the key's quota spent. These check the refusal, not the header. */
const evil = await fetch(`${HTTP}/giphy?q=touchdown`,
                         { headers: { Origin: "https://evil.example" } });
check("a foreign origin is refused outright", evil.status, 403);
check("and is told nothing else", (await evil.json()).results, undefined);

const bare = await fetch(`${HTTP}/giphy?q=touchdown`);
check("so is a request with no origin at all", bare.status, 403);

/* A lookalike host has to fail too — the check is an exact match against the
   list, not a substring, for the same reason cleanGif() parses a URL rather
   than searching it for "giphy.com". */
const lookalike = await fetch(`${HTTP}/giphy?q=x`,
                              { headers: { Origin: "https://jukeff.com.evil.example" } });
check("a lookalike origin is refused", lookalike.status, 403);

const ours = await fetch(`${HTTP}/giphy?q=touchdown`,
                         { headers: { Origin: "https://jukeff.com" } });
check("our own origin is served", ours.status, 200);
check("and gets the CORS header back",
      ours.headers.get("access-control-allow-origin"), "https://jukeff.com");

/* ---- the rate limit ----

   The number that matters is not that a flood is stopped — it is that a real
   draft never reaches it. So this checks both ends: a burst well past the
   limit is refused, and the socket still works immediately afterwards for
   somebody who was only ever going at human speed. */
const flooder = await connect("flood", "Flooder");
await sleep(300);
const floodRejects = () => flooder.inbox.filter(
  (m) => m.type === "rejected" && m.code === "too-fast").length;

check("a normal burst is not limited", floodRejects(), 0);

for (let i = 0; i < 80; i++) {
  flooder.send(JSON.stringify({ type: "chat", text: "flood " + i }));
}
await until("the flood is refused", () => floodRejects() > 0);
check("a flood is refused", floodRejects() > 0, true);

// and the connection survives it
check("the socket is not closed for flooding", flooder.readyState, 1);
flooder.close();

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
