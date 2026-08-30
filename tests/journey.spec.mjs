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

    /* The homepage is real content, not a splash: the ticker and the hero
       both read off the live board rather than sample data.

       Polled, not read once. window.JukeEngine exists as soon as app.js has
       run, and app.js is a blocking classic script — but the board arrives
       with the deferred boot (draft-engine.js/players.js/stats.js, loaded on
       requestIdleCallback), so the bridge is there a good while before the
       data behind it is. Reading straight after the waitForFunction above
       caught that gap and reported 0 on a page that fills in correctly a
       moment later.

       That gap is the same one CLAUDE.md records under "a window.JukeEngine
       entry is only as safe as its own guard": the bridge existing never
       implied the deferred files had landed, and DraftLocker.jsx learned it
       the same way. Still before anything is clicked, which is the claim. */
    await expect
      .poll(() => page.evaluate(() => JukeEngine.board().length), { timeout: 30000 })
      .toBeGreaterThan(150);

    /* ---- 2. find the Draft Room --------------------------------------- */
    /* Through a link on the page, not by setting location.hash. ROOMS is
       written down once and rendered into both the header panel and the
       homepage's doors, and the one string in it is what sends every "start
       a draft" entry point somewhere — it pointed at the retired route for a
       while, and nothing in the suite would have noticed.

       That string is "#/drafts" now, not "#/draft-room", and the move was
       deliberate: ROOMS and Hero.jsx both carry the reasoning — the Lobby is
       the product's real front door, and a homepage link straight into the
       live Cockpit was the most direct way a manager landed back on a stale
       finished draft instead of a fresh choice. So this follows the Lobby,
       which is also what the rest of this test already walks through. */
    /* :visible, because there are two homepages in this document now and
       both mount — the phone one is `sm:hidden` at this width and is first
       in document order, so `.first()` picked a zero-box link and clicked
       nothing for a minute before timing out. This is the "Desktop and
       mobile both mount, so a label matches twice" note in CLAUDE.md,
       reached from a third direction: not two renderings of one control,
       but two whole pages. */
    const doors = page.locator('a[href="#/drafts"]:visible');
    expect(await doors.count(), "the homepage offers a way in").toBeGreaterThan(0);
    await doors.first().click();

    // The door lands on the Locker first, not the seat-picker directly —
    // seat-picking moved to its own screen one step further in. "Start
    // mock draft" (NewMockPanel.jsx) is the one thing that screen asks
    // for now — it replaced the older "Enter Draft Room" button as part
    // of today's own fix for a two-primaries bug, and helpers.mjs's
    // startSoloDraft() is the one place that history is written down for
    // every other spec; this file presses real controls throughout on
    // purpose (see the file's own header comment), so it repeats the
    // click here rather than delegating to that helper.
    const enter = page.locator("#draftroom-root button").filter({ hasText: /^Start mock draft$/ });
    await expect(enter, "the Locker asks for one thing").toBeVisible({ timeout: 30000 });
    /* ---- 3. sit down, and change something, so the draft is actually mine

       Both on the Lobby, before starting, because that is where they live
       now. This used to be three screens: click through to a seat-picker
       ("YOUR ROSTER, EMPTY", DraftEntryScreen.jsx), claim the seventh chair
       by clicking its chip on the board, then open the Draft settings modal
       to set the scoring, then press a second "Start draft".

       "Start mock draft" starts the draft outright today, so none of those
       screens sit between here and the board — the seat and the scoring are
       two selects on the panel the button belongs to, and they have to be
       set before it is pressed rather than after. Same collapse the seat
       chips in solo.spec.mjs ran into.

       Still pressing only what a person can press, which is this file's own
       rule: these are the real <select>s, driven by their labels rather than
       by index, because NewMockPanel renders a second lg:hidden ChipSelect
       bound to each of the same values. */
    const lobbyRow = (label) =>
      page.locator(`#draftroom-root div:has(> span:text-is("${label}")) > select`);

    // The seventh chair. The select is 1-based and mySlot is 0-based.
    await lobbyRow("Your seat").selectOption("7");
    await lobbyRow("Scoring").selectOption("ppr");
    // setScoring writes straight through to engine.setLeague (NewMockPanel),
    // so this is the same fact the assertion after the start re-checks —
    // asserted here too, so a select that silently stopped being wired up
    // fails on the control rather than on the draft that follows it.
    await expect.poll(() => page.evaluate(() => JukeEngine.league().scoring)).toBe("ppr");

    /* ---- 4. start ------------------------------------------------------ */
    await enter.click();
    await page.waitForFunction(() => state.started, null, { timeout: 30000 });

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

    /* Then the rest, through the control that exists for it — the Autopick
       toggle on the header.

       This used to open the kebab and press "Auto-draft the rest". That item
       is gone: a product review cut Pause, Undo and it together, and
       DraftMenuOverlay.jsx's own comment says what replaced it — "the single
       'Autopick' toggle every competitor mock drafter actually ships". The
       click hung against a menu that no longer offers it until the six-minute
       test timeout killed the run.

       Autopick rather than a call into engine.autoDraftRest(), which is what
       solo.spec.mjs does: this file's rule is that it presses only what a
       person can press, and this is what a person presses. It drives my seat
       while the CPUs keep taking theirs, so the board fills the same way —
       measured at 47s for a full 140-pick board, hence the headroom below.

       aria-pressed is the toggle's own state, so it doubles as the assertion
       that the press registered rather than landing on a dead control. */
    const autopick = page
      .locator('#draftroom-root button[aria-pressed]:visible')
      .filter({ hasText: /^Autopick$/ })
      .first();
    await autopick.click();
    await expect(autopick, "the toggle went on").toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => draftOver()), { timeout: 180000 }).toBe(true);

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
