import ShellHeader from './ShellHeader.jsx'
import FloatingNavPill, { NAV_PILL_CLEARANCE } from '../phone/FloatingNavPill.jsx'

/* Header, content, bottom nav — the three pieces every screen in
   design_handoff_v3_alive has, wrapped once so no screen can be built
   without one of them.

   That is the whole reason it exists rather than each screen importing
   ShellHeader and FloatingNavPill itself. The nav is mounted per-screen in
   this app (HomePhone and DraftRoom each render their own), which works and
   has exactly one failure mode: a new screen forgets it and ships with no
   way off itself on a phone. Every screen this handoff adds goes through
   here instead.

   It deliberately does NOT become the mount point for the two that already
   exist. DraftRoom renders the pill on #/rooms/draft (its own Lobby route)
   and on #/draft-room, and applyRoute() hides #view-home for both — which
   is where this component lives — so hoisting the nav here would take it
   off the Lobby entirely. Two mount points that both work beat one that is
   right for the screens it can reach and wrong for the one it cannot.

   `pad` is opt-out for a screen that manages its own bottom clearance
   (a room page pads below the locked preview, not around it). */

export default function AppShell({ active = null, pad = true, children }) {
  return (
    <>
      <ShellHeader active={active} />
      <div style={pad ? { paddingBottom: NAV_PILL_CLEARANCE } : undefined}>{children}</div>
      <FloatingNavPill />
    </>
  )
}
