/* The Juke score, as a reader meets it.

   Every check here was written against a real complaint: a player sheet
   showing a bare 0 and a bare 100 with nothing on screen to get from one to
   the other, and the same number carrying three different names between the
   strip, the meter under it, the queue and the table header.

   The arithmetic was never wrong, which is why none of the existing suites
   could see any of this. `test_engine.py` covers rules the engine enforces
   and `solo.spec.mjs` covers a draft completing; a number that is correct and
   unreadable passes both. So these assertions are about what the page *says*
   — the same distinction that caught the room standings printing starter
   strength in a column sorted by the weighted total. */

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

// The sheet renders without a draft, but the tab strip does not, so every
// test here starts one and then opens a player directly.
async function start(page) {
  await page.click("#startBtn");
  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
}

async function openPlayer(page, name) {
  await page.evaluate((n) => {
    const p = board.find((x) => x.name === n);
    if (!p) throw new Error("not on the board: " + n);
    openSheet(p);
  }, name);
  return (await page.textContent(".jukenote")).replace(/\s+/g, " ").trim();
}

test.describe("the Juke score explains itself on the sheet", () => {
  test("one name, not three", async ({ context }) => {
    const page = await openApp(context);
    await start(page);

    /* The strip said "Juke score" and the meter 200px below it said
       "Overall", for the same figure, with nothing connecting them. "Overall"
       still appears on the sheet and correctly so — it is the board rank in
       the first cell — so this asserts the score's own label rather than the
       absence of a word. */
    await openPlayer(page, "Jahmyr Gibbs");

    const stripLabels = await page.$$eval(".rankcell span",
      (els) => els.map((e) => e.textContent.trim()));
    expect(stripLabels).toContain("Juke score");
    expect(stripLabels).toContain("Overall");          // the board rank cell

    const meterNames = await page.$$eval(".sig-head b",
      (els) => els.map((e) => e.textContent.trim()));
    expect(meterNames, "the meter carries the same name as the strip")
      .toContain("Juke score");
    expect(meterNames).not.toContain("Overall");

    const colHeads = await page.$$eval("thead th",
      (els) => els.map((e) => e.textContent.trim()));
    expect(colHeads, "the players table column").toContain("JUKE");
    expect(colHeads).not.toContain("OVR");
  });

  test("a 100 is explained, and says what it is measured against", async ({ context }) => {
    const page = await openApp(context);
    await start(page);
    const note = await openPlayer(page, "Jahmyr Gibbs");

    const score = await page.evaluate(() =>
      Math.round(overallScore(board.find((p) => p.name === "Jahmyr Gibbs"))));
    expect(score, "still the top of the board").toBe(100);

    // The projected points and the gap over replacement, beside the number
    // rather than in a title attribute no phone can reach.
    expect(note).toMatch(/projected points/);
    expect(note).toMatch(/against a replacement RB/);
  });

  test("a 0 says how far below replacement, because two zeros are not equal",
    async ({ context }) => {
      const page = await openApp(context);
      await start(page);

      const note = await openPlayer(page, "Michael Wilson");
      const state = await page.evaluate(() => {
        const p = board.find((x) => x.name === "Michael Wilson");
        return { score: overallScore(p), gap: replacementGap(p) };
      });

      expect(state.score, "clamped at the floor").toBe(0);
      expect(state.gap, "the real figure is negative").toBeLessThan(0);

      /* This is the whole point: the clamp is the majority state of the board,
         so a floor that cannot distinguish one point below replacement from
         sixty is telling most of the pool the same thing. */
      expect(note).toMatch(/Below replacement/);
      expect(note).toMatch(/territory begins at WR\d+/);
      expect(note).toMatch(/-?\d+ against a replacement WR/);
    });

  test("last season sits beside this season's projection", async ({ context }) => {
    const page = await openApp(context);
    await start(page);

    const note = await openPlayer(page, "Jahmyr Gibbs");
    expect(note, "the number the projection is being compared against")
      .toMatch(/Scored \d+ on \d{4} actuals \(\d+ games?\)/);

    /* Gibbs is the case the feature exists for: fewer projected points than he
       actually scored, and a higher score, because the projection compresses
       the field beneath him. If that ever stops being true of this player the
       assertion should be moved rather than deleted — the property under test
       is that the two numbers are computed independently, and a test that only
       checked they were equal would pass on a copy. */
    const both = await page.evaluate(() => {
      const p = board.find((x) => x.name === "Jahmyr Gibbs");
      return { now: overallScore(p), was: priorScore(p),
               projPts: p.projPts, priorPts: p.priorPts };
    });
    expect(both.was, "last season is scored, not copied").not.toBeNull();
    expect(both.was).not.toBe(both.now);
    expect(both.priorPts).not.toBe(both.projPts);
  });

  test("a rookie gets no invented prior score", async ({ context }) => {
    const page = await openApp(context);
    await start(page);

    const rookie = await page.evaluate(() => {
      const p = board.find((x) => x.priorPts === null);
      return p ? p.name : null;
    });
    expect(rookie, "somebody on the board has no last season").not.toBeNull();

    const note = await openPlayer(page, rookie);
    // A zero here would be a judgement about a season he was not in.
    expect(await page.evaluate((n) =>
      priorScore(board.find((p) => p.name === n)), rookie)).toBeNull();
    expect(note).toMatch(/No \d{4} season to compare against/);
  });

  test("last season rescores with the rules, like everything else",
    async ({ context }) => {
      const page = await openApp(context);

      /* Every other number on the page moves when the scoring table moves, and
         a historical score that did not would be the one figure on the sheet
         quietly describing a different league. buildPriorSeason() runs inside
         buildProjections() for exactly this reason. */
      const before = await page.evaluate(() => {
        const p = board.find((x) => x.pos === "WR" && x.priorPts !== null);
        return { name: p.name, pts: p.priorPts };
      });

      await page.evaluate(() => {
        document.querySelectorAll("details.setupbox").forEach((d) => (d.open = true));
      });
      await page.evaluate(() => {
        const el = document.querySelector('#scoringFields input[data-rule="rec"]');
        if (!el) throw new Error("no receptions rule input");
        el.value = "5";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });

      const after = await page.evaluate((n) => {
        const p = board.find((x) => x.name === n);
        return p.priorPts;
      }, before.name);

      expect(after, "five points a catch moved last season too")
        .toBeGreaterThan(before.pts);
    });
});
