/* The draft board card, as the React board draws it.

   A cell used to be a surname and a position. It is five things — who, what
   and where, which way the order is travelling, which pick it was, and a face
   — which is four more chances to be wrong on a grid that draws 140 of them
   at once.

   This file used to drive the vanilla board through #/draft-legacy. It drives
   the real one now. Two assertions changed shape with the move and neither is
   a weakening: the arrow is one glyph rotated rather than three characters, so
   direction is read off the transform; and a face is desktop-only, so the
   viewport is stated rather than assumed.

   The load-bearing test is still the contrast one, and it is worth saying why
   it exists rather than being obvious. On the legacy board the sub-line
   carried `opacity: .85` for years, measuring 3.74 to 4.02 against the six
   position solids — every line, on every card, under the bar. It survived
   every contrast sweep this project ran, because a sweep reading `color` sees
   the colour and not the element's opacity. That is a third way to lie about
   contrast, after alpha and gradients, and it is the one this file watches.

   The React cells are translucent rather than solid, which the check has to
   handle too: a cell's own background is composited over the board's ground
   before anything is measured, or the numbers are fiction.
*/

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

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

/* Through the bridge rather than through the setup screen's DOM. The legacy
   version had to open three <details>, write a <select> and click #startBtn;
   startDraft() is the same sequence with the DOM read removed, which is what
   the React settings screen calls too. */
async function draftInto(page, picks, teams = 10) {
  await page.evaluate(({ n, t }) => {
    if (t !== 10) window.JukeEngine.setLeague({ teams: t });
    window.JukeEngine.startDraft({ mySlot: 3, clockLength: 90 });
    for (let i = 0; i < n; i++) { const c = onTheClock(); if (c) makePick(cpuChoice(c.slot, c.round)); }
    render();
    location.hash = "#/draft-room";
  }, { n: picks, t: teams });

  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
  // The grid is React's, so wait for it rather than for the engine.
  await page.waitForFunction(() => {
    const root = document.getElementById("draftroom-root");
    return root && [...root.querySelectorAll("div")].some(
      (d) => getComputedStyle(d).display === "grid" && d.style.getPropertyValue("--cols"));
  }, null, { timeout: 20000 });
}

/* Every filled card on the board.

   Taken from the names outward, not by filtering divs that contain one:
   written that way first and every card counted three or four times, because
   a cell wrapper contains the name too, and so does its parent. 30 picks
   reported 138 cards. Walking up from each name to the nearest rounded box
   lands on the card itself, once. */
const FILLED = `(() => {
  const root = document.getElementById("draftroom-root");
  const grid = [...root.querySelectorAll("div")].find(
    (d) => getComputedStyle(d).display === "grid" && d.style.getPropertyValue("--cols"));
  return [...grid.querySelectorAll("p.truncate")]
    .map((n) => n.closest('[class*="rounded-md"]'))
    .filter(Boolean);
})()`;

test.describe("the draft board card", () => {
  test("every line clears 4.5:1 on its own cell, opacity composited",
    async ({ context }) => {
      const page = await openApp(context, "#/draft-room");
      await stubFaces(page);
      await draftInto(page, 60);

      const r = await page.evaluate((filledSrc) => {
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
        const parse = (s) => (s.match(/[\d.]+/g) || ["0", "0", "0"]).map(Number);
        const over = (c, under) => {
          const a = c.length > 3 ? c[3] : 1;
          return [0, 1, 2].map((i) => c[i] * a + under[i] * (1 - a));
        };

        // The board's own ground, which every translucent cell sits on.
        const board = parse(getComputedStyle(
          document.querySelector('#draftroom-root [class*="bg-\\\\[\\\\#0B0E14\\\\]"]') || document.body
        ).backgroundColor).slice(0, 3);

        const fails = [];
        let checked = 0, worst = 99;
        eval(filledSrc).forEach((card) => {
          // A cell's background is rgba over the board, so composite first.
          const bg = over(parse(getComputedStyle(card).backgroundColor), board);
          card.querySelectorAll("span, p").forEach((el) => {
            if (!el.textContent.trim()) return;
            const cs = getComputedStyle(el);
            let fg = over(parse(cs.color), bg);
            const op = parseFloat(cs.opacity);
            // The whole point: fold the element's own opacity into the colour
            // before measuring, or this assertion cannot see the bug.
            if (op < 1) fg = fg.map((v, i) => v * op + bg[i] * (1 - op));
            const a = lum(fg), b = lum(bg);
            const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            checked++;
            if (cr < worst) worst = cr;
            if (cr < 4.5) fails.push({ text: el.textContent.trim().slice(0, 10), cr: +cr.toFixed(2) });
          });
        });
        return { checked, worst: +worst.toFixed(2), fails: fails.slice(0, 6), total: fails.length };
      }, FILLED);

      expect(r.checked, "there were cards to measure").toBeGreaterThan(100);
      expect(r.total ? r.fails : [], "every line on every card clears 4.5:1").toEqual([]);
      expect(r.worst).toBeGreaterThanOrEqual(4.5);
    });

  test("the name is an initial and a surname, and a defense keeps its club",
    async ({ context }) => {
      const page = await openApp(context, "#/draft-room");
      await stubFaces(page);
      await draftInto(page, 20);

      const r = await page.evaluate(() => {
        const wr = board.find((p) => p.pos === "WR" && p.name.split(" ").length >= 2);
        const dst = board.find((p) => p.pos === "DST");
        const suffix = board.find((p) => /\b(Jr\.|Sr\.|II|III|IV)$/.test(p.name));
        return {
          wr: { name: wr.name, short: window.JukeEngine.shortName(wr) },
          dst: dst && { name: dst.name, short: window.JukeEngine.shortName(dst) },
          suffix: suffix && { name: suffix.name, short: window.JukeEngine.shortName(suffix) }
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

      // And the board is drawing that short form, not the full name.
      const drawn = await page.evaluate((src) =>
        eval(src).map((c) => c.querySelector("p.truncate").textContent.trim()).slice(0, 12), FILLED);
      expect(drawn.every((n) => n.length > 0), "every card carries a name").toBe(true);
      expect(drawn.some((n) => /^[A-Z]\. /.test(n)), "and it is the initialled form").toBe(true);
    });

  test("the arrow turns down on the last pick of every round", async ({ context }) => {
    const page = await openApp(context, "#/draft-room");
    await stubFaces(page);
    await draftInto(page, 40);

    /* The turn is the one thing the pick numbers do not tell you on sight, and
       it is why the ends of the room pick twice in a row. Down on the last
       pick of a round; along the way its round runs otherwise.

       Read off the transform rather than the character. The board draws one
       glyph rotated three ways, because a down arrow and a right arrow are
       different characters and a face draws the vertical one far heavier —
       measured at 2.5x the ink. So "which way does this point" is a matrix,
       not a string. */
    const r = await page.evaluate(() => {
      const root = document.getElementById("draftroom-root");
      const arrows = [...root.querySelectorAll('span[aria-hidden="true"]')]
        .filter((s) => s.textContent.trim().length === 1);
      const dirOf = (a) => {
        const t = getComputedStyle(a).transform;
        return /matrix\(0, 1, -1, 0/.test(t) ? "down"
          : /matrix\(-1, 0, 0, -1/.test(t) ? "left" : "right";
      };
      const counts = { down: 0, left: 0, right: 0 };
      arrows.forEach((a) => counts[dirOf(a)]++);
      return { total: arrows.length, counts, rounds: league.rounds, teams: league.teams,
               glyphs: [...new Set(arrows.map((a) => a.textContent.trim()))] };
    });

    expect(r.total, "an arrow on every cell, drafted or not").toBe(r.rounds * r.teams);
    // Exactly one turn per round, and it is the last pick of that round.
    expect(r.counts.down, "one down arrow per round").toBe(r.rounds);
    expect(r.glyphs, "one glyph, rotated — never three characters").toHaveLength(1);
    expect(r.counts.left + r.counts.right, "the rest run along their round")
      .toBe(r.rounds * r.teams - r.rounds);
  });

  test("the pick on the card is the pick the app computed", async ({ context }) => {
    const page = await openApp(context, "#/draft-room");
    await stubFaces(page);
    await draftInto(page, 40);

    /* The property, not the arithmetic. A pick code has to be derivable from
       the overall number and the league size alone, with no reference to the
       snake — checking it against a second copy of the same mirror proves
       nothing, and the seat-versus-pick-number bug is exactly what this
       catches: reading the seat hands out every code in a round exactly once,
       so a uniqueness test passes a board that is mirrored. */
    const r = await page.evaluate(() => {
      const root = document.getElementById("draftroom-root");
      const grid = [...root.querySelectorAll("div")].find(
        (d) => getComputedStyle(d).display === "grid" && d.style.getPropertyValue("--cols"));
      const drawn = [...grid.querySelectorAll("span.font-normal.opacity-60")]
        .map((s) => s.textContent.trim());
      const expected = JukeEngine.picks().map(
        (p) => DraftEngine.pickCode(p.overall, league.teams));
      return { drawn, expected, missing: expected.filter((c) => !drawn.includes(c)) };
    });

    expect(r.drawn.length, "a code on every filled card").toBe(r.expected.length);
    expect(r.missing, "and each is the code its own overall implies").toEqual([]);
  });

  test("a face is drawn per card, and a failed one leaves no hole", async ({ browser }) => {
    /* Desktop only, and stated rather than assumed: a phone column is 112px
       and every pixel of it is spoken for, so the board renders no images at
       all below lg. Asserting faces at a phone width would be asserting a
       feature that is deliberately absent. */
    const goodCtx = await browser.newContext();
    const good = await openApp(goodCtx, "#/draft-room");
    await good.setViewportSize({ width: 1440, height: 900 });
    await stubFaces(good);
    await draftInto(good, 30);

    const drawn = await good.evaluate((src) => {
      const cells = eval(src);
      return {
        cards: cells.length,
        // Same population as the broken half below: the cards a reader can
        // actually see. A lazy image off the fold has not loaded and is not
        // what either half is about.
        faces: cells.filter((c) => {
          const i = c.querySelector("img");
          if (!i) return false;
          const r = i.getBoundingClientRect();
          return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
        }).length,
        cardsInView: cells.filter((c) => {
          const r = c.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight;
        }).length,
        // the face is pushed to the right edge of the card rather than spaced
        rightmost: cells.every((c) => {
          const f = c.querySelector("img");
          if (!f) return true;
          return c.getBoundingClientRect().right - f.getBoundingClientRect().right < 8;
        })
      };
    }, FILLED);
    expect(drawn.cards, "there were cards").toBeGreaterThan(20);
    expect(drawn.faces, "a face on every card in view").toBe(drawn.cardsInView);
    expect(drawn.rightmost, "and pinned to the right edge").toBe(true);
    // Closed before the broken half opens. Two live pages both running a CPU
    // timer and re-rendering is a slower machine for the one under test, and
    // this half has nothing left to say.
    await goodCtx.close();

    /* Now the same board with every image failing. onError removes the element
       rather than leaving a broken-image box, and the card closes up because
       the face was a flex sibling rather than an absolute overlay. */
    /* Its own context, which is the whole reason this half is reliable. Both
       pages shared one at first, so the successful images from the good page
       were already in the HTTP cache — the bad page served them straight out
       of it, never hit the abort route, and one face survived about one run
       in six. That reads as the component failing to drop a broken image
       when it is actually the image not being broken. */
    const badCtx = await browser.newContext();
    const bad = await openApp(badCtx, "#/draft-room");
    await bad.setViewportSize({ width: 1440, height: 900 });
    await stubFaces(bad, { fail: true });
    await draftInto(bad, 30);
    /* In view, not in the document.

       The faces carry loading="lazy", so an image below the fold is never
       requested — and one that is never requested never errors, so there is
       nothing to drop and its element stays. Asserting that *no* img survives
       is asserting that lazy loading does not work: it passed only when the
       board happened to be short enough that every card was on screen, and
       failed about one run in five otherwise. Two earlier explanations (the
       wait, then the HTTP cache) were wrong for the same reason — they were
       about timing, and this is about which requests were ever made.

       What the test is actually for is that a broken image leaves no hole
       where somebody can see it. So: nothing visible. */
    const visibleImgs = (page) => page.evaluate((src) =>
      eval(src)
        .map((c) => c.querySelector("img"))
        .filter(Boolean)
        .filter((i) => {
          const r = i.getBoundingClientRect();
          return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
        }).length, FILLED);

    await expect.poll(() => visibleImgs(bad), { timeout: 20000 }).toBe(0);

    /* Everything else read in one go, and the face count *not* re-read here.

       Polling until no visible face survives and then reading the same fact
       again in a second evaluate is two reads of a moving board: the grid
       re-renders and scrolls to the live pick, so a lazy image can come into
       view between the two and be counted before it has had a chance to
       fail. That is the poll's answer being overwritten by a worse one, and
       it cost about one run in seventy-five. The poll above is the
       assertion; this only collects what does not move. */
    const gone = await bad.evaluate((src) => {
      const cells = eval(src);
      return {
        cards: cells.length,
        // the card still says everything it is required to say
        firstPick: cells[0].querySelector("span.font-normal.opacity-60").textContent.trim()
      };
    }, FILLED);
    expect(gone.cards, "the cards are all still there").toBeGreaterThan(20);
    expect(gone.firstPick).toMatch(/^\d+\.\d\d$/);

    await badCtx.close();
  });

  test("a filled row is the same height as an empty one", async ({ context }) => {
    const page = await openApp(context, "#/draft-room");
    await stubFaces(page);
    await draftInto(page, 15);

    /* Setting the card's height only on filled cells leaves the board with two
       row heights, and a row that grows the moment its first pick lands —
       which shoves everything below it down, once per round, on a pane that is
       simultaneously trying to keep the live pick centred. The row owns the
       height, not the cell: grid-auto-rows states it once. */
    const r = await page.evaluate(() => {
      const root = document.getElementById("draftroom-root");
      const grid = [...root.querySelectorAll("div")].find(
        (d) => getComputedStyle(d).display === "grid" && d.style.getPropertyValue("--cols"));
      const cells = [...grid.children].filter((c) => c.className.includes("border-b"));
      const h = (el) => Math.round(el.getBoundingClientRect().height);
      const filled = cells.filter((c) => c.querySelector("p.truncate")).map(h);
      const empty = cells.filter((c) => !c.querySelector("p.truncate") && h(c) > 10).map(h);
      return { filled: [...new Set(filled)], empty: [...new Set(empty)] };
    });

    expect(r.filled.length, "every filled cell is one height").toBe(1);
    expect(r.empty, "and an empty one matches it").toContain(r.filled[0]);
  });
});
