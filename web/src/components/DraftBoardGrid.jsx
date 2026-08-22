import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { POS_BADGE, POS_SOLID } from './draftRoomPositions.js'

// A team has no photo, so its header avatar is initials in a solid
// circle — the same idea chat's seatInitials()/avatar circle already
// uses for a manager with no photo, applied to a team name instead of a
// person's. Two words give two letters, one gives one — "Bijan Mustard"
// reads "BM", a bare "CPU 4" reads "C".
function initialsOf(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).slice(0, 2)
  return parts.map((w) => w[0].toUpperCase()).join('')
}

// Real data only: `picks` is window.JukeEngine.picks() (state.picks itself,
// {overall, round, slot, player}), the same array the legacy board reads
// via `state.picks.find(p => p.round === r && p.slot === s)` — this just
// indexes it once into a map instead of re-scanning it per cell.
//
// Not memoized on `picks` itself: state.picks is mutated in place
// (Array.push in makePick()), so the array reference never changes and a
// useMemo keyed on it would freeze this map at whatever it was on first
// mount — every filled cell after that would silently render as empty.
// Rebuilding on every render is the same "render() redraws everything, no
// partial updates" trade this codebase already makes deliberately (see
// CLAUDE.md's Conventions section), and it costs nothing at ~280 entries.
// Positive = fell past ADP = a bargain (green); negative = taken early =
// a reach (red). Same "pick number minus rank" convention the real grade
// calculation uses for its own draft-value component (see CLAUDE.md's
// "The draft value gap is pick number minus board rank, in that order" —
// getting this backwards was a real, shipped bug there), just measured
// against the player's raw adp instead of the board's integer rank, which
// is what gives this its one decimal place rather than a whole number.
function adpGap(pick) {
  const adp = pick.player.adp
  if (typeof adp !== 'number' || !Number.isFinite(adp)) return null
  return pick.overall - adp
}

// The cell's own reading of the same gap adpGap() already returned — one
// call per pick, reused for the background wash *and* the delta text
// beside it, never recomputed. Beat-or-tied (gap >= 0, a bargain) reads
// brand teal; reached (gap < 0) reads the app's one red. No-data (gap ==
// null — this player carries no adp at all) stays the plain neutral
// card: a continuous number essentially never lands on precisely zero,
// so the mobile handoff's "no tint at ADP" is this null case, not a
// third colour to compute.
//
// The text pair replaces the emerald/rose this line used to read.
// Emerald doubles as the RB rail colour a few lines below — one hue
// carrying two unrelated meanings on the same card — where teal is
// never a position colour anywhere in this file (draftRoomPositions.js's
// own header comment says why: it's reserved). Matching the wash to the
// text turns "beat ADP" into one signal instead of two slightly
// different ones sharing a cell.
function adpTint(gap) {
  if (gap == null) return { bg: 'bg-charcoal', text: '' }
  if (gap >= 0) return { bg: 'bg-[rgba(0,229,255,0.05)]', text: 'text-teal-500' }
  return { bg: 'bg-[rgba(248,113,113,0.06)]', text: 'text-red-400' }
}

// The legend's position row and the cell's own rail read the same six
// hues off the same map — Object.keys() rather than a second, hand-typed
// QB/RB/WR/TE/K/DST list that could drift from this one.
const LEGEND_POSITIONS = Object.keys(POS_SOLID)

// Snake direction, per cell — every cell carries it, not just drafted
// ones (CLAUDE.md: "it was on drafted ones only" was itself a shipped
// bug — the turn matters most *before* a pick lands). Built only from
// DraftEngine.pickInRound(), the one place the snake mirror is allowed
// to live, never re-derived here.
function boardArrow(DE, round, slot, teams) {
  if (!DE) return null
  return DE.pickInRound(round, slot, teams) === teams ? 'down' : (round % 2 === 0 ? 'left' : 'right')
}

/* One glyph, rotated - never three different characters. The down arrow is a
   vertical stem and the right arrow is a thin cross-stroke, so a face draws
   the first far heavier than the second: measured in the board's own font
   (Inter 600), down carries 2.5x the ink of right - 305 pixels against 122.
   Nothing in CSS repairs that, because it is the glyph and not the styling.
   A rotated right arrow is the same glyph at the same weight by construction,
   so all three directions match whatever face the board ends up in.

   aria-hidden because the direction is decoration here: the pick code and the
   overall number in the same cell already say where the pick sits. */
const ARROW_SPIN = { right: 'rotate(0deg)', down: 'rotate(90deg)', left: 'rotate(180deg)' }

/* The box has to be square, and that is the whole trick. A span wrapping the
   glyph is glyph-advance wide (7.8px) but line-height tall (13.5px), so
   rotating it 90 degrees about its centre produces a visual box of 13.5 x 7.8
   that spills outside the layout box the `right-1 top-0.5` anchor is
   positioning. Measured: the down arrow drew 2.9px further right and 2.9px
   lower than its neighbours - which reads as a wonky arrow long before
   anybody works out it is an alignment problem rather than a weight one.

   A square box with leading-none and the glyph centred inside it rotates
   symmetrically, so all three directions occupy the identical rectangle. */
function Arrow({ dir, className }) {
  if (!dir) return null
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1em',
        height: '1em',
        lineHeight: 1,
        transform: ARROW_SPIN[dir],
      }}
    >
      →
    </span>
  )
}

// Gold is identity — CLAUDE.md's "Whose it is, and where the draft is": it
// marks the *whole* column, filled and empty alike, because "when do I pick
// again" is the question an empty cell has to answer too.
//
// A per-cell ring was tried first and a design review caught exactly the
// failure CLAUDE.md's own board-card section predicts for a ring built the
// wrong way: fourteen cells each drawing their own complete rectangle reads
// as a dashed stack of separate boxes, not one column, and the header above
// it was cyan for the same idea gold owns everywhere else on the board. The
// fix isn't a bigger ring, it's fewer edges: every cell in the column gets
// the same wash and the same gold left/right border — which is invisible as
// a *seam* between adjacent cells that already touch with no gap between
// them, and reads as one continuous outline — and only the very first and
// very last cell in the column close it off with a top or bottom edge.
// mineEdge() below returns exactly those four pieces per cell rather than a
// single ring class, and the header's own "YOU" label matches in gold too.

// Four complete literal strings, not one built from concatenated
// fragments — draftRoomPositions.js's own comment already names this
// exact trap ("Tailwind's JIT scanner finds classes by grepping source
// files for the literal string... it would compile to nothing, silently")
// and this function fell into it anyway on its first pass: the shadow
// value was assembled from `'shadow-[...' + (cond ? ',...' : '') + '...]'`
// pieces, so the complete bracket content this class needs never once
// appeared as a whole token anywhere in the source Tailwind scans. Every
// cell still rendered the class name — React doesn't care that it means
// nothing — so nothing looked wrong until a test actually read
// getComputedStyle(cell).boxShadow and got back "none".
const MINE_WASH = 'bg-[rgba(255,209,102,0.07)]'
const MINE_EDGE = {
  mid: MINE_WASH + ' shadow-[inset_2px_0_0_rgba(255,209,102,0.45),inset_-2px_0_0_rgba(255,209,102,0.45)]',
  first: MINE_WASH + ' shadow-[inset_2px_0_0_rgba(255,209,102,0.45),inset_-2px_0_0_rgba(255,209,102,0.45),inset_0_2px_0_rgba(255,209,102,0.45)]',
  last: MINE_WASH + ' shadow-[inset_2px_0_0_rgba(255,209,102,0.45),inset_-2px_0_0_rgba(255,209,102,0.45),inset_0_-2px_0_rgba(255,209,102,0.45)]',
  // Both edges at once only happens in a one-round league — an edge case,
  // but a real one (this app supports 1-round drafts), so it gets its own
  // real literal rather than falling through to "mid" and drawing a
  // column with no top or bottom.
  both: MINE_WASH + ' shadow-[inset_2px_0_0_rgba(255,209,102,0.45),inset_-2px_0_0_rgba(255,209,102,0.45),inset_0_2px_0_rgba(255,209,102,0.45),inset_0_-2px_0_rgba(255,209,102,0.45)]',
}

function mineEdge(isMine, isFirstRound, isLastRound) {
  if (!isMine) return ''
  if (isFirstRound && isLastRound) return MINE_EDGE.both
  if (isFirstRound) return MINE_EDGE.first
  if (isLastRound) return MINE_EDGE.last
  return MINE_EDGE.mid
}

// The current pick keeps its own distinct box (the teal pulsing one below,
// with its own inline glow) rather than composing into mineEdge() above —
// "your column" and "the live pick" stay two readable facts instead of one
// cell trying to carry both.

export default function DraftBoardGrid({ league, picks, mySlot, onClock, teamLabelOf, onTeamClick, shortNameOf, onClaimSeat, seats, onOpenLog }) {
  const byCell = new Map()
  picks.forEach((p) => byCell.set(p.round + '-' + p.slot, p))

  const DE = typeof window !== 'undefined' ? window.DraftEngine : null
  const teams = league.teams
  const rounds = league.rounds
  /* Two column rules, but both now carry a real floor — the difference
     between them is only the floor's size and the header rail's width.
     colsWide used to be minmax(0, 1fr): no floor at all, specifically so
     ten teams could share the window with no horizontal scroll. Measured
     at a real 1103px desktop width, that traded away the thing it was
     supposed to protect — a player name needs roughly 110-170px to read,
     and 0-floor columns render every card as a position badge and a
     clipped initial. An unreadable board is worse than a scrollable one,
     and Sleeper's own board — the thing this split layout was already
     benchmarked against — scrolls rather than compresses. 120px is under
     what a long name wants at the widest league sizes, which is exactly
     why the horizontal scroll stays: this is a floor, not a fit. */
  const cols = `64px repeat(${teams}, minmax(112px, 1fr))`
  const colsWide = `56px repeat(${teams}, minmax(120px, 1fr))`
  /* Explicit rows, not another auto-rows floor: the header keeps its own
     natural (avatar + name) height, and every round after it is exactly
     50px — a fixed size, never a minimum. The old
     auto-rows-[minmax(34px,auto)] let a round's height come from its
     tallest cell's own content, which is exactly the thing a fixed-height
     design needs to stop being possible; naming every track here removes
     the question rather than narrowing it. */
  const rowsTemplate = `auto repeat(${rounds}, 50px)`
  const totalPicks = teams * rounds

  return (
    // w-full h-full, not a flex-basis of its own: DraftRoom.jsx now wraps
    // this in a div that carries the mobileView show/hide and, at lg+, the
    // real lg:flex-[7] against the queue's lg:flex-[3] — this just fills
    // whatever that wrapper gives it, on both sides of the breakpoint,
    // rather than trying to size itself against the row a second time.
    // overflow-x-auto/overflow-y-auto: the grid itself is min-w-max (every
    // column at its real width, never squashed), so on a phone it's always
    // wider than the viewport — this box is what scrolls, both directions,
    // with touch.
    <div className="flex h-full min-h-[240px] w-full flex-1 flex-col overflow-hidden border-b border-slate-800 bg-[#0B0E14] lg:border-b-0 lg:border-r">
      {/* Title, the real picks-made count, and the Log link — mobile only.
          Desktop draws none of this row: it already has DraftLogDock as a
          permanent side panel, and that panel's own "Log" tab content
          inside PlayerHub is itself lg:hidden — wiring this same button in
          at lg+ would open a sheet with nothing visible inside it, the
          dead-control failure CLAUDE.md names outright. The count is real,
          not a placeholder: picks.length and totalPicks are the same
          numbers the rest of the room already reads off picks/league. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 lg:hidden">
        <h2 className="text-lg font-bold text-white">The board</h2>
        <div className="flex items-center gap-3">
          <span className="font-plex text-xs text-white/60">
            {picks.length} of {totalPicks}
          </span>
          {onOpenLog && (
            <button
              type="button"
              onClick={onOpenLog}
              className="flex items-center gap-0.5 text-xs font-semibold text-teal-300 transition-colors duration-150 hover:text-teal-200"
            >
              Log
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* The legend, above the grid rather than below it — a reader meets
          it before the first cell, not after scrolling past however many
          rounds are already on the board. Two facts it decodes, both real
          things this exact grid draws: the wash a cell picks up from
          adpTint() above, and the gold outline mineEdge() runs down one
          column. "you" is drawn in that same #FFD166 rather than a teal
          swatch, because the ring really is gold (CLAUDE.md: "Gold is
          identity... a colour doing five jobs is not a signal") — drawing
          it teal here would make the legend describe a ring the board
          doesn't have, and teal already means "beat ADP" two swatches to
          its left on this exact row. The six position hues read off
          LEGEND_POSITIONS/POS_SOLID directly, the same map the cell rail
          itself uses, so this can never list a colour the board doesn't
          actually draw. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-800 px-3 py-2 lg:hidden">
        <span className="font-plex text-[10px] uppercase tracking-wide text-white/60">
          Tint = value vs ADP
        </span>
        <span className="flex items-center gap-1 text-[10px] text-white/60">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-teal-500/60 bg-[rgba(0,229,255,0.12)]" aria-hidden="true" />
          beat it
        </span>
        <span className="flex items-center gap-1 text-[10px] text-white/60">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-red-400/60 bg-[rgba(248,113,113,0.14)]" aria-hidden="true" />
          reached
        </span>
        <span className="flex items-center gap-1 text-[10px] text-white/60">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm border-2 border-[#FFD166]" aria-hidden="true" />
          you
        </span>
        <span className="flex flex-wrap items-center gap-2 border-l border-slate-800 pl-2">
          {LEGEND_POSITIONS.map((pos) => (
            <span key={pos} className="flex items-center gap-1 text-[10px] text-white/60">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: POS_SOLID[pos] }} aria-hidden="true" />
              {pos}
            </span>
          ))}
        </span>
      </div>

      {/* The one scroll container, both axes — everything above this point
          is shrink-0 chrome that never scrolls with it, so there is exactly
          one scrollbar on this screen rather than a nested one fighting an
          outer page scroll. flex-1 min-h-0 is what makes it claim exactly
          the remaining height rather than growing to its content. */}
      <div className="min-h-0 w-full flex-1 overflow-x-auto overflow-y-auto">
      {/* pb-[7rem+tab bar] below lg: PlayerHub's sheet is fixed over the
          bottom edge there and would otherwise cover the last couple of
          rounds when scrolled all the way down. The 7rem (112px, pb-28's own
          value) is the sheet's own collapsed height; the +58px+safe-area on
          top of it is new with this pass, matching PlayerHub.jsx's own shift
          off true bottom-0 to make room for MobileDraftTabBar.jsx sitting
          underneath it — both track the same offset, so if one moves the
          other has to. lg:pb-0 because at lg+ every panel is in normal flow
          and nothing floats over this. */}
      {/* The two column rules reach CSS as custom properties so the
          breakpoint can pick between them — a `style` prop cannot carry a
          media query, and this is one grid with two shapes rather than two
          grids. min-w-max stays true at lg+ now too: it's what makes the
          grid actually claim its natural (floor-respecting) width instead
          of shrinking to fit the container, which is what forces this
          wrapper's own overflow-x-auto to engage instead of the columns
          quietly going back to 0. Dropping to lg:min-w-0 was the earlier,
          rejected shape — see the comment on colsWide above.

          grid-template-rows replaces the old auto-rows floor (see
          rowsTemplate above): the header row sizes to its own content and
          every round is exactly 50px, never a minimum a tall cell could
          push past. */}
      <div
        className="grid min-w-max pb-[calc(7rem+58px+env(safe-area-inset-bottom))] lg:pb-0 [grid-template-columns:var(--cols)] lg:[grid-template-columns:var(--cols-wide)] [grid-template-rows:var(--rows)]"
        style={{ '--cols': cols, '--cols-wide': colsWide, '--rows': rowsTemplate }}
      >
        {/* header row */}
        <div className="sticky left-0 top-0 z-20 flex items-center justify-center border-b border-r border-slate-800 bg-slate-900/95 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/30">
          Rd
        </div>
        {/* A real <button> only while there's somewhere for the click to
            go — DraftRoom passes onTeamClick once the draft is over, when
            every team has a full Insights report to open. Before that the
            header is the same inert label it always was, per the
            dead-control rule: nothing may look pressable and do nothing. */}
        {/* Before a draft, a column header is a chair rather than a label.
            Claiming one is how you pick where you sit - the same gesture in a
            room and on your own, because a seat is a seat. `seats` comes
            from the room when there is one; off-room the only owned seat is
            yours. */}
        {onClaimSeat ? Array.from({ length: teams }, (_, s) => {
          /* Occupancy is `taken`, never the name. A manager who has not typed
             one still occupies the chair, and reading the name instead drew
             their seat as free - so the lobby invited a guest to click a chair
             somebody was already sitting in, and the room refused with nothing
             on screen to explain it. The room already sends both facts
             separately; this was throwing one of them away.

             `you` comes from the room too rather than being derived from
             mySlot, because the room is the thing that decides where you sit. */
          const chair = seats ? seats[s] : null
          const mine = chair ? !!chair.you : s === mySlot
          const taken = chair ? !!chair.taken && !chair.you : false
          const who = chair && chair.name ? chair.name : null
          return (
            <div
              key={'hd-' + s}
              className="sticky top-0 z-10 flex flex-col items-center gap-1 border-b border-r border-slate-800 bg-slate-900/95 px-1 py-1.5"
            >
              <button
                type="button"
                onClick={() => onClaimSeat(s)}
                disabled={taken}
                title={mine ? 'This is your seat' : taken ? (who || 'Another manager') + ' has this seat' : 'Take seat ' + (s + 1)}
                className={
                  'w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors duration-150 ' +
                  (mine
                    ? 'bg-teal-500 text-obsidian'
                    : taken
                      ? 'cursor-not-allowed bg-white/5 text-white/30'
                      : 'bg-white/10 text-white/60 hover:bg-teal-500/20 hover:text-teal-300')
                }
              >
                {mine ? 'You' : taken ? 'Taken' : 'Claim'}
              </button>
              {/* `mine`, not another call to teamLabelOf(s) — that asks
                  engine.teamLabel(), which compares against the *committed*
                  state.mySlot and only updates once startDraft() actually
                  runs. Before that, mySlot here is the lobby's own live
                  selection (lobbySlot in DraftRoom.jsx), so the button above
                  already reads the right seat — the label was the one still
                  asking the stale source, which is why it stuck to whichever
                  seat was mine before you clicked a different chair. */}
              <span
                className="w-full truncate text-center text-[11px] font-semibold text-white/50"
                title={who || (mine ? 'Your Team' : teamLabelOf(s))}
              >
                {who || (mine ? 'Your Team' : teamLabelOf(s))}
              </span>
            </div>
          )
        }) : Array.from({ length: teams }, (_, s) => {
          // A 30px avatar (initials, no photo — a team has none) plus a
          // centred name, replacing the roster-count strip: a design
          // review read that strip as an unlabelled row of coloured
          // digits, and the handoff this room was built from says the
          // header should carry a name, "not a name crushed over four
          // count chips" in the first place — so the fix is to not print
          // the chips here at all, not to caption them.
          const label = s === mySlot ? 'YOU' : teamLabelOf(s)
          const content = (
            <>
              <span
                className={
                  'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold ' +
                  (s === mySlot ? 'bg-[#FFD166] text-obsidian' : 'bg-white/10 text-white/60')
                }
                aria-hidden="true"
              >
                {initialsOf(teamLabelOf(s))}
              </span>
              <span className={'truncate text-xs font-semibold ' + (s === mySlot ? 'text-[#FFD166]' : 'text-white/60')}>
                {label}
              </span>
            </>
          )
          return onTeamClick ? (
            <button
              key={'hd-' + s}
              type="button"
              onClick={() => onTeamClick(s)}
              className="sticky top-0 z-10 flex flex-col items-center justify-center gap-1 truncate border-b border-r border-slate-800 bg-slate-900/95 px-1.5 py-1.5 transition-colors duration-150 hover:bg-teal-500/10"
              title={'View ' + teamLabelOf(s) + "'s draft insights"}
            >
              {content}
            </button>
          ) : (
            <div
              key={'hd-' + s}
              className="sticky top-0 z-10 flex flex-col items-center justify-center gap-1 border-b border-r border-slate-800 bg-slate-900/95 px-1.5 py-1.5"
              title={teamLabelOf(s)}
            >
              {content}
            </div>
          )
        })}

        {Array.from({ length: rounds }, (_, ri) => {
          const round = ri + 1
          return (
            <div key={'row-' + round} className="contents">
              <div className="sticky left-0 z-10 flex items-center justify-center border-b border-r border-slate-800 bg-slate-900/95 text-xs font-semibold text-white/30">
                {round}
              </div>
              {Array.from({ length: teams }, (_, s) => {
                const pick = byCell.get(round + '-' + s)
                const isCurrent = !!onClock && onClock.round === round && onClock.slot === s
                const isMine = s === mySlot
                const gap = pick ? adpGap(pick) : null
                // One call, reused for the card's background and its own
                // delta text a few lines down — never a second calculation.
                const tint = adpTint(gap)
                const overall = DE ? DE.overallOf(round, s, teams) : null
                // The label for a pick that has landed. Always via
                // DraftEngine.pickCode() — the snake mirror lives there and
                // nowhere else (CLAUDE.md: a pick number is not a seat
                // number, and half the board agrees with the wrong answer).
                const code = pick && DE ? DE.pickCode(pick.overall, teams) : null
                const arrow = boardArrow(DE, round, s, teams)
                return (
                  <div
                    key={round + '-' + s}
                    className={'h-[50px] box-border border-b border-r border-slate-800/70 p-0.5 ' + mineEdge(isMine, round === 1, round === rounds)}
                  >
                    {pick ? (
                      // layoutId matches the same player's row in
                      // PlayerQueueSidebar.jsx — while both are mounted
                      // (the instant a real pick lands: the sidebar row
                      // exiting, this cell appearing), Framer Motion
                      // computes the shared FLIP transition between them
                      // on its own, so the card visibly moves from the
                      // queue into its cell rather than just popping in.
                      //
                      // A neutral ground plus a 3px POS_SOLID left rule,
                      // not the old saturated full-cell fill — a design
                      // review, and a look at the actual handoff spec
                      // rather than this file's own two-year-old paraphrase
                      // of it, both landed on the same place: painting six
                      // hues across 140 full cells means nothing is
                      // emphasised because everything already is. The rule
                      // is a plain style prop (POS_SOLID is a hex map, not
                      // Tailwind classes) since a computed colour can't be
                      // a static utility class.
                      <motion.div
                        layoutId={'player-' + (pick.player.id || pick.player.name)}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        style={{ borderLeft: '3px solid ' + (POS_SOLID[pick.player.pos] || 'rgba(255,255,255,0.25)') }}
                        // h-full alone is enough now: the row itself is a
                        // fixed 50px (rowsTemplate above) rather than a
                        // minmax floor, so every card fills the identical
                        // track regardless of its own content — there is no
                        // longer a shorter round for the grid to shrink
                        // toward (the legacy board's "two row heights" bug).
                        // tint.bg replaces the flat charcoal fill with a
                        // wash on a pick that moved against its ADP.
                        // box-border restates border-box explicitly (Tailwind
                        // Preflight already sets it globally) because an
                        // explicit height and this card's own padding are
                        // exactly where content-box and border-box disagree.
                        className={'relative flex h-full box-border flex-col justify-center gap-0.5 rounded-md px-1.5 py-1 text-white/90 ' + tint.bg}
                      >
                        {/* Line 1 — name, then the pick code. The code used
                            to share line 1 with the position letters; the
                            position moved to line 2 as its own small badge
                            once the cell stopped being a full colour block
                            and needed another way to say WR vs RB besides
                            the (now much subtler) rail. */}
                        <div className="flex items-center justify-between gap-1 leading-none">
                          {/* "J. Gibbs", not "Jahmyr Gibbs". A full name in
                              a ~132px column truncated 133 of 140 times.
                              shortName() is the engine's own function, the
                              same one the hero shot uses and for the same
                              reason: an initial plus a surname reads as a
                              person where a surname alone reads as a row in
                              a table. Never re-derived here. */}
                          <p className="min-w-0 truncate text-[13px] font-semibold" title={pick.player.name}>
                            {shortNameOf ? shortNameOf(pick.player) : pick.player.name}
                          </p>
                          {code && <span className="shrink-0 font-plex text-[10px] text-white/50">{code}</span>}
                        </div>
                        {/* Line 2 — position badge, club, the snake arrow,
                            then the ADP gap on its own side so it never
                            competes with the name above it for the reader's
                            first look. */}
                        <div className="flex items-center justify-between gap-1 leading-none">
                          <span className="flex min-w-0 items-center gap-1">
                            <span className={'shrink-0 rounded px-1 py-px text-[9px] font-bold ' + (POS_BADGE[pick.player.pos] || 'bg-white/10 text-white/60')}>
                              {pick.player.pos}
                            </span>
                            <span className="truncate text-[10px] font-medium text-white/50">{pick.player.team}</span>
                            <Arrow dir={arrow} className="shrink-0 text-[9px] text-white/50" />
                          </span>
                          {gap != null && (
                            <span className={'shrink-0 text-[10px] font-semibold ' + tint.text}>
                              {gap >= 0 ? '+' : ''}
                              {gap.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ) : isCurrent ? (
                      <motion.div
                        animate={{ opacity: [1, 0.75, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative flex h-full box-border items-center justify-center rounded-md border-2 border-teal-400 bg-teal-500/10 text-[10px] font-bold uppercase tracking-wide text-teal-300 shadow-[0_0_15px_rgba(0,229,255,0.4)]"
                      >
                        {overall != null && (
                          <span className="absolute left-1 top-0.5 text-[10px] font-normal normal-case text-teal-300/60">{overall}</span>
                        )}
                        On the clock
                        <Arrow dir={arrow} className="absolute right-1 top-0.5 text-[9px] font-normal normal-case text-teal-300/60" />
                      </motion.div>
                    ) : (
                      <div className="relative h-full box-border rounded-md border border-dashed border-slate-800">
                        {overall != null && (
                          <span className={'absolute left-1 top-0.5 text-[10px] ' + (isMine ? 'font-bold text-[#FFD166]' : 'text-slate-500')}>
                            {overall}
                          </span>
                        )}
                        <Arrow dir={arrow} className="absolute right-1 top-0.5 text-[9px] text-white/20" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
