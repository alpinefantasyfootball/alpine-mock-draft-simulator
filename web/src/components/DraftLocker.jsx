import { useReducer, useState } from 'react'
import { useEngine, useJukeTick } from '../hooks/useJukeEngine.js'
import DraftHistoryCard from './DraftHistoryCard.jsx'
import DraftInProgressCard from './DraftInProgressCard.jsx'

const TABS = [
  { key: 'progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

function EmptyState({ title, body }) {
  const scrollToForm = () => {
    document.getElementById('configure-draft')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true">
        <circle cx="44" cy="44" r="43" stroke="url(#locker-empty-ring)" strokeWidth="1.5" strokeDasharray="4 6" />
        <rect x="26" y="30" width="36" height="30" rx="4" stroke="#00E5FF" strokeOpacity="0.5" strokeWidth="1.5" />
        <path d="M26 38h36" stroke="#00E5FF" strokeOpacity="0.5" strokeWidth="1.5" />
        <circle cx="44" cy="34" r="1.6" fill="#00E5FF" fillOpacity="0.7" />
        <path d="M38 47l4 4 8-8" stroke="#7B1FA2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="locker-empty-ring" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00E5FF" stopOpacity="0.5" />
            <stop offset="1" stopColor="#7B1FA2" stopOpacity="0.5" />
          </linearGradient>
        </defs>
      </svg>

      <div>
        <p className="font-display text-base font-semibold text-white">{title}</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/50">{body}</p>
      </div>

      <button
        type="button"
        onClick={scrollToForm}
        className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-5 py-2.5 text-sm font-semibold text-white
                   shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
      >
        Start your first mock
      </button>
    </div>
  )
}

export default function DraftLocker() {
  const engine = useEngine()
  useJukeTick(engine)
  const [view, setView] = useState('progress')
  // clearSave() is a plain localStorage write with no juke:header event
  // behind it (nothing else in app.js needs to hear about it), so the one
  // save slot this reads doesn't get an automatic re-render — this forces
  // one immediately after Discard rather than leaving a stale card up until
  // some unrelated engine event happens to sweep through.
  const [, forceLocal] = useReducer((x) => x + 1, 0)

  const inProgress = engine ? engine.inProgressSummary() : null
  const completed = engine ? engine.historyList() : []

  // openHistoryDraft() and resumeSavedDraft() both switch the whole screen
  // over to the Draft Room's own view (Analysis for a finished draft, the
  // board for one still running) — app.js's own DOM takes it from here.
  const analyze = (id) => { if (engine) engine.openHistoryDraft(id) }
  const resume = () => { if (engine) engine.resumeSavedDraft() }
  const discard = () => {
    if (!engine) return
    engine.clearSave()
    forceLocal()
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-charcoal/60">
      <div
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-[#7B1FA2]/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative shrink-0 border-b border-white/5 px-6 py-5">
        <h2 className="font-display text-xl font-bold text-white">Your Draft Locker</h2>
        <p className="mt-1 text-sm text-white/50">Every mock you've run — in progress or done.</p>
      </div>

      <div className="relative flex shrink-0 justify-center border-b border-white/5 px-6 py-4">
        <div className="inline-flex rounded-full border border-slate-800 bg-slate-950/60 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              aria-pressed={view === tab.key}
              className={
                'rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-150 ' +
                (view === tab.key ? 'bg-teal-500 text-obsidian' : 'text-white/50')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'progress' ? (
        inProgress ? (
          <div className="relative flex-1 overflow-y-auto px-6 py-5">
            <DraftInProgressCard draft={inProgress} onResume={resume} onDiscard={discard} />
          </div>
        ) : (
          <EmptyState
            title="Nothing in progress"
            body="Start a mock and it'll sit here while you draft, so you can pick up right where you left off."
          />
        )
      ) : completed.length === 0 ? (
        <EmptyState
          title="Your locker is empty"
          body="Finish a mock draft and it lands here — league type, your slot, and how the board graded it."
        />
      ) : (
        <div className="relative flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-3">
            {completed.map((draft) => (
              <DraftHistoryCard key={draft.id} draft={draft} onAnalyze={() => analyze(draft.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
