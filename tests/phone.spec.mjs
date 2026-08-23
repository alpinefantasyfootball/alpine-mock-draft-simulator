/* The two things a phone did that a desktop never showed.

   Both were reported by someone using the app rather than by anything in the
   project, and both are one measurement each — which is the argument for
   having them here. */

import { test, expect, devices } from "@playwright/test";
import { openApp } from "./helpers.mjs";

/* The phone is emulated on Chromium rather than run on WebKit.

   Everything asserted here is CSS and geometry — a computed font size, the
   distance between two boxes — and those are the same wherever they are
   measured. What is *not* the same is the behaviour that makes the font size
   matter: only Safari zooms in on a small field. So this catches the cause
   and cannot catch the symptom, which is the honest trade for not asking
   everybody to download a second browser engine.

   `npx playwright install webkit` and adding it as a project is the upgrade
   if that day comes — an app store submission would be the moment. */
const PHONE = { ...devices["iPhone 13"], defaultBrowserType: undefined };

/* Scoped to #draftroom-root on purpose. The legacy setup screen is still in
   the document, display:none, and its selects are 14.5px — hidden elements
   still report a computed font size, so an unscoped sweep fails on markup no
   thumb can reach. */
const FIELD_READER = `window.readSmallFields = function () {
  return [...document.querySelectorAll("#draftroom-root input, #draftroom-root select, #draftroom-root textarea")]
    .filter(function (el) { return el.type !== "checkbox" && el.type !== "radio"; })
    .filter(function (el) { return parseFloat(getComputedStyle(el).fontSize) < 16; })
    .map(function (el) { return (el.id || String(el.className)).slice(0, 40); });
}`;

test("no field is under 16px, or iOS zooms in and stays there", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await openApp(context, "#/draft-room");
  await page.evaluate(FIELD_READER);

  // A coarse pointer is what the rule keys on, so a test on a fine one proves
  // nothing about the phone it was written for.
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

  /* Every field the app can put in front of somebody on a phone: the lobby,
     then the settings modal (which is where the scoring editor's forty-four
     number inputs live), then the live draft's player search. */
  await page.evaluate(() => {
    const root = document.getElementById("draftroom-root");
    [...root.querySelectorAll("button")]
      .find((b) => /draft settings/i.test(b.getAttribute("aria-label") || ""))
      .click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const m = [...document.querySelectorAll("div")]
      .find((d) => (d.className || "").toString().includes("z-[70]"));
    [...m.querySelectorAll("button")].find((b) => b.textContent.trim() === "Scoring").click();
  });
  await page.waitForTimeout(400);

  const inModal = await page.evaluate(() => readSmallFields());
  expect(inModal, "every settings field clears the floor").toEqual([]);

  await page.evaluate(() => {
    const m = [...document.querySelectorAll("div")]
      .find((d) => (d.className || "").toString().includes("z-[70]"));
    [...m.querySelectorAll("button")]
      .find((b) => /close draft settings/i.test(b.getAttribute("aria-label") || "")).click();
    window.JukeEngine.startDraft({ mySlot: 3, clockLength: 90 });
    render();
  });
  await page.waitForTimeout(700);

  const inDraft = await page.evaluate(() => readSmallFields());
  expect(inDraft, "and so does every field in the draft itself").toEqual([]);
  await context.close();
});

/* This was "the lobby chat does not sit on top of the Start button", and the
   thing it guarded no longer exists: the docked chat's `top: 8px` survived
   into the lobby's `position: relative` as an 8px shove downwards with the
   layout box left behind, so the dock hung over the button beneath it. There
   is no chat dock in the React lobby.

   The *intent* survives and is worth more than the mechanism, so it is kept
   rather than deleted: the one control this screen exists to get you to press
   must actually be pressable. Anything landing on top of it — a dock, a
   sticky bar, a modal that forgot to close — fails this the same way. */
test("nothing is sitting on top of the Start button", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await openApp(context, "#/draft-room");
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const root = document.getElementById("draftroom-root");
    // "Start mock draft" now (NewMockPanel.jsx), not "Enter Draft Room" —
    // Settings & Locker is the first screen since the seat-picker moved to
    // its own step, and the button on it was renamed a second time since,
    // fixing a two-primaries bug. The property this test is actually
    // checking (the one CTA this screen exists to get you to press has to
    // be pressable) is unchanged; only the label keeps moving under it.
    const btn = [...root.querySelectorAll("button")]
      .find((b) => /start draft|start for everyone|start mock draft|enter draft room/i.test(b.textContent || ""));
    if (!btn) return { found: false };
    const b = btn.getBoundingClientRect();
    // Whatever the browser says is actually under the pointer at the button's
    // own centre. Geometry rather than a screenshot, because the answer is
    // "would this click land", not "does it look right".
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { found: true, onTop: !!(hit && (hit === btn || btn.contains(hit))),
             hit: hit ? hit.tagName + "." + String(hit.className).slice(0, 30) : null,
             inViewport: b.top >= 0 && b.bottom <= innerHeight };
  });

  expect(r.found, "the lobby offers a Start button").toBe(true);
  expect(r.inViewport, "and it is on the screen").toBe(true);
  expect(r.onTop, `a click at its centre lands on it, not on ${r.hit}`).toBe(true);
  await context.close();
});

test("nothing overflows sideways that cannot scroll or ellipsise", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await openApp(context, "#/draft-room");
  await page.evaluate(() => {
    window.JukeEngine.startDraft({ mySlot: 3, clockLength: 90 });
    for (let i = 0; i < 30; i++) { const c = onTheClock(); if (c) makePick(cpuChoice(c.slot, c.round)); }
    render();
  });
  await page.waitForTimeout(700);

  /* An element wider than its box is not a fault on its own — a truncated
     team name is behaving exactly as intended. The question is whether it can
     either scroll or ellipsise. Anything that can do neither is the leak. */
  const leaks = await page.evaluate(() => {
    const out = [];

    /* The tolerance is tied to the device pixel ratio, and that is not a
       fudge factor - it is the measurement's own resolution.

       clientWidth rounds and scrollWidth ceils, so a box whose real width is
       fractional reports the two integers disagreeing by a pixel or two with
       nothing wrong at all. On a device at dpr 3 - which is what an iPhone 13
       is - every nested flex row in a 112px board cell lands on thirds, and
       the whole board reported `over=2` on three elements per card.

       That cost a wrong fix before it was measured: eleven "leaks" were
       chased into the board card and none of them existed. The same page at
       dpr 1 reports zero. So the check keeps its edge where it can see one
       and stops inventing them where it cannot. */
    const slack = devicePixelRatio > 1 ? 2 : 1;

    document.querySelectorAll("#draftroom-root *").forEach((el) => {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      if (el.scrollWidth <= el.clientWidth + slack) return;
      if (el.tagName === "INPUT") return;            // an input scrolls its own value
      const c = getComputedStyle(el);
      const scrolls = /auto|scroll/.test(c.overflowX);
      const ellipsises = c.textOverflow === "ellipsis" && c.overflow !== "visible";
      if (scrolls || ellipsises) return;

      /* A decoration hung deliberately outside its box is not a leak.
         The position badge on an avatar sits at -bottom-1 -right-1, so its
         wrapper measures ~4px of overflow on every one of them — 190 of the
         193 this sweep first reported. Nothing is unreachable there: the
         question this test asks is whether *content* has been put somewhere
         a thumb cannot get to, and an absolutely-positioned child placed
         past the edge on purpose is the opposite of that.

         Checked by asking what actually sticks out rather than by
         allow-listing a class or waving a pixel threshold at it — a
         threshold would hide a genuinely clipped short label. */
      const overflowingKids = [...el.children].filter((k) => {
        const kb = k.getBoundingClientRect(), eb = el.getBoundingClientRect();
        return kb.right > eb.right + 1 || kb.left < eb.left - 1;
      });
      const allDecoration = overflowingKids.length > 0 &&
        overflowingKids.every((k) => getComputedStyle(k).position === "absolute");
      if (allDecoration) return;

      out.push(el.tagName + "." + String(el.className).slice(0, 30) + " over=" + (el.scrollWidth - el.clientWidth));
    });
    return out;
  });

  expect(leaks).toEqual([]);
  expect(await page.evaluate(() => document.body.scrollWidth > window.innerWidth)).toBe(false);
  await context.close();
});

/* ---------------------------------------------------------------------------
   The mobile handoff's own artboards, checked against what actually renders.
   Three separate failures, all found by measuring the built page against
   `Juke Mobile.dc.html` rather than by reading the components.
   ------------------------------------------------------------------------- */

/* Artboard 1a puts the hero's eyebrow 36px under a 56px header. It was at
   206px, because <main> carried a flat pt-[108px] — the header's real height
   at lg+, where the nav is h-16 and the ticker is on. Below lg the ticker is
   `hidden lg:block` and the nav is h-14, so 51px of that padding sat over
   nothing, on top of Hero's own pt-[92px].

   The assertion is the gap between the header's bottom edge and the first
   thing under it, not an absolute offset — an absolute number would have to
   move every time the header's own height did, and the defect is the
   relationship between the two, not either one. */
test("the homepage hero starts under the header, not a screen below it", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await openApp(context, "#/");
  await page.waitForTimeout(600);

  const r = await page.evaluate(() => {
    const root = document.getElementById("view-home");
    const header = root.querySelector("header");
    // The eyebrow is desktop's mint pill at every width now — the phone's
    // own teal "FREE · UNLIMITED MOCKS" line was retired by the revised
    // handoff, and "FREE · UNLIMITED · NO ACCOUNT" is a different element
    // that sits below the CTA pair. Anchor on whatever is genuinely first,
    // which is what this test is about.
    const eyebrow = [...root.querySelectorAll("span")]
      .find((e) => e.textContent.trim() === "AGILITY THROUGH ANALYTICS" && e.getBoundingClientRect().height > 0);
    if (!header || !eyebrow) return { found: false };
    return {
      found: true,
      headerBottom: header.getBoundingClientRect().bottom,
      eyebrowTop: eyebrow.getBoundingClientRect().top,
    };
  });

  expect(r.found, "the phone hero draws its own eyebrow").toBe(true);
  // 36px in the artboard. 60 is slack for the line box the span sits in; the
  // bug this catches was 149px of gap, not five.
  expect(r.eyebrowTop - r.headerBottom,
    "the gap between the fixed header and the first thing under it").toBeLessThan(60);
  await context.close();
});

/* Artboard 1c: clock band, a one-line roster strip, then "Three ways to go"
   and the three cards. The build put the desktop roster rail — nine lineup
   rows, four need bars, the next-picks chips — above the cards instead, so
   the recommendations started roughly a screen and a half down on a
   thirty-second clock.

   Two assertions, because either alone passes the bug. "The rail is hidden"
   passes a screen that hid it and put something equally tall in its place;
   "the first card is on screen" passes a screen that kept the rail and simply
   made it shorter. Together they are the artboard's actual claim: Decide is
   the only tab you need to draft. */
test("Decide leads with the recommendations, not the roster rail", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await openApp(context, "#/draft-room");
  // Seat 0, so pick 1.01 is mine and Decide draws the three cards rather than
  // its own not-your-turn branch. The other tests in this file take seat 3
  // because they only need a board; this one needs the turn.
  await page.evaluate(() => {
    window.JukeEngine.startDraft({ mySlot: 0, clockLength: 90 });
    render();
  });
  await page.waitForTimeout(700);

  const r = await page.evaluate(() => {
    const root = document.getElementById("draftroom-root");
    const seen = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 };
    const leaf = (text) => [...root.querySelectorAll("*")]
      .find((e) => e.children.length === 0 && e.textContent.trim() === text && seen(e));
    const heading = leaf("Three ways to go");
    // The first card's own Draft button — the thing the screen is for, and
    // the one element on it that is unambiguously part of a recommendation.
    const draftBtn = [...root.querySelectorAll("button")]
      .find((b) => /^Draft .+/.test(b.textContent.trim()) && seen(b));
    const strip = [...root.querySelectorAll("button")]
      .find((b) => b.textContent.replace(/\s+/g, "").startsWith("RosterQB") && seen(b));
    return {
      headingTop: heading ? heading.getBoundingClientRect().top : null,
      cardTop: draftBtn ? draftBtn.getBoundingClientRect().top : null,
      railShown: !!leaf("Your team"),
      stripShown: !!strip,
      viewport: innerHeight,
    };
  });

  expect(r.railShown, "the desktop roster rail is not on the phone").toBe(false);
  expect(r.stripShown, "the one-line roster strip replaced it").toBe(true);
  expect(r.headingTop, "Three ways to go is drawn").not.toBeNull();
  expect(r.headingTop, "and it is above the fold").toBeLessThan(r.viewport);
  expect(r.cardTop, "so is the first card's own Draft button").toBeLessThan(r.viewport);
  await context.close();
});

/* Not a phone width, deliberately. DraftCockpitHeader's tab nav is `md:flex`
   and MobileDraftTabBar is `lg:hidden`, so between 768px and 1023px both are
   on screen — and the header's nav was handed the raw setView, which does not
   clear hubOpen the way openHub and selectMobileView both do. Tap Roster in
   the bottom bar, then Decide in the header, and PlayerHub unmounts (it only
   mounts in the view !== 'decide' branch) while the bottom bar goes on
   drawing Roster as the selected tab.

   A tab bar claiming a tab that is not on screen is the failure CLAUDE.md's
   goToTab() note names: the app is on a tab its own nav says it is not. It
   renders, it contrasts, nothing throws — pressing it is the only thing that
   finds it, which is why it is asserted here rather than left to a sweep. */
test("the draft tab bar never marks a tab whose panel is not mounted", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 900, height: 800 } });
  const page = await openApp(context, "#/draft-room");
  await page.evaluate(() => {
    window.JukeEngine.startDraft({ mySlot: 3, clockLength: 90 });
    render();
  });
  await page.waitForTimeout(700);

  const READ = `window.readBars = function () {
    var root = document.getElementById("draftroom-root");
    var navs = [].slice.call(root.querySelectorAll("nav"));
    var label = function (n) {
      return [].slice.call(n.querySelectorAll("button")).map(function (b) { return b.textContent.trim() });
    };
    return {
      bottom: navs.filter(function (n) { return label(n).indexOf("Players") >= 0 })[0],
      cockpit: navs.filter(function (n) { return label(n).indexOf("Analysis") >= 0 })[0]
    };
  };
  window.seenBox = function (el) { var b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 };
  window.barState = function () {
    var b = window.readBars();
    return {
      bothVisible: !!(b.bottom && b.cockpit && window.seenBox(b.bottom) && window.seenBox(b.cockpit)),
      active: [].slice.call(b.bottom.querySelectorAll("button"))
        .filter(function (x) { return x.className.indexOf("border-teal-400") >= 0 })
        .map(function (x) { return x.textContent.trim() }),
      sheetMounted: [].slice.call(document.querySelectorAll("div"))
        .some(function (d) { return String(d.className).indexOf("fixed inset-x-0 bottom-[calc") >= 0 })
    };
  };
  window.tapBar = function (which, name) {
    var b = window.readBars();
    [].slice.call(b[which].querySelectorAll("button"))
      .filter(function (x) { return x.textContent.trim() === name })[0].click();
  }`;
  await page.evaluate(READ);

  expect(await page.evaluate(() => barState().bothVisible),
    "this width shows both navs at once, which is the whole setup").toBe(true);

  await page.evaluate(() => tapBar("bottom", "Roster"));
  await page.waitForTimeout(350);
  const opened = await page.evaluate(() => barState());
  expect(opened.active, "Roster is selected").toEqual(["Roster"]);
  expect(opened.sheetMounted, "and its sheet is really there").toBe(true);

  await page.evaluate(() => tapBar("cockpit", "Decide"));
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => barState());
  expect(after.sheetMounted, "Decide unmounts the sheet").toBe(false);
  expect(after.active,
    "so the bottom bar must not still be pointing at Roster").toEqual(["Decide"]);
  await context.close();
});
