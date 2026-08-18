/* What the draft board says beyond the picks themselves: whose column it is,
   where the draft is, what every team holds, and how far away a pick is.

   Both were blue before this — the same blue as the focus ring, the selected
   tab, --link, .draft-btn and the header when the clock is yours. A colour
   doing five jobs is not a signal, which is the design half.

   The bug half is smaller and worse. `mine` only ever went on a *filled*
   cell, so the board marked where you had been and never where you were
   going — and where you are going next is the one question a snake board
   exists to answer. Nothing failed, nothing logged, and every check this
   project runs passed: the cells that were marked were marked correctly.

   Contrast is the load-bearing test here and it is not the usual one. These
   are marks rather than type, so the bar is 1.4.11's 3:1 rather than 4.5 —
   but the surface underneath is not knowable from one rule. A ring lands on
   six position solids, which are fixed across themes, and on an empty cell,
   which is near-black in dark and near-white in light. Measured, no single
   colour survives that, so the ring is a *pair* and the test is that one half
   of the pair always has the surface it is sitting on.
*/

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

async function draftInto(page, picks) {
  await page.evaluate((n) => {
    document.querySelectorAll("details.setupbox").forEach((d) => (d.open = true));
    document.getElementById("startBtn").click();
    for (let i = 0; i < n; i++) { const c = onTheClock(); if (c) makePick(cpuChoice(c.slot, c.round)); }
    render();
  }, picks);
  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
}

/* Relative luminance and WCAG contrast, on rgb() strings as the browser
   reports them. Written here rather than imported because the board-card
   suite's copy composites opacity as well, which nothing here needs. */
const CONTRAST = `
  function lum(c) {
    const [r, g, b] = c.map((v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function rgb(s) { return s.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number); }
  function ratio(a, b) {
    const x = lum(rgb(a)), y = lum(rgb(b));
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
`;

test.describe("the board's two rings", () => {
  test("your column is marked all the way down, drafted or not",
    async ({ context }) => {
      const page = await openApp(context);
      await draftInto(page, 26);

      const r = await page.evaluate(() => {
        const cells = [...document.querySelectorAll(".board .cell")];
        const perRow = league.teams;
        const marked = [], mineIndexes = [];
        cells.forEach((c, i) => {
          if (c.classList.contains("mine")) { marked.push(i % perRow); mineIndexes.push(i); }
        });
        return {
          mySlot: state.mySlot,
          rounds: league.rounds,
          columns: [...new Set(marked)],
          count: mineIndexes.length,
          // The half that was missing: your future picks.
          emptyMarked: mineIndexes.filter((i) => cells[i].classList.contains("empty")).length
        };
      });

      expect(r.columns, "exactly one column is marked, and it is yours").toEqual([r.mySlot]);
      expect(r.count, "one cell per round, top to bottom").toBe(r.rounds);
      /* 26 picks of a ten-team draft is round three, so eleven of your
         fourteen are still ahead of you. Before this they carried nothing. */
      expect(r.emptyMarked, "your picks still to come are marked too")
        .toBeGreaterThan(r.rounds / 2);
    });

  test("the live ring is on the pick that is on the clock, and moves with it",
    async ({ context }) => {
      const page = await openApp(context);
      await draftInto(page, 26);

      const first = await page.evaluate(() => {
        const now = document.querySelector(".board .cell.now");
        const c = onTheClock();
        return { text: now && now.textContent.trim(), count:
          document.querySelectorAll(".board .cell.now").length, round: c.round, slot: c.slot };
      });
      expect(first.count, "exactly one cell is on the clock").toBe(1);

      await page.evaluate(() => { const c = onTheClock(); makePick(cpuChoice(c.slot, c.round)); render(); });

      const next = await page.evaluate(() => {
        const c = onTheClock();
        return { count: document.querySelectorAll(".board .cell.now").length,
                 round: c.round, slot: c.slot };
      });
      expect(next.count, "still exactly one").toBe(1);
      expect([next.round, next.slot], "and it has moved on")
        .not.toEqual([first.round, first.slot]);
    });

  test("both rings survive every surface they can land on, in both themes",
    async ({ browser }) => {
      for (const theme of ["dark", "light"]) {
        const context = await browser.newContext();
        const page = await openApp(context);
        await draftInto(page, 60);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);

        const bad = await page.evaluate(({ contrast }) => {
          eval(contrast);
          /* Transitions off before any colour is read: a pane that is not
             compositing produces no frames, so a transition never advances
             and getComputedStyle reports the starting value indefinitely. */
          const kill = document.createElement("style");
          kill.textContent = "* { transition: none !important }";
          document.head.appendChild(kill);

          /* The ring is `inset 0 0 0 2px <ring>, inset 0 0 0 3px <keyline>`,
             so the two colours come back in that order. Read from the
             computed style rather than from the token, because what matters
             is what the cell actually draws. */
          const colours = (el) =>
            (getComputedStyle(el).boxShadow.match(/rgba?\([^)]+\)/g) || []);

          const out = [];
          document.querySelectorAll(".board .cell.mine, .board .cell.now").forEach((cell) => {
            const under = getComputedStyle(cell).backgroundColor;
            const ring = colours(cell);
            if (ring.length < 2) { out.push({ why: "no ring pair", cls: cell.className }); return; }
            /* The claim the design rests on: one half of the pair always has
               the surface. Not both — gold on a light empty cell is 1.26 and
               is meant to be, which is exactly why the keyline exists. */
            const best = Math.max(...ring.map((c) => ratio(c, under)));
            if (best < 3) out.push({ why: "ring lost its surface", cls: cell.className,
                                     under, ring, best: Math.round(best * 100) / 100 });
            // And the pair has to read as an edge against itself.
            if (ratio(ring[0], ring[1]) < 3) out.push({ why: "pair is one colour", ring });
          });
          document.head.removeChild(kill);
          return out;
        }, { contrast: CONTRAST });

        expect(bad, `every ring holds its surface in ${theme}`).toEqual([]);
        await context.close();
      }
    });
});

/* Two readings the board could always have offered and did not, both from
   data the app already had. The roster strip is `state.picks` grouped; the
   overall number is snake arithmetic the engine already owns. Neither is new
   information — they are the difference between a board you read and a board
   you do sums against. */
test.describe("what the board tells you about everybody else", () => {
  test("the roster strip counts what each team holds, and skips the two the app schedules itself",
    async ({ context }) => {
      const page = await openApp(context);
      // Deep enough that kickers and defenses are legal and actually drafted.
      await draftInto(page, 140);

      const r = await page.evaluate(() => {
        const heads = [...document.querySelectorAll(".board .hd")].slice(1);
        return {
          teams: league.teams,
          shown: heads.map((h) => [...h.querySelectorAll(".hd-pos")].map((c) => ({
            pos: [...c.classList].find((x) => x !== "hd-pos"),
            n: Number(c.textContent)
          }))),
          truth: heads.map((_, s) => POSITIONS.map((p) => ({ pos: p, n: countAt(s, p) }))),
          // Somebody really did take one, or the exclusion below proves nothing.
          forcedDrafted: state.picks.filter((p) => FORCED_LATE[p.player.pos]).length
        };
      });

      expect(r.shown.length, "one strip per team").toBe(r.teams);
      expect(r.forcedDrafted, "kickers and defenses were drafted").toBeGreaterThan(0);

      r.shown.forEach((strip, s) => {
        const truth = r.truth[s];
        /* Counted positions are derived from FORCED_LATE rather than listed.
           K and DST are the two the app schedules itself — cpuScore() refuses
           them until the closing rounds — so counting them is eight columns
           of "0 0" and then eight of "1 1". */
        expect(strip.map((c) => c.pos), `team ${s} counts the chosen positions`)
          .toEqual(["QB", "RB", "WR", "TE"]);
        strip.forEach((chip) => {
          const want = truth.find((t) => t.pos === chip.pos).n;
          expect(chip.n, `team ${s} ${chip.pos}`).toBe(want);
        });
      });

      // And the strip is not uniformly zero, which would pass every line above.
      expect(new Set(r.shown.flat().map((c) => c.n)).size,
        "teams differ from each other").toBeGreaterThan(1);
    });

  test("a count is white on its own solid, so the header behind it never matters",
    async ({ browser }) => {
      for (const theme of ["dark", "light"]) {
        const context = await browser.newContext();
        const page = await openApp(context);
        await draftInto(page, 60);
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);

        /* This is the test the design was chosen for. Colouring the *text* by
           position was tried first and measured: the light-theme --*-fg tones
           run 4.85 to 5.69 on --board-hd and 2.15 to 2.52 on the navy of your
           own column — so the one team a manager looks at most is the one
           that would have failed, in one theme only. A chip carrying its own
           ground cannot have that bug, and this asserts it cannot come back. */
        const bad = await page.evaluate(({ contrast }) => {
          eval(contrast);
          const kill = document.createElement("style");
          kill.textContent = "* { transition: none !important }";
          document.head.appendChild(kill);
          const out = [];
          document.querySelectorAll(".board .hd-pos").forEach((chip) => {
            const st = getComputedStyle(chip);
            const r = ratio(st.color, st.backgroundColor);
            if (r < 4.5) out.push({ cls: chip.className, fg: st.color,
                                    bg: st.backgroundColor, ratio: Math.round(r * 100) / 100 });
          });
          document.head.removeChild(kill);
          return out;
        }, { contrast: CONTRAST });

        expect(bad, `every count clears 4.5:1 on its own chip in ${theme}`).toEqual([]);

        // Including on your own column, which is the case that broke.
        const onMine = await page.evaluate(() =>
          document.querySelectorAll(".board .hd.me .hd-pos").length);
        expect(onMine, "your own column has a strip too").toBe(4);
        await context.close();
      }
    });

  test("the number in the corner is the pick that cell really is",
    async ({ context }) => {
      const page = await openApp(context);
      await draftInto(page, 26);

      const r = await page.evaluate(() => {
        const cells = [...document.querySelectorAll(".board .cell")];
        const seen = [], mismatched = [];
        cells.forEach((c) => {
          const ovr = c.querySelector(".cell-ovr");
          if (!ovr) return;
          const n = Number(ovr.textContent);
          seen.push(n);
          /* The property, not the arithmetic: a pick code has to be derivable
             from the overall number and the league size alone, with no
             reference to the snake at all. Testing overallOf() against a copy
             of overallOf() would prove nothing — this is the same check that
             catches a seat number printed as a pick number. */
          const code = c.querySelector(".cell-pick");
          if (code && DraftEngine.pickCode(n, league.teams) !== code.textContent.trim()) {
            mismatched.push({ n, printed: code.textContent.trim() });
          }
        });
        return {
          mismatched, seen,
          drafted: state.picks.map((p) => p.overall),
          total: league.teams * league.rounds,
          // No corner number on a cell somebody already drafted.
          onDrafted: document.querySelectorAll(".board .cell:not(.empty) .cell-ovr").length
        };
      });

      expect(r.mismatched, "every corner number agrees with its own pick code").toEqual([]);
      expect(r.onDrafted, "a drafted cell does not carry one").toBe(0);

      /* Every pick in the draft accounted for exactly once, between the cells
         still to come and the picks already made. Uniqueness alone would not
         catch a mirrored assignment, but combined with the pick-code check
         above it pins both the set and the placement. */
      const all = [...r.seen, ...r.drafted].sort((a, b) => a - b);
      expect(all.length, "no pick counted twice").toBe(r.total);
      expect(all).toEqual(Array.from({ length: r.total }, (_, i) => i + 1));
    });
});
