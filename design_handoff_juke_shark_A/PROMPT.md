# Prompt for Claude Code

Copy everything below the line into Claude Code, from the repo root, with the
handoff folder unzipped somewhere it can read (e.g. `./design_handoff_juke_shark_A/`).

---

We are replacing the Juke logo. The goalpost monogram goes; a shark mark takes
its place. **The colour palette does not change** — this was chosen specifically
because it needs no token edits.

Everything you need is in `./design_handoff_juke_shark_A/`. Read these three
first, in this order:

1. `README.md` — what the decision was and why
2. `IMPLEMENTATION.md` — the migration, with real paths from this repo
3. `juke-logo-README.md` — the component spec

## Hard constraints

- **Do not change any colour token.** `web/tailwind.config.js`,
  `web/src/index.css` and `web/src/components/draftRoomPositions.js` must come out
  of this with an empty diff. If you think one needs to change, stop and ask.
- **Do not recolour, re-trace or re-export the SVGs.** Every permitted variant is
  in `design_handoff_juke_shark_A/public/`. If one seems missing, it is
  deliberately not permitted — ask.
- **Do not inline the shark's path data** into a component. It is ~24KB. The
  supplied component uses `<img>` for colour variants and a CSS mask for `mono`
  precisely to keep it out of the bundle. Keep that approach.
- **Do not stretch the mark.** It is fixed at 564:352. Always derive height from
  width.
- **Two commits minimum.** Add the new files and verify before deleting any
  goalpost files. Do not do both in one commit.
- **Do not touch `style.css`, `app.js` or the no-build site's own navy lockup**
  unless I ask. That is a separate artefact with its own palette. Raise it, don't
  change it.

## What to do

**Step 1 — the React app.**
Replace `web/src/components/juke-logo/JukeLogo.jsx` and its `README.md` with the
versions in the bundle. The public API is unchanged (`variant`, `size`, `mono`,
`color`, `className`, `style`, plus two new optional props `detail` and
`onLight`), so **none of the six call sites should need editing** — Header,
AppHeader, Homepage, LobbyBar, DraftCockpitHeader, DraftRoomStatusBar. Confirm
that's true rather than assuming it.

Copy `design_handoff_juke_shark_A/public/*` into `web/public/`. Several files
overwrite existing ones by the same name — that's intended. Replace
`web/public/manifest.json` with the bundle's (only change: a fourth entry with
`"purpose": "maskable"`).

Update the favicon links in `web/index.html`, and fix `og:image:alt` on line 23 —
it currently describes "the Juke shield on navy", which is a logo two generations
old.

**Step 2 — the social card.** `og-image.png` goes at the repo root.
`scripts/build_og.html` carries its own copy of the old logo paths and will
regenerate the navy shield next time anyone runs it. Fix it or comment it clearly.

**Step 3 — the stale navy generation.** The root `favicon-16.png`,
`favicon-32.png`, `favicon.ico` and `og-image.png` still serve a navy shield
while the app serves the goalpost. `404.html` and all three `docs/*.html` pages
point at them. `docs/draft-room-how-it-works.html` line 121 has an inlined SVG
commented "Same mark as the app" that hasn't been for two generations.
`IMPLEMENTATION.md` step 3 has the table. Ship this as its own commit after
steps 1 and 2 are verified.

## Verification

Work through the checklist at the end of `IMPLEMENTATION.md`. The two items I
care most about:

- **Width at `sm` (640px) in the draft room.** The mark got about 10px wider at
  every size. Note that `DraftRoomStatusBar.jsx` has a comment budgeting 375px
  that is stale — its own logo anchor is `hidden shrink-0 sm:block`, so the logo
  isn't rendered below 640px. Check 640px, not 375px, and correct that comment
  while you're in the file.
- **`git diff web/tailwind.config.js` is empty.**

## Ask me, don't invent

1. `favicon.ico` — needs an .ico encoder. The 16/32/48 PNGs are in the bundle to
   build from. Tell me if you can't.
2. iOS native app icons — `DESIGN-DIRECTION.md` treats iOS as a separate project.
   Don't generate that size set speculatively.
3. Any conflict between the bundle and what's actually on `main` — the paths were
   read from the repo but may have moved.
4. Anything that seems to require a colour change. There shouldn't be one.

Start by reading the three docs and the six call sites, then give me your plan
before you edit anything.
