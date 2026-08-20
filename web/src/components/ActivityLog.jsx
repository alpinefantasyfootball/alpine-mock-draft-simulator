// Extracted out of DraftLogDock for the same reason QueueList was — see
// DraftLogDock.jsx's comment on the two wrappers around one set of tabs.
export default function ActivityLog({ picks, engine, DE, league }) {
  if (picks.length === 0) {
    return <p className="px-2 py-6 text-center text-xs text-white/30">No picks yet.</p>
  }

  return picks.map((pick) => {
    const code = DE ? DE.pickCode(pick.overall, league.teams) : pick.overall
    return (
      <p key={pick.overall} className="mb-1.5 px-1 text-xs leading-relaxed text-white/60">
        <span className="text-white/30">{code}</span>{' '}
        <span className="font-medium text-white/80">{engine.teamLabel(pick.slot)}</span> took{' '}
        <span className="text-white/90">{pick.player.name}</span>{' '}
        <span className="text-white/30">({pick.player.pos})</span>
      </p>
    )
  })
}
