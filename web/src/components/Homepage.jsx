import { useEffect, useState } from 'react'
import Header from './Header.jsx'
import Hero from './Hero.jsx'
import TakeAPick from './TakeAPick.jsx'
import ShowYourWorking from './ShowYourWorking.jsx'
import RoomsGrid from './RoomsGrid.jsx'
import ClosingCta from './ClosingCta.jsx'
import JukeLogo from './juke-logo/JukeLogo.jsx'
import { freshnessLine } from './dataFreshness.js'

// METHOD footer links deep-link into the existing how-it-works doc rather
// than to new pages that don't exist — s02 is "Where the numbers come
// from" (data sources), s03 is "The league, and everything that follows
// from it" (scoring), s07 is "The three signals on a player" (the Juke
// score section — VORP). One doc, three real entry points, instead of
// three pages with nothing behind them.
const METHOD_LINKS = [
  { label: 'How scoring works', href: '/docs/draft-room-how-it-works.html#s03' },
  { label: 'VORP explained', href: '/docs/draft-room-how-it-works.html#s07' },
  { label: 'Data sources', href: '/docs/draft-room-how-it-works.html#s02' },
]

function useRoomLinks() {
  const [rooms, setRooms] = useState([])
  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return
    setRooms(engine.rooms())
  }, [])
  return rooms
}

// The footer's closing line (design_handoff_mobile Prompt 2): "N players
// tracked · updated <relative time>". Neither half is invented. The count
// is board.length itself — CLAUDE.md is explicit that a player count has to
// be derived, never a literal like "225" quoted once and left to drift as
// the nightly pipeline changes the board. The "updated" half reads the real
// ?v= stamp off the page's own <script src="/app.js?v=YYYYMMDDHHMM">: that
// stamp is the UTC minute update-players.yml last actually changed the
// data (it only bumps it on a day the feeds moved), already the mechanism
// this whole app leans on for cache-busting — not a second, invented
// timestamp. Formatted relative to the reader's own clock, never printed as
// a raw UTC string, per the review item this line cites.
function useDataFreshness() {
  const [freshness, setFreshness] = useState(null)

  // One line, from dataFreshness.js, which is also exactly what Ticker.jsx
  // renders in the header. This used to derive its own answer from the `?v=`
  // query on app.js's script tag, and the two disagreed by eleven hours on the
  // same page — "refreshed 17 hrs ago" above, "updated 6 hours ago" below. See
  // that file for why the pipeline stamp is the right source and a deploy
  // marker is not.
  useEffect(() => {
    setFreshness(freshnessLine())
  }, [])

  return freshness
}

export default function Homepage() {
  const roomLinks = useRoomLinks()
  const freshness = useDataFreshness()
  const liveRoomLinks = roomLinks.filter((room) => room.live && room.href)

  return (
    <div className="min-h-screen overflow-x-hidden bg-void text-white">
      <Header />

      {/* The fixed header is just its nav row now — the status strip that
          used to sit under it (h-8 + 1px border) was removed as redundant.
          pt-14/pt-16 matches Header.jsx's own h-14/h-16 exactly, which is
          why this can be the Tailwind scale rather than an arbitrary value
          with arithmetic in a comment: there's nothing left to add to it.
          index.css's scroll-padding-top tracks the same two heights, plus
          its own 8px of anchor-scroll slack — see the comment there. */}
      <main className="pt-14 md:pt-16">
        <Hero />
        <TakeAPick />
        <ShowYourWorking />
        <RoomsGrid />
        <ClosingCta />
      </main>

      <footer className="border-t border-white/[0.07] bg-[#060909]">
        {/* ---------- Mobile footer (revised handoff, PROMPT 2 item 6) ----
            Desktop's tagline verbatim, then its own three link columns as a
            two-up grid, then the shared freshness line below.

            It replaced a single wrapped row — "Draft Room · How it works ·
            Method · Privacy · Terms" — built from the first handoff's mock.
            The revision asks for the columns, and it is right for a reason the
            flat row made easy to miss: that row collapsed METHOD's three
            destinations into one link labelled "Method", so two real pages
            (VORP explained, Data sources) had no way in on a phone at all. A
            footer whose whole documented job is "live destinations only" was
            hiding two of them.

            Same liveRoomLinks and METHOD_LINKS arrays the desktop grid below
            reads, so neither breakpoint can list a destination the other
            doesn't — which is the failure this whole pass is chasing. */}
        <div className="px-6 pb-6 pt-12 lg:hidden">
          <JukeLogo size={18} />
          <p className="mt-[14px] max-w-[300px] text-sm leading-[1.55] text-[#7d888f]">
            Agility through analytics. Projections you can follow, rebuilt every morning.
          </p>

          {/* Each link is flex + min-h-[44px] rather than the gap-[11px]
              column spacing alone providing separation — measured at 20px
              (the bare text-sm line height) during homepage v4 pass 3's
              tap-target audit, which is what §9 means naming "footer
              links" specifically. The column's own gap drops to 0 so the
              links' own padding is what separates them, rather than
              stacking on top of it and pushing the footer taller than it
              needs to be. Desktop's footer (below) keeps its original
              gap-[11px]/no-padding links — §9's 44px floor is a mobile
              requirement, not a desktop one, and mouse-driven nav doesn't
              need it. */}
          {/* ROOMS is its own full-width row rather than a third grid-cols-2
              cell alongside METHOD and COMPANY — a CSS grid row sizes to its
              tallest cell, and ROOMS (one live room today) shares a row with
              METHOD (three links) in that layout. That left the ROOMS cell
              stretched to METHOD's height with nothing in the bottom of it,
              which reads as a gap between the Rooms and Company groups
              because COMPANY (row 2) doesn't start until the row METHOD
              dictated finishes — reported directly from a real mobile
              screenshot. METHOD and COMPANY keep the 2-column grid below:
              three links each, so they size the same row without a mismatch
              to hide. This is a structural fix, not a spacing tweak — the
              gap was never a margin/padding value to shrink. */}
          <div className="mt-7 flex flex-col">
            <span className="font-plex text-[11px] tracking-[0.11em] text-[#8e9aa1]">ROOMS</span>
            {liveRoomLinks.map((room) => (
              <a key={room.name} href={room.href} className="flex min-h-[44px] items-center text-sm text-white/60">
                {room.name}
              </a>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6">
            <div className="flex flex-col">
              <span className="font-plex text-[11px] tracking-[0.11em] text-[#8e9aa1]">METHOD</span>
              {METHOD_LINKS.map((link) => (
                <a key={link.label} href={link.href} className="flex min-h-[44px] items-center text-sm text-white/60">
                  {link.label}
                </a>
              ))}
            </div>

            <div className="flex flex-col">
              <span className="font-plex text-[11px] tracking-[0.11em] text-[#8e9aa1]">COMPANY</span>
              <a href="/docs/draft-room-how-it-works.html" className="flex min-h-[44px] items-center text-sm text-white/60">How it works</a>
              <a href="/docs/privacy.html" className="flex min-h-[44px] items-center text-sm text-white/60">Privacy</a>
              <a href="/docs/terms.html" className="flex min-h-[44px] items-center text-sm text-white/60">Terms</a>
            </div>
          </div>
        </div>

        <div className="hidden max-w-7xl grid-cols-2 gap-12 px-6 pb-6 pt-14 sm:grid-cols-4 lg:mx-auto lg:grid">
          <div className="col-span-2 sm:col-span-1">
            <JukeLogo size={18} />
            <p className="mt-[14px] max-w-[300px] text-sm leading-[1.55] text-[#7d888f]">
              Agility through analytics. Projections you can follow, rebuilt every morning.
            </p>
          </div>

          <div className="flex flex-col gap-[11px]">
            <span className="font-plex text-[11px] tracking-[0.11em] text-[#8e9aa1]">ROOMS</span>
            {/* Live rooms only — a design review pointed out that five of
                these six links went nowhere of their own: every "coming
                soon" room fell back to the same #rooms anchor, so five
                differently-named links all did the identical thing. The
                grid below #rooms is still the honest place to see what's
                on the way; the footer now only promises destinations that
                actually exist. */}
            {liveRoomLinks.map((room) => (
              <a
                key={room.name}
                href={room.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {room.name}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-[11px]">
            <span className="font-plex text-[11px] tracking-[0.11em] text-[#8e9aa1]">METHOD</span>
            {METHOD_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-[11px]">
            <span className="font-plex text-[11px] tracking-[0.11em] text-[#8e9aa1]">COMPANY</span>
            {/* Real links only. Privacy and Terms already exist; About,
                Changelog and Contact don't have anywhere real to point yet,
                so they're left out rather than pointing at nothing. */}
            <a href="/docs/draft-room-how-it-works.html" className="text-sm text-white/60 transition-colors hover:text-white">
              How it works
            </a>
            <a href="/docs/privacy.html" className="text-sm text-white/60 transition-colors hover:text-white">
              Privacy
            </a>
            <a href="/docs/terms.html" className="text-sm text-white/60 transition-colors hover:text-white">
              Terms
            </a>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-white/5 px-6 py-5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-6">
          {/* The old, unqualified "nothing you draft is sent anywhere" was
              wrong the moment a room exists — the room worker holds the
              seats, the picks and the chat while it's open, and
              draft-room-how-it-works.html already scopes the claim
              correctly (section 01, section 08). This says the same true
              thing the docs say, not a second, looser one. */}
          <p className="text-[13px] text-[#8e9aa1]">
            A solo mock draft runs entirely in your browser — nothing you draft is sent anywhere.
            Drafting with your league uses a server, just for that room.
          </p>
          <span className="font-plex text-xs text-[#8e9aa1]">© 2026 Juke</span>
        </div>

        {/* The footer's one static closing line — see useDataFreshness()
            above for where both numbers actually come from. Renders
            nothing until window.JukeEngine has answered (same
            fails-by-disappearing contract as the score strip), rather than
            a placeholder that would flash a wrong count for one frame. */}
        {freshness && (
          // pr-[76px] below lg, not the uniform px-6 every other footer row
          // uses: style.css's own .to-top button floats at right:18px,
          // width 44px — a ~62px circle this is the one line on the page
          // long enough to actually reach. Every other footer row here is
          // short enough it never got there; this is the last line on the
          // page and reads as "long enough to challenge the corner" the
          // moment a phone's width is narrow enough to bring the two close.
          <div className="mx-auto max-w-7xl px-6 pb-6 pr-[76px] lg:pr-6">
            <p className="font-plex text-xs text-[#8e9aa1]">{freshness}</p>
          </div>
        )}
      </footer>
    </div>
  )
}
