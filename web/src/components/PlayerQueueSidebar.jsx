import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, ChevronDown, ChevronUp, Search, Star } from 'lucide-react'
import { POS_BADGE, POS_LIST } from './draftRoomPositions.js'
import JukeValueAssistant from './JukeValueAssistant.jsx'
import { MOBILE_SORTS, STAT_COLUMNS, STAT_GROUPS, statValue } from './playerColumns.js'

// Keyed lookup so the group header can total its own columns' widths
// rather than carrying a second copy of them.
const COL_BY_KEY = Object.fromEntries(STAT_COLUMNS.map((c) => [c.key, c]))

/* The identity column's width, and the shape every cell in it shares.
   168px holds a star, a 28px headshot and two lines of name/team at the
   sizes below — measured against the longest real name on the board
   ("Bone-Thugs-N-Montgomery" is a team, but "Jaxon Smith-Njigba" is a
   player) — and leaves a 375px phone about 200px of scrollable stats,
   which is four columns before a swipe. */
/* Two widths, not one. A bigger headshot on desktop has to come out of
   somewhere, and taking it out of the player's name would trade one
   legibility problem for another - so the whole identity column grows with
   it at lg+. It reaches CSS as a custom property because a `style` prop
   cannot hold a media query, and every consumer (the header spacer, the
   column header, the row) reads the same property, which is what keeps the
   sticky column aligned against the cells scrolling underneath it. */
const NAME_W_VAR = 'var(--name-w)'
const ACTION_W = 68
const STICKY_CELL = 'sticky left-0 z-20 flex shrink-0 items-center px-2'

// FLEX sits after the four skill positions and before K/DST, matching
// SLOT_ORDER in app.js — the same ordering a roster fills them in.
const FILTERS = ['ALL', ...POS_LIST, 'FLEX', 'K', 'DST']

/* What the count means, said in words for a pointer. "All" counts roster
   spots rather than starting slots, so it needs its own wording — the shared
   sentence read "13 more ALL to fill your starting lineup", which is wrong
   about the number and about the noun. */
function countTitle(pos, c) {
  const left = c.need - c.have
  if (pos === 'ALL') {
    return c.short ? `${left} roster ${left === 1 ? 'spot' : 'spots'} still to fill` : 'Your roster is full'
  }
  if (c.short) return `${left} more ${pos} to fill your starting lineup`
  if (c.full) return `You are holding as many ${pos} as this draft will suggest`
  return undefined
}

/* The sort keys, the column widths and the cell readers all live in
   playerColumns.js now — one definition serving the table header, the
   mobile chips and DraftRoom's sort. The old GRID_COLS template is gone
   with the two-layout split it described (a desktop grid over a mobile
   card); one scrollable table serves both breakpoints. SORT_DEFAULT_DIR
   is re-exported rather than redefined so DraftRoom's existing import
   keeps working against that same single source. */
export { SORT_DEFAULT_DIR } from './playerColumns.js'

// Real, undrafted board players only — this is `board()` filtered/sorted at
// the UI layer, not a second suggestions engine. Ranking (ADP, need, risk,
// the model's opinion) stays exactly where CLAUDE.md says it has to live:
// suggestions() in app.js. The list here is ordered by the board's own
// `overall` (ADP rank), same as the legacy Players tab.
export default function PlayerQueueSidebar({
  players,
  search,
  onSearch,
  posFilter,
  counts,
  onPosFilter,
  expBand,
  onExpBand,
  watchlistOnly,
  onWatchlistOnly,
  showDrafted,
  onShowDrafted,
  pointsFor,
  valueFor,
  photoFor,
  initialsFor,
  onDraft,
  myTurn,
  draftOver,
  queuedNames,
  onToggleQueue,
  draftedByFor,
  onSelectPlayer,
  sortBy,
  sortDir,
  onSort,
  recommended,
  recommendedVorp,
  recommendedTierLeft,
  projOf,
}) {
  /* What statValue() reads a cell from: the two derived columns keep the
     readers this list already had, so the table can never disagree with
     the recommendation card or the sort about a player's points or VORP,
     and the raw counting stats come off the projection block. */
  const statCtx = { pointsFor, valueFor, projOf }

  // A single position filter narrows the stat groups to the ones that
  // position actually has — "ALL" keeps every group, the union-across-
  // positions shape playerColumns.js's own header comment documents.
  // Filtering here, not there: STAT_GROUPS/STAT_COLUMNS stay the one list
  // every consumer of this file shares.
  const visibleGroups = STAT_GROUPS.filter((g) => !g.positions || posFilter === 'ALL' || g.positions.includes(posFilter))
  const visibleKeys = new Set(visibleGroups.flatMap((g) => g.keys))
  const visibleColumns = STAT_COLUMNS.filter((c) => visibleKeys.has(c.key))

  return (
    // Sizing against the board+queue row (flex-1, lg:flex-[3], lg:min-w) now
    // lives on the relative wrapper DraftRoom.jsx puts around this and
    // PlayerProfileDrawer — this fills that wrapper rather than sizing
    // itself against the row a second time.
    // No h-full. The wrapper above is a flex row, so align-items:stretch
    // already sizes this to it — and height:100% actively defeats that:
    // the parent's height comes from flex layout rather than from an
    // explicit value, so the percentage resolved against an indefinite
    // height and fell back to auto. Measured on a phone, that made this box
    // 6867px tall inside a 518px parent, which handed flex-1 below an
    // unbounded height to divide and left the list unable to scroll at all.
    <div className="flex w-full flex-col overflow-hidden bg-slate-900/40">
      {/* Tighter chrome at lg+ (p-2.5, space-y-2 rather than p-4/space-y-3):
          on the desktop panel row this header competes with the list for
          about 470px, and every pixel it gives back is another player
          visible. Below lg the sheet is 75vh and can afford the room. */}
      <div className="shrink-0 space-y-3 border-b border-slate-800 p-4 lg:space-y-2 lg:p-2.5">
        {/* Replaces the old plain "Juke AI Draft Assistant" label — this
            is that framing with an actual real recommendation behind it
            now, not just a caption over the search box. Two renders, one
            per breakpoint, because the compact variant is a different
            shape rather than the same card scaled — see its own comment. */}
        {/* Compact at every width now, where this used to render the tall
            card below lg and the compact one above it. The tall variant is
            225px of a header that only has 518px to share with the list, and
            measured on a phone that left the list 47 visible pixels — one
            row and part of a second, out of 210 players. Compact takes the
            header from 471 to 309 and the list from 47 to 209, which is four
            rows and a scroll rather than a dead end.

            Nothing is lost by dropping the tall one here specifically: the
            Decide tab is three full recommendation cards of exactly this
            content, so on a phone the tall card was the same advice twice,
            charging the Players list most of its height for the repeat. */}
        <div>
          <JukeValueAssistant
            compact
            player={recommended}
            vorp={recommendedVorp}
            tierLeft={recommendedTierLeft}
            onDraft={onDraft}
            myTurn={myTurn}
            photoFor={photoFor}
            initialsFor={initialsFor}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-teal-400/60 focus:outline-none"
          />
        </div>

        {/* A design review read this row as ambiguous — is "RB 4" a filter
            you can click, or a report of what you've drafted? It's both by
            design (see countTitle()'s own tooltip and the fraction-vs-count
            comment below), which is exactly what a bare row of chips can't
            say on its own. One label, not a rebuild: moving the counts out
            to the roster pane would drop the "which position still needs
            help" read this row exists to give at a glance while filtering. */}
        <p className="text-[9px] font-semibold uppercase tracking-wide text-white/25">Filter by position · your roster need alongside</p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => onPosFilter(pos)}
              className={
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ' +
                (posFilter === pos
                  ? 'bg-teal-500 text-obsidian'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white')
              }
            >
              {pos === 'ALL' ? 'All' : pos}
              {/* The roster-need count, from engine.filterCounts(). The whole
                  decision — fraction while a slot is owed, bare count once it
                  is met, fraction always for All where the denominator is a
                  real ceiling — is made engine-side, because a fraction is a
                  promise about its denominator and this one has been got
                  wrong before: have/starters in every state painted a green
                  "TE 1/1" that read as a cap, and was reported as the app
                  refusing a second tight end. It had refused nothing. */}
              {counts && counts[pos] && (
                <span
                  title={countTitle(pos, counts[pos])}
                  className={
                    'ml-1.5 tabular-nums ' +
                    (posFilter === pos
                      ? 'text-obsidian/60'
                      : counts[pos].short ? 'text-amber-300/80'
                        : counts[pos].full ? 'text-white/30' : 'text-white/40')
                  }
                >
                  {counts[pos].text}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* A second, independent dimension from position — "RB rookies I'm
            watching" is a real combination, which a single-select list
            can't hold. Rookies/Veterans stays exclusive with itself (a
            player can't be both); Watchlist and Drafted are plain toggles
            that combine freely with everything else here. */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'rookie', label: 'Rookies' },
            { key: 'veteran', label: 'Veterans' },
          ].map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => onExpBand(expBand === b.key ? 'all' : b.key)}
              className={
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ' +
                (expBand === b.key
                  ? 'bg-teal-500 text-obsidian'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white')
              }
            >
              {b.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onWatchlistOnly(!watchlistOnly)}
            aria-pressed={watchlistOnly}
            className={
              'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ' +
              (watchlistOnly
                ? 'bg-amber-400/90 text-obsidian'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white')
            }
          >
            <Bookmark className={'h-3 w-3 ' + (watchlistOnly ? 'fill-obsidian' : '')} />
            Watchlist
          </button>
          <button
            type="button"
            onClick={() => onShowDrafted(!showDrafted)}
            aria-pressed={showDrafted}
            className={
              'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ' +
              (showDrafted
                ? 'bg-teal-500 text-obsidian'
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white')
            }
          >
            Drafted
          </button>
        </div>

        {/* Sorting, below lg only — a shortcut, not the only way. Every
            column in the table is sortable from its own header on either
            breakpoint now; these are the few a thumb should not have to
            scroll sideways to reach. Same tap-to-sort, tap-again-to-flip
            as the headers. */}
        <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/30">Sort</span>
          {MOBILE_SORTS.map((col) => {
            const active = sortBy === col.key
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => onSort(col.key)}
                aria-pressed={active}
                className={
                  'flex items-center gap-0.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ' +
                  (active ? 'bg-teal-500 text-obsidian' : 'bg-white/5 text-white/50')
                }
              >
                {col.label}
                {active && col.key !== 'board' ? (
                  sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                ) : null}
              </button>
            )
          })}
        </div>

        {/* "Not your turn" and "the draft is over" are different facts —
            !myTurn is true for both, and a design review caught this
            exact line still reading "disabled until it's your turn" on a
            finished draft, where there is no turn left to wait for. */}
        {!myTurn && (
          <p className="text-[10px] leading-relaxed text-white/30">
            {draftOver ? 'Draft complete.' : "Draft is disabled until it's your turn."}
          </p>
        )}
      </div>


      {/* One horizontally scrollable table, both breakpoints. The stats a
          drafter wants — projection, passing, rushing, receiving — used to
          live on a separate Players tab, which meant leaving the board to
          look anything up. They scroll sideways here instead, the way
          Sleeper's own board does it, so nothing about a player is more
          than a swipe away.

          The scroll lives on this one container rather than per row: rows
          that each scrolled independently would never line up under a
          shared header, and the header is what makes a wall of numbers
          readable. overflow-auto (not overflow-y-auto) is what gives the
          list both axes.

          pb-28 below lg keeps the last row clear of the sheet's own bottom
          edge on a phone; lg:pb-6 is a plain breathing gap in the desktop
          panel, which has nothing floating over it.

          min-h-0 is what makes overflow-auto above actually engage. A flex
          child defaults to min-height:auto, which refuses to shrink below
          its own content — so this box sized itself to all 210 rows (7527px
          measured on a phone), the scroller never had anything to scroll,
          and the list simply ran off the bottom of the sheet with no way to
          reach it. Same class as the entry screen's stacking bug, mirrored:
          there min-h-0 was present where it had to be absent, here it was
          absent where it has to be present. */}
      <div className="min-h-0 flex-1 overflow-auto pb-28 lg:pb-6 [--name-w:168px] lg:[--name-w:208px]">
        <div className="min-w-max">
          {/* Group header — the spanning row saying which family of stats
              the columns beneath belong to, so "YDS" three times over is
              never ambiguous. */}
          <div className="sticky top-0 z-30 flex border-b border-slate-800 bg-slate-900">
            <div className={STICKY_CELL + ' bg-slate-900'} style={{ width: NAME_W_VAR }} />
            {visibleGroups.map((g) => {
              const w = g.keys.reduce((sum, k) => sum + COL_BY_KEY[k].width, 0)
              return (
                <div
                  key={g.label || 'core'}
                  style={{ width: w }}
                  className="shrink-0 border-l border-slate-800/60 px-1 pt-1 text-center text-[9px] font-semibold uppercase tracking-wide text-white/25"
                >
                  {g.label}
                </div>
              )
            })}
            <div style={{ width: ACTION_W }} className="shrink-0" />
          </div>

          {/* Column header — sortable where the sort reader can order by
              it. Sticky under the group row, hence the offset top. */}
          <div className="sticky top-[18px] z-30 flex border-b border-slate-800 bg-slate-900">
            <div
              className={STICKY_CELL + ' bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-white/30'}
              style={{ width: NAME_W_VAR }}
            >
              Player
            </div>
            {visibleColumns.map((col) => {
              const active = sortBy === col.key
              const content = (
                <>
                  {col.label}
                  {active ? (
                    sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  ) : null}
                </>
              )
              return col.sortable ? (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => onSort(col.key)}
                  style={{ width: col.width }}
                  className={
                    'flex shrink-0 items-center justify-end gap-0.5 border-l border-slate-800/60 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150 ' +
                    (active ? 'text-teal-300' : 'text-white/30 hover:text-white/60')
                  }
                >
                  {content}
                </button>
              ) : (
                <div
                  key={col.key}
                  style={{ width: col.width }}
                  className="flex shrink-0 items-center justify-end border-l border-slate-800/60 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/30"
                >
                  {content}
                </div>
              )
            })}
            <div style={{ width: ACTION_W }} className="shrink-0 border-l border-slate-800/60" />
          </div>

          <AnimatePresence initial={false}>
            {players.map((player) => {
              const photo = photoFor(player)
              const queued = queuedNames.has(player.name)
              const draftedBy = player.drafted ? draftedByFor(player) : null
              return (
                <motion.div
                  key={player.id || player.name}
                  layoutId={'player-' + (player.id || player.name)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  /* No exit animation, deliberately. This row shares its
                     layoutId with the board cell the player lands in, and
                     a row cannot both fly away on its own and morph into
                     that cell — contradictory instructions about one
                     element. Framer resolved the conflict by handing the
                     layoutId to the board cell and never unmounting the
                     row, so a drafted player stayed in the available list
                     for the rest of the draft. Without an exit there is
                     nothing for AnimatePresence to wait on, and the shared
                     layoutId still flies the card into its cell. */
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  onClick={() => onSelectPlayer(player)}
                  className="flex cursor-pointer border-b border-slate-800/50 transition-colors duration-150 hover:bg-white/[0.03]"
                >
                  {/* Sticky identity cell — who the row is about stays put
                      while the numbers scroll. Opaque on purpose: a
                      transparent sticky cell lets the scrolling cells
                      slide visibly beneath it. */}
                  <div className={STICKY_CELL + ' gap-2 bg-slate-950'} style={{ width: NAME_W_VAR }}>
                    {player.drafted ? (
                      <Star className="h-4 w-4 shrink-0 text-white/10" />
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggleQueue(player.name) }}
                        title={queued ? 'Remove from your queue' : 'Add to your queue'}
                        className="shrink-0 text-white/25 transition-colors duration-150 hover:text-amber-300"
                      >
                        <Star className={'h-4 w-4 ' + (queued ? 'fill-amber-300 text-amber-300' : '')} />
                      </button>
                    )}

                    <div className="relative shrink-0">
                      {/* 28px on a phone, 40px at lg+. Measured before it was
                          changed: the source is 250 to 350px wide and sharp,
                          so nothing here was ever upscaled - at 28px the face
                          is simply too small to identify, which reads as
                          "grainy" without being a resolution problem at all.
                          40px at dpr 2 asks for 80 device pixels, still a
                          third of the smallest source. */}
                      <div className="relative flex h-7 w-7 lg:h-10 lg:w-10 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-[8px] lg:text-[10px] font-bold text-white/40">
                        {initialsFor(player)}
                        {photo && (
                          <img
                            src={photo}
                            alt=""
                            loading="lazy"
                            onError={(e) => e.currentTarget.remove()}
                            className={'absolute inset-0 h-full w-full ' + (player.pos === 'DST' ? 'object-contain p-1' : 'object-cover')}
                          />
                        )}
                      </div>
                      <span
                        className={
                          'absolute -bottom-1 -right-1 rounded px-1 py-px text-[7px] font-bold leading-tight ring-2 ring-slate-950 ' +
                          (POS_BADGE[player.pos] || 'bg-white/10 text-white/50')
                        }
                      >
                        {player.pos}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white/90">{player.name}</p>
                      <p className="truncate text-[10px] text-white/40">{player.team}</p>
                    </div>
                  </div>

                  {visibleColumns.map((col) => {
                    const v = statValue(col, player, statCtx)
                    return (
                      <div
                        key={col.key}
                        style={{ width: col.width }}
                        className={
                          'flex shrink-0 items-center justify-end border-l border-slate-800/40 px-1.5 py-2 text-xs tabular-nums ' +
                          (v == null
                            ? 'text-white/15'
                            : col.tone === 'teal'
                              ? 'font-semibold text-teal-400/90'
                              : col.tone === 'strong'
                                ? 'font-medium text-white/80'
                                : 'text-white/55')
                        }
                      >
                        {v == null ? '—' : v}
                      </div>
                    )
                  })}

                  {/* The action sits at the row's end rather than in the
                      sticky cell: sticking it would cost the identity
                      block another 70px, which on a phone is most of what
                      is left for the stats this change exists to show. */}
                  <div
                    style={{ width: ACTION_W }}
                    className="flex shrink-0 items-center justify-center border-l border-slate-800/40 px-1.5"
                  >
                    {draftedBy ? (
                      <span className="truncate text-[9px] font-semibold uppercase tracking-wide text-white/30">
                        {draftedBy}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDraft(player) }}
                        disabled={!myTurn}
                        title={myTurn ? undefined : 'Not your turn'}
                        className={
                          'w-full rounded-full px-2 py-1.5 text-[11px] font-bold transition-all duration-200 ' +
                          (myTurn
                            ? 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white active:scale-95'
                            : 'cursor-not-allowed bg-white/5 text-white/25')
                        }
                      >
                        Draft
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {players.length === 0 && (
            <p className="mt-8 text-center text-sm text-white/30">No players match this search.</p>
          )}
        </div>
      </div>
    </div>
  )
}
