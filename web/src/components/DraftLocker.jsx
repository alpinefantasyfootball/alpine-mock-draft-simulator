import { useEffect, useReducer, useState } from 'react'
import { Calendar, TrendingUp, Shield } from 'lucide-react'
import { useEngine, useJukeTick } from '../hooks/useJukeEngine.js'
import { useAccount } from '../hooks/useAccount.js'
import NewMockPanel from './NewMockPanel.jsx'
import InProgressBand from './InProgressBand.jsx'
import LockerTable from './LockerTable.jsx'
import WhatToRunNext from './WhatToRunNext.jsx'
import DraftInsightsDashboard from './DraftInsightsDashboard.jsx'
import TrendChart from './TrendChart.jsx'
import RecommendationEngine from './RecommendationEngine.jsx'
import MostDraftedCard from './MostDraftedCard.jsx'
import WeakestSpotCard from './WeakestSpotCard.jsx'
import AvgRoundByPositionCard from './AvgRoundByPositionCard.jsx'
import DraftCapitalAllocationCard from './DraftCapitalAllocationCard.jsx'
import WinPctTrendCard from './WinPctTrendCard.jsx'
import NetAdpValueCard from './NetAdpValueCard.jsx'
import PositionalWeaknessHeatmap from './PositionalWeaknessHeatmap.jsx'

// One shell for the three header stat tiles — a bordered card with a label
// row (an optional icon beside it) and a big value, rather than the plain
// stacked text these used to be. sparkline is a full element rather than a
// boolean so only the win-rate tile has to know it draws one.
function KpiCard({ icon: Icon, label, value, valueColor, sub, sparkline }) {
  return (
    <div className="flex min-w-[132px] flex-col gap-1.5 rounded-lg border border-white/[0.09] bg-slate-panel/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-white/50">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-white/30" aria-hidden="true" />}
      </div>
      <p className="font-display text-[22px] font-bold leading-none tabular-nums" style={{ color: valueColor || '#fff' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-ink-muted">{sub}</p>}
      {sparkline}
    </div>
  )
}

// Below this many completed mocks, none of the eight chart cells have
// enough to say — every one of them would independently render its own
// "not enough data yet" box, which is the same repetitive-empty-boxes
// problem the retired TendenciesStrip.jsx's own single gate already existed
// to avoid. One combined prompt stands in for all eight instead; once past
// it, each card still gates itself on whatever narrower sample it
// specifically needs (a format needs two full formats, the heatmap needs
// two entries with the field stored, and so on).
//
// New Mock Draft is deliberately NOT behind this gate. It is the launcher,
// not a piece of analytics — a brand-new visitor with zero mocks still
// needs a working "Start mock draft" button. Folding it into the same
// conditional as the eight chart cards was tried once already and is
// exactly the regression this comment exists to prevent: it deleted the
// one button this whole screen exists to offer for anyone who hadn't
// already run five mocks.
const MIN_MOCKS_FOR_ANALYTICS = 5

// The analytics grid. A plain 4-column, 3-row grid — 12 cells, and every
// panel here fills exactly one of them except Recommendation Engine (2
// cols) and the Heatmap (3 cols). New Mock does NOT need an explicit
// row-span to look as tall as its row-mates: CSS Grid stretches every item
// to its row's own height by default, and row 1's height is set by
// whichever sibling needs the most room (Recommendation Engine, once it's
// drawing a real per-seat bar chart) — NewMockPanel's own `h-full` just
// rides that stretch. An earlier version of this file read the design
// brief's "New Mock spans rows 1-2" as a literal grid-row-span, which
// doesn't fit a 4x3 grid alongside Recommendation Engine's 2-column span
// and the heatmap's 3-column span (13 cell-units of content into 12 cells)
// and had to invent a fourth row to make the arithmetic work. It didn't
// need to: the spec was describing a visual proportion, not a grid mechanic.
function AnalyticsGrid({ engine, league, stats, problem, lobbySlot, roomActive, onSetLobbySlot, onStartNew, onRunAtSeat, onOpenSettings, onDraftWithFriends }) {
  const totalMocks = stats.total || 0
  const thin = totalMocks < MIN_MOCKS_FOR_ANALYTICS

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-1">
        <NewMockPanel
          engine={engine}
          league={league}
          problem={problem}
          lobbySlot={lobbySlot}
          roomActive={roomActive}
          onSetLobbySlot={onSetLobbySlot}
          onStartNew={onStartNew}
          onOpenSettings={onOpenSettings}
          onDraftWithFriends={onDraftWithFriends}
        />
      </div>

      {thin ? (
        <div className="sm:col-span-2 lg:col-span-3 lg:col-start-2 lg:row-start-1 lg:row-span-3 flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.14] bg-slate-panel/40 p-10 text-center">
          <p className="max-w-[360px] text-sm text-white/60">
            Run {MIN_MOCKS_FOR_ANALYTICS - totalMocks} more mock{MIN_MOCKS_FOR_ANALYTICS - totalMocks === 1 ? '' : 's'} and
            Juke will start showing your tendencies, your projected win rate, and where each draft left value on the board.
          </p>
          {/* Five dots, one per mock still needed — the same fact the
              caption below states in words, made visible at a glance before
              anyone reads the number. totalMocks is always <
              MIN_MOCKS_FOR_ANALYTICS in this branch (that's the gate this
              branch renders under), so no clamping needed on the fill
              count. */}
          <div
            className="mt-4 flex items-center gap-2"
            role="img"
            aria-label={`${totalMocks} of ${MIN_MOCKS_FOR_ANALYTICS} mocks logged`}
          >
            {Array.from({ length: MIN_MOCKS_FOR_ANALYTICS }, (_, i) => (
              <span
                key={i}
                className={
                  'h-2 w-2 rounded-full transition-colors duration-300 ' +
                  (i < totalMocks ? 'bg-teal-400 shadow-[0_0_6px_rgba(0,229,255,0.6)]' : 'border border-white/15')
                }
              />
            ))}
          </div>
          <p className="mt-2 text-xs tabular-nums text-ink-muted">
            {totalMocks} of {MIN_MOCKS_FOR_ANALYTICS} logged so far
          </p>
        </div>
      ) : (
        <>
          <div className="sm:col-span-2 lg:col-start-2 lg:col-span-2 lg:row-start-1">
            <RecommendationEngine engine={engine} league={league} stats={stats} roomActive={roomActive} onRunAtSeat={onRunAtSeat} />
          </div>
          <div className="lg:col-start-4 lg:row-start-1">
            <MostDraftedCard stats={stats} />
          </div>

          <div className="lg:col-start-1 lg:row-start-2">
            <WeakestSpotCard stats={stats} />
          </div>
          <div className="lg:col-start-2 lg:row-start-2">
            <AvgRoundByPositionCard stats={stats} />
          </div>
          <div className="lg:col-start-3 lg:row-start-2">
            <DraftCapitalAllocationCard stats={stats} />
          </div>
          <div className="lg:col-start-4 lg:row-start-2">
            <WinPctTrendCard stats={stats} />
          </div>

          <div className="lg:col-start-1 lg:row-start-3">
            <NetAdpValueCard stats={stats} />
          </div>
          <div className="sm:col-span-2 lg:col-start-2 lg:col-span-3 lg:row-start-3">
            <PositionalWeaknessHeatmap stats={stats} />
          </div>
        </>
      )}
    </div>
  )
}

// Replaces the old tabbed card list (DraftHistoryCard.jsx,
// DraftInProgressCard.jsx, both deleted) with the handoff's launcher-and-
// record layout: a title row, an in-progress band when one exists, the
// launcher beside "Your tendencies," then the full history table. Every
// child here is presentational — this component owns the one thing that
// has to live above all of them, which is knowing whether an in-progress
// draft or history entry changed and needs a re-render.
export default function DraftLocker({ onStartNew, onRunAtSeat, problem, lobbySlot, roomActive, onSetLobbySlot, onOpenSettings, onDraftWithFriends }) {
  const engine = useEngine()
  useJukeTick(engine)
  // clearSave()/deleteHistoryDraft() are plain localStorage writes with no
  // juke:header event behind them (nothing else in app.js needs to hear
  // about either), so this screen doesn't get an automatic re-render from
  // the engine tick alone — forced locally instead, same as the previous
  // implementation did.
  const [, forceLocal] = useReducer((x) => x + 1, 0)
  // Which history entry's report is open, if any — analyzing a past draft
  // used to mean navigating to #/draft-room and mounting the entire live
  // Cockpit (board, player pool, Queue/Roster/Chat) underneath the insights
  // modal, with the Analysis tab rendering the same numbers a second time
  // beneath it. DraftInsightsDashboard is self-contained (engine/league/
  // mySlot/viewSlot/onClose, nothing else), so it can sit directly over the
  // Lobby instead — no route change, nothing else to mount.
  const [analyzingId, setAnalyzingId] = useState(null)
  // Which team's report the dashboard shows — yours on open, or another
  // seat's if a future caller wants that; kept separate from mySlot the
  // same way DraftRoom.jsx's own insightsSlot is. Only meaningful for the
  // live-recompute fallback path below; a frozen report only ever has full
  // detail for the drafter's own seat, so it ignores this entirely.
  const [insightsSlot, setInsightsSlot] = useState(0)
  // The frozen report for analyzingId, or null when analyzing a pre-freeze
  // entry that has to fall back to the live recompute — see analyze() and
  // DraftInsightsDashboard.jsx's own file comment on why the two disagree
  // and why that gap matters.
  const [historyReport, setHistoryReport] = useState(null)
  const account = useAccount()
  const signedIn = account && account.status === 'signed-in'

  // Pull the server locker down and merge it in whenever this screen is
  // opened signed in — the "sign in on a second browser, same locker"
  // acceptance criterion for a device that was *already* signed in before
  // this mount, not just the fresh sign-in account.js's own consume()
  // already handles. adoptServerLocker() writes straight into localStorage
  // (readHistory()/readSave()'s own backing store), which nothing else
  // here watches — forceLocal() is the same manual re-render
  // clearSave()/deleteHistoryDraft() already need for exactly that reason.
  useEffect(() => {
    if (!signedIn || typeof window === 'undefined' || !window.Account) return
    window.Account.pullLocker().then(forceLocal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn])

  if (!engine) return null

  const league = engine.league()
  const inProgress = engine.inProgressSummary()
  const completed = engine.historyList()
  const stats = engine.historyStats()
  // historyStats() returns {} outright with no history at all, so
  // stats.total is undefined rather than 0 in that case — totalMocks folds
  // both into one real number, "0" included, rather than the sentence
  // reading "undefined mocks run."
  const totalMocks = stats.total || 0
  const mocksRunSentence = `${totalMocks} mock${totalMocks === 1 ? '' : 's'} run. Unlimited, always free.`
  const hasWinTrend = stats.winPctHistory && stats.winPctHistory.length >= 2

  const resume = () => { engine.resumeSavedDraft(); location.hash = '#/draft-room' }
  // engine.restart() — clearSave() plus goHome() — not clearSave() alone.
  // Reported directly: discard here, then start a new mock, and the new
  // board opened already holding the old draft's picks. clearSave() only
  // drops the localStorage save; it never touches the live state.picks or
  // board[i].drafted that a draft actually left behind on the page (the
  // chevron back to this screen doesn't clear them either — leaving a
  // draft mid-round is meant to be resumable, so nothing here resets that
  // state on its own). startDraft() -> buildBoard() does rebuild `board`
  // from scratch on the next mock, but it has never cleared state.picks
  // itself — it relies on whatever ended the previous draft having already
  // done that, which goHome() does and clearSave() alone does not. This is
  // the exact same "Discard draft" action the in-draft kebab menu already
  // gets right (DraftRoom.jsx's handleDiscard); this screen just hadn't
  // been calling it.
  const discard = () => { engine.restart(); forceLocal() }
  // Frozen report first — a plain localStorage read, no board rebuild, no
  // drift. Only an entry recorded before freezeReport() existed comes back
  // null, and only then does this fall back to the old path: rebuild
  // today's board and replay the picks onto it, live. See
  // DraftInsightsDashboard.jsx's own file comment for why the two can
  // disagree on the very same picks and why that gap was a real bug.
  const analyze = (id) => {
    const frozen = engine.historyReport(id)
    if (frozen) {
      setHistoryReport(frozen)
      setAnalyzingId(id)
      return
    }
    if (!engine.openHistoryDraft(id)) return
    setInsightsSlot(engine.mySlot())
    setHistoryReport(null)
    setAnalyzingId(id)
  }
  const deleteEntry = (id) => { engine.deleteHistoryDraft(id); forceLocal() }

  // A report replaces the Lobby screen while it's open, the same way
  // DraftRoom.jsx's own `view === 'insights'` replaces the board tab
  // instead of appending below it — this used to render *after* the KPI
  // row, "Your Tendencies," and the full history table inside the same
  // flex-1 scroll region, so opening a report from any row of a long
  // table left it sitting below all of that, off the bottom of the
  // screen. Reported directly: users had to scroll to find it.
  //
  // onRunAnother does the extra local reset DraftRoom.jsx's own default
  // (bare engine.restart()) doesn't need: DraftRoom listens for the
  // juke:home event restart() fires and swaps its own view state, but
  // this screen has no equivalent listener, so without clearing
  // analyzingId here the dashboard kept trying to render a report
  // against the just-cleared board and silently returned null — see
  // DraftInsightsDashboard.jsx's own comment on this prop.
  if (analyzingId) {
    // historyReport set: nothing live was touched to get here (analyze()
    // took the frozen-report path), so closing just drops local state —
    // engine.closeHistoryDraft() only undoes what openHistoryDraft() did,
    // and that was never called this time.
    const closeAnalysis = () => {
      if (!historyReport) engine.closeHistoryDraft()
      setAnalyzingId(null)
      setHistoryReport(null)
    }
    return (
      <DraftInsightsDashboard
        engine={engine}
        league={league}
        mySlot={engine.mySlot()}
        viewSlot={insightsSlot}
        onViewSlot={setInsightsSlot}
        historyReport={historyReport ? historyReport.report : null}
        historyCompletedAt={historyReport ? historyReport.completedAt : null}
        onClose={closeAnalysis}
        onRunAnother={() => { closeAnalysis(); engine.restart() }}
        cameFromLocker
      />
    )
  }

  return (
    // min-h-full + flex-col, with the Locker table wrapper below taking
    // flex-1: the table's own card stretches down to the bottom of the
    // scroll container instead of stopping wherever its (often short) row
    // list ends and leaving bare background beneath it. min-h-full rather
    // than h-full so a long history — many rows, "Load 20 more" pressed a
    // few times — is still free to grow taller than the viewport and let
    // the real ancestor scroller (DraftRoom.jsx's own overflow-y-auto) take
    // over, rather than being capped at 100% and clipping.
    <div className="mx-auto flex min-h-full max-w-[1600px] flex-col px-4 py-5 lg:px-8 lg:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-bold text-white">Draft Lobby</h1>
          {/* Mobile: one honest sentence with the real count in it, instead
              of the desktop stat block to the right — that block doesn't
              fit this row below lg, and "N mocks run" is the one fact it
              carries that a single line can say without a second column. */}
          <p className="mt-1 text-sm text-white/50 lg:hidden">
            {mocksRunSentence}
          </p>
          <p className="mt-1 hidden text-sm text-white/50 lg:block">
            Set up a mock, pick up where you left off, or see what's already in the locker.
          </p>
        </div>
        {/* The three header KPIs: mocks run, mean projected win % (with its
            own trailing sparkline), mean roster VORP (with a bar against
            THIS BROWSER'S OWN drafted rooms, not a "league" — there is no
            persistent league concept in Juke to baseline against, and
            inventing one nobody derives from would be exactly the kind of
            number this codebase's own rules say not to print). All three
            are absent, not zeroed, until there's a real mock behind them. */}
        {stats.total > 0 && (
          <div className="hidden items-stretch gap-3 lg:flex">
            <KpiCard icon={Calendar} label="Mocks Run" value={stats.total} sub="All formats" />
            {typeof stats.avgWinPct === 'number' && (
              <KpiCard
                icon={TrendingUp}
                label="Avg Win Probability"
                value={`${Math.round(stats.avgWinPct)}%`}
                valueColor="#34D399"
                sparkline={
                  hasWinTrend && (
                    <div className="mt-0.5 h-4 opacity-90">
                      <TrendChart entries={stats.winPctHistory.slice(-12)} compact height={16} scaleToData />
                    </div>
                  )
                }
              />
            )}
            {stats.avgRosterVorp && (
              <KpiCard
                icon={Shield}
                label="Avg Roster VORP"
                value={`${stats.avgRosterVorp.mine >= 0 ? '+' : ''}${stats.avgRosterVorp.mine.toFixed(1)}`}
                valueColor="#34D399"
                sub={typeof stats.avgRosterVorp.room === 'number' ? 'vs. room average' : undefined}
                sparkline={
                  typeof stats.avgRosterVorp.room === 'number' && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #7B1FA2, #00E5FF)',
                          width: `${Math.max(4, Math.min(100,
                            50 + ((stats.avgRosterVorp.mine - stats.avgRosterVorp.room) / 40) * 50
                          ))}%`,
                        }}
                      />
                    </div>
                  )
                }
              />
            )}
          </div>
        )}
      </div>

      {inProgress && <InProgressBand draft={inProgress} onResume={resume} onDiscard={discard} />}

      {/* Only when there's no in-progress draft already asking for a
          decision — competing with the resume banner's own "pick this
          back up" would bury the more urgent of the two asks. */}
      {!inProgress && (
        <WhatToRunNext
          engine={engine}
          league={league}
          stats={stats}
          roomActive={roomActive}
          onRunAtSeat={onRunAtSeat}
        />
      )}

      <div className="mb-7">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[19px] font-bold text-white">Your Tendencies</h2>
          {totalMocks > 0 && (
            <span className="text-xs text-white/50">Across all {totalMocks} mock{totalMocks === 1 ? '' : 's'}</span>
          )}
        </div>

        {/* AnalyticsGrid always renders New Mock Draft, thin sample or not —
            see its own file comment on why that panel can't live behind the
            same gate as the eight chart cards beside it. */}
        <AnalyticsGrid
          engine={engine}
          league={league}
          stats={stats}
          problem={problem}
          lobbySlot={lobbySlot}
          roomActive={roomActive}
          onSetLobbySlot={onSetLobbySlot}
          onStartNew={onStartNew}
          onRunAtSeat={onRunAtSeat}
          onOpenSettings={onOpenSettings}
          onDraftWithFriends={onDraftWithFriends}
        />
      </div>

      <div className="min-h-0 flex-1">
        <LockerTable entries={completed} onAnalyze={analyze} onDeleteConfirmed={deleteEntry} />
      </div>
    </div>
  )
}
