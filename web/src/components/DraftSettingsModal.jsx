import { useEffect, useRef, useState } from 'react'
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

const TABS = ['General', 'Roster', 'Scoring', 'Order', 'Invite']

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

export default function DraftSettingsModal({ engine, onClose, started, inRoom, mySlot }) {
  const [tab, setTab] = useState('General')
  /* Pick a seat up, then put it down on another - the same two taps the
     legacy order list used, and the reason is touch: a drag needs a pointer
     that can hover and a target that does not scroll under it, and this list
     scrolls. Tapping the held seat again puts it back down, which is the only
     way out of a tap you did not mean. */
  const [held, setHeld] = useState(null)
  /* The ref is what the click reads; the state is only what draws the
     highlight. An onClick closes over the `held` of its own render, so two
     clicks inside one frame both see null and the second picks a seat up
     instead of swapping - which is the tray chevron's bug again, in a
     different control. A ref is current at click time whatever the speed. */
  const heldRef = useRef(null)
  const hold = (i) => { heldRef.current = i; setHeld(i) }
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
  /* Locked once a draft exists *or* a room does, and for the host too.

     Started was the only condition at first, which left every setting open
     to everybody sitting in a room lobby - and a guest who changes the
     scoring rebuilds their own board out from under the draft they are in.
     Nothing on screen would say so: their replacement levels, suggestions
     and grade would simply stop describing everybody else's draft, and
     adoptRoom() cannot put it back, because a room only ever broadcasts the
     league it was created with.

     The room's shape is fixed the moment the room exists. The CPU wobble
     reads a player's board position and every client has to agree on it, so
     changing any of this means a new room rather than a new setting. */
  const locked = !!started || !!inRoom

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
            {started
              ? 'This draft has started, so its settings are fixed — every seat has to agree on the same board.'
              : 'This room is set — every seat has to agree on the same board, so its shape is fixed from the moment the room exists. Make a new room to change it.'}
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
                {/* state.clockLength, not league.clock. There is no
                    league.clock and there never was - this read undefined and
                    wrote a field nothing consumes, so the control moved and
                    did nothing for two commits. The pick clock is per-drafter
                    rather than part of the board's shape, which is also why a
                    room broadcasts it separately from the league. */}
                <Row label="Seconds per pick">
                  <Select
                    value={engine.clockLength()} disabled={locked}
                    onChange={(e) => { engine.setClockLength(e.target.value); redraw() }}
                  >
                    {[30, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Row>
                {/* A preference rather than a setting the room agrees on, so
                    it is not locked with the rest — and it is here because the
                    status bar ran out of room for it on a phone. Four icon
                    buttons plus the autopick pill overflowed a 375px bar by
                    27px once the settings gear joined them, and sound is the
                    one of the five that is set once rather than reached for
                    mid-pick. */}
                <Row label="Draft sounds" hint="A cue when your turn starts, and when the clock runs down.">
                  <button
                    type="button"
                    onClick={() => { engine.toggleSound(); redraw() }}
                    aria-pressed={engine.soundWanted()}
                    className={
                      'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ' +
                      (engine.soundWanted()
                        ? 'bg-teal-500/20 text-teal-300'
                        : 'bg-white/5 text-white/50 hover:bg-white/10')
                    }
                  >
                    {engine.soundWanted() ? 'On' : 'Off'}
                  </button>
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

            {tab === 'Order' && (() => {
              const room = engine.room()
              const seats = room && room.seats ? room.seats : null
              const isHost = !!engine.isHost()
              /* Three different read-only reasons, and they are not the same
                 sentence. A guest is not allowed; a solo drafter has nobody to
                 order; a started draft is fixed. Saying "you cannot do this"
                 without saying which would be the dead-control problem with a
                 label on it. */
              /* Not `locked`. That one is about the league's *shape* - the
                 lineup, the scoring, the team count - which is fixed the
                 moment a room exists because every client has to agree on the
                 board the wobble reads. Draft order is not the board: the
                 room allows a host to swap seats for as long as its status is
                 "lobby", and Room.swapSeats says so itself.

                 Collapsing the two locked the host out of the one thing this
                 tab is for. Two rules that happen to overlap are still two
                 rules. */
              const canOrder = !!seats && isHost && !started

              if (!seats) {
                /* mySlot, not engine.mySlot(): the latter is the *committed*
                   draft engine seat, which is only real once startDraft()
                   sets it. This tab is reachable from the "choose your
                   seat" screen too, where the seat is still a live,
                   unstarted local selection — the same divergence
                   DraftLobby.jsx and DraftBoardGrid.jsx already work around
                   for the board itself, just not previously threaded
                   through to here. Before a draft exists, mySlot is
                   whatever the caller's own live selection is.

                   And engine.cpuName(i), not engine.teamLabel(i), for the
                   same reason DraftLobby.jsx passes cpuName instead of
                   teamLabel to the board: teamLabel() answers "is this
                   mine" by comparing against the same stale state.mySlot,
                   so asking it for a seat that *isn't* locally mine would
                   still print "Your Team" if that seat happened to equal
                   the stale value — the exact half-fixed bug this file
                   already hit once on the board itself. mine is already
                   known here from the live prop; cpuName just names a
                   seat, with no comparison left to get stale. */
                return (
                  <div>
                    <p className="mb-3 text-[11px] leading-relaxed text-white/45">
                      Draft order is something a room decides. On your own the other
                      chairs are computer teams and the order between them changes
                      nothing — the only seat that matters is yours, and you claim
                      that on the board.
                    </p>
                    <ol className="overflow-hidden rounded-lg border border-slate-800">
                      {Array.from({ length: league.teams }, (_, i) => (
                        <li key={i} className="flex items-center gap-3 border-b border-slate-800/60 px-3 py-2 last:border-b-0">
                          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-white/30">{i + 1}</span>
                          <span className={'text-sm ' + (i === mySlot ? 'font-semibold text-teal-300' : 'text-white/60')}>
                            {i === mySlot ? 'You' : engine.cpuName(i)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )
              }

              return (
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] leading-relaxed text-white/45">
                      {started
                        ? 'The draft has started, so the order is fixed.'
                        : isHost
                          ? held === null
                            ? 'Tap a seat to pick it up, then tap another to swap them.'
                            : 'Now tap the seat to swap it with — or tap it again to put it back.'
                          : 'Only the host can set the draft order.'}
                    </p>
                    {canOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          /* Fisher-Yates, sent as the swaps it is made of,
                             because swapSeats is the only thing the room
                             exposes and the room is the thing that decides.
                             At most teams-1 messages - thirteen at the largest
                             league - well inside the forty-per-ten-seconds a
                             socket is allowed. */
                          const n = league.teams
                          for (let i = n - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1))
                            if (i !== j) engine.swapSeats(i, j)
                          }
                          hold(null)
                        }}
                        className="shrink-0 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-white/70 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300"
                      >
                        Randomize order
                      </button>
                    )}
                  </div>

                  <ol className="overflow-hidden rounded-lg border border-slate-800">
                    {seats.map((chair, i) => {
                      const isHeld = held === i
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            disabled={!canOrder}
                            onClick={() => {
                              const current = heldRef.current
                              if (current === null) { hold(i); return }
                              if (current !== i) engine.swapSeats(current, i)
                              hold(null)
                            }}
                            className={
                              'flex w-full items-center gap-3 border-b border-slate-800/60 px-3 py-2 text-left transition-colors duration-150 last:border-b-0 ' +
                              (isHeld
                                ? 'bg-teal-500/15 ring-1 ring-inset ring-teal-400/50'
                                : canOrder ? 'hover:bg-white/5' : 'cursor-default')
                            }
                          >
                            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-white/30">{i + 1}</span>
                            <span className={'min-w-0 flex-1 truncate text-sm ' + (chair.you ? 'font-semibold text-teal-300' : 'text-white/70')}>
                              {chair.you ? 'You' : chair.name || (chair.taken ? 'A manager' : 'Open')}
                            </span>
                            {/* An empty chair is a real state in a room that
                                has not filled up, and it is not the same as a
                                manager who has not named themselves. */}
                            {!chair.taken && (
                              <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/25">Open</span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )
            })()}

            {tab === 'Invite' && <RoomPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
