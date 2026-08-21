import { useState } from 'react'
import { Check, Copy, Crown, LogOut, Users } from 'lucide-react'
import { useEngine, useJukeTick } from '../hooks/useJukeEngine.js'

const STATUS_TEXT = {
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  closed: 'Disconnected.',
}

export default function RoomPanel() {
  const engine = useEngine()
  useJukeTick(engine)
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)

  if (!engine) return null

  const hasRoomVal = engine.hasRoom()
  const status = engine.liveStatus()
  const reason = engine.liveReason()

  if (!hasRoomVal) {
    /* Creating or joining a room here doesn't add a room to what you're
       doing — it replaces it. adoptRoom() (app.js) sets state.started to
       the *room's* status (a fresh room is "lobby", so started snaps back
       to false) and, since a real solo pick count essentially never
       matches a brand-new room's empty one, wipes state.picks and
       un-drafts the whole board to match it — no confirmation, because
       there was never a path meant to reach this mid-draft at all: a room
       is a shape decided before a draft starts, not something an existing
       one can be converted into. Gating here is the only fix that doesn't
       need a confirmation dialog defending against a scenario nothing else
       in the room model supports. */
    const started = !!engine.headerInfo().started
    const handleJoin = () => {
      if (started) return
      const code = joinCode.trim().toUpperCase()
      if (code) engine.joinRoomByCode(code)
    }
    return (
      <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-white">Draft with friends</h2>
        <p className="mt-1 text-sm text-white/50">
          {started
            ? "Can't create or join a room mid-draft — a room replaces the board it's on rather than adopting it, which would discard every pick made so far. Finish or discard this draft first."
            : 'Same board, same picks, everyone watching the same clock.'}
        </p>

        <button
          type="button"
          onClick={() => { if (!started) engine.createRoom() }}
          disabled={started}
          title={started ? "Can't create a room mid-draft" : undefined}
          className="mt-6 w-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] py-3 text-sm font-semibold text-white
                     shadow-glass transition-all duration-200 hover:scale-[1.02] hover:animate-pulse-glow
                     disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 disabled:hover:animate-none"
        >
          Create a room
        </button>

        <div className="mt-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-white/30">
          <div className="h-px flex-1 bg-white/10" />
          or
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mt-6 flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Enter a room code"
            maxLength={8}
            disabled={started}
            className="w-full rounded-lg border border-white/10 bg-obsidian/60 px-3 py-2.5 text-sm uppercase tracking-widest
                       text-white placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30
                       focus:border-teal-400/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={started || !joinCode.trim()}
            className="shrink-0 rounded-lg border border-white/15 px-4 text-sm font-medium text-white/70
                       transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300
                       disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/70"
          >
            Join
          </button>
        </div>

        {reason && status !== 'open' && (
          <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2 text-xs text-rose-300">
            Couldn't join that room: {reason}.
          </p>
        )}
      </div>
    )
  }

  const room = engine.room()
  const code = engine.codeInUrl()
  const link = code && typeof window !== 'undefined' ? `${location.origin}${location.pathname}#/draft-room?room=${code}` : ''

  const copyLink = () => {
    if (!link) return
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    }
  }

  const seats = room ? room.seats : []
  const seatsTaken = seats.filter((s) => s.taken).length

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-charcoal p-6 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Your room</h2>
          <p className="mt-1 text-sm text-white/50">
            {seatsTaken} of {seats.length} seats taken
            {status !== 'open' && STATUS_TEXT[status] && <span className="text-amber-300"> &middot; {STATUS_TEXT[status]}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => engine.leaveRoom()}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium
                     text-white/60 transition-colors duration-200 hover:border-rose-400/50 hover:text-rose-300"
        >
          <LogOut className="h-3.5 w-3.5" />
          Leave
        </button>
      </div>

      <div className="mt-5 flex gap-2">
        <input
          type="text"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="w-full truncate rounded-lg border border-white/10 bg-obsidian/60 px-3 py-2.5 text-xs text-white/70 focus:outline-none"
        />
        <button
          type="button"
          onClick={copyLink}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs font-medium text-white/70
                     transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/30">
        <Users className="h-3.5 w-3.5" />
        Seats
      </div>
      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
        {seats.map((seat) => {
          const isHostSeat = room && room.hostName && seat.name === room.hostName
          return (
            <div
              key={seat.index}
              className={
                'flex items-center justify-between rounded-lg border px-3 py-2 text-sm ' +
                (seat.you ? 'border-teal-400/40 bg-teal-500/10' : 'border-white/5 bg-white/[0.02]')
              }
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate">
                {isHostSeat && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
                <span className={seat.taken ? 'truncate text-white/90' : 'text-white/30'}>
                  {seat.taken ? seat.name || `Seat ${seat.index + 1}` : 'Open seat'}
                </span>
                {seat.you && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-teal-300">You</span>}
                {seat.auto && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/30">CPU</span>}
              </span>
              {!seat.taken && !seat.you && (
                <button
                  type="button"
                  onClick={() => engine.claimSeat(seat.index)}
                  className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-medium text-white/60
                             transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300"
                >
                  Sit here
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
