import { useCallback, useState } from 'react'
import CockpitHeaderPhone from './CockpitHeaderPhone.jsx'
import DraftBoardPeekPhone from './DraftBoardPeekPhone.jsx'
import BottomSheet from '../BottomSheet.jsx'
import PlayersTabPhone from './PlayersTabPhone.jsx'
import QueueTabPhone from './QueueTabPhone.jsx'
import TeamTabPhone from './TeamTabPhone.jsx'
import ChatTabPhone from './ChatTabPhone.jsx'
import PlayerProfilePhone from './PlayerProfilePhone.jsx'

/* The header's height before it has measured itself — a first-paint
   estimate only, replaced within a frame by CockpitHeaderPhone's own
   ResizeObserver (see useReportHeight there for why this cannot be a
   constant). 106 is what it used to be hardcoded to: right on a notched
   phone, ~41px too tall everywhere else. Kept as the seed rather than
   dropped to the un-notched 65 because overshooting for one frame hides a
   sliver of board, and undershooting draws the board under the header. */
const HEADER_SEED_H = 106

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
  /* A counter, not a boolean — see DraftBoardGrid's own note on the prop
     it feeds. Pressing the crosshair twice in a row has to scroll twice,
     and only a value that changes every press can say that. */
  const [findLive, setFindLive] = useState(0)
  const [headerH, setHeaderH] = useState(HEADER_SEED_H)
  // Stable across renders so the observer in the header is set up once —
  // see useReportHeight's own note on why it deliberately does not list
  // this in its dependency array.
  const onHeaderHeight = useCallback((h) => setHeaderH((prev) => (prev === h ? prev : h)), [])
  /* The sheet's tallest snap has to stay below the fixed header (z-40,
     above the sheet's own z-30) — see BottomSheet.jsx's own comment on
     `maxHeight` for what goes wrong otherwise. The viewport height is read
     once at mount, as it always was; the header's own share of it is the
     part that has to be live, since the auto-pick ribbon can appear and
     disappear mid-draft. */
  const [viewportH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 0))
  const sheetMaxHeight = viewportH ? viewportH - headerH : undefined

  return (
    <>
      <CockpitHeaderPhone
        code={code}
        myTurn={myTurn}
        urgent={urgent}
        timeLeft={timeLeft}
        clockLength={clockLength}
        onOpenMenu={onOpenMenu}
        onFindLive={() => setFindLive((n) => n + 1)}
        autopick={autopick}
        onToggleAutopick={onToggleAutopick}
        onHeight={onHeaderHeight}
      />

      <DraftBoardPeekPhone
        engine={engine}
        league={league}
        picks={picks}
        mySlot={mySlot}
        onClock={onClock}
        onSelectPlayer={setSelectedPlayer}
        headerH={headerH}
        scrollToLiveSignal={findLive}
      />

      <BottomSheet
        snapIndex={sheetSnap}
        onSnapIndexChange={setSheetSnap}
        maxHeight={sheetMaxHeight}
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
