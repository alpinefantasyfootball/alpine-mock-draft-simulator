// Reserves the tab and its layout now, ahead of the real chat rebuild — see
// CLAUDE.md's note on this: chat's own worker/live.js backend (Live.chat(),
// reactions, GIF search) was never removed, only the React UI that read it,
// so this is a placeholder for wiring rather than for a feature that has no
// data behind it. Shared by DraftLogDock's desktop column and PlayerHub's
// mobile Chat tab — one placeholder, not two copies of the same "coming
// soon" text that could drift apart.
export default function ChatPlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-semibold text-white/70">Chat is moving in here</p>
      <p className="text-xs leading-relaxed text-white/35">
        This tab exists so chat has real room to sit in, next to the queue and the log, instead of
        crowding a floating corner box. The messages themselves land in a follow-up pass.
      </p>
    </div>
  )
}
