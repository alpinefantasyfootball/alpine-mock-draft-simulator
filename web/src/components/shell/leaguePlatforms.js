/* Which platforms Juke can read a league from, and which it cannot yet.

   One list, because the answer was previously written down as prose in
   seven places — `Sleeper · ESPN · Yahoo · CBS`, under every connect
   control on the site — and prose cannot be wrong in a way anything
   notices. It was wrong: only Sleeper is built, and the connect dialog
   asked for a Sleeper username the moment it opened, with no step in
   between. Reported exactly that way: "there's a disconnect between what
   we're saying we can connect to and what our pop-up is asking for."

   ---- Listed, not hidden ----

   The three that are not built stay on the list and are visibly locked,
   which is the shape this project already uses twice: DRAFT_TYPES lists
   auction and marks it unavailable, and the Draft Room's sport chips list
   Basketball and Baseball behind a lock. A row showing one platform where
   the category has four tells a visitor the product has not thought past
   one. What it must not do is imply the other three work today, which is
   what an undifferentiated list of four does.

   `LINE` is the one-line version for the 12px caption under a connect
   button. "now" and "soon" are doing the whole job: they are what turns a
   claim into a roadmap. */

export const PLATFORMS = [
  { key: 'sleeper', name: 'Sleeper', live: true, note: 'Username only — no password' },
  { key: 'espn', name: 'ESPN', live: false },
  { key: 'yahoo', name: 'Yahoo', live: false },
  { key: 'cbs', name: 'CBS', live: false },
]

export const LIVE_PLATFORMS = PLATFORMS.filter((p) => p.live)

export const LINE = 'Sleeper now · ESPN, Yahoo, CBS soon'

/* The badge a connected league wears, by provider.

   The header chip used to draw a hardcoded "S" on a teal square, which was
   right while Sleeper was the only thing that could be connected and stops
   being right the moment an account holds two leagues from two places —
   which is the whole point of the switcher this exists for.

   ---- One colour, and the letter is what differs ----

   The obvious version gives each platform its own tint. It is not worth
   what it costs: every value in the palette is already spoken for, and the
   three that are not (`flow.gold`, `flow.lavender`, `flow.blue`) are room
   identities — gold is the League Room, lavender is Trade. Reusing one
   here would make a colour mean two things in one app, which this project
   has a standing rule against and has already paid for once.

   The letter identifies the platform, and every surface that draws more
   than the badge draws the platform's name in text beside it. So a second
   colour would be a third way of saying something already said twice.

   ---- An unknown provider still draws ----

   A row can arrive from a provider this build does not know about: the
   database is shared with whatever is deployed, and the worker is deployed
   separately from the site. `?` and the raw key is a worse label than
   "ESPN" and a much better one than a crash. */
export function platformFor(key) {
  const found = PLATFORMS.find((p) => p.key === key)
  if (found) return { key: found.key, name: found.name, mark: found.name.slice(0, 1) }
  const raw = String(key || '')
  return { key: raw, name: raw ? raw.toUpperCase() : 'League', mark: raw.slice(0, 1).toUpperCase() || '?' }
}
