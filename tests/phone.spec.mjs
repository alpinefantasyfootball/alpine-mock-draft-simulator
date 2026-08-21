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
    const btn = [...root.querySelectorAll("button")]
      .find((b) => /start draft|start for everyone/i.test(b.textContent || ""));
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
