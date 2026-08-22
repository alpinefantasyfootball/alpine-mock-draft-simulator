// Round 1 position's bar fills use each position's own established hue
// (POS_BADGE's solid form) rather than the handoff's literal teal-for-RB/
// purple-for-WR — POS_BADGE is documented as the one position-colour
// reference for the whole site, already shared by this same app's
// ShowYourWorking.jsx and the Draft Room's own board, and introducing a
// second RB/WR colour scheme here is exactly the "a position reads a
// different colour depending which screen you're on" bug that file exists
// to prevent. Grade colour (teal for a strong grade) is a different axis —
// quality, not identity — so that one does follow the handoff directly.
const POS_SOLID = {
  QB: '#EA580C', // orange-600
  RB: '#059669', // emerald-600
  WR: '#2563EB', // blue-600
  TE: '#C026D3', // fuchsia-600
}

function Card({ label, children }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-charcoal p-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">{label}</p>
      {children}
    </div>
  )
}

export default function TendenciesStrip({ stats, onAnalyze }) {
  if (!stats || !stats.total) return null

  const cards = []

  if (stats.mostDrafted) {
    const pct = Math.round((stats.mostDrafted.count / stats.mostDrafted.total) * 100)
    cards.push(
      <Card key="mostDrafted" label="Most drafted">
        <p className="font-display text-[23px] font-bold text-white">{stats.mostDrafted.name}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-teal-400" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs tabular-nums text-white/55">
          {stats.mostDrafted.count} of {stats.mostDrafted.total}
        </p>
      </Card>
    )
  }

  if (stats.round1Position) {
    cards.push(
      <Card key="round1Position" label="Round 1 position">
        <div className="flex flex-col gap-2">
          {stats.round1Position.map((row) => (
            <div key={row.pos} className="grid grid-cols-[26px_1fr_34px] items-center gap-2">
              <span className="text-[10px] font-bold text-white/50">{row.pos}</span>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${row.pct}%`, background: POS_SOLID[row.pos] || 'rgba(255,255,255,0.3)' }}
                />
              </div>
              <span className="text-right text-[10px] tabular-nums text-white/70">{row.pct}%</span>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (stats.gradeLast12) {
    cards.push(
      <Card key="gradeLast12" label="Grade, last 12">
        <div className="flex h-[42px] items-end gap-1">
          {stats.gradeLast12.entries.map((e) => {
            const height = Math.max(4, Math.min(42, Math.round((e.score / 100) * 42)))
            const fill = e.score >= 80 ? '#00E5FF' : e.score >= 60 ? 'rgba(0,229,255,0.5)' : 'rgba(255,255,255,0.18)'
            return (
              <div
                key={e.id}
                title={`${e.grade} (${e.score})`}
                className="flex-1 rounded-sm"
                style={{ height, background: fill }}
              />
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-white/55">{stats.gradeLast12.caption}</p>
      </Card>
    )
  }

  if (stats.bestMock) {
    cards.push(
      <button key="bestMock" type="button" onClick={() => onAnalyze(stats.bestMock.id)} className="block text-left">
        <Card label="Best mock">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[32px] font-bold text-teal-300">{stats.bestMock.grade}</span>
            <span className="text-xs text-white/60">
              {stats.bestMock.rank ? `${stats.bestMock.rank} of ${stats.bestMock.teams}` : `of ${stats.bestMock.teams}`}
            </span>
          </div>
          <p className="mt-1 text-xs text-white/50">
            {stats.bestMock.leagueType} · {stats.bestMock.dateCompleted}
          </p>
        </Card>
      </button>
    )
  }

  if (stats.weakestSpot) {
    cards.push(
      <Card key="weakestSpot" label="Weakest spot">
        <p className="font-display text-[23px] font-bold text-white">
          {{ QB: 'Quarterback', RB: 'Running back', WR: 'Wide receiver', TE: 'Tight end' }[stats.weakestSpot.pos]
            || stats.weakestSpot.pos}
        </p>
        <p className="mt-1 text-xs text-white/50">
          Below replacement in {stats.weakestSpot.pct}% of your rosters
        </p>
      </Card>
    )
  }

  if (stats.avgRosterVorp) {
    cards.push(
      <Card key="avgRosterVorp" label="Avg roster VORP">
        <p className="font-display text-[32px] font-bold tabular-nums text-white">
          {stats.avgRosterVorp.mine >= 0 ? '+' : ''}
          {stats.avgRosterVorp.mine.toFixed(1)}
        </p>
        {stats.avgRosterVorp.room !== null && (
          <p className="mt-1 text-xs text-white/50">
            Room average {stats.avgRosterVorp.room >= 0 ? '+' : ''}
            {stats.avgRosterVorp.room.toFixed(1)}
          </p>
        )}
      </Card>
    )
  }

  // Per the handoff: a stat that can't be computed cleanly doesn't render a
  // placeholder — the whole strip is simply shorter. An empty result (every
  // entry pre-dates every new field) means no strip at all.
  if (cards.length === 0) return null

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[23px] font-bold text-white">Your tendencies</h2>
        <span className="text-xs text-white/50">Across all {stats.total} mocks</span>
      </div>
      <div className="grid grid-cols-3 gap-[10px]">{cards}</div>
    </div>
  )
}
