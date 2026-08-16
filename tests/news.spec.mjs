/* Latest news on a player sheet.

   Two halves, deliberately.

   The **unconfigured** half runs against the worker the suite actually starts,
   which has no provider key — the same thing a fresh checkout sees. That path
   has to leave no trace: no panel, no gap, no error, and above all a sheet
   that is otherwise complete. It is the common case for anyone running this
   repo and it would be the easiest thing in the world to ship broken.

   The **rendering** half stubs `Live.news` in the page. Not laziness: a test
   that needed a real key could never run here, and the things worth asserting
   — that a script tag in a headline stays text, that a javascript: link is
   dropped, that a slow answer cannot land in somebody else's sheet — are all
   about what this code does with a payload, not about who sent it. Stubbing
   also lets the payload be hostile on purpose, which no real provider will
   oblige with on demand.
*/

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";
import { WORKER_HTTP } from "./helpers.mjs";

async function start(page) {
  await page.click("#startBtn");
  expect(await page.evaluate(() => state.started), "draft started").toBe(true);
}

const HOSTILE = [
  { title: "A normal headline", summary: "A normal summary.",
    source: "Wire Service", at: "2026-08-16", url: "https://example.com/ok" },
  { title: '<img src=x onerror="window.__pwned=1">headline',
    summary: "<script>window.__pwned2=1</script>body",
    source: "<b>Source</b>", at: "2026-08-15", url: "https://example.com/escaped" },
  { title: "Script in a link", summary: "",
    source: "Sketchy", at: "", url: "javascript:window.__pwned3=1" },
  { title: "Data URI link", summary: "",
    source: "Sketchy", at: "", url: "data:text/html,<script>window.__pwned4=1</script>" },
];

async function stubNews(page, items) {
  await page.evaluate((rows) => {
    newsCache.clear();
    Live.news = () => Promise.resolve({ configured: true, items: rows });
  }, items);
}

/* News is asked for by the player's id at the *provider*, which the pipeline
   writes into stats.js as `x`. Nothing in the repo carries one until a build
   runs with a key, so a test that wants headlines has to put one there — and
   that is worth doing rather than working around, because the absence of an
   id is itself a behaviour with its own test below. */
async function crosswalk(page, name, theirId = "T-TEST-1") {
  await page.evaluate(([n, id]) => {
    const p = board.find((x) => x.name === n);
    const rec = PLAYER_STATS[p.id];
    rec.x = { tank: id };
  }, [name, theirId]);
}

test.describe("latest news", () => {
  test("with no provider key the sheet is complete and the panel is absent",
    async ({ context }) => {
      const page = await openApp(context);
      await start(page);

      await page.evaluate(() => openSheet(board.find((p) => p.name === "Jahmyr Gibbs")));
      // Long enough for a real answer to have arrived and been acted on.
      await page.waitForTimeout(1500);

      const r = await page.evaluate(() => {
        const panel = document.querySelector("#newsPanel");
        return { exists: !!panel, hidden: panel ? panel.hidden : null,
                 empty: panel ? panel.innerHTML === "" : null,
                 box: panel ? panel.getBoundingClientRect().height : null,
                 ourRead: !!document.querySelector(".ourread"),
                 meters: document.querySelectorAll(".sig").length };
      });

      expect(r.exists, "the slot is always in the markup").toBe(true);
      expect(r.hidden, "but hidden with nothing to show").toBe(true);
      expect(r.empty, "and holding nothing").toBe(true);
      expect(r.box, "so it takes no vertical space").toBe(0);
      // The rest of the sheet is the point: news is additive, never load-bearing.
      expect(r.ourRead, "Our read is unaffected").toBe(true);
      expect(r.meters, "the three meters are unaffected").toBe(3);
    });

  test("the worker refuses an origin it does not serve, before reading the key",
    async ({ request }) => {
      const evil = await request.get(`${WORKER_HTTP}/news?player=9221`,
        { headers: { Origin: "https://evil.example" } });
      expect(evil.status(), "a made-up origin").toBe(403);

      // Contains the string "jukeff.com" and is a different site entirely.
      const lookalike = await request.get(`${WORKER_HTTP}/news?player=9221`,
        { headers: { Origin: "https://jukeff.com.evil.example" } });
      expect(lookalike.status(), "a lookalike origin").toBe(403);

      const ours = await request.get(`${WORKER_HTTP}/news?player=9221`,
        { headers: { Origin: "http://localhost:8765" } });
      expect(ours.status(), "an origin we serve").toBe(200);
      const body = await ours.json();
      // No key in the test environment, and it says so rather than pretending.
      expect(body).toHaveProperty("configured");
      expect(Array.isArray(body.items), "items is always an array").toBe(true);
    });

  test("headlines render, and hostile ones stay text", async ({ context }) => {
    const page = await openApp(context);
    await start(page);
    await stubNews(page, HOSTILE);
    await crosswalk(page, "Jahmyr Gibbs");

    await page.evaluate(() => openSheet(board.find((p) => p.name === "Jahmyr Gibbs")));
    await page.waitForSelector(".newsbox:not([hidden])", { timeout: 5000 });

    const r = await page.evaluate(() => {
      const panel = document.querySelector("#newsPanel");
      const items = [...panel.querySelectorAll(".newsitem")];
      return {
        count: items.length,
        hrefs: items.map((a) => a.getAttribute("href")),
        rels: [...new Set(items.map((a) => a.getAttribute("rel")))],
        targets: [...new Set(items.map((a) => a.getAttribute("target")))],
        heads: items.map((a) => a.querySelector(".newshead").textContent),
        sources: items.map((a) => a.querySelector(".newsfoot").textContent),
        injected: { img: panel.querySelectorAll("img").length,
                    script: panel.querySelectorAll("script").length,
                    b: panel.querySelectorAll("b").length },
        pwned: [window.__pwned, window.__pwned2, window.__pwned3, window.__pwned4]
      };
    });

    // Both unsafe schemes gone; only the two http(s) items survive.
    expect(r.count, "javascript: and data: links are dropped").toBe(2);
    expect(r.hrefs.every((h) => h.startsWith("https://"))).toBe(true);

    /* The markup arrived as text and stayed text. Asserted against the DOM
       rather than the HTML string, because the question is whether the
       browser built an element — one manager putting a script tag in another
       manager's sheet is the exact failure chat is escaped to prevent, and a
       news feed is the same shape of input from further away. */
    expect(r.injected, "nothing was constructed from the payload")
      .toEqual({ img: 0, script: 0, b: 0 });
    expect(r.pwned, "nothing ran").toEqual([undefined, undefined, undefined, undefined]);
    expect(r.heads[1], "the tag is shown, not honoured").toContain("<img src=x");

    // Attribution is the part that may not be dropped.
    expect(r.sources[0]).toContain("Wire Service");
    expect(r.rels, "outbound links are safe to open").toEqual(["noopener noreferrer"]);
    expect(r.targets).toEqual(["_blank"]);
  });

  test("a slow answer cannot land in a different player's sheet",
    async ({ context }) => {
      const page = await openApp(context);
      await start(page);

      /* The sheet is one element reused for everybody, so an answer that
         arrives after the reader has moved on would render into whoever is
         open now. Nothing else in the app would catch it. */
      await crosswalk(page, "Bijan Robinson", "T-BIJAN");
      await crosswalk(page, "Ja'Marr Chase", "T-CHASE");

      const r = await page.evaluate(async () => {
        newsCache.clear();

        /* Every call gets its own pending promise and they are collected, so
           only the *first* player's can be resolved. Holding a single
           `release` variable instead is the obvious way to write this and is
           wrong: the second openSheet() overwrites it, and resolving then
           settles the second player's own request, which is not a race and
           passes against an app with no guard at all. */
        const pending = [];
        Live.news = () => new Promise((res) => pending.push(res));

        openSheet(board.find((p) => p.name === "Bijan Robinson"));
        openSheet(board.find((p) => p.name === "Ja'Marr Chase"));

        pending[0]({ configured: true, items: [{
          title: "BELONGS TO THE FIRST PLAYER", summary: "", source: "Wire",
          at: "", url: "https://example.com/first" }] });
        await new Promise((r2) => setTimeout(r2, 400));

        const panel = document.querySelector("#newsPanel");
        return { calls: pending.length, open: sheetPlayer.name,
                 leaked: panel.innerHTML.indexOf("BELONGS TO THE FIRST PLAYER") >= 0 };
      });

      expect(r.calls, "both sheets asked for news").toBe(2);

      expect(r.open).toBe("Ja'Marr Chase");
      expect(r.leaked, "the first player's news rendered into the second's sheet").toBe(false);
    });

  test("a player we could not link is never asked about", async ({ context }) => {
    const page = await openApp(context);
    await start(page);

    /* The pipeline reports these in unmatched.txt and the sheet shows nothing.
       What it must never do is fall back to a name, or to league-wide
       headlines dressed as his: somebody else's news under this player's name
       is the one outcome worse than an empty panel, and every number around it
       would still be right. */
    const r = await page.evaluate(async () => {
      newsCache.clear();
      let asked = 0;
      Live.news = (id) => { asked++; return Promise.resolve({ configured: true, items: [{
        title: "SOMEBODY ELSE'S NEWS", summary: "", source: "Wire", at: "",
        url: "https://example.com/x" }] }); };

      const p = board.find((x) => x.pos !== "DST");
      delete PLAYER_STATS[p.id].x;              // not in the crosswalk
      openSheet(p);
      await new Promise((r2) => setTimeout(r2, 400));

      const panel = document.querySelector("#newsPanel");
      return { asked, hidden: panel.hidden, html: panel.innerHTML,
               sourceId: sourceId(p, "tank") };
    });

    expect(r.sourceId, "no id for this player").toBe("");
    expect(r.asked, "the provider is never called without an id").toBe(0);
    expect(r.hidden, "and the panel stays hidden").toBe(true);
    expect(r.html, "with nothing in it").toBe("");
  });

  test("a failed fetch leaves no mark on the sheet", async ({ context }) => {
    const page = await openApp(context);
    await start(page);
    await crosswalk(page, "Puka Nacua");

    const r = await page.evaluate(async () => {
      newsCache.clear();
      Live.news = () => Promise.reject(new Error("offline"));
      openSheet(board.find((p) => p.name === "Puka Nacua"));
      await new Promise((r2) => setTimeout(r2, 400));
      const panel = document.querySelector("#newsPanel");
      return { hidden: panel.hidden, height: panel.getBoundingClientRect().height,
               sheetOpen: !document.getElementById("sheet").hidden,
               ourRead: !!document.querySelector(".ourread") };
    });

    expect(r.hidden, "hidden").toBe(true);
    expect(r.height, "and taking no space").toBe(0);
    expect(r.sheetOpen, "the sheet is unharmed").toBe(true);
    expect(r.ourRead, "and still complete").toBe(true);
  });
});
