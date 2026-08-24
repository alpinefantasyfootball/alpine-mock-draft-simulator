import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// standard/half/full — same three keys ScoringDemoCard.jsx's own
// PPR_OPTIONS already uses; kept as a second, small array rather than an
// import because the two live in genuinely different UI shapes here (a
// row of three text labels, not pills), not because the values differ.
const FORMATS = [
  { format: 'standard', label: 'Standard' },
  { format: 'half', label: 'Half PPR' },
  { format: 'ppr', label: 'Full PPR' },
]

// The fourth grade component is "bye-week safety" in analyseDraft()'s own
// 50/25/15/10 weighting (CLAUDE.md's draft-grade section) — hyphenated
// here to match every other place on the page that names it, homepage v4
// pass 2's own copy fix.
const GRADE_BODY = 'Starter strength, draft value, roster construction, bye-week safety — with the weight each one carries.'

// Homepage v4 pass 2's exact replacement string (§3.6) — "gives the
// chance" was the wrong idiom; "shows the odds" is the only wording
// change, the rest of the sentence is what already shipped.
const SURVIVAL_BODY = 'Before you pick, Juke shows the odds each player is still on the board at your next turn.'

const CHART_W = 400
const CHART_H = 150
const PAD_L = 8
const PAD_R = 8
const PAD_T = 10
const PAD_B = 22

function scaleX(i, n) {
  if (n <= 1) return PAD_L
  return PAD_L + (i / (n - 1)) * (CHART_W - PAD_L - PAD_R)
}
function pathFor(points, yMin, yMax) {
  const span = yMax - yMin || 1
  return points
    .map((y, i) => {
      const x = scaleX(i, points.length)
      const yy = PAD_T + (1 - (y - yMin) / span) * (CHART_H - PAD_T - PAD_B)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${yy.toFixed(1)}`
    })
    .join(' ')
}

// Real WR points-by-position-rank, replacement line, and the shaded area
// between them from rank 1 to the replacement rank (§8) — every number
// from engine.vorpUnder(format), not the mockup's own placeholder
// exponential-decay formula. WR specifically: it's the position PPR moves
// most, which is the whole argument this chart and the toggle beside it
// are making — "the curve falls when the reception bonus drops, but
// replacement falls with it" is least visible on a position PPR barely
// touches.
function useVorpCurve(format) {
  const [curve, setCurve] = useState(null)

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return

    const read = () => {
      if (!engine.dataReady()) return
      const table = engine.vorpUnder(format)
      const wrs = engine
        .board()
        .filter((p) => p.pos === 'WR')
        .map((p) => table[p.id])
        .filter((row) => row && row.projPts !== null)
        .sort((a, b) => b.projPts - a.projPts)
      if (!wrs.length) return

      // Any WR's own row gives the replacement figure back out — projPts
      // minus vorp is the threshold vorpUnder() cut every WR against,
      // whichever one you ask. No second bridge call to carry it
      // separately, which is exactly how a value ends up written down
      // twice and drifting.
      const replacement = wrs[0].projPts - wrs[0].vorp
      const replacementRank = wrs.findIndex((r) => r.vorp <= 0) + 1 || wrs.length
      // Enough of the curve to show the cliff and a bit past it, not
      // WR230 flatlining at zero for a hundred ranks — 1.5x the
      // replacement rank, floored at 30 so a shallow league's replacement
      // rank (say, 12) doesn't crop the chart to almost nothing.
      const shown = wrs.slice(0, Math.min(wrs.length, Math.max(30, Math.round(replacementRank * 1.5))))
      setCurve({ points: shown.map((r) => r.projPts), replacement, replacementRank, count: shown.length })
    }

    read()
    window.addEventListener('juke:header', read)
    return () => window.removeEventListener('juke:header', read)
  }, [format])

  return curve
}

function VorpChart({ format }) {
  const curve = useVorpCurve(format)
  if (!curve) return <div className="mt-5 h-[150px] animate-pulse rounded-lg bg-white/[0.03]" />

  const { points, replacement, replacementRank, count } = curve
  const yMax = Math.max(...points)
  const yMin = Math.min(0, replacement)
  const curveD = pathFor(points, yMin, yMax)
  const replY = PAD_T + (1 - (replacement - yMin) / (yMax - yMin || 1)) * (CHART_H - PAD_T - PAD_B)
  const cutX = scaleX(Math.min(replacementRank, count) - 1, count)
  // Area under the curve and above the replacement line, from rank 1 to
  // the replacement cut only — not the whole curve, which is the point
  // the shading is making (value that clears replacement vs. value that
  // doesn't).
  const areaPoints = points.slice(0, Math.min(replacementRank, count))
  const areaD =
    areaPoints.length > 1
      ? `${pathFor(areaPoints, yMin, yMax)} L${scaleX(areaPoints.length - 1, count).toFixed(1)},${replY.toFixed(1)} L${scaleX(0, count).toFixed(1)},${replY.toFixed(1)} Z`
      : ''

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" role="img" aria-labelledby="vorp-chart-desc">
        <desc id="vorp-chart-desc">
          {`Wide receiver projected points by position rank, ${FORMATS.find((f) => f.format === format)?.label}. WR1 projects ${Math.round(points[0])} points; replacement level (WR${replacementRank}) is ${Math.round(replacement)}.`}
        </desc>
        {/* Recessive gridlines — three horizontal, no axis ticks past what
            the replacement line already labels. */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD_L} x2={CHART_W - PAD_R} y1={PAD_T + f * (CHART_H - PAD_T - PAD_B)} y2={PAD_T + f * (CHART_H - PAD_T - PAD_B)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        {areaD && <path d={areaD} fill="rgba(94,234,212,0.12)" />}
        <path d={curveD} fill="none" stroke="#5EEAD4" strokeWidth="2" />
        <line x1={PAD_L} x2={CHART_W - PAD_R} y1={replY} y2={replY} stroke="#5EEAD4" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
        <circle cx={cutX} cy={replY} r="3" fill="#5EEAD4" />
        <text x={cutX} y={Math.min(CHART_H - 4, replY + 15)} textAnchor="middle" fontSize="9" fontFamily="var(--font-plex, monospace)" fill="rgba(255,255,255,0.55)">
          {`replacement · WR${replacementRank}`}
        </text>
      </svg>
    </div>
  )
}

// Homepage v4 pass 2's featured player: whichever of the Hero board
// widget's board — whoever has a survival probability closest to 50% at
// "my next turn" — the most informative point on the curve (a lock or a
// long shot proves nothing a reader couldn't guess). Searched across the
// same full PPR-relevant pool usePlayerPool() draws from, not just the
// Hero widget's own top seven by VORP: those seven are all early-ADP
// studs, so their survival to a pick as early as 20 clusters at 0% —
// tried first, and it was never anything but the same unconvincing
// near-zero result. Uses the exact same engine.survivalProbability() call
// the Hero widget's Surv column does, at the exact same target pick, so
// if this player also happens to appear there the two numbers agree by
// construction — but the featured player is picked for how informative
// the number is, not for being one of those seven.
function useFeaturedSurvival() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return

    const read = () => {
      if (!engine.dataReady()) return
      const statKeys = engine.statKeys()
      const forcedLate = engine.forcedLate()
      if (!statKeys) return

      const picks = engine.nextPicksFor(0, 2)
      const targetOverall = picks.length > 1 ? picks[1] : null
      if (targetOverall == null) return
      const picksFromNow = targetOverall - 1

      const pool = engine
        .board()
        .filter((p) => {
          if (forcedLate[p.pos]) return false
          const s = engine.statOf(p)
          return s && s.p && s.p.gp > 0 && s.p[statKeys.rec] > 0
        })
        .map((player) => ({
          player,
          surv: engine.survivalProbability(player, targetOverall),
        }))
        .filter((row) => row.surv !== null)

      if (!pool.length) return
      const featured = pool.reduce((best, row) =>
        Math.abs(row.surv - 0.5) < Math.abs(best.surv - 0.5) ? row : best
      )

      // The curve itself: survival at every pick from now to a bit past
      // the marked one, off the identical unconditional model — picks
      // from now = 0 is "right now" (100% by definition; nothing's been
      // drafted between here and here), matching the homepage's own lack
      // of a real draft in progress to condition on.
      const span = picksFromNow + 6
      const curve = []
      for (let x = 0; x <= span; x++) {
        curve.push(Math.round((engine.survivalProbability(featured.player, 1 + x) || 0) * 100))
      }

      setData({
        player: featured.player,
        markedPct: Math.round(featured.surv * 100),
        picksFromNow,
        curve,
      })
    }

    read()
    window.addEventListener('juke:header', read)
    return () => window.removeEventListener('juke:header', read)
  }, [])

  return data
}

function SurvivalChart({ data }) {
  if (!data) return <div className="mt-5 h-[150px] animate-pulse rounded-lg bg-white/[0.03]" />

  const { curve, picksFromNow, markedPct, player } = data
  const curveD = pathFor(curve, 0, 100)
  const markX = scaleX(Math.min(picksFromNow, curve.length - 1), curve.length)
  const markY = PAD_T + (1 - markedPct / 100) * (CHART_H - PAD_T - PAD_B)

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" role="img" aria-labelledby="survival-chart-desc">
        <desc id="survival-chart-desc">
          {`${player.name}'s odds of still being on the board, by picks from now. At ${picksFromNow} picks from now — your next turn — the odds are ${markedPct}%.`}
        </desc>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD_L} x2={CHART_W - PAD_R} y1={PAD_T + f * (CHART_H - PAD_T - PAD_B)} y2={PAD_T + f * (CHART_H - PAD_T - PAD_B)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        <path d={curveD} fill="none" stroke="#5EEAD4" strokeWidth="2" />
        <line x1={markX} x2={markX} y1={PAD_T} y2={CHART_H - PAD_B} stroke="#5EEAD4" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
        <circle cx={markX} cy={markY} r="3" fill="#5EEAD4" />
        {/* "47% · your next turn" runs ~100-110px at this size — flip to
            right-of-line only when there's room for the whole string
            after it, not just a few spare px past the dot itself, or the
            label runs off the chart's own right edge (measured: it did,
            with the old markX > CHART_W - 60 threshold). */}
        <text
          x={markX > CHART_W - PAD_R - 110 ? Math.max(PAD_L + 4, markX - 6) : Math.min(CHART_W - PAD_R - 4, markX + 6)}
          y={Math.max(PAD_T + 9, markY - 6)}
          textAnchor={markX > CHART_W - PAD_R - 110 ? 'end' : 'start'}
          fontSize="9"
          fontFamily="var(--font-plex, monospace)"
          fill="rgba(255,255,255,0.55)"
        >
          {`${markedPct}% · your next turn`}
        </text>
      </svg>
    </div>
  )
}

// The live PPR-toggle demo used to live in this section, in a two-column
// layout beside these three cards. A design review found it buried a full
// scroll down the page while the hero above showed a static, non-
// interactive board instead — so the demo moved up into Hero.jsx (see
// ScoringDemoCard.jsx). Homepage v4 pass 2 gives cards 01 and 02 their own
// live charts back — not the same demo repeated, a different proof for
// each claim — while leaving the grade a static card, since it's already
// demonstrated live in the "Take a pick" module above this section.
export default function ShowYourWorking() {
  const [format, setFormat] = useState('half')
  // Called once here, not inside both SurvivalChart and its state label —
  // two calls would run the identical featured-player search and curve
  // build twice for the same render, the same class of waste "nothing may
  // be written down twice" exists to catch in the calculations themselves.
  const survivalData = useFeaturedSurvival()

  return (
    <section id="proof" className="relative isolate mx-auto max-w-7xl px-6 py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[400px] w-[900px]"
        style={{
          background: 'radial-gradient(ellipse 900px 400px at 50% 0%, rgba(34,211,238,0.05), transparent 70%)',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="max-w-[720px]"
      >
        <h2 className="text-balance font-display text-[30px] font-extrabold italic leading-[1.15] tracking-[-0.015em] sm:text-[38px] sm:leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.025em]">
          <span className="text-white">Show Your Working </span>
          {/* text-white/25 measured 2.13:1 here — under even the 3:1 bar
              large bold text gets, pre-existing and found during homepage
              v4 pass 3's contrast audit rather than introduced by it.
              #8e9aa1: same fix as everywhere else in this pass. */}
          <span className="not-italic" style={{ color: '#8e9aa1' }}>—</span>
          <span className="text-white"> No Black Box</span>
        </h2>
        <p className="mt-4 text-[17px] leading-[1.55] text-white/55">
          Every number Juke prints is one you can follow. Re-calculated live off real market data.
        </p>
      </motion.div>

      {/* Two equal charted cards side by side, the static grade card below
          them as a full-width row (§4.4) — not squeezed into a third
          column, since it isn't a third chart. */}
      <div className="mt-[42px] grid gap-[14px] lg:grid-cols-2">
        <div className="flex h-full flex-col rounded-[14px] border border-white/[0.07] bg-[#0d1216] px-[26px] py-6 transition-colors duration-200 hover:border-teal-400/70">
          <div className="flex items-start justify-between gap-3">
            <p className="font-plex text-[11px] font-semibold tracking-[0.12em] text-teal-400">
              01 &middot; VORP
            </p>
            {/* h-11 (44px) below md — §9 names this exact control ("the
                scoring toggle"). Measured at 23px with the original
                py-1 sizing, found during homepage v4 pass 3's tap-target
                audit. md:h-7 keeps a compact desktop chip, same split
                AccountButtons (SiteNav.jsx) uses for the same reason. */}
            <div className="flex shrink-0 gap-1 rounded-full bg-white/5 p-1">
              {FORMATS.map((f) => (
                <button
                  key={f.format}
                  type="button"
                  onClick={() => setFormat(f.format)}
                  className={`inline-flex h-11 items-center justify-center rounded-full px-2 font-plex text-[10px] font-semibold transition-colors duration-200 md:h-7 ${
                    format === f.format ? 'bg-teal-500 text-obsidian' : 'text-[#8e9aa1] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <h3 className="mt-[9px] font-display text-[17px] font-bold text-white">Value over replacement</h3>
          <p className="mt-[9px] text-[15px] leading-[1.55] text-[#8e9aa1]">
            Every player is scored against the last startable player at their position, not against each other.
          </p>
          <VorpChart format={format} />
        </div>

        <div className="flex h-full flex-col rounded-[14px] border border-white/[0.07] bg-[#0d1216] px-[26px] py-6 transition-colors duration-200 hover:border-teal-400/70">
          <div className="flex items-start justify-between gap-3">
            <p className="font-plex text-[11px] font-semibold tracking-[0.12em] text-teal-400">
              02 &middot; SURVIVAL
            </p>
            {survivalData && (
              <span className="shrink-0 font-plex text-[11px] font-semibold text-[#8e9aa1]">{survivalData.player.name}</span>
            )}
          </div>
          <h3 className="mt-[9px] font-display text-[17px] font-bold text-white">The odds they last</h3>
          <p className="mt-[9px] text-[15px] leading-[1.55] text-[#8e9aa1]">{SURVIVAL_BODY}</p>
          <SurvivalChart data={survivalData} />
        </div>
      </div>

      <div className="mt-[14px] rounded-[14px] border border-white/[0.07] bg-[#0d1216] px-[26px] py-6 transition-colors duration-200 hover:border-teal-400/70">
        <p className="font-plex text-[11px] font-semibold tracking-[0.12em] text-teal-400">03 &middot; THE GRADE</p>
        <h3 className="mt-[9px] font-display text-[17px] font-bold text-white">Four parts, each shown</h3>
        <p className="mt-[9px] max-w-[640px] text-[15px] leading-[1.55] text-[#8e9aa1]">{GRADE_BODY}</p>
      </div>
    </section>
  )
}
