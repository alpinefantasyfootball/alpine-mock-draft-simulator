import { useEffect, useReducer, useState } from 'react'

// Shared by every React island that reads window.JukeEngine — the draft
// room, the header, the player sheet. Was two copies — one per component that needed it
// — which is the same class of drift CLAUDE.md already has a rule about for
// league shape: one implementation, handed out rather than duplicated.
export function useEngine() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.JukeEngine) setReady(true)
  }, [])
  return ready ? window.JukeEngine : null
}

// "juke:header" fires from renderHeader() on every render, tick and pause
// toggle — including the render() inside onRoomChange() (see the bridge
// comment on room()/createRoom() in app.js) and the render() refreshSetup()
// runs on the way back to the setup screen — so anything reading engine
// state can re-render on any of those without registering a second listener.
export function useJukeTick(engine) {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    if (!engine) return
    window.addEventListener('juke:header', force)
    /* And read once on attach, because the event can land before this
       listener exists. useEngine() resolves in an effect, so the listener
       goes on two renders after mount — and in a lobby the room's first
       state is often the only broadcast there will be, so missing it means
       showing an empty board until something else happens to fire. This
       was DraftRoom.jsx's own fix, on its own local copy of this hook,
       before this file existed to de-duplicate it — the copy here was
       missing exactly the line the comment on the original explains. */
    force()
    return () => window.removeEventListener('juke:header', force)
  }, [engine])
}
