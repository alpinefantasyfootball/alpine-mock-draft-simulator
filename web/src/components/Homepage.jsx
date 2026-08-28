import { useEffect, useRef, useState } from 'react'
import { Apple, PlaySquare } from 'lucide-react'
import Header from './Header.jsx'
import Hero from './Hero.jsx'
import TakeAPick from './TakeAPick.jsx'
import ShowYourWorking from './ShowYourWorking.jsx'
import RoomsGrid from './RoomsGrid.jsx'
import ClosingCta from './ClosingCta.jsx'
import JukeLogo from './juke-logo/JukeLogo.jsx'
import ComingSoonModal from './ComingSoonModal.jsx'
import { freshnessLine } from './dataFreshness.js'

// METHOD is Juke's own real content — three sections of one doc plus the
// doc's own top, the same four destinations the footer has carried since
// before this pass.
const METHOD_LINKS = [
  { label: 'How it works', href: '/docs/draft-room-how-it-works.html' },
  { label: 'How scoring works', href: '/docs/draft-room-how-it-works.html#s03' },
  { label: 'VORP explained', href: '/docs/draft-room-how-it-works.html#s07' },
  { label: 'Data sources', href: '/docs/draft-room-how-it-works.html#s02' },
]

// COMPANY and SUPPORT_LINKS are the sections a reference footer (Sleeper's)
// carries that Juke doesn't have real pages behind yet — About Us, Careers,
// Contact; Support alongside the two real legal pages. None of them are
// left out the way "no real page yet" would normally mean here, because
// the ask this time is explicitly to shape the footer for where the
// company is headed, not just where it is today. Each opens the same
// ComingSoonModal every other not-live control on this page already uses
// rather than a dead href="#" — honest about "not yet" without pointing
// at nothing.
const COMPANY_LINKS = ['About Us', 'Careers', 'Contact']

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/docs/privacy.html' },
  { label: 'Terms of Service', href: '/docs/terms.html' },
]
const SUPPORT_LINK = 'Support'

// Real marks now, not mono-label placeholders — path data pulled straight
// from Simple Icons (simpleicons.org), whose SVG recreations are
// dedicated to the public domain (CC0 1.0; checked the project's own
// LICENSE.md), so redrawing them here isn't a copyright question the way
// the App Store/Google Play badges below still are.
//
// The trademarks the marks depict still belong to Meta/X Corp/Reddit, same
// as any logo — but using a platform's own mark to point at your own real
// profile on it ("follow us on X") is ordinary, widely-practiced nominative
// use, not the tightly-licensed, agreement-bound territory Apple/Google's
// *store badges* live in (those are tied to an actual listing Juke doesn't
// have, under marketing guidelines that gate the artwork itself). Different
// question, different answer — accurate icons are fine here; there's just
// no Juke account behind any of them yet, which is a "not live" problem,
// not a "not allowed" one, so they still open the same ComingSoonModal.
//
// LinkedIn and YouTube dropped per instruction, matching the reference
// footer's own four (Reddit, X, Facebook, Instagram) rather than the five
// this list started as.
const SOCIAL_LINKS = [
  {
    label: 'Facebook',
    path: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  },
  {
    label: 'Instagram',
    path: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  },
  {
    label: 'X',
    path: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  },
  {
    label: 'Reddit',
    path: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
  },
]

function SocialIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

// Juke isn't listed in either store — it installs as a PWA (manifest.json),
// which is a real, working feature this pair of badges doesn't hook up to
// yet. Apple/PlaySquare are lucide's generic, brand-neutral icons, not a
// hand-traced reproduction of Apple's or Google's actual trademarked badge
// artwork, which this project has no license to redraw.
const APP_BADGES = [
  { store: 'App Store', article: 'the App Store', kicker: 'Download on the', Icon: Apple },
  { store: 'Google Play', article: 'Google Play', kicker: 'Get it on', Icon: PlaySquare },
]

function useRooms() {
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

  useEffect(() => {
    setFreshness(freshnessLine())
  }, [])

  return freshness
}

// One row per room: a real link for the one that's live, a ComingSoonModal
// button for the other five — the same choice RoomCard.jsx already makes
// for exactly these five room cards elsewhere on this page, just reused
// here rather than re-decided. Listing all six (not just the live one) is
// the point of this pass: a reference footer whose own product-list column
// names everything the company offers, not just what's shipped.
function FooterRoomLink({ room, onComingSoon, className }) {
  if (room.live && room.href) {
    return (
      <a href={room.href} className={className}>
        {room.name}
      </a>
    )
  }
  return (
    <button type="button" onClick={() => onComingSoon(room)} className={`${className} text-left`}>
      {room.name}
    </button>
  )
}

function FooterColumn({ title, children }) {
  return (
    <div className="flex flex-col gap-[11px]">
      <span className="font-voidNumeral text-[10.5px] font-semibold tracking-[0.13em] text-voidInk-body">{title}</span>
      {children}
    </div>
  )
}

// The brand stack — logo, then socials, then app badges, in that order —
// is identical on both breakpoints, so it gets its own component rather
// than being written out twice.
function FooterBrandStack({ onSocialClick, onAppClick }) {
  return (
    <div className="flex flex-col items-start gap-5">
      <JukeLogo size={18} />

      <div className="flex gap-2">
        {SOCIAL_LINKS.map((social) => (
          <button
            key={social.label}
            type="button"
            onClick={() => onSocialClick(social.label)}
            aria-label={social.label}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-hairline text-voidInk-muted transition-colors hover:border-teal-400/40 hover:text-white"
          >
            <SocialIcon path={social.path} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {APP_BADGES.map(({ store, article, kicker, Icon }) => (
          <button
            key={store}
            type="button"
            onClick={() => onAppClick(store, article)}
            className="flex items-center gap-2 rounded-lg border border-line-hairline px-3 py-[7px] transition-colors hover:border-teal-400/40"
          >
            <Icon className="h-5 w-5 text-voidInk-body" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[8.5px] uppercase tracking-[0.06em] text-voidInk-muted">{kicker}</span>
              <span className="text-[12.5px] font-semibold text-voidInk-primary">{store}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Homepage() {
  const rooms = useRooms()
  const freshness = useDataFreshness()
  const modalRef = useRef(null)

  const openComingSoon = (label, body) => modalRef.current?.open(`${label} is coming soon`, body)
  const openSocial = (label) => openComingSoon(label, `Juke isn't on ${label} yet — check back once it is.`)
  const openApp = (store, article) => openComingSoon(store, `Juke isn't listed on ${article} yet — it installs as a browser app for now.`)
  const openCompanyLink = (label) => openComingSoon(label, `There's no ${label} page yet — check back as Juke grows.`)
  const openRoom = (room) => openComingSoon(room.name, `${room.blurb} There's nothing to sign up for yet — check back once it's live.`)
  const openSupport = () => openComingSoon(SUPPORT_LINK, "There's no support channel yet — check back as Juke grows.")

  const roomLinkClass = 'flex min-h-[44px] items-center text-sm text-voidInk-body transition-colors hover:text-white lg:min-h-0 lg:text-[13px]'

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface-page font-voidBody text-voidInk-primary">
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

      {/* ---------- Footer, restructured after a real competitor's (Sleeper's)
          own footer ---------- Logo, then socials, then app badges, stacked
          top-left; everything else in equal-width columns to the right —
          Rooms/Method/Company/Legal here, standing in for Sleeper's own
          Available-on/Company/Resources/Play columns. Rooms and Method are
          Juke's real content; Company and Legal's three new entries
          (About Us, Careers, Contact, Support) are the "shape it for where
          the company is headed" half of this pass — see the ComingSoonModal
          note on COMPANY_LINKS above for why they're buttons, not dead
          links. gap-x-10/gap-y-12 on both breakpoints is the one spacing
          scale for the whole footer, rather than a different hand-picked
          value per section, which is what "evenly spaced" actually means
          here: every gap between every pair of sections is the same
          number, not just visually close. */}
      <footer className="mt-[72px] border-t border-line-hairline bg-surface-nav">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-10 py-14 lg:grid lg:grid-cols-5 lg:gap-x-10 lg:gap-y-12">
          <FooterBrandStack onSocialClick={openSocial} onAppClick={openApp} />

          <FooterColumn title="The Rooms">
            {rooms.map((room) => (
              <FooterRoomLink key={room.name} room={room} onComingSoon={openRoom} className={roomLinkClass} />
            ))}
          </FooterColumn>

          <FooterColumn title="Method">
            {METHOD_LINKS.map((link) => (
              <a key={link.label} href={link.href} className={roomLinkClass}>
                {link.label}
              </a>
            ))}
          </FooterColumn>

          <FooterColumn title="Company">
            {COMPANY_LINKS.map((label) => (
              <button key={label} type="button" onClick={() => openCompanyLink(label)} className={`${roomLinkClass} text-left`}>
                {label}
              </button>
            ))}
          </FooterColumn>

          <FooterColumn title="Legal">
            {LEGAL_LINKS.map((link) => (
              <a key={link.label} href={link.href} className={roomLinkClass}>
                {link.label}
              </a>
            ))}
            <button type="button" onClick={openSupport} className={`${roomLinkClass} text-left`}>
              {SUPPORT_LINK}
            </button>
          </FooterColumn>
        </div>

        <ComingSoonModal ref={modalRef} />

        {/* The legal/copyright row — a single centred line, matching the
            reference footer's own bottom bar, plus the one Juke-specific
            trust line (what a solo draft does and doesn't send anywhere)
            that has no equivalent in a reference built for a different
            product, kept because it's true and worth keeping rather than
            cut to match a shape that has no room for it. */}
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 border-t border-line-divider px-10 py-6 text-center">
          <p className="max-w-[560px] text-[13px] text-voidInk-muted">
            A solo mock draft runs entirely in your browser — nothing you draft is sent anywhere.
            Drafting with your league uses a server, just for that room.
          </p>
          <span className="font-voidNumeral tabular-nums text-xs font-medium text-voidInk-muted">&copy; 2026 Juke. All rights reserved.</span>
        </div>

        {/* The footer's one static closing line — see useDataFreshness()
            above for where both numbers actually come from. Renders
            nothing until window.JukeEngine has answered (same
            fails-by-disappearing contract as the score strip), rather than
            a placeholder that would flash a wrong count for one frame. */}
        {freshness && (
          <div className="mx-auto max-w-[1200px] px-10 pb-6 text-center">
            <p className="font-voidNumeral tabular-nums text-xs font-medium text-voidInk-muted">{freshness}</p>
          </div>
        )}
      </footer>
    </div>
  )
}
