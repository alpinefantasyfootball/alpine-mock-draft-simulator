/* A shared draft, with two managers, run to the end.

   This is the test the project did not have. Solo drafts had been driven to
   completion since the beginning; a room never had, and the difference was a
   draft that deadlocked at pick 86 in front of two real people. Everything
   below exists because something in it was once broken and nothing said so.
*/

import { test, expect } from "@playwright/test";
import { openApp, createRoom, roomView, sent, waitForRoom, pickGaps, median, perSeat }
  from "./helpers.mjs";

/* Host and guest are separate browser contexts, which is what makes them
   separate people: contexts have their own localStorage, so their own
   `juke.member`. Two tabs would share one id and the room would be right to
   treat them as one manager. */
async function twoManagers(browser) {
  const hostCtx = await browser.newContext();
  const host = await openApp(hostCtx);
  const code = await createRoom(host);

  const guestCtx = await browser.newContext();
  const guest = await openApp(guestCtx, `#/draft?room=${code}`);
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
  await host.click("#startBtn");
  await host.waitForFunction(() => Live.room().status === "drafting");

  await expect(host.locator("#autoBtn"), "the label promises only your own picks")
    .toHaveText("Auto-draft my picks");
  await host.click("#autoBtn");
  await expect(host.locator("#autoBtn")).toHaveText("Stop auto-drafting");

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

  await host.click("#startBtn");
  await host.waitForFunction(() => Live.room().status === "drafting");

  // What a phone does when the browser stops being the front app.
  await guest.evaluate(() => Live.state().socket.close());

  // While it is down, nothing pretends otherwise.
  await expect(guest.locator("#chatOffline")).toBeVisible();
  await expect(guest.locator("#chatInput")).toBeDisabled();
  await expect(guest.locator("#chatSend")).toBeDisabled();

  await guest.waitForFunction(() => Live.status() === "open", null, { timeout: 30000 });

  const view = await roomView(guest);
  expect(view.seats[view.yourSeat].taken, "the chair is still theirs").toBe(true);
  expect(view.seats[view.yourSeat].auto, "and the CPU has stopped picking for them").toBe(false);
  await expect(guest.locator("#chatInput")).toBeEnabled();

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
  await host.click("#startBtn");
  await host.waitForFunction(() => Live.room().status === "drafting");
  await host.waitForFunction(() => Live.room().picks.length > 0);

  await host.evaluate(() => goHome());

  expect(await host.evaluate(() => Live.status()), "the room was actually left").toBe("off");
  expect(await host.evaluate(() => location.hash), "and the code is out of the address").toBe("#/draft");

  // The bug was being dragged back by the next broadcast a moment later.
  await host.waitForTimeout(6000);
  expect(await host.evaluate(() => state.started), "still on the setup screen").toBe(false);

  // The way back in is the link, and it arrives as a hash change on a tab
  // that is already on the site — which is the case that used to do nothing.
  await host.evaluate((c) => { location.hash = `#/draft?room=${c}`; }, code);
  await host.waitForFunction(() => Live.status() === "open", null, { timeout: 30000 });

  const back = await roomView(host);
  expect(back.isHost, "still the host").toBe(true);
  expect(back.seats[back.yourSeat].auto, "chair reclaimed from the CPU").toBe(false);
  expect(await host.evaluate(() => state.started), "and back in the draft").toBe(true);

  await hostCtx.close();
  await guestCtx.close();
});
