/* Starting a second mock after finishing a first one.

   Reported from the desktop app: finish a mock draft, press "Back to the
   locker", change the league, press "Start mock draft" — and land on the
   *previous* draft's insights report instead of a fresh board.

   Two independent defects sat on that path, and either one alone reproduces
   it, so both halves are asserted separately below.

   The engine half: JukeEngine.startDraft() set a seat, a clock and a seed
   and called buildBoard(), and never emptied state.picks. buildBoard() maps
   fresh player copies with drafted=false, which looks like the reset and is
   not — the draft is recorded in state.picks, not on the board. So the new
   draft opened holding the old one's picks and draftOver() was true before
   anything was drawn.

   The view half: DraftRoom.jsx's insights effect only ever watched the
   rising edge of draftIsOver. That component does not unmount between
   drafts — the Lobby is one of its own branches — so `view` stayed on
   'insights' from wherever the last draft left it, and a genuinely fresh
   draft still rendered a report: grade A+, every lineup slot "Empty".

   "Run another mock" on the report has always worked, because it goes
   through restart() -> goHome(), which clears all of this. That is what made
   the bug look intermittent, and it is why the fix belongs on the way *in*
   (one door) rather than on each of the several ways out. */

import { test, expect } from "@playwright/test";
import { openApp, startSoloDraft } from "./helpers.mjs";

// The report's own primary action, matched by its text rather than by a
// class string — the thing under test is "am I looking at a finished
// draft's report", and this button exists only there.
const REPORT = '#draftroom-root button:text-is("Run another mock")';

/* Pressing Start raises DraftRoom's `starting` loader, which covers the whole
   room for SonarLoader's full ring (2100ms). Asserting the view before it
   lifts finds no report because nothing at all is rendered yet — which passes
   against the bug and proves nothing. phone.spec.mjs already waits this out
   the same way: wait for the room's own nav to exist rather than for a
   duration, so the wait cannot rot the next time that floor moves. */
async function waitForRoom(page) {
  await page.waitForFunction(() => {
    const root = document.getElementById("draftroom-root");
    if (!root) return false;
    return [...root.querySelectorAll("button")]
      .some((b) => b.getBoundingClientRect().height > 0 && b.textContent.trim() === "Players");
  }, null, { timeout: 20000 });
}

async function finishDraft(page) {
  await page.evaluate(() => {
    let guard = 0;
    while (!draftOver() && guard++ < 600) {
      const c = onTheClock();
      if (!c) break;
      const choice = c.slot === state.mySlot ? autoPickForMe() : cpuChoice(c.slot, c.round);
      if (!choice) break;
      makePick(choice);
      pruneQueue();
    }
    render();
  });
  await page.waitForFunction(() => draftOver(), null, { timeout: 30000 });
}

test("a second mock started from the locker is a fresh draft, not the last one's report",
  async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openApp(context, "#/draft-room");

    await startSoloDraft(page);
    await waitForRoom(page);
    await finishDraft(page);

    // The report is the correct screen *here* — this is the rising edge the
    // insights effect exists for, and asserting it makes the check below a
    // statement about the transition rather than about a screen that might
    // simply never have appeared.
    await expect(page.locator(REPORT)).toBeVisible();
    const firstDraft = await page.evaluate(() => state.picks.length);
    expect(firstDraft).toBeGreaterThan(0);

    /* "Back to the locker" is a plain <a href="#/drafts">: it changes the
       route and touches no draft state. That is the whole point — the app
       must not depend on the way out having cleaned up. */
    await page.locator('#draftroom-root a:text-is("Back to the locker")').click();
    await page.waitForFunction(() => location.hash.startsWith("#/drafts"), null, { timeout: 10000 });

    // Change the league, exactly as the New Mock card does.
    await page.evaluate(() => window.JukeEngine.setLeague({ teams: 12, scoring: "ppr" }));
    await page.waitForTimeout(300);

    await startSoloDraft(page);
    await waitForRoom(page);

    const after = await page.evaluate(() => ({
      picks: state.picks.length,
      over: draftOver(),
      started: state.started,
      teams: window.JukeEngine.league().teams,
      drafted: board.filter((p) => p.drafted).length
    }));

    // The engine half.
    expect(after.started).toBe(true);
    expect(after.picks).toBe(0);
    expect(after.drafted).toBe(0);
    expect(after.over).toBe(false);
    expect(after.teams).toBe(12);

    // The view half. Asserted separately because the engine being clean is
    // not enough on its own: with state.picks emptied and the falling edge
    // still unhandled, this is exactly the state that rendered an A+ report
    // over an empty roster.
    await expect(page.locator(REPORT)).toHaveCount(0);

    await context.close();
  });

test("finishing a draft still opens its report", async ({ browser }) => {
  /* The counterpart, and not redundant: the falling-edge reset above is one
     `else` away from also firing on the rising edge and suppressing the
     report altogether. A fix that quietly stopped Insights opening would
     pass every assertion in the test above. */
  const context = await browser.newContext();
  const page = await openApp(context, "#/draft-room");

  await startSoloDraft(page);
  await waitForRoom(page);
  await expect(page.locator(REPORT)).toHaveCount(0);

  await finishDraft(page);
  await expect(page.locator(REPORT)).toBeVisible();

  await context.close();
});

test("autopilot does not carry from one draft into the next", async ({ browser }) => {
  /* Third leak on the same path, found while fixing the two above. Autopick
     is a decision about the next few minutes — "I am stepping away" — and
     app.js already refuses to persist the room-side equivalent (state.autoMe)
     for exactly that reason. The solo toggle is React state on a component
     that does not unmount between drafts, so it stayed armed, and a manager
     who had walked away from a finished draft got their next team drafted
     for them without asking.

     Asserted on aria-pressed rather than on the toggle's colour classes: it
     is the attribute that actually carries the state, and the one a screen
     reader is given. */
  const context = await browser.newContext();
  const page = await openApp(context, "#/draft-room");

  const toggle = page.locator('#draftroom-root button[aria-pressed]:has-text("Autopick")').first();

  await startSoloDraft(page);
  await waitForRoom(page);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await finishDraft(page);
  await page.locator('#draftroom-root a:text-is("Back to the locker")').click();
  await page.waitForFunction(() => location.hash.startsWith("#/drafts"), null, { timeout: 10000 });

  await startSoloDraft(page);
  await waitForRoom(page);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await context.close();
});
