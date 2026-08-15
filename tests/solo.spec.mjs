/* The solo draft, driven through the button rather than around it.

   Calling autoDraftRest() straight from the console drafts a full board
   whether or not a draft was ever started, so a harness that skips the Start
   button will happily pass a configuration the app refuses to run — which is
   how a league with one more round than roster spots went unnoticed. Every
   test here presses the button and asserts `state.started` before it believes
   a single pick. */

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

async function runSoloDraft(page, setup) {
  await page.evaluate(async (fields) => {
    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      el.value = String(value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 400));
  }, setup);

  const refused = await page.evaluate(() => document.getElementById("startBtn").disabled);
  expect(refused, "the Start button refused this league").toBe(false);

  await page.click("#startBtn");
  expect(await page.evaluate(() => state.started), "the draft actually started").toBe(true);

  return page.evaluate(async () => {
    autoDraftRest();
    await new Promise((r) => setTimeout(r, 3000));
    const perSeat = {}, qbs = {};
    state.picks.forEach(function (p) {
      perSeat[p.slot] = (perSeat[p.slot] || 0) + 1;
      if (p.player.pos === "QB") qbs[p.slot] = (qbs[p.slot] || 0) + 1;
    });
    return {
      picks: state.picks.length,
      distinct: new Set(state.picks.map((p) => p.player.name)).size,
      seats: Object.keys(perSeat).length,
      sizes: Object.values(perSeat),
      qbEach: Object.keys(perSeat).map((s) => qbs[s] || 0),
      kickerRounds: state.picks.filter((p) => p.player.pos === "K").map((p) => p.round),
      over: draftOver()
    };
  });
}

test("the default league drafts to the end", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);

  const out = await runSoloDraft(page, {});

  expect(out.picks).toBe(140);
  expect(out.distinct, "no player drafted twice").toBe(140);
  expect(out.seats).toBe(10);
  expect(out.sizes.every((n) => n === 14), "fourteen a team").toBe(true);
  expect(Math.min(...out.kickerRounds), "no kicker before round 13").toBeGreaterThanOrEqual(13);
  expect(out.over).toBe(true);

  await context.close();
});

/* A different shape, and the bench is the point of it: eight starters, a
   FLEX and five bench is fourteen spots, so fifteen rounds needs a sixth
   bench seat or the app is right to refuse. This file used to describe a
   league the app will not run. */
test("twelve teams, fifteen rounds, full PPR, bench six", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);

  const out = await runSoloDraft(page, {
    teamCount: 12, roundCount: 15, scoring: "ppr", benchCount: 6
  });

  expect(out.picks).toBe(180);
  expect(out.distinct).toBe(180);
  expect(out.seats).toBe(12);
  expect(out.sizes.every((n) => n === 15), "fifteen a team").toBe(true);
  expect(out.qbEach.every((n) => n === 1), "one quarterback each").toBe(true);
  expect(Math.min(...out.kickerRounds), "no kicker before round 14").toBeGreaterThanOrEqual(14);

  await context.close();
});

/* Reported from a real draft: eleventh of twelve, auto-draft pressed part way
   through, and it stopped in the ninth round without a word.

   The cause was a position chip on the Suggestions panel. `suggestions()` is
   filtered by it, so a manager looking at tight ends who already held their
   three had an empty list — and the loop read an empty list as "there is
   nothing left to draft" and abandoned the rest of the draft.

   Driven through the real chips, because the chip is the input that caused
   it, and every one of them is tried: the bug is not about tight ends, it is
   about the panel's filter reaching a decision it was never part of. */
for (const pos of ["ALL", "QB", "RB", "WR", "TE", "K", "DST"]) {
  test(`auto-draft finishes with the ${pos} filter showing`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openApp(context);

    await page.selectOption("#teamCount", "12");
    await page.selectOption("#draftSlot", "10");        // the 11th spot
    await page.click("#startBtn");
    expect(await page.evaluate(() => state.started)).toBe(true);

    await page.click(`#suggestFilter button[data-pos="${pos}"]`);
    expect(await page.evaluate(() => state.filterSuggest)).toBe(pos);

    // Part way in by hand, which is when a person reaches for the button.
    await page.evaluate(() => {
      let guard = 0;
      while (state.picks.length < 100 && guard++ < 300) {
        const c = onTheClock();
        const choice = c.slot === state.mySlot ? autoPickForMe() : cpuChoice(c.slot, c.round);
        if (!choice || makePick(choice)) break;
        pruneQueue();
      }
      render();
    });

    const out = await page.evaluate(async () => {
      autoDraftRest();
      await new Promise((r) => setTimeout(r, 1500));
      const sizes = {};
      state.picks.forEach((p) => { sizes[p.slot] = (sizes[p.slot] || 0) + 1; });
      return {
        picks: state.picks.length,
        distinct: new Set(state.picks.map((p) => p.player.name)).size,
        sizes: Object.values(sizes),
        kickerRounds: state.picks.filter((p) => p.player.pos === "K").map((p) => p.round)
      };
    });

    expect(out.picks, "the button finishes the draft or the board is empty").toBe(168);
    expect(out.distinct).toBe(168);
    expect(out.sizes.every((n) => n === 14)).toBe(true);
    // The fallback must not reach for a kicker to keep the loop moving.
    expect(Math.min(...out.kickerRounds)).toBeGreaterThanOrEqual(13);

    await context.close();
  });
}

test("solo still says 'Auto-draft the rest', because solo it is the truth", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);
  await page.click("#startBtn");
  await expect(page.locator("#autoBtn")).toHaveText("Auto-draft the rest");
  await context.close();
});
