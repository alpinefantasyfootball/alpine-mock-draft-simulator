# Implementation brief — Juke shark logo (Option A)

Swap the goalpost monogram for the shark mark. **The palette does not change.**
Same `#00E5FF` / `#7B1FA2` / `#0B0E14`, same Tailwind config, same
`draftRoomPositions.js`. Nothing in the colour system moves.

Read `juke-logo-README.md` for the component spec. This file is the migration.

Repo: `playjukeff/juke`, branch `main`. Paths below were read from the repo, so
they are real — but re-check them against `main` before you start, in case they
have moved.

---

## Step 1 — The React app (the actual swap)

### 1a. Replace the component
```
web/src/components/juke-logo/JukeLogo.jsx   <- JukeLogo.jsx from this bundle
web/src/components/juke-logo/README.md      <- juke-logo-README.md from this bundle
```

The public API is identical (`variant`, `size`, `mono`, `color`, `className`,
`style`), plus two new optional props (`detail`, `onLight`). **None of the six
call sites need editing:**

| File | Current usage |
|---|---|
| `web/src/components/Header.jsx` | `<JukeLogo size={21} />` |
| `web/src/components/AppHeader.jsx` | imports `{ JukeMark }` |
| `web/src/components/Homepage.jsx` | `<JukeLogo size={18} />` |
| `web/src/components/LobbyBar.jsx` | `<JukeLogo size={19} />` |
| `web/src/components/DraftCockpitHeader.jsx` | `<JukeLogo size={19} />` |
| `web/src/components/DraftRoomStatusBar.jsx` | `<JukeLogo size={18} />` |

`AppHeader.jsx` imports the named `JukeMark` — still exported, same signature.

### 1b. Drop the assets into `web/public/`
Everything in this bundle's `public/` folder. Three of these **overwrite**
existing files with the same names:
```
juke-favicon.svg            OVERWRITES  (was the goalpost, 32 tile)
juke-app-icon-dark.svg      OVERWRITES  (same tile geometry + gradient stops)
juke-app-icon-gradient.svg  OVERWRITES  (same teal->purple tile)
juke-app-icon-{180,192,512,1024}.png  OVERWRITES
```
The rest are new. Keep the old files in git history; do not delete anything in
the same commit that adds the new ones.

### 1c. `web/public/manifest.json`
Replace with this bundle's `manifest.json`. Only change: a fourth entry with
`"purpose": "maskable"`, which Android wants and the old file lacked.
`background_color` and `theme_color` stay `#0B0E14`.

### 1d. `web/index.html`
Currently, around lines 71–77:
```html
<link rel="apple-touch-icon" href="/juke-app-icon-180.png">
<link rel="icon" href="/juke-favicon.svg" type="image/svg+xml">
<link rel="icon" href="/juke-app-icon-192.png" sizes="192x192">
```
Replace the two `rel="icon"` lines with:
```html
<link rel="icon" href="/juke-favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<link rel="icon" href="/favicon-16.png" sizes="16x16">
```
The old `192x192` `rel="icon"` was doing nothing useful for tabs — a 192px PNG
is not a favicon size, and the manifest already declares it. The 16 and 32 PNGs
are the ones browsers actually reach for when the SVG is unavailable.

Also update `og:image:alt` on line 23. It currently reads *"The Juke shield on
navy, above the line: ..."*, which describes a logo two generations old.
Suggested: `"The Juke shark on obsidian, above the line: fantasy football mock
drafts, free and without an account."`

### 1e. Verify the width — at `sm`, not at 375px
The mark's aspect went from 0.96:1 to 1.602:1, so the lockup is about **+10px at
every size**: 81→91px at `size={18}`, 86→96 at 19, 95→105 at 21, 145→160 at 32.

`web/src/components/DraftRoomStatusBar.jsx` has a comment budgeting a 375px row
as `"81 (logo) + 52 (the round text at its floor) + 57 (the clock) + 144 (the
controls) = 334"`. **That comment is stale against its own markup** — the logo
anchor a few lines below it is `className="hidden shrink-0 sm:block"`, so the
logo is not rendered below 640px at all. The aspect change therefore cannot
affect the narrow layout.

Where to actually look:

- **`sm` (640px) in the draft room.** This is where the logo first appears and
  where the bar is tightest. It has roughly 250px of slack, so expect it to pass.
  Render it with all four action icons and the Autopick pill, not a reduced set.
- **`Header.jsx` at `size={21}`.** Sits in a `max-w-7xl` row with `gap-10` and a
  `hidden md:flex` nav, so it only competes for space at 768px and up. Fine.
- **`LobbyBar.jsx` and `DraftCockpitHeader.jsx` at `size={19}`.** Check, no
  expected issue.

If any bar does get tight, in preference order:

1. `<JukeLogo variant="mark" size={18} />` — the shark is a distinct silhouette,
   so mark-only is now permitted (the goalpost's "never alone" rule existed
   because it read as a plain U without its wordmark).
2. `size={17}` in that bar only.
3. Let the round text truncate; it already has shrink rules.

**Also fix the stale comment** in `DraftRoomStatusBar.jsx` while you are there, or
unhide the logo below `sm` if it was meant to be visible. Do not leave a comment
describing arithmetic that its own markup contradicts.

---

## Step 2 — The social card

`og-image.png` in this bundle is a 1200×630 replacement, obsidian gradient tile
with the shark and the wordmark.

- Drop it at the **repo root** (`og-image.png`), which is where
  `web/index.html` line 20 points via the absolute `https://jukeff.com/og-image.png`.
- `scripts/build_og.html` generates that file and **carries its own copy of the
  logo paths**. It will regenerate the old navy shield the next time anyone runs
  it. Either update it to reference `/juke-mark.svg`, or add a comment at the top
  saying the card is now maintained as a static asset. Do not leave it as-is
  silently — that is how the navy generation survived this long.

---

## Step 3 — The stale navy generation (independent of the logo swap)

These serve a **navy shield** while the app serves the goalpost. They have been
wrong for two brand generations, and `CLAUDE.md` around lines 1869–1879 already
flags them as unreachable by the CSS-driven passes.

| File | What to do |
|---|---|
| `favicon-16.png`, `favicon-32.png` (repo root) | Replace with this bundle's. |
| `favicon.ico` (repo root) | **I cannot generate .ico.** Convert `favicon-32.png` + `favicon-16.png` into a multi-size `.ico`. Flag if you can't. |
| `404.html` lines 24–26 | Points at all three root favicons. Works once they are replaced. |
| `docs/privacy.html` 20–22, `docs/terms.html` 16–18, `docs/draft-room-how-it-works.html` 25–27 | Same three, via `../`. Works once replaced. |
| `docs/draft-room-how-it-works.html` line 121 | An inlined SVG commented *"Same mark as the app, traced from the logo artwork"* — it is not the same mark as the app and has not been for two generations. Replace with `<img src="/juke-mark.svg">`. |
| `style.css` `.wordmark`, `--navy #152A49`, `--mark-ink` | The no-build site's own navy lockup. **Out of scope unless asked** — that site is a separate artefact with its own palette. Raise it, do not change it. |

**Recommended sequencing:** ship Step 1 first and verify, then Step 2, then
Step 3. Step 3 is a consolidation job and is the cheapest brand work available —
but bundling it with the mark swap makes the diff hard to review.

---

## Do not

- **Do not change any colour token.** That was the whole point of choosing this
  option. `tailwind.config.js`, `index.css` and `draftRoomPositions.js` are
  untouched.
- **Do not recolour or re-export the SVGs.** Every variant that exists is in the
  bundle. If one seems missing, it is deliberately not permitted — ask.
- **Do not inline the shark's path data** into a component. It is roughly 24KB.
  The component uses `<img>` for colour variants and a CSS mask for `mono`,
  specifically to keep it out of the bundle.
- **Do not stretch the mark.** 564:352, always derive height from width.
- **Do not use `juke-mark-detail.svg` below 120px.** The shading is invisible and
  it is a wasted request.
- **Do not delete the goalpost files in the same commit** that adds the shark.
  Two commits: add, verify, then remove.

---

## Step 4 — Verify

- [ ] All six call sites render; no import errors
- [ ] Header at 1440, 768 and 640px — **640px** is where the logo first appears in the draft room
- [ ] The stale 375px comment in `DraftRoomStatusBar.jsx` is corrected or the logo is unhidden
- [ ] Mark swaps to the silhouette below 28px (shrink a container and watch)
- [ ] `mono` inherits `currentColor` (the CSS-mask path, not the `<img>` path)
- [ ] Favicon at 16px in a real tab — it is a small shape; confirm it is acceptable
- [ ] `manifest.json` validates; maskable icon shows no clipping in Chrome devtools
- [ ] `og:image` scrapes correctly (use a card validator, not a local file)
- [ ] Root favicons replaced; 404 and all three `docs/` pages show the new mark
- [ ] `grep -r "juke-app-icon-dark.png"` — the old component README referenced a
      `.png` that does not exist in the repo. Confirm nothing else does.
- [ ] No colour token changed: `git diff web/tailwind.config.js` is empty

---

## Known gaps — raise, don't invent

1. **`favicon.ico`** — needs an .ico encoder. Not in this bundle.
2. **A purpose-drawn 16px mark.** The silhouette scaled to 16px is a small wide
   shape. It is legible but not strong. A hand-fitted micro mark is a drawing
   task for an illustrator, not a scaling problem.
3. **The shark artwork itself still needs a symmetry pass.** The supplied
   pectoral groups sit at `-38.16` and `40.88` with different sweep lengths, and
   there is a two-point sliver path near the right gill. Cosmetic at header
   sizes, visible on merch. Illustrator work.
4. **iOS native app icon.** `juke-app-icon-dark.svg` is the source, but the App
   Store wants its own size set and `DESIGN-DIRECTION.md` already treats iOS as a
   separate project. Do not generate that set speculatively.
