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
