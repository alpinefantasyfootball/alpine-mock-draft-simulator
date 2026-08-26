import { useEffect } from 'react'
import { X } from 'lucide-react'
import RoomPanel from './RoomPanel.jsx'

// The Lobby's direct route to multiplayer — one click from "New mock
// draft" instead of Edit setup -> Invite, two levels down in a tabbed
// modal nobody would guess holds it. RoomPanel itself is untouched and
// carries all of the real logic (create, join by code, the link once one
// exists, the seat list) — this is only the standalone chrome around it,
// the same job DraftSettingsModal.jsx's own outer shell does for its
// tabs, sized for one card instead of a whole tabbed dialog.
//
// Deliberately doesn't auto-advance to the seat-picker on creation. Doing
// that the instant createRoom() resolves would swap this modal for the
// live Cockpit before the host ever saw the link RoomPanel just rendered
// — "surfaces the invite link immediately" and "lands on the seat-picker
// after" can't both be true of the same synchronous tick. Closing this
// (or leaving it open) and pressing the card's own "Start mock draft" —
// which already knows to route a room through the seat-picker rather
// than skipping it — is what gets you there once the link is copied.
export default function DraftWithFriendsModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        <RoomPanel />
      </div>
    </div>
  )
}
