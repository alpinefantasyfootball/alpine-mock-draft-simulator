import { useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, MoreHorizontal } from 'lucide-react'

const FORMAT_FILTERS = [
  { key: 'all', label: 'All formats' },
  { key: 'ppr', label: 'Full PPR' },
  { key: 'half', label: 'Half PPR' },
  { key: 'standard', label: 'Standard' },
]

const SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'grade', label: 'Best grade' },
  { key: 'finish', label: 'Best finish' },
]

const PAGE_SIZE = 20

// Below this many rows, every one of them is already on screen at once —
// the default visibleCount below is this same number — so a search box,
// four format-filter pills and a sort dropdown have nothing to do yet.
// Six columns of headers plus that whole control row was a lot of chrome
// standing over one or two entries. Chosen to match visibleCount rather
// than some other number: the exact point this component already treats
// as "everything fits without scrolling or paging."
const NEEDS_CONTROLS_ABOVE = 8

// Shared by the format rule and the finish bar, per the handoff — two
// different formulas on the same two numbers, not two names for one.
function finishColor(rank, teams) {
  if (!rank || !teams) return 'rgba(255,255,255,0.3)'
  const frac = rank / teams
  return frac <= 0.25 ? '#00E5FF' : frac <= 0.5 ? 'rgba(255,255,255,0.5)' : '#FB7185'
}

function gradeColor(grade) {
  if (!grade) return 'rgba(255,255,255,0.5)'
  if (grade.startsWith('A')) return '#66F0FF'
  if (grade.startsWith('B')) return 'rgba(255,255,255,0.92)'
  return '#FB7185'
}

function Row({ entry, onAnalyze, onDeleteRequest, menuOpen, onToggleMenu }) {
  const teams = entry.teams
  const fillPct = entry.rank && teams ? Math.max(0, Math.min(100, (1 - (entry.rank - 1) / teams) * 100)) : 0
  const accent = finishColor(entry.rank, teams)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAnalyze(entry.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAnalyze(entry.id) } }}
      className="grid cursor-pointer grid-cols-[minmax(0,2.1fr)_64px_62px_104px_minmax(0,1.5fr)_92px_96px_40px] items-center gap-[14px] border-b border-white/[0.04] px-5 py-[13px] transition-colors duration-150 hover:bg-teal-400/[0.045]"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="h-[26px] w-[3px] shrink-0 rounded-full" style={{ background: accent }} />
        <span className="truncate text-sm font-semibold text-white">{entry.leagueType}</span>
      </div>

      <span className="text-sm tabular-nums text-white/60">{entry.seat}</span>

      <span className="font-display text-[19px] font-bold" style={{ color: gradeColor(entry.grade) }}>
        {entry.grade || '—'}
      </span>

      <div className="flex items-center gap-2">
        <span className="w-[30px] shrink-0 text-sm font-semibold tabular-nums text-white/90">
          {entry.projectedRank}
        </span>
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: accent }} />
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {entry.round1Pick ? (
          <>
            {entry.round1PickPos && (
              <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-white/50">
                {entry.round1PickPos}
              </span>
            )}
            <span className="truncate text-sm text-white/75">{entry.round1Pick}</span>
          </>
        ) : (
          <span className="text-sm text-white/30">—</span>
        )}
      </div>

      <span className="text-right text-sm font-medium tabular-nums text-white/70">
        {typeof entry.rosterVorp === 'number'
          ? `${entry.rosterVorp >= 0 ? '+' : ''}${entry.rosterVorp.toFixed(1)}`
          : '—'}
      </span>

      <span className="text-right text-xs tabular-nums text-white/50">{entry.dateCompleted}</span>

      <div className="relative justify-self-end">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleMenu(entry.id) }}
          className="flex h-6 w-6 items-center justify-center rounded text-white/50 transition-colors hover:text-white"
          aria-label="More actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-7 z-10 w-40 overflow-hidden rounded-lg border border-white/10 bg-charcoal shadow-lg"
          >
            <button
              type="button"
              onClick={() => { onAnalyze(entry.id); onToggleMenu(null) }}
              className="block w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
            >
              Analyze draft
            </button>
            <div className="border-t border-white/10" />
            <button
              type="button"
              onClick={() => { onDeleteRequest(entry.id); onToggleMenu(null) }}
              className="block w-full px-3 py-2 text-left text-sm text-rose-300 hover:bg-white/5"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Delete is a toast-with-undo, not an immediate removal — it's one level
// down in a menu now (per the handoff, precisely so it's no longer sitting
// beside the row's primary action), and a menu click is more likely to be
// mis-hit than a dedicated button was, so an undo window matters more here
// than it would have on the old card layout.
const UNDO_MS = 5000

export default function LockerTable({ entries, onAnalyze, onDeleteConfirmed }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [visibleCount, setVisibleCount] = useState(8)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [pending, setPending] = useState(null) // { id, entry }
  const pendingTimer = useRef(null)

  // Takes the id directly rather than reading `pending` from closure — a
  // setTimeout callback scheduled inside requestDelete() closes over
  // whatever `pending` was AT SCHEDULE TIME, which is still null (the
  // setPending() call below hasn't flushed to a re-render yet when the
  // timer is created). Reading `pending` here instead of taking `id` as a
  // parameter always sees that stale null and silently no-ops five seconds
  // later — a real bug caught by actually waiting out the undo window
  // rather than assuming the timer works. The `cur.id === id` check guards
  // the rare case where undo() or a second delete already cleared/replaced
  // pending before this fires.
  const finalizeById = (id) => {
    onDeleteConfirmed(id)
    setPending((cur) => (cur && cur.id === id ? null : cur))
  }

  const requestDelete = (id) => {
    // Only one pending deletion at a time — a second delete while the first
    // is still undoable finalizes the first immediately rather than
    // stacking toasts for a genuinely rare double-delete.
    if (pending) finalizeById(pending.id)
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    const entry = entries.find((e) => e.id === id)
    setPending({ id, entry })
    pendingTimer.current = setTimeout(() => finalizeById(id), UNDO_MS)
  }

  const undo = () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    setPending(null)
  }

  const filtered = useMemo(() => {
    let list = entries.filter((e) => !pending || e.id !== pending.id)
    if (filter !== 'all') list = list.filter((e) => e.leagueType.toLowerCase().includes(
      filter === 'ppr' ? 'full ppr' : filter === 'half' ? 'half ppr' : 'standard'
    ))
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((e) =>
        e.leagueType.toLowerCase().includes(q) || (e.round1Pick || '').toLowerCase().includes(q)
      )
    }
    const sorted = list.slice()
    if (sort === 'oldest') sorted.reverse()
    else if (sort === 'grade') sorted.sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade))
    else if (sort === 'finish') sorted.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity))
    // 'newest' is entries' own order — historyList() already returns
    // newest-first, matching recordHistory()'s unshift().
    return sorted
  }, [entries, filter, query, sort, pending])

  const visible = filtered.slice(0, visibleCount)

  // Below NEEDS_CONTROLS_ABOVE, search/filter/sort would only ever act on
  // rows already fully visible below — real controls with nothing to
  // control. The state and the filtering logic above still run either way,
  // so a search typed before this threshold (there's no way to, with the
  // box hidden, but a stale query lingering under it) never leaves the list
  // showing something the header doesn't explain.
  const showControls = entries.length > NEEDS_CONTROLS_ABOVE

  return (
    // h-full + flex-col so this card can be handed a real height by
    // DraftLocker's own flex-1 wrapper and stretch to fill it — see the
    // comment there. The rows block below is the flex-1 child that absorbs
    // the extra space; the summary/"Load more" footer stays a normal
    // sibling after it, so it settles at the bottom of a tall card instead
    // of hugging the last row with a gap of bare background beneath it.
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.08]" style={{ background: 'rgba(21,25,35,0.5)' }}>
      <div className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] px-5 py-4">
        <h2 className="font-display text-[23px] font-bold text-white">The Locker</h2>

        {showControls && (
          <>
            <div className="flex w-[226px] items-center gap-2 rounded-lg border border-white/[0.08] bg-obsidian/60 px-3 py-[7px]">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/50" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setVisibleCount(8) }}
                placeholder="Search by player or format"
                className="w-full bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
              />
            </div>

            <div className="flex gap-[3px] rounded-full bg-white/5 p-[3px]">
              {FORMAT_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => { setFilter(f.key); setVisibleCount(8) }}
                  className={
                    'rounded-full px-[13px] py-1.5 text-xs font-semibold transition-colors ' +
                    (filter === f.key ? 'bg-teal-400/[0.16] text-teal-300' : 'text-white/55 hover:text-white')
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-white/50">Sort</span>
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="appearance-none rounded-lg border border-white/[0.08] bg-obsidian/60 py-[7px] pl-3 pr-8 text-sm font-medium text-white/80 focus:outline-none"
                >
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
              </div>
            </div>
          </>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-[46px] text-center">
          <p className="font-display text-[19px] font-bold text-white/80">No mocks yet</p>
          <p className="mt-1.5 text-sm text-white/50">
            Finish one and it lands here with its grade, your seat and every pick.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <div className="grid grid-cols-[minmax(0,2.1fr)_64px_62px_104px_minmax(0,1.5fr)_92px_96px_40px] gap-[14px] border-b border-white/[0.06] bg-obsidian/40 px-5 py-[9px]">
              {['Format', 'Seat', 'Grade', 'Proj. finish', 'First pick'].map((h) => (
                <span key={h} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">{h}</span>
              ))}
              <span className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Roster VORP</span>
              <span className="text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">Completed</span>
              <span />
            </div>

            {visible.map((entry) => (
              <Row
                key={entry.id}
                entry={entry}
                onAnalyze={onAnalyze}
                onDeleteRequest={requestDelete}
                menuOpen={menuOpenId === entry.id}
                onToggleMenu={(id) => setMenuOpenId((cur) => (cur === id ? null : id))}
              />
            ))}
          </div>

          <div className="flex items-center justify-between px-5 py-[14px]">
            <span className="text-xs tabular-nums text-white/50">
              Showing {visible.length} of {filtered.length}
            </span>
            {visibleCount < filtered.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:border-teal-400/45 hover:text-teal-300"
              >
                Load 20 more
              </button>
            )}
          </div>
        </>
      )}

      {pending && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-charcoal px-5 py-3 shadow-lg">
          <span className="text-sm text-white/80">Draft removed</span>
          <button type="button" onClick={undo} className="text-sm font-semibold text-teal-300 hover:text-teal-200">
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

const GRADE_ORDER = ['A+', 'A', 'A−', 'B+', 'B', 'B−', 'C+', 'C', 'C−', 'D+', 'D', 'D−', 'F+', 'F']
function gradeRank(grade) {
  const i = GRADE_ORDER.indexOf(grade)
  return i === -1 ? GRADE_ORDER.length : i
}
