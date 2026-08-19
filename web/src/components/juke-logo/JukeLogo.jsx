// Juke logo — mark + wordmark lockup (option 6a)
// Requires the Archivo font (weight 900). See README.md.
//
//   <JukeLogo />                        horizontal lockup, 21px wordmark
//   <JukeLogo size={32} />              larger lockup
//   <JukeLogo variant="mark" />         mark only (min 20px wide)
//   <JukeLogo variant="stacked" />      mark above wordmark
//   <JukeLogo mono />                   single-colour mark (inherits currentColor)

import React from "react";

const TEAL = "#00E5FF";
const PURPLE = "#7B1FA2";
const FOREGROUND = "#F2F5FA";

export function JukeMark({ width = 24, mono = false, className = "", style }) {
  const top = mono ? "currentColor" : TEAL;
  const stem = mono ? "currentColor" : PURPLE;
  return (
    <svg
      viewBox="0 0 54 56"
      width={width}
      height={(width * 56) / 54}
      className={className}
      style={style}
      role="img"
      aria-label="Juke"
    >
      <rect x="0" y="0" width="7" height="30" fill={top} />
      <rect x="47" y="0" width="7" height="30" fill={top} />
      <rect x="0" y="30" width="54" height="7" fill={top} />
      <rect x="23.5" y="37" width="7" height="19" fill={stem} />
    </svg>
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
  color = FOREGROUND,
  className = "",
  style,
}) {
  // Mark height tracks the wordmark cap height: markWidth ≈ wordmark size * 1.15
  const markWidth = Math.round(size * 1.15);

  if (variant === "mark") {
    return <JukeMark width={Math.max(markWidth, 20)} mono={mono} className={className} style={style} />;
  }

  if (variant === "stacked") {
    return (
      <span
        className={className}
        style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: size * 0.3, ...style }}
      >
        <JukeMark width={markWidth} mono={mono} />
        <JukeWordmark size={size} color={color} />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.48, ...style }}
    >
      <JukeMark width={markWidth} mono={mono} />
      <JukeWordmark size={size} color={color} />
    </span>
  );
}
