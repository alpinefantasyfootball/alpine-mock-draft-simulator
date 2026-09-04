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
      className="col-span-full flex items-center gap-3.5 rounded-2xl border border-line-hairline p-4 transition-colors duration-150 hover:border-teal/40 sm:gap-4 sm:p-5"
      style={{ background: `linear-gradient(120deg, ${room.accent}1A, transparent 60%), #151920` }}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[18px]"
        style={{ background: '#0f2e34', color: room.accent }}
        aria-hidden="true"
      >
        {room.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] tracking-[0.1em]" style={{ color: room.accent }}>
          FREE · {room.season.toUpperCase()}
        </span>
        <span className="mt-[3px] block font-display text-[22px] font-bold leading-[1.05] text-white">
          {room.name}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-muted">{room.lead}</span>
      </span>
      <span className="shrink-0 text-ink-muted" aria-hidden="true">›</span>
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
      <span>
        <span className="block font-display text-[20px] font-bold text-white sm:text-[22px]">
          {room.name.replace(/^The /, '')}
        </span>
        <span className="mt-[3px] block font-mono text-[10px] tracking-[0.1em] text-ink-muted">
          <span aria-hidden="true">🔒</span> {room.season.toUpperCase()}
        </span>
        <span className="mt-1.5 block text-[12px] leading-[1.35] text-ink-muted sm:text-[13px]">
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

export default function RoomsGridAlive() {
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
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-4">
      {lead.map((r) => <LeadCard key={r.name} room={r} />)}
      {locked.map((r, i) => (
        <LockedCard key={r.name} room={r} wide={oddOut && i === locked.length - 1} />
      ))}
    </div>
  )
}
