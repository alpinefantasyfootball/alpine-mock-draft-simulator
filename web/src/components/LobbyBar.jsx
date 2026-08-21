import { Settings } from 'lucide-react'
import JukeLogo from './juke-logo/JukeLogo.jsx'

/* The lobby's own top bar: the brand on the left, the one action on the
   right.

   It carries no "what this draft is" text and no way back — there is
   nowhere to go back *from* here, this is where a mock starts. That
   information and that chevron belong on the live draft bar instead, where
   a manager two screens deep actually needs a way back and a reminder of
   what round they're in (see DraftRoomStatusBar.jsx). Putting the brand
   mark here instead does the job every other screen's header already does:
   say what app this is.

   START DRAFT lives here rather than inside a settings column because it is
   the single thing this screen is asking for, and a primary action buried in
   one of three equal columns does not read as one. Teal, per the
   one-primary-action rule — this is the only control on the screen that
   acts.

   The teal→purple gradient (`from-[#00E5FF] to-[#7B1FA2]`, `shadow-glass`,
   `hover:scale-105` + glow) is copied verbatim from Hero.jsx's "Start a Mock
   Draft" rather than built fresh — that button's own comment calls it "the
   product's actual 'start' button", which is exactly this control's job
   from a different screen. The same class string is Header.jsx's "Sign Up",
   RoomPanel.jsx's "Create a room" and DraftLocker.jsx's "Start your first
   mock": eleven components independently converged on it for a primary
   action, which is a much stronger signal than one component's colour.

   It went through two wrong colours before this one. First a flat, darkened
   teal built to carry white text the way the old orange CTA did — that
   matched nothing on screen. Then flat full-strength `teal-500` under dark
   `obsidian` text, copied from DraftLocker's "In Progress" pill — closer,
   but that pill is a tab/status indicator, not a call to action, and this
   button is the same action as "Start your first mock" a few pixels below
   it in the Locker, not the same kind of control as a toggle beside it.
   Match the thing doing the same job, not the nearest thing wearing teal.

   The gear beside it is the same modal the draft room uses. Everything a
   league is lives in there, so the lobby does not need a settings column of
   its own: General, Roster, Scoring, Order and Invite are all one click away
   and none of them is duplicated out here. */
export default function LobbyBar({ onStart, onOpenSettings, startLabel, startDisabled, problem }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0B0E14]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
        <a href="#/" aria-label="Juke home" className="shrink-0">
          <JukeLogo size={20} />
        </a>

        <div className="min-w-0 flex-1" />

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
            'shrink-0 rounded-full px-5 py-2 text-sm font-semibold ' +
            (startDisabled
              ? 'cursor-not-allowed bg-white/5 text-white/25 transition-colors duration-150'
              : 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-glass ' +
                'transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]')
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
