import { useEffect, useState } from 'react'

// Every fact here is read off the live board via the bridge. It used to
// carry six invented stats too — a mock-draft count and a bye-week clash
// rate with nothing behind them — presented as fact, which is exactly what
// this project's own pipeline refuses to do anywhere else. Those two have
// no real source (Juke keeps no usage analytics) and are dropped rather
// than replaced with a different invented number.
const POS_WORD = { QB: 'quarterback', RB: 'running back', WR: 'wide receiver', TE: 'tight end' }

// PLAYERS_META.generated is a raw pipeline timestamp — "2026-08-22 01:35
// UTC" — meant for a build log, not a reader. Parsed by hand into a real
// Date rather than handed to `new Date(str)` directly: that string isn't
// ISO 8601, so parsing it is left to each browser's own legacy fallback
// (reliable in practice, not guaranteed by spec) — constructing the UTC
// timestamp explicitly removes the guesswork.
function parseGenerated(stamp) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})\s*UTC$/.exec(stamp || '')
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  return Date.UTC(+y, +mo - 1, +d, +h, +mi)
}

// Same scale InProgressBand.jsx's own elapsed() already uses for a running
// draft, extended with a day step: a missed pipeline run is a real,
// visible possibility (CLAUDE.md — "even if every one comes back empty the
// list still earns its place"), not just a hypothetical to round away.
function timeAgo(stamp) {
  const ms = parseGenerated(stamp)
  if (ms == null) return stamp
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// Meta (player count + freshness) is split from the scrolling facts now —
// see Ticker.jsx's own render below for why — so this returns both rather
// than one flat list.
function useTickerData() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return

    // Re-read on "juke:header" — the same "something changed, re-read the
    // bridge" signal DraftRoom.jsx's own useJukeTick() listens for — rather
    // than once on mount. A design review caught this ticker reporting a
    // different pick number for the same "first QB off the board" claim on
    // two different screens; both read the identical board() function, but
    // a one-time effect freezes whatever it returned at first mount, and
    // buildBoard() replaces that array outright (a new reference, not an
    // in-place mutation) the moment league settings change. Two mounts
    // holding two stale snapshots from two different moments is what "two
    // implementations" looks like even though there is only one function
    // computing this — the fix is to keep reading, not to add a second
    // reader.
    const read = () => {
      const board = engine.board()
      const league = engine.league()
      const meta = engine.playersMeta()
      const firstAt = (pos) => board.find((p) => p.pos === pos)

      const facts = []
      if (board[0]) facts.push(`${board[0].name} is the top overall pick`)
      ;['QB', 'RB', 'WR', 'TE'].forEach((pos) => {
        const p = firstAt(pos)
        if (p) facts.push(`${p.name} is the first ${POS_WORD[pos]} off the board, at pick ${p.overall}`)
      })
      // Same two gates cpuScore() enforces (app.js: a kicker before the
      // last two rounds and a defense before the last three both score
      // 999, i.e. never chosen) — read here rather than re-decided, so
      // this can't drift from the rule the CPU actually plays by.
      if (league) {
        facts.push(`Kickers stay undrafted until round ${league.rounds - 1}`)
        facts.push(`Defenses stay undrafted until round ${league.rounds - 2}`)
      }

      setData({ meta, facts })
    }

    read()
    window.addEventListener('juke:header', read)
    return () => window.removeEventListener('juke:header', read)
  }, [])

  return data
}

function TickerRow({ items, ariaHidden = false }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden}>
      {items.map((item, i) => (
        <span
          key={i}
          className="flex shrink-0 items-center gap-[34px] whitespace-nowrap pl-[34px] font-plex text-xs text-mint"
        >
          {item}
          <span className="h-[3px] w-[3px] rounded-full bg-white/15" />
        </span>
      ))}
    </div>
  )
}

export default function Ticker() {
  const data = useTickerData()
  if (!data || data.facts.length === 0) return null

  return (
    <div className="hidden h-9 border-t border-white/5 bg-[#0a0e12] md:flex">
      {/* Pinned to the left edge on its own opaque fill, in normal flex
          flow rather than absolutely positioned over the marquee — a
          design review caught a floating pill (unrelated to this
          component; a Draft-Room-only "reopen insights" control that
          happened to land in the same band) obscuring scrolling text
          underneath it. Giving this its own flex slot means there is
          nothing behind it to obscure, on this screen or any future one:
          the scrolling region starts after it, not beneath it. */}
      {data.meta && (
        <div className="flex shrink-0 items-center gap-[7px] whitespace-nowrap border-r border-white/[0.06] bg-[#0d1318] px-4 font-plex text-[11px] font-medium text-white/75">
          <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-mint" aria-hidden="true" />
          {data.meta.count} players &middot; refreshed {timeAgo(data.meta.generated)}
        </div>
      )}

      {/* Same CSS-marquee shape LiveScoresTicker.jsx's own comment
          explains: a native compositor-thread loop has no restart seam for
          React/Framer to hitch on at the wraparound, and
          animation-play-state gives a real, position-preserving pause on
          hover for free — a JS-driven animate() has neither. 90s (was 64s
          for five shorter items) keeps the same reading speed now that the
          badge above carries its own slot and seven facts, not four, fill
          the scroll — motion-reduce turns the loop off outright rather
          than merely slowing it, since a slow crawl is still motion
          someone asked not to see. */}
      <div
        className="relative h-full min-w-0 flex-1 overflow-hidden"
        style={{ maskImage: 'linear-gradient(90deg, transparent, black 28px, black calc(100% - 28px), transparent)' }}
      >
        <div className="flex h-full w-max items-center [animation-play-state:running] motion-reduce:!animate-none animate-[marquee_90s_linear_infinite] hover:[animation-play-state:paused]">
          <TickerRow items={data.facts} />
          <TickerRow items={data.facts} ariaHidden />
        </div>
      </div>
    </div>
  )
}
