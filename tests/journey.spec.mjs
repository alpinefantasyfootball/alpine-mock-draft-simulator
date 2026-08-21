/* The whole thing, once, the way a person does it.

   Every other spec in this suite starts somewhere convenient — a hash that
   opens the draft room, an engine call that starts a draft, a board driven by
   a loop. That is the right trade for a test about one behaviour, and it
   leaves exactly one thing uncovered: whether the *joins* work. A visitor
   arrives at the homepage, finds the room, sits down, drafts, and reads their
   grade, and no single test has ever walked that line end to end.

   It is deliberately shallow at every step. The board's contrast, the snake
   arithmetic, the grade's components and the room's seat rules each have a
   file of their own that goes deeper than this ever should. What this asks is
   only: does each screen hand you to the next one, and is what arrives at the
   end the same draft you started.

   So it presses real controls throughout. Where a helper would be quicker,
   that is precisely the thing not to do here — a journey test that skips the
   navigation is testing the same engine every other file already tests.
*/

import { test, expect } from "@playwright/test";
import { SITE } from "./helpers.mjs";

test("homepage to a finished draft, pressing only what a person can press",
  async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    /* ---- 1. arrive ---------------------------------------------------- */
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.JukeEngine, null, { timeout: 30000 });

    // The homepage is real content, not a splash: the ticker and the hero
    // both read off the live board rather than sample data.
    const boardSize = await page.evaluate(() => JukeEngine.board().length);
    expect(boardSize, "the board is loaded before anything is clicked").toBeGreaterThan(150);

    /* ---- 2. find the Draft Room --------------------------------------- */
    /* Through a link on the page, not by setting location.hash. ROOMS is
       written down once and rendered into both the header panel and the
       homepage's doors, and the one string in it is what sends every "start
       a draft" entry point somewhere — it pointed at the retired route for a
       while, and nothing in the suite would have noticed. */
    const doors = page.locator('a[href="#/draft-room"]');
    expect(await doors.count(), "the homepage offers a way in").toBeGreaterThan(0);
    await doors.first().click();

    // The door lands on Settings & Locker first, not the seat-picker
    // directly — seat-picking moved to its own screen one step further in.
    // "Enter Draft Room" is the one thing that screen asks for, exactly
    // the same button the phone/solo/room specs already learned to press.
    const enter = page.locator("#draftroom-root button").filter({ hasText: /^Enter Draft Room$/ });
    await expect(enter, "Settings & Locker asks for one thing").toBeVisible({ timeout: 30000 });
    await enter.click();

    await page.waitForFunction(() => {
      const root = document.getElementById("draftroom-root");
      return root && /Your seat/.test(root.innerText || "");
    }, null, { timeout: 30000 });

    /* ---- 3. sit down --------------------------------------------------- */
    const chips = page.locator("#draftroom-root button").filter({ hasText: /^(Claim|You|Taken)$/ });
    const seats = await chips.count();
    expect(seats, "a chair per team").toBe(await page.evaluate(() => JukeEngine.league().teams));

    // The seventh chair, claimed by clicking it on the board.
    await chips.nth(6).click();
    await expect.poll(() => page.evaluate(() => {
      const root = document.getElementById("draftroom-root");
      return [...root.querySelectorAll("button")]
        .map((b) => b.textContent.trim())
        .filter((t) => /^(Claim|You|Taken)$/.test(t))
        .indexOf("You");
    })).toBe(6);

    /* ---- 4. change something, so the draft is actually mine ------------ */
    await page.click('#draftroom-root button[aria-label="Draft settings"]');
    await page.waitForFunction(() => [...document.querySelectorAll("div")]
      .some((d) => (d.className || "").toString().includes("z-[70]")), null, { timeout: 10000 });

    // Full PPR, through the real select.
    await page.selectOption('div[class*="z-[70]"] select >> nth=1', "ppr");
    await expect.poll(() => page.evaluate(() => JukeEngine.league().scoring)).toBe("ppr");

    await page.click('div[class*="z-[70]"] button[aria-label="Close draft settings"]');

    /* ---- 5. start ------------------------------------------------------ */
    const start = page.locator("#draftroom-root button").filter({ hasText: /^Start draft$/ });
    await expect(start, "the lobby asks for one thing").toBeVisible();
    await start.click();
    await page.waitForFunction(() => state.started, null, { timeout: 20000 });

    // The seat survived the start, and the scoring did too.
    expect(await page.evaluate(() => JukeEngine.mySlot()), "seated where I sat").toBe(6);
    expect(await page.evaluate(() => JukeEngine.league().scoring), "scored as I set it").toBe("ppr");

    /* ---- 6. draft ------------------------------------------------------ */
    // A few by hand first, through the row's own Draft button when it is my
    // turn — the only place in this file that proves a pick can be made at
    // all rather than computed.
    await page.waitForFunction(() => isMyTurn(), null, { timeout: 30000 });
    const before = await page.evaluate(() => state.picks.length);
    await page.locator("#draftroom-root button").filter({ hasText: /^Draft$/ }).first().click();
    await expect.poll(() => page.evaluate(() => state.picks.length),
      { timeout: 15000 }).toBeGreaterThan(before);
    // Index `before`, not the tail: the instant my pick lands the app's own
    // CPU cascade can append the next seat's pick before this next line
    // runs, so the tail is only mine at the moment the poll above resolved.
    // The pick this click made is always the one at `before` — nothing else
    // can land there ahead of it, however many follow.
    expect(await page.evaluate((i) => state.picks[i].slot, before),
      "and it was my own chair").toBe(6);

    // Then the rest, through the control that exists for it.
    await page.locator('#draftroom-root button[aria-label="Auto-draft the rest"]').click();
    await expect.poll(() => page.evaluate(() => draftOver()), { timeout: 60000 }).toBe(true);

    /* ---- 7. read the result -------------------------------------------- */
    const out = await page.evaluate(() => {
      const all = analyseDraft();
      const w = WEIGHTS;
      const perSeat = {};
      state.picks.forEach((p) => { perSeat[p.slot] = (perSeat[p.slot] || 0) + 1; });
      return {
        picks: state.picks.length,
        distinct: new Set(state.picks.map((p) => p.player.name)).size,
        sizes: [...new Set(Object.values(perSeat))],
        rounds: league.rounds,
        teams: league.teams,
        earlyKicker: state.picks.filter((p) => p.player.pos === "K" && p.round < league.rounds - 1).length,
        // A total has to equal its own weighted parts, and a component that
        // is the same for everybody is not in the grade.
        reconciles: all.every((t) => Math.abs(
          t.startersScaled * w.starters + t.valueScaled * w.value +
          t.buildScaled * w.build + t.byePenaltyScaled * w.byes - t.total) < 1e-9),
        spread: ["startersScaled", "valueScaled", "buildScaled", "byePenaltyScaled"]
          .map((k) => new Set(all.map((t) => Math.round(t[k]))).size),
        mine: all.find((t) => t.slot === 6),
      };
    });

    expect(out.picks, "every pick was made").toBe(out.teams * out.rounds);
    expect(out.distinct, "and no player twice").toBe(out.picks);
    expect(out.sizes, "a full roster each").toEqual([out.rounds]);
    expect(out.earlyKicker, "the app picked the kicker's timing, not the manager").toBe(0);
    expect(out.reconciles, "each total equals its own parts").toBe(true);
    expect(Math.min(...out.spread), "no component is a constant across the room")
      .toBeGreaterThan(1);
    expect(out.mine.grade, "and my team has a grade").toBeTruthy();

    /* ---- 8. and it says so on screen ----------------------------------- */
    /* The last step, and the one a computed check cannot make: the grade the
       reader sees is the grade the engine worked out. A right value in the
       wrong column is the one class of bug every assertion above passes
       happily - the standings printed starter strength under a column of
       totals for months. */
    await expect.poll(() => page.evaluate(() => {
      const root = document.getElementById("draftroom-root");
      return /Draft Grade|THE ONE THAT GOT AWAY|One That Got Away/i.test(root.innerText || "");
    }), { timeout: 30000 }).toBe(true);

    const result = await page.evaluate(() => {
      const root = document.getElementById("draftroom-root");
      const all = analyseDraft();
      const rows = [...root.querySelectorAll("button")]
        .map((b) => (b.textContent || "").trim())
        .filter((t) => /^\d+/.test(t) && all.some((x) => t.includes(JukeEngine.teamLabel(x.slot))));
      const shown = rows.map((t) => {
        const rank = parseInt(t, 10);
        const m = t.match(/(\d+)([A-F][+-]?)$/);
        return { rank, total: m ? +m[1] : null, grade: m ? m[2] : null };
      });
      // Sorted the same way the standings table itself sorts (AnalysisTab.jsx:
      // `all.slice().sort((a,b) => a.rank - b.rank)`), so row order lines up.
      const expectedRanks = all.slice().sort((a, b) => a.rank - b.rank).map((t) => t.rank);
      return { shown, expectedRanks };
    });

    expect(result.shown.length, "the standings list the room").toBe(out.teams);
    // Not asserted as the bijection [1, 2, ..., teams]: two teams tied on
    // their rounded total now legitimately share a rank (see analyseDraft()),
    // so the real check is the one this step exists for — that the number on
    // screen is the number the engine computed, ties and all — not an assumed
    // shape that happens to hold only when nobody ties.
    expect(result.shown.map((r) => r.rank), "matches what the engine computed, in finishing order")
      .toEqual(result.expectedRanks);

    await context.close();
  });
