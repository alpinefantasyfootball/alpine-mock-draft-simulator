/* The grading engine, checked from outside a browser's-eye read of the
   screen — the two guards CLAUDE.md's own "Grade" testing section already
   prescribes by hand, made permanent.

   A design review reported a team finishing 12 of 12 with a D− in every
   mock while that same team's own component readouts read as competitive
   — exactly the class of bug this file's own history has hit three times
   before (a constant component, an inverted subtraction, a superflex
   double-count). Reproduced across a 10-team and a 12-team fully
   CPU-driven draft and a deliberately lopsided 14-WR-only human draft: in
   every case the composite reconciled against its own weighted parts, no
   component came back constant across the room, and the Analysis screen's
   own rendered numbers matched analyseDraft()'s output for the same slot
   exactly. No live mismatch was found — this file is what's left standing
   after that search, so a real regression trips it instead of vanishing
   the way the reported one did. */

import { test, expect } from "@playwright/test";
import { openApp, startSoloDraft } from "./helpers.mjs";

/* Drives every seat with the app's own advice, mySlot included —
   autoPickForMe(), not cpuChoice(), so the human seat plays a
   real, need-aware draft rather than a synthetic one, matching
   tests/solo.spec.mjs's own finishDraft(). */
async function finishWithAdvice(page) {
  await page.evaluate(() => {
    let guard = 0;
    while (!draftOver() && guard++ < 500) {
      const c = onTheClock();
      if (!c) break;
      const choice = c.slot === state.mySlot ? autoPickForMe() : cpuChoice(c.slot, c.round);
      if (!choice) break;
      makePick(choice);
      pruneQueue();
    }
    render();
  });
}

/* Every 14-round pick is the cheapest available WR, need and roster
   construction both ignored on purpose — the worst-constructed roster a
   human tester could plausibly hand-draft, and the nearest reproduction
   available of "components look fine, grade doesn't" if there is one:
   starters and value both come from real, highly-drafted receivers, so
   they should not read as obviously bad the way an empty QB slot does. */
async function finishAllWR(page) {
  await page.evaluate(() => {
    let guard = 0;
    while (!draftOver() && guard++ < 500) {
      const c = onTheClock();
      if (!c) break;
      let choice;
      if (c.slot === state.mySlot) {
        const avail = board.filter((p) => !p.drafted && p.pos === "WR").sort((a, b) => a.adp - b.adp);
        choice = avail[0] || board.filter((p) => !p.drafted).sort((a, b) => a.adp - b.adp)[0];
      } else {
        choice = cpuChoice(c.slot, c.round);
      }
      if (!choice) break;
      makePick(choice);
    }
    render();
  });
}

async function readGrade(page) {
  return page.evaluate(() => {
    const all = analyseDraft();
    const w = { starters: 0.5, value: 0.25, build: 0.15, byes: 0.1 };
    const reconciles = all.every(
      (t) =>
        Math.abs(
          t.startersScaled * w.starters +
            t.valueScaled * w.value +
            t.buildScaled * w.build +
            t.byePenaltyScaled * w.byes -
            t.total
        ) < 1e-9
    );
    const spreads = ["starters", "value", "build", "byePenalty"].map(
      (k) => new Set(all.map((t) => Math.round(t[k + "Scaled"]))).size
    );
    const mine = all.find((t) => t.slot === state.mySlot);
    return { teams: all.length, reconciles, spreads, mine };
  });
}

/* The one check a component-level reconciliation can't catch: a right
   number rendered in the wrong place. Analysis had exactly this bug once
   — the standings column showed starter strength under a header reading
   the weighted total. Read what the Analysis screen actually prints and
   compare it to what analyseDraft() computed for that same slot. */
async function readAnalysisScreen(page) {
  /* A finished draft opens the report on its own - DraftRoom.jsx redirects
     the moment draftOver() goes true, as a full-screen z-[70] overlay over
     the header the tab strip lives in - so the Analysis tab is still there
     underneath, still reports itself visible, and is permanently unclickable
     once that overlay is up: it intercepts every pointer event meant for
     whatever it's covering. Every caller of this helper drives the draft to
     completion first, so the click below is only for a caller that doesn't -
     harmless today, load-bearing the moment one exists. */
  const alreadyOpen = await page.locator('#draftroom-root [class*="z-[70]"]').count();
  if (!alreadyOpen) {
    const analysisTab = page.locator('#draftroom-root button:text-is("Analysis")');
    await analysisTab.click();
  }
  const text = await page.locator("#draftroom-root").innerText();
  return text;
}

test("a fully CPU-driven draft grades every team consistently, at two league sizes", async ({ browser }) => {
  for (const teams of [10, 12]) {
    const context = await browser.newContext();
    const page = await openApp(context, "#/draft-room");
    await page.evaluate((n) => window.JukeEngine.setLeague({ ...window.JukeEngine.league(), teams: n }), teams);
    await page.waitForTimeout(200);
    await startSoloDraft(page);

    await page.evaluate(() => {
      let guard = 0;
      while (!draftOver() && guard++ < 500) {
        const c = onTheClock();
        if (!c) break;
        const choice = cpuChoice(c.slot, c.round);
        if (!choice) break;
        makePick(choice);
      }
      render();
    });

    const { teams: n, reconciles, spreads } = await readGrade(page);
    expect(n, `${teams}-team room graded`).toBe(teams);
    expect(reconciles, "every team's weighted total matches its own four parts").toBe(true);
    spreads.forEach((distinct, i) => {
      const names = ["starters", "value", "build", "byePenalty"];
      expect(distinct, `${names[i]} is not a constant across the room`).toBeGreaterThan(1);
    });

    await context.close();
  }
});

test("the Analysis screen's own numbers match what analyseDraft() computed for that seat", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context, "#/draft-room");
  await startSoloDraft(page);
  await finishWithAdvice(page);

  const { mine } = await readGrade(page);
  const screen = await readAnalysisScreen(page);

  expect(screen, "the printed grade letter").toContain(mine.grade);
  expect(screen, "the printed rank").toContain(`${mine.rank}${mine.rank === 1 ? "st" : mine.rank === 2 ? "nd" : mine.rank === 3 ? "rd" : "th"} of`);
  expect(screen, "the printed weighted score").toContain(`${Math.round(mine.total)} / 100`);

  await context.close();
});

/* Pins the room, which this comparison never did.

   startDraft() ends with `state.seed = Math.floor(Math.random() * 1000000)`
   followed immediately by applyJitter(), which stamps p.jitter onto every
   board player from that seed. So every draft was a different room, and the
   grade is *room-relative* — scaleAcross() ranks you against the other nine
   seats — which made this a comparison of two percentiles drawn from two
   different populations. It failed roughly one run in five and read as flake.

   It is not flake, and measuring it properly is what showed that. Pinned
   across ten seeds, with my seat drafting each way against an identical nine
   CPUs, the advised roster beats the 14-WR one in **8 of 10** rooms and loses
   two by 1 and 3 points. The all-WR roster is stable at 35 and rank 10 in
   every room; it is the advised roster that swings, from rank 3 to rank 9.

   Note the seed has to be pinned *and* applyJitter() re-run. Setting
   state.seed alone does nothing, because the jitter it feeds is already
   stamped on the board by then — an earlier version of this harness did
   exactly that and produced ten identical rows, which is what a pin that
   isn't pinning looks like. */
const PINNED_SEEDS = [1000, 8919, 16838, 24757, 32676, 40595, 48514, 56433, 64352, 72271];

async function gradeWithSeed(browser, seed, mode) {
  const context = await browser.newContext();
  const page = await openApp(context, "#/draft-room");
  await startSoloDraft(page);
  const grade = await page.evaluate(({ seed, mode }) => {
    state.seed = seed;
    applyJitter();
    let guard = 0;
    while (!draftOver() && guard++ < 500) {
      const c = onTheClock();
      if (!c) break;
      let choice;
      if (c.slot === state.mySlot) {
        if (mode === "advised") choice = autoPickForMe();
        else {
          const avail = board.filter((p) => !p.drafted && p.pos === "WR").sort((a, b) => a.adp - b.adp);
          choice = avail[0] || board.filter((p) => !p.drafted).sort((a, b) => a.adp - b.adp)[0];
        }
      } else {
        choice = cpuChoice(c.slot, c.round);
      }
      if (!choice) break;
      makePick(choice);
      pruneQueue();
    }
    const me = analyseDraft().find((t) => t.slot === state.mySlot);
    return { total: me.total, rank: me.rank, build: me.buildScaled };
  }, { seed, mode });
  await context.close();
  return grade;
}

test("the app's own advice beats a deliberately unbuilt roster in most rooms", async ({ browser }) => {
  test.slow();

  const results = [];
  for (const seed of PINNED_SEEDS) {
    const advised = await gradeWithSeed(browser, seed, "advised");
    const lopsided = await gradeWithSeed(browser, seed, "allwr");
    results.push({ seed, advised, lopsided });
  }

  // The unbuilt roster's own floor, asserted every time rather than once: 14
  // receivers and nothing else has no roster construction to speak of, and if
  // that ever stops being true the comparison below has lost its control.
  for (const r of results) {
    expect(r.lopsided.build, `seed ${r.seed}: 14 WRs have no construction`).toBeLessThan(30);
  }

  /* An aggregate, because the honest measurement is an aggregate. Asserting a
     win on every seed would be asserting something that is not true today —
     it loses two of ten — and picking the one seed where it wins would be
     choosing the answer. Eight of ten is the measured behaviour with a floor
     under it; a regression that puts the app's advice properly behind a
     nonsense roster drops below this and fails. */
  const wins = results.filter((r) => r.advised.total > r.lopsided.total).length;
  const detail = results
    .map((r) => `${r.seed}: ${Math.round(r.advised.total)} v ${Math.round(r.lopsided.total)}`)
    .join(", ");
  expect(wins, `advised beat all-WR in ${wins}/10 pinned rooms — ${detail}`).toBeGreaterThanOrEqual(7);

  /* And the thing actually worth watching. Measured over these ten rooms the
     advised seat finishes 9th of 10 in five of them, which is the app's own
     advice being out-drafted by the CPUs it is advising against — CLAUDE.md
     records that exact symptom once before, attributed to the model
     multiplier and supposedly closed by the scoringIsStock() gate. The
     default league is Half PPR, a stock format, so that gate should be
     holding. This bound is deliberately loose: it is not a target, it is a
     tripwire that says the advice has got materially worse than it is today. */
  const medianRank = results.map((r) => r.advised.rank).sort((a, b) => a - b)[Math.floor(results.length / 2)];
  expect(medianRank, `median finishing rank of the advised seat across ${results.length} rooms`).toBeLessThanOrEqual(9);
});
