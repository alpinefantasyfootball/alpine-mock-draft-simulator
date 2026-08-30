import { useState } from 'react'
import CockpitHeaderPhone from './CockpitHeaderPhone.jsx'
import DraftBoardPeekPhone from './DraftBoardPeekPhone.jsx'
import BottomSheet from '../BottomSheet.jsx'
import PlayersTabPhone from './PlayersTabPhone.jsx'
import QueueTabPhone from './QueueTabPhone.jsx'
import TeamTabPhone from './TeamTabPhone.jsx'
import ChatTabPhone from './ChatTabPhone.jsx'
import PlayerProfilePhone from './PlayerProfilePhone.jsx'

const HEADER_H = 106 // CockpitHeaderPhone's own measured height: pt-1.5 row (44px hit targets) + mt-2 8px gap + 3px bar + ~1px border, rounded up
const TABS = [
  { key: 'players', label: 'Players' },
  { key: 'queue', label: 'Queue' },
  { key: 'team', label: 'Team' },
  { key: 'chat', label: 'Chat' },
]

// The whole "board peek" phone draft room (README's option 1a) — mounted
// once, from DraftRoom.jsx's own final return, only when usePhoneWidth()
// is true and the draft is live and not yet over (see that file's own
// comment on why `view === 'insights'` deliberately falls through to the
// existing render tree instead of being handled here: Insights is already
// responsive at every width today, so it needs no phone-specific rebuild).
//
// Every value below is something DraftRoom.jsx already computed for the
// desktop/tablet render — nothing here re-derives from `engine` a second
// time, same rule this whole file's siblings already follow.
export default function DraftRoomPhone({
  engine, league, picks, board, mySlot, onClock, overall, myTurn, code, urgent,
  timeLeft, clockLength, onOpenMenu,
  autopick, onToggleAutopick, over,
  rules, pointsFor, valueFor, vorpFor, survivalFor,
  photoFor, initialsFor, flexPositions, draftedByFor,
  queuedNames, queuePlayers, onToggleQueue, onDraft,
  filterCounts, tierAvgByPos, priorSeasonYear, projOf, season, onSetSeason,
}) {
  const [tab, setTab] = useState('players')
  const [sheetSnap, setSheetSnap] = useState(1)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [viewSlot, setViewSlot] = useState(mySlot)

  return (
    <>
      <CockpitHeaderPhone code={code} myTurn={myTurn} urgent={urgent} timeLeft={timeLeft} clockLength={clockLength} onOpenMenu={onOpenMenu} />

      <DraftBoardPeekPhone
        engine={engine}
        league={league}
        picks={picks}
        mySlot={mySlot}
        onClock={onClock}
        onSelectPlayer={setSelectedPlayer}
        headerH={HEADER_H}
      />

      <BottomSheet
        snapIndex={sheetSnap}
        onSnapIndexChange={setSheetSnap}
        header={
          <div className="flex w-full shrink-0 border-b border-white/[0.06] px-0">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={
                  'flex-1 border-b-2 py-[9px] text-center font-body text-[13px] font-semibold transition-colors duration-150 ' +
                  (tab === t.key ? 'border-teal-400 text-teal-300' : 'border-transparent text-ink-muted')
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {tab === 'players' && (
          <PlayersTabPhone
            engine={engine}
            league={league}
            board={board}
            mySlot={mySlot}
            myTurn={myTurn}
            rules={rules}
            pointsFor={pointsFor}
            valueFor={valueFor}
            vorpFor={vorpFor}
            survivalFor={survivalFor}
            photoFor={photoFor}
            initialsFor={initialsFor}
            flexPositions={flexPositions}
            draftedByFor={draftedByFor}
            queuedNames={queuedNames}
            onToggleQueue={onToggleQueue}
            onDraft={onDraft}
            filterCounts={filterCounts}
            tierAvgByPos={tierAvgByPos}
            priorSeasonYear={priorSeasonYear}
            projOf={projOf}
            season={season}
            onSetSeason={onSetSeason}
            onSelectPlayer={setSelectedPlayer}
          />
        )}
        {tab === 'queue' && (
          <QueueTabPhone
            queuePlayers={queuePlayers}
            survivalFor={survivalFor}
            onRemove={onToggleQueue}
            autopick={autopick}
            onToggleAutopick={onToggleAutopick}
            over={over}
          />
        )}
        {tab === 'team' && (
          <TeamTabPhone
            engine={engine}
            league={league}
            mySlot={mySlot}
            viewSlot={viewSlot}
            onViewSlot={setViewSlot}
            teamLabelOf={(slot) => engine.teamLabel(slot)}
            picks={picks}
            photoFor={photoFor}
            initialsFor={initialsFor}
          />
        )}
        {tab === 'chat' && (
          <ChatTabPhone engine={engine} onExpandSheet={() => setSheetSnap(2)} />
        )}
      </BottomSheet>

      {selectedPlayer && (
        <PlayerProfilePhone
          engine={engine}
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          rules={rules}
        />
      )}
    </>
  )
}
