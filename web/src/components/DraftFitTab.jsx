// Every other tab on this drawer describes the player. This one describes
// the *decision*: the same player is a steal in the third round and a
// mistake in the first, and nothing else on the sheet moves between those
// two cases. All of it comes from engine.draftFit() — the cap, the lineup
// and the snake are the league's shape, and CLAUDE.md's oldest rule is that
// none of that may be written down a second time.

// Shared shell so every row reads the same way: the fact large, the reason
// underneath it in the muted tone. Never a bare number — a number nobody can
// act on is the "correct value, wrong column" failure this project has
// already shipped once.
function FitRow({ label, value, tone, note }) {
  return (
    <div className="rounded-lg border border-slate-rule bg-slate-sunk/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={'text-lg font-bold ' + (tone || 'text-white')}>{value}</p>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{note}</p>}
    </div>
  )
}

export default function DraftFitTab({ fit, player }) {
  // Before a draft is running there is no roster to fit against and no next
  // pick to wait for. Saying so is the honest render; zeros would be facts
  // about nothing, which is the "0 from an API is not a real zero" rule
  // arriving from the UI side.
  if (!fit) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-muted">
        Draft fit appears once a draft is running — it measures this player
        against your roster and your next pick.
      </p>
    )
  }

  const { tierLeft, posLeft, picksAway, nextOverall, adp, have, atCap,
          startsNow, byeClash, bye, market, unranked } = fit

  /* There was a banner here saying the app would not take a kicker or a
     defense before a named round. It came off with the round gates in app.js
     that made it true: a seat picks its own moment for both positions now, so
     `legalFromRound` no longer exists to read and the sentence it wrote was
     the opposite of what the engine does. */

  // A gap of one is a spot, not spots. Small, and it is the sort of thing
  // that makes generated copy read as generated.
  const spots = (n) => `${n} spot${n === 1 ? '' : 's'}`

  // The wait is the whole point of the scarcity row: "8 left in his tier" is
  // patience if you pick again in three and a gamble if you pick again in
  // nineteen. Neither number means much alone, so they are one row.
  // Zero, not one, is "now": nextPickFor() starts its walk at the pick
  // currently being made, so when the clock is mine nextOverall IS that pick
  // and the difference is 0. Written as 1 first, which read as "0 picks until
  // your next" on my own turn — and then went on to argue about whether he
  // would survive a wait that was not happening.
  const waitText = picksAway === null
    ? 'You have no picks left'
    : picksAway === 0
      ? "You're on the clock now"
      : `${picksAway} picks until your next (${nextOverall} overall)`

  // ADP against the pick you actually next hold. Deliberately not dressed as
  // a probability — the data does not support one, and this project has a
  // standing rule against presenting a ranking as a measurement.
  // Nothing to say about surviving a wait when there is no wait.
  const survives = adp === null || picksAway === null || picksAway === 0
    ? null
    : adp > nextOverall

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <FitRow
          label="Left in his tier"
          value={tierLeft}
          tone={tierLeft <= 2 ? 'text-rose-300' : tierLeft <= 5 ? 'text-amber-300' : 'text-teal-300'}
          note={`${posLeft} ${player.pos} left on the board`}
        />
        <FitRow
          label="Your wait"
          value={picksAway === null ? '—' : picksAway === 0 ? 'Now' : picksAway}
          note={waitText}
        />
        <FitRow
          label="Would he start?"
          value={startsNow ? 'Yes' : 'Bench'}
          tone={startsNow ? 'text-teal-300' : 'text-white/70'}
          note={startsNow
            ? 'He cracks your best lineup as it stands today'
            : 'Depth today — which is a normal pick, not a bad one'}
        />
        <FitRow
          label={`${player.pos} you hold`}
          value={have}
          tone={atCap ? 'text-rose-300' : 'text-white'}
          note={atCap
            ? 'At the limit for this position'
            : have === 0 ? 'None yet' : 'Room for another'}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FitRow
          label="Bye week"
          value={bye ? `Wk ${bye}` : '—'}
          tone={byeClash >= 2 ? 'text-rose-300' : byeClash === 1 ? 'text-amber-300' : 'text-white'}
          note={!bye
            ? 'No bye recorded'
            : byeClash === 0
              ? 'Nobody on your roster is out that week'
              : `${byeClash} already on your roster ${byeClash === 1 ? 'is' : 'are'} out that week`}
        />
        {/* Board rank against the projection's rank, within his own position.
            It cannot compare across positions and is not asked to — the Juke
            score on Our Read already does that job.

            Withheld entirely for the positions we refuse to rank, rather than
            shown as a dash beside a confident tone: this measure rests on the
            projected positional order, which for a kicker is the ordering
            measured at r -0.09 in one season. A verdict we would not stand
            behind is not improved by being printed quietly. */}
        {unranked ? (
          <FitRow
            label="Market"
            value="Not ranked"
            tone="text-white/60"
            note={`We don't rank ${player.pos} — the projected order doesn't hold up against what actually happens`}
          />
        ) : (
          <FitRow
            label="Market"
            value={market === 0 ? 'Fair' : market > 0 ? `+${market}` : String(market)}
            tone={market > 0 ? 'text-teal-300' : market < 0 ? 'text-rose-300' : 'text-white'}
            note={market === 0
              ? 'Drafted about where we rank him'
              : market > 0
                ? `We rank him ${spots(market)} higher than the room does`
                : `The room rates him ${spots(Math.abs(market))} above where we do`}
          />
        )}
      </div>

      {survives !== null && (
        <p className="rounded-lg border border-slate-rule bg-slate-sunk/40 px-3 py-2 text-[11px] leading-relaxed text-white/50">
          His ADP is {adp.toFixed(1)} and your next pick is {nextOverall}.{' '}
          {survives
            ? 'On average he lasts that long — though ADP is an average, and no single draft looks like one.'
            : 'On average he is gone before then, so waiting is a real risk.'}
        </p>
      )}
    </div>
  )
}
