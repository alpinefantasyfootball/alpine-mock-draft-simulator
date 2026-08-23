# Handoff: Juke shark logo — Option A

## Overview
Replaces the goalpost monogram with the shark mark, **in the existing product
palette**. Chosen from three options after measuring both palettes: the product
teal (`#00E5FF`) and the shark's aqua (`#84E4E4`) are the same hue — 186° and
180° — differing only in saturation. So the shark rendered in `#00E5FF` is not a
compromise, it is the shark at full saturation in its own hue.

**Nothing in the colour system changes.** No token edits, no contrast
re-derivations, no change to the six position hues.

## About the files in this bundle
- `JukeLogo.jsx` and everything in `public/` are **production files.** Use them
  directly. Drop-in, same API.
- The `.dc.html` files are **design references** — the exploration and the
  rationale, including the options not chosen. Not code to copy.

## Fidelity
**High-fidelity.** Colours, ratios, minimum sizes and the swap thresholds are
final and are enforced inside the component.

## Start here
0. `PROMPT.md` — paste this into Claude Code to kick the work off.
1. `IMPLEMENTATION.md` — the migration, with real repo paths and the one layout risk.
2. `juke-logo-README.md` — the component spec. This replaces
   `web/src/components/juke-logo/README.md`.

## What is in the bundle

```
PROMPT.md                 the prompt to paste into Claude Code
JukeLogo.jsx              drop-in replacement component
juke-logo-README.md       replaces the component's own README
manifest.json             replaces web/public/manifest.json (adds a maskable icon)
IMPLEMENTATION.md         the migration brief
public/
  juke-mark.svg                        DEFAULT — two-value, teal on obsidian
  juke-mark-detail.svg                 shading, 120px+ only
  juke-mark-fg.svg                     white linework
  juke-mark-light.svg                  for light grounds
  juke-mark-mono.svg                   single shape, used as a CSS mask
  juke-mark-silhouette-{teal,obsidian,fg}.svg
  juke-favicon.svg                     32 tile, two-value
  juke-favicon-16.svg                  16 tile, silhouette
  juke-app-icon-dark.svg               1024 launcher, dark tile
  juke-app-icon-gradient.svg           1024 alternate, teal->purple tile
  juke-app-icon-maskable.svg           1024, 80% safe area
  juke-app-icon-{180,192,512,1024}.png
  juke-app-icon-maskable-512.png
  favicon-{16,32,48}.png
  og-image.png                         1200x630 social card
design-reference/         the exploration boards (.dc.html) + support.js
source/                   the original supplied vector art
```

## Colour — unchanged

| Token | Hex | Role in the mark |
|---|---|---|
| `teal` | `#00E5FF` | All linework |
| `obsidian` | `#0B0E14` | Negative shapes — eyes, teeth, jaw |
| `foreground` | `#F2F5FA` | Wordmark |
| `purple` | `#7B1FA2` | The gradient tile only. Not in the default mark. |

The one structural note: in the supplied artwork the eyes, teeth and jaw were
filled with the *canvas* colour, so the mark only worked on one background. Every
file here declares its negative value explicitly, which is why there is a
`-light` and an `-fg` variant rather than one file you recolour.

## Typography — unchanged
**Archivo 900**, uppercase, `letter-spacing: -0.045em`, already requested in
`web/index.html`. The wordmark is not a typeface — do not set headings in it.
Display type stays Barlow Condensed, body stays Inter, numerics stay IBM Plex
Mono, exactly as `tailwind.config.js` has them.

## Reduction ladder — enforced in the component

| Mark width | Renders |
|---|---|
| ≥ 120px | `juke-mark-detail.svg` if `detail` is passed, else `juke-mark.svg` |
| 28–120px | `juke-mark.svg` — two-value |
| 12–28px | Silhouette, automatically |
| < 12px | Nothing |

## The one layout note
The mark's aspect went from 0.96:1 (goalpost) to 1.602:1 (shark), so the lockup
is about **10px wider at every size**: 81→91px at `size={18}`, 86→96 at 19,
95→105 at 21, 145→160 at 32. The gap ratio was tightened from 0.48 to 0.42 to
claw some of it back.

This does **not** put the narrow layout at risk. `DraftRoomStatusBar.jsx` has a
comment budgeting `"81 (logo)"` at 375px, but its logo anchor carries
`hidden shrink-0 sm:block` — below 640px the logo is not rendered at all, so that
comment is stale against its own markup. The +10px only lands at `sm` and up,
where the bar has roughly 250px of slack. `IMPLEMENTATION.md` step 1e has the
check.

## Known gaps
Four, all listed at the end of `IMPLEMENTATION.md`: `favicon.ico` needs an .ico
encoder; a purpose-drawn 16px mark is an illustration task; the artwork wants a
symmetry pass; iOS native icons are a separate project.
