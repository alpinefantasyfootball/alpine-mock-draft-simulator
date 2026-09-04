import { useLeagueSnapshot } from '../../hooks/useLeague.js'

/* The League Room, on a connected league's real standings.

   ---- Why this is the room that went first ----

   Standings are a direct read. Sleeper's rosters carry wins, losses and
   points for, and its users carry the team names; joining them is the
   whole computation. Every other room needs Juke to have an opinion —
   what a claim is worth, whether an offer is fair, who to start — and an
   opinion needs designing. This one only needs the table drawn correctly,
   so it is what connecting buys on day one rather than a label change.

   ---- What is not here, and why it is absent rather than empty ----

   The handoff draws three segmented pills: Standings, Power, Chatter.
   Power is a ranking model nobody has specified and Chatter is league
   activity Sleeper does not expose in what we read. Drawing two pills that
   switch to nothing is the dead-control failure this project keeps
   finding, so there is one view and no pills at all — the same call
   UsageTab makes by removing its own tab rather than showing an empty
   panel.

   They come back as pills the day there is something behind them.

   ---- The ordering is ours, and it has to be said out loud ----

   Sleeper returns rosters in roster_id order, which is the order teams
   were created and means nothing. Sorted here by wins then points for,
   which is the standard tiebreak and what every fantasy table does — but
   it is a choice, and a league whose own settings break ties differently
   would disagree with us. `division` and tiebreak settings are in the
   league object and unread; when a league that uses them turns up, this is
   the function that owes them an answer rather than the table quietly
   being wrong. */

function ordered(teams) {
  return [...teams].sort((a, b) => (b.wins - a.wins) || (b.pointsFor - a.pointsFor))
}

export default function LeagueRoomLive({ league }) {
  const { snapshot, status, reason } = useLeagueSnapshot(league && league.leagueId)

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-10">
        <p className="text-[14px] text-ink-muted">Reading {league.name}…</p>
      </div>
    )
  }

  if (status === 'error' || !snapshot) {
    /* Says which failure it was, because the two want different things
       from the reader. `not-found` means the league is gone or was
       renamed out from under the connection — worth reconnecting.
       Anything else is worth waiting out. */
    return (
      <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-10">
        <div className="rounded-2xl border border-line-hairline bg-[#151920] p-6">
          <div className="font-display text-[20px] font-bold text-white">
            {reason === 'not-found' ? 'That league is no longer readable' : 'Could not reach Sleeper'}
          </div>
          <p className="mt-1.5 max-w-[52ch] text-[14px] leading-[1.5] text-voidInk-body">
            {reason === 'not-found'
              ? 'Sleeper does not return this league any more. It may have been deleted, or the season rolled over — reconnect it from the You screen.'
              : 'Your standings are on Sleeper and it did not answer. Nothing is wrong with your league; try again in a moment.'}
          </p>
        </div>
      </div>
    )
  }

  const table = ordered(snapshot.teams)
  const mine = league.ownerId || null

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-10 pt-2 sm:px-10 sm:pt-4">
      <div className="lg:grid lg:grid-cols-[1.4fr_0.6fr] lg:items-start lg:gap-4">
        <div className="overflow-hidden rounded-[18px] border border-line-hairline bg-[#151920] px-4 pb-1 pt-1.5">
          {table.map((t, i) => {
            const you = mine && t.ownerId === mine
            return (
              <div
                key={t.rosterId ?? `${t.teamName}-${i}`}
                className="grid grid-cols-[22px_1fr_auto_auto] items-center gap-2.5 border-b border-line-hairline py-[11px] last:border-b-0"
                style={
                  you
                    ? {
                        background: 'linear-gradient(90deg, rgba(0,229,255,.08), transparent)',
                        margin: '0 -8px',
                        padding: '11px 8px',
                        borderRadius: 10,
                      }
                    : undefined
                }
              >
                {/* Ranks 1-2 in mint, which is the handoff's own mark for
                    the top of a table rather than a podium of three. */}
                <span
                  className="font-mono text-[12px]"
                  style={{ color: i < 2 ? '#74E5CE' : '#8A9BAA' }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className="block truncate text-[14px] font-semibold"
                    style={{ color: you ? '#00E5FF' : '#fff' }}
                  >
                    {you ? 'You · ' : ''}
                    {t.teamName}
                  </span>
                  {/* The manager under the team name, and only when it is
                      not the same string — a manager who never renamed
                      their team would otherwise get it twice. */}
                  {t.manager && t.manager !== t.teamName ? (
                    <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                      {t.manager}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-[12px] text-voidInk-primary">
                  {t.wins}-{t.losses}
                  {t.ties ? `-${t.ties}` : ''}
                </span>
                <span className="min-w-[52px] text-right font-mono text-[12px] text-ink-muted">
                  {t.pointsFor.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-[18px] border border-line-hairline bg-[#151920] p-[18px] lg:mt-0">
          <span className="font-mono text-[10px] tracking-[0.14em] text-flow-gold">THE LEAGUE</span>
          <div className="mt-2 font-display text-[22px] font-bold text-white">{snapshot.name}</div>
          <dl className="mt-3 flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Season</dt>
              <dd className="text-voidInk-primary">{snapshot.season}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Teams</dt>
              <dd className="text-voidInk-primary">{snapshot.totalTeams}</dd>
            </div>
            {snapshot.week ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Week</dt>
                <dd className="text-voidInk-primary">{snapshot.week}</dd>
              </div>
            ) : null}
            {snapshot.playoffTeams ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Playoff spots</dt>
                <dd className="text-voidInk-primary">{snapshot.playoffTeams}</dd>
              </div>
            ) : null}
          </dl>
          {/* Read-only is the promise the connect flow made; repeating it
              on the one screen that shows real league data is where it is
              worth the two lines. */}
          <p className="mt-3.5 border-t border-line-hairline pt-3 text-[12px] leading-[1.45] text-ink-muted">
            Read from Sleeper. Juke never writes to your league.
          </p>
        </div>
      </div>
    </div>
  )
}
