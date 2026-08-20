import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { LogOut, Pause, Play, RotateCcw, Settings, Timer, Volume2, VolumeX } from 'lucide-react'
import Ticker from './Ticker.jsx'
import JukeLogo from './juke-logo/JukeLogo.jsx'

function IconButton({ onClick, disabled, danger, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 sm:h-8 sm:w-8 ' +
        (disabled
          ? 'cursor-not-allowed border-slate-800 bg-slate-950/60 text-white/20'
          : danger
            ? 'border-slate-800 bg-slate-950/60 text-white/60 hover:border-rose-500/50 hover:text-rose-400'
            : 'border-slate-800 bg-slate-950/60 text-white/60 hover:border-teal-400/50 hover:text-teal-300')
      }
    >
      {children}
    </button>
  )
}

// This used to be two stacked bars — a fixed h-16 Header (logo, ticker,
// log in/sign up) with a normal-flow h-16 status bar underneath it — 128px
// of top chrome before a single round of the board was visible. Now it IS
// the fixed top bar for the live draft view (DraftRoom.jsx no longer
// renders <Header/> once a draft has started), one h-14 row carrying
// everything: brand + market ticker on the left, the pick clock a manager
// is actually watching in the middle, draft controls on the right. Log
// in/Sign up are dropped here specifically — not from Header.jsx itself,
// which still carries them on the homepage and the pre-draft setup screen
// — because there's nowhere left to put them without either shrinking
// something a manager mid-draft actually needs or pushing past the height
// budget, and neither this prompt nor a real drafter needs them mid-pick.
//
// The countdown's glow reuses the same pulse-glow keyframe the tailwind
// config already defines for this exact colour (teal, 0.4 alpha) rather
// than a second hand-rolled animation — see tailwind.config.js.
export default function DraftRoomStatusBar({
  roundText,
  code,
  rightLabel,
  rightValue,
  myTurn,
  urgent,
  soundOn,
  onToggleSound,
  autopick,
  onToggleAutopick,
  showPause,
  paused,
  pauseDisabled,
  onTogglePause,
  showUndo,
  onUndo,
  discardLabel,
  discardDanger,
  onDiscard,
  onOpenSettings,
}) {
  return (
    <Fragment>
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-white/5 bg-obsidian/80 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
      {/* Leaving via the logo (real navigation, home route) is not the same
          action as Discard/"Leave the room" below — see CLAUDE.md: leaving
          the draft screen stops the clock without clearing the save, only
          Discard does that. Both controls coexist on purpose. */}
      <a href="#/" aria-label="Juke home" className="shrink-0">
        <JukeLogo size={18} />
      </a>

      {/* flex-1 + min-w-[64px], not min-w-0 alone: a flex-basis-0 item has
          no floor of its own and will happily shrink straight to nothing
          once its shrink-0 siblings (logo, clock, four action icons) claim
          the rest of a 375px row — measured: it really did render 0px and
          "Round 6, Pick 10" disappeared outright, which is the one fact on
          this bar CLAUDE.md is explicit should never be the thing that
          gives (see "the pick is the fact and the state is the label").
          64px is enough for a truncated "Round 6" even at the narrowest
          supported width; Undo below sm is what actually pays for it. */}
      <div className="flex min-w-[52px] flex-1 flex-col justify-center leading-tight sm:flex-none sm:shrink-0">
        <span className="truncate font-display text-xs font-bold text-white sm:text-sm">
          {roundText}
          {code && <span className="ml-1 text-white/40">({code})</span>}
        </span>
        <span
          className={
            'truncate text-[9px] font-semibold uppercase tracking-wide ' +
            (myTurn ? (urgent ? 'text-red-400' : 'text-teal-400') : 'text-white/40')
          }
        >
          {myTurn ? "You're on the clock" : 'Waiting on the room'}
        </span>
      </div>

      {/* Right next to the round/pick text on purpose — this is the one
          number a manager is watching while it's their turn, not a status
          detail to push off to the far edge of the bar. */}
      <div
        className={
          'flex shrink-0 items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors duration-300 sm:gap-1.5 sm:px-2 ' +
          (myTurn
            ? urgent
              ? 'animate-pulse-glow border-red-500 bg-red-500/10'
              : 'animate-pulse-glow border-teal-400 bg-teal-500/10'
            : 'border-slate-800 bg-slate-950/60')
        }
      >
        <Timer className={'hidden h-4 w-4 shrink-0 sm:block ' + (myTurn ? (urgent ? 'text-red-400' : 'text-teal-300') : 'text-white/40')} />
        <div className="flex flex-col leading-none">
          <span className="text-[8px] font-semibold uppercase tracking-wide text-white/40">{rightLabel}</span>
          <span
            className={
              'font-display text-sm font-bold tabular-nums ' +
              (myTurn ? (urgent ? 'text-red-300' : 'text-teal-300') : 'text-white/80')
            }
          >
            {rightValue}
          </span>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        {/* The mobile queue-open icon that used to live here is gone — the
            bottom sheet's own tab bar in PlayerHub.jsx is the real
            navigation now, not an icon tucked in an already-tight header. */}
        <IconButton onClick={onToggleSound} title={soundOn ? 'Turn draft sounds off' : 'Turn draft sounds on'}>
          {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </IconButton>
        {showPause && (
          <IconButton onClick={onTogglePause} disabled={pauseDisabled} title={paused ? 'Resume clock' : 'Pause clock'}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </IconButton>
        )}
        {showUndo && (
          // The wrapper carries the responsive hide, not the button itself
          // — IconButton's own className already sets `flex` unconditionally,
          // and layering `hidden` onto the same element would leave two
          // display utilities on one node with no reliable winner. Hidden
          // below sm, not removed: Pause and Discard are the two controls a
          // manager reaches for without thinking, Undo is a correction for
          // a mistake — the one of the three that can wait for a wider
          // screen without the bar losing the round/pick text it's built
          // around (see the comment on that block).
          <span className="hidden sm:inline-flex">
            <IconButton onClick={onUndo} title="Undo">
              <RotateCcw className="h-3.5 w-3.5" />
            </IconButton>
          </span>
        )}
        {/* Everything a league is - the lineup, all 44 scoring rules, and the
            invite link - lives behind this. Two of those three worked the
            whole time and simply had no door. */}
        <IconButton onClick={onOpenSettings} title="Draft settings">
          <Settings className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton onClick={onDiscard} danger={discardDanger} title={discardLabel}>
          <LogOut className="h-3.5 w-3.5" />
        </IconButton>

        <div className="hidden h-6 w-px bg-slate-800 sm:block" />

        <button
          type="button"
          onClick={onToggleAutopick}
          aria-pressed={autopick}
          className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 py-1 pl-1.5 pr-1 transition-colors duration-200 hover:border-slate-700 sm:pl-3"
        >
          <span className="hidden text-xs font-medium text-white/60 sm:inline">
            Autopick: <span className={autopick ? 'text-teal-400' : 'text-white/40'}>{autopick ? 'ON' : 'OFF'}</span>
          </span>
          <span
            className={
              'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ' +
              (autopick ? 'bg-teal-500/70' : 'bg-slate-700')
            }
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
              style={{ left: autopick ? 18 : 2 }}
            />
          </span>
        </button>
      </div>
    </header>

    {/* The ticker's own real-data content (see Ticker.jsx) didn't stop
        being worth showing — it just doesn't belong crowding the bar a
        manager is watching their pick clock on. A thin strip under the
        main bar rather than removed outright. hidden md:flex here on top
        of Ticker's own internal hidden/md:block: the *strip* needs to
        collapse to nothing below md too, not just its contents, or a
        manager on a phone gets an empty bordered bar for no reason — and
        DraftRoom.jsx's pt- offset below the board has to grow to match
        (see the comment there). */}
    <div className="fixed inset-x-0 top-14 z-40 hidden h-6 items-center border-b border-white/5 bg-obsidian/60 px-3 backdrop-blur-md md:flex sm:px-6">
      <Ticker />
    </div>
    </Fragment>
  )
}
