import { useState } from 'react'

// engine.gameLogFor() already resolves a missing/stale year to this
// player's own most recent one, so passing last year's pick straight
// through after switching to a rookie just falls back correctly — no
// reset-on-player-change effect needed here.
export default function GameLogsTab({ engine, player }) {
  const [pickedYear, setPickedYear] = useState(null)
  const log = engine.gameLogFor(player, pickedYear)

  if (!log.year) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-muted">
        No week-by-week logs stored for this player.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {log.years.length > 1 && (
        <div className="flex flex-wrap gap-1.5 lg:gap-2">
          {log.years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setPickedYear(y)}
              className={
                'rounded-full px-2.5 py-1 text-xs lg:px-3.5 lg:py-1.5 lg:text-sm font-semibold transition-colors duration-150 ' +
                (y === log.year ? 'bg-teal-500 text-obsidian' : 'bg-slate-sunk/60 text-white/50 hover:text-white/80')
              }
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs lg:text-sm text-ink-muted">
        {log.year} week by week &middot; {log.perGameAvg} per game played
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-rule">
        <table className="w-full min-w-max bg-slate-panel text-xs lg:text-sm">
          <thead>
            <tr className="border-b border-slate-rule bg-slate-sunk/60">
              {log.head.map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-1.5 lg:px-3 lg:py-2.5 text-left font-semibold text-ink-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {log.rows.map((row, i) => (
              <tr key={i} className={'border-b border-slate-rule/60 last:border-0 ' + (row.blank ? 'opacity-40' : '')}>
                {row.cells.map((v, j) => (
                  <td
                    key={j}
                    className={
                      'whitespace-nowrap px-2 py-1.5 lg:px-3 lg:py-2.5 ' +
                      (j === 1 && row.tone === 'hi' ? 'font-semibold text-teal-300'
                        : j === 1 && row.tone === 'lo' ? 'text-rose-300'
                          : 'text-white/70')
                    }
                  >
                    {v === null ? '—' : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
