/* The product shot on the landing page.

   It had no tests at all, which is worth naming: it is the first thing a
   visitor sees, it is generated from live data rather than being an image, and
   its whole job is to look like the thing one click away. A graphic that
   drifts from the product is a lie the app tells about itself, and nothing
   here would have caught it.

   It is decoration — `aria-hidden`, no pointer events, no tab stop — and that
   is exactly why it needs asserting rather than looking at. Nobody is going to
   notice a wrong arrow on something they are not meant to read.
*/

import { test, expect } from "@playwright/test";
import { SITE } from "./helpers.mjs";

async function openLanding(context) {
  const page = await context.newPage();
  await page.goto(`${SITE}/index.html`);
  // The shot is drawn once the board exists, which is after the setup screen
  // has been read. Waiting on the cells rather than a timer.
  await page.waitForFunction(() => document.querySelectorAll(".shot-cell").length > 40);
  return page;
}

test.describe("the hero product shot", () => {
  test("every line clears 4.5:1 on its own solid, opacity composited",
    async ({ context }) => {
      const page = await openLanding(context);

      /* The sub-line carried `opacity: .78`, measuring 3.38 to 3.66 across the
         six position solids — the same defect as the board card's and worse,
         on the first screen anybody sees. Both were invisible to every sweep
         because opacity is a property on the element rather than a channel in
         the colour: read `color` and you get #fff and 4.62. */
      const r = await page.evaluate(() => {
        const kill = document.createElement("style");
        kill.textContent = "* { transition: none !important; animation: none !important }";
        document.head.appendChild(kill);

        const lum = (c) => {
          const [r, g, b] = c.map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const parse = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

        const fails = [];
        let checked = 0, worst = 99;
        document.querySelectorAll(".shot-cell:not(.empty)").forEach((cell) => {
          const bg = parse(getComputedStyle(cell).backgroundColor);
          cell.querySelectorAll("b, s, .cell-dir, .cell-pick").forEach((el) => {
            const cs = getComputedStyle(el);
            let fg = parse(cs.color);
            const op = parseFloat(cs.opacity);
            if (op < 1) fg = fg.map((v, i) => v * op + bg[i] * (1 - op));
            const a = lum(fg), b = lum(bg);
            const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            checked++;
            if (cr < worst) worst = cr;
            if (cr < 4.5) fails.push({ what: el.className || el.tagName,
                                       pos: cell.className.split(" ")[1], cr: +cr.toFixed(2) });
          });
        });
        return { checked, worst: +worst.toFixed(2), fails: fails.slice(0, 6), total: fails.length };
      });

      expect(r.checked, "there were cards to measure").toBeGreaterThan(100);
      expect(r.total ? r.fails : [], "every line clears 4.5:1").toEqual([]);

      /* The mask fades the lower rows towards transparent, and that is not a
         contrast failure: it is a deliberate dissolve on decoration, over the
         band, with the real board one click away. What is measured here is the
         painted colour against its own cell, which is what the rule is about. */
      expect(r.worst).toBeGreaterThanOrEqual(4.5);
    });

  test("it draws the same card the draft room draws", async ({ context }) => {
    const page = await openLanding(context);

    /* The point of the shot is that it is the product, not a picture of it.
       Both boards go through shortName() and boardArrow(), so this asserts
       the rendered result rather than that they call the same function —
       a second renderer growing its own idea of a card is the failure. */
    const r = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".shot-cell:not(.empty)")];
      return cells.map((c) => ({
        name: c.querySelector("b").textContent,
        sub: c.querySelector("s").textContent,
        dir: c.querySelector(".cell-dir") && c.querySelector(".cell-dir").textContent.trim(),
        pick: c.querySelector(".cell-pick") && c.querySelector(".cell-pick").textContent.trim()
      }));
    });

    expect(r.length, "the shot is fully drawn").toBeGreaterThan(40);
    r.forEach((c) => {
      expect(c.dir, "every card has an arrow").toBeTruthy();
      expect(c.pick, "every card has a pick").toMatch(/^\d+\.\d\d$/);
      expect(c.sub, "position and club").toMatch(/^[A-Z]{1,3} · [A-Z]{2,3}$/);
    });

    // A defense is not initialised, same rule as the board.
    const dst = r.filter((c) => c.sub.startsWith("DST"));
    dst.forEach((c) => expect(c.name).not.toMatch(/^[A-Z]\. /));
  });

  test("the arrows describe a real snake", async ({ context }) => {
    const page = await openLanding(context);

    /* Ten teams, fixed, whatever league the visitor has set up — the shot is
       an advert rather than their draft.

       The league is moved to twelve and the shot redrawn before anything is
       read, and that is the whole point of this test. `renderHeroShot()` runs
       once at startup today, when `league.teams` is still the default ten, so
       a version reading `league.teams` instead of the shot's own count is
       indistinguishable on the page as it currently loads. It is a latent bug
       rather than a live one, and the parameter exists so it stays that way —
       which means the test has to drive the function rather than the page, or
       it asserts nothing at all. Confirmed: without this the mutation passes. */
    const r = await page.evaluate(() => {
      document.querySelectorAll("details.setupbox").forEach((d) => (d.open = true));
      const el = document.getElementById("teamCount");
      el.value = "12";
      el.dispatchEvent(new Event("change", { bubbles: true }));
      renderHeroShot();

      const cells = [...document.querySelectorAll(".shot-cell:not(.empty)")];
      return {
        leagueTeams: league.teams,
        cards: cells.map((c) => {
          const [round, inRound] = c.querySelector(".cell-pick").textContent.trim().split(".").map(Number);
          return { round, inRound, dir: c.querySelector(".cell-dir").textContent.trim() };
        })
      };
    });

    expect(r.leagueTeams, "the visitor's league really did change").toBe(12);

    const TEAMS = 10;
    const wrong = r.cards.filter((x) => {
      const want = x.inRound === TEAMS ? "↓" : (x.round % 2 === 0 ? "←" : "→");
      return x.dir !== want;
    });
    expect(wrong, "every arrow matches its own pick number").toEqual([]);
    expect(new Set(r.cards.map((x) => x.dir)).size, "all three arrows occur").toBe(3);

    // Each round holds every pick number exactly once, whichever way it runs.
    const byRound = {};
    r.cards.forEach((x) => { (byRound[x.round] = byRound[x.round] || []).push(x.inRound); });
    Object.keys(byRound).forEach((round) => {
      expect(byRound[round].slice().sort((a, b) => a - b),
             `round ${round} holds 1..${TEAMS}`)
        .toEqual([...Array(TEAMS)].map((_, i) => i + 1));
    });
  });

  test("no card is clipped, and the landing page loads no headshots",
    async ({ context }) => {
      const page = await context.newPage();
      const cdn = [];
      page.on("request", (r) => { if (/sleepercdn/.test(r.url())) cdn.push(r.url()); });
      await page.goto(`${SITE}/index.html`);
      await page.waitForFunction(() => document.querySelectorAll(".shot-cell").length > 40);
      await page.waitForTimeout(1500);

      /* Fifty headshots is fifty requests to somebody else's server on the
         first paint of the marketing page, for decoration the mask starts
         dissolving at 46%. The landing page loads no third-party image at all
         and this is the assertion that keeps it that way. */
      expect(cdn, "the landing page asks sleepercdn for nothing").toEqual([]);

      /* The row height is stated once on the grid. Set below what the content
         needs and the sub-line is cut in half — which does not report as an
         overflow, because a flex column compresses its children instead. So
         this compares the row against what a free-standing copy of the card
         actually wants. */
      const r = await page.evaluate(() => {
        const cell = document.querySelector(".shot-cell:not(.empty)");
        const clone = cell.cloneNode(true);
        clone.style.cssText = "position:absolute;visibility:hidden;height:auto;width:"
                            + cell.getBoundingClientRect().width + "px";
        document.body.appendChild(clone);
        const natural = clone.getBoundingClientRect().height;
        clone.remove();
        return { row: cell.getBoundingClientRect().height, natural };
      });
      expect(r.row, "the row fits the card it holds").toBeGreaterThanOrEqual(r.natural);
    });
});
