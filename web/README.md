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

- `src/components/Homepage.jsx` — composes the page: `Header`,
  `LiveScoresTicker`, `ResumeBanner`, `Hero`, `RoomNavigation`,
  `ShowYourWorking`.
- `src/components/Header.jsx` / `Ticker.jsx` — the fixed nav bar and its
  small marquee of facts, read live off the board via the bridge.
- `src/components/LiveScoresTicker.jsx` — real ESPN scores via
  `JukeEngine.fetchScores()`. Renders nothing when there are none, matching
  the legacy score strip's own contract.
- `src/components/Hero.jsx` — the "Live board" preview, drafted live via
  `JukeEngine.shotPicks()`.
- `src/components/RoomNavigation.jsx` / `RoomCard.jsx` — the 3D carousel,
  reading the real six-room list from `JukeEngine.rooms()`.
- `src/components/ShowYourWorking.jsx` — the live PPR re-ranking demo,
  scored through `JukeEngine.pointsUnder()` under the real scoring rules.
- `src/components/ResumeBanner.jsx` — the "you have a draft in progress"
  banner, backed by `JukeEngine.readSave()`.
- `tailwind.config.js` — the obsidian/charcoal/teal/purple palette and the
  glow shadows used on hover.
