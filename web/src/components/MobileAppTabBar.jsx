/* The app-level bottom nav — moved to phone/FloatingNavPill.jsx.

   This file was the flush, edge-to-edge, full-width bar welded to the
   bottom of the Lobby. It is a floating pill now, and that is a real
   change rather than a restyle: see FloatingNavPill.jsx's own comment for
   why a bar attached to the bottom edge reads as browser chrome and a
   detached one reads as the app.

   Kept as a re-export rather than deleted, and the tabs moved with it, so
   there is exactly one nav to change when a tab is added. The two things
   that did move are noted there too — a "Home" tab, which this bar never
   had because there was no phone homepage to point it at, and the
   NAV_PILL_CLEARANCE every scroller underneath it now has to reserve
   (a `fixed` pill costs the page no layout height, so nothing gets that
   clearance for free the way a flush bar's own height gave it). */
export { default } from './phone/FloatingNavPill.jsx'
export { NAV_PILL_CLEARANCE } from './phone/FloatingNavPill.jsx'
