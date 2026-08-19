# Juke logo — handoff (option 6a: goalpost mark + heavy wordmark)

## Files

| File | Use |
| --- | --- |
| `JukeLogo.jsx` | React component — lockup, mark-only, stacked, mono. Primary integration point. |
| `juke-mark.svg` | Two-colour mark (teal uprights + crossbar, purple stem). |
| `juke-mark-mono.svg` | Single-colour mark, fills with `currentColor`. |
| `juke-app-icon-dark.svg` | 1024×1024 launcher icon, dark tile. Primary app icon. |
| `juke-app-icon-gradient.svg` | 1024×1024 alternate, teal→purple tile with obsidian mark. |
| `juke-favicon.svg` | 32×32 favicon with the tile built in. |

## Font

The wordmark is **Archivo 900**, uppercase, `letter-spacing: -0.045em`.

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400..900&display=swap" rel="stylesheet">
```

Or via npm: `@fontsource/archivo` (import weight 900).

## Colours

Already in the palette — no new tokens needed.

```
teal      #00E5FF   uprights + crossbar
purple    #7B1FA2   stem
foreground #F2F5FA  wordmark
obsidian  #0B0E14   mark colour when it sits on a teal/gradient fill
```

## Integration

Header (desktop and mobile — same lockup, smaller size):

```jsx
import JukeLogo from "@/components/juke-logo/JukeLogo";

// desktop header
<a href="/" aria-label="Juke home"><JukeLogo size={21} /></a>

// mobile header
<a href="/" aria-label="Juke home"><JukeLogo size={19} /></a>
```

Head tags:

```html
<link rel="icon" href="/juke-favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/juke-app-icon-dark.png">
```

Export the 1024 SVGs to PNG at 1024, 512, 192, 180 for the manifest and Apple touch icon.

## Rules

- **Minimum mark width is 20px.** Below that the stem thins out and the mark reads as a plain U.
- **The mark does not stand alone in the header.** Use the full lockup in the header and nav; mark-only is for favicons, avatars, and the app tile.
- Clear space around the lockup: at least the width of one upright bar (mark width ÷ 7.7).
- On a teal or gradient fill, use the mono mark in obsidian (`<JukeMark mono style={{ color: "#0B0E14" }} />`), never teal-on-teal.
- Do not add a stroke, outline, or drop shadow to the mark. Depth comes from the panel behind it, not the mark.
- Do not stretch: the mark is fixed at 54:56.
