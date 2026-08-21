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

const FEATURES = [
  {
    title: 'Change a rule. Every number moves.',
    body: 'Every projection on the board reruns through the scoring table the instant you edit it — nothing is cached.',
  },
  {
    title: 'The score shows its working.',
    body: 'Points above replacement, not a black-box rating — you can always see what a number is measuring against.',
  },
  {
    title: 'Rebuilt every morning.',
    body: "ADP and injury data refresh nightly, so the board reflects this week's market, not last month's.",
  },
]

export default function ShowYourWorking() {
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
        className="mx-auto max-w-[720px] text-center"
      >
        {/* Same reasoning as Hero.jsx's h1: the brief's 46px is a desktop-
            only value, and at that size on a phone "Show Your Working — No
            Black Box" wraps to three uneven lines with the em dash stranded
            alone on one of them. */}
        <h2 className="text-balance font-display text-[30px] font-extrabold italic leading-[1.15] tracking-[-0.015em] sm:text-[38px] sm:leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.025em]">
          <span className="text-white">Show Your Working </span>
          <span className="not-italic text-white/25">—</span>
          <span className="text-white"> No Black Box</span>
        </h2>
        <p className="mt-4 text-[17px] leading-[1.55] text-white/55">
          Every number Juke prints is one you can follow. Re-calculated live off real market data.
        </p>
      </motion.div>

      <div className="mt-[52px] grid gap-7 lg:grid-cols-[0.85fr_1fr] lg:items-start">
        <div className="flex flex-col gap-[14px]">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-[14px] border border-white/[0.07] bg-[#0d1216] px-[26px] py-6 transition-colors duration-200 hover:border-teal-400/70"
            >
              <h3 className="font-display text-[17px] font-bold text-white">{f.title}</h3>
              <p className="mt-[9px] text-[15px] leading-[1.55] text-[#8e9aa1]">{f.body}</p>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl border border-white/[0.09] px-[26px] pb-[26px] pt-6"
          style={{ background: 'linear-gradient(170deg, #111a1f, #0b1013)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-base font-bold text-white">Points per reception</span>
            <div className="inline-flex gap-1 rounded-full bg-white/5 p-1">
              {PPR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPpr(opt.value)}
                  className={`rounded-full px-[15px] py-[7px] text-[13px] font-semibold transition-all duration-200 ${
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
                  className="grid grid-cols-[22px_34px_1fr_auto] items-center gap-[14px] rounded-[11px] border border-white/[0.06] bg-[#0c1114] px-4 py-[14px]"
                >
                  <span className="text-right font-plex text-xs text-white/40">{row.rank}</span>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold ${POS_BADGE[row.player.pos] || 'bg-white/10 text-white/50'}`}>
                    {row.player.pos}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 truncate text-[15.5px] font-semibold text-white/90">
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

          <p className="mt-[18px] font-plex text-[11.5px] text-white/40">
            Projected season points · {ppr === 1 ? '1.0' : ppr === 0.5 ? '0.5' : 'no reception bonus'}
            {ppr !== 0 && ' per reception'}
          </p>
        </div>
      </div>
    </section>
  )
}
