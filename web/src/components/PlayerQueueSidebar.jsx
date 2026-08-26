import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark, ChevronDown, ChevronUp, Search, Star } from 'lucide-react'
import { POS_BADGE, POS_LIST, INJURY_META } from './draftRoomPositions.js'
import JukeValueAssistant from './JukeValueAssistant.jsx'
import { MOBILE_COL_WIDTH, MOBILE_GROUPS, MOBILE_SORTS, STAT_COLUMNS, STAT_GROUPS, statValue, lastsTone } from './playerColumns.js'

// Keyed lookup so the group header can total its own columns' widths
// rather than carrying a second copy of them.
const COL_BY_KEY = Object.fromEntries(STAT_COLUMNS.map((c) => [c.key, c]))

/* The identity block's width on desktop, and the shape every cell in it
   shares there. 296px holds the queue star, a 58px Draft pill, a 32px
   headshot/initials circle and about 146px of name — measured against
   "Jaxon Smith-Njigba", the Players tab's own longest real name.

   `mobile` (below) is the phone/app variant: 208px, no Draft pill (there is
   nowhere on a 402px row for a 44px pill, a 44px star and a headshot to
   leave the name more than 82px — three of the first six real names
   clipped, measured), the POS badge moves back onto the avatar instead of
   its own scrolling column, and the row's own tap opens the player sheet
   (PlayerProfileModal) rather than drafting inline — see that component's
   own comment for the Draft/Queue actions living there instead. */
const NAME_W = 296
const MOBILE_NAME_W = 208
const POS_W = 44
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
    return c.short ? `${left} more roster ${left === 1 ? 'spot' : 'spots'} still to fill` : 'Your roster is full'
  }
  if (c.short) return `${left} more ${pos} to fill your starting lineup`
  if (c.full) return `You are holding as many ${pos} as this draft will suggest`
  return undefined
}

/* The sort keys, the column widths and the cell readers all live in
   playerColumns.js now — one definition serving the table header, the
   mobile chips and DraftRoom's sort. SORT_DEFAULT_DIR is re-exported rather
   than redefined so DraftRoom's existing import keeps working against that
   same single source. */
export { SORT_DEFAULT_DIR } from './playerColumns.js'

/* rose/amber/soft -> real classes, kept out of playerColumns.js: that file
   computes the *value* a cell should show (lastsTone()'s three-way split),
   never a class name — the same separation every other column already
   keeps between statValue() and the tone the table paints it in. */
const LASTS_CLASS = {
  rose: 'text-rose-300',
  amber: 'text-amber-300',
  soft: 'text-ink-soft',
}

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
  vorpFor,
  valueFor,
  survivalFor,
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
  tierAvgByPos,
  // The Players tab mounts just this table — its own filter bar and
  // Autopick ribbon replace the recommendation card, search box, position
  // chips and toggles below, so none of that header renders here. The
  // mobile sheet (PlayerHub.jsx) and the Board tab's dock both leave this
  // false and get the header exactly as before.
  bareTable,
  // "Projected" everywhere except the Players tab's "2025 Season" mode,
  // where it's the actual year ("2025 Actual") — a caller-supplied label
  // rather than a second copy of the season names playerColumns.js has no
  // reason to know about.
  projectedGroupLabel,
  // The phone/app pool (PlayersTab.jsx's mobile Pool pane): a narrower
  // identity block, MOBILE_GROUPS' own order (the decision numbers first),
  // a flat per-column width instead of each column's own desktop width,
  // no separate POS column, and no Draft pill in the row.
  mobile,
}) {
  /* What statValue() reads a cell from: the derived columns keep the
     readers this list already had, so the table can never disagree with
     the recommendation card or the sort about a player's points, VORP or
     Juke score, and the raw counting stats come off the projection block. */
  const statCtx = { pointsFor, vorpFor, valueFor, survivalFor, projOf }

  const nameW = mobile ? MOBILE_NAME_W : NAME_W
  const colWidth = (col) => (mobile ? MOBILE_COL_WIDTH : col.width)

  // A single position filter narrows the stat groups to the ones that
  // position actually has — "ALL" keeps every group, the union-across-
  // positions shape playerColumns.js's own header comment documents.
  // Filtering here, not there: STAT_GROUPS/STAT_COLUMNS stay the one list
  // every consumer of this file shares. The Juke group is never filtered
  // out — an unranked K/DST prints an em dash in it rather than losing the
  // group, same as overallScore()/survivalProbability() withhold a number
  // rather than a column. MOBILE_GROUPS reorders the same six groups
  // (decision numbers first); it is never a different set of columns.
  const groupSource = mobile ? MOBILE_GROUPS : STAT_GROUPS
  const visibleGroups = groupSource.filter((g) => !g.positions || posFilter === 'ALL' || g.positions.includes(posFilter))
  // Columns in whichever order visibleGroups is already in — desktop's own
  // STAT_GROUPS order or MOBILE_GROUPS' reordered one — rather than a
  // separate filter-then-sort pass that could disagree with it.
  const visibleColumns = visibleGroups.flatMap((g) => g.keys.map((k) => COL_BY_KEY[k]))

  /* Tier-cliff dividers, interleaved into the row list rather than drawn
     per-row — a divider belongs *between* two players, so it has to be
     built as its own pass over the list rather than something a single
     row can decide to render above itself.

     Only when the list is in board order. buildTiers() in app.js assigns
     tiers by walking each position's board-sorted (ADP) sublist and only
     ever incrementing — "already ADP sorted" is that function's own
     comment — so tier climbs monotonically per position along board order
     and nowhere else. Sorted by VORP or any raw stat, a lower tier can
     follow a higher one for reasons that have nothing to do with a real
     cliff; showing a divider there would label a coincidence as a cliff,
     so it simply doesn't fire outside 'board'.

     tierCounts is a first pass — how many undrafted players this position
     has left at each tier in the list currently on screen — computed
     before the second pass needs it, since "how many left before the
     drop" has to count every remaining player in the ending tier, not
     just the ones already walked past. */
  const rows = []
  if (sortBy === 'board' && tierAvgByPos) {
    const tierCounts = {}
    players.forEach((p) => {
      if (p.drafted || !POS_LIST.includes(p.pos) || p.tier == null) return
      tierCounts[p.pos] = tierCounts[p.pos] || {}
      tierCounts[p.pos][p.tier] = (tierCounts[p.pos][p.tier] || 0) + 1
    })
    const lastTier = {}
    players.forEach((player) => {
      if (!player.drafted && POS_LIST.includes(player.pos) && player.tier != null) {
        const last = lastTier[player.pos]
        if (last != null && player.tier > last) {
          const posAvgs = tierAvgByPos[player.pos] || {}
          const endingAvg = posAvgs[last]
          const nextAvg = posAvgs[last + 1]
          const drop = endingAvg != null && nextAvg != null ? Math.round(endingAvg - nextAvg) : null
          rows.push({
            type: 'divider',
            key: 'tier-' + player.pos + '-' + last,
            pos: player.pos,
            tierEnding: last,
            remaining: tierCounts[player.pos]?.[last] || 0,
            drop,
          })
        }
        lastTier[player.pos] = player.tier
      }
      rows.push({ type: 'player', key: player.id || player.name, player })
    })
  } else {
    players.forEach((player) => rows.push({ type: 'player', key: player.id || player.name, player }))
  }

  return (
    // Sizing against the board+queue row (flex-1, lg:flex-[3], lg:min-w)
    // lives on DraftRoom.jsx's own wrapper around PlayerHub — this fills
    // that wrapper rather than sizing itself against the row a second
    // time. The profile that used to share a relative ancestor with this
    // list (PlayerProfileDrawer) is a top-level modal now and has no
    // positioning relationship with this component at all.
    // No h-full. The wrapper above is a flex row, so align-items:stretch
    // already sizes this to it — and height:100% actively defeats that:
    // the parent's height comes from flex layout rather than from an
    // explicit value, so the percentage resolved against an indefinite
    // height and fell back to auto. Measured on a phone, that made this box
    // 6867px tall inside a 518px parent, which handed flex-1 below an
    // unbounded height to divide and left the list unable to scroll at all.
    <div className="flex w-full flex-col overflow-hidden bg-slate-bar/40">
      {!bareTable && (
      <div className="shrink-0 space-y-3 border-b border-slate-rule p-4 lg:space-y-2 lg:p-2.5">
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
            onOpenProfile={onSelectPlayer}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full rounded-lg border border-slate-rule bg-slate-sunk/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-teal-400/60 focus:outline-none"
          />
        </div>

        {/* A design review read this row as ambiguous — is "RB 4" a filter
            you can click, or a report of what you've drafted? It's both by
            design (see countTitle()'s own tooltip and the fraction-vs-count
            comment below), which is exactly what a bare row of chips can't
            say on its own. One label, not a rebuild: moving the counts out
            to the roster pane would drop the "which position still needs
            help" read this row exists to give at a glance while filtering. */}
        <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-muted">Filter by position · your roster need alongside</p>
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
                        : counts[pos].full ? 'text-ink-muted' : 'text-ink-muted')
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
            can't hold. Watchlist and Drafted are plain toggles that combine
            freely with everything else here.

            Veterans dropped — the two bands were never symmetric: the
            question a manager actually asks mid-draft is "show me only the
            rookies," never "hide the rookies," and a Veterans chip that
            just meant "everyone else" duplicated what leaving the filter on
            Rookies-off already showed. `expBand` still supports 'veteran'
            underneath (app.js's exp filter is unchanged); only the button
            that could ever set it is gone. */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'rookie', label: 'Rookies' },
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
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Sort</span>
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
          <p className="text-[10px] leading-relaxed text-ink-muted">
            {draftOver ? 'Draft complete.' : "Draft is disabled until it's your turn."}
          </p>
        )}
      </div>
      )}


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
      {/* pb-28 clears PlayerHub's own floating sheet (Board/Analysis's
          mobile fallback) — the one context this padding was written for.
          The new mobile Pool pane sits in normal flow above the bottom bar
          instead of floating over anything, so it only needs a small
          breathing gap, not 112px of it. */}
      <div className={'min-h-0 flex-1 overflow-auto ' + (mobile ? 'no-scrollbar pb-4' : 'pb-28 lg:pb-6')}>
        <div className="min-w-max">
          {/* Group header — the spanning row saying which family of stats
              the columns beneath belong to, so "YDS" three times over is
              never ambiguous.

              flex: n 0 (sum of its columns' widths)px, n being the column
              count — this has to be the *grow factor* the columns beneath
              it collectively add up to (each grows by 1), not just a
              starting width, or the group's own edge stops lining up with
              its last column's edge the moment there's leftover width to
              share out (see the numeric columns' own comment below). */}
          <div className="sticky top-0 z-30 flex border-b border-slate-rule bg-slate-panel">
            <div className={STICKY_CELL + ' bg-slate-panel'} style={{ flex: `0 0 ${nameW}px` }} />
            {visibleGroups.map((g, gi) => {
              // POS has no entry in STAT_GROUPS (it isn't a statValue()
              // column, it's the hand-coded badge column below) but the
              // handoff's own desktop group row still spans it under the
              // same blank label as BYE/ADP — one group cell over the
              // three, not POS getting a second, redundant "POS" header of
              // its own next to the column row's real "Pos" label. Mobile
              // has no separate POS column at all (the badge sits on the
              // avatar instead), so this merge is desktop-only.
              const cols = g.keys.map((k) => COL_BY_KEY[k])
              const posSpan = !mobile && gi === 0 ? 1 : 0
              const w = cols.reduce((sum, c) => sum + colWidth(c), 0) + posSpan * POS_W
              return (
                <div
                  key={g.label || 'core'}
                  style={{ flex: `${cols.length + posSpan} 0 ${w}px` }}
                  className={
                    'shrink-0 border-l border-slate-rule/60 pt-1 text-center text-[9px] font-semibold uppercase tracking-wide ' +
                    (g.teal ? 'text-teal-300' : 'text-ink-muted')
                  }
                >
                  {g.label === 'Projected' && projectedGroupLabel ? projectedGroupLabel : g.label}
                </div>
              )
            })}
          </div>

          {/* Column header — sortable where the sort reader can order by
              it. Sticky under the group row, hence the offset top.

              Every numeric column is flex 1 0 {width}px — grow:1, shrink:0,
              its own width as the starting basis — so the columns share out
              any leftover width evenly instead of leaving a gutter between
              the identity block and PTS. A fixed, non-growing width (what
              this table used before) is what left that gutter: the columns
              summed to less than the container's real width the moment the
              container was wider than ~900px, and nothing claimed the rest. */}
          <div className="sticky top-[18px] z-30 flex border-b border-slate-rule bg-slate-panel">
            <div
              className={STICKY_CELL + ' bg-slate-panel text-[10px] font-semibold uppercase tracking-wide text-ink-muted'}
              style={{ flex: `0 0 ${nameW}px` }}
            >
              Player
            </div>
            {!mobile && (
              <div style={{ flex: `1 0 ${POS_W}px` }} className="flex shrink-0 items-center justify-center border-l border-slate-rule/60 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Pos
              </div>
            )}
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
                  style={{ flex: `1 0 ${colWidth(col)}px` }}
                  className={
                    'flex shrink-0 items-center justify-end gap-0.5 border-l border-slate-rule/60 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150 ' +
                    (active ? 'text-teal-300' : 'text-ink-muted hover:text-white/60')
                  }
                >
                  {content}
                </button>
              ) : (
                <div
                  key={col.key}
                  style={{ flex: `1 0 ${colWidth(col)}px` }}
                  className="flex shrink-0 items-center justify-end border-l border-slate-rule/60 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
                >
                  {content}
                </div>
              )
            })}
          </div>

          <AnimatePresence initial={false}>
            {rows.map((row) => {
              if (row.type === 'divider') {
                return (
                  // Amber, not gold — #FFD166/--mine is reserved for
                  // "whose seat/turn this is" everywhere else in the app
                  // (CLAUDE.md: "Gold is identity... a colour doing five
                  // jobs is not a signal"). Amber is a different, already-
                  // established colour for this exact meaning: it's what
                  // JukeValueAssistant's own "Tier scarcity" warning uses a
                  // few rows above this list, for the identical idea of a
                  // tier running out.
                  <div
                    key={row.key}
                    className="flex min-w-max items-center gap-3 border-y border-amber-400/25 bg-amber-400/[0.05] px-3 py-2"
                  >
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                      {row.pos} tier {row.tierEnding} ends here
                    </span>
                    <span className="text-[11px] text-white/60">
                      {row.remaining} {row.pos}{row.remaining === 1 ? '' : 's'} left before the drop
                      {row.drop == null
                        ? ' — no more after this tier'
                        : row.drop > 0
                          ? ` — the next tier projects ${row.drop} fewer points`
                          : ' — the next tier projects about the same'}
                    </span>
                  </div>
                )
              }
              const player = row.player
              const photo = photoFor(player)
              const queued = queuedNames.has(player.name)
              const draftedBy = player.drafted ? draftedByFor(player) : null
              return (
                <motion.div
                  key={row.key}
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
                  // Shown-but-drafted rows used to sit at the exact same
                  // brightness as available ones, distinguished only by the
                  // action column swapping a Draft button for a team name —
                  // easy to miss at a glance, which is what "greyed out" was
                  // actually asking for.
                  className={
                    'flex cursor-pointer border-b border-slate-rule/50 transition-colors duration-150 hover:bg-white/[0.03] ' +
                    (player.drafted ? 'opacity-50' : '')
                  }
                >
                  {/* Sticky identity cell — who the row is about stays put
                      while the numbers scroll. Opaque on purpose: a
                      transparent sticky cell lets the scrolling cells
                      slide visibly beneath it.

                      Order: queue star, Draft pill, headshot, name over
                      team — the Draft button lives here now rather than at
                      the row's far end, so a thumb (or, here, a mouse
                      that's already reading the name) never has to cross
                      the entire scrollable width to reach it. */}
                  <div className={STICKY_CELL + ' gap-2 bg-slate-sunk'} style={{ flex: `0 0 ${nameW}px` }}>
                    {player.drafted ? (
                      <Star className={'shrink-0 text-white/10 ' + (mobile ? 'h-[15px] w-[15px]' : 'h-4 w-4')} />
                    ) : (
                      // 26px wide, 44px tall tap area on mobile — the
                      // handoff's own floor for anything tappable, on a
                      // control that's visually much smaller than that.
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggleQueue(player.name) }}
                        title={queued ? 'Remove from your queue' : 'Add to your queue'}
                        className={
                          'flex shrink-0 items-center justify-center text-ink-muted transition-colors duration-150 hover:text-amber-300 ' +
                          (mobile ? 'h-11 w-[26px]' : '')
                        }
                      >
                        <Star className={'h-4 w-4 ' + (queued ? 'fill-amber-300 text-amber-300' : '')} />
                      </button>
                    )}

                    {/* No Draft pill on mobile at all — a 44px pill plus a
                        44px star plus the avatar left the name 82px on a
                        402px screen, clipping three of the first six real
                        names, and `title` is not an affordance a phone has.
                        The row's own tap (below) opens the sheet instead,
                        where Draft is a real 48px action — see
                        PlayerProfileModal.jsx. */}
                    {!mobile && (draftedBy ? (
                      <span className="w-[58px] shrink-0 truncate text-center text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
                        {draftedBy}
                      </span>
                    ) : (
                      // Ghost, not the gradient — a gradient is an emphasis
                      // device, and every one of ~200 rows getting the full
                      // teal-to-purple treatment the instant it's your turn
                      // is noise, not emphasis (nothing on the list stands
                      // out if everything does). The one gradient "Draft"
                      // button on this screen lives on the recommended-pick
                      // card above the list (JukeValueAssistant's compact
                      // variant) — that's the single primary action; every
                      // row here stays a quiet, equally-weighted option.
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDraft(player) }}
                        disabled={!myTurn}
                        title={myTurn ? undefined : 'Not your turn'}
                        className={
                          'w-[58px] shrink-0 rounded-full border py-1.5 text-[11px] font-bold transition-colors duration-150 ' +
                          (myTurn
                            ? 'border-white/15 text-white/70 hover:border-teal-400/50 hover:bg-teal-400/[0.06] hover:text-teal-300 active:scale-95'
                            : 'cursor-not-allowed border-white/5 text-white/20')
                        }
                      >
                        Draft
                      </button>
                    ))}

                    {/* 32px flat, not the old 28/40px mobile/desktop split
                        that came with the identity block's own two widths —
                        see NAME_W's comment. Desktop pins no badge here: POS
                        is its own scrolling column instead (right after this
                        block). Mobile has no such column, so the badge sits
                        back on the avatar, the same overlay treatment the
                        board's own board-card face and the Picks rail
                        already use for a face with no room beside it. */}
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-sunk text-[9px] font-bold text-ink-soft">
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
                      {mobile && (
                        <span
                          className={
                            'absolute -bottom-1 -right-1 rounded px-1 py-px text-[7px] font-bold leading-tight ring-2 ring-slate-sunk ' +
                            (POS_BADGE[player.pos] || 'bg-white/10 text-white/50')
                          }
                        >
                          {player.pos}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white/90">{player.name}</p>
                      <p className="flex items-center gap-1 truncate text-[10px] text-ink-muted">
                        {player.team}
                        {INJURY_META[player.inj] && (
                          <span className={'rounded px-1 py-px text-[8px] font-bold uppercase leading-tight ' + INJURY_META[player.inj].cls}>
                            {player.inj}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {!mobile && (
                    <div style={{ flex: `1 0 ${POS_W}px` }} className="flex shrink-0 items-center justify-center border-l border-slate-rule/40">
                      <span className={'rounded px-1.5 py-0.5 text-[9px] font-bold ' + (POS_BADGE[player.pos] || 'bg-white/10 text-white/60')}>
                        {player.pos}
                      </span>
                    </div>
                  )}

                  {visibleColumns.map((col) => {
                    const v = statValue(col, player, statCtx)
                    const tone = col.key === 'lasts' ? lastsTone(v) : null
                    return (
                      <div
                        key={col.key}
                        style={{ flex: `1 0 ${colWidth(col)}px` }}
                        className={
                          'flex shrink-0 items-center justify-end border-l border-slate-rule/40 px-1.5 py-2 text-xs tabular-nums ' +
                          (v == null
                            ? 'text-white/15'
                            : tone
                              ? LASTS_CLASS[tone] + ' font-medium'
                              : col.tone === 'teal'
                                ? 'font-semibold text-teal-400/90'
                                : col.tone === 'strong'
                                  ? 'font-medium text-white/80'
                                  : 'text-white/55')
                        }
                      >
                        {v == null ? '—' : col.key === 'lasts' ? v + '%' : v}
                      </div>
                    )
                  })}
                </motion.div>
              )
            })}
          </AnimatePresence>

          {players.length === 0 && (
            <p className="mt-8 text-center text-sm text-ink-muted">No players match this search.</p>
          )}
        </div>
      </div>
    </div>
  )
}
