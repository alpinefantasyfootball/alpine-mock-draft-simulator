import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import RoomPanel from './RoomPanel.jsx'
import { POS_BADGE } from './draftRoomPositions.js'

/* Everything a league is, in one place, reachable from the Draft Room.

   Two of these tabs describe things that already worked and simply could not
   be reached: the starting lineup and the scoring table both live in the
   legacy setup screen, which is display:none since DraftSettings.jsx replaced
   it. Roster construction and 44 editable scoring rules have been in the
   product the whole time with no way to open them.

   Nothing here computes anything. The lineup comes from engine.lineup(), the
   rules from engine.scoringEditor(), the validation from engine.setupProblem()
   — all of it the same single source app.js already owns. A second idea of
   what a league is, living in web/src, is the exact failure CLAUDE.md's
   "nothing about the league shape may be written down twice" is about, and
   the superflex grading bug is what it looks like when it happens. */

const TABS = ['General', 'Roster', 'Scoring', 'Invite']

/* The lineup as an ordered list of slots, the way a roster actually reads,
   built from the counts league.starters already holds. Sleeper shows a list;
   we keep the counts. Rendering one from the other costs nothing and avoids a
   second model of the same fact. */
function slotsFrom(lineup) {
  const rows = []
  const push = (pos, n) => { for (let i = 0; i < n; i++) rows.push(pos) }
  push('QB', lineup.starters.QB || 0)
  push('RB', lineup.starters.RB || 0)
  push('WR', lineup.starters.WR || 0)
  push('TE', lineup.starters.TE || 0)
  push('FLEX', lineup.flex || 0)
  push('SFLEX', lineup.superflex || 0)
  push('K', lineup.starters.K || 0)
  push('DST', lineup.starters.DST || 0)
  push('BN', lineup.bench || 0)
  return rows
}

const SLOT_LABEL = { FLEX: 'FLEX (W/R/T)', SFLEX: 'SUPERFLEX (Q/W/R/T)', BN: 'Bench', DST: 'DEF' }

function Row({ label, children, hint }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-slate-800/60 py-2.5 last:border-b-0">
      <span className="min-w-0">
        <span className="block text-sm text-white/80">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-white/40">{hint}</span>}
      </span>
      <span className="shrink-0">{children}</span>
    </label>
  )
}

function Select({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      /* 16px on a touch screen or iOS zooms the page in and does not zoom
         back out — CLAUDE.md's floor, which the type scale already meets. */
      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-base text-white disabled:cursor-not-allowed disabled:text-white/30 lg:text-sm"
    >
      {children}
    </select>
  )
}

function Stepper({ value, onAdd, onRemove, disabled, min = 0, max = 9 }) {
  return (
    <span className="flex items-center gap-2">
      <button
        type="button" onClick={onRemove} disabled={disabled || value <= min}
        aria-label="One fewer" title="One fewer"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-white/60 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-white/15"
      >−</button>
      <span className="w-5 text-center text-sm font-semibold tabular-nums text-white">{value}</span>
      <button
        type="button" onClick={onAdd} disabled={disabled || value >= max}
        aria-label="One more" title="One more"
        className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 text-white/60 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-white/15"
      >+</button>
    </span>
  )
}

export default function DraftSettingsModal({ engine, onClose, started }) {
  const [tab, setTab] = useState('General')
  const [, bump] = useState(0)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const league = engine.league()
  const lineup = engine.lineup()
  const problem = engine.setupProblem()
  const redraw = () => bump((n) => n + 1)

  /* Locked once a draft exists, and for the host too. The CPU wobble reads a
     player's board position, so every client has to agree on the board — the
     shape is fixed the moment the draft starts, and changing it means a new
     draft. This is the panel refusing rather than the fields being disabled
     one by one: that list was incomplete once already, and 38 scoring inputs
     stayed editable to guests because they are drawn rather than named. */
  const locked = !!started

  /* Rounds follow the roster, rather than being a second number that has to
     be kept equal to it by hand. setupProblem() refuses a draft whose roster
     size and round count disagree, and every way of tripping that from this
     tab is closed by deriving one from the other — the same thing Sleeper's
     "ROSTER SIZE 15" against 15 rounds is saying. */
  const setLineup = (patch) => {
    const next = {
      starters: { ...lineup.starters },
      flex: lineup.flex,
      superflex: lineup.superflex,
      bench: lineup.bench,
      ...patch,
    }
    const size =
      Object.values(next.starters).reduce((a, b) => a + b, 0) +
      next.flex + next.superflex + next.bench
    engine.setLeague({
      starters: next.starters,
      flex: next.flex,
      superflex: next.superflex,
      bench: next.bench,
      rounds: size,
    })
    redraw()
  }

  const slots = slotsFrom(lineup)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="flex h-full max-h-[760px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0B0E14] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-white">Draft settings</h2>
            {/* leagueSummary() is the same string the shut setup box shows —
                never a second copy of the same lookup. */}
            <p className="truncate text-[11px] text-white/45">{engine.settingsText(league)}</p>
          </div>
          <button
            type="button" onClick={onClose} title="Close" aria-label="Close draft settings"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-800 bg-slate-950/60 text-white/60 transition-colors duration-150 hover:border-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {locked && (
          <p className="shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-[11px] leading-relaxed text-amber-200/90">
            This draft has started, so its settings are fixed — every seat has to
            agree on the same board. Start a new draft to change them.
          </p>
        )}

        {problem && !locked && (
          <p className="shrink-0 border-b border-rose-500/25 bg-rose-500/10 px-4 py-2 text-[11px] leading-relaxed text-rose-200/90">
            {problem}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
            {TABS.map((t) => (
              <button
                key={t} type="button" onClick={() => setTab(t)}
                className={
                  'shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors duration-150 ' +
                  (tab === t ? 'bg-teal-500/15 text-teal-300' : 'text-white/50 hover:bg-white/5 hover:text-white/80')
                }
              >
                {t}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'General' && (
              <div className="flex flex-col">
                <Row label="Teams">
                  <Select
                    value={league.teams} disabled={locked}
                    onChange={(e) => { engine.setLeague({ teams: Number(e.target.value) }); redraw() }}
                  >
                    {engine.teamCounts().map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Row>
                <Row label="Scoring" hint="Sets receptions. Every other rule stays as you left it — see the Scoring tab.">
                  <Select
                    value={league.scoring} disabled={locked}
                    onChange={(e) => { engine.setLeague({ scoring: e.target.value }); redraw() }}
                  >
                    {Object.entries(engine.scoringNames()).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </Row>
                <Row label="Seconds per pick">
                  <Select
                    value={league.clock ?? 90} disabled={locked}
                    onChange={(e) => { engine.setLeague({ clock: Number(e.target.value) }); redraw() }}
                  >
                    {[30, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Row>
                <Row label="Rounds" hint="Follows the roster — add or remove a slot on the Roster tab.">
                  <span className="text-sm font-semibold tabular-nums text-white/70">{league.rounds}</span>
                </Row>
              </div>
            )}

            {tab === 'Roster' && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  Roster size {slots.length}
                </p>
                <div className="mb-4 overflow-hidden rounded-lg border border-slate-800">
                  {slots.map((pos, i) => (
                    <div
                      key={pos + i}
                      className="flex items-center gap-2 border-b border-slate-800/60 px-2 py-1.5 last:border-b-0"
                    >
                      <span className={'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ' + (POS_BADGE[pos] || 'bg-white/10 text-white/50')}>
                        {pos === 'SFLEX' ? 'SF' : pos === 'DST' ? 'DEF' : pos}
                      </span>
                      <span className="text-xs text-white/60">{SLOT_LABEL[pos] || pos}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col">
                  {['QB', 'RB', 'WR', 'TE', 'K', 'DST'].map((pos) => (
                    <Row key={pos} label={pos === 'DST' ? 'DEF' : pos}>
                      <Stepper
                        value={lineup.starters[pos] || 0} disabled={locked}
                        onAdd={() => setLineup({ starters: { ...lineup.starters, [pos]: (lineup.starters[pos] || 0) + 1 } })}
                        onRemove={() => setLineup({ starters: { ...lineup.starters, [pos]: (lineup.starters[pos] || 0) - 1 } })}
                      />
                    </Row>
                  ))}
                  <Row label="FLEX" hint={'Any of ' + engine.flexPositions().join(', ')}>
                    <Stepper value={lineup.flex} disabled={locked}
                      onAdd={() => setLineup({ flex: lineup.flex + 1 })}
                      onRemove={() => setLineup({ flex: lineup.flex - 1 })} />
                  </Row>
                  <Row label="Superflex" hint="A second startable quarterback. Lifts how many QBs a team will hold.">
                    <Stepper value={lineup.superflex} disabled={locked} max={1}
                      onAdd={() => setLineup({ superflex: lineup.superflex + 1 })}
                      onRemove={() => setLineup({ superflex: lineup.superflex - 1 })} />
                  </Row>
                  <Row label="Bench">
                    <Stepper value={lineup.bench} disabled={locked} max={15}
                      onAdd={() => setLineup({ bench: lineup.bench + 1 })}
                      onRemove={() => setLineup({ bench: lineup.bench - 1 })} />
                  </Row>
                </div>
              </div>
            )}

            {tab === 'Scoring' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] leading-snug text-white/45">
                    Every number here rescores the whole board as you change it —
                    projections, value over replacement and the Juke score with it.
                  </p>
                  <button
                    type="button" disabled={locked}
                    onClick={() => { engine.resetScoringRules(); redraw() }}
                    className="shrink-0 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-white/60 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-white/20"
                  >
                    Reset
                  </button>
                </div>

                {engine.scoringEditor().map((group) => (
                  <div key={group.title}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">{group.title}</p>
                    <div className="flex flex-col">
                      {group.rules.map((rule) => (
                        <Row
                          key={rule.key}
                          label={rule.label}
                          /* A rule Sleeper does not forecast still scores every
                             past season correctly — it just cannot move the
                             projection the board is ranked on. Said on the rule
                             rather than in a paragraph nobody reads while
                             editing a number. */
                          hint={rule.historyOnly ? 'Scores past seasons; does not move this projection' : null}
                        >
                          {rule.perYard ? (
                            <span className="flex items-center gap-1.5">
                              <span className="text-[11px] text-white/40">1 pt every</span>
                              <input
                                type="number" min="1" step="1" value={rule.divisor} disabled={locked}
                                onChange={(e) => { engine.setScoringRule(rule.key, e.target.value, true); redraw() }}
                                className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-base tabular-nums text-white disabled:text-white/30 lg:text-sm"
                              />
                              <span className="text-[11px] text-white/40">yds</span>
                            </span>
                          ) : (
                            <input
                              type="number" step="0.5" value={rule.value} disabled={locked}
                              onChange={(e) => { engine.setScoringRule(rule.key, e.target.value); redraw() }}
                              className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-base tabular-nums text-white disabled:text-white/30 lg:text-sm"
                            />
                          )}
                        </Row>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'Invite' && <RoomPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
