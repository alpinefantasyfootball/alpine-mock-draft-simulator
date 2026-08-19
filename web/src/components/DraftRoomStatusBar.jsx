import { motion } from 'framer-motion'
import { LogOut, Pause, Play, RotateCcw, Timer } from 'lucide-react'

function IconButton({ onClick, disabled, danger, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ' +
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
}) {
  return (
    <div className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur-md sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-col justify-center">
        <span className="truncate font-display text-sm font-bold text-white sm:text-base">
          {roundText}
          {code && <span className="ml-1.5 text-white/40">({code})</span>}
        </span>
        <span
          className={
            'text-[10px] font-semibold uppercase tracking-wide ' +
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
          'flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 transition-colors duration-300 ' +
          (myTurn
            ? urgent
              ? 'animate-pulse-glow border-red-500 bg-red-500/10'
              : 'animate-pulse-glow border-teal-400 bg-teal-500/10'
            : 'border-slate-800 bg-slate-950/60')
        }
      >
        <Timer className={'h-5 w-5 shrink-0 ' + (myTurn ? (urgent ? 'text-red-400' : 'text-teal-300') : 'text-white/40')} />
        <div className="flex flex-col leading-none">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-white/40">{rightLabel}</span>
          <span
            className={
              'font-display text-xl font-bold tabular-nums ' +
              (myTurn ? (urgent ? 'text-red-300' : 'text-teal-300') : 'text-white/80')
            }
          >
            {rightValue}
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {showPause && (
          <IconButton onClick={onTogglePause} disabled={pauseDisabled} title={paused ? 'Resume clock' : 'Pause clock'}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </IconButton>
        )}
        {showUndo && (
          <IconButton onClick={onUndo} title="Undo">
            <RotateCcw className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton onClick={onDiscard} danger={discardDanger} title={discardLabel}>
          <LogOut className="h-4 w-4" />
        </IconButton>

        <div className="h-6 w-px bg-slate-800" />

        <button
          type="button"
          onClick={onToggleAutopick}
          aria-pressed={autopick}
          className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 py-1 pl-3 pr-1 transition-colors duration-200 hover:border-slate-700"
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
    </div>
  )
}
