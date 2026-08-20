import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

const ordinal = (n) => {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`
}

// The dark-charcoal container every data section here sits in — 1px border
// that subtly glows on hover, matching the card treatment the rest of the
// draft room already uses (same slate-800 border, same teal accent).
const PANEL =
  'rounded-2xl border border-slate-800 bg-slate-900/60 transition-all duration-300 ' +
  'hover:border-teal-400/40 hover:shadow-[0_0_18px_rgba(0,229,255,0.12)]'

// The four grade components, in the order and under the names the Analysis
// tab's own bars use — these ARE the radar's axes, so when a charting
// canvas drops into the middle later it inherits real, already-labelled
// dimensions rather than inventing its own.
const AXES = [
  { key: 'startersScaled', label: 'Starters' },
  { key: 'valueScaled', label: 'Value' },
  { key: 'buildScaled', label: 'Build' },
  { key: 'byePenaltyScaled', label: 'Byes' },
]

/* Scaffold only, on purpose: the styled frame, the rings and the four real
   axes — the data polygon arrives with the charting library. The axis
   labels already carry each component's real 0-100 scaled score so the
   panel says something true in the meantime instead of standing empty. */
function RadarScaffold({ mine }) {
  const cx = 110
  const cy = 100
  const r = 68
  // Four axes: up, right, down, left.
  const points = AXES.map((axis, i) => {
    const angle = (Math.PI / 2) * i - Math.PI / 2
    return {
      ...axis,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      score: Math.round(mine[axis.key]),
    }
  })

  return (
    <svg viewBox="0 0 220 200" className="mx-auto w-full max-w-[300px]" aria-hidden="true">
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={points.map((p) => `${cx + (p.x - cx) * ring},${cy + (p.y - cy) * ring}`).join(' ')}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth="1"
        />
      ))}
      {points.map((p) => (
        <line key={p.key} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(0,229,255,0.25)" strokeWidth="1" />
      ))}
      {points.map((p, i) => (
        <text
          key={p.key + '-label'}
          x={cx + (p.x - cx) * 1.22}
          y={cy + (p.y - cy) * 1.22 + (i === 0 ? -2 : i === 2 ? 8 : 4)}
          textAnchor="middle"
          className="fill-white/60"
          fontSize="10"
          fontWeight="600"
        >
          {p.label} · {p.score}
        </text>
      ))}
      <circle cx={cx} cy={cy} r="2" fill="rgba(0,229,255,0.5)" />
    </svg>
  )
}

/* Each starter against the replacement baseline at his own position —
   engine.replacementGap(), the same un-clamped VORP figure the Juke score
   is built from, never a second computation. The center line IS the
   baseline: teal grows right for value above a replacement starter, red
   grows left for below. K/DST read a dash, not a bar — the projection
   can't rank those positions (see CLAUDE.md), and drawing a red bar from a
   number we refuse to trust elsewhere would be the withholding-has-to-be-
   complete bug all over again. */
function VorpRow({ seat, gap, maxAbs }) {
  const player = seat.player
  const width = gap !== null && maxAbs > 0 ? (Math.abs(gap) / maxAbs) * 100 : 0

  return (
    <div className="flex items-center gap-2">
      <span
        className={
          'w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ' +
          (player ? POS_BADGE[player.pos] || 'bg-white/10 text-white/50' : 'bg-white/5 text-white/25')
        }
      >
        {seat.slot}
      </span>
      <span className={'w-28 shrink-0 truncate text-xs sm:w-36 ' + (player ? 'font-medium text-white/85' : 'text-white/25')}>
        {player ? player.name : 'Empty'}
      </span>

      <div className="relative h-4 min-w-0 flex-1">
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
        {player && gap !== null && (
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${width / 2}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className={
              'absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm ' +
              (gap >= 0
                ? 'left-1/2 bg-gradient-to-r from-teal-500/80 to-teal-300 shadow-[0_0_8px_rgba(0,229,255,0.35)]'
                : 'right-1/2 bg-gradient-to-l from-rose-600/80 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.35)]')
            }
          />
        )}
      </div>

      <span
        className={
          'w-12 shrink-0 text-right text-xs font-semibold tabular-nums ' +
          (gap === null || !player ? 'text-white/25' : gap >= 0 ? 'text-teal-300' : 'text-rose-400')
        }
      >
        {!player || gap === null ? '—' : (gap >= 0 ? '+' : '') + Math.round(gap)}
      </span>
    </div>
  )
}

// Shown the moment a draft concludes (DraftRoom.jsx flips it on off the
// draftOver() edge) and reopenable from the pill it leaves behind. All of
// it is real: the grade is engine.draftAnalysis() — the identical
// analyseDraft() the legacy standings print — and every bar is
// replacementGap() over the real seated lineup.
export default function DraftInsightsDashboard({ engine, league, mySlot, onClose }) {
  const analysis = engine.draftAnalysis()
  const mine = analysis && analysis[mySlot]
  if (!mine) return null

  const lineup = engine.seatedLineup(mySlot)
  const seats = lineup?.seats || []
  const gaps = seats.map((seat) => (seat.player ? engine.replacementGap(seat.player) : null))
  const maxAbs = Math.max(1, ...gaps.filter((g) => g !== null).map((g) => Math.abs(g)))

  const bargain = mine.bargain && mine.bargain.gap > 0 ? mine.bargain : null
  const reach = mine.reach || null

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0B0E14]/97 backdrop-blur-md">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">Draft complete</p>
            <h1 className="font-display text-2xl font-bold text-white">Draft Insights</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="View the board"
            aria-label="Close insights and view the board"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950/60 text-white/60 transition-colors duration-150 hover:border-teal-400/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary card — the grade, large and glowing, in the two brand
            accents. Rank and weighted total sit beside it because the
            letter is handed out for finishing position (see CLAUDE.md's
            standings note): a grade without its rank invites the reader
            to take a room-relative ranking as an absolute verdict. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={PANEL + ' flex flex-col items-center gap-4 p-6 sm:flex-row sm:justify-between sm:p-8'}
        >
          <div className="flex items-center gap-5">
            <span className="bg-gradient-to-br from-[#00E5FF] to-[#7B1FA2] bg-clip-text font-display text-7xl font-black leading-none text-transparent drop-shadow-[0_0_28px_rgba(0,229,255,0.35)] sm:text-8xl">
              {mine.grade}
            </span>
            <div>
              <p className="font-display text-xl font-bold text-white">
                {ordinal(mine.rank)} <span className="text-white/40">of {league.teams}</span>
              </p>
              <p className="mt-0.5 text-sm text-white/50">
                {Math.round(mine.total)} <span className="text-white/30">/ 100 weighted score</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs sm:text-right">
            {bargain && (
              <p className="text-white/60">
                <span className="font-semibold uppercase tracking-wide text-teal-400">Best value</span>{' '}
                {bargain.pick.player.name} <span className="text-white/35">· {bargain.gap} picks late</span>
              </p>
            )}
            {reach && (
              <p className="text-white/60">
                <span className="font-semibold uppercase tracking-wide text-rose-400">Biggest reach</span>{' '}
                {reach.pick.player.name} <span className="text-white/35">· {Math.abs(reach.gap)} picks early</span>
              </p>
            )}
          </div>
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Team Analysis</h2>
            <p className="mb-3 mt-0.5 text-xs text-white/35">The four grade components, scaled against the room</p>
            <RadarScaffold mine={mine} />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">VORP Matrix</h2>
            <p className="mb-3 mt-0.5 text-xs text-white/35">
              Each starter against a replacement-level player at his position
            </p>
            <div className="flex flex-col gap-1.5">
              {seats.map((seat, i) => (
                <VorpRow key={i} seat={seat} gap={gaps[i]} maxAbs={maxAbs} />
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-white/25">
              Kickers and defenses show a dash: measured against three seasons of archived forecasts the
              projection ranks them no better than chance, so no bar is drawn from it.
            </p>
          </motion.section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mx-auto rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white/60 transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300"
        >
          View the full board
        </button>
      </div>
    </div>
  )
}
