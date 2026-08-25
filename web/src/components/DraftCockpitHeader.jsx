import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, MoreHorizontal, Settings } from 'lucide-react'
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
      {/* Three grid tracks, not a flex row with two flex-1 spacers either
          side of the pill. Flex-1 spacers only centre content in the space
          *left over* after both side blocks — and those two blocks are not
          the same width (chevron+logo+tabs on the left runs to ~400px at
          lg, autopick+kebab on the right is under half that), so the pill
          sat visibly off-centre, measured 86px right of the bar's true
          centre at 1280px. `1fr auto 1fr` is the same fix CLAUDE.md already
          documents for the legacy `.shellbar`/`.appbar-inner` header doing
          the identical job: forcing the two outer tracks to equal width is
          what makes the middle one sit on the bar's real centre regardless
          of how much either side is carrying, rather than merely being
          centred between them.

          Two things had to be fixed, not one, and the first fix alone
          looked like it hadn't worked at all. minmax(0,1fr), not a bare
          1fr — a bare 1fr track defaults to minmax(auto,1fr), which floors
          the track at its own content's min-content size before the fr
          weights ever get a say. With the left block needing ~400px at lg
          and the right needing under 150, that floor bound asymmetrically:
          left claimed its whole minimum first, *then* the two shared what
          was left 1:1, so the tracks ended up unequal again, just less so
          — measured at 34px off-centre instead of 86. minmax(0,…) removes
          the content floor entirely, and DOES force the two tracks to the
          same width — measured 451.2px each afterwards, exactly equal.

          The pill still sat 34px off-centre with equal tracks either side
          of it, because a grid item's default alignment is stretch: the
          pill's own div (and the preDraft/over spans in the other two
          branches) had no width set, so each filled the *entire* middle
          track and then left-aligned its own content inside that
          stretched box — visually indistinguishable from never having
          been centred. justify-self-center on all three is the other
          half: it sizes each box to its own content instead of stretching
          it, so *that* box is what lands centred on the track, and its
          content with it.

          Five blocks want this bar and it is 62px tall, not wide: measured at
          their natural widths, chevron 28 + logo 95 + divider 1 + tabs 210 +
          the pick pill 313 at its widest + controls 158 is 805px of content,
          and seven 22px gaps and 48px of padding put the minimum at 1007. That
          is an lg bar. It had been overflowing every width below it - 916
          against 768, 685 against 640 - with the surplus running off the right
          edge, where the controls sat. So four things stand down below lg, in
          the order of what can wait, and every one of them is measured rather
          than guessed.

          The gaps are the first: 22px between eight blocks is 154px, more than
          the logo and the tabs together. 12px until lg rather than 22 until
          sm, and the 24px side padding holds at 16 with them. The worst case is
          not the one on screen while you check: "Pick 140" and a 14.10 clock is
          13px wider than the round-one pill at 375 and 38px wider at 768, and
          it is the one that has to fit. At 14px this cleared 768 and missed 375
          by a single pixel, which is the kind of margin that is not a margin -
          12 takes the phone to 368 against 375 and 768 to 746. */}
      <header className="fixed inset-x-0 top-0 z-50 grid h-[62px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-white/[0.06] bg-slate-bar/90 px-4 backdrop-blur-md lg:gap-[22px] lg:px-6">
        <div className="flex min-w-0 items-center gap-3 lg:gap-[22px]">
        <a
          href="#/drafts"
          aria-label="Back to your draft locker"
          title="Back to your draft locker"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-rule bg-slate-sunk/60 text-white/50 transition-colors duration-150 hover:border-slate-rule hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </a>
        {/* lg rather than sm, which is where the room's own layout switches
            anyway. The logo is the second thing to stand down and the easiest:
            the chevron immediately to its left already goes back, so below lg
            this is the second way out of a bar that has room for one - the same
            call the legacy header made when it merged its mark and its chevron
            into a single control. 95px of lockup plus a 22px gap plus the
            divider and its gap is 140px, the largest single saving available
            here, and mark-only would have returned just 63 of it. */}
        <a href="#/" aria-label="Juke home" className="hidden shrink-0 lg:block">
          <JukeLogo size={19} surface="appbar" />
        </a>

        <div className="hidden h-6 w-px shrink-0 bg-white/10 lg:block" />

        {/* The tabs do not stand down between md and lg, and that is
            deliberate: `decide` swaps the whole content area, so a width that
            can reach this nav and nothing else is a width with no way off
            whichever view you are on. Only the gap gives, 20px to 12px below
            lg, which is 16px back.

            Below md this nav is hidden and MobileDraftTabBar.jsx is what
            answers for it - a bottom bar, lg:hidden, carrying Decide and Board
            beside the two PlayerHub tabs. Until that arrived, hiding this nav
            below md left the view opening on `decide` with no way out of it,
            and an earlier version of this comment said so and proposed the
            kebab menu. That is now fixed and fixed somewhere better, so the
            note is corrected rather than left standing. */}
        {!preDraft && (
          <nav className="hidden shrink-0 items-center gap-3 md:flex lg:gap-5">
            {/* Decide has nothing left to decide once the draft is over —
                DraftRoom.jsx already redirects off it on that edge, and a
                design review asked for the tab itself to disappear too
                rather than stay selectable onto a dead end. */}
            {TABS.filter((t) => !(over && t.key === 'decide')).map((t) => (
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
        </div>

        {/* justify-self-center on all three branches — a grid item's
            default alignment is stretch, so without this each one filled
            the whole middle track (itself now correctly centred, per the
            comment on the header's own grid-cols above) and then
            left-aligned its own content inside that stretched box, which
            looked identical to the pill never having been centred at all.
            centering the box itself at its natural width is what actually
            lands the content on the bar's true centre. */}
        {preDraft ? (
          <span className="justify-self-center truncate font-plex text-xs text-white/60" title={problem || undefined}>
            {problem || 'Nobody has picked yet'}
          </span>
        ) : over ? (
          <span className="inline-flex items-center gap-2 justify-self-center rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300">
            Draft complete
          </span>
        ) : (
          <div
            className={
              'flex items-center gap-3.5 justify-self-center rounded-full px-3.5 py-1.5 transition-colors duration-300 ' +
              (myTurn
                ? urgent
                  ? 'bg-rose-500/20 shadow-[inset_0_0_0_1.5px_rgba(251,113,133,0.55)]'
                  : 'bg-teal-500/20 shadow-[inset_0_0_0_1.5px_rgba(0,229,255,0.55)]'
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
                {/* xl, because "your turn" is the fourth thing on this pill
                    already saying so: it turns teal (rose when urgent), it
                    pulses, it grows a progress bar that exists on no other
                    turn, and this label goes teal with it. CLAUDE.md's own
                    note on the legacy header made this argument the other way
                    round - "by the time that sentence is readable the whole
                    header has turned blue" - so it is the redundant half, and
                    it is 70px of the pill's 313. The pick number underneath it
                    never gives; that one is the fact. */}
                {/* "Round N · " goes below sm and `Pick {overall}` stays, and
                    the split is between a fact that is duplicated here and one
                    that is not. The big number beside this is `code` -
                    pickCode(overall, teams), "3.05" - so it already carries the
                    round, and printing "Round 3" next to "3.05" spends 50px
                    saying it twice. `overall` is 25 in that same example and
                    appears nowhere else on the bar, so it is the half that
                    stays. */}
                <span className="hidden sm:inline">Round {round} · </span>Pick {overall}
                {myTurn && <span className="hidden xl:inline"> · your turn</span>}
              </span>
              {/* This bar is the whole clock - the big number beside it is the
                  pick code, not a countdown - so it cannot go, but its width is
                  a proportion and carries nothing, and at 150px it was the
                  widest thing in this column and therefore the real floor under
                  the pill. 64px below sm. */}
              {myTurn && (
                <div className="h-[3px] w-16 overflow-hidden rounded-full bg-white/[0.12] sm:w-[150px]">
                  <div
                    className={'h-full rounded-full ' + (urgent ? 'bg-rose-400' : 'bg-teal-400')}
                    style={{ width: pct + '%' }}
                  />
                </div>
              )}
            </div>
            <span
              className={
                /* 26px below lg. Last and smallest of the four, 13px, and the
                   one to undo first if this bar ever gets room back. */
                'font-display text-[26px] font-bold leading-none tabular-nums lg:text-[32px] ' +
                (myTurn ? (urgent ? 'text-rose-300' : 'text-teal-300') : 'text-white/70 text-base')
              }
            >
              {code}
            </span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 justify-self-end">
          {/* Nothing left to autopick once the draft is over — the toggle
              stayed fully lit and clickable on a finished board, which reads
              as a live control for a decision that no longer exists. */}
          <button
            type="button"
            onClick={onToggleAutopick}
            disabled={over}
            aria-pressed={autopick}
            title={over ? 'Draft complete' : undefined}
            className={
              'flex items-center gap-2.5 rounded-full bg-white/5 py-1.5 pl-3.5 pr-1.5 transition-colors duration-150 ' +
              (over ? 'cursor-not-allowed opacity-40' : 'hover:bg-white/[0.09]')
            }
          >
            <span className="hidden text-xs font-semibold text-white/70 sm:inline">Autopick</span>
            <span className={'relative block h-[18px] w-[34px] rounded-full transition-colors duration-200 ' + (autopick && !over ? 'bg-teal-500/70' : 'bg-white/[0.16]')}>
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
    </Fragment>
  )
}
