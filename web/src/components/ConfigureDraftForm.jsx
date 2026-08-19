import { useEffect, useState } from 'react'
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
function FormSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none border-0 border-b-2 border-white/10 bg-transparent py-2.5 pr-8 text-base
                   text-white outline-none transition-colors duration-200 focus:border-teal-400"
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

export default function ConfigureDraftForm() {
  const engine = useEngine()

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

      <div className="mt-6 flex flex-col gap-5">
        <FormField label="League size">
          <FormSelect
            value={teams}
            onChange={handleTeams}
            options={teamOptions.map((n) => ({ value: n, label: `${n} teams` }))}
          />
        </FormField>

        <FormField label="Scoring">
          <FormSelect value={scoring} onChange={handleScoring} options={scoringOptions} />
        </FormField>

        <FormField label="Pick clock" hint="When the clock runs out, the top suggestion is drafted for you.">
          <FormSelect value={clockLength} onChange={handleClock} options={PICK_CLOCK_OPTIONS} />
        </FormField>

        <FormField label="Draft position">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <FormSelect value={mySlot} onChange={(v) => setMySlot(Number(v))} options={slotOptions} />
            </div>
            <button
              type="button"
              onClick={randomizeSlot}
              className="shrink-0 rounded-full border border-white/15 px-3.5 py-2 text-xs font-medium text-white/60
                         transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300"
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

      <button
        type="button"
        onClick={launch}
        disabled={!!problem}
        className="mt-8 w-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] py-3.5 text-base font-semibold text-white
                   shadow-glass transition-all duration-200 hover:scale-[1.02] hover:animate-pulse-glow
                   disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:animate-none"
      >
        Launch Mock Draft
      </button>
    </div>
  )
}
