import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Search, Star } from 'lucide-react'
import { POS_BADGE, POS_LIST } from './draftRoomPositions.js'
import JukeValueAssistant from './JukeValueAssistant.jsx'

function formatAdp(adp) {
  return typeof adp === 'number' && Number.isFinite(adp) ? adp.toFixed(1) : null
}

// FLEX sits after the four skill positions and before K/DST, matching
// SLOT_ORDER in app.js — the same ordering a roster fills them in.
const FILTERS = ['ALL', ...POS_LIST, 'FLEX', 'K', 'DST']

// Desktop only (lg+) — five columns, not six: the star toggle used to be
// its own 20px column, but the mobile card layout below needs star +
// headshot + badge + name in one flex block to stack sensibly, so that
// block became the grid's first column instead of two separate ones. It
// looks identical on desktop either way, since the star always sat flush
// against the player info regardless.
//
// 40/44/32px for ADP/Proj Pts/Value, not 52/60/56 — measured against the
// panel's actual natural width (~399px, the 70/30 board/queue split at a
// typical ~1345px window), the four fixed columns plus their gaps were
// consuming 272px, leaving the first column only 64px total — less than
// star+headshot+badge needed on their own (114px), before any name text at
// all. These three only ever hold short numbers ("199.0", "142.1", "26"),
// so they didn't need their old width; freed 52px this way. The other 46px
// came from moving the position badge onto the headshot itself as a corner
// chip instead of an inline flex sibling (see the headshot block below) —
// between the two, the name column's real budget roughly doubled.
//
// minmax(120px, 1fr), not minmax(0, 1fr): a 0-floor fr track can shrink all
// the way to nothing once the fixed columns plus the row's own padding eat
// the available width — measured, at a narrowed-but-still-lg+ browser
// window, the player-info column actually hit width:0 and the whole first
// column disappeared outright. Same shape of bug as the header round/pick
// text collapsing a few passes back, same fix: a real floor. 120px now
// covers the star, the headshot and a few characters of name comfortably —
// it's close to this column's own natural width at the panel's typical
// size, not fighting it the way the old 232px-of-fixed-columns version was.
const GRID_COLS = 'lg:grid lg:grid-cols-[minmax(120px,1fr)_40px_44px_32px_64px] lg:items-center lg:gap-2.5'

// One header per sortable column, in the same left-to-right order as
// GRID_COLS. `dir` is which direction reads as "best first" on the very
// first click of a column that wasn't already active — ascending for ADP
// (pick 1 is the best ADP), descending for points and Value (more is
// better) — same convention a spreadsheet uses for a first sort.
export const SORT_COLUMNS = [
  { key: 'adp', label: 'ADP', dir: 'asc' },
  { key: 'pts', label: 'Proj Pts', dir: 'desc' },
  { key: 'value', label: 'Value', dir: 'desc' },
]

// Derived rather than a second hand-written copy, so DraftRoom.jsx (which
// owns the actual sort — see its handleSort) always agrees with the column
// definitions drawn here about which direction "first click" means.
export const SORT_DEFAULT_DIR = Object.fromEntries(SORT_COLUMNS.map((c) => [c.key, c.dir]))

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
  onPosFilter,
  pointsFor,
  valueFor,
  photoFor,
  initialsFor,
  onDraft,
  myTurn,
  queuedNames,
  onToggleQueue,
  onSelectPlayer,
  sortBy,
  sortDir,
  onSort,
  recommended,
  recommendedVorp,
  recommendedTierLeft,
}) {
  return (
    // Sizing against the board+queue row (flex-1, lg:flex-[3], lg:min-w) now
    // lives on the relative wrapper DraftRoom.jsx puts around this and
    // PlayerProfileDrawer — this fills that wrapper rather than sizing
    // itself against the row a second time.
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900/40">
      <div className="shrink-0 space-y-3 border-b border-slate-800 p-4">
        {/* Replaces the old plain "Juke AI Draft Assistant" label — this
            is that framing with an actual real recommendation behind it
            now, not just a caption over the search box. */}
        <JukeValueAssistant
          player={recommended}
          vorp={recommendedVorp}
          tierLeft={recommendedTierLeft}
          onDraft={onDraft}
          myTurn={myTurn}
          photoFor={photoFor}
          initialsFor={initialsFor}
        />
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
            </button>
          ))}
        </div>

        {!myTurn && (
          <p className="text-[10px] leading-relaxed text-white/30">
            Draft is disabled until it's your turn.
          </p>
        )}
      </div>

      {/* pb-28 below lg clears RosterDock's fixed collapsed strip plus
          DraftLogDock's own collapsed corner pill (bottom-12 there now —
          see its comment); lg:pb-64 is the original clearance for
          DraftLogDock expanded in a corner, where RosterDock is back in
          normal flow and never overlaps this list at all. */}
      <div className="flex-1 overflow-y-auto p-3 pb-28 lg:pb-64">
        {/* Column headers — desktop (lg+) only, and now a child of this
            same scroll container rather than a sibling above it. It used
            to sit outside, against the panel's own edges, while every row
            sits inside this container's p-3 padding *and* loses width to
            its scrollbar — two things a header outside never accounted
            for. Measured: the row's own available grid width came out 39px
            narrower than the header's (399px vs 360px), so every column
            after the first drifted left of where its header sat, worst at
            Value/Draft where the numbers read as touching the button.
            Sticky, inside the same container, guarantees byte-identical
            width and can't drift again regardless of scrollbar or padding
            changes — it's not just visually pinned while scrolling, that
            part's a side effect of the real fix. */}
        <div className={GRID_COLS + ' sticky top-0 z-10 hidden -mt-3 mb-2 border-b border-slate-800 bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/30'}>
          <span>Player</span>
          {SORT_COLUMNS.map((col) => {
            const active = sortBy === col.key
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => onSort(col.key)}
                className={
                  'flex items-center justify-end gap-0.5 transition-colors duration-150 ' +
                  (active ? 'text-teal-300' : 'hover:text-white/60')
                }
              >
                {col.label}
                {active ? (
                  sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                ) : null}
              </button>
            )
          })}
          <span />
        </div>

        <AnimatePresence initial={false}>
          {players.map((player) => {
            const pts = pointsFor(player)
            const adp = formatAdp(player.adp)
            const value = valueFor(player)
            const photo = photoFor(player)
            const queued = queuedNames.has(player.name)
            return (
              <motion.div
                key={player.id || player.name}
                layoutId={'player-' + (player.id || player.name)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 32, scale: 0.94, transition: { duration: 0.28 } }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                onClick={() => onSelectPlayer(player)}
                // gap-2 is the mobile flex-col spacing between the two
                // stacked card lines; GRID_COLS' own lg:gap-2.5 is meant to
                // take over at lg+ for the real column gutters. An earlier
                // `lg:gap-0` here was meant to cancel gap-2 at lg+ and
                // instead cancelled GRID_COLS' lg:gap-2.5 too — both are
                // `lg:` variants setting the same `gap` property, and
                // Tailwind's class order (not the order written here)
                // decided which won. Measured: computed gap was 0px on the
                // row, 10px on the header, so every column after the first
                // drifted left of where its header sat, worst at Value/
                // Draft where it read as the two touching. No lg: override
                // needed at all — GRID_COLS' lg:gap-2.5 already wins over
                // the base gap-2 through ordinary cascade once `lg:grid`
                // is what's actually laying the row out.
                className={GRID_COLS + ' mb-2 flex cursor-pointer flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5 transition-colors duration-150 hover:border-slate-700'}
              >
                {/* Star + headshot + badge + name/team, one flex block —
                    this is both the mobile card's whole first line and the
                    desktop grid's first column, the same DOM either way
                    (see the comment on GRID_COLS). stopPropagation on the
                    star: a click anywhere else in the row opens the
                    profile drawer, per the "anywhere except Draft" spec,
                    and the star toggle is the same kind of row-local
                    action Draft already is. */}
                {/* overflow-hidden: without it, this row's own children
                    (star + headshot + the fixed-width badge below all
                    have shrink-0, so they never give up their space) can
                    demand more width than a narrowed browser window
                    leaves for this column, and a flex container doesn't
                    clip an overflow on its own — the excess bled visibly
                    into the ADP column next to it instead of stopping at
                    this block's own edge. */}
                <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleQueue(player.name) }}
                    title={queued ? 'Remove from your queue' : 'Add to your queue'}
                    className="shrink-0 text-white/25 transition-colors duration-150 hover:text-amber-300"
                  >
                    <Star className={'h-4 w-4 ' + (queued ? 'fill-amber-300 text-amber-300' : '')} />
                  </button>

                  {/* Real headshot when the board has one (sleepercdn, via
                      the same photoUrl() avatar() already calls) — the
                      slate-800 circle is only ever seen as the loading
                      state or the fallback, never a stand-in drawn for
                      everyone. A broken image removes itself the same way
                      the legacy avatar's data-drop-on-error does, revealing
                      the initials already sitting behind it.

                      The position badge used to sit inline after this as
                      its own flex sibling — a fixed w-9 kept it from
                      pushing the name to a different x per row (see the
                      GRID_COLS comment for why that mattered), but it also
                      cost every row 46px (36 for the badge + a 10px gap)
                      that the name column couldn't get back. A corner chip
                      on the avatar reads the position just as clearly and
                      costs the row nothing — it's positioned off the
                      circle, not next to it. The outer wrapper (not the
                      avatar circle itself, which stays overflow-hidden for
                      the photo) is what the chip is absolutely positioned
                      against, so it can hang over the circle's edge
                      instead of being clipped by it. */}
                  <div className="relative shrink-0">
                    <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-[9px] font-bold text-white/40">
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
                    <p className="truncate text-sm font-medium text-white/90">{player.name}</p>
                    <p className="truncate text-[11px] text-white/40">{player.team}</p>
                  </div>
                </div>

                {/* Desktop-only columns (lg+): ADP, Proj Pts, Value, and
                    the small Draft pill — replaced below lg by one summary
                    line and a full-size Draft button, not stacked six
                    values high the way a literal reflow of these five
                    would read. */}
                <span className="hidden text-right text-xs font-medium text-white/60 tabular-nums lg:block">
                  {adp || '—'}
                </span>
                <span className="hidden text-right text-xs font-medium text-white/60 tabular-nums lg:block">
                  {pts != null ? pts.toFixed(1) : '—'}
                </span>
                {/* This is overallScore() — the "Juke score" used everywhere
                    else on the site, points above replacement as a share of
                    the best such figure on the board. There is no expert-
                    consensus feed in this pipeline (see CLAUDE.md's Data
                    section: Sleeper + FFC ADP only), so this column reads
                    "Value" rather than a variance-from-consensus stat we
                    have no real source for. */}
                <span className="hidden text-right text-xs font-semibold text-teal-400/90 tabular-nums lg:block">
                  {value != null ? Math.round(value) : '—'}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDraft(player) }}
                  disabled={!myTurn}
                  title={myTurn ? undefined : "Not your turn"}
                  className={
                    // lg:flex here is purely a display toggle (this button
                    // only exists at lg+ — see GRID_COLS), but display:flex
                    // has its own default alignment (flex-start/flex-start,
                    // not centered) unlike a plain button's normal text
                    // flow, which centers "Draft" for free. Same bug shape
                    // as the sticky header a moment ago: a class added for
                    // one reason (visibility) silently changed something
                    // else (alignment) it was never meant to touch.
                    'hidden shrink-0 items-center justify-center rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-200 lg:flex ' +
                    (myTurn
                      ? 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-glass hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                      : 'cursor-not-allowed bg-white/5 text-white/25')
                  }
                >
                  Draft
                </button>

                {/* Below lg only: one compact summary line plus a full h-12
                    Draft button — the whole point of this pass is a button
                    a thumb can hit without looking twice, not the same
                    24px pill the desktop grid uses. */}
                <div className="flex items-center gap-2 pl-[42px] lg:hidden">
                  <p className="min-w-0 flex-1 truncate text-[11px] text-white/40">
                    {adp && <span>ADP {adp}</span>}
                    {pts != null && <span> · {pts.toFixed(1)} pts</span>}
                    {value != null && <span> · Value {Math.round(value)}</span>}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDraft(player) }}
                    disabled={!myTurn}
                    title={myTurn ? undefined : 'Not your turn'}
                    className={
                      'flex h-12 shrink-0 items-center justify-center rounded-lg px-6 text-sm font-bold transition-all duration-200 ' +
                      (myTurn
                        ? 'bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-white shadow-glass active:scale-95'
                        : 'cursor-not-allowed bg-white/5 text-white/25')
                    }
                  >
                    Draft
                  </button>
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
  )
}
