/* Every typeface the share card draws with is one the page actually makes
   available — which is two files now, not one.

   shareCard.js draws to a canvas, and a canvas falls back silently: ask for a
   family the document never requested and you get the browser's default sans,
   a finished-looking PNG, and no error anywhere. That is what shipped for
   months — the file asked for Poppins, the rebrand stopped requesting Poppins
   in web/index.html, and nothing connected the two.

   Its own guard could not catch it either. document.fonts.check() reports
   whether the faces that *would* be used are loaded, and a family with no
   @font-face rule has nothing to load, so it returns true for any name at all.
   Measured on the live page: it passed for a family invented on the spot.
   shareCard.js measures a probe string now instead.

   This is the static half of that, and static is the point. The first version
   drove a real page and measured glyph widths, which is a stronger claim and
   the wrong test: document.fonts.load() rejects if any subset request fails, so
   it went red on Google's CDN rather than on our code, and a suite that fails
   when nothing is broken stops being read. The defect here was never a font
   failing to arrive. It was two files disagreeing about which font to ask for,
   and two files are exactly what this compares.

   Neither list is written down here. A list would be the same fact a third
   time, stale in the direction that caused the bug — somebody changes the face
   in the source and the test goes on checking the old one, green. */

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/* Families named in a `ctx.font = '... "Family", sans-serif'` assignment, and
   only those inside drawShareCard(). Deliberately not the
   document.fonts.load() calls: a face can be preloaded and never drawn with,
   and it is the drawing that decides what the PNG looks like.

   The slice is load-bearing rather than tidiness. faceIsReal() sits above
   drawShareCard() and sets ctx.font twice on purpose — once to a template hole
   and once to a family invented to be missing — so parsing the whole file
   collects `${family}` and `ZzNoSuchFaceXYZ` as things the card draws with and
   fails demanding index.html request them. It did exactly that on the first
   run. */
function familiesDrawnWith(src) {
  const from = src.indexOf("function drawShareCard");
  if (from < 0) return [];
  const found = new Set();
  for (const m of src.slice(from).matchAll(/ctx\.font\s*=\s*[`'"][^`'"]*?"([^"]+)"/g)) {
    found.add(m[1]);
  }
  return [...found].sort();
}

/* Families in the Google Fonts href. `family=Archivo:wght@400..900` and
   `&family=Inter:wght@400;500` — the name runs to the colon or the ampersand,
   and `+` is the space it encodes. */
function familiesFromFontLink(html) {
  const found = new Set();
  for (const m of html.matchAll(/[?&]family=([^:&"]+)/g)) found.add(m[1].replace(/\+/g, " "));
  return [...found].sort();
}

/* Families the page serves itself, declared as @font-face in index.css.

   This half did not exist when the file was written, and its absence is
   what made the test go red on a page that was working perfectly. The
   "homepage v4 pass 1" change moved Archivo and IBM Plex Mono off Google
   Fonts and onto this origin — preloaded in index.html, given their
   @font-face rules in index.css — precisely so the two faces that matter
   above the fold stop costing a third-party round trip. index.css's own
   comment names the share card as one of the reasons.

   So Archivo went on being available and stopped being *requested* in the
   one place this test knew to look. Checked on the live page before
   changing anything here: shareCard.js's own usable() probe returns true
   for Archivo, Inter and Barlow Condensed alike. The card was never
   drawing in a fallback.

   The lesson is the one the header already states from the other side —
   a list written down goes stale in the direction that caused the bug.
   This test held no list, and still went stale, because it hard-coded
   *where* fonts come from rather than which ones. */
function familiesFromFontFace(css) {
  const found = new Set();
  for (const m of css.matchAll(/@font-face\s*\{[^}]*?font-family:\s*['"]([^'"]+)['"]/g)) {
    found.add(m[1]);
  }
  return [...found].sort();
}

test("the share card only draws in faces the page requests", () => {
  const drawn = familiesDrawnWith(read("../web/src/shareCard.js"));
  const linked = familiesFromFontLink(read("../web/index.html"));
  const selfHosted = familiesFromFontFace(read("../web/src/index.css"));
  const available = [...new Set([...linked, ...selfHosted])].sort();

  /* Every parser has to be shown to have found something. If any of them
     silently stops matching — a quote style changes, the font link is
     restructured, the @font-face rules move to another stylesheet — the
     comparison below passes against nothing at all, which is the failure mode
     this whole file exists because of. Three now, because a face can arrive
     by either route and missing one route is what went wrong here. */
  expect(drawn, "no ctx.font families parsed out of shareCard.js").not.toEqual([]);
  expect(linked, "no families parsed out of index.html's font link").not.toEqual([]);
  expect(selfHosted, "no @font-face families parsed out of index.css").not.toEqual([]);

  for (const family of drawn) {
    expect(
      available,
      family +
        " is drawn by shareCard.js but the page neither links it from Google " +
        "Fonts (web/index.html) nor serves it itself (@font-face in " +
        "web/src/index.css), so the card renders in the browser's default " +
        "sans and says nothing about it",
    ).toContain(family);
  }
});
