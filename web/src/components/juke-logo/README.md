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
| 18 | Homepage footer | 81px | 90px |
| 19 | LobbyBar, DraftCockpitHeader | 86px | 95px |
| 21 | Header | 95px | 105px |
| 32 | marketing | 145px | 160px |

`AppHeader` is the fifth, and it asks for a `width` rather than a `size`: 28,
which is the floor for the two-value face. Anything under it renders the
`currentColor` silhouette instead, whether or not `mono` was asked for.

About +10px, consistently. `markWidth` went from `size * 1.15` to `size * 1.7`;
the lockup gap was tightened from `size * 0.48` to `size * 0.42` to offset part
of it.

**It lands only at `sm` and up.** Every bar that carries the logo in the draft
room hides it below 640px (`hidden shrink-0 sm:block`), so the wider lockup
cannot reach a phone layout at all.

**Where it does land, `DraftCockpitHeader.jsx` has no slack, and the mark is not
why.** Measured at 640px with a draft running and the clock mine, the controls
block ends at these positions against a 640px bar:

| | right edge |
|---|---|
| no logo at all | 616 — fits |
| goalpost lockup (mark 22px) | 675 — 35px over |
| shark lockup (mark 32px) | 685 — 45px over |
| shark, `variant="mark"` | 622 — fits |

So that bar was already clipping its own controls before this mark existed, and
the shark adds 10px to 35. At 768px the `md:flex` tab nav joins in and the bar
needs **941px** before it stops clipping — 95px of that 173px deficit is the
lockup, and no logo change closes the rest.

`variant="mark"` below `md` is the fix for `sm` and it is now permitted: the
shark is a distinct silhouette, where the goalpost read as a plain U without its
wordmark and so was never allowed to stand alone. `md` needs a real answer about
what that bar drops, which is a layout decision rather than a logo one.

**Do not measure this on `DraftRoomStatusBar.jsx`.** It was the file the handoff
named, and nothing had imported it since `DraftCockpitHeader.jsx` took over both
of its call sites — its own 375px comment budgeted `81 (logo)` against markup
that had been hiding the logo since well before. It has been deleted. Check what
actually renders before measuring it.
