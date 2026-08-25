import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { POS_BADGE, POS_SOLID, POS_NAMES } from './draftRoomPositions.js'
import GradeTrendChart from './GradeTrendChart.jsx'

/* Same dark-panel treatment DraftInsightsDashboard.jsx uses for a single
   draft's report — this is that same idea run across every draft in the
   Locker instead of one, so it deliberately borrows the identical PANEL
   class, hero-card layout, and diverging-bar language rather than
   inventing a second visual grammar for what is, at bottom, the same kind
   of screen. */
const PANEL =
  'rounded-2xl border border-slate-rule bg-slate-panel/60 transition-all duration-300 ' +
  'hover:border-teal-400/40 hover:shadow-[0_0_18px_rgba(0,229,255,0.12)]'

function Kpi({ label, value, unit, sub }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-panel/60 p-4">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-[25px] font-bold leading-none text-white">
        {value}
        {unit && <span className="ml-0.5 font-body text-xs font-medium text-ink-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-1.5 font-plex text-[11px] text-ink-muted">{sub}</p>}
    </div>
  )
}

// One centered-baseline bar per position, averaged across every one of your
// own picks at that position — the same signed gap (pick number minus
// board rank) DraftInsightsDashboard.jsx's own TimelineRow draws per pick,
// aggregated here instead of per-player. Same visual language on purpose:
// teal grows right for a bargain, rose grows left for a reach.
function ValueRow({ pos, avgGap, maxAbs }) {
  const width = maxAbs > 0 ? (Math.abs(avgGap) / maxAbs) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className={'w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ' + (POS_BADGE[pos] || 'bg-white/10 text-white/50')}>
        {pos}
      </span>
      <div className="relative h-4 min-w-0 flex-1">
        <span className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: `${width / 2}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          className={
            'absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm ' +
            (avgGap >= 0
              ? 'left-1/2 bg-gradient-to-r from-teal-500/80 to-teal-300 shadow-[0_0_8px_rgba(0,229,255,0.35)]'
              : 'right-1/2 bg-gradient-to-l from-rose-600/80 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.35)]')
          }
        />
      </div>
      <span className={'w-12 shrink-0 text-right text-xs font-semibold tabular-nums ' + (avgGap >= 0 ? 'text-teal-300' : 'text-rose-400')}>
        {(avgGap >= 0 ? '+' : '') + Math.round(avgGap)}
      </span>
    </div>
  )
}

// Format split and seat split share one shape once formatted — {label,
// avg, count} — so one component draws both rather than two near-identical
// bar lists. rows.length is always >= 2 by the time either stat exists
// (guarded server-side in historyStats()).
function CompareCard({ title, sub, rows }) {
  const max = Math.max(...rows.map((r) => r.avg), 1)
  return (
    <div className={PANEL + ' p-5'}>
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">{title}</h2>
      <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>
      <div className="mt-3.5 flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.label} className="flex items-center gap-2.5">
            <span className="w-[92px] shrink-0 truncate text-xs text-white/65">{r.label}</span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className={'h-full rounded-full ' + (i === 0 ? 'bg-teal-400' : 'bg-white/25')}
                style={{ width: `${(r.avg / max) * 100}%` }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-white/85">
              {Math.round(r.avg)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 font-plex text-[10px] text-ink-muted">
        {rows.map((r) => `${r.count} mock${r.count === 1 ? '' : 's'}`).join(' vs ')}
        {rows.length === 2 && ` — a real ${Math.round(Math.abs(rows[0].avg - rows[1].avg))}-point gap`}
      </p>
    </div>
  )
}

// Opened from TendenciesStrip.jsx's "Full report" button (only offered
// once the strip itself is showing, so this never opens on a sample the
// strip itself would call too thin). Reads only stats — nothing here
// touches engine.board()/engine.picks(), because this describes every
// draft in the Locker at once, not the one currently loaded into the live
// engine. scoringNames is the one exception, a pure label lookup with no
// per-draft state behind it.
export default function AllDraftsInsights({ stats, scoringNames, onClose }) {
  const roundMax = stats.avgRoundByPosition
    ? Math.max(...stats.avgRoundByPosition.map((r) => r.avgRound))
    : 1
  const valueMax = stats.avgValueByPosition
    ? Math.max(1, ...stats.avgValueByPosition.map((r) => Math.abs(r.avgGap)))
    : 1

  const vorpMine = stats.avgRosterVorp ? Math.round(stats.avgRosterVorp.mine) : null
  const vorpRoom = stats.avgRosterVorp && stats.avgRosterVorp.room != null ? Math.round(stats.avgRosterVorp.room) : null

  const formatRows = stats.formatSplit
    ? stats.formatSplit.map((r) => ({ label: scoringNames[r.scoring] || r.scoring, avg: r.avg, count: r.count }))
    : null
  const seatRows = stats.seatSplit
    ? [
        { label: 'Early seat', avg: stats.seatSplit.early.avg, count: stats.seatSplit.early.count },
        { label: 'Late seat', avg: stats.seatSplit.late.avg, count: stats.seatSplit.late.count },
      ]
    : null

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate/97 backdrop-blur-md">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">
              All-time · {stats.total} mock{stats.total === 1 ? '' : 's'}
            </p>
            <h1 className="font-display text-2xl font-bold text-white">
              Draft Insights <span className="text-ink-muted">·</span> <span className="text-teal-300">All Drafts</span>
            </h1>
            <p className="mt-1 text-sm text-white/50">Every completed mock in this browser, combined.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Back to the Lobby"
            aria-label="Close the all-drafts report"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-rule bg-slate-sunk/60 text-white/60 transition-colors duration-150 hover:border-teal-400/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Kpi label="Mocks run" value={stats.total} />
          {stats.avgScore && (
            <Kpi
              label="Avg weighted score"
              value={Math.round(stats.avgScore.value)}
              unit="/100"
              sub={`best ${Math.round(stats.avgScore.best)} · worst ${Math.round(stats.avgScore.worst)}`}
            />
          )}
          {typeof stats.avgFinishPct === 'number' && (
            <Kpi label="Avg finish" value={Math.round(stats.avgFinishPct)} unit="pctl" sub="of the room, on average" />
          )}
          {vorpMine != null && (
            <Kpi
              label="Avg roster VORP"
              value={(vorpMine >= 0 ? '+' : '') + vorpMine}
              sub={vorpRoom != null ? `${vorpMine - vorpRoom >= 0 ? '+' : ''}${vorpMine - vorpRoom} vs room avg` : undefined}
            />
          )}
        </motion.div>

        {stats.gradeHistory && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className={PANEL + ' p-5'}>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Grade over time</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Weighted score, every completed mock, oldest to newest — hover or touch a point.
            </p>
            <div className="mt-2">
              <GradeTrendChart entries={stats.gradeHistory} height={160} />
            </div>
          </motion.section>
        )}

        {stats.avgRoundByPosition && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={PANEL + ' p-5'}>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Positional draft pattern</h2>
            <p className="mt-0.5 text-xs text-ink-muted">The average round you land your first player at each position.</p>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {stats.avgRoundByPosition.map((row) => (
                <div key={row.pos} className="grid grid-cols-[52px_1fr_52px] items-center gap-3">
                  <span className={'rounded px-1.5 py-0.5 text-center text-[10px] font-bold ' + (POS_BADGE[row.pos] || 'bg-white/10 text-white/50')}>
                    {row.pos}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(row.avgRound / roundMax) * 100}%`, background: POS_SOLID[row.pos] || 'rgba(255,255,255,0.3)' }}
                    />
                  </div>
                  <span className="text-right text-xs font-semibold tabular-nums text-white/85">Rd {row.avgRound.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {stats.avgValueByPosition && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={PANEL + ' p-5'}>
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-white/80">Where you gain and lose value</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Average picks early or late against board rank, by position — right means a bargain, left means a reach.
            </p>
            <div className="mt-3.5 flex flex-col gap-2">
              {stats.avgValueByPosition.map((row) => (
                <ValueRow key={row.pos} pos={row.pos} avgGap={row.avgGap} maxAbs={valueMax} />
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">
              Kickers and defenses sit this out — the app schedules those picks itself, so their timing says nothing
              about the drafting.
            </p>
          </motion.section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {stats.mostDrafted && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={PANEL + ' p-5'}>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Most drafted</p>
              <p className="mt-2 font-display text-[22px] font-bold text-white">{stats.mostDrafted.name}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-teal-400"
                  style={{ width: `${Math.round((stats.mostDrafted.count / stats.mostDrafted.total) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 font-plex text-xs text-ink-muted">
                {stats.mostDrafted.count} of {stats.mostDrafted.total} — your own picks only
              </p>
            </motion.div>
          )}

          {stats.weakestSpot && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.04] p-5"
            >
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-rose-300/90">Weakest spot</p>
              {stats.holeRounds ? (
                <p className="mt-2 text-[13.5px] leading-[1.55] text-white/85">
                  You finish below replacement at {POS_NAMES[stats.weakestSpot.pos] || stats.weakestSpot.pos} in{' '}
                  {stats.weakestSpot.pct}% of your rosters. The hole isn't your first pick — it's rounds{' '}
                  {stats.holeRounds.startRound}–{stats.holeRounds.endRound}, where you've taken a{' '}
                  {(POS_NAMES[stats.holeRounds.topOtherPos] || stats.holeRounds.topOtherPos).toLowerCase()}{' '}
                  {stats.holeRounds.topOtherCount} of {stats.holeRounds.total} times.
                </p>
              ) : (
                <>
                  <p className="mt-2 font-display text-[22px] font-bold text-white">
                    {POS_NAMES[stats.weakestSpot.pos] || stats.weakestSpot.pos}
                  </p>
                  <p className="mt-1 font-plex text-xs text-white/50">
                    Below replacement in {stats.weakestSpot.pct}% of your rosters
                  </p>
                </>
              )}
            </motion.div>
          )}
        </div>

        {(formatRows || seatRows) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {formatRows && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
                <CompareCard title="Scoring format" sub="Average weighted score, by format you've run" rows={formatRows} />
              </motion.div>
            )}
            {seatRows && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <CompareCard title="Draft seat" sub="Average weighted score, front third vs. back third" rows={seatRows} />
              </motion.div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mx-auto rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white/60 transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300"
        >
          Back to the Lobby
        </button>
      </div>
    </div>
  )
}
