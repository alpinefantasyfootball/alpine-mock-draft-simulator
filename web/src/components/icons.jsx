import { Zap, Crown } from 'lucide-react'

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function DraftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  )
}

export function ProspectIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...base} {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  )
}

export function WaiverIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...base} {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  )
}

export function TradeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...base} {...props}>
      <path d="M4 7h13l-3-3M20 17H7l3 3" />
    </svg>
  )
}

export function StrategyIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...base} {...props}>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2.5 3.5L16 11H5Z" />
    </svg>
  )
}

export function LeagueIcon(props) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...base} {...props}>
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  )
}

// Shared by RoomsGrid.jsx (the homepage's own Rooms section) and
// RoomsNavMenu.jsx (the header's "The Rooms" dropdown) — the name, blurb,
// lead, live flag and season all come from app.js's ROOMS via the bridge,
// and this map is the one place a room name resolves to an icon, so the
// grid and the header's dropdown can't drift onto two different icon sets
// the way RoomsGrid.jsx's own top comment already warns about for the room
// list itself.
export const ROOM_ICON_BY_NAME = {
  'The Draft Room': DraftIcon,
  'The Prospect Room': ProspectIcon,
  'The Waiver Room': WaiverIcon,
  'The Trade Room': TradeIcon,
  'The Strategy Room': StrategyIcon,
  'The League Room': LeagueIcon,
}

// Which tier unlocks each room once it ships. The Draft Room carries no
// tier here — it's the one room that's free today, badged "Free Access" at
// each call site instead of looked up in this table. Shared by
// RoomsGrid.jsx and RoomsNavMenu.jsx's RoomsList (also used by
// MobileNavSheet.jsx) for the exact reason ROOM_ICON_BY_NAME above already
// is: a second, independent tier list in the nav dropdown is how "Free
// Access" on the homepage and "Live" in the header dropdown ended up
// disagreeing about the identical room in the first place.
export const ROOM_TIER = {
  'The Prospect Room': 'pro',
  'The Waiver Room': 'pro',
  'The Trade Room': 'pro',
  'The Strategy Room': 'allAccess',
  'The League Room': 'allAccess',
}

export const TIER_META = {
  pro: { label: 'Juke Pro', Icon: Zap, color: '#5EEAD4', bg: 'rgba(94,234,212,0.1)' },
  allAccess: { label: 'Juke All-Access', Icon: Crown, color: '#FBBF77', bg: 'rgba(251,191,119,0.12)' },
}

// One badge component for both surfaces, sized for the compact roadmap
// row/nav row it always renders in — a card-sized variant was tried and
// rejected: the only two call sites (RoomsGrid.jsx's roadmap list,
// RoomsNavMenu.jsx's dropdown rows) are both single-line rows in a
// constrained width, so a second size would be a distinction nothing on
// screen needs yet.
export function TierBadge({ tier, className = '' }) {
  const meta = TIER_META[tier]
  if (!meta) return null
  const { label, Icon, color, bg } = meta
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-[9px] py-[3px] font-numeral text-[9.5px] font-semibold tracking-[0.04em] ${className}`}
      style={{ color, background: bg }}
    >
      <Icon className="h-[10px] w-[10px] shrink-0" />
      {label}
    </span>
  )
}
