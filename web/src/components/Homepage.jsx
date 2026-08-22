import { useEffect, useState } from 'react'
import Header from './Header.jsx'
import Hero from './Hero.jsx'
import ShowYourWorking from './ShowYourWorking.jsx'
import RoomsGrid from './RoomsGrid.jsx'
import ClosingCta from './ClosingCta.jsx'
import JukeLogo from './juke-logo/JukeLogo.jsx'

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

export default function Homepage() {
  const roomLinks = useRoomLinks()

  return (
    <div className="min-h-screen overflow-x-hidden bg-void text-white">
      <Header />

      {/* pt-[108px] matches the fixed header's real height (h-16 nav + h-9
          ticker + 1px border = 101px) plus the same few px of breathing
          room index.css's scroll-padding-top uses — one number instead of
          two, so a page load and an anchor click land at the same offset. */}
      <main className="pt-[108px]">
        <Hero />
        <ShowYourWorking />
        <RoomsGrid />
        <ClosingCta />
      </main>

      <footer className="border-t border-white/[0.07] bg-[#060909]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-12 px-6 pb-6 pt-14 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <JukeLogo size={18} />
            <p className="mt-[14px] max-w-[300px] text-sm leading-[1.55] text-[#7d888f]">
              Agility through analytics. Projections you can follow, rebuilt every morning.
            </p>
          </div>

          <div className="flex flex-col gap-[11px]">
            <span className="font-plex text-[11px] tracking-[0.11em] text-[#4f5b62]">ROOMS</span>
            {/* Live rooms only — a design review pointed out that five of
                these six links went nowhere of their own: every "coming
                soon" room fell back to the same #rooms anchor, so five
                differently-named links all did the identical thing. The
                grid below #rooms is still the honest place to see what's
                on the way; the footer now only promises destinations that
                actually exist. */}
            {roomLinks.filter((room) => room.live && room.href).map((room) => (
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
            <span className="font-plex text-[11px] tracking-[0.11em] text-[#4f5b62]">METHOD</span>
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
            <span className="font-plex text-[11px] tracking-[0.11em] text-[#4f5b62]">COMPANY</span>
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

        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 border-t border-white/5 px-6 py-5">
          {/* The old, unqualified "nothing you draft is sent anywhere" was
              wrong the moment a room exists — the room worker holds the
              seats, the picks and the chat while it's open, and
              draft-room-how-it-works.html already scopes the claim
              correctly (section 01, section 08). This says the same true
              thing the docs say, not a second, looser one. */}
          <p className="text-[13px] text-[#656f76]">
            A solo mock draft runs entirely in your browser — nothing you draft is sent anywhere.
            Drafting with your league uses a server, just for that room.
          </p>
          <span className="font-plex text-xs text-[#4f5b62]">© 2026 Juke</span>
        </div>
      </footer>
    </div>
  )
}
