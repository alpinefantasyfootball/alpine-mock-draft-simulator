// Sonar - the Juke loader.
//
// The mark fades in once and holds. The rings loop underneath it forever. That
// split is the whole design: a finite entrance plus an infinite ambient loop
// absorbs a 200ms wait and a four-second wait with the same asset, no branching
// and no progress fiction. Do not loop the mark's entrance - a logo that
// re-blurs every two seconds reads as a rendering bug.
//
// Three tiers, and the only thing that changes between them is base size:
//
//   <SonarLoader tier="screen" />                            brand only
//   <SonarLoader tier="panel" label="SETTING UP YOUR BOARD" />
//   <SonarPulse />                        below 80px: mono mark, no rings
//
// Keyframes live in web/tailwind.config.js beside pulse-glow and marquee, which
// is where this project already keeps CSS animation. index.html carries its own
// inline copy of four of them for the #boot-sonar cold-load overlay - see the
// comment in the config for why that duplication is deliberate.
//
// The rings are teal and purple-400 from the existing palette; the exact
// values and why the purple is 400 rather than the base are in the RINGS
// array below and in index.html's own copy, which has to agree with it.
//
// They stayed teal when the shark went mint, and that is a decision rather
// than an oversight. The ink rule is about the *mark* - one hex on every
// surface - and a sonar ring is not the mark. The purple in particular was
// moved to #9A3FC0 on a contrast measurement recorded beside it, and letting
// it inherit a brand change it was never part of would throw that away.
//
// The mark defaults to surface="obsidian" because every call site until
// the lobby -> draft room placement sat on the boot overlay's own obsidian
// ground (index.css pins body to it). `surface` is a real prop now — pass
// whatever JukeLogo.jsx's SURFACE map matches the ground this instance is
// actually painted on.

import React, { useEffect, useRef, useState } from 'react'
import { JukeMark, JukeWordmark } from './juke-logo/JukeLogo.jsx'

const RING_MS = 2100

// mark: width in px, passed to JukeMark, which derives height from the fixed
// 564:352 ratio. ring: the ring's resting diameter - it must stay under half the
// container's shorter side, because the keyframe expands to 2.2x and the
// container clips.
//
// screen tier has no label: it shows the stacked lockup - mark over wordmark -
// and nothing else. The brand answers "whose product is this", which is the only
// question a visitor arriving from a pasted link actually has; what the product
// does is one screen behind. Naming the category here would pin the brand to the
// one room that exists today, against CLAUDE.md's rule.
//
// wordmark = mark / 2.4 and gap = wordmark * 0.34, both from JukeLogo's
// variant="stacked" rather than picked to match it.
const TIERS = {
  screen: { mark: 212, ring: 150, gap: 30, wordmark: 88 },
  panel: { mark: 104, ring: 96, gap: 16, track: '0.16em' },
}

// Teal, teal, purple, entering 700ms apart across the cycle — the design's own
// order, deliberately unchanged. The third ring going unseen was a timing
// problem and main.jsx fixed it there, by holding the overlay for one full ring
// cycle rather than cutting it off at the mark.
//
// The colour did need help. Composited on obsidian, #7B1FA2 at .75 measures
// 1.79:1 against the teals' 4.37 and 3.28, and even at full alpha only reaches
// 2.35 — it is a dark purple and no alpha rescues it. purple-400 at .9 measures
// 3.07. Both values are existing tokens; neither is new.
//
// index.html's inline copy for #boot-sonar carries the same three colours in
// the same order. Change one, change the other.
const RINGS = [
  { color: 'rgba(0,229,255,0.55)', at: 0 },
  { color: 'rgba(0,229,255,0.45)', at: 1 / 3 },
  { color: 'rgba(154,63,192,0.9)', at: 2 / 3 },
]

// Rule 01, made structural rather than a thing every call site has to remember:
// nothing renders for the first `delay` ms. If the wait resolves faster than
// that, the loader was never mounted and there is no flash. A flash of logo
// reads as a glitch rather than as polish, and this single gate prevents most of
// the ways a loading state makes a product feel slower than it is.
function useAfter(ms) {
  const [past, setPast] = useState(ms <= 0)
  useEffect(() => {
    if (ms <= 0) return
    const t = setTimeout(() => setPast(true), ms)
    return () => clearTimeout(t)
  }, [ms])
  return past
}

// Rule 02. A backgrounded desktop tab would otherwise run the ring loop
// indefinitely on somebody's battery. animation-play-state rather than
// unmounting, so the mark's entrance is not restarted when the tab comes back.
// The attribute is read by one rule in index.css.
//
// `live` is a dependency, not decoration. The element does not exist until the
// delay above elapses, so an effect that only ran on mount would find
// ref.current still null and the opening sync() would do nothing at all - a
// loader appearing in an already-hidden tab would then run its rings until the
// next visibilitychange, which is the case this exists to prevent.
function usePauseWhenHidden(live) {
  const ref = useRef(null)
  useEffect(() => {
    const sync = () => {
      const el = ref.current
      if (!el) return
      if (document.hidden) el.setAttribute('data-sonar-paused', '')
      else el.removeAttribute('data-sonar-paused')
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [live])
  return ref
}

export default function SonarLoader({
  tier = 'panel',
  // Ignored on screen tier, which shows the wordmark instead. Required on panel.
  label = '',
  // What a screen reader is told. A panel's own label is real text and does that
  // job itself; this is for screen tier, where everything drawn is brand artwork
  // and none of it describes the wait.
  srLabel = 'Loading',
  // Threaded straight to JukeMark — see JukeLogo.jsx's SURFACE map. Both
  // tiers were dark-ground-only and hardcoded to "obsidian" until the
  // lobby -> draft room placement (homepage v4 pass 0) needed to sit on
  // the app's own `slate` (#1E2733), which is not obsidian (#0B0E14):
  // close enough to look "roughly the same" and different enough that the
  // negatives would carry a visibly darker patch around inside the mark,
  // per JukeLogo.jsx's own note on why the ink and the negatives are not
  // the same question. Defaults preserve every existing call site's
  // behaviour exactly.
  surface = 'obsidian',
  delay = 300,
  ringMs = RING_MS,
  className = '',
  style,
}) {
  const shown = useAfter(delay)
  const ref = usePauseWhenHidden(shown)
  const t = TIERS[tier] || TIERS.panel

  if (!shown) return null

  const showsWordmark = Boolean(t.wordmark)

  return (
    <div
      ref={ref}
      data-sonar={tier}
      // aria-busy plus a polite live region: a screen reader gets text, which is
      // the only channel the rings do not reach at all. Everything visual below
      // is aria-hidden, the mark included - JukeMark carries its own
      // aria-label="Juke", and a live region announcing the brand name is not a
      // loading state. On panel tier the visible label is the announcement; on
      // screen tier srLabel stands in for artwork that says nothing.
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={
        'relative flex h-full w-full items-center justify-center overflow-hidden ' +
        className
      }
      style={style}
    >
      {RINGS.map((r, i) => (
        <span
          key={i}
          data-sonar-ring=""
          aria-hidden="true"
          className="absolute rounded-full animate-sonar-ring motion-reduce:hidden"
          style={{
            width: t.ring,
            height: t.ring,
            border: `1px solid ${r.color}`,
            animationDuration: `${ringMs}ms`,
            animationDelay: `${Math.round(ringMs * r.at)}ms`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center" style={{ gap: t.gap }}>
        <span
          data-sonar-mark=""
          aria-hidden="true"
          // The blur-and-scale focus-in becomes a plain opacity fade under
          // reduced motion rather than nothing at all: style.css already draws
          // that line for .to-top ("the fade stays - it is an opacity change,
          // not motion"), and this follows it.
          className="animate-sonar-focus motion-reduce:animate-sonar-fade"
        >
          {/* detail is deliberately not passed even though 212px clears the
              120px threshold. detail is a second SVG request, and a loader is
              the one place that must not add one to a page already waiting.

              onLight is not passed either, and that is a real limitation rather
              than an oversight: both tiers are dark-ground only, and the panel
              label's ink below is a dark-ground value too. There is no
              light-ground call site today - step 3 wires SonarPulse alone, which
              takes currentColor and is theme-blind. The first panel to land on a
              light surface needs onLight threaded through here and a light ink
              beside it; picking one before then would be inventing a tier nobody
              has reviewed. */}
          <JukeMark width={t.mark} surface={surface} />
        </span>

        {showsWordmark ? (
          <span
            aria-hidden="true"
            className="animate-sonar-label motion-reduce:animate-sonar-fade"
          >
            <JukeWordmark size={t.wordmark} />
          </span>
        ) : label ? (
          <span
            className="animate-sonar-label motion-reduce:animate-sonar-fade"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: t.track,
              color: 'rgba(242,245,250,0.58)',
            }}
          >
            {label}
          </span>
        ) : null}
      </div>

      {/* Only when nothing visible is already carrying the announcement, so a
          panel is not read out twice. */}
      {showsWordmark || !label ? <span className="sr-only">{srLabel}</span> : null}
    </div>
  )
}

// Tier 3 - below 80px the rings stop resolving and the two-value face turns to
// mud, so both go. JukeMark's own floor already swaps to the silhouette below
// 28px; `mono` asks for it explicitly and it inherits currentColor from the
// button, which is what lets the same element sit on teal and on obsidian.
//
// Do not shrink SonarLoader to get here.
//
// It takes the same delay gate as the tiers above, for the same reason: a share
// card that draws off a warm cache resolves in well under 300ms, and a glyph
// that appears and vanishes inside a button reads as a flicker rather than as a
// loading state. Pass delay={0} only where something else has already waited -
// ChatPanel's GIF search does, behind a 350ms debounce.
export function SonarPulse({ width = 20, delay = 300, srLabel = 'Loading', className = '', style }) {
  const shown = useAfter(delay)
  if (!shown) return null

  return (
    <span
      role="status"
      aria-busy="true"
      className={'animate-sonar-pulse motion-reduce:animate-none ' + className}
      style={{ display: 'inline-flex', alignItems: 'center', ...style }}
    >
      {/* aria-hidden on a wrapper rather than on the mark itself, because
          JukeMark hardcodes aria-label="Juke" and accepts no ARIA props - and
          hiding an ancestor hides the whole subtree. Without it this spinner
          announces the brand name as its loading state, in a live region, inside
          a button that already says what it does. */}
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        <JukeMark width={width} mono />
      </span>
      <span className="sr-only">{srLabel}</span>
    </span>
  )
}
