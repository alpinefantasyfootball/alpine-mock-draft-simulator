import AppShell from './shell/AppShell.jsx'
import { useRooms } from '../hooks/useRooms.js'

/* #/rooms — design_handoff_v3_alive screens 2bg/2bu (mobile) and 3bg/3bu
   (desktop).

   The rooms were a section on the homepage and a dropdown in the header.
   This makes them a destination, which is what the handoff's nav is built
   around, and it is why RoomsNavMenu's season-grouped dropdown retires with
   the old header: a menu listing the same six rooms one click before the
   page that lists them is a second copy of this screen.

   Every card is read off ROOMS through window.JukeEngine.rooms(), so a room
   is still written down exactly once (app.js). What this file decides is
   layout, not content — the name, lead, hook, glyph, accent and whether the
   room is live all arrive from there.

   ---- The Prospect Room ----

   The handoff's own lobby draws four locked rooms and never mentions
   Prospect at all; the app has advertised six since the homepage grid
   shipped. Dropping a room from the site is a product decision and a
   bigger one than adding a card, so all five locked rooms render here and
   the grid takes a fifth cell rather than the mock's four. Nothing else
   about the card changes.

   ---- The lead card is a link and the rest are too ----

   All of them, including the locked ones, and that is the handoff's own
   interaction rule: "Locked card tap (guest) → same room, showing the
   locked preview (not a modal)." A card that opens a dialog instead of the
   room answers a question the reader did not ask and takes away the preview
   that is the entire pitch. A room with no `slug` yet is the one exception
   — it has no page to open, so it renders as a plain card. */

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

export default function RoomsLobby() {
  const rooms = useRooms()
  const lead = rooms.filter((r) => r.live)
  const locked = rooms.filter((r) => !r.live)

  /* Five locked rooms in a two-column grid leaves the last one alone in
     its own row, which reads as a card that failed to load rather than as
     the end of a list. The handoff never meets this because its own lobby
     draws four — see the Prospect note above. The last card spans the row
     when the count is odd, at the one breakpoint where the count is odd:
     three columns divide five as 3+2, which needs no help. */
  const oddOut = locked.length % 2 === 1

  return (
    <AppShell active="rooms">
      <div className="mx-auto max-w-[1280px] px-5 pt-[22px] sm:px-10 sm:pt-10">
        <div className="mb-3.5 flex items-center gap-3">
          <span className="text-[26px] sm:text-[30px]" aria-hidden="true">🚪</span>
          <h1 className="m-0 font-display text-[30px] font-extrabold uppercase italic text-white sm:text-[44px]">
            The Rooms
          </h1>
        </div>

        {/* The shark says what the screen is for. It is a speech bubble
            rather than a paragraph because the alternative — a line of grey
            body copy under the H1 — is the thing every marketing page does
            and the thing a reader skips. */}
        <div className="mb-4 flex items-end gap-2.5 sm:mb-6 sm:max-w-[640px]">
          <img src="/juke-shark-mark.svg" alt="" className="h-14 w-14 shrink-0 object-contain" />
          <p className="m-0 flex-1 rounded-[14px_14px_14px_4px] border border-flow-pillEdge bg-flow-pill px-3.5 py-[11px] text-[14px] leading-[1.45] text-voidInk-primary">
            Draft Room is open. The rest unlock when you connect a league — peek inside any of them.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-4">
          {lead.map((r) => <LeadCard key={r.name} room={r} />)}
          {locked.map((r, i) => (
            <LockedCard
              key={r.name}
              room={r}
              wide={oddOut && i === locked.length - 1}
            />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
