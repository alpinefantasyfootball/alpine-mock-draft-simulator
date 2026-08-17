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

      /* Two lines per card across fifty cards, so a hundred exactly. The guard
         is here to catch the selector matching nothing rather than to pin the
         count — it was `> 100` and went red the moment the foot came off, which
         is a test failing on arithmetic rather than on the thing it watches. */
      expect(r.checked, "there were cards to measure").toBeGreaterThanOrEqual(80);
      expect(r.total ? r.fails : [], "every line clears 4.5:1").toEqual([]);

      /* The mask fades the lower rows towards transparent, and that is not a
         contrast failure: it is a deliberate dissolve on decoration, over the
         band, with the real board one click away. What is measured here is the
         painted colour against its own cell, which is what the rule is about. */
      expect(r.worst).toBeGreaterThanOrEqual(4.5);
    });

  test("a card is a name and a club, and nothing else", async ({ context }) => {
    const page = await openLanding(context);

    /* The shot is an excerpt of the board, not a copy of it, and this is the
       assertion that keeps it one.

       It carried the board's arrow and pick number for a commit. The pick
       numbers zigzag — row one runs 1.01 to 1.10 and row two runs 2.10 back to
       2.01, which is what a snake is and is information on the working board —
       and on a graphic somebody glances at it is fifty four-character numbers
       alternating direction with nothing for the eye to hold. They could not
       be demoted either: `--fs-2xs` is the floor of the type scale and dimming
       is the opacity bug this same file measures, so they would compete with
       the player's name at equal weight for ever.

       Written as a test rather than left to judgement because the pull is
       always towards adding one more true fact to a cell that has room. */
    const r = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".shot-cell:not(.empty)")];
      return {
        cards: cells.map((c) => ({
          name: c.querySelector("b").textContent,
          sub: c.querySelector("s").textContent
        })),
        extras: cells.reduce((n, c) => n + c.querySelectorAll(":scope > *").length, 0),
        feet: document.querySelectorAll(".shot-cell .cell-foot, .shot-cell .cell-pick, .shot-cell .cell-dir").length,
        faces: document.querySelectorAll(".shot-cell .cell-face").length
      };
    });

    expect(r.cards.length, "the shot is fully drawn").toBeGreaterThan(40);
    expect(r.feet, "no arrow and no pick number").toBe(0);
    expect(r.faces, "and no face").toBe(0);
    expect(r.extras, "exactly two elements per card").toBe(r.cards.length * 2);

    r.cards.forEach((c) => {
      expect(c.sub, "position and club").toMatch(/^[A-Z]{1,3} · [A-Z]{2,3}$/);
      expect(c.name.trim().length, "and a name").toBeGreaterThan(0);
    });

    /* shortName() stays: "J. Gibbs" reads as a person where "Gibbs" read as a
       row in a table. That was the half of the card change that worked, and it
       is the one thing the shot still shares with the board. */
    const initialled = r.cards.filter((c) => /^[A-Z]\. /.test(c.name));
    expect(initialled.length, "most names carry an initial")
      .toBeGreaterThan(r.cards.length / 2);

    // A defense is not initialised, same rule as the board.
    r.cards.filter((c) => c.sub.startsWith("DST"))
      .forEach((c) => expect(c.name).not.toMatch(/^[A-Z]\. /));
  });

  test("it is a ten-team room whatever league the visitor has set",
    async ({ context }) => {
      const page = await openLanding(context);

      /* The shot is an advert, not a preview of their draft: ten seats and
         five rounds, fixed, from SHOT_TEAMS and SHOT_ROUNDS.

         The league is moved to twelve and the shot redrawn before anything is
         read, and that is deliberate. `renderHeroShot()` runs once at startup,
         when `league.teams` is still the default ten, so a version that read
         `league.teams` would draw an identical shot and no page-level check
         could tell them apart. It is a latent bug rather than a live one, and
         the only way to assert against it is to drive the function rather than
         the page. A version of this test that skipped that step passed against
         the mutation it was written for. */
      const r = await page.evaluate(() => {
        document.querySelectorAll("details.setupbox").forEach((d) => (d.open = true));
        const el = document.getElementById("teamCount");
        el.value = "12";
        el.dispatchEvent(new Event("change", { bubbles: true }));
        renderHeroShot();

        const cells = [...document.querySelectorAll(".shot-cell")];
        const cols = getComputedStyle(document.getElementById("heroShot"))
          .gridTemplateColumns.split(" ").length - 1;   // less the round gutter
        return { leagueTeams: league.teams, cells: cells.length, cols };
      });

      expect(r.leagueTeams, "the visitor's league really did change").toBe(12);
      expect(r.cols, "still ten seats wide").toBe(10);
      expect(r.cells, "still ten by five").toBe(50);
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
