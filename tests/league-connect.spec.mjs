/* What the site says about a connected league, before and after there is one.

   Reported: "I clicked Connect from the homepage and it asked for my Sleeper
   username. There's a disconnect between what we're saying we can connect to
   and what our pop-up is asking for... Even after entering my Sleeper
   username and getting a confirmation that it connected successfully, the
   Connect messaging is still there throughout the website."

   Three defects in one report, and this file covers the two a keyless build
   can reach.

   ---- What is NOT covered here, and why ----

   The connect dialog itself is only reachable from a ConnectLeagueCta, and
   every one of those sits inside Clerk's <SignedIn>. A test build has no
   publishable key (web/.env.example keeps a pk_test_ one for `vite dev`, and
   CI has none), so useAccountUiReady() answers false, no provider mounts, and
   those four surfaces render their signed-out fallbacks. Driving the dialog
   would mean signing in to a real Clerk instance.

   So the platform step — four platforms listed, three locked, no username
   asked for until Sleeper is chosen — was verified by hand against the built
   site, and what is asserted here is everything downstream of a connection
   that a guest build CAN observe. The surfaces below are the ones that read
   useLeague() directly rather than through a Clerk gate.

   ---- The stub ----

   `window.Live` is live.js's own object and `window.JukeAuth` is what
   AuthBridge writes; both are read at call time by design (see useLeague's
   own note on why it does not hold Clerk's hooks). Replacing the two methods
   this path uses is therefore the whole fixture — no network, no account, and
   the real components underneath. */

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const LEAGUE = { leagueId: "lg1", name: "Dynasty Degens", season: "2026", totalTeams: 12 };

/* Signed in, with or without a league. Installed before any page script so
   the first render already sees it — a stub applied afterwards would let the
   page settle on "signed out" first and then test the repaint rather than the
   state. */
function stubAccount(page, leagues) {
  return page.addInitScript((rows) => {
    window.JukeAuth = { isSignedIn: true, userId: "u1", getToken: () => Promise.resolve("t") };
    const install = () => {
      const L = window.Live || (window.Live = {});
      L.listLeagues = () => Promise.resolve({ ok: true, leagues: rows.slice() });
    };
    install();
    // live.js defines its own window.Live when it lands and would replace the
    // object above, so this reinstalls once the real one exists.
    window.addEventListener("juke:data-loaded", install);
    document.addEventListener("DOMContentLoaded", install);
  }, leagues);
}

const text = (page) => page.locator("#view-home").innerText();

test.describe("a connected league", () => {
  test("nothing on the site claims four working platforms", async ({ context }) => {
    const page = await openApp(context, "#/rooms");
    await page.waitForSelector("#view-home h1");

    /* The bug in one assertion. `Sleeper · ESPN · Yahoo · CBS` was written
       under every connect control on the site — four platforms, named as a
       list of equals, with one built. The replacement says which is which,
       and it is one shared constant so it cannot drift back into a claim in
       six places at once. */
    const body = await text(page);
    expect(body).not.toContain("Sleeper · ESPN · Yahoo · CBS");
    expect(body).not.toContain("Sleeper, ESPN, Yahoo or CBS");
    expect(body).toContain("Sleeper now");

    await page.close();
  });

  test("a guest is still asked, and the rooms are still locked", async ({ context }) => {
    const page = await openApp(context, "#/rooms");
    await page.waitForSelector("#view-home h1");
    const body = await text(page);

    // The control, and it matters: every assertion in the next test is about
    // something DISAPPEARING, and a bug that hid these from everybody would
    // pass all of them.
    expect(body).toContain("Unlock every room with your league");
    expect(body).toContain("The rest unlock when you connect a league");
    expect(body).toMatch(/5 ROOMS · 1 OPEN/);

    await page.close();
  });

  test("with a league connected, the site stops asking for one", async ({ context }) => {
    const page = await context.newPage();
    await stubAccount(page, [LEAGUE]);
    await page.goto(`${(await import("./helpers.mjs")).SITE}/index.html#/rooms`);
    await page.waitForSelector("#view-home h1");
    // The lobby reads the league through useLeague(), which resolves a tick
    // after mount — wait for the answer rather than for a duration.
    await page.waitForFunction(
      () => /2 OPEN/.test(document.getElementById("view-home").innerText),
      null,
      { timeout: 15000 },
    );

    const body = await text(page);

    /* Every one of these was still on the screen after a successful connect,
       and each is a different component that had no way to hear about it.
       Confirmed red without the shared league state: all four fail. */
    expect(body, "the unlock bar is gone").not.toContain("Unlock every room with your league");
    expect(body, "and so is the promise it made").not.toContain(
      "The rest unlock when you connect a league",
    );
    /* The lobby does not NAME the league — the header chip that does is
       inside <SignedIn> and so absent from a keyless build (see this file's
       own note). What it says instead is that the league is in, which is
       the same fact in the copy this screen owns. */
    expect(body, "and the blurb says the league is in").toContain("Your league is in");
    expect(body, "and the room it opens is counted").toMatch(/5 ROOMS · 2 OPEN/);

    /* The League Room specifically. `live` on a room means "built for
       everybody" and was the only thing the lobby drew a padlock from, so a
       room RoomPage renders live for a connected reader was still shown
       locked here — the same bug as the copy, in an emoji. */
    expect(body, "League is no longer previewed").not.toContain("Preview: standings + power ranks");

    await page.close();
  });

  test("the homepage names the league instead of advertising a connect", async ({ context }) => {
    const page = await context.newPage();
    await stubAccount(page, [LEAGUE]);
    await page.goto(`${(await import("./helpers.mjs")).SITE}/index.html#/`);
    await page.waitForSelector("#view-home h1");
    await page.waitForFunction(
      () => document.getElementById("view-home").innerText.includes("Dynasty Degens"),
      null,
      { timeout: 15000 },
    );

    const body = await text(page);
    // The hero's second card. It read "BRING YOUR LEAGUE / Connect" with a
    // list of four platforms under it, whether or not one was connected.
    expect(body).toContain("YOUR LEAGUE");
    expect(body).toContain("Connected · read-only");

    await page.close();
  });
});
