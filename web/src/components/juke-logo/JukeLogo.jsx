// Juke logo — shark mark + Archivo 900 wordmark
//
// Drop-in replacement for the goalpost version. The public API is unchanged,
// so none of the six existing call sites need editing:
//
//   <JukeLogo />                        horizontal lockup, 21px wordmark
//   <JukeLogo size={32} />              larger lockup
//   <JukeLogo variant="mark" />         mark only
//   <JukeLogo variant="stacked" />      mark above wordmark
//   <JukeLogo mono />                   single-colour mark (inherits currentColor)
//
// Two things did change, and both are deliberate:
//
//   1. The mark's aspect ratio went from 54:56 (0.96:1) to 564:352 (1.602:1).
//      The shark is wide. markWidth is now size * 1.7 rather than size * 1.15,
//      which makes the lockup roughly 12px wider at size=21. See the note in
//      DraftRoomStatusBar below.
//
//   2. Below 28px the mark automatically drops to the silhouette. The
//      three-value face does not survive smaller than that, and silently
//      rendering mush was the failure mode of the artwork this replaces.
//
// Colours come from the existing palette — no new tokens.
//   teal      #00E5FF   linework
//   obsidian  #0B0E14   negative shapes (eyes, teeth, jaw)
//   foreground #F2F5FA  wordmark

import React from "react";

const FOREGROUND = "#F2F5FA";

// Assets live in web/public, same as the icons already there.
const MARK = "/juke-mark.svg";                       // two-value, the default
const MARK_DETAIL = "/juke-mark-detail.svg";         // adds shading, >= 120px only
const MARK_FG = "/juke-mark-fg.svg";                 // white linework, for gradient/photo chrome
const MARK_LIGHT = "/juke-mark-light.svg";           // for light grounds
const SILHOUETTE = "/juke-mark-mono.svg";            // one shape, used as a CSS mask

const ASPECT = 564 / 352;          // 1.602 — do not stretch
const SILHOUETTE_BELOW = 28;       // px of mark width
const DETAIL_ABOVE = 120;
const MIN_WIDTH = 12;

export function JukeMark({
  width = 36,
  mono = false,
  detail = false,
  onLight = false,
  className = "",
  style,
}) {
  const height = width / ASPECT;

  if (width < MIN_WIDTH) return null;

  // mono: a single shape filled with currentColor. Masking rather than an
  // inline <svg> keeps ~24KB of path data out of the bundle while still
  // inheriting colour, which an <img> cannot do.
  if (mono || width < SILHOUETTE_BELOW) {
    return (
      <span
        aria-label="Juke"
        role="img"
        className={className}
        style={{
          display: "inline-block",
          width,
          height,
          backgroundColor: "currentColor",
          WebkitMaskImage: `url(${SILHOUETTE})`,
          maskImage: `url(${SILHOUETTE})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          ...style,
        }}
      />
    );
  }

  const src = onLight ? MARK_LIGHT : detail && width >= DETAIL_ABOVE ? MARK_DETAIL : MARK;

  return (
    <img
      src={src}
      alt="Juke"
      width={width}
      height={height}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}

export function JukeWordmark({ size = 21, color = FOREGROUND, className = "", style }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "'Archivo', sans-serif",
        fontWeight: 900,
        fontSize: size,
        lineHeight: 0.9,
        letterSpacing: "-0.045em",
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      Juke
    </span>
  );
}

export default function JukeLogo({
  variant = "lockup",
  size = 21,
  mono = false,
  detail = false,
  onLight = false,
  color = FOREGROUND,
  className = "",
  style,
}) {
  // 1.7 rather than the goalpost's 1.15: the shark is a wide mark, and this
  // is the ratio that puts its visual mass level with the wordmark's cap
  // height. Verified at sizes 18, 19, 21 and 32.
  const markWidth = Math.round(size * 1.7);

  if (variant === "mark") {
    return (
      <JukeMark
        width={markWidth}
        mono={mono}
        detail={detail}
        onLight={onLight}
        className={className}
        style={style}
      />
    );
  }

  if (variant === "stacked") {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: size * 0.34,
          ...style,
        }}
      >
        <JukeMark width={Math.round(size * 2.4)} mono={mono} detail={detail} onLight={onLight} />
        <JukeWordmark size={size} color={color} />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.42, ...style }}
    >
      <JukeMark width={markWidth} mono={mono} detail={detail} onLight={onLight} />
      <JukeWordmark size={size} color={color} />
    </span>
  );
}
