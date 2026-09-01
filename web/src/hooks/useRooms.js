import { useEffect, useState } from 'react'

// Shared by RoomsGrid.jsx (the homepage's own Rooms section) and
// RoomsNavMenu.jsx (the header's "The Rooms" dropdown) — both need the same
// six rooms, in the same order, read off window.JukeEngine.rooms(). This
// used to be RoomsGrid.jsx's own local function; a second copy in the header
// is exactly the "two different implementations that have drifted" bug
// SiteNav.jsx's own file comment already documents for NAV_LINKS, just for
// the room list instead of the nav links.
export function useRooms() {
  const [rooms, setRooms] = useState([])

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return
    setRooms(engine.rooms())
  }, [])

  return rooms
}
