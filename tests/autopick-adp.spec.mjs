/* autoPickForMe() has to draft the way a CPU seat would, and the way a
   deliberate queue entry says to — never further than either one, because
   both of the old failure modes moved an autopicked seat away from the
   room's own idea of a legal, market-priced pick:

   1. `suggestions("ALL")[0]` was the fallback once the queue ran dry, and
      suggestions() applies modelMultipliers() — up to a quarter off a
      player's ADP, capped at MODEL_CAP_PICKS raw picks — whenever
      scoringIsStock() is false. That discount is the Decide tab's own
      opinion for a human reading it. cpuChoice() never applies it, because
      every CPU seat in a room has to reach the identical verdict for an
      empty chair, discount or not — and an autopicked seat is exactly that
      kind of seat. So on a non-stock scoring table, the old fallback could
      reach for a player no CPU at the table would ever take.

   2. queueTop() returned the first still-on-the-board star with no legality
      check at all — not a roster-cap check, not the K/DST timing gate. A
      star queued early and left alone past the point it stopped being
      legal (a fourth tight end past the cap, a kicker queued before he is
      draftable) would be drafted exactly as queued, straight into a roster
      the engine would otherwise refuse.

   Both are fixed the same way: the fallback is cpuChoice() itself, the
   literal function object every CPU seat calls, and the queue walk skips
   anything needFromCount() would refuse for the round at hand. */

import { test, expect } from "@playwright/test";
import { openApp, startSoloDraft } from "./helpers.mjs";

/* Runs a full draft exactly like tests/solo.spec.mjs's own finishDraft():
   my seat plays autoPickForMe(), every other seat plays cpuChoice(c.slot,
   c.round) — the same two decisions driveRoomCPUs()/driveMyAutopilot() make
   for real. Records, for every one of my own picks, whether the model's own
   fallback (cpuChoice()) agreed with what autoPickForMe() actually chose,
   and whether the pick came out of the queue — the two things this file
   exists to check apart. */
async function finishTrackingMyPicks(page) {
  return page.evaluate(() => {
    const mine = [];
    let guard = 0;
    while (!draftOver() && guard++ < 1000) {
      const c = onTheClock();
      if (!c) break;
      let choice;
      if (c.slot === state.mySlot) {
        const cpu = cpuChoice(c.slot, c.round);
        choice = autoPickForMe();
        if (!choice) break;
        mine.push({
          name: choice.name,
          pos: choice.pos,
          round: c.round,
          overall: currentOverall(),
          boardRank: choice.overall,
          adp: choice.adp,
          fromQueue: state.queue.indexOf(choice.name) >= 0,
          matchesCpu: !!cpu && cpu.name === choice.name
        });
      } else {
        choice = cpuChoice(c.slot, c.round);
      }
      if (!choice) break;
      makePick(choice);
      pruneQueue();
    }
    render();
    return { mine, over: draftOver(), teams: league.teams, rounds: league.rounds };
  });
}

/* ---- 1. The model's own discount must never reach the autopick -------- */

/* On a stock table the two were already documented to agree (CLAUDE.md,
   "The suggestions" — measured over ten pinned seeds), so the case that
   actually distinguishes old from new is a non-stock table: `rec` bumped to
   5 a catch under a half-PPR board, so ADP still describes half-PPR while
   the scoring no longer does. league.rules.rec is set directly, before
   startDraft() runs buildBoard(), because React's own startDraft() bridge
   skips readSetup() entirely (see its own comment) — nothing resets rules
   back to the format default until the scoring dropdown itself changes. */
for (const [label, rec, seed] of [
  ["stock half-PPR", null, 8919],
  ["non-stock (5pt reception under a half-PPR board)", 5, 8919],
  ["non-stock (5pt reception under a half-PPR board)", 5, 40595],
]) {
  test(`autopick matches cpuChoice() pick for pick — ${label}, seed ${seed}`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openApp(context, "#/draft-room");

    if (rec !== null) await page.evaluate((r) => { league.rules.rec = r; }, rec);
    await startSoloDraft(page);
    await page.evaluate((s) => { state.seed = s; applyJitter(); }, seed);

    const out = await finishTrackingMyPicks(page);

    expect(out.mine.length, "the draft actually reached my seat more than once").toBeGreaterThan(5);

    const mismatches = out.mine.filter((p) => !p.matchesCpu);
    expect(mismatches, `autoPickForMe() disagreed with cpuChoice() on: ${
      mismatches.map((p) => `round ${p.round} ${p.name}`).join(", ")}`).toEqual([]);

    await context.close();
  });
}

/* ---- 2. A stale queue entry is skipped, not drafted or aborted -------- */

test("a queued tight end past the roster cap is skipped, not drafted into an illegal roster",
  async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openApp(context, "#/draft-room");
    await startSoloDraft(page);

    /* Four stars at a position capped at three (maxAt("TE") on the default
       league: 1 starter + 2 depth, no FLEX share). Queued once, up front,
       and never touched again — exactly the shape of the reported bug: a
       plan made early in the draft and left behind. */
    const cap = await page.evaluate(() => {
      const tes = board.filter((p) => p.pos === "TE").sort((a, b) => a.adp - b.adp).slice(0, 4);
      tes.forEach((p) => queueToggle(p.name));
      return maxAt("TE");
    });
    expect(cap, "the fixture assumes the default league's TE cap").toBe(3);

    const out = await finishTrackingMyPicks(page);

    const teCount = await page.evaluate(() => countAt(state.mySlot, "TE"));
    expect(teCount, "the fourth queued tight end never overflows the cap").toBeLessThanOrEqual(cap);

    // No pick from my seat is ever a K before the last two rounds or a DST
    // before the last three — the exact gate needFromCount() enforces, and
    // the one a stale queue entry used to bypass outright.
    const illegal = out.mine.filter((p) =>
      (p.pos === "K" && p.round < out.rounds - 1) ||
      (p.pos === "DST" && p.round < out.rounds - 2));
    expect(illegal, `illegal-timing picks: ${illegal.map((p) => `${p.pos} round ${p.round}`).join(", ")}`)
      .toEqual([]);

    expect(out.over, "the draft still finishes rather than stalling on a bad queue entry").toBe(true);

    await context.close();
  });

test("a kicker queued before he is legal is skipped until the round he actually is",
  async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openApp(context, "#/draft-room");
    await startSoloDraft(page);

    // Starred in round 1, for a kicker who is not legal until round 13 of 14.
    await page.evaluate(() => {
      const k = board.filter((p) => p.pos === "K").sort((a, b) => a.adp - b.adp)[0];
      queueToggle(k.name);
    });

    const out = await finishTrackingMyPicks(page);
    const kPicks = out.mine.filter((p) => p.pos === "K");

    expect(kPicks.length, "a kicker is still drafted eventually").toBeGreaterThan(0);
    expect(Math.min(...kPicks.map((p) => p.round)), "never before the round the app itself allows")
      .toBeGreaterThanOrEqual(out.rounds - 1);

    await context.close();
  });

/* ---- 3. The autopicked seat is not a systematic outlier in the grade --- */

/* A flat "no autopick reaches more than a round past ADP" bound was tried
   here first and measured false against cpuChoice() itself, not just
   against this fix — checked with a standalone node harness reusing
   needFromCount()/cpuChoice() verbatim against the real half-PPR board,
   with no browser or worker involved. cpuChoice()'s own need multiplier
   legitimately produces reaches past a round on ordinary skill positions
   whenever a starting slot is still unfilled (0.80x is a deliberate
   discount, not noise): a real run reached Trevor Lawrence 13 picks early
   at QB and Sam LaPorta 28 early at TE, both from a still-open starting
   slot, with nothing resembling the model-discount bug anywhere near them.
   K and DST reach further still and by design — CLAUDE.md's own draft-value
   section already measures kickers at a mean gap of -35 for exactly the
   reason this board did: their ADP is drawn from deeper drafts than this
   league runs, so the round the app itself schedules them into always
   reads as a reach. Asserting a per-pick bound cpuChoice() cannot meet on
   its own board would be exactly the "check carrying a standing red"
   CLAUDE.md's testing section warns against — true regardless of this fix,
   and unrelated to it. Test 1 above is the real per-pick guard: with an
   empty queue, autoPickForMe() has to equal cpuChoice() exactly, which
   already rules out any reach beyond what a CPU seat would produce.

   What is left worth checking here is the softer, room-relative claim the
   task actually cares about: that the fix does not leave the autopicked
   seat a systematic bottom-of-the-room outlier in the grade's own
   draft-value component, the way the model-discount bug used to (CLAUDE.md:
   "Draft Insights naming [an autopicked reach] the biggest reach of the
   draft"). Since an empty-queue autopick is now literally cpuChoice()'s own
   choice, this is a sanity net against that regression coming back, not a
   claim about how good the app's advice is — which is why it is loose. */
const SEEDS = [1000, 8919, 16838, 24757, 32676];

test("the autopicked seat's draft value is not a systematic bottom-of-room outlier",
  async ({ browser }) => {
    test.slow();

    const valueBySeed = [];

    for (const seed of SEEDS) {
      const context = await browser.newContext();
      const page = await openApp(context, "#/draft-room");
      await startSoloDraft(page);
      await page.evaluate((s) => { state.seed = s; applyJitter(); }, seed);

      await finishTrackingMyPicks(page);

      const grade = await page.evaluate(() => {
        const all = analyseDraft();
        const ranked = all.slice().sort((a, b) => b.value - a.value);
        return {
          myValue: all.find((t) => t.slot === state.mySlot).value,
          myRank: ranked.findIndex((t) => t.slot === state.mySlot) + 1,
          teams: all.length
        };
      });
      valueBySeed.push(grade);

      await context.close();
    }

    const lastEveryTime = valueBySeed.every((g) => g.myRank === g.teams);
    expect(lastEveryTime,
      `draft value ranked last in every seed: ${valueBySeed.map((g) => `${g.myRank}/${g.teams}`).join(", ")}`
    ).toBe(false);
  });
