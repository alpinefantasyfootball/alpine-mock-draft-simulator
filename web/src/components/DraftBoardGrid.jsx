import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { POS_MATTE, POS_MATTE_INK, INJURY_META } from './draftRoomPositions.js'

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
// call per pick, reused for the delta text beside the name, never
// recomputed. Beat-or-tied (gap >= 0, a bargain) reads green; reached
// (gap < 0) reads red. No-data (gap == null — this player carries no adp
// at all) prints nothing.
//
// Both values are much darker than the brand teal and rose these used to
// be, and they had to be: the cell is a POS_MATTE pastel now (see that
// export's own comment), so every mark on it is dark-on-light rather than
// light-on-dark and the two colours are the *inverse* of what they were.
// #00E5FF on #F1D274 is a smudge. These are the darkest step of a green
// and a red that still read as green and red, solved against every fill in
// the set rather than against an average — a colour drawn on top of a
// per-player background has to clear all six, not the one that happened to
// be on screen. That is the "every stop in a gradient must clear white on
// its own" rule in a new shape.
//
// Solved to 5.0 rather than to the 4.5 bar itself, and the 0.5 was bought
// rather than chosen. The first pair was solved to exactly 4.5 and the
// model said 4.53 worst case; measured on the real rendered board, with
// transitions killed and ancestor opacity composited, the delta came back
// 4.37 — under. The model and the browser disagreed by about four
// hundredths of a step, which is nothing until the target is the bar
// itself. The browser is the authority (CLAUDE.md: check the actual screen,
// not only the arithmetic), and the lesson is not to distrust the model but
// not to spend its entire margin: solve past the bar so a small
// disagreement cannot cross it.
const GAP_GOOD = '#05432D'
const GAP_BAD = '#721913'

function adpText(gap) {
  if (gap == null) return ''
  return gap >= 0 ? GAP_GOOD : GAP_BAD
}

// Alpha over a hex, for the two places a mark on a matte cell wants to be
// the cell's own ink at less than full strength. POS_MATTE/POS_MATTE_INK
// are hex maps, not Tailwind classes, and interpolating a hex into a class
// string is the literal trap draftRoomPositions.js's own header warns
// about — the JIT scanner greps source for a complete class token, never
// sees one built at runtime, and silently compiles to nothing.
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

// The meta line's own ink — the same near-black the name uses, at an alpha
// that still clears 4.5:1 on every one of the six fills.
//
// 0.55 was the first value and reads correctly as "secondary" while
// measuring 3.22 on the DST fill: the translucent-white-on-a-saturated-
// surface false economy this project already found once on the draft
// header's labels, arriving from the other side of the value scale.
//
// 0.72 was the second, and it cleared — but only just. Measured on the
// real rendered board, with transitions killed and every ancestor's own
// `opacity` composited in (the third way to lie about a colour), the worst
// case came back 4.56 against a 4.5 bar. A value that clears by six
// hundredths is a value that stops clearing the next time anything about
// the surface moves, and this surface is six different colours. 0.78 is
// still visibly the secondary line against the name's full-strength ink
// and puts the worst case comfortably clear instead.
const META_INK = hexToRgba(POS_MATTE_INK, 0.78)

// The legend's position row and the cell's own fill read the same six
// hues off the same map — Object.keys() rather than a second, hand-typed
// QB/RB/WR/TE/K/DST list that could drift from this one.
const LEGEND_POSITIONS = Object.keys(POS_MATTE)

// Pick-order direction, per cell — every cell carries it, not just drafted
// ones (CLAUDE.md: "it was on drafted ones only" was itself a shipped
// bug — the turn matters most *before* a pick lands). Built only from
// DraftEngine, the one place the mirror is allowed to live, never
// re-derived here.
//
// Takes the whole `league`, not a team count. `round % 2 === 0` was the
// direction test and it is only right for a plain snake: a linear draft
// runs forward in every round and third-round reversal inverts the parity
// from round three on, so a board asked for a team count alone would draw
// confident arrows pointing the wrong way, on cells whose pick numbers
// were simultaneously correct. That is the seat-versus-pick-number bug
// exactly — two right numbers side by side disagreeing — so the answer
// comes from DraftEngine.reversedRound().
function boardArrow(DE, round, slot, league) {
  if (!DE) return null
  if (DE.pickInRound(round, slot, league) === league.teams) return 'down'
  return DE.reversedRound(round, league) ? 'left' : 'right'
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
//
// ---- The keyline came back, and a test predicted it would ----
//
// This was a single gold edge at 0.45 alpha, and it was correct for as
// long as every filled cell on this board was dark. The matte palette
// made them light, and gold on a light surface is nothing: measured on
// the real board, #FFD166 lands 1.06 on the RB fill and 1.02 on the K
// fill, against a 3:1 bar for a mark.
//
// board-marks.spec.mjs called this in advance. Its own comment reads "the
// precondition the single ring rests on... if this ever stops being true,
// the pair has to come back and this is the line that says so" — written
// about a hypothetical light theme, and what actually falsified it was
// making the CELLS light. The failing assertion is the one that comment
// is attached to.
//
// So it is gold-then-keyline now, the identical construction style.css's
// own `.board .cell.mine` has always used, for the identical reason: no
// single colour clears 3:1 on both a position fill and an empty cell, and
// one half of a pair always has the surface. Measured, gold clears 10.45
// on an empty cell and the keyline 8.53-12.91 on all six fills — exact
// complements — and the two clear each other at 13.23, so the pair always
// reads as an edge whatever it lands on.
//
// The order is load-bearing. Box shadows paint first-on-top, so the 2px
// gold is listed before the 3px keyline: the keyline's own outer 2px is
// covered by the gold, and what remains visible of it is the 1px sitting
// just inside. Swap them and the keyline covers the gold entirely.
//
// Gold is full strength rather than the old 0.45 for the same reason: an
// alpha that read as a tasteful wash on a dark cell is a third of a
// colour on a light one, and this is a mark rather than a surface.
const MINE_WASH = 'bg-[rgba(255,209,102,0.07)]'
const MINE_EDGE = {
  mid: MINE_WASH + ' shadow-[inset_2px_0_0_#FFD166,inset_-2px_0_0_#FFD166,inset_3px_0_0_#0B1017,inset_-3px_0_0_#0B1017]',
  first: MINE_WASH + ' shadow-[inset_2px_0_0_#FFD166,inset_-2px_0_0_#FFD166,inset_0_2px_0_#FFD166,inset_3px_0_0_#0B1017,inset_-3px_0_0_#0B1017,inset_0_3px_0_#0B1017]',
  last: MINE_WASH + ' shadow-[inset_2px_0_0_#FFD166,inset_-2px_0_0_#FFD166,inset_0_-2px_0_#FFD166,inset_3px_0_0_#0B1017,inset_-3px_0_0_#0B1017,inset_0_-3px_0_#0B1017]',
  // Both edges at once only happens in a one-round league — an edge case,
  // but a real one (this app supports 1-round drafts), so it gets its own
  // real literal rather than falling through to "mid" and drawing a
  // column with no top or bottom.
  both: MINE_WASH + ' shadow-[inset_2px_0_0_#FFD166,inset_-2px_0_0_#FFD166,inset_0_2px_0_#FFD166,inset_0_-2px_0_#FFD166,inset_3px_0_0_#0B1017,inset_-3px_0_0_#0B1017,inset_0_3px_0_#0B1017,inset_0_-3px_0_#0B1017]',
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

// The dock-raise/lower chevron pair, on the board's own bottom-right corner
// rather than in DraftRoom.jsx as a sibling overlay — the board is the
// thing whose corner this sits on, and DraftLobby.jsx mounts this same
// component with no dock beneath it at all (trayPos/onTrayUp/onTrayDown all
// undefined there), so the pair only renders when a real dock is passed in.
function RaiseLowerButton({ onClick, disabled, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        'flex h-6 w-6 items-center justify-center rounded-full border transition-colors duration-150 ' +
        (disabled
          ? 'cursor-not-allowed border-slate-rule bg-slate-sunk/70 text-white/15'
          : 'border-slate-rule bg-slate-sunk/80 text-white/60 hover:border-teal-400/50 hover:text-teal-300')
      }
    >
      {children}
    </button>
  )
}

/* Put the live pick in the middle of the board's own scroller.

   Two things here are the hard-won rules this codebase already paid for
   once, on the legacy board, and they are just as true of this one.

   `offsetTop` is NOT a distance to the scroller. It is the distance to the
   nearest *positioned* ancestor, and nothing between a board cell and this
   scroll container is positioned — the legacy board read it anyway and sat
   about four rounds past the live pick, twitching every time anything above
   the board changed height. Two getBoundingClientRect() calls, differenced,
   are a real distance between two real boxes whatever is positioned in
   between. Do not "fix" a future version of this by adding `position:
   relative` to the scroller: that makes offsetTop correct today and
   silently wrong again the next time somebody changes positioning.

   And do not re-ask for a scroll you are already at. `behavior: smooth`
   starts an animation whether or not the target moved, so a caller that
   fires this on every render would restart one every few hundred
   milliseconds. 4px of slop is what turns "moves constantly" into "moves
   once, when asked." */
function centreOnLive(scroller, cell) {
  if (!scroller || !cell) return
  const box = scroller.getBoundingClientRect()
  const target = cell.getBoundingClientRect()
  const left = scroller.scrollLeft + (target.left - box.left) - (box.width - target.width) / 2
  const top = scroller.scrollTop + (target.top - box.top) - (box.height - target.height) / 2
  const x = Math.max(0, Math.min(left, scroller.scrollWidth - scroller.clientWidth))
  const y = Math.max(0, Math.min(top, scroller.scrollHeight - scroller.clientHeight))
  if (Math.abs(x - scroller.scrollLeft) < 4 && Math.abs(y - scroller.scrollTop) < 4) return
  scroller.scrollTo({ left: x, top: y, behavior: 'smooth' })
}

export default function DraftBoardGrid({ league, picks, mySlot, onClock, teamLabelOf, onTeamClick, shortNameOf, onClaimSeat, seats, onSelectPlayer, trayPos, onTrayUp, onTrayDown, hideLegend, scrollToLiveSignal }) {
  const scrollerRef = useRef(null)
  const liveCellRef = useRef(null)

  /* Driven by a counter the caller increments, not by a ref handed up or a
     window event. A counter is the smallest thing that can express "the
     crosshair was pressed again" — pressing it twice in a row has to scroll
     twice, and a boolean cannot say that. It also keeps this a plain prop:
     a window event would scroll every board that happened to be mounted,
     and a forwarded imperative handle would have to be threaded through
     DraftBoardPeekPhone and DraftRoomPhone to reach the header.

     Deliberately skipped on the first render (signal 0 / undefined): a
     caller that has never pressed it must not have the board jump on
     mount, which is a different feature (auto-follow) with its own
     "the board yanks while I'm reading round one" failure mode. */
  useEffect(() => {
    if (!scrollToLiveSignal) return
    centreOnLive(scrollerRef.current, liveCellRef.current)
  }, [scrollToLiveSignal])

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
  /* 36px gutter below lg, not 64 and not the 30px this used to be either.
     A round number is one or two digits and the rail is sticky, so it is
     permanently on screen. 36+108 is the mobile board pass's own pair
     (see the seat column note below) — both moved together so a ten-team
     board lands on exactly 1116px, the acceptance check's own number,
     rather than the two floors being tuned independently and drifting
     apart. Desktop keeps its own pair below, untouched.

     Fixed 108px below lg, not minmax(108px, 1fr). The floor is the right
     shape for desktop — see the note on colsWide below — but combined
     with this grid's own min-w-max it resolves to max-content, and a
     board of real player names came out well past what a fixed track
     gives. On a width where you can see three columns at once, how far
     the board runs is the cost that matters, and 108px is the mobile
     board pass's own measured floor for the longest name it has to hold
     at this row height. */
  const cols = `36px repeat(${teams}, 108px)`
  const colsWide = `56px repeat(${teams}, minmax(120px, 1fr))`
  /* Explicit rows, not another auto-rows floor: the header keeps its own
     natural (avatar + name) height, and every round after it is exactly
     46px below lg, 50px at lg+ — a fixed size, never a minimum. The old
     auto-rows-[minmax(34px,auto)] let a round's height come from its
     tallest cell's own content, which is exactly the thing a fixed-height
     design needs to stop being possible; naming every track here removes
     the question rather than narrowing it. 46, not the 56 this used to
     be: the mobile board pass's own row height, paired with the smaller
     108px column and 24px seat avatar below so the whole header/row
     stack shrinks together rather than the columns narrowing under rows
     still sized for the wider ones. */
  const rowsTemplate = `auto repeat(${rounds}, 46px)`
  const rowsWide = `auto repeat(${rounds}, 50px)`

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
    <div className="relative flex h-full min-h-[240px] w-full flex-1 flex-col overflow-hidden border-b border-slate-rule bg-slate lg:border-b-0 lg:border-r">
      {/* The legend, above the grid rather than below it — a reader meets
          it before the first cell, not after scrolling past however many
          rounds are already on the board. Position leads now: it's the
          cell's own background (POS_MATTE), so it's the fact a
          reader meets first when they meet the board, and the six hues
          read off LEGEND_POSITIONS/POS_MATTE directly — the same map the
          cell fill itself uses, so this can never list a colour the
          board doesn't actually draw. The ADP delta comes second, as the
          coloured *number* it actually is now rather than a second wash —
          this used to be a background tint too, reported back as "why are
          we using red/green," which was really two colour signals
          fighting on the same cell. "you" stays gold, deliberately not
          teal: the ring really is gold (CLAUDE.md: "Gold is identity... a
          colour doing five jobs is not a signal"), and teal now belongs to
          "beat ADP" two swatches to its right on this exact row.

          Not lg:hidden any more. This was mobile-only while desktop had
          nothing in its place — every filled cell on the lg+ board carries
          the identical wash and the identical ADP-gap number this legend
          decodes, with zero explanation beside them. */}
      {/* hideLegend: the phone board-peek (DraftBoardPeekPhone.jsx) draws
          its own strip above this grid instead — roster need per position,
          not "what does each colour mean." Rendering both would be two
          strips answering two different questions stacked on top of a view
          that already has the least vertical room of any surface this
          component appears in. Every other caller passes nothing, so this
          defaults to showing exactly what it always has. */}
      {!hideLegend && <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-rule px-3 py-2">
        <span className="font-plex text-[10px] uppercase tracking-wide text-white/60">
          Fill = position
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {LEGEND_POSITIONS.map((pos) => (
            <span key={pos} className="flex items-center gap-1 text-[10px] text-white/60">
              {/* POS_MATTE, not POS_SOLID: a legend swatch has to be the
                  colour the cell is actually painted, and those are two
                  lightnesses of the same hue now. Showing the deep one here
                  would be a legend for a board that no longer exists. */}
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: POS_MATTE[pos] }} aria-hidden="true" />
              {pos === 'DST' ? 'DEF' : pos}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-2 border-l border-slate-rule pl-3">
          <span className="font-plex text-[10px] uppercase tracking-wide text-white/60">Number = value vs ADP</span>
          {/* Drawn on a real matte swatch rather than as bare text on the
              legend's own dark ground, because that is the only place these
              two colours ever appear — GAP_GOOD and GAP_BAD are dark values
              solved against the six fills, so printing them on the panel
              would show the reader a pair of colours the board never draws,
              at a contrast the board never has. A legend that decodes a
              colour has to show the colour in its own context. */}
          <span className="rounded px-1 py-px text-[10px] font-bold" style={{ backgroundColor: POS_MATTE.RB, color: GAP_GOOD }}>+0.4 beat it</span>
          <span className="rounded px-1 py-px text-[10px] font-bold" style={{ backgroundColor: POS_MATTE.RB, color: GAP_BAD }}>&minus;0.7 reached</span>
        </span>
        <span className="flex items-center gap-1 text-[10px] text-white/60">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm border-2 border-[#FFD166]" aria-hidden="true" />
          you
        </span>
      </div>}

      {/* The one scroll container, both axes — everything above this point
          is shrink-0 chrome that never scrolls with it, so there is exactly
          one scrollbar on this screen rather than a nested one fighting an
          outer page scroll. flex-1 min-h-0 is what makes it claim exactly
          the remaining height rather than growing to its content. */}
      <div ref={scrollerRef} className="no-scrollbar-below-lg min-h-0 w-full flex-1 overflow-x-auto overflow-y-auto">
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
        className="grid min-w-max pb-[calc(7rem+58px+env(safe-area-inset-bottom))] lg:pb-0 [grid-template-columns:var(--cols)] lg:[grid-template-columns:var(--cols-wide)] [grid-template-rows:var(--rows)] lg:[grid-template-rows:var(--rows-wide)]"
        style={{ '--cols': cols, '--cols-wide': colsWide, '--rows': rowsTemplate, '--rows-wide': rowsWide }}
      >
        {/* header row */}
        <div className="sticky left-0 top-0 z-20 flex items-center justify-center border-b border-r border-slate-rule bg-slate-panel/95 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
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
              className="sticky top-0 z-10 flex flex-col items-center gap-1 border-b border-r border-slate-rule bg-slate-panel/95 px-1 py-1.5"
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
          // A 24px avatar below lg (30px at lg+, unchanged), initials, no
          // photo — a team has none — plus a centred name, replacing the
          // roster-count strip: a design review read that strip as an
          // unlabelled row of coloured digits, and the handoff this room
          // was built from says the header should carry a name, "not a
          // name crushed over four count chips" in the first place — so
          // the fix is to not print the chips here at all, not to caption
          // them. 24, not 30, below lg: the mobile board pass's own seat
          // header size, shrinking with the 108px column and 46px row it
          // sits above rather than staying the desktop circle in a
          // narrower box.
          const label = s === mySlot ? 'YOU' : teamLabelOf(s)
          const content = (
            <>
              <span
                className={
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold lg:h-[30px] lg:w-[30px] ' +
                  (s === mySlot ? 'bg-[#FFD166] text-obsidian' : 'bg-white/10 text-white/60')
                }
                aria-hidden="true"
              >
                {initialsOf(teamLabelOf(s))}
              </span>
              {/* Two lines below lg, one with an ellipsis above it. A
                  120px column cannot hold "Bone-Thugs-N-Montgomery" on one
                  line at any size worth reading, and the room's team names
                  are most of its personality — so the phone spends a second
                  9.5px line on them rather than a smaller single line.
                  overflow-wrap:anywhere is what lets a long unbroken run
                  like that one split at all; line-clamp caps it at two and
                  ellipsises the rest. Desktop keeps the single truncated
                  line its wider columns can afford. */}
              <span
                className={
                  'w-full text-center text-[9.5px] font-semibold leading-[1.15] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box] overflow-hidden ' +
                  'lg:block lg:truncate lg:text-xs lg:leading-normal ' +
                  (s === mySlot ? 'text-[#FFD166]' : 'text-white/60')
                }
              >
                {label}
              </span>
            </>
          )
          return onTeamClick ? (
            <button
              key={'hd-' + s}
              type="button"
              onClick={() => onTeamClick(s)}
              className="sticky top-0 z-10 flex flex-col items-center justify-center gap-1 truncate border-b border-r border-slate-rule bg-slate-panel/95 px-1.5 py-1.5 transition-colors duration-150 hover:bg-teal-500/10"
              title={'View ' + teamLabelOf(s) + "'s draft insights"}
            >
              {content}
            </button>
          ) : (
            <div
              key={'hd-' + s}
              className="sticky top-0 z-10 flex flex-col items-center justify-center gap-1 border-b border-r border-slate-rule bg-slate-panel/95 px-1.5 py-1.5"
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
              <div className="sticky left-0 z-10 flex items-center justify-center border-b border-r border-slate-rule bg-slate-panel/95 text-xs font-semibold text-ink-muted">
                {round}
              </div>
              {Array.from({ length: teams }, (_, s) => {
                const pick = byCell.get(round + '-' + s)
                const isCurrent = !!onClock && onClock.round === round && onClock.slot === s
                const isMine = s === mySlot
                const gap = pick ? adpGap(pick) : null
                const gapText = adpText(gap)
                const overall = DE ? DE.overallOf(round, s, league) : null
                // The label for a pick that has landed. Always via
                // DraftEngine.pickCode() — the snake mirror lives there and
                // nowhere else (CLAUDE.md: a pick number is not a seat
                // number, and half the board agrees with the wrong answer).
                const code = pick && DE ? DE.pickCode(pick.overall, league) : null
                const arrow = boardArrow(DE, round, s, league)
                return (
                  <div
                    key={round + '-' + s}
                    /* The ref goes on the cell WRAPPER rather than on the
                       pulsing "On the clock" card inside it, because the
                       wrapper is the thing that exists in every state: on a
                       finished draft there is no live card at all, and on a
                       cell that has just been drafted the card is mid-FLIP
                       and its rect is a frame of animation rather than a
                       position. */
                    ref={isCurrent ? liveCellRef : undefined}
                    className={'h-[46px] lg:h-[50px] box-border border-b border-r border-slate-rule/70 p-0.5 ' + mineEdge(isMine, round === 1, round === rounds)}
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
                      // A flat POS_MATTE fill with dark ink on it — see that
                      // export's own comment in draftRoomPositions.js for the
                      // four rounds this decision has been through and what
                      // is different this time. The short version: the fill
                      // used to be POS_SOLID at 14% alpha because POS_SOLID
                      // is a colour picked to carry WHITE text and is far too
                      // heavy to paint 140 cells with, so it was diluted
                      // until six hues read as six tints of the same
                      // charcoal. A matte pastel with near-black ink is the
                      // opposite weight and needs no diluting.
                      //
                      // Everything drawn on this card therefore inverts with
                      // it: the name, the pick code, the club and the arrow
                      // are all POS_MATTE_INK rather than white, and the two
                      // ADP-gap values are dark green/red rather than brand
                      // teal/rose. A light-on-dark mark left behind on a
                      // light fill does not throw, it just becomes
                      // unreadable — which is exactly the class of bug the
                      // "check the actual screen next to the actual other
                      // elements" rule exists for.
                      //
                      // The position badge is gone from the card, and its
                      // absence is the point rather than an omission: the
                      // fill IS the position now, so a chip repeating it in
                      // the same colour is the one fact said twice in a 108px
                      // box that has four others to carry.
                      <motion.div
                        layoutId={'player-' + (pick.player.id || pick.player.name)}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        onClick={() => onSelectPlayer && onSelectPlayer(pick.player)}
                        style={{
                          backgroundColor: POS_MATTE[pick.player.pos] || '#C9D1DA',
                          color: POS_MATTE_INK,
                        }}
                        // h-full alone is enough now: the row itself is a
                        // fixed 50px (rowsTemplate above) rather than a
                        // minmax floor, so every card fills the identical
                        // track regardless of its own content — there is no
                        // longer a shorter round for the grid to shrink
                        // toward (the legacy board's "two row heights" bug).
                        // box-border restates border-box explicitly (Tailwind
                        // Preflight already sets it globally) because an
                        // explicit height and this card's own padding are
                        // exactly where content-box and border-box disagree.
                        className="relative flex h-full box-border cursor-pointer flex-col justify-center gap-[3px] rounded-md px-1.5 py-1"
                      >
                        {/* Line 1 — the meta line: position, club, the snake
                            arrow and the pick code, all at META_INK. Small
                            and secondary, above the name rather than below
                            it, which is the order the reference board uses
                            and the order that works once the name is the
                            only full-strength thing in the cell: the eye
                            lands on the name, and the detail is there when
                            it goes looking. */}
                        <div className="flex items-center justify-between gap-1 leading-none" style={{ color: META_INK }}>
                          <span className="flex min-w-0 items-center gap-1">
                            <span className="shrink-0 font-plex text-[9px] font-bold tracking-tight">
                              {pick.player.pos === 'DST' ? 'DEF' : pick.player.pos}
                            </span>
                            <span className="truncate text-[9.5px] font-semibold">{pick.player.team}</span>
                            {/* A dot, not a chip — the cell has no room for
                                a labelled badge on top of everything else
                                here, but "hurt" is worth a glance even at
                                this size. Full status is one click away on
                                the profile now.
                                onMatte, not the Tailwind `dot` class beside
                                it: INJURY_META's own dots are light values
                                built for a dark panel (amber-400 on a gold
                                cell is invisible), so the map carries a
                                second, darker value for exactly this
                                surface. A dot is a mark rather than type, so
                                the bar it is solved against is 1.4.11's 3:1
                                — the one place this project uses the lower
                                one, and for the reason it already documents
                                for the board's gold ring. */}
                            {INJURY_META[pick.player.inj] && (
                              <span
                                className="h-[5px] w-[5px] shrink-0 rounded-full"
                                style={{ backgroundColor: INJURY_META[pick.player.inj].onMatte }}
                                title={INJURY_META[pick.player.inj].label}
                              />
                            )}
                            <Arrow dir={arrow} className="shrink-0 text-[9px]" />
                          </span>
                          {/* data-pick-code, not the font class it happens to
                              carry. board-card.spec.mjs used to find these by
                              `span.font-plex` on the strength of that class
                              "naming nothing else on a card" — true when the
                              code was the only mono thing in the cell, and
                              false the moment the position abbreviation
                              became mono too, which doubled the count and
                              failed a test about pick codes for a reason
                              that had nothing to do with pick codes. A test
                              anchored on markup breaks when the markup moves;
                              this attribute says what the element IS. */}
                          {code && <span data-pick-code className="shrink-0 font-plex text-[9px] font-semibold lg:text-[10px]">{code}</span>}
                        </div>
                        {/* Line 2 — the name at full ink, and the ADP gap on
                            its own side so it never competes with the name
                            for the reader's first look. */}
                        <div className="flex items-center justify-between gap-1 leading-none">
                          {/* "J. Gibbs", not "Jahmyr Gibbs". A full name in
                              a ~132px column truncated 133 of 140 times.
                              shortName() is the engine's own function, the
                              same one the hero shot uses and for the same
                              reason: an initial plus a surname reads as a
                              person where a surname alone reads as a row in
                              a table. Never re-derived here. */}
                          {/* 11.5px/700 below lg against desktop's 13px.
                              Both are the handoff's own values, and they are
                              what makes a 120px phone column hold the names
                              it was sized for: at 13px, five of twenty-five
                              real cards ellipsised — "J. Smith-Njigba" among
                              them, which is the exact name the column width
                              was measured against. */}
                          <p className="min-w-0 truncate text-[11.5px] font-bold lg:text-[13px]" title={pick.player.name}>
                            {shortNameOf ? shortNameOf(pick.player) : pick.player.name}
                          </p>
                          {gap != null && (
                            <span className="shrink-0 text-[10px] font-bold tabular-nums" style={{ color: gapText }}>
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
                        className="relative flex h-full box-border items-center justify-center rounded-md border-2 border-teal-400 bg-teal-500/20 text-[10px] font-bold uppercase tracking-wide text-teal-300"
                      >
                        {overall != null && (
                          <span className="absolute left-1 top-0.5 text-[10px] font-normal normal-case text-teal-300/75">{overall}</span>
                        )}
                        On the clock
                        <Arrow dir={arrow} className="absolute right-1 top-0.5 text-[9px] font-normal normal-case text-teal-300/75" />
                      </motion.div>
                    ) : (
                      <div className="relative h-full box-border rounded-md border border-dashed border-slate-rule">
                        {/* One value for one element. Gold measured fine
                            here (13.4:1 on near-black; the "gold never
                            paints type" rule is about light surfaces) but it
                            was saying a second time what the column's own
                            gold outline already says, in the one place a
                            reader is trying to read a number.

                            The value itself was #7C8A99 and had to move when
                            the board's ground did — this is the case that
                            proves a number tuned against near-black does not
                            survive the trip to slate. Measured: #7C8A99 is
                            5.48:1 on obsidian and 4.27:1 on #1E2733, which is
                            under the bar at 10px, and this number is the sole
                            content of its cell so it cannot be the dimmest
                            thing on screen. Nothing about the colour was
                            wrong; the ground under it moved.

                            It is `ink-soft` now rather than a third hardcoded
                            hex, and one step brighter than the `ink-muted`
                            the mobile tab bar's inactive label takes — which
                            is not an inconsistency, it is the ground. This
                            cell can carry the gold identity wash, and a wash
                            lightens what is under the type: measured, the
                            same `ink-muted` reads 5.28:1 on a bare cell, 4.48
                            on a gold one and 3.94 where a value tint sits
                            under the gold too. `ink-soft` clears 4.5 on all
                            three. `ink-muted` is safe on a plain ground and
                            not on a washed one, which is the rule to carry
                            forward rather than either number. */}
                        {overall != null && (
                          <span className="absolute left-1 top-0.5 text-[10px] text-ink-soft">
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

      {/* right-[14px] bottom-[12px], matching the handoff exactly — this
          sits over the board's own scroll container, not the dock, so it
          stays reachable however tall the dock currently is. Each end
          disables and dims rather than disappearing, which is what tells a
          reader the range has an end at all (CLAUDE.md's own two-button
          precedent for this exact control, one per direction rather than a
          single button that wraps around). */}
      {trayPos && (onTrayUp || onTrayDown) && (
        <div className="absolute bottom-3 right-3.5 z-40 hidden flex-col gap-1 lg:flex">
          <RaiseLowerButton
            onClick={onTrayUp}
            disabled={trayPos === 'raised'}
            title={trayPos === 'raised' ? 'The pool is already raised' : 'Raise the pool'}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </RaiseLowerButton>
          <RaiseLowerButton
            onClick={onTrayDown}
            disabled={trayPos === 'hidden'}
            title={trayPos === 'hidden' ? 'The pool is already closed' : 'Lower the pool'}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </RaiseLowerButton>
        </div>
      )}
    </div>
  )
}
