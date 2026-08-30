import { useMemo, useState } from 'react'
import { Check, FilePlus2, Search, X } from 'lucide-react'
import { POS_BADGE } from '../draftRoomPositions.js'
import { PHONE_POSITION_COLUMNS, phoneColumnValue, phoneColumnRaw } from './playerColumnsPhone.js'

// README section 4, matched to the spec as written rather than the earlier
// "keep it pinned" simplification this file used to carry: the name and
// position/team/bye sit on their own line above each row, never part of any
// horizontal scroll, and the Draft button, rank, queue toggle and every stat
// pair scroll together as one strip beneath it — so the Draft button *is*
// reachable at any scroll position other than 0, exactly like the reference
// app this was matched against. Getting back to it means scrolling that
// row's strip back to its start; that trade was made deliberately, in
// exchange for matching the reference layout exactly, and is not an
// oversight to "fix" by pinning the button again.
//
// Each row's strip scrolls independently — there is no shared column grid
// to keep aligned across rows any more, since every stat now carries its
// own label repeated inline rather than reading one off a header row far
// above it. That is also why sorting moved: tapping a stat's own label/value
// pair sets the sort key, in whichever row you happen to tap it in, rather
// than tapping a column header that no longer exists.
// ALL/QB/RB/.../ROOKIES/VETERANS are alternate *views* of the pool — exactly
// one of each group is the "current" one, and the solid-fill active style
// says so. WATCHLIST/DRAFTED/'25 STATS are add-on toggles instead: each one
// can be true or false independent of every other chip on the row,
// including each other, the same way desktop's own "Show drafted" checkbox
// sits beside the position tabs rather than replacing one of them (see
// DraftRoom.jsx). Rendering all fourteen chips with one shared "active"
// look was the bug — not that a toggle can be on at the same time as a
// view is selected (that combination is real and desktop already has it),
// but that nothing on screen said these three were a different kind of
// control. They get the pill's other existing "on, but not a view" look
// instead — the same teal outline the SORT BY chip above already uses for
// its own supplementary, non-exclusive state — plus a checkmark, so a
// glance reads "toggled on" rather than "the selected tab."
const TOGGLE_KEYS = new Set(['watchlist', 'drafted', 'stats25']);

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
  engine, tick, league, board, mySlot, myTurn,
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

  // `tick` is in the dependency list below and `board` is not what actually
  // changes on a pick: draft-engine.js flags a player drafted in place
  // (`player.drafted = true`) rather than replacing the board array, so
  // `board` is the exact same reference before and after every pick and a
  // plain useMemo keyed on it never recomputes — a drafted player stayed in
  // the pool on screen until something else happened to remount this tab.
  // DraftRoom.jsx's own `availablePlayersMemo` solves the identical problem
  // the identical way, for the identical reason: `tick` increments on the
  // "juke:header" event every pick already fires, so it is what actually
  // invalidates this, not `board`'s content.
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
  }, [tick, board, showDrafted, showWatchlist, posFilter, expBand, search, sortKey, sortDir, season, flexPositions])

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

          const isToggle = TOGGLE_KEYS.has(chip.key)

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
              aria-pressed={isToggle ? active : undefined}
              className={
                'flex h-[38px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-3.5 leading-tight transition-colors duration-150 ' +
                (isToggle
                  ? (active ? 'border border-teal-400 bg-teal-500/[0.12] text-teal-300' : 'bg-slate-panel text-ink border border-slate-rule')
                  : (active ? 'bg-ink text-[#0D0F15]' : 'bg-slate-panel text-ink border border-slate-rule'))
              }
            >
              {isToggle && active && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}
              <span className="flex flex-col items-center">
                <span className="text-xs font-bold">{chip.label}</span>
                {text != null && (
                  <span className={
                    'font-plex text-[9px] ' +
                    (isToggle ? (active ? 'text-teal-300/70' : 'text-teal-300')
                      : (active ? 'text-[#4C5763]' : filled ? 'text-ink-muted' : 'text-teal-300'))
                  }>
                    {text}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="sticky top-0 z-20 border-b border-white/[0.08] bg-slate-sunk px-3 py-1.5 font-plex text-[9px] font-normal uppercase tracking-[0.1em] text-ink-muted">
          {posFilter === 'ALL' ? 'All' : posFilter} &middot; {rows.length} available
        </div>
        {rows.map((p, i) => {
          const queued = queuedNames.has(p.name)
          const draftedBy = p.drafted ? draftedByFor(p) : null
          return (
            <div key={p.name} className="border-b border-white/[0.05]">
              <button type="button" onClick={() => onSelectPlayer(p)} className="block w-full px-3 pt-[7px] text-left">
                <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
                <p className={'truncate font-plex text-[10px] ' + (POS_BADGE[p.pos] ? POS_BADGE[p.pos].split(' ')[1] : 'text-ink-muted')}>
                  {p.pos} - {p.team} ({p.bye ?? '—'})
                </p>
              </button>
              {/* This row's own scroller — every row scrolls independently,
                  since there is no shared column grid any more for a
                  synchronized scroll to keep aligned. */}
              <div className="overflow-x-auto overscroll-contain [scrollbar-width:none]">
                <div className="flex w-max items-center gap-[18px] px-3 py-[7px]">
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
                  <span className="shrink-0 font-plex text-[11px] text-ink-muted">{i + 1}</span>
                  {!p.drafted && (
                    <button
                      type="button"
                      onClick={() => onToggleQueue(p.name)}
                      title={queued ? 'Remove from your queue' : 'Add to your queue'}
                      className={'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ' + (queued ? 'bg-slate-rule text-ink-muted' : 'bg-[#0FBFA0] text-[#06251F]')}
                    >
                      {queued ? <X className="h-3.5 w-3.5" /> : <FilePlus2 className="h-4 w-4" strokeWidth={2.25} />}
                    </button>
                  )}
                  {columns.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSort(key)}
                      className="flex w-[58px] shrink-0 flex-col items-start"
                    >
                      <span className={'whitespace-nowrap font-plex text-[9px] font-normal uppercase ' + (sortKey === key ? 'text-teal-300' : 'text-ink-muted')}>
                        {label}{sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                      </span>
                      <span className={'font-plex text-xs tabular-nums ' + (key === 'pts' ? 'text-ink' : 'text-ink-soft')}>
                        {phoneColumnValue(key, p, ctx)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
