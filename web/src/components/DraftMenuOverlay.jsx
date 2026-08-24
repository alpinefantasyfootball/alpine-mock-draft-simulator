import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// The kebab dropdown replacing DraftRoomStatusBar's flat icon row. Every
// action here already exists on the engine — this is presentation, not
// new logic, with one exception: Pause. togglePause()/paused()/isHost()
// were all already bridged (app.js) for the legacy action bar, but no
// React control ever called them — the room's own "Pause is the host's
// in a room" rule (app.js's bridge comment) is reproduced here rather
// than re-derived.
//
// "Create a copy" — one of the handoff's own menu items — is deliberately
// not here. The only engine entry point close to it, createRoom(),
// operates on the room you're already in and wipes state.picks to match
// a fresh one (see RoomPanel.jsx's own comment: "adoptRoom() ... wipes
// state.picks and un-drafts the whole board"). Wiring a menu item to
// that mid-draft would silently discard whatever's been picked so far —
// exactly the kind of destructive action this file's own Discard control
// already puts behind a confirm. Needs real engine work, not a button.
export default function DraftMenuOverlay({
  engine,
  onClose,
  onOpenSettings,
  inRoom,
  isHost,
  clockLength,
  paused,
  onTogglePause,
  showFinish,
  onFinish,
  showUndo,
  onUndo,
  soundOn,
  onToggleSound,
  discardLabel,
  discardDanger,
  onDiscard,
}) {
  const [copied, setCopied] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  // Same construction RoomPanel.jsx already uses for its own Copy button
  // — codeInUrl() is the bridged read of Live.codeInUrl(), not a second
  // hash parser.
  const code = inRoom ? engine.codeInUrl() : null
  const link = code && typeof window !== 'undefined' ? `${location.origin}${location.pathname}#/draft-room?room=${code}` : ''

  const copyLink = () => {
    if (!link || !navigator.clipboard) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const act = (fn) => () => {
    fn()
    onClose()
  }

  const Item = ({ label, sub, color, onClick, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'block w-full rounded-lg px-3 py-2.5 text-left transition-colors ' +
        (disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-white/[0.06]')
      }
    >
      <span className={'block text-sm font-semibold ' + (color || 'text-white')}>{label}</span>
      {sub && <span className="mt-0.5 block text-xs leading-relaxed text-white/55">{sub}</span>}
    </button>
  )

  const Rule = () => <div className="my-1.5 h-px bg-white/[0.08]" />

  // Pause shown only where it can actually do something: a clock has to
  // exist (clockLength > 0), and in a room only the host may fire it —
  // togglePause() itself already refuses anyone else server-side, but
  // the button shouldn't be offered at all rather than offered and
  // silently ignored, same reasoning Undo's own room-hide already uses.
  const showPause = clockLength > 0 && (!inRoom || isHost)

  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-4 top-[68px] w-[292px] rounded-xl border border-white/10 bg-slate-panel p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] sm:right-6"
      >
        <Item label="Draft settings" onClick={act(onOpenSettings)} />
        {inRoom && (
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span className="text-sm font-semibold text-white">Copy invite link</span>
            {copied ? <Check className="h-3.5 w-3.5 text-teal-300" /> : <Copy className="h-3.5 w-3.5 text-white/50" />}
          </button>
        )}

        {(showPause || showFinish || showUndo) && <Rule />}

        {showPause && (
          <Item
            label={paused ? 'Resume clock' : 'Pause clock'}
            sub={inRoom ? 'Pauses it for everyone in the room.' : undefined}
            onClick={act(onTogglePause)}
          />
        )}
        {showFinish && (
          <Item
            label="Auto-draft the rest"
            sub="Fills every remaining pick with what Juke would take."
            onClick={act(onFinish)}
          />
        )}
        {showUndo && <Item label="Undo last pick" onClick={act(onUndo)} />}
        <Item label={soundOn ? 'Turn draft sounds off' : 'Turn draft sounds on'} onClick={act(onToggleSound)} />

        <Rule />

        {confirmingDiscard ? (
          <Item
            label={`Click again to ${discardDanger ? 'discard' : 'leave'}`}
            color="text-rose-300"
            onClick={act(onDiscard)}
          />
        ) : (
          <Item
            label={discardLabel}
            color={discardDanger ? 'text-rose-400' : 'text-white'}
            onClick={() => {
              if (!discardDanger) { act(onDiscard)(); return }
              setConfirmingDiscard(true)
              setTimeout(() => setConfirmingDiscard(false), 4000)
            }}
          />
        )}
      </div>
    </div>
  )
}
