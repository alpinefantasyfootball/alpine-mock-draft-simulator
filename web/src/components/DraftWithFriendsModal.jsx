import { useEffect } from 'react'
import { X } from 'lucide-react'
import RoomPanel from './RoomPanel.jsx'

// The Lobby's direct route to multiplayer — one click from "New mock
// draft" instead of Edit setup -> Invite, two levels down in a tabbed
// modal nobody would guess holds it. RoomPanel carries all of the real
// logic (create, join by code, the link once one exists, the seat list);
// this is the standalone chrome around it, the same job
// DraftSettingsModal.jsx's own outer shell does for its tabs, sized for
// one card instead of a whole tabbed dialog.
//
// Deliberately doesn't auto-advance to the seat-picker on creation. Doing
// that the instant createRoom() resolves would swap this modal for the
// live Cockpit before the host ever saw the link RoomPanel just rendered
// — "surfaces the invite link immediately" and "lands on the seat-picker
// after" can't both be true of the same synchronous tick.
//
// That used to mean closing this by hand and pressing the card's own
// "Start mock draft" underneath to get any further — which read as two
// clicks to do one thing, and the second control wasn't even visible from
// here. RoomPanel's own "Enter draft room" button (present once a room
// exists) is the explicit version of that same next step, reachable
// without leaving this screen: onEnter is enterDraftRoom (DraftRoom.jsx),
// and closing this modal along with it is this component's own job, not
// RoomPanel's — RoomPanel doesn't know it's inside a modal at all.
//
// onCreated is threaded straight through to RoomPanel rather than
// duplicated here — see DraftRoom.jsx's own suppressAutoEnterRef comment
// for what it's actually for (keeping the Lobby's own room-creation action
// from tripping the same auto-enter effect a followed invite link relies
// on).
export default function DraftWithFriendsModal({ onClose, onCreated, onEnter }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleEnter = () => {
    onEnter()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-rule bg-slate-sunk text-white/60 shadow-lg transition-colors duration-150 hover:border-slate-rule hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <RoomPanel onCreated={onCreated} onEnter={handleEnter} />
      </div>
    </div>
  )
}
