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
// Draft sounds used to have a line here too ("Turn draft sounds on/off"),
// removed the moment DraftCockpitHeader.jsx grew a real, always-visible
// icon for it in both its preDraft and live modes. Keeping both would be
// the same control reachable two ways showing two different affordances
// for one boolean — exactly the kind of duplicate this file's own comment
// above already argues against for Pause and Undo.
export default function DraftMenuOverlay({
  engine,
  onClose,
  onOpenSettings,
  inRoom,
  discardLabel,
  discardDanger,
  onDiscard,
}) {
  const [copied, setCopied] = useState(false)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  // engine.link() — see RoomPanel.jsx's own comment on why this can't be
  // codeInUrl() plus a hand-built template: codeInUrl() reads the current
  // hash's query string, which happens to carry the room code on this
  // particular route (#/draft-room?room=...) but is the wrong source in
  // general, and was the reason this exact construction went blank the
  // moment it was reused somewhere that isn't this route.
  const link = inRoom ? engine.link() || '' : ''

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
        /* top-[52px]/lg:top-[68px]: DraftCockpitHeader's own live-draft
           header is 46px below lg now (its own mobile branch) and 62px at
           lg+, and this menu only ever opens from that header's kebab —
           52/68 is that height plus the same 6px gap the desktop value
           always used. Never opens from Analysis's mobile view: that
           screen's own fixed header covers DraftCockpitHeader's entirely
           at a higher z-index, so its kebab is not reachable there. */
        className="absolute right-4 top-[52px] w-[292px] rounded-xl border border-white/10 bg-slate-panel p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] sm:right-6 lg:top-[68px]"
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
