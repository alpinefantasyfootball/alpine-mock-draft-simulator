/* The two things a phone did that a desktop never showed.

   Both were reported by someone using the app rather than by anything in the
   project, and both are one measurement each — which is the argument for
   having them here. */

import { test, expect, devices } from "@playwright/test";
import { openApp, createRoom, clickLegacyStart } from "./helpers.mjs";

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

test("no field is under 16px, or iOS zooms in and stays there", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await openApp(context);

  // A coarse pointer is what the rule keys on, so a test on a fine one proves
  // nothing about the phone it was written for.
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

  await createRoom(page);          // the chat box only exists inside a room
  await clickLegacyStart(page);   // and the player search only inside a draft
  await page.waitForTimeout(500);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => el.type !== "checkbox" && el.type !== "radio")
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.id || el.className));

  expect(small, "every field is 16px or more on a touch screen").toEqual([]);
  await context.close();
});

test("the lobby chat does not sit on top of the Start button", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await openApp(context);
  await createRoom(page);

  /* `top: 8px` from the docked chat's sticky rule survives into the lobby's
     `position: relative` as an 8px shove downwards, with the layout box left
     behind — so the dock hung over the button underneath it. Geometry rather
     than a screenshot, because the number is the point. */
  const overlap = await page.evaluate(() => {
    const dock = document.querySelector("#lobbyChatSlot .chatdock");
    const btn = document.getElementById("startBtn");
    return Math.round(dock.getBoundingClientRect().bottom - btn.getBoundingClientRect().top);
  });

  expect(overlap, "the dock ends where the button begins").toBeLessThanOrEqual(0);
  await context.close();
});

test("nothing overflows sideways that cannot scroll or ellipsise", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await openApp(context);
  await clickLegacyStart(page);
  await page.waitForTimeout(500);

  /* An element wider than its box is not a fault on its own — a truncated
     team name is behaving exactly as intended. The question is whether it can
     either scroll or ellipsise. Anything that can do neither is the leak. */
  const leaks = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("body *").forEach((el) => {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;
      if (el.tagName === "INPUT") return;            // an input scrolls its own value
      const c = getComputedStyle(el);
      const scrolls = /auto|scroll/.test(c.overflowX);
      const ellipsises = c.textOverflow === "ellipsis" && c.overflow !== "visible";
      if (!scrolls && !ellipsises) out.push(el.tagName + "." + String(el.className).slice(0, 30));
    });
    return out;
  });

  expect(leaks).toEqual([]);
  expect(await page.evaluate(() => document.body.scrollWidth > window.innerWidth)).toBe(false);
  await context.close();
});
