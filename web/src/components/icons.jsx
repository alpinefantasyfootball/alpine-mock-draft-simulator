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
