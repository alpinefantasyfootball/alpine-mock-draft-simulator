import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Clipboard, Clock, Cpu, ListOrdered, Shield, ShieldCheck, Tag, Timer, Users, X } from 'lucide-react'
import { POS_CHALK } from './draftRoomPositions.js'
import { CircleGroup, PillGroup, RadioRow, Section, Stepper, Switch } from './settings/SettingsControls.jsx'
import ScoringRules, { scoringRuleCount } from './settings/ScoringRules.jsx'
import DraftOrder from './settings/DraftOrder.jsx'

/* Everything a draft is, on one screen, reachable from the Draft Room.

   This used to be a three-tab modal — Roster, Scoring, Seats — holding the
   two things that already worked and simply could not be reached (the
   starting lineup and the scoring table both live in the legacy setup
   screen, which has been display:none since React replaced it). It is the
   full settings screen now: draft name, draft type, third-round reversal,
   scoring, teams, available players, time per pick, CPU autopick, roster
   construction and draft order, in that order, plus the scoring-rule editor
   folded away at the bottom.

   Nothing here computes anything. The lineup comes from engine.lineup(),
   the rules from engine.scoringEditor(), the draft types from
   engine.draftTypes(), the validation from engine.setupProblem() — all of
   it the same single source app.js already owns. A second idea of what a
   league is, living in web/src, is the exact failure CLAUDE.md's "nothing
   about the league shape may be written down twice" is about, and the
   superflex grading bug is what it looks like when it happens.

   ---- One screen, two frames ----

   The sections are identical at every width; only what holds them changes.
   On a phone it is a full-screen sheet with a close and a Save in a fixed
   bar, because a modal with a backdrop on a 390px screen is a full-screen
   sheet with wasted edges and a dismiss target nobody can hit safely. From
   `sm` up it is a centred modal. That is the same call DraftRoomPhone makes
   about the draft room itself, and it is why there is one component here
   rather than two: the CONTENT is not phone-specific, and a second copy of
   ten sections is the "written down twice" rule in markup, which drifts the
   first time a section changes.

   ---- Why Save is a dismiss and not a commit ----

   Every control here writes through to the one real `league` the moment it
   is pressed, because that is what makes the board, the summary line and
   setupProblem() agree with the screen while somebody is still reading it —
   a settings screen that shows one league while the app holds another is
   the "right value, wrong column" bug with the whole screen in the wrong
   column. So Save closes; it does not apply. It says Save rather than Done
   because the reference app's does and because "Done" invites the same
   question in the other direction. What it genuinely guards is
   setupProblem(): a draft whose roster and rounds disagree cannot be
   started, so Save refuses and says which control caused it.
*/

const SLOT_LABEL = {
  QB: 'Quarterback (QB)',
  RB: 'Running Back (RB)',
  WR: 'Wide Receiver (WR)',
  TE: 'Tight End (TE)',
  K: 'Kicker (K)',
  DST: 'Defense (DEF)',
  FLEX: 'Flex (W/R/T)',
  SFLEX: 'Super Flex (Q/W/R/T)',
  BN: 'Bench',
}

/* The dot beside each roster row is the position's own chalk fill — the
   same map the board paints a cell with, so the roster and the board agree
   about what a running back looks like. POS_CHALK rather than POS_SOLID
   because the label sits beside the dot rather than on it, which is the
   one question draftRoomPositions.js's header says decides this. FLEX and Bench are deliberately
   grey: they are slots rather than positions, and giving a flex a colour
   would make it the seventh position on a six-colour board. */
const SLOT_DOT = { ...POS_CHALK, FLEX: '#4A5563', SFLEX: '#4A5563', BN: '#7C8A99' }

/* Seconds per pick. "No limit" is 0, which is what state.clockLength has
   always meant — see clockRunnable()/clockShowing(), where a zero-length
   clock is the one that is never counted and never drawn. */
const CLOCK_CHOICES = [
  { key: 0, label: 'NO', sub: 'Limit' },
  { key: 10, label: '10', sub: 'Secs' },
  { key: 15, label: '15', sub: 'Secs' },
  { key: 20, label: '20', sub: 'Secs' },
  { key: 30, label: '30', sub: 'Secs' },
  { key: 60, label: '60', sub: 'Secs' },
  { key: 120, label: '2', sub: 'Mins' },
  { key: 300, label: '5', sub: 'Mins' },
]

/* The lineup as an ordered list of slots, the way a roster actually reads,
   built from the counts league.starters already holds. Sleeper shows a list;
   we keep the counts. Rendering one from the other costs nothing and avoids a
   second model of the same fact. */
function rosterLine(lineup) {
  const bits = []
  const add = (n, label) => { if (n > 0) bits.push(`${n} ${label}`) }
  add(lineup.starters.QB, 'QB')
  add(lineup.starters.RB, 'RB')
  add(lineup.starters.WR, 'WR')
  add(lineup.starters.TE, 'TE')
  add(lineup.flex, 'FLEX (W/R/T)')
  add(lineup.superflex, 'SUPERFLEX')
  add(lineup.starters.K, 'K')
  add(lineup.starters.DST, 'DEF')
  return bits.join(', ')
}

export default function DraftSettingsModal({ engine, onClose, started, inRoom, mySlot }) {
  const [, bump] = useState(0)
  const redraw = () => bump((n) => n + 1)
  const [showRules, setShowRules] = useState(false)
  const [blocked, setBlocked] = useState('')
  const [unavailable, setUnavailable] = useState(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const league = engine.league()
  const lineup = engine.lineup()
  const problem = engine.setupProblem()

  /* Locked once a draft exists *or* a room does, and for the host too.

     Started was the only condition at first, which left every setting open
     to everybody sitting in a room lobby — and a guest who changes the
     scoring rebuilds their own board out from under the draft they are in.
     Nothing on screen would say so: their replacement levels, suggestions
     and grade would simply stop describing everybody else's draft, and
     adoptRoom() cannot put it back, because a room only ever broadcasts the
     league it was created with.

     The room's shape is fixed the moment the room exists. The CPU wobble
     reads a player's board position and every client has to agree on it, so
     changing any of this means a new room rather than a new setting.

     Draft order is the one thing NOT gated on this — see DraftOrder.jsx's
     own note on why those are two rules that merely overlap. */
  const locked = !!started || !!inRoom

  const patch = (p) => { engine.setLeague(p); redraw() }
  const scoringNames = engine.scoringNames()

  const save = () => {
    const why = engine.setupProblem()
    if (why) { setBlocked(why); return }
    onClose()
  }

  const body = (
    <>
      <Section icon={Tag} title="Draft name">
        {/* Uncontrolled-with-a-key would lose the caret on every keystroke,
            and controlled through engine.setLeague() is fine here precisely
            because a name is the one setting nothing derives from: it does
            not rebuild the board, so writing it per keystroke costs a
            re-render and nothing else. Contrast DivisorInput in
            ScoringRules.jsx, which must not commit per keystroke because
            each commit rescores 232 players. */}
        <input
          type="text"
          value={league.name || ''}
          maxLength={40}
          placeholder="Draft Name"
          disabled={locked}
          onChange={(e) => patch({ name: e.target.value })}
          className="w-full border-b border-slate-rule bg-transparent pb-2 text-[17px] text-ink placeholder:text-ink-muted focus:border-teal-400 focus:outline-none disabled:opacity-50"
        />
      </Section>

      <Section icon={ShieldCheck} title="Draft type">
        <PillGroup
          options={engine.draftTypes()}
          value={league.draftType}
          onChange={(key) => patch({ draftType: key })}
          disabled={locked}
          onUnavailable={setUnavailable}
        />
        {unavailable && (
          <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[12px] leading-relaxed text-amber-200/90">
            {unavailable.note}
          </p>
        )}
      </Section>

      {/* Snake only, and absent rather than disabled when the type is
          linear — "reverses the direction of the snake draft" is not a
          setting that has an off state in a draft with no snake in it, it
          is a setting that does not apply. A greyed toggle would invite the
          reader to work out why. */}
      {league.draftType === 'snake' && (
        <Section
          icon={ShieldCheck}
          title="Third round reversal"
          hint="Reverses the direction of the snake draft starting from the third round."
          action={
            <Switch
              checked={!!league.thirdRoundReversal}
              disabled={locked}
              label="Third round reversal"
              onChange={() => patch({ thirdRoundReversal: !league.thirdRoundReversal })}
            />
          }
        />
      )}

      <Section icon={Shield} title="Scoring (for rankings)">
        <div role="radiogroup" className="flex flex-col">
          {Object.keys(scoringNames).map((key) => {
            const preset = engine.scoringPreset(key)
            return (
              <RadioRow
                key={key}
                label={scoringNames[key]}
                note={preset ? preset.note : null}
                selected={league.scoring === key}
                disabled={locked}
                onSelect={() => patch({ scoring: key })}
              />
            )
          })}
        </div>
      </Section>

      <Section icon={Users} title="Teams">
        <CircleGroup
          options={engine.teamCounts().map((n) => ({ key: n, label: String(n) }))}
          value={league.teams}
          onChange={(n) => patch({ teams: n })}
          disabled={locked}
        />
      </Section>

      <Section
        icon={Users}
        title="Available players to draft"
        /* The count is the honest half of offering this. There are 38
           rookies on a 232-player board, so rookies-only is a three-round
           draft and not a fourteen-round one — and setupProblem() will
           refuse the second, correctly, with no clue here as to why unless
           the number is on screen beside the choice that caused it. */
        hint={`${engine.poolSize()} players on the board under this setting.`}
      >
        <PillGroup
          options={engine.playerPools()}
          value={league.playerPool}
          onChange={(key) => patch({ playerPool: key })}
          disabled={locked}
        />
      </Section>

      <Section icon={Timer} title="Time per pick">
        <CircleGroup
          options={CLOCK_CHOICES}
          value={engine.clockLength()}
          /* setClockLength(), not setLeague() — the pick clock is state,
             not league. It is per-drafter rather than part of the board's
             shape, which is why a room broadcasts it separately, and the
             settings modal wrote league.clock for two commits and read it
             back as undefined every time: a control that looked live,
             moved, and changed nothing. */
          onChange={(n) => { engine.setClockLength(n); redraw() }}
          disabled={!!started}
        />
      </Section>

      <Section
        icon={Cpu}
        title="CPU autopick"
        hint="When users run out of time."
        action={
          <Switch
            checked={league.cpuAutopick !== false}
            disabled={locked}
            label="CPU autopick when the clock runs out"
            onChange={() => patch({ cpuAutopick: league.cpuAutopick === false })}
          />
        }
      />

      <Section
        icon={Clipboard}
        title="Roster"
        hint={`Rds. ${league.rounds} — ${rosterLine(lineup)}`}
      >
        <div className="flex flex-col">
          {[
            ...['QB', 'RB', 'WR', 'TE'].map((pos) => ({
              key: pos, label: SLOT_LABEL[pos], value: lineup.starters[pos] || 0,
              set: (n) => patch({ starters: { ...lineup.starters, [pos]: n } }),
            })),
            { key: 'FLEX', label: SLOT_LABEL.FLEX, value: lineup.flex, max: 3, set: (n) => patch({ flex: n }) },
            { key: 'SFLEX', label: SLOT_LABEL.SFLEX, value: lineup.superflex, max: 1, set: (n) => patch({ superflex: n }) },
            ...['K', 'DST'].map((pos) => ({
              key: pos, label: SLOT_LABEL[pos], value: lineup.starters[pos] || 0,
              set: (n) => patch({ starters: { ...lineup.starters, [pos]: n } }),
            })),
            { key: 'BN', label: SLOT_LABEL.BN, value: lineup.bench, max: 15, set: (n) => patch({ bench: n }) },
          ].map((row) => (
            <div key={row.key} className="flex items-center gap-3 border-b border-slate-rule/40 py-2 last:border-b-0">
              <span
                className="h-[13px] w-[13px] shrink-0 rounded-full"
                style={{ backgroundColor: SLOT_DOT[row.key] }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{row.label}</span>
              <Stepper
                value={row.value}
                disabled={locked}
                max={row.max === undefined ? 9 : row.max}
                onAdd={() => row.set(row.value + 1)}
                onRemove={() => row.set(row.value - 1)}
              />
            </div>
          ))}
        </div>
        {/* Rounds follow the roster rather than being a second number kept
            equal to it by hand — setupProblem() refuses a draft whose roster
            size and round count disagree, and setLeague()'s own derivation in
            app.js closes every way of tripping that from here. This line is
            what makes the consequence visible while somebody is doing it,
            rather than at the Save button.

            That derivation credited a `setLineup()` that has never existed,
            and until 30 August 2026 it only ran for a scoring preset — so
            every stepper below was a dead control: one press produced
            "13 roster spots, but the draft runs 14 rounds" and there is no
            rounds control on this screen to answer it with. It is
            ROSTER_KEYS in setLeague() now, and this line is the proof it
            works: the number moves with the press. */}
        <p className="mt-3 text-[12px] text-ink-muted">
          {league.rounds} roster spots, so the draft runs {league.rounds} rounds.
        </p>
      </Section>

      <Section icon={ListOrdered} title="Draft order">
        <DraftOrder engine={engine} league={league} mySlot={mySlot} started={started} onChange={redraw} />
      </Section>

      {/* Collapsed by default — see ScoringRules.jsx's own note on why forty-
          nine numeric inputs is a screen rather than a section. */}
      <Section icon={Clock} title="Scoring rules">
        <button
          type="button"
          onClick={() => setShowRules((v) => !v)}
          className="flex w-full items-center gap-2 rounded-xl border border-slate-rule px-3.5 py-3 text-left"
        >
          {showRules ? <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />}
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink">Edit all {scoringRuleCount(engine)} scoring rules</span>
            <span className="block text-[12px] text-ink-muted">Every number rescores the whole board as you change it.</span>
          </span>
        </button>
        {showRules && <div className="mt-4"><ScoringRules engine={engine} locked={locked} onChange={redraw} /></div>}
      </Section>
    </>
  )

  const banner = locked ? (
    <p className="shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-[12px] leading-relaxed text-amber-200/90">
      {started
        ? 'This draft has started, so its settings are fixed — every seat has to agree on the same board.'
        : 'This room is set — every seat has to agree on the same board, so its shape is fixed from the moment the room exists. Make a new room to change it.'}
    </p>
  ) : (problem || blocked) ? (
    <p className="shrink-0 border-b border-rose-500/25 bg-rose-500/10 px-4 py-2 text-[12px] leading-relaxed text-rose-200/90">
      {problem || blocked}
    </p>
  ) : null

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate sm:items-center sm:bg-black/70 sm:p-3 sm:backdrop-blur-sm">
      <div className="flex h-full w-full flex-col overflow-hidden bg-slate sm:max-h-[820px] sm:max-w-lg sm:rounded-2xl sm:border sm:border-slate-rule sm:shadow-2xl">
        {/* The fixed bar. X on the left, title centred, Save on the right —
            the reference app's own arrangement, and the one that works on a
            phone: the two actions are at the two thumb corners and the title
            is the only thing in the middle, which is where a scrolling
            screen needs its name to stay. */}
        <div
          className="flex shrink-0 items-center gap-2 border-b border-slate-rule px-2 pb-2 pt-[env(safe-area-inset-top)]"
        >
          <button
            type="button" onClick={onClose} title="Close" aria-label="Close draft settings"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center font-display text-[21px] font-bold text-white">Draft Settings</h2>
          <button
            type="button" onClick={save}
            className="shrink-0 rounded-[10px] px-3 py-2.5 font-body text-[15px] font-bold text-teal-300"
          >
            Save
          </button>
        </div>

        {banner}

        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{body}</div>
      </div>
    </div>
  )
}
