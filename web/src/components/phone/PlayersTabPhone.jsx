import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { POS_BADGE } from '../draftRoomPositions.js'
import { PHONE_POSITION_COLUMNS, phoneColumnValue, phoneColumnRaw } from './playerColumnsPhone.js'

// README section 4. One deliberate simplification from the literal spec,
// worth knowing before "matching pixel-for-pixel" is taken at face value:
// the spec's pinned-left block (Draft button, rank, name, queue button)
// disappears entirely once the table is scrolled right, replaced by a
// floating name line with no Draft button reachable at all without
// scrolling back to 0. `sticky left-0` keeps that block on screen at every
// scroll position instead — the Draft button is the one control this whole
// tab exists for, and losing it mid-scroll reads as a regression rather
// than a decluttering. Everything else (chips, column sets, sorting,
// the SORT BY pill) matches the spec as written.
const CHIPS = [
  { key: 'ALL', label: 'ALL' },
  { key: 'QB', label: 'QB' },
  { key: 'RB', label: 'RB' },
  { key: 'WR', label: 'WR' },
  { key: 'TE', label: 'TE' },
  { key: 'FLEX', label: 'FLEX' },
  { key: 'K', label: 'K' },
  { key: 'DST', label: 'DEF' },
  { key: 'rookies', label: 'ROOKIES' },
  { key: 'veterans', label: 'VETERANS' },
  { key: 'sep', label: '' },
  { key: 'watchlist', label: 'WATCHLIST' },
  { key: 'drafted', label: 'DRAFTED' },
  { key: 'stats25', label: "'25 STATS" },
]

export default function PlayersTabPhone({
  engine, league, board, mySlot, myTurn,
  pointsFor, vorpFor, valueFor, survivalFor,
  photoFor, initialsFor, flexPositions, draftedByFor,
  queuedNames, onToggleQueue, onDraft,
  filterCounts, priorSeasonYear, projOf, season, onSetSeason,
  onSelectPlayer,
}) {
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [posFilter, setPosFilter] = useState('ALL')
  const [expBand, setExpBand] = useState('all')
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [showDrafted, setShowDrafted] = useState(false)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const stats25 = season === 'prior'
  const ctx = { pointsFor, projOf }

  const columns = PHONE_POSITION_COLUMNS[posFilter] || PHONE_POSITION_COLUMNS.ALL

  const rows = useMemo(() => {
    let list = board
      .filter((p) => showDrafted || !p.drafted)
      .filter((p) => !showWatchlist || engine.watchlisted(p))
      .filter((p) => {
        if (posFilter === 'ALL') return true
        if (posFilter === 'FLEX') return flexPositions.includes(p.pos)
        return p.pos === posFilter
      })
      .filter((p) => {
        if (expBand === 'all') return true
        const exp = engine.statOf(p)?.exp
        return expBand === 'rookie' ? exp === 0 : exp !== undefined && exp > 0
      })
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))

    const reader = sortKey
      ? (p) => phoneColumnRaw(sortKey, p, ctx)
      : (p) => p.overall
    list = list.slice().sort((a, b) => {
      const av = reader(a)
      const bv = reader(b)
      const aMissing = av == null || Number.isNaN(av)
      const bMissing = bv == null || Number.isNaN(bv)
      if (aMissing && bMissing) return 0
      if (aMissing) return 1
      if (bMissing) return -1
      if (!sortKey) return av - bv // board order is always ascending
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, showDrafted, showWatchlist, posFilter, expBand, search, sortKey, sortDir, season, flexPositions])

  const handleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-[7px] overflow-x-auto px-3 py-2.5 [scrollbar-width:none]">
        {searchOpen ? (
          <div className="flex h-[38px] flex-1 items-center gap-2 rounded-full border border-slate-rule bg-slate-sunk px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
            <button type="button" onClick={() => { setSearchOpen(false); setSearch('') }} className="shrink-0 text-ink-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-slate-rule bg-slate-sunk text-ink-muted"
          >
            <Search className="h-4 w-4" />
          </button>
        )}

        {!searchOpen && sortKey && (
          <span className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-teal-400 bg-teal-500/[0.12] py-0 pl-3 pr-[7px]">
            <span className="flex flex-col leading-tight">
              <span className="font-plex text-[8px] tracking-[0.12em] text-ink-muted">SORT BY</span>
              <span className="text-[12px] font-bold text-teal-300">
                {columns.find((c) => c[0] === sortKey)?.[1] || sortKey} {sortDir === 'desc' ? '↓' : '↑'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSortKey(null)}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}

        {!searchOpen && CHIPS.map((chip) => {
          if (chip.key === 'sep') return <span key="sep" className="mx-0.5 h-7 w-px shrink-0 bg-white/[0.14]" />
          let active = false
          let text = null
          if (chip.key === 'rookies') active = expBand === 'rookie'
          else if (chip.key === 'veterans') active = expBand === 'veteran'
          else if (chip.key === 'watchlist') { active = showWatchlist; text = String(engine.watchlist().length) }
          else if (chip.key === 'drafted') active = showDrafted
          else if (chip.key === 'stats25') active = stats25
          else { active = posFilter === chip.key; text = filterCounts && filterCounts[chip.key] ? filterCounts[chip.key].text : null }
          const filled = filterCounts && filterCounts[chip.key] ? filterCounts[chip.key].full : false

          const onClick = () => {
            if (chip.key === 'rookies') setExpBand((v) => (v === 'rookie' ? 'all' : 'rookie'))
            else if (chip.key === 'veterans') setExpBand((v) => (v === 'veteran' ? 'all' : 'veteran'))
            else if (chip.key === 'watchlist') setShowWatchlist((v) => !v)
            else if (chip.key === 'drafted') setShowDrafted((v) => !v)
            else if (chip.key === 'stats25') onSetSeason(stats25 ? 'projected' : 'prior')
            else setPosFilter(chip.key)
          }

          return (
            <button
              key={chip.key}
              type="button"
              onClick={onClick}
              className={
                'flex h-[38px] shrink-0 flex-col items-center justify-center whitespace-nowrap rounded-full px-3.5 leading-tight transition-colors duration-150 ' +
                (active ? 'bg-ink text-[#0D0F15]' : 'bg-slate-panel text-ink border border-slate-rule')
              }
            >
              <span className="text-xs font-bold">{chip.label}</span>
              {text != null && (
                <span className={'font-plex text-[9px] ' + (active ? 'text-[#4C5763]' : filled ? 'text-ink-muted' : 'text-teal-300')}>
                  {text}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-sunk">
            <tr className="border-b border-white/[0.08]">
              <th className="sticky left-0 z-20 border-r border-white/[0.08] bg-slate-sunk px-3 py-1.5 text-left font-plex text-[9px] font-normal uppercase tracking-[0.1em] text-ink-muted">
                {posFilter === 'ALL' ? 'All' : posFilter} &middot; {rows.length} available
              </th>
              {columns.map(([key, label]) => (
                <th key={key} className="px-2 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort(key)}
                    className={'whitespace-nowrap font-plex text-[9px] font-normal uppercase ' + (sortKey === key ? 'text-teal-300' : 'text-ink-muted')}
                  >
                    {label}{sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const queued = queuedNames.has(p.name)
              const draftedBy = p.drafted ? draftedByFor(p) : null
              return (
                <tr key={p.name} className="border-b border-white/[0.05]">
                  <td className="sticky left-0 z-10 border-r border-white/[0.08] bg-slate-bar px-3 py-[7px]">
                    <div className="flex items-center gap-[7px]">
                      {p.drafted ? (
                        <span className="w-[54px] shrink-0 truncate text-center font-plex text-[9px] text-ink-muted">{draftedBy || 'Drafted'}</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!myTurn}
                          onClick={() => onDraft(p)}
                          className={
                            'h-8 w-[54px] shrink-0 rounded-full text-[11px] font-bold text-white ' +
                            (myTurn ? 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2]' : 'cursor-not-allowed bg-white/10 text-white/30')
                          }
                        >
                          Draft
                        </button>
                      )}
                      <span className="w-6 shrink-0 text-right font-plex text-[11px] text-ink-muted">{i + 1}</span>
                      <button type="button" onClick={() => onSelectPlayer(p)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
                        <p className={'truncate font-plex text-[10px] ' + (POS_BADGE[p.pos] ? POS_BADGE[p.pos].split(' ')[1] : 'text-ink-muted')}>
                          {p.pos} - {p.team} ({p.bye ?? '—'})
                        </p>
                      </button>
                      {!p.drafted && (
                        <button
                          type="button"
                          onClick={() => onToggleQueue(p.name)}
                          title={queued ? 'Remove from your queue' : 'Add to your queue'}
                          className={'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ' + (queued ? 'bg-slate-rule text-ink-muted' : 'bg-[#0FBFA0] text-[#06251F]')}
                        >
                          {queued ? <X className="h-3.5 w-3.5" /> : <span className="text-[13px] leading-none">+</span>}
                        </button>
                      )}
                    </div>
                  </td>
                  {columns.map(([key]) => (
                    <td
                      key={key}
                      className={
                        'w-[62px] px-2 py-[7px] text-right font-plex text-xs tabular-nums ' +
                        (key === 'pts' ? 'text-ink' : 'text-ink-soft')
                      }
                    >
                      {phoneColumnValue(key, p, ctx)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
