import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// The kebab dropdown replacing DraftRoomStatusBar's flat icon row. Every
// action here already exists on the engine — this is presentation, not
// new logic.
//
// Pause, Undo and "Auto-draft the rest" used to live here too, and don't
// any more — a product review dropped all three on purpose. Pause and
// Undo tested as fully functional (togglePause()/undo() both work
// correctly), they just read as broken because they were buried in this
// menu instead of being where a manager would look for them; rather than
// promote controls a mock draft doesn't need — nobody else is waiting on
// you to un-pause, and there's no opponent to protect an undo from — the
// call was to cut them, matching the single "Autopick" toggle every
// competitor mock drafter actually ships. The engine's own
// undo()/togglePause()/autoDraftRest() are untouched (autoDraftRest() is
// still how a finished-draft test harness fills a board), only their
// button here is gone.
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

        <Rule />

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
