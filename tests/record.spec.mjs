/* What we projected, against what happened.

   `pp` in stats.js holds the preseason forecast for seasons since played. This
   is the only number on the sheet that can be checked rather than believed,
   and the tests here are mostly about not letting it mislead.

   The load-bearing one is games played. Availability is most of the projection's
   error — r 0.873 for players who managed 15+ games against 0.617 below that —
   so a miss of 210 points beside a games count of 4 is a different claim from
   the same miss across a full season. A table that showed only the miss would
   be accurate and would invite the wrong conclusion.
*/

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

async function start(page) {
  await page.click("#startBtn");
  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
}

test.describe("our record on a player", () => {
  test("is built for most of the board, and invented for nobody",
    async ({ context }) => {
      const page = await openApp(context);
      await start(page);

      const r = await page.evaluate(() => {
        let withRec = 0, without = 0, badYear = 0;
        board.forEach((p) => {
          const rows = projectionRecord(p);
          if (rows.length) withRec++; else without++;
          // Every row must have both halves. A season with a forecast but no
          // actual is not gradeable and must not appear.
          rows.forEach((x) => {
            const s = statOf(p);
            if (!s.pp[x.year] || !s.s[x.year] || !s.s[x.year].gp) badYear++;
          });
        });
        return { withRec, without, total: board.length, badYear };
      });

      expect(r.withRec, "most of the board has a record").toBeGreaterThan(r.total / 2);
      expect(r.without, "and some do not — rookies, and anyone unlinked")
        .toBeGreaterThan(0);
      expect(r.badYear, "no row without both a forecast and a real season").toBe(0);
    });

  test("both halves rescore when the scoring rules move", async ({ context }) => {
    const page = await openApp(context);
    await start(page);

    /* Every other number on this sheet answers to the scoring editor. A
       historical figure that did not would be the one number here quietly
       describing a different league. */
    const before = await page.evaluate(() => {
      const p = board.find((x) => x.pos === "WR" && projectionRecord(x).length);
      const row = projectionRecord(p)[0];
      return { name: p.name, proj: row.proj, act: row.act };
    });

    await page.evaluate(() => {
      document.querySelectorAll("details.setupbox").forEach((d) => (d.open = true));
      const el = document.querySelector('#scoringFields input[data-rule="rec"]');
      el.value = "5";
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const after = await page.evaluate((n) => {
      const row = projectionRecord(board.find((x) => x.name === n))[0];
      return { proj: row.proj, act: row.act };
    }, before.name);

    expect(after.act, "the actual season rescored").toBeGreaterThan(before.act);
    expect(after.proj, "and so did the forecast").toBeGreaterThan(before.proj);
  });

  test("a defense reports no games count, because gp:1 is not one",
    async ({ context }) => {
      const page = await openApp(context);
      await start(page);

      /* Sleeper forecasts a team defense as one aggregate row stamped gp:1.
         Printing that as a games count is the bug perGame() already exists to
         prevent, arriving from a new direction. */
      const r = await page.evaluate(() => {
        const d = board.find((p) => p.pos === "DST" && projectionRecord(p).length);
        const rb = board.find((p) => p.pos === "RB" && projectionRecord(p).length);
        return { dstGames: projectionRecord(d).map((x) => x.games),
                 rbGames: projectionRecord(rb).map((x) => x.games) };
      });

      expect(r.dstGames.every((g) => g === null), "a defense shows a dash").toBe(true);
      expect(r.rbGames.every((g) => g > 0), "a player shows a real count").toBe(true);
    });

  test("the table marks a beat, a miss, and a short season", async ({ context }) => {
    const page = await openApp(context);
    await start(page);

    /* McCaffrey 2024 is the case this feature exists to present honestly:
       projected 250, finished 40, in four games. The miss is enormous and it
       is not a wrong read. If he ever leaves the board, move this to whoever
       else has a large miss on a short season rather than deleting it. */
    const r = await page.evaluate(() => {
      const p = board.find((x) => x.name === "Christian McCaffrey");
      if (!p) return null;
      openSheet(p);
      const rows = [...document.querySelectorAll(".logtbl.record tbody tr")].map((tr) => ({
        year: tr.children[0].textContent.trim(),
        diff: tr.children[3].textContent.trim(),
        diffClass: tr.children[3].className,
        games: tr.children[4].textContent.trim(),
        gamesClass: tr.children[4].className
      }));
      return { rows, note: document.querySelector(".logtbl.record")
        .parentElement.nextElementSibling.textContent.replace(/\s+/g, " ") };
    });
    test.skip(r === null, "McCaffrey is not on the current board");

    const short = r.rows.find((x) => x.gamesClass.includes("short"));
    expect(short, "a season under fifteen games is marked").toBeTruthy();
    expect(short.diffClass, "and its miss is coloured as a miss").toContain("missed");

    const beat = r.rows.find((x) => x.diffClass.includes("beat"));
    expect(beat, "a beaten forecast is marked too").toBeTruthy();
    expect(beat.diff.startsWith("+"), "and signed").toBe(true);

    // The reader has to be told why a healthy player beats his forecast, or a
    // column of green reads as a model that is simply too low.
    expect(r.note).toMatch(/prices in the chance of injury/);
  });

  test("a player with no archived forecast shows no table at all",
    async ({ context }) => {
      const page = await openApp(context);
      await start(page);

      const r = await page.evaluate(() => {
        const p = board.find((x) => !projectionRecord(x).length);
        if (!p) return null;
        openSheet(p);
        return { name: p.name,
                 table: !!document.querySelector(".logtbl.record"),
                 sheetOpen: !document.getElementById("sheet").hidden };
      });
      test.skip(r === null, "every player has a record on this board");

      expect(r.table, "no empty table, no placeholder").toBe(false);
      expect(r.sheetOpen, "and the sheet is otherwise fine").toBe(true);
    });
});
