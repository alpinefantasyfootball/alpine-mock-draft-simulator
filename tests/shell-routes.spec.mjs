import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

/* Every route the app has renders its own screen, at both widths.

   It looks like a tautology and is not. Which screen a hash resolves to is
   decided in three places that do not know about each other — App's own
   useHashRoute, DraftRoom.jsx's useHashActive, and applyRoute()'s hideHome
   in app.js, which can hide #view-home out from under a screen that
   rendered perfectly well inside it. A route falling through to the
   homepage, or rendering into a hidden container, is a blank page with no
   console error and nothing failing anywhere: exactly what #/drafts did
   for one commit while this suite was otherwise green.

   Flow v3 moved two of those routes and added four, so the cheap thing
   that catches a whole class of that is asking each one whether the screen
   it names is on the page.

   The sideways-overflow check rides along because it is free at this point
   and it is the one thing this project already sweeps for by hand. It is
   the page's own scroller only — an element that overflows and can scroll
   or ellipsise is fine, which is what phone.spec.mjs measures properly. */
const CASES = [
  { hash: "#/", needs: "Know the move", tab: "Home" },
  { hash: "#/rooms", needs: "The Rooms", tab: "Rooms" },
  { hash: "#/rooms/waiver", needs: "Waiver Room", tab: "Rooms" },
  { hash: "#/rooms/trade", needs: "Trade Room", tab: "Rooms" },
  { hash: "#/rooms/strategy", needs: "Strategy Room", tab: "Rooms" },
  { hash: "#/rooms/league", needs: "League Room", tab: "Rooms" },
  { hash: "#/rooms/draft", needs: "Mock Drafts", tab: "Rooms" },
  { hash: "#/drafts", needs: "Your Drafts", tab: "Drafts" },
  { hash: "#/you", needs: "You", tab: "You" },
];

for (const size of [{ w: 390, h: 844, label: "phone" }, { w: 1280, h: 900, label: "desktop" }]) {
  for (const c of CASES) {
    test(`${c.hash} renders on ${size.label}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
      const page = await openApp(context, c.hash);
      await page.waitForTimeout(900);

      /* Lower-cased on both sides. Every one of these headings is title
         case in the source and uppercased in CSS, so innerText never
         spells it the way the source does -- the same trap that has now
         broken a hero-eyebrow check, a "Randomize" check and a /nan/i
         sweep in this repo. */
      const seen = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      expect(seen, `${c.hash} draws its own screen`).toContain(c.needs.toLowerCase());

      // Nothing overflows the page sideways, at either width.
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, "no sideways page scroll").toBeLessThanOrEqual(0);
      await context.close();
    });
  }
}
