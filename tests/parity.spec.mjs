/* The homepage says the same things at 390px as it does at 1440px.

   Written after the live site was reported as showing "a completely different
   message on the desktop homepage vs. mobile homepage", which it was: the hero
   paragraph was two entirely different sentences, and desktop's led with the
   price the rest of the page had just stopped leading with.

   The check is deliberately a *content* diff and not a screenshot. Two
   breakpoints are supposed to look different — that is what a breakpoint is —
   and a pixel comparison would fail on every intentional layout change while
   staying silent on the thing that actually went wrong, which is the words. */

import { test, expect, devices } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const PHONE = { ...devices["iPhone 13"], defaultBrowserType: undefined };
const DESKTOP = { viewport: { width: 1440, height: 900 } };

/* Every visible text node under #view-home, in document order.

   Scoped to that id on purpose: the legacy markup is still in the document at
   display:none (CLAUDE.md — unreachable, not deleted), and a hidden element
   still has text. The walker skips display:none and visibility:hidden as it
   descends, so a subtree hidden by a breakpoint never contributes — which is
   the whole mechanism being tested. */
const COLLECT = `window.__collectHomeText = function () {
  var root = document.getElementById("view-home");
  var out = [];
  (function walk(n) {
    // Direct text children are joined into one string before being pushed.
    // JSX puts a line break between "Enter the" and "Draft Room" inside a
    // single <a>, which the DOM keeps as two text nodes — pushing them
    // separately reports one label as three phantom differences.
    var own = "";
    for (var i = 0; i < n.childNodes.length; i++) {
      if (n.childNodes[i].nodeType === 3) own += n.childNodes[i].textContent;
    }
    own = own.replace(/\\s+/g, " ").trim();
    if (own) {
      var b = n.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) out.push(own);
    }
    for (var j = 0; j < n.childNodes.length; j++) {
      var e = n.childNodes[j];
      if (e.nodeType === 1) {
        var cs = getComputedStyle(e);
        if (cs.display !== "none" && cs.visibility !== "hidden") walk(e);
      }
    }
  })(root);
  return out;
}`;

async function homeTextAt(browser, contextOpts) {
  const context = await browser.newContext(contextOpts);
  const page = await openApp(context, "#/");
  await page.evaluate(COLLECT);
  // The freshness line and the ticker both wait on window.JukeEngine.
  await page.waitForTimeout(900);
  const text = await page.evaluate(() => __collectHomeText());
  // Player names are data, not copy — they come off the nightly board, and the
  // scoring demo shows six rows on desktop against five on the phone, so the
  // sixth name is a real difference that means nothing. Read from the bridge
  // rather than pattern-matched, because "Jonathan Taylor" and "Draft Room"
  // are the same shape to a regex.
  const names = await page.evaluate(() =>
    (window.JukeEngine && window.JukeEngine.board() ? window.JukeEngine.board() : []).map((p) => p.name),
  );
  await context.close();
  return { text, names };
}

/* Strings each breakpoint is allowed to carry alone, with the reason.

   Every entry here is a decision recorded in design_handoff_mobile, not a
   convenience. Anything that turns up outside this list is the bug. */
const PHONE_ONLY = [
  // PROMPT 1 — the marketing shell's persistent bottom CTA. Its string is the
  // same "Enter the Draft Room" every other CTA uses; it is the *element* that
  // is phone-only, and it shows up as a duplicate rather than a new string.

  // PROMPT 2 item 2 — ScoringDemoCard's mobile branch is documented as
  // deliberately different from desktop's: its own eyebrow, the reversed
  // format order, five rows sliced off six, no points column, and a generated
  // closing line. "Each of those differs from desktop on purpose."
  // The eyebrow was "CHANGE THE RULES, WATCH IT RERUN" when this list was
  // written and is this now (ScoringDemoCard.jsx, the lg:hidden branch).
  // Replaced rather than added to: the sanctioned difference is "its own
  // eyebrow", which has not changed — only the words in it — and keeping
  // the old string here would have left the list permitting a line the
  // page no longer contains.
  "BOARD · SORTED BY VORP",
  "Every ranking on Juke moves with your rules.",
  // Its format pills are short here and spelled out on desktop — "Half"
  // against "Half PPR" — because three of them have to fit 358px.
  "Half",
  // And its closing sentence is generated from PPR_EXPLAIN[format], so it
  // changes with the toggle. Matched by shape rather than by value.
  /^Receptions are worth /,

  // PROMPT 2 item 4 — "Do not render five separate Coming Soon cards on a
  // phone." The five rooms collapse to one row naming them.
  "Five more rooms in build",
  "Prospect, Waiver, Trade, Strategy, League",
];

const DESKTOP_ONLY = [
  // PROMPT 1 — the nav collapses into the hamburger sheet below lg.
  "How It Works",
  "The Rooms",
  "Draft Room",
  "Sign Up",

  // PROMPT 2 "Cut from mobile" — the insights ticker, and review item 36's
  // scores strip. Every ticker line is generated from the live board, so they
  // are matched by prefix below rather than listed.

  // PROMPT 2 item 2 again, from the other side: desktop's own scoring card
  // labels, its sixth row, and its format-dependent footer.
  "Points per reception",
  "Standard",
  "Half PPR",
  "Full PPR",
  /^Projected season points · /,
  // Desktop's own panel title, the counterpart to the phone eyebrow listed
  // in PHONE_ONLY above. Both branches have always had one; only the phone's
  // was written down here.
  "Board · sorted by value over replacement",

  // RoomsGrid's desktop timeline groups the six rooms by season under a
  // heading and a count. The phone collapses all five coming-soon rooms to
  // the single row named in PHONE_ONLY, so it has no groups to head.
  "Pre-season",
  "In-season",
  "Post-season",
  /^\d+ rooms?$/,

  // PROMPT 2 item 4 — the five coming-soon cards and their lead lines, plus
  // RoomCard's own "Mock smarter." lead, which the phone card omits by name.
  "Mock smarter.",
  "The Prospect Room",
  "Scout the future.",
  "The Waiver Room",
  "Win the wire.",
  "The Trade Room",
  // ROOMS gained a `lead` field and had these rewritten in the homepage
  // redesign; "Deal with confidence." and "See the big picture." are the
  // strings this list was written against and no longer exist in app.js.
  "Price the deal.",
  "The Strategy Room",
  "Optimize every week.",
  "The League Room",
  "See the whole table.",
  "Coming soon",
  // …and each card's blurb, which only the desktop grid renders. The phone's
  // one live card keeps its own blurb, so these five are the coming-soon ones.
  /^Analyze the college production/,
  /^Connect your live league/,
  /^Both rosters valued against replacement/,
  /^Set your lineup using predictive/,
  /^Playoff odds, strength of schedule/,
];

/* Live data, not copy. These are real numbers off the board and they change
   nightly; both breakpoints read the same bridge, so a difference here is a
   data-timing artefact of two page loads, not a content divergence. */
const DATA_SHAPED = [
  /^\d+(\.\d+)?$/,                       // rank cells, projected points
  /^[+\-−]\d+(\.\d+)?$/,                 // signed VORP deltas, e.g. "+91"
  /^\d+%$/,                              // TakeAPick's survival odds, e.g. "99%"
  /^(QB|RB|WR|TE|K|DST)$/,               // position badges
  /^—$/,                                 // the demo's empty delta cell
  /* TakeAPick.jsx steps through PHASE_TAGS on a timer, so which tag is on
     screen depends on how long the capture took — two page loads land on
     different ones and the diff reports whichever pair happened to differ.
     A phase tag is neither copy that can drift nor data off the board, but
     it is the same kind of two-loads artefact this list exists for, and
     pinning one by name would just make the test fail on the clock. */
  /^(On the clock|Your pick|The room reacts|Grade rerun)$/,
  /is the (top overall pick|first)/,     // ticker facts
  /^(Kickers|Defenses) stay undrafted/,  // ticker facts
  /^\d+ players · refreshed/,            // the shared freshness line
  /^players · refreshed$/,               // the ticker's split version of it
  /^\d+ (hrs?|mins?|days?) ago$/,
];

// Allowlists hold strings and regexes side by side — two of the sanctioned
// differences are generated copy that changes with a toggle.
function permitted(t, allowed) {
  return allowed.some((a) => (a instanceof RegExp ? a.test(t) : a === t));
}


test("the homepage says the same things on a phone as on a desktop", async ({ browser }) => {
  const { text: phone, names } = await homeTextAt(browser, PHONE);
  const { text: desktop } = await homeTextAt(browser, DESKTOP);
  const isData = (t) => permitted(t, DATA_SHAPED) || names.includes(t);

  expect(phone.length, "the phone rendered something").toBeGreaterThan(20);
  expect(desktop.length, "the desktop rendered something").toBeGreaterThan(20);
  expect(names.length, "the board answered, so names are really being excluded").toBeGreaterThan(50);

  // Sets, not sequences. Order genuinely differs — the phone promotes the
  // scoring demo into the top third (review item 35) — and that is a layout
  // decision, not a content one.
  const onPhone = new Set(phone);
  const onDesktop = new Set(desktop);

  const phoneOnly = [...onPhone]
    .filter((t) => !onDesktop.has(t) && !permitted(t, PHONE_ONLY) && !isData(t));
  const desktopOnly = [...onDesktop]
    .filter((t) => !onPhone.has(t) && !permitted(t, DESKTOP_ONLY) && !isData(t));

  expect(phoneOnly, "strings the phone shows and the desktop does not").toEqual([]);
  expect(desktopOnly, "strings the desktop shows and the phone does not").toEqual([]);
});

/* The five sentences the whole page is built on, asserted by value rather than
   by comparison — so a change that removes one from *both* breakpoints still
   fails here instead of passing the diff above by symmetry. */
test("the hero and the closing band carry the agreed copy at both widths", async ({ browser }) => {
  const REQUIRED = [
    /* The slogan reads all-caps on screen, but the caps come from CSS
       text-transform since df2bb85 ("slogan treatment") — the DOM text this
       walker collects is title case. Asserting the rendered casing here is
       what left this test red for a day with no bug behind it. */
    "Agility Through Analytics",
    "Master the draft.",
    "Dominate the season.",
    /* The hero paragraph. It used to be "Draft against a room of CPU
       opponents that react to your picks, then get a graded report that
       shows its working. Change your scoring rules and every number
       reruns." — replaced on direct instruction, and Hero.jsx's own
       comment records why: that sentence named the Draft Room
       specifically, which was right while the Draft Room was the whole
       product and reads narrow next to a page that now frames Juke as a
       season-long platform.

       The list is still asserted by value on purpose (see above): the
       point is that one sentence is read at every width, not which
       sentence it is. Both widths carry this one — checked before
       changing it here. */
    "From pre-season scouting to a championship push, dominate every phase of the fantasy calendar.",
    "FREE · UNLIMITED · NO ACCOUNT",
    "Open the Draft Room.",
    "No setup, no league import. Pick your scoring and start.",
  ];

  for (const [name, opts] of [["phone", PHONE], ["desktop", DESKTOP]]) {
    const { text } = await homeTextAt(browser, opts);
    for (const line of REQUIRED) {
      expect(text, `${name} carries: ${line.slice(0, 40)}`).toContain(line);
    }

    /* One CTA string on the page. There were three that disagreed — "Start a
       mock draft", "Start a mock draft — free", "Start a Free Mock Draft" —
       and the price moved to the mono line above. Any button still selling on
       price is the regression. */
    const ctas = text.filter((t) => /^(Start|Enter)\b/.test(t) && /draft|room/i.test(t));
    expect([...new Set(ctas)], `${name} has exactly one CTA string`).toEqual([
      "Enter the Draft Room",
    ]);
  }
});
