import { useEffect, useState } from 'react'

/* The scoring editor, lifted out of DraftSettingsModal.jsx when that file
   became the whole Draft Settings screen rather than a three-tab modal.

   Nothing about what it does changed in the move. It is still a rendering of
   engine.scoringEditor() / setScoringRule() / resetScoringRules() and
   nothing else — the engine owns the rules, the groups, the labels and which
   of them can move a projection, and this draws them. A second idea of what
   a scoring rule is, living in web/src, is the exact failure CLAUDE.md's
   "nothing about the league shape may be written down twice" is about.

   It is the one section of the settings screen collapsed by default, and
   that is a judgement about the screen rather than about the editor. Forty-
   nine numeric inputs is not a section, it is a screen; the nine other
   things on this page are what somebody opening Draft Settings is far more
   likely to have come for. Shut, it still says what it is and how many rules
   are behind it — which is more than it managed for the months it was
   display:none inside the legacy setup screen with no way to reach it at
   all. */

function Row({ label, children, hint }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-slate-rule/60 py-2.5 last:border-b-0">
      <span className="min-w-0">
        <span className="block text-sm text-white/80">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-ink-muted">{hint}</span>}
      </span>
      <span className="shrink-0">{children}</span>
    </label>
  )
}

/* Committing per keystroke was the real bug, not just a missing max.
   pointsFromDivisor(0) (app.js) returns 0 rather than being rejected —
   `!n` is true for a literal zero in JS, and that function treats it the
   same as "field left blank" — so typing "0" into "1 point every N yards"
   silently scored that stat at zero, live, on every keystroke while
   typing, not just on whatever got left at blur. Local text state while
   typing; one real commit on blur (or Enter), and only if it parses to a
   sane divisor — otherwise the field reverts to the last value that
   actually made it into league.rules, which is the field's own feedback
   that the edit didn't take. */
function DivisorInput({ rule, disabled, onCommit }) {
  const [text, setText] = useState(String(rule.divisor))
  // Follows rule.divisor when it changes for a reason other than this
  // input's own edits — Reset, or another manager's settings arriving in
  // a room — not just on mount.
  useEffect(() => { setText(String(rule.divisor)) }, [rule.divisor])

  const commit = () => {
    const n = Number(text)
    if (text.trim() === '' || !isFinite(n) || n < 1 || n > 999) {
      setText(String(rule.divisor))
      return
    }
    onCommit(n)
  }

  return (
    <input
      type="number" min="1" max="999" step="1" value={text} disabled={disabled}
      title="1 to 999 yards"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="w-16 rounded-lg border border-slate-rule bg-slate-sunk px-2 py-1 text-base tabular-nums text-white disabled:text-white/30 lg:text-sm"
    />
  )
}

export default function ScoringRules({ engine, locked, onChange }) {
  const groups = engine.scoringEditor()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-snug text-ink-muted">
          Every number here rescores the whole board as you change it —
          projections, value over replacement and the Juke score with it.
        </p>
        <button
          type="button" disabled={locked}
          onClick={() => { engine.resetScoringRules(); onChange() }}
          className="shrink-0 rounded-full border border-slate-rule px-3 py-1 text-xs font-semibold text-white/60 transition-colors duration-150 hover:border-teal-400/50 hover:text-teal-300 disabled:cursor-not-allowed disabled:border-slate-rule disabled:text-white/20"
        >
          Reset
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{group.title}</p>
          <div className="flex flex-col">
            {group.rules.map((rule) => (
              <Row
                key={rule.key}
                label={rule.label}
                /* A rule Sleeper does not forecast still scores every past
                   season correctly — it just cannot move the projection the
                   board is ranked on. Said on the rule rather than in a
                   paragraph nobody reads while editing a number. */
                hint={rule.historyOnly ? 'Scores past seasons; does not move this projection' : null}
              >
                {rule.perYard ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] text-ink-muted">1 pt every</span>
                    <DivisorInput
                      rule={rule}
                      disabled={locked}
                      onCommit={(n) => { engine.setScoringRule(rule.key, n, true); onChange() }}
                    />
                    <span className="text-[11px] text-ink-muted">yds</span>
                  </span>
                ) : (
                  <input
                    type="number" step="0.5" min="-99" max="99" value={rule.value} disabled={locked}
                    onChange={(e) => { engine.setScoringRule(rule.key, e.target.value); onChange() }}
                    className="w-20 rounded-lg border border-slate-rule bg-slate-sunk px-2 py-1 text-base tabular-nums text-white disabled:text-white/30 lg:text-sm"
                  />
                )}
              </Row>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// How many editable rules there are, for the collapsed section's own label.
// Derived from the same engine.scoringEditor() the editor renders, never a
// literal — the number moved from 38 to 44 to 49 over the life of this
// project and a hardcoded count would have been wrong for most of it.
export function scoringRuleCount(engine) {
  return engine.scoringEditor().reduce((n, g) => n + g.rules.length, 0)
}
