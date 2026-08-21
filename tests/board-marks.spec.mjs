/* What the draft board says beyond the picks themselves: whose column it is,
   where the draft is, what every team holds, and how far away a pick is.

   Gold is identity, and it is the third meaning after orange and blue. Both
   marks were blue before — the same blue as the focus ring, the selected tab,
   --link, .draft-btn and the header when the clock is yours. A colour doing
   five jobs is not a signal, which is the design half.

   The bug half is smaller and worse. `mine` only ever went on a *filled*
   cell, so the board marked where you had been and never where you were
   going — and where you are going next is the one question a snake board
   exists to answer. Nothing failed, nothing logged, and every check this
   project runs passed: the cells that were marked were marked correctly.

   The contrast test is the one that changed most in the move off the legacy
   board, and the change is worth stating rather than glossing.

   On that board a ring is a *pair* — 2px of gold with 1px of keyline inside
   it — because no single colour survives what it lands on there: six position
   solids that are fixed across themes, and an empty cell that is near-black
   in dark and near-white in light, where gold falls to 1.26. This board has
   no light theme. Its ground is hardcoded #0B0E14 and its position cells are
   translucent over it, so every surface is dark and one colour is enough;
   measured, gold runs 11.25:1 at worst against a 3:1 bar while the keyline
   ran 1.01 to 1.12 and was doing nothing.

   So the assertion here is stronger than the legacy one — every surface, not
   one half of a pair — and it is guarded by the precondition that makes it
   legal. If this board ever gains a light theme the pair has to come back,
   and the second half of that test is what will say so.
*/

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

async function draftInto(page, picks) {
  await page.evaluate((n) => {
    window.JukeEngine.startDraft({ mySlot: 3, clockLength: 90 });
    for (let i = 0; i < n; i++) { const c = onTheClock(); if (c) makePick(cpuChoice(c.slot, c.round)); }
    render();
    location.hash = "#/draft-room";
  }, picks);
  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
  await page.waitForFunction(() => {
    const root = document.getElementById("draftroom-root");
    return root && [...root.querySelectorAll("div")].some(
      (d) => getComputedStyle(d).display === "grid" && d.style.getPropertyValue("--cols"));
  }, null, { timeout: 20000 });
}

/* Relative luminance and WCAG contrast, on the rgb()/rgba() strings the
   browser reports. Composites alpha over a stated ground, because every cell
   colour on this board is translucent. */
const CONTRAST = `
  function parse(s) { return (s.match(/[\\d.]+/g) || ["0","0","0"]).map(Number); }
  function over(c, under) {
    const a = c.length > 3 ? c[3] : 1;
    return [0,1,2].map(function (i) { return c[i] * a + under[i] * (1 - a); });
  }
  function lum(c) {
    const v = c.slice(0,3).map(function (n) {
      n /= 255; return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    });
    return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
  }
  function ratio(a, b) {
    const A = lum(a), B = lum(b);
    return (Math.max(A,B) + 0.05) / (Math.min(A,B) + 0.05);
  }
  function grid() {
    const root = document.getElementById("draftroom-root");
    return [...root.querySelectorAll("div")].find(function (d) {
      return getComputedStyle(d).display === "grid" && d.style.getPropertyValue("--cols");
    });
  }
  /* The cells, which are grandchildren rather than children: each round is a
     display:contents wrapper, so grid().children is the header row plus
     fourteen wrappers - 25 elements, none of them a cell. Written that way
     first and every assertion in this file came back 0, which reads as the
     feature being missing rather than the selector being wrong. */
  function cells() {
    return [...grid().querySelectorAll('[class*="border-slate-800/70"]')];
  }
`;

test.describe("what the board marks", () => {
  test("your column is marked all the way down, drafted or not", async ({ context }) => {
    const page = await openApp(context, "#/draft-room");
    await draftInto(page, 40);

    /* The whole feature. Marking only the filled cells says where you have
       been; the empty ones below are where you are going, which is the thing
       a snake board is read for. */
    const r = await page.evaluate((c) => {
      eval(c);
      const all = cells();
      const ringed = all.filter((e) => /255, 209, 102/.test(getComputedStyle(e).boxShadow));
      const filled = ringed.filter((e) => e.querySelector("p.truncate")).length;
      return { ringed: ringed.length, filled, empty: ringed.length - filled,
               rounds: league.rounds, mySlot: JukeEngine.mySlot(),
               allInOneColumn: new Set(ringed.map((e) => Math.round(e.getBoundingClientRect().left))).size };
    }, CONTRAST);

    expect(r.ringed, "one marked cell per round").toBe(r.rounds);
    expect(r.filled, "some of them drafted").toBeGreaterThan(0);
    expect(r.empty, "and some of them still to come").toBeGreaterThan(0);
    expect(r.allInOneColumn, "all in one column").toBe(1);
  });

  test("the live ring is on the pick that is on the clock, and moves with it",
    async ({ context }) => {
      const page = await openApp(context, "#/draft-room");
      await draftInto(page, 12);

      const read = () => page.evaluate((c) => {
        eval(c);
        const live = cells().map((e, i) => ({ e, i }))
          .filter(({ e }) => e.querySelector('[class*="border-teal-400"]'));
        return { count: live.length, index: live.length ? live[0].i : -1,
                 says: live.length ? live[0].e.textContent.replace(/\s+/g, " ").trim() : "" };
      }, CONTRAST);

      const before = await read();
      expect(before.count, "exactly one cell is on the clock").toBe(1);
      expect(before.says.toLowerCase()).toContain("on the clock");

      // One more pick, and the ring has to have moved with it.
      await page.evaluate(() => {
        const c = onTheClock(); makePick(cpuChoice(c.slot, c.round)); render();
      });
      await page.waitForTimeout(400);

      const after = await read();
      expect(after.count, "still exactly one").toBe(1);
      expect(after.index, "and it moved").not.toBe(before.index);
    });

  test("the gold ring clears its bar on every surface, and the board stays dark",
    async ({ browser }) => {
      const context = await browser.newContext();
      const page = await openApp(context, "#/draft-room");
      await draftInto(page, 60);

      const r = await page.evaluate((c) => {
        eval(c);
        /* Transitions off before any colour is read: a pane that is not
           compositing produces no frames, so a transition never advances and
           getComputedStyle reports the starting value indefinitely. */
        const kill = document.createElement("style");
        kill.textContent = "* { transition: none !important }";
        document.head.appendChild(kill);

        const boardBg = parse(getComputedStyle(grid().parentElement).backgroundColor).slice(0, 3);
        const all = cells();
        const ringed = all.filter((e) => /255, 209, 102/.test(getComputedStyle(e).boxShadow));

        const gold = [255, 209, 102];
        const worst = { ratio: 99, on: null };
        const surfaces = new Set();
        ringed.forEach((cell) => {
          // What the ring is actually drawn against: the card inside the
          // cell if there is one, otherwise the board itself.
          const card = cell.querySelector('[class*="rounded-md"]');
          const raw = card ? getComputedStyle(card).backgroundColor : "rgba(0,0,0,0)";
          const under = over(parse(raw), boardBg);
          surfaces.add(raw);
          const cr = ratio(gold, under);
          if (cr < worst.ratio) { worst.ratio = cr; worst.on = raw; }
        });
        return { checked: ringed.length, surfaces: surfaces.size,
                 worst: Math.round(worst.ratio * 100) / 100, on: worst.on };
      }, CONTRAST);

      expect(r.checked, "there were rings to measure").toBeGreaterThan(5);
      expect(r.surfaces, "and more than one kind of surface under them").toBeGreaterThan(1);
      // Marks, not type: 1.4.11's 3:1 is the right bar here, and the only
      // place in this project where the lower one applies.
      expect(r.worst, `gold on ${r.on}`).toBeGreaterThanOrEqual(3);

      /* The precondition the single ring rests on. A light theme would put a
         near-white empty cell under it, where gold measures 1.26 and the
         legacy board's keyline earns its place — so if this ever stops being
         true, the pair has to come back and this is the line that says so. */
      const dark = await page.evaluate((c) => {
        eval(c);
        document.documentElement.setAttribute("data-theme", "light");
        const bg = parse(getComputedStyle(grid().parentElement).backgroundColor);
        return lum(bg);
      }, CONTRAST);
      expect(dark, "the board's ground is dark whatever the theme says").toBeLessThan(0.05);
    });

  test("the roster strip counts what each team holds, and skips the two the app schedules itself",
    async ({ context }) => {
      const page = await openApp(context, "#/draft-room");
      await draftInto(page, 60);

      /* Which positions are counted is derived — POSITIONS minus FORCED_LATE
         — rather than listed. Counting a kicker would be eight columns of
         "0" until the closing rounds and eight of "1" after them, which is
         not a fact about how anybody drafted. */
      const r = await page.evaluate((c) => {
        eval(c);
        const chips = [...grid().querySelectorAll("span[title]")]
          .filter((s) => /^\d+ [A-Z]{1,3}$/.test(s.getAttribute("title")));
        const positions = [...new Set(chips.map((s) => s.getAttribute("title").split(" ")[1]))];
        const teams = league.teams;
        const perTeam = JukeEngine.rosterStrip(0).length;

        let mismatches = 0;
        for (let t = 0; t < teams; t++) {
          const want = JukeEngine.rosterStrip(t);
          const got = chips.slice(t * perTeam, (t + 1) * perTeam).map((s) => +s.textContent.trim());
          want.forEach((w, i) => { if (w.count !== got[i]) mismatches++; });
        }
        return { chips: chips.length, expected: teams * perTeam, positions, mismatches,
                 zeroDrawn: chips.some((s) => s.textContent.trim() === "0") };
      }, CONTRAST);

      expect(r.chips, "a chip per counted position per team").toBe(r.expected);
      expect(r.mismatches, "and every count is the engine's own").toBe(0);
      expect(r.positions.sort(), "the two the app schedules itself are not counted")
        .toEqual(["QB", "RB", "TE", "WR"]);
      // A gap where a chip should be is the fact somebody is reading this for.
      expect(r.zeroDrawn, "an empty position is drawn as empty, not dropped").toBe(true);
    });

  test("a count is white on its own solid, so the header behind it never matters",
    async ({ context }) => {
      const page = await openApp(context, "#/draft-room");
      await draftInto(page, 60);

      /* The whole reason these are chips rather than coloured text. White on
         a position solid is the contract those colours were darkened to meet,
         so whatever the header is doing behind them is not part of the sum —
         including on your own column, which is the one a manager looks at
         most and the one coloured text failed on. */
      const r = await page.evaluate((c) => {
        eval(c);
        const chips = [...grid().querySelectorAll("span[title]")]
          .filter((s) => /^\d+ [A-Z]{1,3}$/.test(s.getAttribute("title")))
          .filter((s) => s.textContent.trim() !== "0");
        const out = [];
        chips.forEach((s) => {
          const cs = getComputedStyle(s);
          out.push({ pos: s.getAttribute("title").split(" ")[1],
                     cr: Math.round(ratio(parse(cs.color), parse(cs.backgroundColor)) * 100) / 100 });
        });
        const worst = out.reduce((w, o) => (o.cr < w.cr ? o : w), { cr: 99 });
        return { checked: out.length, worst, opaque: chips.every((s) =>
          !/rgba\([^)]*,\s*0?\.\d+\)/.test(getComputedStyle(s).backgroundColor)) };
      }, CONTRAST);

      expect(r.checked, "there were filled chips").toBeGreaterThan(10);
      expect(r.worst.cr, `worst was ${r.worst.pos}`).toBeGreaterThanOrEqual(4.5);
      // Translucent would put the header back into the sum, which is the
      // thing the chip exists to prevent.
      expect(r.opaque, "and the chip's ground is opaque").toBe(true);
    });

  test("the number in the corner is the pick that cell really is", async ({ context }) => {
    const page = await openApp(context, "#/draft-room");
    await draftInto(page, 20);

    /* The property, not the arithmetic. A corner number is right when
       pickCode(overall, teams) equals the code that cell would carry —
       checking overallOf() against a second copy of overallOf() proves
       nothing, and the seat-versus-pick-number bug is what that misses. */
    const r = await page.evaluate((c) => {
      eval(c);
      const teams = league.teams;
      const empties = cells().filter((e) => !e.querySelector("p.truncate"));
      const bad = [];
      let checked = 0;
      empties.forEach((cell) => {
        const n = cell.textContent.trim().match(/^\d+/);
        if (!n) return;
        const overall = +n[0];
        checked++;
        // Where the engine says that overall number sits, independently.
        const onClock = DraftEngine.onTheClock(league, overall - 1);
        if (!onClock) return;
        const expected = DraftEngine.overallOf(onClock.round, onClock.slot, teams);
        if (expected !== overall) bad.push({ overall, expected });
      });
      return { checked, bad: bad.slice(0, 5), total: bad.length };
    }, CONTRAST);

    expect(r.checked, "there were empty cells carrying a number").toBeGreaterThan(20);
    expect(r.total ? r.bad : [], "each corner number is its own cell's pick").toEqual([]);
  });
});
