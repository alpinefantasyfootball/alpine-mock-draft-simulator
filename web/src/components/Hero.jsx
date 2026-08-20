import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

const POS_STYLE = {
  QB: 'bg-violet-500/15 text-violet-300',
  RB: 'bg-emerald-500/15 text-emerald-300',
  WR: 'bg-sky-500/15 text-sky-300',
  TE: 'bg-amber-500/15 text-amber-300',
  K: 'bg-rose-500/15 text-rose-300',
  DST: 'bg-slate-500/15 text-slate-300',
}

const SHOT_TEAMS = 10 // must match app.js's SHOT_TEAMS — shotPicks() is drafted at this team count

// Real picks from the live board — window.JukeEngine.shotPicks() runs the
// same simulated 50-pick snake draft the old renderHeroShot() did, off the
// same board, the same valuation. Nothing here is invented; it just re-reads
// on every mount rather than caching, since board is live and mutating.
function useBoardPreview(count) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    const drafter = typeof window !== 'undefined' ? window.DraftEngine : null
    if (!engine || !drafter) return

    const picks = engine.shotPicks()
    setRows(
      picks.slice(0, count).map((p, i) => ({
        pick: drafter.pickCode(i + 1, SHOT_TEAMS),
        pos: p.pos,
        name: engine.shortName(p),
        team: p.team,
      }))
    )
  }, [count])

  return rows
}

export default function Hero() {
  const boardPreview = useBoardPreview(5)

  return (
    <section className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-24 lg:grid-cols-2 lg:items-center lg:pt-32">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <span className="inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1 text-xs font-semibold tracking-[0.15em] text-teal-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
          </span>
          AGILITY THROUGH ANALYTICS
        </span>

        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-white to-teal-300 bg-clip-text text-transparent">
            Draft with the numbers
          </span>
          <br />
          <span className="bg-gradient-to-r from-white to-teal-300 bg-clip-text text-transparent">
            already done.
          </span>
        </h1>

        <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/55">
          Instant mock drafts against a board that already knows ADP, tiers and replacement
          level. Scoring rules are yours to set — every projection reruns through a VORP
          algorithm the moment you change one.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-6">
          {/* #/draft-room, not #/draft — see the comment on ROOMS[0].href
              in app.js. This is the product's actual "start" button, so it
              was the most direct way this bug shipped. */}
          <a
            href="#/draft-room"
            className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-7 py-3.5 text-base font-semibold text-white
                       shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
          >
            Start a Mock Draft
          </a>
          <a
            href="#rooms"
            className="group inline-flex items-center gap-1 text-sm font-medium text-white/70 transition-colors hover:text-teal-300"
          >
            Explore The Rooms
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </motion.div>

      <motion.div
        className="relative mx-auto w-full max-w-sm"
        initial={{ opacity: 0, scale: 0.95, rotate: 0 }}
        animate={{ opacity: 1, scale: 1, rotate: -4, y: [0, -12, 0] }}
        transition={{
          opacity: { duration: 0.7, delay: 0.2 },
          scale: { duration: 0.7, delay: 0.2 },
          y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 },
        }}
      >
        <div className="glass-panel rounded-2xl p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-display text-sm font-semibold text-white">Live board</span>
            {boardPreview.length > 0 && (
              <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-300">
                Round {boardPreview[boardPreview.length - 1].pick.split('.')[0]}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {boardPreview.map((row) => (
              <div
                key={row.pick}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
              >
                <span className="w-9 shrink-0 font-mono text-[11px] text-white/35">{row.pick}</span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${POS_STYLE[row.pos]}`}>
                  {row.pos}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-white/90">{row.name}</span>
                <span className="shrink-0 text-[11px] text-white/35">{row.team}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute -bottom-6 -right-6 -z-10 h-40 w-40 rounded-full bg-[#7B1FA2]/30 blur-3xl" />
        <div className="absolute -left-8 -top-6 -z-10 h-32 w-32 rounded-full bg-[#00E5FF]/20 blur-3xl" />
      </motion.div>
    </section>
  )
}
