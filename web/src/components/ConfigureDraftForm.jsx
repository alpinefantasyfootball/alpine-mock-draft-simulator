import { useEffect, useReducer, useState } from 'react'
import { ChevronDown } from 'lucide-react'

const ORDINAL_SUFFIX = (n) => {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
const ordinal = (n) => `${n}${ORDINAL_SUFFIX(n)}`

// league.rules aren't touched here at all (only teams/scoring/clock/mySlot),
// so rounds/starters/bench/flex/superflex stay whatever they already are —
// this page doesn't expose full roster construction, only the three fields
// asked for plus draft position, which startDraft() needs to run at all.
const PICK_CLOCK_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 30, label: '30 seconds' },
  { value: 45, label: '45 seconds' },
  { value: 60, label: '60 seconds' },
  { value: 120, label: '120 seconds' },
]

function FormField({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-white/45">{label}</label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-white/40">{hint}</p>}
    </div>
  )
}

// HTML select values are always strings, whatever type is passed in — so
// this hands the raw string back rather than guessing a type. Scoring's
// values are string keys ("half"); teams/clock/slot are numbers. Each
// caller converts to what it actually needs, same as readSetup() always
// did per field rather than coercing everything the same way.
function FormSelect({ value, onChange, options, disabled }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none border-0 border-b-2 border-white/10 bg-transparent py-2.5 pr-8 text-base
                   text-white outline-none transition-colors duration-200 focus:border-teal-400
                   disabled:cursor-not-allowed disabled:opacity-40"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-charcoal text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
    </div>
  )
}

function useEngine() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.JukeEngine) setReady(true)
  }, [])
  return ready ? window.JukeEngine : null
}

// "juke:header" fires from renderHeader() on every render, tick and pause
// toggle — including the render() inside onRoomChange() (see the bridge
// comment on room()/createRoom() in app.js) — so this re-renders on every
// room change too, without registering a second Live.onChange() listener.
function useJukeTick(engine) {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    if (!engine) return
    window.addEventListener('juke:header', force)
    return () => window.removeEventListener('juke:header', force)
  }, [engine])
}

export default function ConfigureDraftForm() {
  const engine = useEngine()
  useJukeTick(engine)

  const [teams, setTeams] = useState(10)
  const [scoring, setScoring] = useState('half')
  const [clockLength, setClockLength] = useState(60)
  const [mySlot, setMySlot] = useState(0)
  const [problem, setProblem] = useState('')
  const [save, setSave] = useState(null)

  useEffect(() => {
    if (!engine) return
    const data = engine.readSave()
    const hasSave = data && data.picks && data.picks.length
    setSave(hasSave ? data : null)

    // resumeDraft() refuses unless the live league already matches the
    // save's fingerprint (different snake turns, different rounds, a
    // reordered board under a different scoring format). Defaulting the
    // form to the save's own settings — not whatever league already
    // happens to hold — means Resume works on the first click instead of
    // silently hitting that refusal until the dropdowns are set back by hand.
    const source = hasSave ? data.league : engine.league()
    setTeams(source.teams)
    setScoring(source.scoring)
    setMySlot(0)
    if (hasSave) engine.setLeague({ teams: data.league.teams, scoring: data.league.scoring })
    setProblem(engine.setupProblem())
  }, [engine])

  // A room fixes the board's shape the moment it exists — the snake turns
  // in different places for a different team count, so every client has
  // to agree on it, and that has to include the host (CLAUDE.md: "Locked
  // for the host too... changing it means a new room"). The legacy setup
  // page enforces this by disabling its own DOM inputs (LOCKABLE); this
  // form is a separate React tree with no relation to that list, so it
  // needs its own lock — otherwise a manager idly touching League Size in
  // a room lobby silently corrupts the room's board for everyone in it.
  // Kept in sync from the real league (rather than just disabled at
  // whatever the form last held) so a locked value is still an honest one.
  const hasRoomVal = engine ? engine.hasRoom() : false
  useEffect(() => {
    if (!engine || !hasRoomVal) return
    const current = engine.league()
    setTeams(current.teams)
    setScoring(current.scoring)
  }, [engine, hasRoomVal])

  const teamOptions = engine ? engine.teamCounts() : [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]
  const scoringNames = engine ? engine.scoringNames() : { standard: 'Standard', half: 'Half PPR', ppr: 'Full PPR' }
  const scoringOptions = Object.keys(scoringNames).map((key) => ({ value: key, label: scoringNames[key] }))
  const slotOptions = Array.from({ length: teams }, (_, i) => ({ value: i, label: `${ordinal(i + 1)} pick` }))

  const applyLeague = (patch) => {
    if (!engine) return
    engine.setLeague(patch)
    setProblem(engine.setupProblem())
  }

  const handleTeams = (v) => {
    const n = Number(v)
    setTeams(n)
    setMySlot((s) => Math.min(s, n - 1))
    applyLeague({ teams: n })
  }
  const handleScoring = (v) => { setScoring(v); applyLeague({ scoring: v }) }
  const handleClock = (v) => setClockLength(Number(v))
  const randomizeSlot = () => setMySlot(Math.floor(Math.random() * teams))

  const launch = () => {
    if (!engine) return
    const current = engine.setupProblem()
    setProblem(current)
    if (current) return
    engine.startDraft({ mySlot, clockLength })
  }

  const resume = () => engine && save && engine.resumeDraft(save)
  const discard = () => {
    if (!engine) return
    engine.clearSave()
    setSave(null)
  }

  return (
    <div id="configure-draft" className="flex h-full flex-col rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-white">Configure Draft</h2>
      <p className="mt-1 text-sm text-white/50">Set the shape of the league, then jump in.</p>

      {save && (
        <div className="mt-5 rounded-xl border border-teal-400/30 bg-teal-400/5 p-4">
          <p className="text-sm font-semibold text-white">
            {save.picks.length >= save.league.teams * save.league.rounds ? 'Your finished draft' : 'Draft in progress'}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {save.league.teams} teams &middot; {save.league.rounds} rounds &middot; {save.picks.length} picks made
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={resume}
              className="rounded-full bg-teal-500 px-4 py-1.5 text-xs font-semibold text-obsidian transition-transform duration-200 hover:scale-105"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={discard}
              className="rounded-full px-4 py-1.5 text-xs font-medium text-white/50 transition-colors hover:text-white"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {hasRoomVal && (
        <p className="mt-5 text-xs leading-relaxed text-white/40">
          League shape and seats are the room's now — everyone in it has to agree on the same board, so
          these are fixed until you leave. Claim a seat below instead of picking a draft position here.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-5">
        <FormField label="League size">
          <FormSelect
            value={teams}
            onChange={handleTeams}
            disabled={hasRoomVal}
            options={teamOptions.map((n) => ({ value: n, label: `${n} teams` }))}
          />
        </FormField>

        <FormField label="Scoring">
          <FormSelect value={scoring} onChange={handleScoring} disabled={hasRoomVal} options={scoringOptions} />
        </FormField>

        <FormField label="Pick clock" hint="When the clock runs out, the top suggestion is drafted for you.">
          <FormSelect value={clockLength} onChange={handleClock} disabled={hasRoomVal} options={PICK_CLOCK_OPTIONS} />
        </FormField>

        <FormField label="Draft position">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <FormSelect value={mySlot} onChange={(v) => setMySlot(Number(v))} disabled={hasRoomVal} options={slotOptions} />
            </div>
            <button
              type="button"
              onClick={randomizeSlot}
              disabled={hasRoomVal}
              className="shrink-0 rounded-full border border-white/15 px-3.5 py-2 text-xs font-medium text-white/60
                         transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300
                         disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/60"
            >
              Randomize
            </button>
          </div>
        </FormField>
      </div>

      {problem && (
        <p className="mt-5 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2 text-xs text-rose-300">
          {problem}
        </p>
      )}

      {hasRoomVal && !(engine && engine.isHost()) ? (
        // startDraft() still routes to Live.start() in a room (see the
        // bridge comment in app.js), which the server refuses from
        // anyone but the host — so a guest's click would silently do
        // nothing. Told plainly instead of offered and then ignored.
        <p className="mt-8 rounded-full border border-white/10 py-3.5 text-center text-sm font-medium text-white/50">
          Waiting for the host to start the draft…
        </p>
      ) : (
        <button
          type="button"
          onClick={launch}
          disabled={!!problem}
          className="mt-8 w-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] py-3.5 text-base font-semibold text-white
                     shadow-glass transition-all duration-200 hover:scale-[1.02] hover:animate-pulse-glow
                     disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:animate-none"
        >
          {hasRoomVal ? 'Start the Draft' : 'Launch Mock Draft'}
        </button>
      )}
    </div>
  )
}
