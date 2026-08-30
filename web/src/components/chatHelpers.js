// Shared between ChatPanel.jsx (desktop/tablet dock) and phone/ChatTabPhone.jsx
// (the phone redesign's Chat tab) — both read the same engine.chatStream()
// output and have to agree on what a line means, so the formatting and
// grouping logic lives once rather than as two copies that could drift.

export const GROUP_MS = 2 * 60 * 1000 // CLAUDE.md: two minutes of silence, or a change of speaker, starts a new block
export const CHAT_MAX = 500 // room.js's own CHAT_MAX — the server truth; composers just match it

export function chatTime(at) {
  if (!at) return ''
  const d = new Date(at)
  let h = d.getHours()
  const suffix = h < 12 ? 'am' : 'pm'
  h = h % 12 || 12
  return h + ':' + String(d.getMinutes()).padStart(2, '0') + suffix
}

export function seatName(room, seat, fallback) {
  if (seat < 0) return fallback || null
  const chair = room.seats && room.seats[seat]
  return (chair && chair.name) || fallback || null
}

export function seatLabel(room, seat, fallback) {
  return seatName(room, seat, fallback) || (seat >= 0 ? 'Seat ' + (seat + 1) : 'Someone')
}

export function seatInitials(name, seat) {
  if (!name) return String(seat + 1)
  const parts = String(name).trim().split(/\s+/).slice(0, 2)
  return parts.map((w) => w[0].toUpperCase()).join('')
}

// The exact grouping pass renderChat() runs over chatStream()'s output:
// system and pick entries always break a run, and "said" only groups with
// the immediately preceding "said" from the same seat inside GROUP_MS.
export function buildDisplay(entries) {
  let lastSeat = null
  let lastAt = 0
  let lastKind = null
  return entries.map((entry) => {
    if (entry.kind === 'system' || entry.kind === 'pick') {
      lastSeat = null
      lastKind = entry.kind
      return { entry, grouped: false }
    }
    const grouped = lastKind === 'said' && entry.seat === lastSeat && entry.at - lastAt < GROUP_MS
    lastSeat = entry.seat
    lastAt = entry.at
    lastKind = 'said'
    return { entry, grouped }
  })
}
