import { useReducer, useState } from 'react'
import { useEngine, useJukeTick } from '../hooks/useJukeEngine.js'
import NewMockPanel from './NewMockPanel.jsx'
import TendenciesStrip from './TendenciesStrip.jsx'
import InProgressBand from './InProgressBand.jsx'
import LockerTable from './LockerTable.jsx'
import WhatToRunNext from './WhatToRunNext.jsx'
import DraftInsightsDashboard from './DraftInsightsDashboard.jsx'
import AllDraftsInsights from './AllDraftsInsights.jsx'

// Replaces the old tabbed card list (DraftHistoryCard.jsx,
// DraftInProgressCard.jsx, both deleted) with the handoff's launcher-and-
// record layout: a title row, an in-progress band when one exists, the
// launcher beside "Your tendencies," then the full history table. Every
// child here is presentational — this component owns the one thing that
// has to live above all of them, which is knowing whether an in-progress
// draft or history entry changed and needs a re-render.
export default function DraftLocker({ onStartNew, problem, lobbySlot, onSetLobbySlot, onOpenSettings }) {
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
  // same way DraftRoom.jsx's own insightsSlot is.
  const [insightsSlot, setInsightsSlot] = useState(0)
  // The aggregate report, across every draft rather than one — a second,
  // independent overlay flag rather than a variant of analyzingId, since
  // the two can never be open at once but are opened from different places
  // (a Locker row's kebab menu vs. the tendencies strip's own button) and
  // answer different questions (one draft's report vs. every draft's).
  const [showAllDrafts, setShowAllDrafts] = useState(false)

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

  const resume = () => { engine.resumeSavedDraft(); location.hash = '#/draft-room' }
  const discard = () => { engine.clearSave(); forceLocal() }
  const analyze = (id) => {
    if (!engine.openHistoryDraft(id)) return
    setInsightsSlot(engine.mySlot())
    setAnalyzingId(id)
  }
  const deleteEntry = (id) => { engine.deleteHistoryDraft(id); forceLocal() }

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
      <div className="mb-6 flex items-end justify-between">
        <div>
          {/* "Draft Lobby", not "Draft Room" — the bottom tab bar
              (MobileAppTabBar.jsx) already names this screen "Lobby" and
              reserves "Draft" for the live Cockpit one tab over; this
              heading disagreeing with the nav that gets you here was never
              right, just never looked at before there was a nav to compare
              it to. */}
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
        {stats.total > 0 && (
          <div className="hidden items-center gap-6 lg:flex">
            <div className="text-right">
              <p className="font-display text-[23px] font-bold tabular-nums text-white">{stats.total}</p>
              <p className="text-[10px] uppercase tracking-[0.07em] text-white/50">Mocks run</p>
            </div>
            {/* Was "Best grade" — a single grade at hero size reads as a
                badge of honor, and it's exactly as likely to be a D- as an
                A+ (the grading itself is a separate, known issue). Roster
                VORP has no such failure mode: it's a real per-user number
                the engine already tracks, and there's no reading of it
                that lands as "you did badly," so it's safe to headline at
                any sample size. */}
            {stats.avgRosterVorp && (
              <div className="text-right">
                <p className="font-display text-[23px] font-bold tabular-nums text-teal-300">
                  {stats.avgRosterVorp.mine >= 0 ? '+' : ''}
                  {stats.avgRosterVorp.mine.toFixed(1)}
                </p>
                <p className="text-[10px] uppercase tracking-[0.07em] text-white/50">Avg roster VORP</p>
              </div>
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
          onSetLobbySlot={onSetLobbySlot}
          onStartNew={onStartNew}
        />
      )}

      {/* items-stretch (the default — items-start used to override it) so
          Your Tendencies always matches New Mock panel's height instead of
          sitting a few lines tall beside it. Below the five-mock gate that
          panel is a short honest-line message; stretched to the panel's
          full height, it reads as a considered empty state instead of the
          ~500px gap this replaced. flex-col below lg: the 396px-wide launcher
          and the tendencies panel beside it were never going to fit a phone
          side by side — see NewMockPanel.jsx's own hard-blocker comment —
          so they stack, launcher first, same reading order the mockup uses. */}
      <div className="mb-7 flex flex-col items-stretch gap-5 lg:flex-row">
        <NewMockPanel
          engine={engine}
          league={league}
          problem={problem}
          lobbySlot={lobbySlot}
          onStartNew={onStartNew}
          onOpenSettings={onOpenSettings}
        />
        <div className="min-w-0 flex-1">
          <TendenciesStrip stats={stats} onOpenAllDrafts={() => setShowAllDrafts(true)} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <LockerTable entries={completed} onAnalyze={analyze} onDeleteConfirmed={deleteEntry} />
      </div>

      {analyzingId && (
        <DraftInsightsDashboard
          engine={engine}
          league={league}
          mySlot={engine.mySlot()}
          viewSlot={insightsSlot}
          onViewSlot={setInsightsSlot}
          onClose={() => { engine.closeHistoryDraft(); setAnalyzingId(null) }}
        />
      )}

      {showAllDrafts && (
        <AllDraftsInsights
          stats={stats}
          scoringNames={engine.scoringNames() || {}}
          onClose={() => setShowAllDrafts(false)}
        />
      )}
    </div>
  )
}
