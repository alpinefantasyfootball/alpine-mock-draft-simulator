import { motion } from 'framer-motion'
import { Timer } from 'lucide-react'

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
}) {
  return (
    <div className="z-30 flex h-16 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-900/80 px-4 backdrop-blur-md sm:px-6">
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

      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        <div
          className={
            'flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-colors duration-300 ' +
            (myTurn
              ? urgent
                ? 'animate-pulse-glow border-red-500/70 bg-red-500/10'
                : 'animate-pulse-glow border-teal-400/70 bg-teal-500/10'
              : 'border-slate-800 bg-slate-950/60')
          }
        >
          <Timer className={'h-4 w-4 shrink-0 ' + (myTurn ? (urgent ? 'text-red-400' : 'text-teal-300') : 'text-white/40')} />
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/40">{rightLabel}</span>
            <span
              className={
                'font-display text-lg font-bold tabular-nums ' +
                (myTurn ? (urgent ? 'text-red-300' : 'text-teal-300') : 'text-white/80')
              }
            >
              {rightValue}
            </span>
          </div>
        </div>

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
