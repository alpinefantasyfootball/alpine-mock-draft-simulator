import { dark } from '@clerk/themes'

// Public by design — Clerk's own docs embed this directly in client
// bundles, unlike GIPHY_KEY/TANK01_KEY which are genuinely secret and live
// only in the worker. It still comes from an env var rather than a literal
// so a fresh clone, CI, or the Playwright build (none of which have Clerk
// configured) don't carry somebody's real key, and so every caller here can
// tell "not configured" from "configured" and answer accordingly — the same
// `configured: false` contract store.js already uses for a missing D1/API
// binding, applied on the client instead of the worker.
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || ''

// One appearance object, imported everywhere Clerk renders something (the
// header's AccountButtons today, more surfaces later), for the same reason
// NAV_LINKS lives in one place in SiteNav.jsx: two hand-tuned copies of
// "make Clerk look like Juke" would drift the first time either one changed.
// The hexes are tailwind.config.js's own `obsidian`/`charcoal` values, not
// re-picked here — Clerk's variables want real CSS colors, not class names.
export const CLERK_APPEARANCE = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#00E5FF', // --teal-cta — the app's one CTA colour
    colorBackground: '#151923', // charcoal
    colorInputBackground: '#0B0E14', // obsidian
    colorText: '#FFFFFF',
    colorTextSecondary: 'rgba(255,255,255,0.6)',
    borderRadius: '0.75rem',
    fontFamily: 'inherit',
  },
}
