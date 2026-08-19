import DraftHistoryCard from './DraftHistoryCard.jsx'

// No real draft-history persistence exists yet — app.js's SAVE_KEY holds
// exactly one draft (the current one), never a log of past ones. This is
// sample data standing in for that feature, the same way the homepage's
// prototype content did before it was wired to window.JukeEngine — it
// should be replaced wholesale once a real history store exists, not
// extended in place.
const SAMPLE_DRAFTS = [
  { id: 'sample-1', leagueType: '12-Team PPR', pickPosition: '4th', dateCompleted: 'Aug 12, 2026', projectedRank: '3rd' },
  { id: 'sample-2', leagueType: '10-Team Half PPR', pickPosition: '9th', dateCompleted: 'Aug 5, 2026', projectedRank: '1st' },
  { id: 'sample-3', leagueType: '14-Team Standard', pickPosition: '1st', dateCompleted: 'Jul 28, 2026', projectedRank: '6th' },
]

function EmptyLocker() {
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
        <p className="font-display text-base font-semibold text-white">Your locker is empty</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/50">
          Finish a mock draft and it lands here — league type, your slot, and how the board graded it.
        </p>
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
  const drafts = SAMPLE_DRAFTS

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-charcoal/60">
      <div
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full bg-[#7B1FA2]/25 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative shrink-0 border-b border-white/5 px-6 py-5">
        <h2 className="font-display text-xl font-bold text-white">Your Draft Locker</h2>
        <p className="mt-1 text-sm text-white/50">Every mock you've run, and how it graded out.</p>
      </div>

      {drafts.length === 0 ? (
        <EmptyLocker />
      ) : (
        <div className="relative flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-3">
            {drafts.map((draft) => (
              <DraftHistoryCard key={draft.id} draft={draft} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
