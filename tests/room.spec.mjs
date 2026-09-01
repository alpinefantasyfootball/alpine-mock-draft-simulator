/* A shared draft, with two managers, run to the end.

   This is the test the project did not have. Solo drafts had been driven to
   completion since the beginning; a room never had, and the difference was a
   draft that deadlocked at pick 86 in front of two real people. Everything
   below exists because something in it was once broken and nothing said so.
*/

import { test, expect } from "@playwright/test";
import { openApp, createRoom, roomView, sent, waitForRoom, pickGaps, median, perSeat }
  from "./helpers.mjs";

/* The legacy setup screen is `display:none !important` in web/index.html -
   The React lobby replaced it visually and the markup stayed for app.js's
   unguarded listeners. So a Playwright click, which waits for visibility,
   can never resolve on a control inside it: this suite sat red from the day
   that landed, and nobody saw it because the room specs need the worker and
   local wrangler crash-loops on the owner's machine.

   evaluate() does not check visibility, which is the same split every other
   spec here already relies on (see helpers.mjs's startDraft). */
/* The React room's own controls, pressed the way a person presses them.

   This file used to click #startBtn and #autoBtn through page.evaluate,
   because the legacy setup screen is display:none and Playwright's
   actionability check can never resolve on something inside it. Those are
   real, visible buttons now, so they are clicked normally - and a click that
   would not land is a failure worth having rather than a thing to route
   around.

   The room's own state is still read through Live rather than off the screen.
   That is not laziness: what this file is actually about is whether ten
   chairs got filled by the right two clients, and that question is answered
   by what each socket sent, not by what either page happened to draw. */
async function startRoomDraft(page) {
  // createRoom() (helpers.mjs) creates the room through the engine bridge
  // directly, which has no way to reach React's own local enteredRoom
  // state — so the host is still sitting on Settings & Locker, one click
  // short of the screen "Start for everyone" is actually on. Optional,
  // not asserted: a page already past it (mid-test, or an older build)
  // just won't have the button.
  const enter = page.locator('#draftroom-root button:text-is("Enter Draft Room")');
  if (await enter.count()) await enter.click();

  await page.click("#draftroom-root >> text=/Start for everyone|Start draft/");
  await page.waitForFunction(() => Live.room() && Live.room().status === "drafting",
    null, { timeout: 20000 });
}

/* The autopick toggle. In a room this is engine.toggleRoomAutopilot(), which
   is one pick per turn on your own chair - never the whole board. The legacy
   button carried the promise in its label ("Auto-draft my picks", and "the
   rest" only when solo); the React control is a switch with an aria-pressed
   state, so the promise is asserted where it now lives. */
function autopickSwitch(page) {
  return page.locator('#draftroom-root button[aria-pressed]').filter({ hasText: /Autopick/i }).first();
}

async function toggleAutopick(page) {
  const before = await page.evaluate(() => !!JukeEngine.autoMe());
  await autopickSwitch(page).click();
  await page.waitForFunction((was) => !!JukeEngine.autoMe() !== was, before, { timeout: 10000 });
}

async function twoManagers(browser) {
  const hostCtx = await browser.newContext();
  const host = await openApp(hostCtx, "#/draft-room");
  const code = await createRoom(host);

  const guestCtx = await browser.newContext();
  const guest = await openApp(guestCtx, `#/draft-room?room=${code}`);
  await guest.waitForFunction(() => Live.room() && Live.room().yourSeat >= 0);

  return { hostCtx, host, guestCtx, guest, code };
}

test("a full room draft finishes, and nobody drafts for anybody else", async ({ browser, request }) => {
  const { hostCtx, host, guestCtx, guest, code } = await twoManagers(browser);

  expect((await roomView(host)).isHost).toBe(true);
  expect((await roomView(guest)).isHost).toBe(false);
  expect((await roomView(guest)).yourSeat).toBe(1);

  // The guest is a person who picks for themselves; the host asks for its own
  // chair to be played. Between them that is two seats, and the CPU has eight.
  await guest.evaluate(() => window.__playAsHuman());
  await startRoomDraft(host);
  await host.waitForFunction(() => Live.room().status === "drafting");

  /* The promise the legacy label made in words, asserted where it lives now:
     off, then on, and what it turns on is one pick per turn on the host's own
     chair. The proof that it is not drafting the whole board is further down
     - hostSent.picks is 14, one per round, and every other seat arrives as an
     auto pick the host submits on the room's behalf. */
  expect(await host.evaluate(() => !!JukeEngine.autoMe()), "off to begin with").toBe(false);
  await toggleAutopick(host);
  expect(await host.evaluate(() => !!JukeEngine.autoMe()), "and on after one press").toBe(true);

  const final = await waitForRoom(request, code, (r) => r.status === "done");

  // ---- the board itself ----
  expect(final.picks.length).toBe(140);
  expect(new Set(final.picks.map((p) => p.key)).size, "no player twice").toBe(140);
  expect(Object.values(perSeat(final.picks)).every((n) => n === 14), "fourteen a team").toBe(true);
  expect(final.picks.slice(0, 20).map((p) => p.slot))
    .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);

  const hostSent = await sent(host);
  const guestSent = await sent(guest);

  /* The assertion this whole file is for.

     Auto-drafting once filled in all ten teams, including two managers who
     were sitting there with the app open. Counting what each client sent —
     and checking it adds up to the board — is what catches that, and it does
     not depend on noticing anything on a screen. */
  expect(guestSent.all.length, "the guest sent one pick per round, for itself").toBe(14);
  expect(guestSent.autos, "a guest never sends an auto pick").toBe(0);
  expect(hostSent.picks, "the host's own chair, on autopilot").toBe(14);
  expect(hostSent.autos, "the host covers the eight empty chairs").toBe(112);
  expect(hostSent.all.length + guestSent.all.length, "and together, the whole board").toBe(140);

  /* Nothing was refused.

     A room can reject half of what a client sends and look perfectly healthy
     until it stops. `too-fast` here means the host has outrun the worker's
     rate limit, which is how the deadlock began. */
  expect(hostSent.rejects, "the host was refused nothing").toEqual([]);
  expect(guestSent.rejects, "the guest was refused nothing").toEqual([]);

  /* And it was paced. A median under 100ms is not a fast draft, it is a
     client in a loop, and it will find the rate limiter eventually. */
  const gaps = pickGaps(final.picks);
  expect(median(gaps), "picks are paced, not looping").toBeGreaterThan(100);

  await hostCtx.close();
  await guestCtx.close();
});

test("a dropped socket comes back on its own, and the chair comes with it", async ({ browser }) => {
  const { hostCtx, host, guestCtx, guest } = await twoManagers(browser);

  await startRoomDraft(host);
  await host.waitForFunction(() => Live.room().status === "drafting");

  // What a phone does when the browser stops being the front app.
  await guest.evaluate(() => Live.state().socket.close());

  // While it is down, nothing pretends otherwise.
  /* The legacy version asserted the chat footer here: the box went dead
     together with one line saying why, because "nothing happens" was how the
     silent version was reported. There is no chat in the React room yet -
     ChatPlaceholder says as much on screen - so there is no footer to go
     dead, and pretending otherwise would be a test of nothing.

     What is asserted instead is the fact underneath it, which is the one the
     chat footer was reporting: the socket is down while the room is not. Both
     halves matter. "In a room" is Live.room() and "the socket is up right
     now" is Live.active(), and the start button once asked the wrong one -
     which is how a dropped socket started a *solo* draft on the host's phone
     while everybody else waited. When chat lands, its disabled state belongs
     back here beside this. */
  await guest.waitForFunction(() => !Live.active(), null, { timeout: 10000 });
  expect(await guest.evaluate(() => !!Live.room()), "still in the room").toBe(true);
  expect(await guest.evaluate(() => Live.active()), "but the socket is down").toBe(false);

  await guest.waitForFunction(() => Live.status() === "open", null, { timeout: 30000 });

  const view = await roomView(guest);
  expect(view.seats[view.yourSeat].taken, "the chair is still theirs").toBe(true);
  expect(view.seats[view.yourSeat].auto, "and the CPU has stopped picking for them").toBe(false);
  await guest.waitForFunction(() => Live.active(), null, { timeout: 20000 });
  expect(await guest.evaluate(() => Live.active()), "and it comes back on its own").toBe(true);

  // Coming back is not arriving, so it is not announced as one.
  const arrivals = await guest.evaluate(() =>
    Live.room().chat.filter((m) => m.system && /took seat/.test(m.text || "")).length);
  expect(arrivals, "one arrival line per manager, not one per reconnection").toBe(2);

  await hostCtx.close();
  await guestCtx.close();
});

test("the start button will not start a solo draft on top of a room", async ({ browser }) => {
  const { hostCtx, host, guestCtx } = await twoManagers(browser);

  await host.evaluate(() => { Live.state().wanted = false; Live.state().socket.close(); });
  await host.waitForFunction(() => Live.status() !== "open");

  await expect(host.locator("#startBtn")).toHaveText("Reconnecting…");
  await expect(host.locator("#startBtn")).toBeDisabled();

  // Even if the click gets through, nothing local may begin.
  await host.evaluate(() => document.getElementById("startBtn").click());
  expect(await host.evaluate(() => state.started), "no draft started behind the room's back").toBe(false);

  await hostCtx.close();
  await guestCtx.close();
});

test("leaving the draft leaves the room, and the link brings you back", async ({ browser }) => {
  const { hostCtx, host, guestCtx, guest, code } = await twoManagers(browser);

  await guest.evaluate(() => window.__playAsHuman());
  await startRoomDraft(host);
  await host.waitForFunction(() => Live.room().status === "drafting");
  /* 90s, explicitly, because this wait is longer than any default and always
     was - it just never said so and inherited whatever the global happened
     to be.

     The host is seat 0 (the guest asserts seat 1 above), the guest is playing
     as a human, and this test never turns the host's autopick on. So nobody
     picks first: the opening pick of the room only lands when the host's own
     60s clock (clockLength, app.js) runs out and the room takes the seat. A
     30s wait cannot reach that, and 30s is Playwright's own default - so this
     was a coin flip on timing rather than a wait sized for what it waits for,
     and it failed twice in three runs once anything nudged it.

     The test does not care *which* pick exists, only that one does before
     goHome() - so waiting out the clock is the honest cost, not something to
     engineer around by giving the host autopick, which would quietly change
     the scenario being tested. */
  await host.waitForFunction(() => Live.room().picks.length > 0, null, { timeout: 90000 });

  await host.evaluate(() => goHome());

  expect(await host.evaluate(() => Live.status()), "the room was actually left").toBe("off");
  // Leaving a room lands you in the real Draft Room, not back on the
  // retired view the suite happens to be driving.
  expect(await host.evaluate(() => location.hash), "and the code is out of the address").toBe("#/draft-room");

  // The bug was being dragged back by the next broadcast a moment later.
  await host.waitForTimeout(6000);
  expect(await host.evaluate(() => state.started), "still on the setup screen").toBe(false);

  // The way back in is the link, and it arrives as a hash change on a tab
  // that is already on the site — which is the case that used to do nothing.
  await host.evaluate((c) => { location.hash = `#/draft-room?room=${c}`; }, code);
  await host.waitForFunction(() => Live.status() === "open", null, { timeout: 30000 });

  const back = await roomView(host);
  expect(back.isHost, "still the host").toBe(true);
  expect(back.seats[back.yourSeat].auto, "chair reclaimed from the CPU").toBe(false);
  expect(await host.evaluate(() => state.started), "and back in the draft").toBe(true);

  await hostCtx.close();
  await guestCtx.close();
});

/* Everything the room gained after a real draft went wrong, checked with two
   managers rather than one page and a stubbed room.

   Each of these was reported from that draft: the setup screen still showed
   the settings of a room you had made yourself, a guest could edit a league
   they had joined, the clock was invisible to nine people out of ten, and
   Pause, Undo and "Discard draft" were on screen for everybody. They were
   fixed against a fake room object; this is the first time two clients have
   disagreed about any of it. */
test("a room belongs to its host, and says so to everybody in it", async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const host = await openApp(hostCtx, "#/draft-room");
  // A room is named after its host, so the host has to be called something.
  await host.evaluate(() => Live.setName("Blake"));
  const code = await createRoom(host);

  const guestCtx = await browser.newContext();
  const guest = await openApp(guestCtx, `#/draft-room?room=${code}`);
  await guest.waitForFunction(() => Live.room() && Live.room().yourSeat >= 0);

  /* ---- the room is named, on both screens ----
     #friendsTitle, not a label inside #inviteBox: the heading became the
     summary of a collapsed <details> and the id moved with the job. Asked for
     by id here for the same reason renderInvite() asks for it by id — a
     structural selector is a second place for that decision to live. */
  await expect
    .poll(() => guest.evaluate(() => document.getElementById("friendsTitle").textContent))
    .toBe("Blake's Draft Room");
  expect(await host.evaluate(() => document.getElementById("friendsTitle").textContent))
    .toBe("Blake's Draft Room");

  /* ---- the league is locked, and not only the five obvious controls ----
     Every one of these runs refreshSetup() -> buildBoard(), so an unlocked one
     is a guest quietly rebuilding their own board out from under the draft. */
  const locks = (page) => page.evaluate(() => ({
    teams: document.getElementById("teamCount").disabled,
    rounds: document.getElementById("roundCount").disabled,
    scoring: document.getElementById("scoring").disabled,
    lineup: document.getElementById("startTE").disabled,
    bench: document.getElementById("benchCount").disabled,
    /* The settings panel refuses as a whole rather than field by field, and
       it refuses from the moment a room exists rather than only once
       drafting has begun - a guest who reshapes the league in a lobby
       rebuilds their own board out from under the draft they are in, and
       nothing on screen would say so. */
    rule: !!(window.Live && Live.room()),
    reset: document.getElementById("resetScoring").disabled
  }));
  const allLocked = { teams: true, rounds: true, scoring: true, lineup: true,
                      bench: true, rule: true, reset: true };
  expect(await locks(guest), "a guest may not reshape the league").toEqual(allLocked);
  // The host too: the wobble reads board position and every client has to agree.
  expect(await locks(host), "nor may the host, once the room exists").toEqual(allLocked);

  // ---- draft order is the host's ----
  const seatNames = (page) =>
    page.evaluate(() => Live.room().seats.map((s) => s.name));
  expect(await seatNames(guest)).toEqual(["Blake", null, null, null, null,
                                          null, null, null, null, null]);

  await guest.evaluate(() => Live.swapSeats(0, 1));
  await guest.waitForTimeout(1200);
  expect(await guest.evaluate(() => Live.room().yourSeat),
    "a guest cannot move itself up the order").toBe(1);

  await host.evaluate(() => Live.swapSeats(0, 1));
  await expect.poll(() => host.evaluate(() => Live.room().yourSeat)).toBe(1);
  expect(await guest.evaluate(() => Live.room().yourSeat),
    "and the other client agrees about where it now sits").toBe(0);

  // ---- start, and check what a draft looks like from the guest's chair ----
  await startRoomDraft(host);
  await guest.waitForFunction(() => Live.room().status === "drafting");
  await guest.waitForFunction(() => state.started === true);

  // Seat 0 is the guest now, so make it somebody else's turn.
  await guest.evaluate(() => draftAndAdvance(suggestions("ALL")[0]));
  await guest.waitForFunction(() => !isMyTurn());

  const watching = await guest.evaluate(() => ({
    myTurn: isMyTurn(),
    showing: clockShowing(),
    // The display question and the authority question are different, and the
    // page used the second to answer the first.
    counting: clockRunnable(),
    headerLabel: document.getElementById("rightLabel").textContent,
    headerValue: document.getElementById("rightValue").textContent,
    boardCell: (document.getElementById("boardClock") || {}).textContent || null
  }));
  expect(watching.myTurn).toBe(false);
  expect(watching.showing, "a clock the whole room is waiting on is drawn").toBe(true);
  expect(watching.counting, "but this browser never counts it").toBe(false);
  expect(watching.headerLabel).toBe("Time left");
  expect(watching.headerValue, "as a real countdown, not a dash").toMatch(/^\d+:\d\d$/);
  expect(watching.boardCell, "and on the live cell too").toMatch(/^\d+:\d\d$/);

  // ---- what a guest is not offered ----
  const bar = await guest.evaluate(() => ({
    pause: document.getElementById("pauseBtn").hidden,
    undo: document.getElementById("undoBtn").hidden,
    quit: document.getElementById("restartBtn").textContent
  }));
  expect(bar.pause, "pausing a shared clock is the host's").toBe(true);
  expect(bar.undo, "there is no shared undo").toBe(true);
  expect(bar.quit, "and the label says what the button does").toBe("Leave the room");

  expect(await host.evaluate(() => document.getElementById("pauseBtn").hidden),
    "the host keeps it").toBe(false);

  // ---- pausing is a message, not a local flag ----
  await host.evaluate(() => togglePause());
  await expect.poll(() => guest.evaluate(() => Live.room().paused),
    { message: "the room pauses for everyone" }).toBe(true);
  expect(await guest.evaluate(() => state.paused)).toBe(true);
  await host.evaluate(() => togglePause());
  await expect.poll(() => guest.evaluate(() => Live.room().paused)).toBe(false);

  // ---- the board is not scouting for the room ----
  const chips = await guest.evaluate(() => {
    state.filterPlayers = "ALL";
    render();
    return document.querySelectorAll("#playerTable .chip.val, #playerTable .chip.reach").length;
  });
  expect(chips, "Value and Reach are not read out to nine other managers").toBe(0);

  await hostCtx.close();
  await guestCtx.close();
});
