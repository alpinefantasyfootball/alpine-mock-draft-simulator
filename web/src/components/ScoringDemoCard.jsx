import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

// standard/half/full PPR — the same three keys rulesForFormat() already
// knows, so "0 / 0.5 / 1" in the UI maps straight onto the real format names
// rather than a second copy of what those numbers mean.
const PPR_OPTIONS = [
  { value: 0, format: 'standard', label: 'Standard' },
  { value: 0.5, format: 'half', label: 'Half PPR' },
  { value: 1, format: 'ppr', label: 'Full PPR' },
]

// A fixed set of six real, PPR-relevant skill players, chosen once (sorted
// by half-PPR points) and re-scored live as the toggle changes — the pool
// itself is real board data via the bridge, not invented. K/DST are excluded
// (FORCED_LATE) the same way the app's own suggestions engine treats them,
// and only players a reception rule can actually move are eligible, same
// filter the deleted proofScoring() used.
function usePlayerPool(count) {
  const [pool, setPool] = useState([])

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return

    const statKeys = engine.statKeys()
    const forcedLate = engine.forcedLate()
    if (!statKeys) return

    const eligible = engine
      .board()
      .filter((p) => {
        if (forcedLate[p.pos]) return false
        const s = engine.statOf(p)
        return s && s.p && s.p.gp > 0 && s.p[statKeys.rec] > 0
      })
      .map((p) => ({ player: p, half: engine.pointsUnder(engine.statOf(p).p, engine.rulesForFormat('half')) }))
      .sort((a, b) => b.half - a.half)
      .slice(0, count)
      .map((row) => row.player)

    setPool(eligible)
  }, [count])

  return pool
}

// The interactive proof behind "Show Your Working" — every number here
// reruns live off the real board when the PPR toggle is clicked, which is
// the one thing on the page a reader can't fake by looking at a screenshot:
// they have to click it. Its own component, not inlined into Hero.jsx or
// ShowYourWorking.jsx, because a design review found it buried below a full
// scroll behind a static, non-interactive board card in the hero — this is
// now the hero's own second column, and ShowYourWorking.jsx (further down
// the page) no longer carries a second copy of the same demo.
export default function ScoringDemoCard() {
  const pool = usePlayerPool(6)
  const [ppr, setPpr] = useState(1)
  const prevRanks = useRef({})
  const [deltas, setDeltas] = useState({})

  const engine = typeof window !== 'undefined' ? window.JukeEngine : null
  const format = PPR_OPTIONS.find((o) => o.value === ppr)?.format ?? 'ppr'
  const rules = engine ? engine.rulesForFormat(format) : null

  const ranked = engine
    ? pool
        .map((p) => ({ player: p, points: engine.pointsUnder(engine.statOf(p).p, rules) }))
        .sort((a, b) => b.points - a.points)
        .map((row, i) => ({ ...row, rank: i + 1 }))
    : []

  useEffect(() => {
    const nextDeltas = {}
    ranked.forEach((row) => {
      const prev = prevRanks.current[row.player.name]
      nextDeltas[row.player.name] = prev == null ? 0 : prev - row.rank
    })
    setDeltas(nextDeltas)
    const nextRanks = {}
    ranked.forEach((row) => {
      nextRanks[row.player.name] = row.rank
    })
    prevRanks.current = nextRanks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppr, pool])

  return (
    <div
      className="rounded-2xl border border-white/[0.09] px-[22px] pb-[22px] pt-6"
      style={{ background: 'linear-gradient(170deg, #111a1f, #0b1013)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-base font-bold text-white">Points per reception</span>
        <div className="inline-flex gap-1 rounded-full bg-white/5 p-1">
          {PPR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPpr(opt.value)}
              className={`rounded-full px-[13px] py-[6px] text-[12.5px] font-semibold transition-all duration-200 ${
                ppr === opt.value ? 'bg-teal-500 text-obsidian shadow-[0_0_12px_rgba(0,229,255,0.5)]' : 'text-white/50 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-[7px]">
        {ranked.map((row) => {
          const delta = deltas[row.player.name] || 0
          return (
            <motion.div
              key={row.player.name}
              layout
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              className="grid grid-cols-[20px_32px_1fr_auto] items-center gap-3 rounded-[11px] border border-white/[0.06] bg-[#0c1114] px-[14px] py-[12px]"
            >
              <span className="text-right font-plex text-xs text-white/40">{row.rank}</span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold ${POS_BADGE[row.player.pos] || 'bg-white/10 text-white/50'}`}>
                {row.player.pos}
              </span>
              <span className="flex min-w-0 items-center gap-2 truncate text-[14.5px] font-semibold text-white/90">
                {row.player.name}
                {delta > 0 && (
                  <ArrowUp className="h-3.5 w-3.5 shrink-0 text-teal-400 drop-shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
                )}
                {delta < 0 && <ArrowDown className="h-3.5 w-3.5 shrink-0 text-white/30" />}
              </span>

              <span className="shrink-0 text-right font-plex text-sm text-[#cbd5da]">
                {row.points.toFixed(1)}
              </span>
            </motion.div>
          )
        })}
      </div>

      <p className="mt-4 font-plex text-[11px] text-white/40">
        Projected season points · {ppr === 1 ? '1.0' : ppr === 0.5 ? '0.5' : 'no reception bonus'}
        {ppr !== 0 && ' per reception'}
      </p>
    </div>
  )
}
