import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

/* Two managers in the React lobby.

   room.spec.mjs drives the legacy view and therefore proves nothing about
   this screen: the board-as-lobby, claiming a chair by clicking a column,
   and the seat owners read off the room's broadcast are all new and all
   untested by it. Solo covers the claim gesture; nothing covered the part
   where somebody else is sitting in the chair.

   A manager is a browser context, not a tab — contexts have their own
   localStorage and therefore their own juke.member, which is what makes
   these two different people rather than one person with two sockets. */

const CLAIM = /^(Claim|You|Taken)$/;

async function claimChips(page) {
  return page.evaluate(() => {
    const root = document.getElementById("draftroom-root");
    return [...root.querySelectorAll("button")]
      .map((b) => b.textContent.trim())
      .filter((t) => /^(Claim|You|Taken)$/.test(t));
  });
}

async function seatLabels(page) {
  // The name under each chip — a real manager's name once they sit down.
  return page.evaluate(() => {
    const root = document.getElementById("draftroom-root");
    const heads = [...root.querySelectorAll("button")]
      .filter((b) => /^(Claim|You|Taken)$/.test(b.textContent.trim()))
      .map((b) => b.parentElement);
    return heads.map((h) => (h.querySelector("span") || {}).textContent || "");
  });
}

test("two managers, one board: a claimed chair shows as taken to everybody",
  async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const host = await openApp(hostCtx, "#/draft-room");

    // A fresh visit lands on Settings & Locker first now — seat-picking is
    // its own screen one step further in. "Enter Draft Room" is the one
    // thing that screen asks for.
    await host.locator("#draftroom-root button").filter({ hasText: /^Enter Draft Room$/ }).click();

    // The lobby is the pre-draft screen, so no draft is started anywhere here.
    await expect.poll(() => claimChips(host).then((c) => c.length)).toBeGreaterThan(0);

    const code = await host.evaluate(async () => {
      window.JukeEngine.createRoom();
      for (let i = 0; i < 80 && !window.JukeEngine.codeInUrl(); i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      return window.JukeEngine.codeInUrl();
    });
    expect(code, "the host's room has an invite code").toBeTruthy();

    const guestCtx = await browser.newContext();
    const guest = await openApp(guestCtx, `#/draft-room?room=${code}`);
    await guest.waitForFunction(() => window.Live && Live.room() && Live.room().yourSeat >= 0,
      null, { timeout: 60000 });

    /* A chair that is free, and not the one the guest was seated in on
       arrival - so a pass cannot be the lobby simply drawing the seat the
       room already gave them.

       Written as "seat 0 unless that is where I started" first, and seat 0
       is the host's: the room refused, the chip was correctly disabled, and
       the click was a no-op. The app was right and the test was wrong, which
       is worth keeping as the assertion below. */
    const startingSeat = await guest.evaluate(() => Live.room().yourSeat);
    const target = startingSeat === 4 ? 5 : 4;

    /* Asked entirely of the guest's own screen.

       Written first as "read the host's seat from the host page, then check
       that index on the guest page", and it timed out every time while a
       hand-run dump of the same moment showed the chip reading Taken. Two
       pages are two clocks, and an index carried across them is a fact from
       one moment being used in another. The guest's board already says which
       chair is somebody else's - that is the thing under test - so the seat
       index comes from there. */
    await expect
      .poll(() => guest.evaluate(() => {
        const root = document.getElementById("draftroom-root");
        return [...root.querySelectorAll("button")]
          .map((b) => b.textContent.trim())
          .filter((t) => t === "Taken").length;
      }), { timeout: 30000 })
      .toBe(1);

    const hostChairLocked = await guest.evaluate(() => {
      const root = document.getElementById("draftroom-root");
      const chips = [...root.querySelectorAll("button")]
        .filter((b) => /^(Claim|You|Taken)$/.test(b.textContent.trim()));
      const seat = chips.findIndex((b) => b.textContent.trim() === "Taken");
      return { seat, label: chips[seat].textContent.trim(), disabled: chips[seat].disabled };
    });
    expect(hostChairLocked.label, "the host's chair reads as taken").toBe("Taken");
    expect(hostChairLocked.disabled, "and cannot be clicked").toBe(true);

    await guest.evaluate((seat) => {
      const root = document.getElementById("draftroom-root");
      const chips = [...root.querySelectorAll("button")]
        .filter((b) => /^(Claim|You|Taken)$/.test(b.textContent.trim()));
      chips[seat].click();
    }, target);

    await expect
      .poll(() => guest.evaluate(() => Live.room().yourSeat), { timeout: 30000 })
      .toBe(target);

    // And the host is told, without ever being told who the guest is by id.
    await expect
      .poll(() => claimChips(host).then((c) => c[target]), { timeout: 30000 })
      .toBe("Taken");

    const hostChips = await claimChips(host);
    expect(hostChips.filter((c) => c === "You").length,
      "the host still has exactly one chair of their own").toBe(1);
    expect(hostChips[target], "and it is not the one the guest took").not.toBe("You");

    const names = await seatLabels(host);
    expect(names[target], "the taken chair carries a name, not an id").toBeTruthy();
    expect(/^m[a-z0-9]{8,}$/.test(names[target]),
      "and it is not a raw member id").toBe(false);

    await hostCtx.close();
    await guestCtx.close();
  });

/* Draft order, which only means anything with more than one person in the
   room — so it cannot be checked solo, and the two things worth checking are
   that the host can and the guest cannot. The room already refuses a guest
   (test_engine.py proves Room.swapSeats does), but a refusal the UI never
   mentions is a control that looks live and does nothing. */
async function openOrderTab(page) {
  await page.evaluate(() => {
    const root = document.getElementById("draftroom-root");
    // The lobby bar's gear. The "Roster & scoring settings" button lived in
    // the Configure column, which the full-bleed lobby removed.
    [...root.querySelectorAll("button")]
      .find((b) => /draft settings/i.test(b.getAttribute("aria-label") || ""))
      .click();
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("div")].some((d) =>
      (d.className || "").toString().includes("z-[70]")), null, { timeout: 15000 });
  await page.evaluate(() => {
    const m = [...document.querySelectorAll("div")]
      .find((d) => (d.className || "").toString().includes("z-[70]"));
    [...m.querySelectorAll("button")].find((b) => b.textContent.trim() === "Order").click();
  });
}

function orderPanelText(page) {
  return page.evaluate(() => {
    const m = [...document.querySelectorAll("div")]
      .find((d) => (d.className || "").toString().includes("z-[70]"));
    return m ? m.innerText : "";
  });
}

test("the host sets the draft order and a guest cannot", async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const host = await openApp(hostCtx, "#/draft-room");

  const code = await host.evaluate(async () => {
    window.JukeEngine.createRoom();
    for (let i = 0; i < 80 && !window.JukeEngine.codeInUrl(); i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return window.JukeEngine.codeInUrl();
  });
  expect(code).toBeTruthy();

  const guestCtx = await browser.newContext();
  const guest = await openApp(guestCtx, `#/draft-room?room=${code}`);
  await guest.waitForFunction(() => window.Live && Live.room() && Live.room().yourSeat >= 0,
    null, { timeout: 60000 });

  const guestSeatBefore = await guest.evaluate(() => Live.room().yourSeat);
  const hostSeat = await host.evaluate(() => Live.room().yourSeat);

  // The guest is told, on screen, that this is not theirs to change.
  await openOrderTab(guest);
  await expect
    .poll(() => orderPanelText(guest), { timeout: 15000 })
    .toMatch(/Only the host can set the draft order/);
  const guestSeesRandomize = await orderPanelText(guest);
  expect(guestSeesRandomize, "and is not offered the shuffle").not.toMatch(/Randomize order/);

  // The host swaps the two occupied chairs, through the real list.
  await openOrderTab(host);
  await expect.poll(() => orderPanelText(host), { timeout: 15000 })
    .toMatch(/Tap a seat to pick it up/);

  await host.evaluate(([a, b]) => {
    const m = [...document.querySelectorAll("div")]
      .find((d) => (d.className || "").toString().includes("z-[70]"));
    const rows = [...m.querySelectorAll("ol li button")];
    rows[a].click();
    rows[b].click();
  }, [hostSeat, guestSeatBefore]);

  // The guest is moved by the room, not by their own browser.
  await expect
    .poll(() => guest.evaluate(() => Live.room().yourSeat), { timeout: 30000 })
    .toBe(hostSeat);
  await expect
    .poll(() => host.evaluate(() => Live.room().yourSeat), { timeout: 30000 })
    .toBe(guestSeatBefore);

  await hostCtx.close();
  await guestCtx.close();
});
