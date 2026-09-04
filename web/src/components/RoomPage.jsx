import AppShell from './shell/AppShell.jsx'
import RoomHero from './shell/RoomHero.jsx'
import LockedPreview from './shell/LockedPreview.jsx'
import { useRooms } from '../hooks/useRooms.js'
import WaiverPreview from './rooms/WaiverPreview.jsx'
import TradePreview from './rooms/TradePreview.jsx'
import StrategyPreview from './rooms/StrategyPreview.jsx'
import LeaguePreview from './rooms/LeaguePreview.jsx'

/* #/rooms/<slug> — one page for every room, guest state.

   The four in-season rooms are locked previews (design_handoff_v3_alive's
   d/e/h/i); the Draft Room is open and redirects to the place it already
   lives. What differs per room is the hero's accent and copy and which
   sample content sits under the blur, so that is all this table holds.

   A room with no preview built yet renders the hero and the unlock card
   with nothing behind it — honest, and visibly unfinished, rather than a
   404 for a link the lobby is already offering. */

const PREVIEWS = {
  waiver: {
    eyebrow: 'IN-SEASON · PREVIEW',
    sub: 'A sample week. Connect your league and these become your bench and your budget.',
    headline: 'See your real claims',
    Body: WaiverPreview,
  },
  trade: {
    eyebrow: 'IN-SEASON · PREVIEW',
    sub: 'Paste any offer, or let Juke read the ones in your league inbox.',
    headline: 'Read your real offers',
    Body: TradePreview,
  },
  strategy: {
    eyebrow: 'IN-SEASON · PREVIEW',
    sub: "Your week, planned: start/sit calls, matchup odds and what's coming.",
    headline: 'Plan your real week',
    Body: StrategyPreview,
  },
  league: {
    eyebrow: 'IN-SEASON · PREVIEW',
    sub: 'Standings, power ranks and what every manager is up to.',
    headline: 'See your real league',
    Body: LeaguePreview,
  },
}

export default function RoomPage({ slug }) {
  const rooms = useRooms()
  const room = rooms.find((r) => r.slug === slug)

  // The lobby only links slugs that exist, so this is a hand-typed or stale
  // URL. Send it to the lobby rather than rendering a room-shaped shell with
  // no room in it — replace() so the bad address does not become a
  // back-button trap, the same call applyRoute() makes for #/draft.
  if (rooms.length && !room) {
    if (typeof window !== 'undefined') {
      location.replace(location.pathname + location.search + '#/rooms')
    }
    return null
  }
  if (!room) return null

  // The Draft Room is open and is not a preview — it is the Lobby, which
  // already has a screen. One destination, reached from the lobby card too.
  if (room.live && room.href) {
    if (typeof window !== 'undefined') {
      location.replace(location.pathname + location.search + room.href)
    }
    return null
  }

  const preview = PREVIEWS[slug]
  const Body = preview && preview.Body

  return (
    <AppShell active="rooms">
      <RoomHero
        accent={room.accent}
        glyph={room.glyph}
        eyebrow={preview ? preview.eyebrow : `${room.season.toUpperCase()} · PREVIEW`}
        title={room.name.replace(/^The /, '')}
      >
        {preview ? preview.sub : room.blurb}
      </RoomHero>
      <LockedPreview headline={preview ? preview.headline : `See your real ${slug} room`}>
        {Body ? <Body /> : null}
      </LockedPreview>
    </AppShell>
  )
}
