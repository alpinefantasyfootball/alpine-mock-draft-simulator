import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'

// This used to carry its own POS_STYLE map — the palette draftRoomPositions.js's
// own header comment already documents as retired for being "too similar"
// (violet/sky/amber/rose/slate), replaced by POS_BADGE's orange/emerald/blue/
// fuchsia/yellow/indigo everywhere *except* here. Homepage.jsx renders this
// component and ShowYourWorking.jsx (which already imports POS_BADGE
// correctly) on the same scroll, so a visitor saw QB badged violet at the
// top of the page and orange further down — the same position reading as two
// different colors on one screen, the exact drift POS_BADGE exists to end.

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
    <section className="relative overflow-hidden">
      {/* Background glow, per the brief — an ellipse behind the text
          column rather than a full-bleed band, so it reads as depth on the
          void background rather than a second surface. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 left-1/2 h-[620px] w-[1100px] -translate-x-[30%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(34,211,238,0.11), rgba(123,31,162,0.05) 45%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-[72px] px-6 pb-[76px] pt-[92px] lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex items-center gap-[9px] rounded-full border border-mint/30 bg-mint/[0.06] px-[15px] py-[7px] text-[11.5px] font-bold tracking-[0.13em] text-mint">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
            </span>
            AGILITY THROUGH ANALYTICS
          </span>

          {/* The brief's 64px is a desktop-only value (prototype captured at
              ~1440px) — scaled down for narrower widths rather than copied
              literally, or "Master the draft." alone overflows a phone's
              own padding before wrapping ever gets a say. */}
          <h1 className="mt-7 text-balance font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[52px] sm:leading-[1.04] lg:text-[64px] lg:leading-[1.03] lg:tracking-[-0.032em]">
            <span className="text-white">Master the draft.</span>
            <br />
            <span className="text-mint">Dominate the season.</span>
          </h1>

          <p className="mt-6 max-w-[530px] text-pretty text-[17.5px] leading-[1.6] text-white/55">
            Free, unlimited mock drafts are just the beginning. Power your entire fantasy
            football lifecycle with advanced VORP metrics, predictive modeling, and
            real-time simulations that give you an edge every single week.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-[26px]">
            {/* #/draft-room, not #/draft — see the comment on ROOMS in
                app.js. This is the product's actual "start" button, so it
                was the most direct way this bug shipped. */}
            <a
              href="#/draft-room"
              className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-8 py-4 text-base font-bold text-white
                         shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
            >
              Start a Free Mock Draft
            </a>
            <a
              href="#rooms"
              className="group inline-flex items-center gap-2 text-base font-semibold text-white/90 transition-colors hover:text-mint"
            >
              Explore The Rooms
              <ChevronRight className="h-4 w-4 text-teal-400 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </motion.div>

        {/* Not rotated, not floating — squared and aligned as a real second
            grid column, unlike the tilted card this replaced. The brief is
            explicit about this being deliberate: a denser, more structured
            page reads calmer without a tilted panel drawing the eye first. */}
        <motion.div
          className="relative mx-auto w-full max-w-sm"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div
            className="rounded-[18px] border border-white/[0.08] p-[22px] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)]"
            style={{ background: 'linear-gradient(165deg, #10171c, #0b1014)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-[15px] font-bold text-white">Live board</span>
              {boardPreview.length > 0 && (
                <span className="rounded-full bg-mint/[0.12] px-3 py-[5px] font-plex text-[11px] font-semibold text-mint">
                  Round {boardPreview[boardPreview.length - 1].pick.split('.')[0]}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {boardPreview.map((row) => (
                <div
                  key={row.pick}
                  className="grid grid-cols-[46px_34px_1fr_auto] items-center gap-3 rounded-[11px] border border-white/[0.06] bg-[#0d1317] px-[15px] py-[13px]"
                >
                  <span className="shrink-0 font-plex text-[12.5px] text-white/40">{row.pick}</span>
                  <span className={`shrink-0 rounded-[5px] py-[3px] text-center font-plex text-[10.5px] font-semibold ${POS_BADGE[row.pos]}`}>
                    {row.pos}
                  </span>
                  <span className="min-w-0 truncate text-[15px] font-semibold text-white/90">{row.name}</span>
                  <span className="shrink-0 font-plex text-[11px] text-white/35">{row.team}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
