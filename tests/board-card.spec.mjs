/* The draft board card.

   A cell used to be a surname and a position. It is now five things — who,
   what and where, which way the order is travelling, which pick it was, and a
   face — which is four more chances to be wrong on a grid that draws 140 of
   them at once.

   The load-bearing test here is the contrast one, and it is worth saying why
   it exists rather than being obvious. The sub-line carried `opacity: .85` for
   as long as the board has, measuring 3.74 to 4.02 against the six position
   solids: every one under the bar, on every card. It survived every contrast
   sweep this project has run, because a sweep reading `color` sees `#fff` and
   reports 4.62 — `opacity` is a property on the element rather than a channel
   in the colour, so it has to be composited deliberately or it is invisible to
   the check. That is a third way to lie about contrast, after alpha and
   gradients, and it is the one this file now watches.
*/

import { test, expect } from "@playwright/test";
import { openApp, LEGACY_VIEW } from "./helpers.mjs";

/* The headshots come from sleepercdn, so every test here stubs it. Not to
   avoid the network: to make the answer the same on a machine that can reach
   it and a machine that cannot, and to let the failure case be driven on
   purpose rather than waited for. */
async function stubFaces(page, { fail = false } = {}) {
  await page.route("https://sleepercdn.com/**", (route) =>
    fail ? route.abort() : route.fulfill({
      status: 200,
      contentType: "image/gif",
      // 1x1 transparent gif
      body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")
    }));
}

async function draftInto(page, picks, teams = 10) {
  await page.evaluate(({ n, t }) => {
    document.querySelectorAll("details.setupbox").forEach((d) => (d.open = true));
    if (t !== 10) {
      const el = document.getElementById("teamCount");
      el.value = String(t);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document.getElementById("startBtn").click();
    for (let i = 0; i < n; i++) { const c = onTheClock(); if (c) makePick(cpuChoice(c.slot, c.round)); }
    render();
  }, { n: picks, t: teams });
  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
}

test.describe("the draft board card", () => {
  test("every line clears 4.5:1 on its own solid, opacity composited",
    async ({ context }) => {
      const page = await openApp(context, LEGACY_VIEW);
      await stubFaces(page);
      await draftInto(page, 60);

      const r = await page.evaluate(() => {
        /* Transitions off before any colour is read. A pane that is not
           compositing produces no frames, so a transition never advances and
           getComputedStyle reports the value it started from — which does not
           look like an artifact, it looks like a bug with a plausible cause. */
        const kill = document.createElement("style");
        kill.textContent = "* { transition: none !important; animation: none !important }";
        document.head.appendChild(kill);

        const lum = (c) => {
          const [r, g, b] = c.map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const parse = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);

        const fails = [];
        let checked = 0, worst = 99;
        document.querySelectorAll(".board .cell:not(.empty)").forEach((cell) => {
          const bg = parse(getComputedStyle(cell).backgroundColor);
          cell.querySelectorAll("b, s, .cell-dir, .cell-pick").forEach((el) => {
            const cs = getComputedStyle(el);
            let fg = parse(cs.color);
            const op = parseFloat(cs.opacity);
            // The whole point: fold the element's own opacity into the colour
            // before measuring, or this assertion cannot see the bug.
            if (op < 1) fg = fg.map((v, i) => v * op + bg[i] * (1 - op));
            const a = lum(fg), b = lum(bg);
            const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            checked++;
            if (cr < worst) worst = cr;
            if (cr < 4.5) fails.push({ what: el.className || el.tagName,
                                       pos: cell.className.split(" ")[1], cr: +cr.toFixed(2) });
          });
        });
        return { checked, worst: +worst.toFixed(2), fails: fails.slice(0, 6), total: fails.length };
      });

      expect(r.checked, "there were cards to measure").toBeGreaterThan(100);
      expect(r.total ? r.fails : [], "every line on every card clears 4.5:1").toEqual([]);
      expect(r.worst).toBeGreaterThanOrEqual(4.5);
    });

  test("the name is an initial and a surname, and a defense keeps its club",
    async ({ context }) => {
      const page = await openApp(context, LEGACY_VIEW);
      await stubFaces(page);
      await draftInto(page, 20);

      const r = await page.evaluate(() => {
        const wr = board.find((p) => p.pos === "WR" && p.name.split(" ").length >= 2);
        const dst = board.find((p) => p.pos === "DST");
        const suffix = board.find((p) => /\b(Jr\.|Sr\.|II|III|IV)$/.test(p.name));
        return {
          wr: { name: wr.name, short: shortName(wr) },
          dst: dst && { name: dst.name, short: shortName(dst) },
          suffix: suffix && { name: suffix.name, short: shortName(suffix) }
        };
      });

      expect(r.wr.short).toBe(r.wr.name.split(" ")[0][0] + ". " + r.wr.name.split(" ").pop());

      /* "Los Angeles Chargers Defense" initialised is "L. Chargers", which is
         nobody: the first word of a club name is not a first name. Same rule as
         deciding a player's type from `player.pos` rather than from the shape
         of the data underneath. */
      expect(r.dst, "a defense is on the board").toBeTruthy();
      expect(r.dst.short, "a defense is not initialised").not.toMatch(/^[A-Z]\. /);

      // A suffix is dropped from the surname, not treated as one.
      if (r.suffix) expect(r.suffix.short).not.toMatch(/(Jr\.|Sr\.|II|III|IV)$/);
    });

  test("the arrow turns down on the last pick of every round", async ({ context }) => {
    const page = await openApp(context, LEGACY_VIEW);
    await stubFaces(page);
    await draftInto(page, 40);

    /* The turn is the one thing the pick numbers do not tell you on sight, and
       it is why the ends of the room pick twice in a row. Down on the last
       pick of a round; along the way its round runs otherwise.

       Every cell carrying an arrow, not just the drafted ones. The arrow was
       on filled cells alone, so the snake was legible over the half of the
       board that had already happened and not over the half still to play —
       which is backwards, because the turn matters while you are working out
       whether your wait is one pick or nineteen. The only cell without one is
       the cell on the clock, which is showing a countdown instead. */
    const r = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".board .cell")];
      const rows = [];
      cells.forEach((c) => {
        const dir = c.querySelector(".cell-dir");
        if (!dir) return;
        const code = c.querySelector(".cell-pick").textContent.trim();
        const [round, inRound] = code.split(".").map(Number);
        rows.push({ round, inRound, dir: dir.textContent.trim(),
                    drafted: !c.classList.contains("empty") });
      });
      return { rows, teams: league.teams };
    });

    expect(r.rows.length).toBeGreaterThan(30);
    // Or widening the selector proved nothing.
    expect(r.rows.some((x) => x.drafted), "drafted cells are covered").toBe(true);
    expect(r.rows.some((x) => !x.drafted), "and so are the picks still to come").toBe(true);
    const wrong = r.rows.filter((x) => {
      const want = x.inRound === r.teams ? "↓" : (x.round % 2 === 0 ? "←" : "→");
      return x.dir !== want;
    });
    expect(wrong, "every arrow matches its own pick number").toEqual([]);

    // And all three actually occur, or the assertion above is vacuous.
    const kinds = new Set(r.rows.map((x) => x.dir));
    expect([...kinds].sort()).toEqual(["←", "→", "↓"].sort());
  });

  test("the pick on the card is the pick the app computed", async ({ context }) => {
    const page = await openApp(context, LEGACY_VIEW);
    await stubFaces(page);
    await draftInto(page, 45);

    /* Rendered against computed. The card is a third renderer of this number,
       after the header and the ticker, and nothing would complain if it grew
       its own idea of what a pick is called. */
    const r = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".board .cell:not(.empty)")];
      const shown = cells.map((c) => c.querySelector(".cell-pick").textContent.trim());
      const want = state.picks
        .slice()
        .sort((a, b) => (a.round - b.round) || (a.slot - b.slot))
        .map((p) => pickCode(p.overall));
      return { shown, want };
    });
    expect(r.shown).toEqual(r.want);
  });

  test("a face is drawn per card, and a failed one leaves no hole",
    async ({ context }) => {
      const good = await openApp(context, LEGACY_VIEW);
      await stubFaces(good);
      await draftInto(good, 30);

      const drawn = await good.evaluate(() => ({
        cards: document.querySelectorAll(".board .cell:not(.empty)").length,
        faces: document.querySelectorAll(".board .cell-face").length,
        // the face is pushed to the right edge of the foot rather than spaced
        rightmost: [...document.querySelectorAll(".board .cell:not(.empty)")].every((c) => {
          const f = c.querySelector(".cell-face");
          if (!f) return true;
          const foot = c.querySelector(".cell-foot").getBoundingClientRect();
          return Math.abs(foot.right - f.getBoundingClientRect().right) < 2;
        })
      }));
      expect(drawn.faces, "a face on every card").toBe(drawn.cards);
      expect(drawn.rightmost, "and pinned to the right edge").toBe(true);

      /* Now the same board with every image failing. `data-drop-on-error`
         removes the element rather than leaving a broken-image box, and the
         foot closes up because the face was positioned by a margin rather
         than by a spacer. */
      const bad = await openApp(context, LEGACY_VIEW);
      await stubFaces(bad, { fail: true });
      await draftInto(bad, 30);
      await bad.waitForTimeout(1200);

      const gone = await bad.evaluate(() => ({
        cards: document.querySelectorAll(".board .cell:not(.empty)").length,
        faces: document.querySelectorAll(".board .cell-face").length,
        // the card still says everything it is required to say
        firstPick: document.querySelector(".board .cell:not(.empty) .cell-pick").textContent.trim()
      }));
      expect(gone.cards, "the cards are all still there").toBeGreaterThan(20);
      expect(gone.faces, "and every broken face removed itself").toBe(0);
      expect(gone.firstPick).toMatch(/^\d+\.\d\d$/);
    });

  test("a filled row is the same height as an empty one", async ({ context }) => {
    const page = await openApp(context, LEGACY_VIEW);
    await stubFaces(page);
    await draftInto(page, 15);

    /* Setting the card's height only on filled cells leaves the board with two
       row heights, and a row that grows the moment its first pick lands —
       which shoves everything below it down, once per round, on a pane that is
       simultaneously trying to keep the live pick centred. */
    const r = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".board .cell")];
      const filled = cells.filter((c) => !c.classList.contains("empty"));
      const empty = cells.filter((c) => c.classList.contains("empty"));
      const h = (el) => Math.round(el.getBoundingClientRect().height);
      return { filled: [...new Set(filled.map(h))], empty: [...new Set(empty.map(h))] };
    });

    expect(r.filled.length, "filled cells are one height").toBe(1);
    expect(r.empty, "and empty ones are the same height").toEqual(r.filled);
  });
});
