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

    // Somebody else's chair is not takeable, and the lobby says so before
    // the room has to refuse anything.
    const hostSeat = await host.evaluate(() => Live.room().yourSeat);
    const hostChairLocked = await guest.evaluate((seat) => {
      const root = document.getElementById("draftroom-root");
      const chips = [...root.querySelectorAll("button")]
        .filter((b) => /^(Claim|You|Taken)$/.test(b.textContent.trim()));
      return { label: chips[seat].textContent.trim(), disabled: chips[seat].disabled };
    }, hostSeat);
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
