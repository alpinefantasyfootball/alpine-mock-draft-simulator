import { useReducer } from 'react'
import { useEngine, useJukeTick } from '../hooks/useJukeEngine.js'
import NewMockPanel from './NewMockPanel.jsx'
import TendenciesStrip from './TendenciesStrip.jsx'
import InProgressBand from './InProgressBand.jsx'
import LockerTable from './LockerTable.jsx'

// Replaces the old tabbed card list (DraftHistoryCard.jsx,
// DraftInProgressCard.jsx, both deleted) with the handoff's launcher-and-
// record layout: a title row, an in-progress band when one exists, the
// launcher beside "Your tendencies," then the full history table. Every
// child here is presentational — this component owns the one thing that
// has to live above all of them, which is knowing whether an in-progress
// draft or history entry changed and needs a re-render.
export default function DraftLocker({ onStartNew, problem, lobbySlot, onOpenSettings }) {
  const engine = useEngine()
  useJukeTick(engine)
  // clearSave()/deleteHistoryDraft() are plain localStorage writes with no
  // juke:header event behind them (nothing else in app.js needs to hear
  // about either), so this screen doesn't get an automatic re-render from
  // the engine tick alone — forced locally instead, same as the previous
  // implementation did.
  const [, forceLocal] = useReducer((x) => x + 1, 0)

  if (!engine) return null

  const league = engine.league()
  const inProgress = engine.inProgressSummary()
  const completed = engine.historyList()
  const stats = engine.historyStats()

  const resume = () => { engine.resumeSavedDraft(); location.hash = '#/draft-room' }
  const discard = () => { engine.clearSave(); forceLocal() }
  const analyze = (id) => { engine.openHistoryDraft(id); location.hash = '#/draft-room' }
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
    <div className="mx-auto flex min-h-full max-w-[1600px] flex-col px-8 py-7">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-[32px] font-bold text-white">Draft Room</h1>
          <p className="mt-1 text-sm text-white/50">
            Set up a mock, pick up where you left off, or see what's already in the locker.
          </p>
        </div>
        {stats.total > 0 && (
          <div className="flex items-center gap-6">
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

      {/* items-stretch (the default — items-start used to override it) so
          Your Tendencies always matches New Mock panel's height instead of
          sitting a few lines tall beside it. Below the five-mock gate that
          panel is a short honest-line message; stretched to the panel's
          full height, it reads as a considered empty state instead of the
          ~500px gap this replaced. */}
      <div className="mb-7 flex items-stretch gap-5">
        <NewMockPanel
          engine={engine}
          league={league}
          problem={problem}
          lobbySlot={lobbySlot}
          onStartNew={onStartNew}
          presets={stats.presets}
          onOpenSettings={onOpenSettings}
        />
        <div className="min-w-0 flex-1">
          <TendenciesStrip stats={stats} />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <LockerTable entries={completed} onAnalyze={analyze} onDeleteConfirmed={deleteEntry} />
      </div>
    </div>
  )
}
