import { SampleCard, AccentCard } from './sampleParts.jsx'

/* design_handoff_v3_alive 2ig/3ig — the whole table.

   The one preview with nothing to read off the board, and that is honest
   rather than a shortcut: a standings table is managers, records and points
   for, and this app has no league, so there is no live source for any of
   the three. Every other preview derives its players because a player is a
   real thing the pipeline knows about; a manager called Sarah is not.

   So it is sample content end to end, announced as such by the hero, and
   the segmented pills are drawn in their resting state rather than wired —
   `Standings` is selected and the other two are not, because behind a blur
   a control that could be pressed is a control that would need somewhere to
   go. */

const ROWS = [
  { rank: 1, name: 'Sarah', rec: '3-0', pf: '412.8' },
  { rank: 2, name: 'Marcus', rec: '2-1', pf: '389.1' },
  { rank: 3, name: 'You · Juke Sharks', rec: '2-1', pf: '377.4', you: true },
  { rank: 4, name: 'Dev', rec: '2-1', pf: '361.0' },
  { rank: 5, name: 'Priya', rec: '1-2', pf: '340.2' },
  { rank: 6, name: 'Tom', rec: '1-2', pf: '332.6' },
]

const CHATTER = [
  { who: 'Sarah', rest: ' is shopping a WR2 and has two open bench spots.' },
  { who: 'Marcus', rest: ' claimed three kickers in a row. Nobody knows why.' },
  { who: 'Priya', rest: ' has not set a lineup since week one.' },
]

export default function LeaguePreview() {
  /* Standings left, chatter right on desktop (3ig). The segmented pills
     stay above both, spanning the row: they switch what the LEFT column
     shows, so putting them over one column would be a control that looks
     like it belongs to whichever half it sits above. */
  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
      <div className="mb-3 flex gap-2 lg:col-span-2">
        {['Standings', 'Power', 'Chatter'].map((p, i) => (
          <span
            key={p}
            className="rounded-full border px-3.5 py-[7px] text-[13px] font-semibold"
            style={
              i === 0
                ? { borderColor: '#F7D9A8', background: '#2a2416', color: '#F7D9A8' }
                : { borderColor: '#252930', color: '#B9BCC1' }
            }
          >
            {p}
          </span>
        ))}
      </div>

      <SampleCard className="!px-4 !pb-1 !pt-1.5">
        {ROWS.map((r) => (
          <div
            key={r.rank}
            className="grid grid-cols-[22px_1fr_auto_auto] items-center gap-2.5 border-b border-line-hairline py-[11px] last:border-b-0"
            style={
              r.you
                ? {
                    background: 'linear-gradient(90deg, rgba(0,229,255,.08), transparent)',
                    margin: '0 -8px',
                    padding: '11px 8px',
                    borderRadius: 10,
                  }
                : undefined
            }
          >
            {/* Ranks 1-2 in mint. Not "the top half" and not a podium —
                the handoff marks exactly two, which is what a six-team
                slice of a twelve-team table can honestly call the top. */}
            <span
              className="font-mono text-[12px]"
              style={{ color: r.rank <= 2 ? '#74E5CE' : '#8A9BAA' }}
            >
              {r.rank}
            </span>
            <span
              className="truncate text-[14px] font-semibold"
              style={{ color: r.you ? '#00E5FF' : '#fff' }}
            >
              {r.name}
            </span>
            <span className="font-mono text-[12px] text-voidInk-primary">{r.rec}</span>
            <span className="min-w-[44px] text-right font-mono text-[12px] text-ink-muted">
              {r.pf}
            </span>
          </div>
        ))}
      </SampleCard>

      <div className="lg:[&>div]:mt-0">
      <AccentCard accent="#F7D9A8" wash="#2a2416" eyebrow="LEAGUE CHATTER">
        <div className="mt-2.5 flex flex-col gap-3">
          {CHATTER.map((c) => (
            <div key={c.who} className="flex items-start gap-2.5">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-[13px] font-extrabold text-surface-page"
                style={{ background: '#F7D9A8' }}
              >
                {c.who[0]}
              </span>
              <p className="m-0 text-[13px] leading-[1.45] text-voidInk-body">
                <b className="font-semibold text-white">{c.who}</b>
                {c.rest}
              </p>
            </div>
          ))}
        </div>
      </AccentCard>
      </div>
    </div>
  )
}
