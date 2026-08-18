/* The two rings on the draft board: whose column it is, and where the draft is.

   Both were blue before this — the same blue as the focus ring, the selected
   tab, --link, .draft-btn and the header when the clock is yours. A colour
   doing five jobs is not a signal, which is the design half.

   The bug half is smaller and worse. `mine` only ever went on a *filled*
   cell, so the board marked where you had been and never where you were
   going — and where you are going next is the one question a snake board
   exists to answer. Nothing failed, nothing logged, and every check this
   project runs passed: the cells that were marked were marked correctly.

   Contrast is the load-bearing test here and it is not the usual one. These
   are marks rather than type, so the bar is 1.4.11's 3:1 rather than 4.5 —
   but the surface underneath is not knowable from one rule. A ring lands on
   six position solids, which are fixed across themes, and on an empty cell,
   which is near-black in dark and near-white in light. Measured, no single
   colour survives that, so the ring is a *pair* and the test is that one half
   of the pair always has the surface it is sitting on.
*/

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

async function draftInto(page, picks) {
  await page.evaluate((n) => {
    document.querySelectorAll("details.setupbox").forEach((d) => (d.open = true));
    document.getElementById("startBtn").click();
    for (let i = 0; i < n; i++) { const c = onTheClock(); if (c) makePick(cpuChoice(c.slot, c.round)); }
    render();
  }, picks);
  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
}

/* Relative luminance and WCAG contrast, on rgb() strings as the browser
   reports them. Written here rather than imported because the board-card
   suite's copy composites opacity as well, which nothing here needs. */
const CONTRAST = `
  function lum(c) {
    const [r, g, b] = c.map((v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function rgb(s) { return s.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number); }
  function ratio(a, b) {
    const x = lum(rgb(a)), y = lum(rgb(b));
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
`;

test.describe("the board's two rings", () => {
  test("your column is marked all the way down, drafted or not",
    async ({ context }) => {
      const page = await openApp(context);
      await draftInto(page, 26);

      const r = await page.evaluate(() => {
        const cells = [...document.querySelectorAll(".board .cell")];
        const perRow = league.teams;
        const marked = [], mineIndexes = [];
        cells.forEach((c, i) => {
          if (c.classList.contains("mine")) { marked.push(i % perRow); mineIndexes.push(i); }
        });
        return {
          mySlot: state.mySlot,
          rounds: league.rounds,
          columns: [...new Set(marked)],
          count: mineIndexes.length,
          // The half that was missing: your future picks.
          emptyMarked: mineIndexes.filter((i) => cells[i].classList.contains("empty")).length
        };
      });

      expect(r.columns, "exactly one column is marked, and it is yours").toEqual([r.mySlot]);
      expect(r.count, "one cell per round, top to bottom").toBe(r.rounds);
      /* 26 picks of a ten-team draft is round three, so eleven of your
         fourteen are still ahead of you. Before this they carried nothing. */
      expect(r.emptyMarked, "your picks still to come are marked too")
        .toBeGreaterThan(r.rounds / 2);
    });

  test("the live ring is on the pick that is on the clock, and moves with it",
    async ({ context }) => {
      const page = await openApp(context);
      await draftInto(page, 26);

      const first = await page.evaluate(() => {
        const now = document.querySelector(".board .cell.now");
        const c = onTheClock();
        return { text: now && now.textContent.trim(), count:
          document.querySelectorAll(".board .cell.now").length, round: c.round, slot: c.slot };
      });
      expect(first.count, "exactly one cell is on the clock").toBe(1);

      await page.evaluate(() => { const c = onTheClock(); makePick(cpuChoice(c.slot, c.round)); render(); });

      const next = await page.evaluate(() => {
        const c = onTheClock();
        return { count: document.querySelectorAll(".board .cell.now").length,
                 round: c.round, slot: c.slot };
      });
      expect(next.count, "still exactly one").toBe(1);
      expect([next.round, next.slot], "and it has moved on")
        .not.toEqual([first.round, first.slot]);
    });

  test("both rings survive every surface they can land on, in both themes",
    async ({ browser }) => {
      for (const theme of ["dark", "light"]) {
        const context = await browser.newContext();
        const page = await openApp(context);
        await draftInto(page, 60);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);

        const bad = await page.evaluate(({ contrast }) => {
          eval(contrast);
          /* Transitions off before any colour is read: a pane that is not
             compositing produces no frames, so a transition never advances
             and getComputedStyle reports the starting value indefinitely. */
          const kill = document.createElement("style");
          kill.textContent = "* { transition: none !important }";
          document.head.appendChild(kill);

          /* The ring is `inset 0 0 0 2px <ring>, inset 0 0 0 3px <keyline>`,
             so the two colours come back in that order. Read from the
             computed style rather than from the token, because what matters
             is what the cell actually draws. */
          const colours = (el) =>
            (getComputedStyle(el).boxShadow.match(/rgba?\([^)]+\)/g) || []);

          const out = [];
          document.querySelectorAll(".board .cell.mine, .board .cell.now").forEach((cell) => {
            const under = getComputedStyle(cell).backgroundColor;
            const ring = colours(cell);
            if (ring.length < 2) { out.push({ why: "no ring pair", cls: cell.className }); return; }
            /* The claim the design rests on: one half of the pair always has
               the surface. Not both — gold on a light empty cell is 1.26 and
               is meant to be, which is exactly why the keyline exists. */
            const best = Math.max(...ring.map((c) => ratio(c, under)));
            if (best < 3) out.push({ why: "ring lost its surface", cls: cell.className,
                                     under, ring, best: Math.round(best * 100) / 100 });
            // And the pair has to read as an edge against itself.
            if (ratio(ring[0], ring[1]) < 3) out.push({ why: "pair is one colour", ring });
          });
          document.head.removeChild(kill);
          return out;
        }, { contrast: CONTRAST });

        expect(bad, `every ring holds its surface in ${theme}`).toEqual([]);
        await context.close();
      }
    });
});
