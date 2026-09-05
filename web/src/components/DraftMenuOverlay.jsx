import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Check, Copy, Flag, LibraryBig, Pause, Play, Settings, Trash2, Volume2, VolumeX } from 'lucide-react'
import { useMinWidth } from '../hooks/useBreakpoint.js'

/* The draft menu, behind the header's gear.

   Every action here already exists on the engine — this is presentation,
   not new logic — but WHICH actions are here changed, and the change is
   worth recording because it reverses a decision this file used to argue
   for at length.

   Pause was cut once, along with Undo and "Auto-draft the rest", by a
   product review that found all three buried in a kebab menu and reasoned
   that a mock draft does not need them: nobody else is waiting on you to
   un-pause. Pause is back at the owner's request, and the earlier argument
   was about the menu rather than about the control — a menu you reach by
   pressing a gear, in a list that reads like a list of things you can do to
   this draft, is exactly where somebody looks for it.

   Undo and "Auto-draft the rest" are still gone, and still for their own
   reasons. Undo in a room un-drafts a copy the next broadcast overwrites;
   "the rest" in a room is other people's teams.

   "Create a copy" — one of the reference app's own menu items — is
   deliberately absent. The only engine entry point close to it,
   createRoom(), operates on the room you are already in and wipes
   state.picks to match a fresh one, so wiring a menu item to it mid-draft
   would silently discard whatever has been picked so far. Needs real engine
   work, not a button.

   ---- Two frames, one list ----

   Below `sm` it is an action sheet standing up from the bottom edge: full-
   width rows, thumb-reachable, with Cancel separated at the foot. From `sm`
   up it stays the anchored dropdown under the header's gear that it always
   was. The ITEMS are one array either way — a phone-specific copy of the
   list is the thing that ends up missing an item after the next change.
*/

function useSound(engine) {
  const [, bump] = useState(0)
  return {
    on: !!engine.soundWanted(),
    toggle: () => { engine.toggleSound(); bump((n) => n + 1) },
  }
}

export default function DraftMenuOverlay({
  engine,
  onClose,
  onOpenSettings,
  onOpenNotifications,
  inRoom,
  started,
  over,
  discardLabel,
  discardDanger,
  onDiscard,
  onEndDraft,
}) {
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const sound = useSound(engine)
  const isDesktop = useMinWidth(640)
  const [, bump] = useState(0)

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

  const paused = !!engine.paused()
  /* Pausing a clock that was never running is meaningless — renderPauseButton()
     already disables the legacy button at clockLength 0 and this matches it
     rather than offering a control that does nothing. In a room it belongs to
     the host: togglePause() already refuses anyone else server-side, but a
     button that is refused is worse than a button that is not offered. */
  const canPause = started && !over && engine.clockLength() > 0 && (!inRoom || engine.isHost())

  const act = (fn) => () => { fn(); onClose() }

  /* One list, built once. `hidden` rather than a filter at the call site so
     each item's own reason for being absent sits next to the item. */
  const items = [
    canPause && {
      key: 'pause',
      label: paused ? 'Resume draft' : 'Pause draft',
      icon: paused ? Play : Pause,
      onClick: () => { engine.togglePause(); bump((n) => n + 1) },
      keepOpen: true,
    },
    /* Ends the draft rather than stepping away from it — the header's own X
       already does the second thing, and two controls that mean "back to the
       Lobby" with different words is the duplicate-affordance problem this
       file's own header comment argues against for Pause and Undo.

       So it finishes: the remaining picks are drafted, the draft is recorded
       and graded like any completed one, and you land in the Lobby with it
       in the locker. The confirm says the number out loud, because "End
       draft" does not on its own tell anybody that eighty picks are about to
       happen.

       Not offered in a room. "The rest" there is other people's teams —
       autoDraftRest() fills all of them, locally, and the host is then
       looking at a completed draft the room has never heard of. That is a
       real shipped bug this project already fixed once. */
    started && !over && !inRoom && {
      key: 'end',
      label: 'End draft',
      icon: Flag,
      confirm: (() => {
        const left = engine.league().teams * engine.league().rounds - engine.picks().length
        return `Draft the remaining ${left} pick${left === 1 ? '' : 's'} automatically and end this draft?`
      })(),
      onClick: onEndDraft,
    },
    /* The way out that is not the header's X and not a link inside the
       report. It is the same #/drafts destination both of those use, and
       it is here because neither of them reads as one when a draft has
       just finished: the header control is an unlabelled chevron, and
       "Back to the locker" sits at the bottom of the Insights report,
       which is the screen somebody is trying to leave. Reported as
       "I need a way back to the locker beyond the report itself."

       It leaves rather than ends — the draft is saved either way, and a
       finished one is already in the locker — so unlike "End draft" above
       it needs no confirm and is offered in a room too, where it is what
       the departure item below already means for the room's own seat. */
    {
      key: 'locker',
      label: 'Back to the locker',
      icon: LibraryBig,
      onClick: () => { window.location.hash = '#/rooms/draft' },
    },
    { key: 'settings', label: 'Draft settings', icon: Settings, onClick: onOpenSettings },
    {
      key: 'sound',
      label: sound.on ? 'Mute sounds' : 'Unmute sounds',
      icon: sound.on ? Volume2 : VolumeX,
      onClick: sound.toggle,
      keepOpen: true,
    },
    inRoom && {
      key: 'copy',
      label: copied ? 'Link copied' : 'Copy draft link to share',
      icon: copied ? Check : Copy,
      onClick: copyLink,
      keepOpen: true,
    },
    { key: 'notify', label: 'Notification settings', icon: Bell, onClick: onOpenNotifications },
    {
      key: 'discard',
      label: discardLabel,
      icon: Trash2,
      danger: discardDanger,
      // A room departure is recoverable — rejoining reclaims the seat — so
      // it does not ask. Discarding a solo draft is not, so it does.
      confirm: discardDanger ? 'Delete this draft? Everything picked so far is gone.' : null,
      onClick: onDiscard,
    },
  ].filter(Boolean)

  const press = (item) => {
    if (item.confirm && confirm !== item.key) {
      setConfirm(item.key)
      return
    }
    setConfirm(null)
    if (item.keepOpen) { item.onClick(); return }
    act(item.onClick)()
  }

  const rows = items.map((item) => {
    const Icon = item.icon
    const asking = confirm === item.key
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => press(item)}
        className={
          isDesktop
            ? 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]'
            : 'flex w-full items-center gap-3 border-b border-slate-rule/50 px-5 py-4 text-left last:border-b-0 active:bg-white/[0.05]'
        }
      >
        <Icon
          className={(isDesktop ? 'h-3.5 w-3.5' : 'h-[19px] w-[19px]') + ' shrink-0 ' + (item.danger ? 'text-rose-400' : 'text-ink-muted')}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span
            className={
              (isDesktop ? 'block text-sm font-semibold ' : 'block text-[16px] font-semibold ') +
              (item.danger ? 'text-rose-400' : 'text-ink')
            }
          >
            {asking ? 'Tap again to confirm' : item.label}
          </span>
          {asking && <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{item.confirm}</span>}
        </span>
      </button>
    )
  })

  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-[70]" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          /* top-[52px]/lg:top-[68px]: DraftCockpitHeader's own live-draft
             header is 46px below lg and 62px at lg+, and this menu only ever
             opens from that header's gear — 52/68 is that height plus the
             same 6px gap the desktop value always used. */
          className="absolute right-4 top-[52px] w-[292px] rounded-xl border border-white/10 bg-slate-panel p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] sm:right-6 lg:top-[68px]"
        >
          {rows}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/65 backdrop-blur-[2px]" onClick={onClose}>
      {/* Springs up from the bottom edge rather than fading in place. On a
          phone the menu is anchored to the thumb, not to the gear that
          opened it — the gear is in the top-right corner, which is the one
          part of the screen a thumb cannot comfortably reach, and an
          anchored dropdown there would put every row of the menu in the same
          place. */}
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 460, damping: 40 }}
        className="mx-2 mb-2 flex flex-col gap-2"
        style={{ marginBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
      >
        <div className="overflow-hidden rounded-[18px] border border-slate-rule bg-slate-bar">{rows}</div>
        {/* Cancel in its own group, the way an action sheet has always done
            it — separated so a thumb landing at the very bottom of the
            screen cannot hit a destructive row by a few pixels. */}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-[18px] border border-slate-rule bg-slate-panel px-5 py-4 text-center text-[16px] font-bold text-ink active:bg-white/[0.05]"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  )
}
