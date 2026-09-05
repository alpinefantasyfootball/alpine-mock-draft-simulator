/* One countdown, formatted one way.

   Lifted out of KickoffPill rather than copied beside it. There are two
   countdowns on the site now — the NFL kickoff in the header and the draft
   on every connected league — and two formatters would drift the first time
   one of them decided days should read "4d" instead of "4D".

   ---- Two forms off one instant, never two timers ----

   `compact` is `4D 06:14` and `full` is `4D 06:14:31`. The seconds field
   exists because `4D 06:14` changes once a minute and reads as frozen —
   reported that way about the kickoff pill — and it is a separate string
   rather than a separate component because both are rendered from the same
   tick and CSS picks between them. Two timers drift; one tick cannot.

   ---- Null past zero, deliberately ----

   A countdown that has run out is not a countdown reading `0D 00:00`, it is
   a different thing entirely — a draft that is happening, or a kickoff that
   has kicked off — and the caller knows which. Answering null forces that
   decision rather than letting a frozen row of zeros stand in for it. */

export function countdownParts(ms) {
  if (!(ms > 0)) return null
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86400)
  const p = (n) => String(n).padStart(2, '0')
  const hhmm = `${p(Math.floor((total % 86400) / 3600))}:${p(Math.floor((total % 3600) / 60))}`
  const lead = days > 0 ? `${days}D ` : ''
  return { compact: `${lead}${hhmm}`, full: `${lead}${hhmm}:${p(total % 60)}` }
}

/* The one place a draft's `at` and `status` become a thing to draw.

   Both providers report the same three statuses — sleeper.js passes its own
   through and espn.js maps its two booleans onto them — so this is provider
   -blind on purpose, and adding Yahoo means teaching its adapter those three
   words rather than teaching this function a fourth vocabulary.

   ---- Why the status is read before the instant ----

   Both platforms keep the scheduled time after the draft has run. Sleeper
   leaves `start_time` on a completed draft and ESPN leaves
   `draftSettings.date` behind `drafted: true`, so a countdown built on the
   instant alone counts down to a draft that happened last month — and it
   does it confidently, which is the worst way for a number to be wrong.

   ---- The states, and why "late" is one of them ----

   'none'      no draft scheduled. An ordinary state, not an error.
   'complete'  it has happened. Nothing to count.
   'drafting'  it is happening now. The rosters are filling as you look.
   'soon'      a real countdown.
   'late'      the time has passed and the draft has not started.

   That last one is the reason this returns a phase rather than a number.
   A scheduled time that has gone by is extremely common — leagues start
   late, or the commissioner never moved a placeholder — and counting to a
   negative, or silently showing nothing, both misrepresent it. Saying the
   time has passed is the only honest answer, and it is the one the reader
   can act on. */
export function draftPhase(draftAt, draftStatus, now = Date.now()) {
  if (draftStatus === 'complete') return { phase: 'complete', parts: null }
  if (draftStatus === 'drafting') return { phase: 'drafting', parts: null }
  if (!draftAt) return { phase: 'none', parts: null }

  const parts = countdownParts(draftAt - now)
  if (!parts) return { phase: 'late', parts: null }
  return { phase: 'soon', parts }
}
