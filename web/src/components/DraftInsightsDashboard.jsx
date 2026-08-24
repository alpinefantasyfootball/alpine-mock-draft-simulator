import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { POS_BADGE } from './draftRoomPositions.js'
import ShareBar from './ShareBar.jsx'

const ordinal = (n) => {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`
}

// The dark-charcoal container every data section here sits in — 1px border
// that subtly glows on hover, matching the card treatment the rest of the
// draft room already uses (same slate-800 border, same teal accent).
const PANEL =
  'rounded-2xl border border-slate-rule bg-slate-panel/60 transition-all duration-300 ' +
  'hover:border-teal-400/40 hover:shadow-[0_0_18px_rgba(0,229,255,0.12)]'

// The four grade components, in the order and under the names the Analysis
// tab's own bars use — these are the radar's axes, so the chart can never
// invent a dimension the grade does not actually measure.
const AXES = [
  { key: 'startersScaled', label: 'Starters' },
  { key: 'valueScaled', label: 'Value' },
  { key: 'buildScaled', label: 'Build' },
  { key: 'byePenaltyScaled', label: 'Byes' },
]

/* The real radar, no charting library after all — four axes is a polygon,
   not a dependency. Rings and axes frame it; the data shape is each
   component's 0-100 room-scaled score pushed out along its own axis,
   filled with the brand gradient and dotted at the vertices so a
   collapsed axis (a genuine 0 — last in the room on that component) still
   reads as a point at the center rather than vanishing. */
function RadarChart({ mine }) {
  const cx = 110
  const cy = 100
  const r = 68
  // Four axes: up, right, down, left.
  const points = AXES.map((axis, i) => {
    const angle = (Math.PI / 2) * i - Math.PI / 2
    const score = Math.round(mine[axis.key])
    return {
      ...axis,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      dx: cx + Math.cos(angle) * r * (score / 100),
      dy: cy + Math.sin(angle) * r * (score / 100),
      score,
    }
  })
  const dataPoints = points.map((p) => `${p.dx},${p.dy}`).join(' ')

  return (
    <svg viewBox="0 0 220 200" className="mx-auto w-full max-w-[300px]" aria-hidden="true">
      <defs>
        <linearGradient id="radar-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#7B1FA2" />
        </linearGradient>
      </defs>
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

      {/* the data shape — scale-in from the center, matching the VORP
          bars' own entrance */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <polygon points={dataPoints} fill="url(#radar-fill)" fillOpacity="0.3" stroke="#00E5FF" strokeWidth="1.5" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.key + '-dot'} cx={p.dx} cy={p.dy} r="3" fill="#00E5FF" />
        ))}
      </motion.g>

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
          (player ? POS_BADGE[player.pos] || 'bg-white/10 text-white/50' : 'bg-white/5 text-ink-muted')
        }
      >
        {seat.slot}
      </span>
      <span className={'w-28 shrink-0 truncate text-xs sm:w-36 ' + (player ? 'font-medium text-white/85' : 'text-ink-muted')}>
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
          (gap === null || !player ? 'text-ink-muted' : gap >= 0 ? 'text-teal-300' : 'text-rose-400')
        }
      >
        {!player || gap === null ? '—' : (gap >= 0 ? '+' : '') + Math.round(gap)}
      </span>
    </div>
  )
}

/* Below 10 points of replacement value, a "miss" is inside the forecast's
   own error — the 2026 projection runs at MAE 6.8 against actuals (see
   CLAUDE.md's Juke score section) — so accusing a pick over a single-digit
   delta would be reading precision into a number that doesn't carry it.
   Above it, the miss is worth saying out loud. */
const MISS_FLOOR = 10

// One centered-baseline bar, shared shape with the VORP rows: teal grows
// right for a pick that fell to you, red grows left for a reach — the same
// signed gap (pick number minus board rank) the grade's value component
// counts, in the same convention its callouts already print.
function TimelineRow({ pick, gap, maxAbs, shortName }) {
  const width = maxAbs > 0 ? (Math.abs(gap) / maxAbs) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[10px] font-bold text-ink-muted">R{pick.round}</span>
      <span
        className={
          'w-9 shrink-0 rounded px-1 py-0.5 text-center text-[9px] font-bold ' +
          (POS_BADGE[pick.player.pos] || 'bg-white/10 text-white/50')
        }
      >
        {pick.player.pos}
      </span>
      <span className="w-24 shrink-0 truncate text-xs font-medium text-white/85 sm:w-28">{shortName}</span>
      <div className="relative h-4 min-w-0 flex-1">
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
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
      </div>
      <span
        className={
          'w-10 shrink-0 text-right text-xs font-semibold tabular-nums ' +
          (gap >= 0 ? 'text-teal-300' : 'text-rose-400')
        }
      >
        {(gap >= 0 ? '+' : '') + gap}
      </span>
    </div>
  )
}

// Shown the moment a draft concludes (DraftRoom.jsx flips it on off the
// draftOver() edge) and reopenable from the pill it leaves behind. All of
// it is real: the grade is engine.draftAnalysis() — the identical
// analyseDraft() the legacy standings print — and every bar is
// replacementGap() over the real seated lineup.
//
// viewSlot is whose report this is — yours by default, any team's via the
// standings rows below or a board header click (DraftRoom owns the state
// so a header click can pick the team and open the overlay in one
// gesture). Every figure derives from viewSlot; mySlot is only for
// telling "you" apart from a team that needs naming.
export default function DraftInsightsDashboard({ engine, league, mySlot, viewSlot, onViewSlot, onClose }) {
  const analysis = engine.draftAnalysis()
  const mine = analysis && analysis[viewSlot]
  if (!mine) return null

  const isMe = viewSlot === mySlot
  const teamName = engine.teamLabel(viewSlot)
  // "you took" / "Bijan Mustard took"; "your pick" / "their pick".
  const subject = isMe ? 'you' : teamName
  const poss = isMe ? 'your' : 'their'

  /* mine.lineup, not engine.seatedLineup(viewSlot) — the two disagree on
     purpose and this panel needs the one seatedLineup() isn't.
     seatedLineup() fills FLEX with the first eligible player in *draft
     order*; mine.lineup is bestLineup()'s own output, already sitting on
     the analysis object, which fills it by aboveReplacement — the exact
     fix CLAUDE.md documents for the historical FLEX bug ("sorts by
     posRank, never aboveReplacement... a within-position measure cannot
     answer a between-position question"). analyseTeam()'s starter-strength
     score is computed from this same bestLineup() result, so reading
     seatedLineup() here instead means this panel's VORP matrix can credit
     a different player as the FLEX starter than the score two inches above
     it just counted — the same mismatch AnalysisTab.jsx's own file comment
     already warns against. No bench here either way; this panel only ever
     showed starters. */
  const seats = mine.lineup || []
  const gaps = seats.map((seat) => (seat.player ? engine.replacementGap(seat.player) : null))
  const maxAbs = Math.max(1, ...gaps.filter((g) => g !== null).map((g) => Math.abs(g)))

  /* mine.bargain itself, not gated on gap > 0 here — analyseTeam() (app.js)
     already picks whichever judged pick has the *highest* gap, positive or
     not, and never nulls it the way reach is (reach is nulled at gap >= 0,
     bargain never is). AnalysisTab.jsx and the legacy panel it matches both
     show "Best value" unconditionally on the same rule; gating it here too
     meant a team whose best pick still landed at-or-before its own board
     rank showed the card on one screen and not the other, for identical
     data. The gap sign still has to be checked before the label calls it
     "picks late", though — that part of AnalysisTab's rule is real. */
  const bargain = mine.bargain || null
  const reach = mine.reach || null

  const picks = engine.picks() || []
  // FORCED_LATE is a lookup object ({ K: true, DST: true }), not a list —
  // the same shape freelyChosen() in app.js tests it with.
  const forced = engine.forcedLate() || {}
  const teamPicks = picks.filter((p) => p.slot === viewSlot).slice().sort((a, b) => a.overall - b.overall)

  /* The value timeline judges only the picks this team was free to time —
     the same FORCED_LATE exclusion the grade's value component applies,
     and for the same documented reason: the app itself schedules kickers
     and defenses into the closing rounds, and their long-draft ADP makes
     every one of them read as a reach. Naming a kicker the worst pick was
     a real bug once; it does not come back through a new panel. */
  const timeline = teamPicks
    .filter((p) => !forced[p.player.pos])
    .map((p) => ({ pick: p, gap: p.overall - p.player.overall }))
  const tlMax = Math.max(1, ...timeline.map((t) => Math.abs(t.gap)))

  /* The one that got away: at each of this team's turns, every player
     somebody else took before their next turn was a player they could
     have had and then couldn't — the biggest replacementGap() upgrade
     among them is the sliding-doors pick. The last pick has no next turn,
     so it has no window. K/DST and no-projection players fall out
     naturally: their gap is null on either side of the comparison. */
  let missed = null
  teamPicks.forEach((teamPick, i) => {
    const next = teamPicks[i + 1]
    if (!next) return
    const ownGap = engine.replacementGap(teamPick.player)
    if (ownGap === null) return
    picks.forEach((p) => {
      if (p.slot === viewSlot || p.overall <= teamPick.overall || p.overall >= next.overall) return
      const theirGap = engine.replacementGap(p.player)
      if (theirGap === null) return
      const delta = theirGap - ownGap
      if (delta > (missed ? missed.delta : 0)) missed = { theirs: p, mine: teamPick, delta }
    })
  })
  const realMiss = missed && missed.delta >= MISS_FLOOR ? missed : null

  const standings = analysis.slice().sort((a, b) => a.rank - b.rank)

  // Everything the share card draws, assembled from the same values the
  // summary card above renders — the card can never say something the
  // screen does not.
  const shareData = {
    teamName,
    leagueText: engine.settingsText(league),
    dateText: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    grade: mine.grade,
    rankText: ordinal(mine.rank),
    teams: league.teams,
    total: Math.round(mine.total),
    components: mine,
    bestValue: bargain
      ? `${bargain.pick.player.name}${bargain.gap > 0 ? ` · ${bargain.gap} picks late` : ''}`
      : null,
    biggestReach: reach ? `${reach.pick.player.name} · ${Math.abs(reach.gap)} picks early` : null,
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate/97 backdrop-blur-md">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">Draft complete</p>
            <h1 className="font-display text-2xl font-bold text-white">
              Draft Insights <span className="text-ink-muted">·</span>{' '}
              <span className={isMe ? 'text-teal-300' : 'text-[#B784E0]'}>{teamName}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isMe && (
              <button
                type="button"
                onClick={() => onViewSlot(mySlot)}
                className="rounded-full border border-teal-400/40 px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors duration-150 hover:border-teal-400 hover:bg-teal-400/10"
              >
                Back to your team
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="View the board"
              aria-label="Close insights and view the board"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-rule bg-slate-sunk/60 text-white/60 transition-colors duration-150 hover:border-teal-400/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary card — the grade, large and glowing, in the two brand
            accents. Rank and weighted total sit beside it because the
            letter is handed out for finishing position (see CLAUDE.md's
            standings note): a grade without its rank invites the reader
            to take a room-relative ranking as an absolute verdict. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          // sm:flex-wrap so the full-width ShareBar at the end of the card
          // breaks onto its own line under the grade and the callouts,
          // instead of being squeezed into the row as a third column.
          className={PANEL + ' flex flex-col items-center gap-4 p-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-8'}
        >
          <div className="flex items-center gap-5">
            <span className="bg-gradient-to-br from-[#00E5FF] to-[#7B1FA2] bg-clip-text font-display text-7xl font-black leading-none text-transparent drop-shadow-[0_0_28px_rgba(0,229,255,0.35)] sm:text-8xl">
              {mine.grade}
            </span>
            <div>
              <p className="font-display text-xl font-bold text-white">
                {ordinal(mine.rank)} <span className="text-ink-muted">of {league.teams}</span>
              </p>
              <p className="mt-0.5 text-sm text-white/50">
                {Math.round(mine.total)} <span className="text-ink-muted">/ 100 weighted score</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs sm:text-right">
            {bargain && (
              <p className="text-white/60">
                <span className="font-semibold uppercase tracking-wide text-teal-400">Best value</span>{' '}
                {bargain.pick.player.name}
                {bargain.gap > 0 && <span className="text-ink-muted"> · {bargain.gap} picks late</span>}
              </p>
            )}
            {reach && (
              <p className="text-white/60">
                <span className="font-semibold uppercase tracking-wide text-rose-400">Biggest reach</span>{' '}
                {reach.pick.player.name} <span className="text-ink-muted">· {Math.abs(reach.gap)} picks early</span>
              </p>
            )}
          </div>

          <ShareBar shareData={shareData} />
        </motion.div>

        {/* Sliding doors — the single biggest value upgrade that left the
            board between two of your turns. When nothing clears MISS_FLOOR
            the panel says so in the positive, because that is a checkable
            claim about this draft, not an empty box. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className={PANEL + ' p-5'}
        >
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">
            The One That Got Away
          </h2>
          {realMiss ? (
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              <span className="font-semibold text-[#B784E0]">{realMiss.theirs.player.name}</span>{' '}
              was still on the board when {subject} took {realMiss.mine.player.name} in round{' '}
              {realMiss.mine.round} — {engine.teamLabel(realMiss.theirs.slot)} got him{' '}
              {realMiss.theirs.overall - realMiss.mine.overall === 1
                ? 'with the very next pick'
                : `${realMiss.theirs.overall - realMiss.mine.overall} picks later`}
              , and he projects{' '}
              <span className="font-semibold text-teal-300">+{Math.round(realMiss.delta)} more points</span>{' '}
              over a replacement starter than {poss} pick does.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Nothing got away. At every turn, nobody taken before {poss} next pick out-valued {poss}{' '}
              choice by more than the projection can honestly measure — that is the mark of a draft
              with no real regrets in it.
            </p>
          )}
        </motion.div>

        <div className="grid gap-5 lg:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Team analysis</h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-muted">The four grade components, scaled against the room</p>
            <RadarChart mine={mine} />
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">VORP matrix</h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-muted">
              Each starter against a replacement-level player at his position
            </p>
            <div className="flex flex-col gap-1.5">
              {seats.map((seat, i) => (
                <VorpRow key={i} seat={seat} gap={gaps[i]} maxAbs={maxAbs} />
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">
              Kickers and defenses show a dash: measured against three seasons of archived forecasts the
              projection ranks them no better than chance, so no bar is drawn from it.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Draft value timeline</h2>
            <p className="mb-3 mt-0.5 text-xs text-ink-muted">
              Where each pick landed against the board's rank — right means he fell to {isMe ? 'you' : 'them'}
            </p>
            <div className="flex flex-col gap-1.5">
              {timeline.map((t) => (
                <TimelineRow
                  key={t.pick.overall}
                  pick={t.pick}
                  gap={t.gap}
                  maxAbs={tlMax}
                  shortName={engine.shortName(t.pick.player)}
                />
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">
              Kickers and defenses sit this out too — the app schedules those picks itself, so their
              timing says nothing about the drafting.
            </p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className={PANEL + ' p-5'}
          >
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Room standings</h2>
            {/* The number IS the weighted total the table is ordered by —
                CLAUDE.md's standings rule: a column between the rank and
                the letter showing anything else makes the table look
                broken, and once did. */}
            <p className="mb-3 mt-0.5 text-xs text-ink-muted">
              Every team's weighted score, best to worst — click any team to view their report
            </p>
            <div className="flex flex-col gap-1">
              {/* Each row is the switcher for this whole dashboard: the
                  viewed team carries the ring, your own row keeps its teal
                  name so "where am I" survives while reading somebody
                  else's report. */}
              {standings.map((t) => (
                <button
                  key={t.slot}
                  type="button"
                  onClick={() => onViewSlot(t.slot)}
                  className={
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors duration-150 ' +
                    (t.slot === viewSlot
                      ? 'border border-teal-400/40 bg-teal-500/10 font-semibold text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white')
                  }
                >
                  <span className="w-5 shrink-0 text-right tabular-nums text-ink-muted">{t.rank}</span>
                  <span className={'min-w-0 flex-1 truncate ' + (t.slot === mySlot ? 'text-teal-300' : '')}>
                    {engine.teamLabel(t.slot)}
                  </span>
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{Math.round(t.total)}</span>
                  <span
                    className={
                      'w-8 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold ' +
                      (t.slot === viewSlot ? 'bg-teal-400/20 text-teal-300' : 'bg-white/5 text-white/50')
                    }
                  >
                    {t.grade}
                  </span>
                </button>
              ))}
            </div>
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
