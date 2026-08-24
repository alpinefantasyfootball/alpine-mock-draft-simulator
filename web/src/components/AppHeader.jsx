import { useEffect, useState } from 'react'
import { ChevronLeft, Volume2, VolumeX, Sun, Moon } from 'lucide-react'
import { JukeMark } from './juke-logo/JukeLogo.jsx'

// Deep, desaturated stops — same reason the legacy --hdr-blue-deep/blue/cyan
// three-stop ramp was darkened off raw brand blue: white text has to clear
// 4.5:1 on EVERY stop, not just the ends, and raw teal (#00E5FF) fails that
// badly. Measured (WCAG relative luminance vs. white): 0A4650 → 10.47,
// 0E6B78 → 6.19, 0F7C8E → 4.89 — the obvious #12889C for the last stop
// measured 4.18 and was darkened until it cleared, same as --hdr-cyan once
// did. Urgent reuses the legacy red ramp outright (10.30 / 6.19 / 4.60)
// rather than reinventing a verified-safe set of stops for no reason —
// "hurry up" reads as red regardless of brand palette.
const MY_TURN_GRADIENT = 'linear-gradient(120deg, #0A4650 0%, #0E6B78 50%, #0F7C8E 130%)'
const URGENT_GRADIENT = 'linear-gradient(120deg, #7A1F1A 0%, #B43026 60%, #D04439 100%)'

function useEngine() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.JukeEngine) setReady(true)
  }, [])
  return ready ? window.JukeEngine : null
}

// #appbar itself — the real element, still shown/hidden by applyRoute() —
// carries the legacy stylesheet's 4px teal top border (orange until 20
// August 2026) and warm-gray bottom border. renderHeader() resets its
// className on every call but never touches .style, so an inline override
// set once here survives every future render — the same reason the double
// border bug earlier had to be fixed by removing a class, not adding one.
// No page in this palette uses the accent as a surface; this keeps that
// true here too.
function useOwnParentBorders() {
  useEffect(() => {
    const el = document.getElementById('appbar')
    if (!el) return
    el.style.borderTop = 'none'
    el.style.borderBottom = '1px solid rgba(255,255,255,0.05)'
  }, [])
}

// headerInfo() is the exact branching renderHeader() itself runs (see the
// comment on that function in app.js) — this just re-reads it whenever
// renderHeader() says something changed, rather than polling or duplicating
// the decision. "juke:header" fires from renderHeader() on every render,
// tick and pause toggle, the same cadence the legacy DOM writes already ran on.
function useHeaderInfo(engine) {
  const [info, setInfo] = useState({ started: false })
  useEffect(() => {
    if (!engine) return
    const refresh = () => setInfo(engine.headerInfo())
    refresh()
    window.addEventListener('juke:header', refresh)
    return () => window.removeEventListener('juke:header', refresh)
  }, [engine])
  return info
}

export default function AppHeader() {
  const engine = useEngine()
  const info = useHeaderInfo(engine)
  const [soundOn, setSoundOn] = useState(false)
  const [theme, setThemeState] = useState('dark')
  useOwnParentBorders()

  useEffect(() => {
    if (!engine) return
    setSoundOn(engine.soundWanted())
    setThemeState(engine.currentTheme())
  }, [engine])

  const leaveDraft = () => { window.location.hash = '#/' }
  const toggleSound = () => {
    if (!engine) return
    engine.toggleSound()
    setSoundOn(engine.soundWanted())
  }
  const toggleTheme = () => {
    if (!engine) return
    engine.setTheme(theme === 'dark' ? 'light' : 'dark')
    setThemeState(engine.currentTheme())
  }

  const lit = !!info.myTurn
  const bg = lit ? (info.urgent ? URGENT_GRADIENT : MY_TURN_GRADIENT) : '#151923'
  const seg = lit ? 'border-white/25' : 'border-white/10'
  // Translucent white on a saturated surface measures badly no matter the
  // alpha — CLAUDE.md's Contrast section clocked 82% white at 2.95 against
  // a similar-strength backdrop, well under 4.5:1. So the label is solid
  // white when lit, same fix the legacy header already made: hierarchy
  // against the bigger, bolder pick/value text comes from size and weight,
  // not opacity. Resting state measured: /40 on #151923 composites to 3.81
  // (fails), /50 to 5.22 (clears with margin).
  const label = lit ? 'text-white' : 'text-white/50'
  const btnStyle = lit ? 'text-white hover:bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'

  // No border classes here: useOwnParentBorders() above already sets the
  // outer #appbar element's border directly, and adding a second set on
  // this inner div measured as a very real 8px double-thick top border in
  // the browser the first time this was built.
  return (
    <div style={{ background: bg, transition: 'background 0.35s ease' }}>
      <div className="mx-auto flex min-h-[52px] max-w-7xl items-stretch">
        <button
          type="button"
          onClick={leaveDraft}
          title="Leave the draft"
          aria-label="Leave the draft"
          className={`flex shrink-0 items-center gap-1.5 border-r px-3.5 transition-opacity duration-150 hover:opacity-75 ${seg}`}
        >
          <ChevronLeft className={`h-4 w-4 ${lit ? 'text-white' : 'text-white/70'}`} />
          {/* Two-value (mint linework, slate-bar negatives) at rest. The ink
              is the same hex Header.jsx's JukeLogo uses on the homepage — it
              is one hex everywhere by rule — but the negatives are this
              bar's own ground rather than the homepage's, which is the whole
              point of surface="appbar": the eyes and jaw read as holes, and
              a hole has to show the surface behind it. mono only kicks in
              once the bar is lit: a two-value mark doesn't read against a
              saturated gradient, same reason the legacy header reverses
              --mark-ink there.

              28 rather than 20, and the number is load-bearing rather than
              taste. JukeLogo drops to the currentColor silhouette below 28px
              — the shark face does not survive smaller — and a silhouette
              here would take whatever colour it inherited, which is to say
              the resting state would quietly stop being teal and the comment
              above would stop being true. 28 is the smallest width that keeps
              the two-value mark, and the shark is wide, so this is 17px tall
              against the goalpost's 21. */}
          <JukeMark width={28} mono={lit} surface="appbar" className={lit ? 'text-white' : undefined} />
        </button>

        <div className={`flex min-w-0 flex-col justify-center gap-0.5 border-r px-4 py-1.5 ${seg}`}>
          <h1 className={`truncate text-[10px] font-bold uppercase tracking-wide ${label}`}>
            {info.started ? info.statusLine : 'The Draft Room'}
          </h1>
          {info.started && (
            <p className="truncate font-display text-base font-bold tabular-nums text-white">
              {info.pickText}
              {info.leagueSummary && (
                <span className={`ml-1.5 text-[10px] font-medium normal-case tracking-normal ${label}`}>
                  &middot; {info.leagueSummary}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="ml-auto flex items-stretch">
          {info.started && (
            <div className={`flex flex-col justify-center border-l px-4 py-1.5 text-right ${seg}`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${label}`}>{info.rightLabel}</span>
              <span className="font-display text-xl font-bold tabular-nums text-white">{info.rightValue}</span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title="Sound"
            aria-label="Sound"
            className={`flex items-center border-l px-3.5 transition-colors duration-150 ${seg} ${btnStyle}`}
          >
            {soundOn ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
            aria-label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
            className={`flex items-center border-l px-3.5 transition-colors duration-150 ${seg} ${btnStyle}`}
          >
            {theme === 'dark' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  )
}
