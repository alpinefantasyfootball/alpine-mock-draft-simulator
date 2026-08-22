import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

// standard/half/full PPR — the same three keys rulesForFormat() already
// knows, so "0 / 0.5 / 1" in the UI maps straight onto the real format names
// rather than a second copy of what those numbers mean. shortLabel is the
// mobile segmented control's own label set (design_handoff_mobile) — three
// pills across a 343px-wide card have less room than desktop's row, so
// "Half PPR" loses its second word there; value/format (the only fields the
// scoring math reads) are identical, so there's still one definition of
// what the three formats are, just two label strings for two widths.
const PPR_OPTIONS = [
  { value: 0, format: 'standard', label: 'Standard', shortLabel: 'Standard' },
  { value: 0.5, format: 'half', label: 'Half PPR', shortLabel: 'Half' },
  { value: 1, format: 'ppr', label: 'Full PPR', shortLabel: 'Full PPR' },
]

// The mobile card's closing line — dynamic by format rather than the static
// "the receivers climb and Barkley slides" the mock illustrates: which six
// players are even in the pool is real, nightly-refreshed board data (see
// usePlayerPool below), so a sentence naming specific movers would be wrong
// the first morning the board changes and is exactly the kind of hardcoded
// name CLAUDE.md's product-shot section already warns against. This says
// what's universally true of the rule instead.
const PPR_EXPLAIN = {
  standard: 'Receptions are worth nothing here, so this board rewards rushing and touchdowns alone.',
  half: 'Receptions are worth half a point here — real movement, gentler than full PPR.',
  ppr: 'Receptions are worth a full point here, so pass-catchers climb and pure runners slide.',
}

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

  // Mobile shows five rows, not desktop's six (design_handoff_mobile Prompt
  // 2) — sliced off the same ranked-six rather than fetching a second,
  // differently-sized pool, so both widths agree on who's #1-#5 and mobile
  // just doesn't get a bonus sixth row.
  const mobileRanked = ranked.slice(0, 5)

  return (
    <>
      {/* ---------- Mobile: design_handoff_mobile Prompt 2 ----------
          Promoted into the hero itself (Hero.jsx mounts this component
          unconditionally; the grid it sits in already stacks below `lg`,
          so no repositioning was needed, only this card's own content).
          Shares every hook/state above with the desktop render below —
          usePlayerPool, ppr, deltas — rather than a second copy of the
          scoring math, the same rule CLAUDE.md states for the CPU and the
          grade: nothing about how a player is scored gets written down
          twice. */}
      <div
        className="rounded-2xl border border-white/[0.09] p-5 lg:hidden"
        style={{ background: 'linear-gradient(170deg, #111a1f, #0b1013)' }}
      >
        <p className="font-plex text-[11px] font-semibold tracking-[0.12em] text-[#7C8A99]">
          CHANGE THE RULES, WATCH IT RERUN
        </p>

        {/* Full PPR / Half / Standard, left to right — the mock's own
            order, reversed from desktop's Standard-first array rather than
            a second options list, so value/format never drift between the
            two segmented controls. h-11 (44px) on every pill: the handoff's
            own tap-target floor, not met by desktop's shorter chip. */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-white/5 p-1">
          {[...PPR_OPTIONS].reverse().map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPpr(opt.value)}
              className={`flex h-11 items-center justify-center rounded-full px-2 text-[13px] font-semibold transition-all duration-200 ${
                ppr === opt.value ? 'bg-teal-500 text-obsidian shadow-[0_0_12px_rgba(0,229,255,0.5)]' : 'text-white/50 hover:text-white'
              }`}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-[7px]">
          {mobileRanked.map((row) => {
            const delta = deltas[row.player.name] || 0
            const rose = delta > 0
            const fell = delta < 0
            return (
              <motion.div
                key={row.player.name}
                layout
                transition={{ type: 'spring', stiffness: 350, damping: 32 }}
                className="grid grid-cols-[16px_30px_1fr_28px] items-center gap-3 rounded-[11px] border border-white/[0.06] px-[14px] py-[12px]"
                style={{ backgroundColor: rose ? 'rgba(0,229,255,0.045)' : '#0c1114' }}
              >
                <span className="text-right font-plex text-xs text-white/40">{row.rank}</span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold ${POS_BADGE[row.player.pos] || 'bg-white/10 text-white/50'}`}>
                  {row.player.pos}
                </span>
                <span className="min-w-0 truncate text-[14.5px] font-semibold text-white/90">{row.player.name}</span>
                <span
                  className={`text-right font-plex text-[12px] font-semibold ${
                    rose ? 'text-teal-400' : fell ? 'text-[#F87171]' : 'text-[#55616f]'
                  }`}
                >
                  {rose ? `↑${delta}` : fell ? `↓${-delta}` : '—'}
                </span>
              </motion.div>
            )
          })}
        </div>

        <p className="mt-4 text-[13.5px] leading-[1.5] text-white/50">
          {PPR_EXPLAIN[format]} Every ranking on Juke moves with your rules.
        </p>
      </div>

      {/* ---------- Desktop: unchanged ---------- */}
      <div
        className="hidden rounded-2xl border border-white/[0.09] px-[22px] pb-[22px] pt-6 lg:block"
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
    </>
  )
}
