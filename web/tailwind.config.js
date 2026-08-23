/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0B0E14',
        charcoal: '#151923',
        teal: {
          // Continues the same +10%-lightness-per-step pattern 400/500/600
          // already use (hue 186, 100% saturation throughout — 40/50/60%
          // lightness) — not picked separately. Added because text-teal-300
          // was in real use (AnalysisTab.jsx, DraftBoardGrid.jsx) with no
          // 300 defined here, so it silently fell back to Tailwind's own
          // stock teal-300 (a different, more green hue) instead of brand
          // teal — the same "one color, two answers" drift this project
          // has already found and fixed for the position palette.
          300: '#66F0FF',
          DEFAULT: '#00E5FF',
          400: '#33EAFF',
          500: '#00E5FF',
          600: '#00B8CC',
        },
        purple: {
          DEFAULT: '#7B1FA2',
          400: '#9A3FC0',
          600: '#5E1780',
        },
        // Homepage-only secondary accents, from the Claude Design v2 handoff
        // (design_handoff_homepage_v2). Deliberately not a CTA/state colour —
        // every button, "Live" pill and the logo still read teal/purple
        // above, exactly as the Draft Room does. mint/skyblue are decorative
        // only: the hero overline, background glow, the odd label. They must
        // never touch a position chip — POS_BADGE (draftRoomPositions.js) is
        // documented as "the one hue reference for the whole site now, not
        // just the draft room," already shared by this same homepage's
        // ShowYourWorking.jsx, and introducing a second RB/WR colour here
        // would be exactly the "a position reads a different colour
        // depending which page you're looking at" bug that file was
        // rewritten once already to end.
        mint: '#5eead4',
        skyblue: '#38bdf8',
        // This page's background. Close to but deliberately not `obsidian`
        // (#0B0E14, used everywhere else) — the handoff's own value, and
        // this project's rule once a hex is explicitly chosen is to keep it
        // rather than round it off to the nearest existing token.
        void: '#070a0d',
      },
      boxShadow: {
        // resting glass panel: barely-there edge, no glow
        glass: '0 1px 0 0 rgb(255 255 255 / 0.04) inset',
        // hover state: teal ring + glow outside, soft purple wash inside
        'card-hover':
          '0 0 0 1.5px rgb(0 229 255 / 0.9), 0 0 32px rgb(0 229 255 / 0.4), inset 0 0 40px rgb(123 31 162 / 0.5)',
        // "Your seat" identity — the Draft Room Cockpit's gold ring, named
        // by role rather than added as a `gold` colour token. #FFD166 is
        // 1.4:1 as text (CLAUDE.md), so the colour-ownership rule is
        // "never as type" — a colour token can't express that restriction
        // (Tailwind would happily generate `text-gold`), a shadow token
        // can't be applied to text at all. Same values DraftBoardGrid.jsx's
        // mineRing() already inlines; named here so new Cockpit surfaces
        // (the Entry seat grid, Picks rows) share the identical ring
        // instead of re-typing the hex.
        seat: 'inset 0 0 0 2px #FFD166',
        'seat-live': '0 0 15px rgba(0,229,255,0.4), inset 0 0 0 2px #FFD166',
      },
      backdropBlur: {
        glass: '16px',
      },
      fontFamily: {
        // Poppins was never actually requested from Google Fonts (only
        // Barlow Condensed/Inter/Archivo are, per index.html) — a stale
        // leftover from before the 18 Aug rebrand, which swapped display
        // faces on the legacy style.css side specifically because Poppins
        // matched Sleeper, but never touched this file. Every font-display
        // heading and the grade glyph itself fell back to system-ui the
        // entire time. Barlow Condensed is already loaded; this costs no
        // extra network request, it just points at the font that's there.
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        // A new, separate token — not `mono` itself, so a page still using
        // bare `font-mono` (Tailwind's own system-mono fallback) never gets
        // silently reskinned just because this file changed. That was the
        // homepage-only reasoning when this token was added; checked again
        // for the Draft Room Cockpit and it turned out to already be moot
        // there — grepped `web/src` for the literal class `font-mono` and
        // got zero matches. Nothing in the Draft Room was using it at all,
        // despite an older version of this comment claiming pick codes and
        // AnalysisTab did. `font-plex` is now used explicitly by both the
        // homepage components and the Cockpit's pick codes/team
        // abbreviations/tabular figures, loaded from Google Fonts in
        // index.html next to Archivo — same font, no new infrastructure,
        // just no longer homepage-only.
        plex: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0,229,255,0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(0,229,255,0.7), 0 0 18px rgba(123,31,162,0.5)' },
        },
        // A JS-driven restart-on-complete loop (Framer Motion's animate())
        // measurably hitched at the wraparound — every restart cost a real
        // frame of JS between onComplete firing and the next animate() call.
        // A native CSS loop has no such seam: the browser repeats the
        // keyframe on the compositor thread with nothing for JS to do.
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        // Sonar. These four are a second copy of the keyframes that index.html
        // carries inline for the #boot-sonar cold-load overlay, and the
        // duplication is deliberate rather than drift: that copy has to be
        // readable before any bundle is, and under `vite dev` this stylesheet
        // arrives via JavaScript. They are global @keyframes under one name
        // each, so if the two ever disagree, whichever stylesheet the document
        // loads later wins for the overlay *and* for the components. Change
        // one, change the other. (index.html writes the same values in CSS's
        // own shorthand - .16 for 0.16 - so compare values, not characters.)
        'sonar-ring': {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '12%': { opacity: '0.65' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'sonar-focus': {
          '0%': { transform: 'scale(1.2)', opacity: '0', filter: 'blur(7px)' },
          '100%': { transform: 'scale(1)', opacity: '1', filter: 'blur(0)' },
        },
        'sonar-label': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // The reduced-motion substitute for the two above, not a variant of
        // them: opacity only, no blur, no travel. It states its own 0% for a
        // reason - a keyframe declaring only a `to` starts from whatever the
        // element already computes, which is opacity 1 here, so it would fade
        // nothing at all. That was a real bug in the handoff's boot overlay.
        'sonar-fade': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        // Tier 3 only. No index.html counterpart - the overlay has no inline
        // tier, so this one lives here alone.
        'sonar-pulse': { '0%, 100%': { opacity: '0.32' }, '50%': { opacity: '1' } },
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.8s ease-in-out infinite',
        marquee: 'marquee 45s linear infinite',
        // SonarLoader.jsx overrides duration and delay inline per ring, so the
        // 2100ms here is the default rather than the only value.
        'sonar-ring': 'sonar-ring 2100ms ease-out infinite both',
        'sonar-focus': 'sonar-focus 580ms cubic-bezier(0.16,1,0.3,1) both',
        'sonar-label': 'sonar-label 500ms ease-out 340ms both',
        'sonar-fade': 'sonar-fade 300ms ease-out both',
        'sonar-pulse': 'sonar-pulse 1500ms ease-in-out infinite both',
      },
    },
  },
  plugins: [
    function ({ addUtilities, theme }) {
      addUtilities({
        '.glass-panel': {
          backgroundColor: 'rgb(21 25 35 / 0.55)',
          backdropFilter: `blur(${theme('backdropBlur.glass')})`,
          WebkitBackdropFilter: `blur(${theme('backdropBlur.glass')})`,
          border: '1px solid rgb(255 255 255 / 0.08)',
        },
        // The background half of "your seat," beside the shadow.seat ring
        // above — a background-color utility, so `text-seat-wash` isn't a
        // class Tailwind can even generate. Same #FFD166 the ring uses, at
        // the wash strength the Cockpit's board column and Picks rows both
        // call for.
        '.seat-wash': {
          backgroundColor: 'rgba(255,209,102,0.07)',
        },
      })
    },
  ],
}
