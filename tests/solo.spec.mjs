/* The solo draft, driven through the button rather than around it.

   Calling autoDraftRest() straight from the console drafts a full board
   whether or not a draft was ever started, so a harness that skips the Start
   button will happily pass a configuration the app refuses to run — which is
   how a league with one more round than roster spots went unnoticed. Every
   test here presses the button and asserts `state.started` before it believes
   a single pick. */

import { test, expect } from "@playwright/test";
import { openApp, setLegacyField, clickLegacyStart } from "./helpers.mjs";

async function runSoloDraft(page, setup) {
  await page.evaluate(async (fields) => {
    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      el.value = String(value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 400));
  }, setup);

  const refused = await page.evaluate(() => document.getElementById("startBtn").disabled);
  expect(refused, "the Start button refused this league").toBe(false);

  await clickLegacyStart(page);
  expect(await page.evaluate(() => state.started), "the draft actually started").toBe(true);

  return page.evaluate(async () => {
    autoDraftRest();
    await new Promise((r) => setTimeout(r, 3000));
    const perSeat = {}, qbs = {};
    state.picks.forEach(function (p) {
      perSeat[p.slot] = (perSeat[p.slot] || 0) + 1;
      if (p.player.pos === "QB") qbs[p.slot] = (qbs[p.slot] || 0) + 1;
    });
    return {
      picks: state.picks.length,
      distinct: new Set(state.picks.map((p) => p.player.name)).size,
      seats: Object.keys(perSeat).length,
      sizes: Object.values(perSeat),
      qbEach: Object.keys(perSeat).map((s) => qbs[s] || 0),
      kickerRounds: state.picks.filter((p) => p.player.pos === "K").map((p) => p.round),
      over: draftOver()
    };
  });
}

test("the default league drafts to the end", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);

  const out = await runSoloDraft(page, {});

  expect(out.picks).toBe(140);
  expect(out.distinct, "no player drafted twice").toBe(140);
  expect(out.seats).toBe(10);
  expect(out.sizes.every((n) => n === 14), "fourteen a team").toBe(true);
  expect(Math.min(...out.kickerRounds), "no kicker before round 13").toBeGreaterThanOrEqual(13);
  expect(out.over).toBe(true);

  await context.close();
});

/* A different shape, and the bench is the point of it: eight starters, a
   FLEX and five bench is fourteen spots, so fifteen rounds needs a sixth
   bench seat or the app is right to refuse. This file used to describe a
   league the app will not run. */
test("twelve teams, fifteen rounds, full PPR, bench six", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);

  const out = await runSoloDraft(page, {
    teamCount: 12, roundCount: 15, scoring: "ppr", benchCount: 6
  });

  expect(out.picks).toBe(180);
  expect(out.distinct).toBe(180);
  expect(out.seats).toBe(12);
  expect(out.sizes.every((n) => n === 15), "fifteen a team").toBe(true);
  expect(out.qbEach.every((n) => n === 1), "one quarterback each").toBe(true);
  expect(Math.min(...out.kickerRounds), "no kicker before round 14").toBeGreaterThanOrEqual(14);

  await context.close();
});

/* Reported from a real draft: eleventh of twelve, auto-draft pressed part way
   through, and it stopped in the ninth round without a word.

   The cause was a position chip on the Suggestions panel. `suggestions()` is
   filtered by it, so a manager looking at tight ends who already held their
   three had an empty list — and the loop read an empty list as "there is
   nothing left to draft" and abandoned the rest of the draft.

   Driven through the real chips, because the chip is the input that caused
   it, and every one of them is tried: the bug is not about tight ends, it is
   about the panel's filter reaching a decision it was never part of. */
for (const pos of ["ALL", "QB", "RB", "WR", "TE", "K", "DST"]) {
  test(`auto-draft finishes with the ${pos} filter showing`, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openApp(context);

    await setLegacyField(page, "teamCount", "12");
    await setLegacyField(page, "draftSlot", "10");        // the 11th spot
    await clickLegacyStart(page);
    expect(await page.evaluate(() => state.started)).toBe(true);

    await page.click(`#suggestFilter button[data-pos="${pos}"]`);
    expect(await page.evaluate(() => state.filterSuggest)).toBe(pos);

    // Part way in by hand, which is when a person reaches for the button.
    await page.evaluate(() => {
      let guard = 0;
      while (state.picks.length < 100 && guard++ < 300) {
        const c = onTheClock();
        const choice = c.slot === state.mySlot ? autoPickForMe() : cpuChoice(c.slot, c.round);
        if (!choice || makePick(choice)) break;
        pruneQueue();
      }
      render();
    });

    const out = await page.evaluate(async () => {
      autoDraftRest();
      await new Promise((r) => setTimeout(r, 1500));
      const sizes = {};
      state.picks.forEach((p) => { sizes[p.slot] = (sizes[p.slot] || 0) + 1; });
      return {
        picks: state.picks.length,
        distinct: new Set(state.picks.map((p) => p.player.name)).size,
        sizes: Object.values(sizes),
        kickerRounds: state.picks.filter((p) => p.player.pos === "K").map((p) => p.round)
      };
    });

    expect(out.picks, "the button finishes the draft or the board is empty").toBe(168);
    expect(out.distinct).toBe(168);
    expect(out.sizes.every((n) => n === 14)).toBe(true);
    // The fallback must not reach for a kicker to keep the loop moving.
    expect(Math.min(...out.kickerRounds)).toBeGreaterThanOrEqual(13);

    await context.close();
  });
}

/* Nobody sits on a bench outranking the player in a slot they could fill.

   `bestLineup()` used to sort candidates by `posRank`, which is a rank inside
   a position, so filling a FLEX from TE19, RB25 and WR28 took the tight end —
   19 being a smaller number than 25 — even though that tight end was below
   replacement at his own position and the running back was five places above
   his. Half the grade is starter strength, and it was being computed off a
   lineup nobody would field.

   Asserted across every team in the room rather than the one being watched,
   because the component is scaled against the rest of the room: one team's
   lineup being wrong moves everybody's grade. */
test("every lineup fields the best eligible player", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);

  await setLegacyField(page, "teamCount", "12");
  await clickLegacyStart(page);
  await page.evaluate(async () => { autoDraftRest(); await new Promise((r) => setTimeout(r, 2000)); });

  const out = await page.evaluate(() => {
    const all = analyseDraft();
    const violations = [];
    all.forEach((t) => {
      const bench = t.roster.filter((p) => !t.lineup.some((s) => s.player === p));
      t.lineup.forEach((s) => {
        if (!s.player) return;
        bench.forEach((b) => {
          if (fillsSlot(b, s.slot) && aboveReplacement(b) > aboveReplacement(s.player)) {
            violations.push(`team ${t.slot} ${s.slot}: ${s.player.name} ` +
              `(${aboveReplacement(s.player)}) benched behind ${b.name} (${aboveReplacement(b)})`);
          }
        });
      });
    });
    const w = WEIGHTS;
    return {
      violations,
      // The two checks CLAUDE.md asks for beside it: a component that is the
      // same for everybody is not in the grade, and a total has to equal its
      // own parts.
      distinct: ["startersScaled", "valueScaled", "buildScaled", "byePenaltyScaled"]
        .map((k) => new Set(all.map((t) => Math.round(t[k]))).size),
      reconciles: all.every((t) => Math.abs(
        t.startersScaled * w.starters + t.valueScaled * w.value +
        t.buildScaled * w.build + t.byePenaltyScaled * w.byes - t.total) < 1e-9)
    };
  });

  expect(out.violations).toEqual([]);
  expect(out.reconciles, "each total equals its own weighted parts").toBe(true);
  expect(Math.min(...out.distinct), "no component is a constant across the room").toBeGreaterThan(1);

  await context.close();
});

test("solo still says 'Auto-draft the rest', because solo it is the truth", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);
  await clickLegacyStart(page);
  await expect(page.locator("#autoBtn")).toHaveText("Auto-draft the rest");
  await context.close();
});

/* The roster-need chip, which said a thing the app never enforced.

   It printed `have/starters` in every state and turned green once the
   starting slot was filled, so one tight end painted a green "TE 1/1" — a
   success colour on a fraction that reads as a ceiling. Reported from a real
   draft as the app refusing a second tight end. It had refused nothing: the
   Draft button was never disabled, and there were nineteen on the board.

   So this asserts the two halves together — what the chip says, and what the
   board actually allows — because the bug was entirely the gap between them. */
test("a filled starting slot is not a cap, and does not claim to be", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);
  await clickLegacyStart(page);

  const out = await page.evaluate(async () => {
    const chip = (pos) => {
      const b = [...document.querySelectorAll("#playerFilter button")]
        .find((x) => x.dataset.pos === pos);
      return {
        text: b.textContent.trim(),
        cls: [...b.classList].filter((c) => c !== "on").join(" "),
        colour: getComputedStyle(b.querySelector(".need")).color
      };
    };

    // Reach my turn, take a tight end, then reach my turn again so the row
    // buttons are live — a disabled button on somebody else's clock proves
    // nothing about tight ends.
    while (!isMyTurn()) { const c = onTheClock(); makePick(cpuChoice(c.slot, c.round)); }
    makePick(board.find((p) => p.pos === "TE" && !p.drafted));
    while (!isMyTurn() && !draftOver()) { const c = onTheClock(); makePick(cpuChoice(c.slot, c.round)); }

    state.filterPlayers = "TE";
    render();
    const rows = [...document.querySelectorAll("#playerTable tbody tr")]
      .filter((tr) => !tr.classList.contains("drafted"));

    const withOne = chip("TE");
    const shortRB = chip("RB");

    /* Read before the roster is stuffed below, not after. Everything past
       this point pushes picks straight into state.picks to reach the cap,
       which moves whose turn it is — so a turn asked for at the end of this
       block is an answer about a board the test built, not the one it drove. */
    const onMyTurn = isMyTurn();
    const teAvailable = rows.length;
    const teDisabled = rows.filter((tr) => tr.querySelector(".draft-btn").disabled).length;

    // And at the cap the chip is allowed to say so, because there it is true.
    while (countAt(state.mySlot, "TE") < maxAt("TE")) {
      const te = board.find((p) => p.pos === "TE" && !p.drafted);
      te.drafted = true;
      state.picks.push({ overall: state.picks.length + 1, round: 1,
                         slot: state.mySlot, player: te });
    }
    render();

    return {
      onMyTurn, teAvailable, teDisabled,
      withOne, shortRB,
      atCap: chip("TE"),
      capIsAboveStarters: maxAt("TE") > league.starters.TE
    };
  });

  // The board never blocked a second tight end, which is the whole report.
  expect(out.onMyTurn, "asked while the clock was mine").toBe(true);
  expect(out.teAvailable, "there were tight ends to take").toBeGreaterThan(1);
  expect(out.teDisabled, "no available tight end was unclickable").toBe(0);
  expect(out.capIsAboveStarters).toBe(true);

  // One tight end is a met requirement, not a full position: no denominator
  // to imply a ceiling, and not the colour that says "done".
  expect(out.withOne.text, "the fraction is dropped once it is paid").toBe("TE1");
  expect(out.withOne.cls).toBe("met");
  expect(out.withOne.colour, "and it is not coloured like a warning or a win")
    .not.toBe(out.shortRB.colour);

  // Still short is still worth saying, and still a fraction.
  expect(out.shortRB.text).toBe("RB0/2");
  expect(out.shortRB.cls).toBe("short");

  // The one honest stop.
  expect(out.atCap.text).toBe("TE3");
  expect(out.atCap.cls).toBe("full");

  await context.close();
});

/* The rail's way through to the rest of the roster.

   The bench row exists to say the rail is not showing you everything — nine
   starting slots above a heading that counts fourteen — and it ended in a blue
   "My Team" that was a <span> wired to nothing. It read as a link on every
   screen the app has; it was reported from the installed desktop app only
   because that is where somebody sat and tried to click it.

   Asserted as a journey rather than as markup: press it, and end up looking at
   the players it was telling you about. */
test("the rail's My Team goes to My Team", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openApp(context);
  await clickLegacyStart(page);

  await page.evaluate(() => {
    let g = 0;
    while (rosterOf(state.mySlot).length < 12 && g++ < 200) {
      const c = onTheClock();
      makePick(c.slot === state.mySlot ? autoPickForMe() : cpuChoice(c.slot, c.round));
    }
    render();
  });

  const before = await page.evaluate(() => ({
    benched: document.querySelector(".benchsum .rfill").textContent.trim(),
    panel: document.querySelector(".panel.on").id,
    tab: document.querySelector(".tabs button.on").dataset.tab
  }));
  expect(before.benched, "there are players the rail is not showing").toMatch(/on the bench$/);
  expect(before.panel).not.toBe("tab-team");

  // A control, not a coloured word. Playwright's click fails a <span> that
  // nothing listens to only by way of the assertions below, so this is checked
  // outright: the thing that looks pressable has to be pressable.
  const rtm = page.locator(".benchsum .rtm");
  await expect(rtm).toHaveText("My Team");
  expect(await rtm.evaluate((el) => el.tagName), "it is a real control").toBe("BUTTON");

  await rtm.click();

  const after = await page.evaluate(() => ({
    panel: document.querySelector(".panel.on").id,
    tab: document.querySelector(".tabs button.on").dataset.tab,
    railOpen: document.body.classList.contains("rail-open"),
    // The whole roster, which is the thing the rail could not show.
    rows: document.querySelectorAll("#benchList li").length
  }));

  /* `.rtm` is worn by two things — this button, and the trailing "RB · SF" on
     every ordinary roster row — and styling the bare class put a pointer, a
     hover underline and 10px of padding onto all of them. It shipped that way
     for one deploy. The control half is scoped to `button.rtm` now, and this
     is what says so. */
  const bleed = await page.evaluate(() => {
    const spans = [...document.querySelectorAll(".railslots li:not(.benchsum) .rtm")];
    const btn = document.querySelector(".benchsum button.rtm");
    return {
      rows: spans.length,
      inert: spans.every((el) => {
        const s = getComputedStyle(el);
        return s.cursor === "auto" && s.paddingLeft === "0px" && s.marginTop === "0px";
      }),
      buttonCursor: getComputedStyle(btn).cursor,
      // Still the same typography, or the fix would have changed how it looks.
      sameType: getComputedStyle(btn).fontSize === getComputedStyle(spans[0]).fontSize
    };
  });
  expect(bleed.rows, "there are ordinary roster rows to bleed onto").toBeGreaterThan(1);
  expect(bleed.inert, "plain roster labels are not dressed as controls").toBe(true);
  expect(bleed.buttonCursor, "and the one that is, is").toBe("pointer");
  expect(bleed.sameType).toBe(true);

  expect(after.panel, "it opens My Team").toBe("tab-team");
  // The strip has to follow, or the app is on a tab its own nav says it is not.
  expect(after.tab, "and the tab strip agrees").toBe("tab-team");
  expect(after.railOpen, "the sheet gets out of the way of what it opened").toBe(false);
  expect(after.rows, "and the bench is actually listed").toBeGreaterThan(0);

  await context.close();
});
