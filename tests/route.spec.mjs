import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

/* #/draft is retired. It was the Draft Room for the whole life of the
   project, so it is in bookmarks, in shared links, and in every invite sent
   before the day it was retired — and it went on rendering a complete,
   working, out-of-date draft room, which is the worst way for a dead route
   to fail. Reported from the outside as "my friend is still seeing the old
   draft room".

   These two assertions are the whole contract. */
test.describe("the retired draft route", () => {
  test("sends a bookmark to the real Draft Room", async ({ context }) => {
    const page = await openApp(context, "#/draft");
    await page.waitForFunction(() => location.hash !== "#/draft");

    expect(await page.evaluate(() => location.hash)).toBe("#/draft-room");
    expect(
      await page.evaluate(() => document.getElementById("view-app").hidden),
      "and the retired view stays hidden"
    ).toBe(true);
  });

  /* The bug this exists to catch: route() strips the query to decide the
     path, so a redirect written the obvious way drops the room code and
     lands a guest on an empty setup screen instead of in the draft they
     were invited to. Every invite sent before the retirement is this shape. */
  test("carries an old invite's room code across", async ({ context }) => {
    const page = await openApp(context, "#/draft?room=ABC1");
    await page.waitForFunction(() => location.hash.indexOf("#/draft-room") === 0);

    expect(await page.evaluate(() => location.hash)).toBe("#/draft-room?room=ABC1");
    expect(
      await page.evaluate(() => JukeEngine.codeInUrl()),
      "and the app can still read the code"
    ).toBe("ABC1");
  });
});
