import { useRooms } from '../hooks/useRooms.js'

/* The room cards, written once for the two screens that draw them: the
   Rooms lobby (#/rooms) and the homepage's own THE ROOMS section. The
   handoff draws the identical grid in both (2ag against 2bg, 3ag against
   3bg), and a second copy would drift the first time a card changed --
   which is the same rule ROOMS itself follows one layer down.

   Content is all read off ROOMS through window.JukeEngine.rooms(). This
   file decides layout and nothing else.

   ---- The Prospect Room ----

   The handoff's own lobby draws four locked rooms and never mentions
   Prospect; the app has advertised six since the homepage grid shipped.
   Dropping a room from the site is a product decision and a bigger one
   than adding a card, so all five locked rooms render and the grid takes
   a fifth cell rather than the mock's four.

   ---- Every card is a link, locked ones included ----

   The handoff's own interaction rule: "Locked card tap (guest) -> same
   room, showing the locked preview (not a modal)." A card that opens a
   dialog instead of the room answers a question the reader did not ask
   and takes away the preview that is the entire pitch. A room with no
   `slug` yet has no page to open and renders as a plain card. */

function LeadCard({ room }) {
  return (
    <a
      href={room.href || (room.slug ? `#/rooms/${room.slug}` : undefined)}
      className={
        /* Full width on a phone, an ordinary cell on a desktop. Both are the
           handoff's: every mobile screen gives the lead card
           `grid-column:1/-1` (2ag/2au/2bg/2bu) and no desktop screen does
           (3ag/3au/3bg/3bu). At two columns a wide lead is what makes the
           open room read as the one you can actually use; at three or five
           there is room to say that with the cyan wash alone. */
        'col-span-2 flex items-center gap-3.5 rounded-2xl border border-line-hairline p-4 transition-colors duration-150 hover:border-teal/40 sm:p-5 lg:col-span-1 lg:flex-col lg:items-start lg:justify-between lg:gap-0 lg:min-h-[150px]'
      }
      style={{ background: `linear-gradient(120deg, ${room.accent}1A, transparent 60%), #151920` }}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[18px]"
        style={{ background: '#0f2e34', color: room.accent }}
        aria-hidden="true"
      >
        {room.glyph}
      </span>
      <span className="min-w-0 flex-1 lg:flex-none">
        <span className="block font-mono text-[10px] tracking-[0.1em]" style={{ color: room.accent }}>
          FREE · {room.season.toUpperCase()}
        </span>
        <span className="mt-[3px] block font-display text-[22px] font-bold leading-[1.05] text-white">
          {room.name}
        </span>
        {/* The same two-line box the locked cards give their hook, and
            for the same reason: these blocks are bottom-anchored, so a card
            whose sub-line wraps to two pushes its own title up relative to
            one whose does not. Measured 3 Sep 2026 on the homepage's
            five-across strip at 1440 -- 246px cells, three hooks wrapping
            and two not, titles spread over 18px. `min-h` in em rather than
            px because the size steps 12 -> 13 at `sm` and em follows it. */}
        <span className="mt-0.5 block truncate text-[13px] leading-[1.35] text-ink-muted lg:mt-1 lg:line-clamp-2 lg:min-h-[2.7em] lg:whitespace-normal">
          {room.lead}
        </span>
      </span>
      {/* The chevron is the phone row's own affordance — a wide row with a
          tile, a name and nothing at the end reads as unfinished. A card in
          a grid does not need one, and none of the desktop screens draws
          it. */}
      <span className="shrink-0 text-ink-muted lg:hidden" aria-hidden="true">›</span>
    </a>
  )
}

function LockedCard({ room, wide = false }) {
  const inner = (
    <>
      <span
        className="grid h-10 w-10 place-items-center rounded-xl bg-flow-tile text-[18px] text-ink-muted"
        aria-hidden="true"
      >
        {room.glyph}
      </span>
      {/* Eyebrow, then title, then the hook -- the same three in the same
          order as LeadCard, because the two sit in one row and every card
          here anchors its text block to the BOTTOM (`justify-between` under
          a fixed min-height). Bottom-anchored blocks whose contents run in
          different orders land their titles at different heights: measured
          3 Sep 2026 on #/rooms at 1440, "The Draft Room" sat 30px below
          "Waiver Room" and "Trade Room" beside it. Nothing was wrong with
          either card on its own.

          Which means the margins and line-heights below have to match
          LeadCard's too, and a change to one of them is a change to both. */}
      <span>
        <span className="block font-mono text-[10px] tracking-[0.1em] text-ink-muted">
          <span aria-hidden="true">🔒</span> {room.season.toUpperCase()}
        </span>
        <span className="mt-[3px] block font-display text-[20px] font-bold leading-[1.05] text-white sm:text-[22px]">
          {room.name.replace(/^The /, '')}
        </span>
        {/* No `block` here: `line-clamp-*` works by setting
            `display:-webkit-box`, and a `block` in the same layer wins and
            silently leaves the clamp doing nothing -- confirmed on the
            built page, where the computed style read
            `-webkit-line-clamp: 2` beside `display: block` and the Waiver
            hook ran to three lines anyway.

            Three lines below `sm` and two above it, because that is what
            the card is actually wide enough for: at 375px a 2-col cell
            gives the hook ~144px and it wraps to three. The reserve is
            what keeps every title in a row on one baseline; the clamp is
            the guard for a hook longer than the reserve. */}
        <span className="mt-0.5 text-[12px] leading-[1.35] line-clamp-3 min-h-[4.05em] text-ink-muted sm:text-[13px] sm:line-clamp-2 sm:min-h-[2.7em] lg:mt-1">
          {room.hook}
        </span>
      </span>
    </>
  )

  const cls =
    'relative flex min-h-[124px] flex-col justify-between overflow-hidden rounded-2xl border border-line-hairline bg-[#151920] p-4 transition-colors duration-150 sm:min-h-[150px] sm:p-5' +
    (wide ? ' col-span-2 lg:col-span-1' : '')

  if (!room.slug) return <div className={cls}>{inner}</div>
  return (
    <a href={`#/rooms/${room.slug}`} className={cls + ' hover:border-white/20'}>
      {inner}
    </a>
  )
}

/* `columns` is the one thing the two hosts disagree about, and they really
   do: the homepage draws its rooms as a single five-across strip
   (3ag/3au, `repeat(5,1fr)`) and the lobby as a three-column grid
   (3bg/3bu, `repeat(3,1fr)`). Below `lg` both are two columns. A prop
   rather than two components, because everything else about a card is
   identical and a second copy would drift. */
const COLUMNS = {
  home: 'lg:grid-cols-5',
  lobby: 'lg:grid-cols-3',
}

export default function RoomsGridAlive({ columns = 'lobby' }) {
  const rooms = useRooms()
  const lead = rooms.filter((r) => r.live)
  const locked = rooms.filter((r) => !r.live)

  /* Five locked rooms in a two-column grid leaves the last one alone in
     its own row, which reads as a card that failed to load rather than
     as the end of a list. The last card spans the row when the count is
     odd, at the one breakpoint where the count is odd: three columns
     divide five as 3+2, which needs no help. */
  const oddOut = locked.length % 2 === 1

  return (
    <div className={'grid grid-cols-2 gap-2.5 lg:gap-3 ' + (COLUMNS[columns] || COLUMNS.lobby)}>
      {lead.map((r) => <LeadCard key={r.name} room={r} />)}
      {locked.map((r, i) => (
        <LockedCard key={r.name} room={r} wide={oddOut && i === locked.length - 1} />
      ))}
    </div>
  )
}
