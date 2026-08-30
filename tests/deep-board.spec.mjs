/* Below real ADP there is no more market signal to rank by, and the app
   owes the reader the same honesty UNRANKED_POSITIONS already gets for a
   kicker or a defense: a claim with no draft behind it is not the same
   claim as one FFC's real drafts priced. See CLAUDE.md's "Take the board
   past 228 players" and extend_deep_bench() in scripts/build_players.py.

   Unlike K/DST, a deep-bench player's score is never withheld — there is
   no three-season finding that the ranking is wrong, only the fact that
   no real draft has ever taken this player. So these tests check for a
   note and a marker, never a null.

   Gated on the board actually carrying a deep player: players.js only
   reaches past real ADP once the pipeline has run with real network
   access, and this checkout may be sitting between rebuilds. Same skip
   idiom news.spec.mjs already uses against a keyless worker — verify it in
   both directions, and treat a run where it never fires as informative
   too. */

import { test, expect } from "@playwright/test";
import { openApp, startSoloDraft } from "./helpers.mjs";

async function hasDeepBench(page) {
  // A non-empty patch, even to the current default, so the bridge's own
  // setLeague() has actually run buildBoard() before board is read — the
  // guard's own poolSize()/setupProblem() read PLAYERS_SETS directly and
  // don't need this, but every per-player field here (deep, projPts, sd,
  // td) only exists once buildBoard() has copied it onto `board`.
  await page.evaluate((p) => window.JukeEngine.setLeague(p), { teams: 10 });
  return page.evaluate(() => typeof board !== "undefined" && board.some((p) => p.deep));
}

test.describe("deep-bench players carry no real ADP, and say so", () => {
  test("jukeReadout() notes it without withholding the score", async ({ context }) => {
    const page = await openApp(context);
    test.skip(!(await hasDeepBench(page)),
      "no deep-bench players on this board yet -- needs a data pipeline run");

    const r = await page.evaluate(() => {
      const deep = board.find((p) => p.deep && p.projPts !== null);
      const real = board.find((p) => !p.deep && p.projPts !== null);
      return {
        deepReadout: deep ? window.JukeEngine.jukeReadout(deep) : null,
        realReadout: real ? window.JukeEngine.jukeReadout(real) : null,
      };
    });

    expect(r.deepReadout, "there is a deep player with a real projection to test").not.toBeNull();
    expect(r.deepReadout.deep).toBe(true);
    expect(typeof r.deepReadout.deepNote).toBe("string");
    expect(r.deepReadout.deepNote.length).toBeGreaterThan(0);
    // Not withheld -- see this file's own header comment.
    expect(r.deepReadout.score, "the score is a real number, not null").not.toBeNull();

    expect(r.realReadout, "there is a real-ADP player with a projection to compare against").not.toBeNull();
    expect(r.realReadout.deep, "a real-ADP player carries no deep flag").toBe(false);
    expect(r.realReadout.deepNote).toBeNull();
  });

  test("survivalProbability() withholds rather than divide by a fabricated sample", async ({ context }) => {
    const page = await openApp(context);
    test.skip(!(await hasDeepBench(page)),
      "no deep-bench players on this board yet -- needs a data pipeline run");

    const r = await page.evaluate(() => {
      const deep = board.find((p) => p.deep);
      return { sd: deep.sd, td: deep.td, prob: survivalProbability(deep, deep.overall + 20) };
    });

    expect(r.sd, "no real ADP sample to measure a spread from").toBe(0);
    expect(r.td, "and no sample size either").toBe(0);
    expect(r.prob, "so no fabricated survival odds").toBeNull();
  });

  test("the Players table marks a deep-bench player, once a draft reaches one", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openApp(context, "#/draft-room");
    test.skip(!(await hasDeepBench(page)),
      "no deep-bench players on this board yet -- needs a data pipeline run");

    // A deep league, so the visible list actually reaches past real ADP —
    // the default ten-team, fourteen-round league never gets there.
    await page.evaluate((p) => window.JukeEngine.setLeague(p), { teams: 12, rounds: 20, bench: 11 });
    await page.waitForTimeout(500);
    await startSoloDraft(page);
    await page.waitForTimeout(2000);

    /* textContent, not innerText and not a text-matching locator. Both of
       those approximate what a sighted user sees right now, which for a
       several-hundred-row table with no windowing (PlayerQueueSidebar.jsx
       explains why not) reported this badge and divider missing — for
       text provably in the DOM the whole time, confirmed by re-querying
       the identical page with textContent and finding player names run
       correctly from real ADP down through the deep tail. Chromium's
       innerText does not promise to include text outside a long scrolled
       container's current layout viewport the way textContent does, and a
       locator's own text matching hit the identical gap. Query the DOM
       directly instead of asking what's "visible". */
    const r = await page.evaluate(() => {
      const root = document.getElementById("draftroom-root");
      return {
        hasDivider: root.textContent.includes("Real ADP ends here"),
        badgeCount: [...root.querySelectorAll("span")].filter((s) => s.textContent === "Deep").length,
      };
    });

    expect(r.hasDivider, "the deep-board divider renders in board order").toBe(true);
    expect(r.badgeCount, "at least one per-row confidence badge renders").toBeGreaterThan(0);

    await context.close();
  });
});
