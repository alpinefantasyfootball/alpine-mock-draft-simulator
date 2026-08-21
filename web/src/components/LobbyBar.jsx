import { ChevronLeft, Settings } from 'lucide-react'

/* The lobby's own top bar: what this draft is on the left, the one action on
   the right, and the way out at the far left.

   START DRAFT lives here rather than inside a settings column because it is
   the single thing this screen is asking for, and a primary action buried in
   one of three equal columns does not read as one. Orange, per the one-primary-
   action rule — this is the only control on the screen that acts.

   The gear beside it is the same modal the draft room uses. Everything a
   league is lives in there, so the lobby does not need a settings column of
   its own: General, Roster, Scoring, Order and Invite are all one click away
   and none of them is duplicated out here. */
export default function LobbyBar({ summary, onStart, onOpenSettings, startLabel, startDisabled, problem }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B0E14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
        <a
          href="#/"
          aria-label="Leave the lobby"
          title="Leave the lobby"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-800 text-white/50 transition-colors duration-150 hover:border-slate-700 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </a>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-sm font-bold text-white sm:text-base">
            Mock draft
          </h1>
          {/* The same string the settings modal and the shut setup box show,
              from leagueSummary() — never a second copy of the same lookup. */}
          <p className="truncate text-[11px] text-white/45">{summary}</p>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Draft settings"
          title="Draft settings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950/60 text-white/60 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Disabled with the reason beside it, never disabled and silent —
            setupProblem()'s message is the whole explanation and hiding it
            leaves a button that refuses without saying why. */}
        <button
          type="button"
          onClick={onStart}
          disabled={startDisabled}
          title={problem || undefined}
          className={
            'shrink-0 rounded-full px-5 py-2 text-sm font-bold transition-colors duration-150 ' +
            (startDisabled
              ? 'cursor-not-allowed bg-white/5 text-white/25'
              : 'bg-[#C2410C] text-white hover:bg-[#9A3412]')
          }
        >
          {startLabel}
        </button>
      </div>

      {problem && (
        <p className="border-t border-rose-500/25 bg-rose-500/10 px-4 py-2 text-[11px] leading-relaxed text-rose-200/90">
          {problem}
        </p>
      )}
    </header>
  )
}
