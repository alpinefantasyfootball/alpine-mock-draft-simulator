import { useEffect, useState } from 'react'

// PlayerQueueSidebar's rows share layoutIds with DraftBoardGrid's cells for
// the queue-to-board FLIP transition (see PlayerHub.jsx's own file
// comment), which only works — and only avoids Framer Motion silently
// picking one of two colliding registrations — if exactly one instance of
// it is ever actually mounted. `hidden ... lg:flex` on a desktop block sitting
// beside a `{mobilePane === 'pool' && ...}` mobile block is not that: the
// desktop copy stays mounted (just CSS-hidden) the whole time the mobile
// one is, which is a real mount collision every time the Pool pane is open
// on a phone, not merely a hypothetical one. This hook is what lets a
// caller gate on the one thing CSS classes can't express — whether the
// element is genuinely there — with a real value rather than a guess at
// which breakpoint "should" be active.
export function useMinWidth(px) {
  const query = `(min-width: ${px}px)`
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
