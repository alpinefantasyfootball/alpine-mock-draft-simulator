# Juke logo — shark mark + Archivo 900 wordmark

Replaces the goalpost monogram ("option 6a"). Same component API, same palette,
no new tokens.

## Files

| File | Use |
| --- | --- |
| `JukeLogo.jsx` | React component — lockup, mark, stacked, mono. Primary integration point. |
| `public/juke-mark.svg` | **Default.** Two-value: teal linework, obsidian negatives. |
| `public/juke-mark-detail.svg` | Adds shading with a purple cast. **120px and up only.** |
| `public/juke-mark-fg.svg` | White linework, for gradient fills, photography, video. |
| `public/juke-mark-light.svg` | For light grounds (`#F5F7FA` and up). |
| `public/juke-mark-mono.svg` | Single shape. Used as a CSS mask so it inherits `currentColor`. |
| `public/juke-mark-silhouette-{teal,obsidian,fg}.svg` | Pre-coloured silhouettes for non-React use. |
| `public/juke-favicon.svg` | 32×32, tile built in, two-value mark. |
| `public/juke-favicon-16.svg` | 16×16, silhouette only. |
| `public/juke-app-icon-dark.svg` | 1024×1024 launcher, dark tile. Primary app icon. |
| `public/juke-app-icon-gradient.svg` | 1024×1024 alternate, teal→purple tile, obsidian mark. |
| `public/juke-app-icon-maskable.svg` | 1024×1024, 80% safe area, for Android maskable. |
| `public/*.png` | Rendered 180 / 192 / 512 / 1024, favicons 16 / 32 / 48, `og-image.png`. |

## Font

Unchanged. **Archivo 900**, uppercase, `letter-spacing: -0.045em` — already
requested in `web/index.html`.

## Colours

Already in the palette — no new tokens needed.

```
teal       #00E5FF   linework
obsidian   #0B0E14   negative shapes (eyes, teeth, jaw)
foreground #F2F5FA   wordmark
purple     #7B1FA2   the gradient tile only; not in the default mark
```

## Integration

No call-site changes. These already work:

```jsx
import JukeLogo from "@/components/juke-logo/JukeLogo";

<a href="#/" aria-label="Juke home"><JukeLogo size={21} /></a>   // desktop header
<a href="#/" aria-label="Juke home"><JukeLogo size={19} /></a>   // lobby, cockpit
<JukeLogo size={18} />                                           // status bar, homepage
```

Head tags:

```html
<link rel="icon" href="/juke-favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/juke-app-icon-180.png">
```

`favicon.ico` was the one gap this handoff could not fill, and it is not a
drawing task: an .ico is a directory header wrapped around image payloads, and
since Vista a payload may be a PNG verbatim. `scripts/build_favicon_ico.py`
assembles it from the exact bytes of `favicon-{16,32,48}.png` sitting beside it,
so it cannot drift from them. Re-render those three and run it again; nothing
in it re-traces artwork.

**These files live in `web/public/`, and that is load-bearing rather than
tidiness.** Cloudflare Pages builds from `web/` with `dist` as its output, so
the repository root is not served — `og-image.png` and the root favicons had
been 404ing in production for exactly that reason before this swap, while a
stale Cloudflare edge entry went on answering the un-queried URL and made them
look fine. Anything a page names with a leading `/` has to be under
`web/public/` or in `copy-legacy-assets.mjs`'s list.

## Rules

- **Minimum mark width is 28px for the face, 12px for the silhouette.** The
  component enforces both: below 28px it swaps to the silhouette automatically,
  below 12px it renders nothing rather than a smudge.
- **`detail` only above 120px.** The shading is invisible below that and only
  costs a request.
- **Do not stretch.** The mark is fixed at 564:352. The component always derives
  height from width.
- **On a teal or gradient fill, use `mono` in obsidian** —
  `<JukeMark mono style={{ color: "#0B0E14" }} />` — never teal on teal. Same
  rule as the goalpost had.
- **The mark can now stand alone.** This is the one rule that changed: the
  goalpost read as a plain U without its wordmark, so mark-only was restricted
  to favicons and tiles. The shark is a distinct silhouette, so
  `variant="mark"` is legitimate in avatars, tight bars and badges.
- Clear space: one fin height on all sides.
- No stroke, outline or drop shadow on the mark. Depth comes from the panel
  behind it.

## The one layout note

The goalpost was 0.96:1. The shark is 1.602:1. Measured lockup widths, old → new:

| `size` | Used by | Before | After |
|---|---|---|---|
| 18 | DraftRoomStatusBar, Homepage | 81px | 91px |
| 19 | LobbyBar, DraftCockpitHeader | 86px | 96px |
| 21 | Header | 95px | 105px |
| 32 | marketing | 145px | 160px |

About +10px, consistently. `markWidth` went from `size * 1.15` to `size * 1.7`;
the lockup gap was tightened from `size * 0.48` to `size * 0.42` to offset part
of it.

**This is not a narrow-viewport risk.** `DraftRoomStatusBar.jsx` carries a
comment budgeting a 375px row as `"81 (logo) + 52 (the round text at its floor)
+ 57 (the clock) + 144 (the controls) = 334"`, but the logo anchor in that same
file is `className="hidden shrink-0 sm:block"` — the logo is not rendered below
640px. That comment is stale against its own markup, and the arithmetic it
describes has not applied since the anchor was hidden.

So the +10px lands only at `sm` and up, where that bar has roughly 250px of
slack. Verify it, but expect it to pass. If it ever does get tight, the fix in
preference order:

1. `<JukeLogo variant="mark" size={18} />` — the shark is a distinct silhouette,
   so mark-only is now permitted. The goalpost's "never alone in the header" rule
   existed because it read as a plain U without its wordmark.
2. `size={17}` in that bar only.
3. Let the round text truncate; it already has the shrink rules for it.

Worth fixing while you are in there: correct that stale comment, or unhide the
logo below `sm` if it was meant to be visible.
