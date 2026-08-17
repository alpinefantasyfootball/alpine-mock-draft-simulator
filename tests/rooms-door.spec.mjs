/* The Rooms door on the landing page.

   This replaced a grid of six cards, five of them greyed out — which is the
   worst available framing of a roadmap, because it reads as five things that
   are missing rather than as one thing that is open.

   Two of the tests here exist because the bug they catch is invisible: the
   doorway collapsing to zero width while reporting a healthy max-width, and
   the door rendering flat while its transform is applied correctly. Neither
   throws, neither logs, and both look like "the animation didn't work".
*/

import { test, expect } from "@playwright/test";
import { SITE } from "./helpers.mjs";

/* Takes `browser`, not `context`.

   `context.newPage()` accepts no options at all, so `newPage({ viewport })` and
   `newPage({ reducedMotion })` are silently ignored — the page just inherits
   the default context. Both are context-level settings. Written the wrong way
   first, and the cost was a phone test that ran at desktop width and passed
   while proving nothing, and a reduced-motion test that measured a page with
   motion switched on. */
async function openLanding(browser, opts = {}) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  await page.goto(`${SITE}/index.html`);
  await page.waitForFunction(() => document.querySelectorAll("#homeRooms .rl").length > 0);
  await page.evaluate(() => document.getElementById("roomStage").scrollIntoView({ block: "center" }));
  return page;
}

test.describe("the rooms door", () => {
  test("the list is every room, grouped by phase, straight from ROOMS",
    async ({ browser }) => {
      const page = await openLanding(browser);

      /* The whole point of drawing this from ROOMS is that the placards cannot
         drift from the app. Asserted against the array itself rather than
         against a copy of the names. */
      const r = await page.evaluate(() => ({
        rows: [...document.querySelectorAll("#homeRooms .rl")].map((el) => ({
          name: el.querySelector(".rl-name").textContent,
          meta: el.querySelector(".rl-meta").textContent,
          live: el.classList.contains("live"),
          tag: el.tagName
        })),
        phases: [...document.querySelectorAll("#homeRooms .rl-phase")].map((el) => el.textContent),
        rooms: ROOMS.map((x) => ({ name: x.name, live: x.live, season: x.season })),
        seasons: SEASONS
      }));

      expect(r.rows.map((x) => x.name), "every room, in order").toEqual(r.rooms.map((x) => x.name));
      expect(r.phases, "one heading per phase").toEqual(r.seasons);

      r.rows.forEach((row, i) => {
        const room = r.rooms[i];
        expect(row.live, `${room.name} live flag`).toBe(room.live);
        // The open room is a link because it goes somewhere; the rest are
        // buttons because they turn the door.
        expect(row.tag).toBe(room.live ? "A" : "BUTTON");
        expect(row.meta.toLowerCase()).toBe(room.live ? "live now" : room.season.toLowerCase());
      });
    });

  test("the door opens onto the room's own description", async ({ browser }) => {
    const page = await openLanding(browser);
    await page.waitForTimeout(1500);

    const r = await page.evaluate(() => ({
      open: document.getElementById("roomStage").classList.contains("open"),
      placard: document.getElementById("roomPlacard").textContent,
      name: document.getElementById("roomName").textContent,
      blurb: document.getElementById("roomBlurb").textContent,
      status: document.getElementById("roomStatus").textContent,
      season: document.getElementById("roomSeason").textContent,
      blurbVisible: getComputedStyle(document.getElementById("roomBlurb")).opacity,
      first: ROOMS[0]
    }));

    expect(r.open, "the door swung").toBe(true);
    expect(r.placard, "the placard names the room").toBe(r.first.name);
    expect(r.name).toBe(r.first.name);
    expect(r.blurb, "and the room says what it is for").toBe(r.first.blurb);
    expect(r.season).toBe(r.first.season);
    expect(r.status).toMatch(/open now/i);
    expect(Number(r.blurbVisible), "the interior text is actually shown").toBe(1);
  });

  test("the door is a door: it turns in 3D rather than squashing",
    async ({ browser }) => {
      const page = await openLanding(browser);

      /* `overflow` on any ancestor between the doorway and the door flattens
         the 3D context, and `preserve-3d` cannot cross it. The transform still
         applies, so the panel still narrows — a width check alone passes
         against the bug.

         What separates them is height. Swung towards the reader under
         perspective, the near edge comes closer and the panel draws *taller*
         than it is at rest. Flattened, there is no perspective and the height
         does not move at all. */
      const shut = await page.evaluate(() => {
        const d = document.querySelector(".door").getBoundingClientRect();
        return { w: d.width, h: d.height };
      });

      await page.waitForTimeout(1500);

      const open = await page.evaluate(() => {
        const d = document.querySelector(".door").getBoundingClientRect();
        return { w: d.width, h: d.height };
      });

      expect(open.w, "the open door is narrower").toBeLessThan(shut.w * 0.7);
      expect(open.h, "and taller, because perspective brings it closer")
        .toBeGreaterThan(shut.h * 1.03);
    });

  test("the doorway survives phone width", async ({ browser }) => {
    const page = await openLanding(browser, { viewport: { width: 390, height: 900 } });

    /* `margin: 0 auto` on a grid item defeats the default stretch and makes it
       shrink-wrap its content — and every child of .doorway is absolutely
       positioned, so its intrinsic width is zero. The doorway collapsed to 0px
       at phone width while still computing a perfectly healthy 320px
       max-width, which is why this measures the box and not the style. */
    const r = await page.evaluate(() => ({
      doorway: Math.round(document.querySelector(".doorway").getBoundingClientRect().width),
      max: getComputedStyle(document.querySelector(".doorway-outer")).maxWidth,
      hOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }));

    expect(r.doorway, "the doorway has real width").toBeGreaterThan(200);
    expect(r.hOverflow, "and the page does not leak sideways").toBe(false);
  });

  test("a planned room turns the door; the open one goes in", async ({ browser }) => {
    const page = await openLanding(browser);
    await page.waitForTimeout(1400);

    // A planned room turns the door and does not navigate.
    await page.click('#homeRooms .rl[data-room="2"]');
    await page.waitForTimeout(900);
    const turned = await page.evaluate(() => ({
      placard: document.getElementById("roomPlacard").textContent,
      blurb: document.getElementById("roomBlurb").textContent,
      status: document.getElementById("roomStatus").textContent,
      current: document.querySelector('#homeRooms .rl[aria-current="true"]').dataset.room,
      hash: location.hash
    }));
    expect(turned.placard).toBe("The Waiver Room");
    expect(turned.blurb).toContain("FAAB");
    expect(turned.status, "and says plainly that it is not open").toMatch(/not open/i);
    expect(turned.current).toBe("2");
    expect(turned.hash, "clicking a planned room goes nowhere").not.toContain("draft");

    // The open one is a link and takes you into the room.
    await page.click("#homeRooms .rl.live");
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => location.hash)).toContain("/draft");
  });

  test("reduced motion lands open, on the room that exists, and stays there",
    async ({ browser }) => {
      const page = await openLanding(browser, { reducedMotion: "reduce" });
      await page.waitForTimeout(1200);

      const first = await page.evaluate(() => ({
        open: document.getElementById("roomStage").classList.contains("open"),
        placard: document.getElementById("roomPlacard").textContent
      }));
      expect(first.open, "shown open rather than frozen shut").toBe(true);
      expect(first.placard).toBe("The Draft Room");

      /* Long enough that a cycling door would have moved on twice. The reduced
         state is the finished state, not a slower version of the animation. */
      await page.waitForTimeout(8000);
      const later = await page.evaluate(() => document.getElementById("roomPlacard").textContent);
      expect(later, "and it did not turn").toBe("The Draft Room");
    });

  test("the door is drawn, not photographed", async ({ browser }) => {
    const page = await openLanding(browser);

    /* The landing page loads no image of any kind, which is a property worth
       keeping: a picture of a door is a file to rebuild every time the palette
       moves, and it is wrong the first time somebody forgets. */
    const imgs = await page.evaluate(() =>
      document.querySelectorAll("#roomStage img, #roomStage svg image").length);
    expect(imgs, "no image inside the stage").toBe(0);
  });
});
