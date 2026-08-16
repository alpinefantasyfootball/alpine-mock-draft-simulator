/* The club's colour on a player sheet.

   The rule this is guarding is narrow and easy to break by accident: the
   accent is the real brand colour, and it is allowed to be the real brand
   colour *only* because nothing is ever written on top of it. Seven of the
   thirty-two cannot hold white type at all — Pittsburgh's gold measures
   1.76:1 — so the moment somebody puts a label on the band or moves the ring
   under the name, a third of the league becomes unreadable and no existing
   check would notice. Contrast sweeps walk text against its background; they
   have nothing to say about a decorative mark that has quietly acquired a
   caption.

   So these assert placement rather than colour: the mark exists for every
   club, and no text overlaps it. */

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

async function start(page) {
  await page.click("#startBtn");
  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
}

test.describe("every club is marked, and nothing is written on the mark", () => {
  test("all 32 clubs resolve to a colour", async ({ context }) => {
    const page = await openApp(context);
    await start(page);

    const r = await page.evaluate(() => {
      const teams = [...new Set(board.map((p) => p.team))].sort();
      const missing = [], unresolved = [], thinBand = [];
      for (const t of teams) {
        openSheet(board.find((x) => x.team === t));
        const head = document.querySelector(".sheet-head");
        if (!teamAccent(board.find((x) => x.team === t))) missing.push(t);
        if (!getComputedStyle(head).getPropertyValue("--team").trim()) unresolved.push(t);
        if (getComputedStyle(head, "::after").height !== "3px") thinBand.push(t);
      }
      return { count: teams.length, missing, unresolved, thinBand };
    });

    expect(r.count, "the board covers the league").toBe(32);
    expect(r.missing, "clubs with no mark defined").toEqual([]);
    expect(r.unresolved, "clubs where --team did not reach the stylesheet").toEqual([]);
    expect(r.thinBand, "clubs whose band did not draw").toEqual([]);
  });

  test("no text sits on the band or the ring", async ({ context }) => {
    const page = await openApp(context);
    await start(page);

    /* Pittsburgh on purpose: gold is the worst case in the league for white
       text, so if any label ever migrates onto the mark this is where it
       becomes unreadable first. */
    const r = await page.evaluate(() => {
      openSheet(board.find((p) => p.team === "PIT"));
      const head = document.querySelector(".sheet-head");
      const ring = head.querySelector(".avatar").getBoundingClientRect();
      const band = { top: head.getBoundingClientRect().bottom - 3,
                     bottom: head.getBoundingClientRect().bottom };

      const onRing = [], onBand = [];
      head.querySelectorAll("h3, .sub, .facts, .rankcell, .jukenote, .rankcell span")
        .forEach((el) => {
          if (!el.textContent.trim()) return;
          const b = el.getBoundingClientRect();
          const hitsRing = !(b.right < ring.left - 3 || b.left > ring.right + 3 ||
                             b.bottom < ring.top - 3 || b.top > ring.bottom + 3);
          const hitsBand = b.bottom > band.top && b.top < band.bottom;
          if (hitsRing) onRing.push(el.className || el.tagName);
          if (hitsBand) onBand.push(el.className || el.tagName);
        });
      const av = head.querySelector(".avatar");
      return { onRing, onBand,
               outer: [Math.round(ring.width), Math.round(ring.height)],
               inner: [av.clientWidth, av.clientHeight] };
    });

    expect(r.onRing, "text overlapping the team ring").toEqual([]);
    expect(r.onBand, "text overlapping the team band").toEqual([]);

    /* The ring is a box-shadow, and the reason is measurable. Everything here
       is box-sizing: border-box, so drawing it as a `border` instead leaves
       the outer circle at 62 and eats the three pixels out of the *inside* —
       clientWidth drops to 56 and the headshot is inset and shrunk. Asserting
       the outer rect would pass either way and prove nothing, which is what
       this test did on its first run. */
    expect(r.outer, "the ring must not grow the circle").toEqual([62, 62]);
    expect(r.inner, "nor eat into the photo").toEqual([62, 62]);
  });

  test("a club we have no mark for falls back, and does not keep the last one",
    async ({ context }) => {
      const page = await openApp(context);
      await start(page);

      /* The sheet is one element reused for every player, so the colour has to
         be actively cleared rather than merely not set. Opening Pittsburgh and
         then somebody with no club must not leave gold on the second sheet —
         that is the failure this is really guarding, and it is invisible if
         you only ever open one player. */
      const r = await page.evaluate(() => {
        const head = document.querySelector(".sheet-head");
        openSheet(board.find((x) => x.team === "PIT"));
        const gold = getComputedStyle(head).getPropertyValue("--team").trim();

        const p = board.find((x) => x.pos !== "DST");
        const real = p.team;
        p.team = "ZZZ";                       // a club the table has never heard of
        openSheet(p);
        const out = { gold, accent: teamAccent(p),
                      after: getComputedStyle(head).getPropertyValue("--team").trim(),
                      band: getComputedStyle(head, "::after").height };
        p.team = real;
        return out;
      });

      expect(r.gold, "Pittsburgh set a colour to begin with").toBe("#FFB612");
      expect(r.accent, "no mark for an unknown club").toBe("");
      expect(r.after, "the previous club's colour must not persist").not.toBe(r.gold);
      expect(r.after, "the fallback still resolves to a colour").not.toBe("");
      expect(r.band, "the band still draws").toBe("3px");
    });
});
