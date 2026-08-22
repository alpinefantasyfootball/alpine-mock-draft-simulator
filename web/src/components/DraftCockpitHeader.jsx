import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, MoreHorizontal, Settings } from 'lucide-react'
import Ticker from './Ticker.jsx'
import JukeLogo from './juke-logo/JukeLogo.jsx'

const TABS = [
  { key: 'decide', label: 'Decide' },
  { key: 'board', label: 'Board' },
  { key: 'analysis', label: 'Analysis' },
]

// Replaces DraftRoomStatusBar's role at both its call sites in
// DraftRoom.jsx — one component, a `preDraft` prop swapping the tab row
// for the pre-draft label, exactly the branch DraftRoomStatusBar already
// made. 62px per the Cockpit handoff, not the old h-14 (56px) — settled
// once here since the market ticker strip below it and the page's own
// top padding both have to move with it (see DraftRoom.jsx's own
// pt-[62px]/md:pt-[86px] comment).
//
// The chevron-back control isn't in the handoff's own header mockup —
// its Cockpit prototype treats the logo as the only way home. But the
// Finish handoff explicitly names "the chevron top-left" as one of the
// four exit doors, and this app already has one real, working
// destination for it (#/drafts, the locker) that a manager mid-draft
// still needs. Kept as its own control rather than removed on the
// strength of one prototype's omission.
//
// No live tabs pre-draft: the Entry screenshot shows the three tab
// labels even before a draft starts, but nothing behind Board or
// Analysis exists yet at that point, and a tab that looks pressable and
// does nothing is the exact "dead control" trap this handoff's own
// review caught elsewhere. Pre-draft keeps DraftRoomStatusBar's own
// label-slot precedent (the league problem, or "Choose your seat")
// instead.
export default function DraftCockpitHeader({
  preDraft,
  problem,
  startLabel,
  startDisabled,
  onStartDraft,
  cockpitTab,
  onSelectTab,
  round,
  overall,
  code,
  myTurn,
  urgent,
  over,
  clockLength,
  timeLeft,
  autopick,
  onToggleAutopick,
  onOpenMenu,
}) {
  const pct = clockLength ? Math.max(0, Math.min(100, (timeLeft / clockLength) * 100)) : 0

  return (
    <Fragment>
      <header className="fixed inset-x-0 top-0 z-50 flex h-[62px] shrink-0 items-center gap-[14px] border-b border-white/[0.06] bg-obsidian/90 px-4 backdrop-blur-md sm:gap-[22px] sm:px-6">
        <a
          href="#/drafts"
          aria-label="Back to your draft locker"
          title="Back to your draft locker"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950/60 text-white/50 transition-colors duration-150 hover:border-slate-700 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </a>
        <a href="#/" aria-label="Juke home" className="hidden shrink-0 sm:block">
          <JukeLogo size={19} />
        </a>

        <div className="hidden h-6 w-px shrink-0 bg-white/10 sm:block" />

        {!preDraft && (
          <nav className="hidden shrink-0 items-center gap-5 md:flex">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => onSelectTab(t.key)}
                aria-pressed={cockpitTab === t.key}
                className={
                  'border-0 bg-transparent p-0 font-body text-xs font-bold uppercase tracking-[0.1em] transition-colors ' +
                  (cockpitTab === t.key ? 'text-teal-300' : 'text-white/50 hover:text-white/75')
                }
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}

        <div className="min-w-0 flex-1" />

        {preDraft ? (
          <span className="truncate font-plex text-xs text-white/60" title={problem || undefined}>
            {problem || 'Nobody has picked yet'}
          </span>
        ) : over ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300">
            Draft complete
          </span>
        ) : (
          <div
            className={
              'flex items-center gap-3.5 rounded-full px-3.5 py-1.5 transition-colors duration-300 ' +
              (myTurn
                ? urgent
                  ? 'animate-pulse-glow bg-rose-500/10'
                  : 'animate-pulse-glow bg-teal-500/10'
                : 'bg-white/[0.045]')
            }
          >
            <div className="flex flex-col gap-1">
              <span
                className={
                  'font-body text-[10px] font-bold uppercase tracking-[0.1em] ' +
                  (myTurn ? (urgent ? 'text-rose-400' : 'text-teal-300') : 'text-white/55')
                }
              >
                Round {round} · Pick {overall}{myTurn ? ' · your turn' : ''}
              </span>
              {myTurn && (
                <div className="h-[3px] w-[150px] overflow-hidden rounded-full bg-white/[0.12]">
                  <div
                    className={'h-full rounded-full ' + (urgent ? 'bg-rose-400' : 'bg-teal-400')}
                    style={{ width: pct + '%' }}
                  />
                </div>
              )}
            </div>
            <span
              className={
                'font-display text-[32px] font-bold leading-none tabular-nums ' +
                (myTurn ? (urgent ? 'text-rose-300' : 'text-teal-300') : 'text-white/70 text-base')
              }
            >
              {code}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1" />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleAutopick}
            aria-pressed={autopick}
            className="flex items-center gap-2.5 rounded-full bg-white/5 py-1.5 pl-3.5 pr-1.5 transition-colors duration-150 hover:bg-white/[0.09]"
          >
            <span className="hidden text-xs font-semibold text-white/70 sm:inline">Autopick</span>
            <span className={'relative block h-[18px] w-[34px] rounded-full transition-colors duration-200 ' + (autopick ? 'bg-teal-500/70' : 'bg-white/[0.16]')}>
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white"
                style={{ left: autopick ? 18 : 2 }}
              />
            </span>
          </button>

          {preDraft ? (
            <>
              {/* A separate control from Start — league shape is still
                  editable up until the real startDraft() call, same rule
                  DraftRoomStatusBar's own preDraft mode followed. Reuses
                  onOpenMenu: DraftRoom.jsx passes the same "open settings"
                  handler for both props pre-draft, since there's no menu
                  to open yet, only settings. */}
              <button
                type="button"
                onClick={onOpenMenu}
                title="Draft settings"
                aria-label="Draft settings"
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors duration-150 hover:bg-white/[0.09] hover:text-white"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onStartDraft}
                disabled={startDisabled}
                title={problem || undefined}
                className={
                  'shrink-0 rounded-full px-5 py-2 text-sm font-semibold ' +
                  (startDisabled
                    ? 'cursor-not-allowed bg-white/5 text-white/25'
                    : 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]')
                }
              >
                {startLabel}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenMenu}
              title="Draft options"
              aria-label="Draft options"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors duration-150 hover:bg-white/[0.09] hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* top-[62px] to match the new header height — see its own comment.
          Same reasoning DraftRoomStatusBar's ticker strip already had:
          real ADP/scores content, moved below the bar a manager is
          watching their pick clock on rather than removed. */}
      <div className="fixed inset-x-0 top-[62px] z-40 hidden h-6 items-center border-b border-white/5 bg-obsidian/60 px-3 backdrop-blur-md md:flex sm:px-6">
        <Ticker />
      </div>
    </Fragment>
  )
}
