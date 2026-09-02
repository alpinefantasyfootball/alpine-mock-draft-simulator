import { useEffect, useRef, useState } from 'react'

/* Real browser notifications for a draft, and the preferences behind them.

   The point of this is one moment: your turn arrives while the tab is not
   the one you are looking at. A mock draft on a phone spends most of its
   life in a background tab — you send the invite from the messages app, you
   check something, the screen locks — and the app's own answer to "it is
   your pick" has been a sound cue and a colour change on a screen nobody is
   looking at. soundCue() is documented as firing on the CHANGE rather than
   the state for exactly this turn; this is the same event, delivered
   somewhere the reader actually is.

   ---- Why this is a real feature and not a stored preference ----

   The obvious cheap version is a screen with two switches that write to
   localStorage and do nothing. That is the dead-control failure this
   project has already shipped once (the rail's "My Team" row: it rendered,
   it contrasted, it passed every check, and pressing it did nothing) — and
   a notification toggle is worse than a coloured label, because somebody
   turns it on and then trusts it.

   ---- What it can and cannot do ----

   The Notification API needs a user gesture to ask for permission and a
   secure context to exist at all, and on iOS it exists only for a site the
   reader has installed to the home screen. All three of those are states
   this hook reports rather than assumes: `supported` is false when the API
   is absent, and the settings screen says so plainly instead of drawing a
   switch that can never come on. That is the same contract the news panel
   already follows for a missing key — "not wired up" and "nothing today"
   are different facts and only one is worth investigating.

   There is no push service and no backend here, and there does not need to
   be: the page is open, it is just not in front. A Notification fired from
   a background tab is exactly the right tool, and a real push subscription
   would be a server, a VAPID key pair and a service worker to deliver the
   same sentence.
*/

const KEY = 'juke.notify'
const DEFAULTS = { allow: false, mentions: true }

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    // A private window, cleared site data, or storage blocked outright.
    // Defaults are a working state, so this is not worth reporting.
    return { ...DEFAULTS }
  }
}

function write(prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* see read() */ }
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

/* The preferences, and the permission request that has to go with them.

   Turning "Allow notifications" on is the gesture the browser requires, so
   the request happens there and nowhere else — asking on mount is what gets
   a site's permission prompt dismissed permanently, and Chrome now blocks
   it outright unless it follows a real interaction.

   A denied permission is stored as `allow: false` rather than as an error,
   because from the reader's side those are the same fact: the switch did
   not come on. What the screen adds is why. */
export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState(read)
  const [permission, setPermission] = useState(() =>
    notificationsSupported() ? Notification.permission : 'unsupported')

  const save = (next) => { setPrefs(next); write(next) }

  const setAllow = async (want) => {
    if (!want) { save({ ...prefs, allow: false }); return }
    if (!notificationsSupported()) return
    let state = Notification.permission
    if (state === 'default') {
      try { state = await Notification.requestPermission() } catch { state = 'denied' }
    }
    setPermission(state)
    save({ ...prefs, allow: state === 'granted' })
  }

  const setMentions = (want) => save({ ...prefs, mentions: !!want })

  return { prefs, permission, supported: notificationsSupported(), setAllow, setMentions }
}

/* The behaviour. Mounted once from DraftRoom.jsx and given the same
   `myTurn` the header already computed — nothing here re-derives whose turn
   it is, same rule every other consumer of the bridge follows.

   Three things it will not do, each of which is the difference between a
   useful notification and one that gets the permission revoked:

   - It never fires while the tab is visible. You are looking at the thing
     it would be telling you about; that is what the sound cue is for.
   - It fires on the CHANGE, not the state. `myTurn` is true for every
     render, tick and rebuild of a single turn — hundreds of times — and a
     notification per render is the shape of bug soundCue()'s own comment
     already records.
   - It replaces rather than stacks. One `tag` per kind, so coming back to
     eight unread "it's your pick" notifications cannot happen. */
export function useDraftNotifications({ engine, myTurn, over, code }) {
  const { prefs } = useNotificationPrefs()
  const wasMyTurn = useRef(false)
  /* The newest chat message this hook has already considered, by its own
     id. NOT a count and not an index: a room's chat log is bounded in both
     lines and bytes (see room.js), so it drops old messages off the front,
     and a length comparison would go quiet the moment the log started
     rolling — silently, and only in the long drafts where somebody has most
     likely stopped watching the tab. An id is stable whatever falls off. */
  const lastSeenChat = useRef(null)
  const primed = useRef(false)

  const armed = prefs.allow && notificationsSupported() &&
    typeof Notification !== 'undefined' && Notification.permission === 'granted'

  const show = (title, body, tag) => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
    try {
      // eslint-disable-next-line no-new
      new Notification(title, { body, tag, icon: '/juke-icon-tile-192.png' })
    } catch {
      /* Notification construction throws on some engines even with
         permission granted (Android Chrome requires a service worker
         registration for it). This fails by going quiet, the same contract
         the sound cue and the score strip already have — a draft must never
         break because a notification could not be drawn. */
    }
  }

  // Your turn.
  useEffect(() => {
    const turned = myTurn && !wasMyTurn.current
    wasMyTurn.current = !!myTurn
    if (!armed || !turned || over) return
    show("You're on the clock", code ? `Pick ${code} is yours.` : 'Your pick is up in The Draft Room.', 'juke-turn')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, over, code, armed])

  /* Somebody said your name. Only in a room — there is nobody to mention
     you in a solo draft — and only for messages that arrived AFTER this
     hook started watching.

     That priming pass is the load-bearing part. Joining a room hands you
     the whole existing chat log at once, so without it every mention from
     before you arrived fires the moment you connect: a burst of
     notifications about a conversation you have not read yet, which is
     both wrong and the fastest way to have notifications turned off
     again. The first run records where the log is and shows nothing. */
  useEffect(() => {
    if (!engine || !engine.hasRoom || !engine.hasRoom()) { primed.current = false; return }
    const room = engine.room()
    if (!room) return
    const stream = engine.chatStream(room) || []
    const said = stream.filter((e) => e.kind === 'said')
    if (!said.length) return
    const newest = said[said.length - 1]

    if (!primed.current) { primed.current = true; lastSeenChat.current = newest.id; return }
    if (!armed || !prefs.mentions || newest.id === lastSeenChat.current) return

    const seen = lastSeenChat.current
    const at = said.findIndex((e) => e.id === seen)
    const fresh = at === -1 ? said.slice(-1) : said.slice(at + 1)
    lastSeenChat.current = newest.id

    const me = (engine.myName && engine.myName()) || ''
    if (!me) return
    const needle = me.toLowerCase()
    /* Substring, not a word boundary or an @-prefix. Juke has no mention
       syntax — chat is plain text people type — so the only honest test is
       whether your name is in what they said. A first name inside a longer
       word is the false positive this can produce, and it is the right way
       round: a mention missed is the failure that matters. */
    const mine = fresh.filter((e) => !e.system && String(e.text || '').toLowerCase().includes(needle))
    if (!mine.length) return
    const last = mine[mine.length - 1]
    show(
      mine.length > 1 ? `${mine.length} mentions in the draft chat` : `${last.name || 'Someone'} mentioned you`,
      String(last.text || '').slice(0, 140),
      'juke-mention',
    )
    // engine is stable for the life of the page; the tick that actually
    // moves the chat log is what re-runs this, and DraftRoom re-renders on
    // every "juke:header" — which onRoomChange() fires for a chat message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })
}
