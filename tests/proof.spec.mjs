/* The claim-and-proof section on the landing page.

   It replaced three paragraphs of prose — three claims with nothing to check
   them against, which is the weakest thing a page can say about a product
   whose whole pitch is that its numbers are inspectable.

   Everything here guards one property: **the stages are the product running,
   not a picture of it.** A hardcoded table of plausible names would look
   identical tonight and be wrong the first morning the pipeline moved, and
   nothing on screen would say so. So the tests compare what is rendered
   against what the app itself computes, rather than against fixtures.

   The load-bearing one is the reordering test. The first build sorted the
   whole board by projected points, which is six quarterbacks — every one of
   them correct, and not one of them moved by a single point across the three
   scoring settings. A claim that says "change a rule and every number moves"
   over a list that holds still is worse than no claim, and it renders,
   contrasts and passes every other check in this suite.
*/

import { test, expect } from "@playwright/test";
import { SITE } from "./helpers.mjs";

async function openLanding(browser, opts = {}) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  await page.goto(`${SITE}/index.html`);
  await page.waitForFunction(() => document.querySelectorAll("#proofList .pf").length > 0);
  await page.evaluate(() => document.getElementById("proof").scrollIntoView({ block: "center" }));
  return page;
}

// The stage as text, which is what a reader actually gets.
const READ_ROWS = () => [...document.querySelectorAll("#proofStage .prow")].map((r) => ({
  name: r.querySelector(".prow-name").textContent.trim(),
  pos: r.querySelector(".pos-chip").textContent.trim(),
  num: r.querySelector(".prow-num").textContent.trim()
}));

test.describe("show your working", () => {
  test("every claim has a stage, and the list is the control", async ({ browser }) => {
    const page = await openLanding(browser);

    const r = await page.evaluate((readRows) => {
      const out = [];
      const read = eval(`(${readRows})`);
      for (let i = 0; i < PROOFS.length; i++) {
        document.querySelector(`#proofList .pf[data-proof="${i}"]`).click();
        out.push({
          claim: document.querySelector(`#proofList .pf[data-proof="${i}"] b`).textContent.trim(),
          current: document.querySelector('#proofList .pf[aria-current="true"]').dataset.proof,
          rows: read().length,
          label: document.querySelector("#proofStage .pstage-label").textContent.trim()
        });
      }
      return { out, claims: PROOFS.length };
    }, READ_ROWS.toString());

    expect(r.out.length).toBe(r.claims);
    r.out.forEach((c, i) => {
      expect(c.current, `claim ${i} is the one marked`).toBe(String(i));
      expect(c.rows, `claim ${i} drew a stage`).toBeGreaterThan(2);
    });
    // Three claims showing the same stage would pass everything above.
    expect(new Set(r.out.map((c) => c.label)).size, "each claim has its own stage").toBe(r.claims);
  });

  test("the reception rule really does reorder the list", async ({ browser }) => {
    const page = await openLanding(browser);

    const r = await page.evaluate((readRows) => {
      const read = eval(`(${readRows})`);
      const at = [];
      for (let i = 0; i < 3; i++) { proofScoring.at = i; paintProof(0); at.push(read()); }

      /* The population the first build got wrong. A player this rule cannot
         move has no business illustrating it, and "no projected receptions"
         is the honest test rather than a list of positions. */
      const unmovable = at[0].filter((row) => {
        const p = board.find((x) => shortName(x) === row.name);
        const s = p && statOf(p);
        return !s || !s.p || !(s.p[STAT_KEYS.rec] > 0);
      });
      return { at, unmovable, teams: league.teams };
    }, READ_ROWS.toString());

    expect(r.unmovable, "nobody on the list is untouched by the rule").toEqual([]);

    const names = r.at.map((rows) => rows.map((x) => x.name).join(" > "));
    expect(names[0], "no receptions is not the same board as half a point")
      .not.toBe(names[1]);
    expect(names[0], "nor the same as a full point").not.toBe(names[2]);

    // Every number moves, which is the sentence on the left.
    const nums = r.at.map((rows) => rows.map((x) => x.num).join(","));
    expect(new Set(nums).size, "three settings, three sets of numbers").toBe(3);

    /* And the direction is the one anybody who has played knows: pass
       catchers climb as a catch gets more valuable. Without this the test
       passes on a list that merely shuffles. */
    const wrAt = (i) => r.at[i].filter((x) => x.pos === "WR" || x.pos === "TE").length;
    expect(wrAt(2), "more pass catchers at a full point than at none")
      .toBeGreaterThan(wrAt(0));
  });

  test("the numbers are the app's own, not a table somebody typed",
    async ({ browser }) => {
      const page = await openLanding(browser);

      const wrong = await page.evaluate((readRows) => {
        const read = eval(`(${readRows})`);
        const out = [];
        proofScoring.at = 1;                 // half PPR, the default board
        paintProof(0);
        read().forEach((row) => {
          const p = board.find((x) => shortName(x) === row.name);
          if (!p) return out.push({ why: "not a player on the board", row });
          const want = Math.round(pointsUnder(statOf(p).p, rulesForFormat("half")));
          if (String(want) !== row.num) out.push({ why: "number disagrees", row, want });
          if (p.pos !== row.pos) out.push({ why: "position disagrees", row, was: p.pos });
        });
        return out;
      }, READ_ROWS.toString());

      expect(wrong, "every row is a real player scored by the real function").toEqual([]);
    });

  test("the Juke score stage spans positions, because that is what the score is for",
    async ({ browser }) => {
      const page = await openLanding(browser);

      const r = await page.evaluate((readRows) => {
        const read = eval(`(${readRows})`);
        paintProof(1);
        const rows = read();
        return {
          positions: [...new Set(rows.map((x) => x.pos))],
          scores: rows.map((x) => Number(x.num)),
          sums: document.querySelectorAll("#proofStage .prow-sums").length
        };
      }, READ_ROWS.toString());

      /* Points above replacement is a *cross-position* measure — it exists to
         say an elite tight end beats the twenty-fifth receiver. The first
         build listed the top four by raw points, which is four quarterbacks,
         and a single-position list cannot make that argument at all. */
      expect(r.positions.length, "more than one position on the list").toBeGreaterThan(2);
      expect(Math.max(...r.scores), "the best on the board is the 100").toBe(100);
      // The subtraction is printed rather than asserted; that is the claim.
      expect(r.sums, "every row shows its working").toBe(r.scores.length);
      // Whole numbers. It rendered 48.19277108433736 once.
      r.scores.forEach((s) => expect(Number.isInteger(s), `${s} is a whole number`).toBe(true));
    });

  test("a stage with nothing to say is skipped, not drawn empty", async ({ browser }) => {
    const page = await openLanding(browser);

    /* buildProjections() runs at startup, but a board that came back short
       must not leave a heading over an empty frame. Same contract as the
       score strip: it fails by disappearing. */
    const r = await page.evaluate(() => {
      const real = PROOFS[0].build;
      PROOFS[0].build = () => "";
      paintProof(0);
      const after = {
        landedOn: document.querySelector('#proofList .pf[aria-current="true"]').dataset.proof,
        rows: document.querySelectorAll("#proofStage .prow").length
      };
      PROOFS[0].build = real;
      return after;
    });

    expect(r.landedOn, "it moved on to the next claim").not.toBe("0");
    expect(r.rows, "and drew a real stage there").toBeGreaterThan(2);
  });

  test("reduced motion draws the first claim and stays on it", async ({ browser }) => {
    const page = await openLanding(browser, { reducedMotion: "reduce" });

    const first = await page.evaluate(() =>
      document.querySelector('#proofList .pf[aria-current="true"]').dataset.proof);
    expect(first).toBe("0");

    // Long enough that a cycling section would have moved on twice over.
    await page.waitForTimeout(9000);
    const later = await page.evaluate(() =>
      document.querySelector('#proofList .pf[aria-current="true"]').dataset.proof);
    expect(later, "it did not advance").toBe("0");
  });
});
