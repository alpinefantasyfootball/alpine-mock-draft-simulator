/* The cold-load overlay, on both shells.

   #boot-sonar is markup in web/index.html with an inline <style>, and its
   teardown is in web/src/main.jsx. That split is deliberate and documented —
   the overlay has to be styled before any bundle is readable — but it is also
   the whole risk surface, because a fixed element at z-index 9999 that outlives
   the load swallows every click on the page.

   So these are not "does the animation look nice" tests. They are: does it come
   down, does it come down everywhere, and what happens when the thing that
   takes it down never runs. */

import { test, expect, devices } from "@playwright/test";
import { openApp, SITE } from "./helpers.mjs";

const PHONE = { ...devices["iPhone 13"], defaultBrowserType: undefined };
const DESKTOP = { viewport: { width: 1440, height: 900 } };

/* The overlay is markup in web/index.html, and at the time this file was
   written that markup was still an uncommitted work in progress. Rather than
   hold the tests back until it lands — or commit a spec that goes red on a
   build without it — the whole file skips when the served HTML has no
   #boot-sonar in it.

   CLAUDE.md's rule about skips applies and was followed: a skip that fires
   everywhere is indistinguishable in the output from one that fires correctly,
   so both directions were run. Against a build carrying the overlay: 4 passed.
   Against one without it: 4 skipped, and the suite does not go red. */
let hasOverlay = null;
test.beforeAll(async ({ request }) => {
  const res = await request.get(SITE + "/");
  hasOverlay = (await res.text()).includes('id="boot-sonar"');
});
test.beforeEach(() => {
  test.skip(!hasOverlay, "this build has no #boot-sonar in its HTML");
});

/* Records the overlay's whole life from before the document runs: whether it
   was ever painted at a visible opacity, and when it left the DOM. Installed
   with addInitScript so it is in place ahead of the inline <style>, which is
   the only way to catch a flash that resolves in 300ms. */
const PROBE = () => {
  window.__sonar = { seen: false, maxOpacity: 0, removedAt: null, existed: false };
  const t0 = Date.now();
  const tick = () => {
    const el = document.getElementById("boot-sonar");
    if (el) {
      window.__sonar.existed = true;
      const o = parseFloat(getComputedStyle(el).opacity) || 0;
      if (o > window.__sonar.maxOpacity) window.__sonar.maxOpacity = o;
      if (o > 0.02) window.__sonar.seen = true;
    } else if (window.__sonar.existed && window.__sonar.removedAt == null) {
      window.__sonar.removedAt = Date.now() - t0;
    }
    if (Date.now() - t0 < 6000) setTimeout(tick, 16);
  };
  tick();
};

async function loadWithProbe(browser, opts, path = "#/") {
  const context = await browser.newContext(opts);
  await context.addInitScript(PROBE);
  const page = await openApp(context, path);
  return { context, page };
}

for (const [label, opts] of [["a phone", PHONE], ["a desktop", DESKTOP]]) {
  test(`the cold-load overlay comes down on ${label}, and leaves nothing over the page`, async ({ browser }) => {
    const { context, page } = await loadWithProbe(browser, opts);
    await page.waitForTimeout(2500);

    const sonar = await page.evaluate(() => window.__sonar);
    expect(sonar.existed, "the overlay is in the served markup").toBe(true);
    expect(
      await page.evaluate(() => !!document.getElementById("boot-sonar")),
      "and it is gone once the page has loaded",
    ).toBe(false);

    /* The assertion that actually matters. An overlay left behind reports as a
       working page in every other check — the content is all there underneath
       it — and only a hit test finds it. */
    const reachable = await page.evaluate(() => {
      const cta = [...document.querySelectorAll("#view-home a")].find(
        (a) => a.textContent.trim() === "Enter the Draft Room" && a.getBoundingClientRect().height > 0,
      );
      if (!cta) return { found: false };
      const b = cta.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return {
        found: true,
        onTop: !!(hit && (hit === cta || cta.contains(hit))),
        hit: hit ? hit.tagName + "." + String(hit.className).slice(0, 40) : null,
      };
    });
    expect(reachable.found, "the hero CTA rendered").toBe(true);
    expect(reachable.onTop, `a click lands on the CTA, not on ${reachable.hit}`).toBe(true);

    await context.close();
  });
}

/* A load fast enough to beat the 300ms fade-in must never show the logo at all.
   The overlay's own comment says so — "a flash of logo reads as a glitch rather
   than as polish" — and it is the reason the fade is delayed rather than
   immediate. Worth an assertion because the mechanism is easy to lose: drop the
   delay from the animation and everything still "works", it just flashes. */
test("a fast load never paints the loader", async ({ browser }) => {
  const { context, page } = await loadWithProbe(browser, DESKTOP);
  await page.waitForTimeout(2500);
  const sonar = await page.evaluate(() => window.__sonar);

  // Local, warm, no network — if this ever paints here it will paint for
  // everyone. Recorded rather than asserted-away: maxOpacity is reported in the
  // failure message so a regression says how far it got.
  expect(
    sonar.maxOpacity,
    `the overlay reached opacity ${sonar.maxOpacity} on a warm local load`,
  ).toBeLessThan(0.05);

  await context.close();
});

/* The failure case, and the reason this file exists.

   The teardown is the last statement in main.jsx, so it runs only if that
   module runs. CLAUDE.md documents the exact deploy shape where it does not:
   Vite content-hashes the bundle into its filename, so a browser holding the
   previous index.html asks for an `assets/index-<hash>.js` that no longer
   exists and gets a 404. That already happened once here and shipped as "a
   blank Draft Room" — visibly broken, which is how it got reported.

   With an overlay in front of it the same event renders a full-screen branded
   obsidian panel instead, and a page that looks like it is loading for ever is
   a worse failure than one that looks broken, because nobody reports it as a
   bug. Measured before the fix: opacity 1, and a click at page centre landed on
   the overlay.

   The failsafe is a second CSS animation on the same element, so it needs no
   JavaScript at all — which is the whole point, since the missing JavaScript is
   the fault being survived. */
test("if the bundle never arrives, the overlay takes itself away", async ({ browser }) => {
  const context = await browser.newContext(DESKTOP);
  // Every module script, which is how the real failure presents: the classic
  // legacy scripts still load, React never mounts, main.jsx never runs.
  await context.route(/\/(assets\/index-.*\.js|src\/main\.jsx).*/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(SITE + "/#/", { waitUntil: "domcontentloaded" });

  // Just before the failsafe fires: it should still be up, because a loader
  // that gives up in two seconds is not a loader.
  await page.waitForTimeout(2000);
  const early = await page.evaluate(() => {
    const el = document.getElementById("boot-sonar");
    return el ? parseFloat(getComputedStyle(el).opacity) : null;
  });
  expect(early, "at 2s it is still holding the screen").toBeGreaterThan(0.9);

  // 8s delay + 600ms fade, plus slack.
  await page.waitForTimeout(7500);

  const state = await page.evaluate(() => {
    const el = document.getElementById("boot-sonar");
    if (!el) return { present: false };
    const cs = getComputedStyle(el);
    const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return {
      present: true,
      opacity: parseFloat(cs.opacity),
      pointerEvents: cs.pointerEvents,
      swallowsClicks: !!(hit && (hit === el || el.contains(hit))),
    };
  });

  // Still in the DOM — nothing removed it, and nothing can. What matters is
  // that it is no longer in the way.
  expect(state.present, "no JS ran, so the element is still in the document").toBe(true);
  expect(state.opacity, "but it has faded itself out").toBeLessThan(0.05);
  expect(state.swallowsClicks, "and a click at page centre no longer hits it").toBe(false);

  await context.close();
});
