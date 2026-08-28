// Homepage v4 pass 2's "Take a pick" module — three real, seeded third-round
// decisions (see app.js's generateThirdRoundScenario()/thirdRoundScenarios(),
// bridged as engine.thirdRoundScenarios()), each played out as a five-phase
// loop. "Nothing here is a marketing screenshot" is the section's own
// promise (§3.5's sub), so every player name, every grade number and every
// caption below is read off a real simulated draft — nothing in this file
// is a literal string standing in for one.
import { useEffect, useMemo, useRef, useState } from 'react'
import { PauseCircle, PlayCircle } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

// §6.1's own table. Index = phase.
const PHASE_MS = [3000, 2600, 2600, 3400, 3600]
const PHASE_TAGS = ['On the clock', 'Your pick', 'The room reacts', 'Grade rerun', 'Grade rerun']

const COMPONENT_LABELS = [
  { key: 'starters', label: 'Starter strength', weight: 50 },
  { key: 'value', label: 'Draft value', weight: 25 },
  { key: 'build', label: 'Roster construction', weight: 15 },
  { key: 'byes', label: 'Bye-week safety', weight: 10 },
]

function lastNameOf(name) {
  const parts = name.split(' ').filter((w) => !['Jr.', 'Sr.', 'II', 'III', 'IV'].includes(w))
  return parts[parts.length - 1] || name
}

// §6.2's own four templates. Phase 3 and 4 share one — "the scenario's own
// explanation, with any derived figure interpolated" — built from whichever
// grade component moved the most between before/after, since that's the
// real answer to "why did the grade change" for THIS scenario, not a
// generic line true of all three.
function captionFor(scenario, phase) {
  const { player, pickCode, survivalPct, opponentPicks, before, after } = scenario
  if (phase === 0) {
    return `Pick ${pickCode} — you are on the clock. ${lastNameOf(player.name)} is ${survivalPct}% to survive to your next turn.`
  }
  if (phase === 1) {
    return `You take ${player.name} at ${pickCode}.`
  }
  if (phase === 2) {
    return `${opponentPicks[0].name} and ${opponentPicks[1].name} come off the board before the wheel comes back.`
  }
  // phase 3 or 4
  const deltas = COMPONENT_LABELS.map((c) => ({ ...c, delta: after.components[c.key] - before.components[c.key] }))
  const biggest = deltas.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a))
  const dir = biggest.delta >= 0 ? 'climbs' : 'falls'
  return `${biggest.label} ${dir} ${Math.abs(biggest.delta)} — the composite moves from ${before.composite} to ${after.composite}, ${before.letter} to ${after.letter}.`
}

function useThirdRoundScenarios() {
  const [scenarios, setScenarios] = useState(null)

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return

    const read = () => {
      if (!engine.dataReady()) return
      const rows = engine.thirdRoundScenarios()
      if (rows && rows.length) setScenarios(rows)
    }

    read()
    window.addEventListener('juke:header', read)
    return () => window.removeEventListener('juke:header', read)
  }, [])

  return scenarios
}

// One chained setTimeout, not an interval — §6.1 is explicit that this is
// five state transitions per loop, not a continuously re-rendering clock.
// Runs only while inView && !paused && !reducedMotion; reduced motion
// renders phase 0 and never starts at all, per §6.1's own instruction.
function useAutoPlayLoop(scenarioCount) {
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [phase, setPhase] = useState(0)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const containerRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
    // scenarioCount, not []: the ref's target only exists once scenarios
    // have loaded and the real container (as opposed to the loading
    // skeleton) has actually mounted. An empty deps array runs this
    // effect once, immediately, while containerRef.current is still null
    // — found by testing, not by reading the code, since nothing throws
    // when an observer is silently never created.
  }, [scenarioCount])

  const running = inView && !paused && !reducedMotion && scenarioCount > 0

  useEffect(() => {
    if (!running) return
    timerRef.current = setTimeout(() => {
      setPhase((p) => {
        const next = (p + 1) % PHASE_MS.length
        if (next === 0) setScenarioIndex((s) => (s + 1) % scenarioCount)
        return next
      })
    }, PHASE_MS[phase])
    return () => clearTimeout(timerRef.current)
  }, [running, phase, scenarioCount])

  // Jumping to a scenario via the dots resets to phase 0 for it — picking
  // up mid-phase on a decision the reader just switched to would be
  // showing them a pick already half-made without the "on the clock"
  // moment that explains it.
  const goToScenario = (i) => {
    setScenarioIndex(i)
    setPhase(0)
  }

  return { containerRef, scenarioIndex, phase, paused, setPaused, goToScenario, running }
}

// text-white/NN reads muted at a glance and fails 4.5:1 in practice —
// measured across this whole file (and ScoringDemoCard.jsx, and
// ShowYourWorking.jsx) with transitions disabled: every one of /25 through
// /45 came back under the bar against these cards' near-black
// backgrounds, from 2.13 up to 4.45 at best. Homepage cosmetic revision:
// now the same voidInk.muted the rest of the page's meta text uses
// (tailwind.config.js), not a one-off hex — it clears ~6:1 against every
// background any of these panels use.
const MUTED = '#808389'

function RowTag({ label, tone }) {
  const toneClass =
    tone === 'mine'
      ? 'bg-teal-500 text-obsidian'
      : tone === 'gone'
        ? 'bg-white/[0.06]'
        : 'border border-teal-400/40 text-teal-300'
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 font-plex text-[9.5px] font-semibold uppercase tracking-wide ${toneClass}`}
      style={tone === 'gone' ? { color: MUTED } : undefined}
    >
      {label}
    </span>
  )
}

function BoardPanel({ scenario, phase }) {
  return (
    <div className="flex h-full flex-col px-6 py-5">
      <p className="font-plex text-[11px] font-semibold uppercase tracking-[0.1em] text-voidInk-muted">On the board</p>
      <div className="mt-3 flex flex-col gap-[6px]">
        {scenario.boardRows.map((row) => {
          // Nothing is added or removed as the phase advances (§4.3) — the
          // same eight rows just change their own tag, border and text
          // colour (never opacity — see RowCells' comment below).
          const isGoneNow = phase >= 2 && row.isOpponent
          const isMineNow = row.isMine
          return (
            <div
              key={row.name}
              className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border px-3 py-[9px] transition-colors duration-500"
              style={{
                borderColor: isMineNow && phase >= 1 ? 'rgba(94,234,212,0.4)' : '#252930',
                backgroundColor: isMineNow && phase >= 1 ? 'rgba(94,234,212,0.06)' : 'transparent',
              }}
            >
              {/* A gone row dims by changing the name's own colour to a
                  solid, still-compliant muted grey — never opacity on the
                  row or on this position label. Measured against this
                  card's own #0d1216: earlier drafts put opacity on both
                  and took the text under 3:1, which is the exact mistake
                  §9's acceptance criteria calls out by name. The badge
                  stays at full strength on purpose — POS_BADGE's solids
                  are already the ones this project darkens until white
                  clears 4.5:1 on every one of them; dimming it a second
                  way here would undo that. */}
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold ${POS_BADGE[row.pos] || 'bg-white/10 text-white/50'}`}>
                {row.pos}
              </span>
              <span
                className={`min-w-0 truncate text-[13.5px] font-semibold transition-colors duration-500 ${isGoneNow ? 'line-through decoration-[#6b7680] text-voidInk-muted' : 'text-voidInk-primary'}`}
              >
                {row.name}
              </span>
              {isMineNow && phase >= 1 && <RowTag label="Yours" tone="mine" />}
              {isMineNow && phase === 0 && <RowTag label="Best value" tone="best" />}
              {isGoneNow && <RowTag label="Gone" tone="gone" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RosterPanel({ scenario, phase }) {
  const lineup = phase >= 1 ? scenario.after.lineup : scenario.before.lineup
  return (
    <div className="flex h-full flex-col border-x border-line-hairline px-6 py-5">
      <p className="font-plex text-[11px] font-semibold uppercase tracking-[0.1em] text-voidInk-muted">
        Your roster &middot; pick {scenario.pickCode}
      </p>
      <div className="mt-3 flex flex-col gap-[6px]">
        {lineup.map((s, i) => (
          <div key={`${s.slot}-${i}`} className="flex items-center justify-between gap-3 rounded-[10px] bg-surface-row px-3 py-[7px] transition-colors duration-500">
            <span className="font-plex text-[10px] font-semibold uppercase tracking-wide text-voidInk-muted">{s.slot}</span>
            {s.player ? (
              <span
                className="truncate text-[13px] font-semibold text-voidInk-primary transition-colors duration-500"
                style={s.player.name === scenario.player.name && phase >= 1 ? { color: '#5EEAD4' } : undefined}
              >
                {s.player.name}
              </span>
            ) : (
              <span className="text-[13px] text-voidInk-muted">Empty</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function GradeBar({ label, weight, before, after, animate }) {
  const value = animate ? after : before
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-voidInk-body">{label}</span>
        <span className="font-plex text-[10px] text-voidInk-muted">wt {weight}</span>
      </div>
      <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-teal-400 transition-[width] duration-[1400ms] ease-out"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  )
}

function GradePanel({ scenario, phase }) {
  const animate = phase >= 3
  const grade = animate ? scenario.after : scenario.before
  return (
    <div className="flex h-full flex-col px-6 py-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-plex text-[11px] font-semibold uppercase tracking-[0.1em] text-voidInk-muted">Draft grade &middot; live</p>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-display text-[38px] font-extrabold leading-none tabular-nums text-white transition-all duration-700">{grade.composite}</span>
        <span className="font-plex text-[13px] text-[#8e9aa1]">/ 100 &middot; after {grade.picksMade} picks</span>
        <span className="ml-auto font-display text-[22px] font-bold text-teal-300 transition-all duration-700">{grade.letter}</span>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {COMPONENT_LABELS.map((c) => (
          <GradeBar
            key={c.key}
            label={c.label}
            weight={c.weight}
            before={scenario.before.components[c.key]}
            after={scenario.after.components[c.key]}
            animate={animate}
          />
        ))}
      </div>
    </div>
  )
}

export default function TakeAPick() {
  const scenarios = useThirdRoundScenarios()
  const count = scenarios ? scenarios.length : 0
  const { containerRef, scenarioIndex, phase, paused, setPaused, goToScenario, running } = useAutoPlayLoop(count)

  const scenario = scenarios ? scenarios[scenarioIndex] : null
  const caption = useMemo(() => (scenario ? captionFor(scenario, phase) : ''), [scenario, phase])

  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="max-w-[720px]">
        <h2 className="text-balance font-display text-[30px] font-extrabold italic leading-[1.15] tracking-[-0.015em] sm:text-[38px] sm:leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.025em]">
          Take a pick. Watch it get graded.
        </h2>
        <p className="mt-4 text-[17px] leading-[1.55] text-voidInk-body">
          Three third-round decisions, playing out. Nothing here is a marketing screenshot.
        </p>
      </div>

      {!scenario ? (
        <div className="mt-[42px] h-[420px] animate-pulse rounded-[14px] bg-surface-row" />
      ) : (
        <>
          {/* Dots + pause, right-aligned, above the container — desktop's
              own order per §4.3. Same row hosts both on mobile too; only
              the caption bar's position (above vs. below the panels)
              differs by width. */}
          <div className="mt-[42px] flex items-center justify-end gap-3 lg:mt-[42px]">
            {/* Each dot's visible size stays 8px (a carousel indicator, not
                a button, should read small) — min-h/min-w-[44px] on the
                button itself is the actual tap target, invisible padding
                around a small dot rather than a 44px dot. Measured at 8x8
                before this fix, during homepage v4 pass 3's tap-target
                audit. */}
            <div className="flex items-center">
              {scenarios.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToScenario(i)}
                  aria-label={`Scenario ${i + 1}`}
                  aria-current={i === scenarioIndex}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center"
                >
                  <span className={`h-2 rounded-full transition-all duration-300 ${i === scenarioIndex ? 'w-6 bg-teal-400' : 'w-2 bg-white/20'}`} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play' : 'Pause'}
              aria-pressed={paused}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
            >
              {paused || !running ? <PlayCircle className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile: caption bar above the stacked panels (§4.3), so it's
              visible without scrolling past them. min-h reserves room for
              the longest of the four caption shapes so the bar's own
              height doesn't jump between phases. */}
          <div
            aria-live="polite"
            className="mt-3 flex min-h-[52px] items-center rounded-[14px] border border-line-hairline bg-surface-card px-4 py-3 text-[13.5px] leading-[1.5] text-voidInk-body lg:hidden"
          >
            {caption}
          </div>

          <div ref={containerRef} className="mt-3 grid overflow-hidden rounded-[14px] border border-line-hairline bg-surface-card lg:grid-cols-[410px_330px_1fr]">
            <BoardPanel scenario={scenario} phase={phase} />
            <RosterPanel scenario={scenario} phase={phase} />
            <GradePanel scenario={scenario} phase={phase} />
          </div>

          <div
            aria-live="polite"
            className="mt-3 hidden min-h-[52px] items-center rounded-[14px] border border-line-hairline bg-surface-card px-4 py-3 text-[13.5px] leading-[1.5] text-voidInk-body lg:flex"
          >
            <span className="mr-3 shrink-0 font-plex text-[10px] font-semibold uppercase tracking-wide text-teal-400">{PHASE_TAGS[phase]}</span>
            {caption}
          </div>
        </>
      )}
    </section>
  )
}
