# web/ — the homepage build

The React/Vite/Tailwind build for `jukeff.com`'s homepage. Not a prototype —
this is what Cloudflare Pages deploys, once the dashboard's Root directory
points here (see `CLAUDE.md`'s Stack section for the full story, including
why the root `index.html` still exists as a fallback for now).

The rest of the repository — `app.js`, `draft-engine.js`, `style.css`, the
worker — is still plain HTML/CSS/JS with no build step of its own, and stays
that way. This folder is the one deliberate exception, scoped to the
homepage. `window.JukeEngine`, set at the end of `app.js`'s boot sequence, is
the only channel between the two: real board/league/room data exposed to
React rather than reimplemented a second time.

## Run it

```bash
cd web
npm install
npm run dev
```

`vite dev` serves `app.js` and the other legacy files from the true repo
root via a dev-server middleware in `vite.config.js`, off the same file list
`scripts/copy-legacy-assets.mjs` uses for the real build — so
`window.JukeEngine` carries real data locally, not just after a full build.

## Build it

```bash
npm run build
```

Runs `vite build`, then `copy-legacy-assets.mjs`, which copies the legacy
files (and `_headers`, and `docs/`) into `dist/` alongside Vite's own
output — one complete site in one output directory, matching what a
Cloudflare Pages deploy produces.

## Structure

- `src/components/Homepage.jsx` — composes the page: `Header`, `Hero`,
  `ShowYourWorking`, `RoomsGrid`, `ClosingCta`, plus its own footer.
- `src/components/Header.jsx` / `Ticker.jsx` — the sticky two-row header
  (nav + logo, then a small marquee of facts read live off the board via
  the bridge).
- `src/components/Hero.jsx` / `ScoringDemoCard.jsx` — the headline, and the
  live PPR re-ranking demo beside it (standard/half/full PPR, scored
  through `JukeEngine.pointsUnder()` under the real scoring rules). Used to
  be a static, non-interactive board preview here with the real demo
  further down the page; a design review flagged the one genuinely
  interactive proof on the page as buried below a full scroll, so it moved
  up and `ShowYourWorking.jsx` no longer carries a second copy of it.
- `src/components/ShowYourWorking.jsx` — the three "why" cards underneath
  the demo's own claim: live rescoring, points above replacement, nightly
  refresh.
- `src/components/RoomsGrid.jsx` / `RoomCard.jsx` — the six-room grid,
  reading the real room list from `JukeEngine.rooms()`. Non-live cards open
  `ComingSoonModal.jsx`.
- `src/components/ClosingCta.jsx` — the page's last call to action, before
  the footer.
- `tailwind.config.js` — the obsidian/charcoal/teal/purple palette shared
  with the rest of the app, plus the homepage-only mint/skyblue/void
  accents and the `font-plex` (IBM Plex Mono) token from the Claude Design
  v2 homepage handoff.

`src/components/ResumeBanner.jsx` doesn't exist any more — resuming a saved
draft is the Draft Room's own Locker screen's job now (see `CLAUDE.md`),
not a second surface on the homepage.
