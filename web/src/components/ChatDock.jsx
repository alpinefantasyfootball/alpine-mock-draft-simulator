import { useEffect, useReducer, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Image as ImageIcon, MessageCircle, Send } from 'lucide-react'

function useEngine() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.JukeEngine) setReady(true)
  }, [])
  return ready ? window.JukeEngine : null
}

function useJukeTick(engine) {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    if (!engine) return
    window.addEventListener('juke:header', force)
    return () => window.removeEventListener('juke:header', force)
  }, [engine])
}

const TYPING_MS = 4000

function timeLabel(at) {
  if (!at) return ''
  const d = new Date(at)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ChatDock() {
  const engine = useEngine()
  useJukeTick(engine)

  const [open, setOpen] = useState(true)
  const [text, setText] = useState('')
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifResults, setGifResults] = useState([])
  // { [seat]: { name, expires } } — local-only, never persisted, matching
  // the real onRoomTyping()'s own contract (see the bridge comment on
  // onTyping in app.js): typing is relayed and forgotten, not state.
  const [typingBySeat, setTypingBySeat] = useState({})
  const logRef = useRef(null)
  const sendLockedRef = useRef(false)
  const lastTypingSentRef = useRef(0)

  const hasRoomVal = engine ? engine.hasRoom() : false
  const room = hasRoomVal ? engine.room() : null

  // Safe to own this single slot (unlike Live.onChange — see the bridge
  // comment in app.js): the only existing consumer of Live.onTyping was
  // feeding a typing line in the legacy chat dock, which is permanently
  // hidden behind this page's own overlay, so replacing it here has no
  // visible legacy consequence.
  //
  // Keyed on hasRoomVal, not just [engine]: this component mounts (and
  // its effects run) the moment the engine is ready, well before any
  // room exists, since it renders null internally until hasRoomVal is
  // true. joinRoom() — called later, from createRoom()/joinRoomByCode()
  // — registers its own Live.onTyping(onRoomTyping) at that later point,
  // which would silently overwrite a registration made this early and
  // never run again ([engine] alone never changes afterward). Re-running
  // this effect on the false->true transition means it always registers
  // after joinRoom() has already run, so this one wins.
  useEffect(() => {
    if (!engine || !hasRoomVal) return
    engine.onTyping((msg) => {
      const seat = msg && msg.seat
      if (seat == null || seat < 0) return
      setTypingBySeat((prev) => {
        if (!msg.on) {
          if (!(seat in prev)) return prev
          const next = { ...prev }
          delete next[seat]
          return next
        }
        return { ...prev, [seat]: { name: msg.name, expires: Date.now() + TYPING_MS } }
      })
    })
  }, [engine, hasRoomVal])

  // Sweeps expired typing entries — a dropped "stopped typing" signal
  // (a closed tab, a lost connection) must not leave a stale indicator
  // showing forever, same TYPING_MS TTL the legacy dock uses.
  useEffect(() => {
    const id = setInterval(() => {
      setTypingBySeat((prev) => {
        const now = Date.now()
        const next = {}
        let changed = false
        Object.keys(prev).forEach((seat) => {
          if (prev[seat].expires > now) next[seat] = prev[seat]
          else changed = true
        })
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])
  // chatStream() is the real merge of room.chat + room.picks by `at` —
  // not reimplemented here, see the bridge comment in app.js.
  const stream = room && engine ? engine.chatStream(room) : []

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [stream.length, open])

  useEffect(() => {
    if (!showGifPicker || !engine) return
    const timer = setTimeout(() => {
      engine.gifSearch(gifQuery.trim()).then((res) => setGifResults((res && res.results) || []))
    }, 350)
    return () => clearTimeout(timer)
  }, [gifQuery, showGifPicker, engine])

  if (!engine || !hasRoomVal || !room) return null

  const mySeat = room.yourSeat
  const typingNames = Object.keys(typingBySeat)
    .filter((seat) => Number(seat) !== mySeat)
    .map((seat) => typingBySeat[seat].name || 'Someone')

  const handleTextChange = (value) => {
    setText(value)
    const now = Date.now()
    if (value && now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now
      engine.sendTyping(true)
    } else if (!value) {
      engine.sendTyping(false)
    }
  }

  const send = () => {
    const trimmed = text.trim()
    if (!trimmed || sendLockedRef.current) return
    engine.sendChat(trimmed, null)
    engine.sendTyping(false)
    setText('')
    // A conservative client-side debounce — live.js/the worker have no
    // client-side rate limiting of their own (see the bridge comment
    // above), and the server's 40-actions/10s limit fails by silently
    // dropping the message with no broadcast, which reads exactly like a
    // hung feature rather than an error. This is not the real guard —
    // the server is — it just keeps an eager click or held Enter key from
    // ever reaching it.
    sendLockedRef.current = true
    setTimeout(() => { sendLockedRef.current = false }, 300)
  }

  const sendGif = (url) => {
    if (!engine.safeGif(url)) return
    engine.sendChat('', url)
    setShowGifPicker(false)
    setGifQuery('')
    setGifResults([])
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <MessageCircle className="h-4 w-4 text-teal-400" />
          Room chat
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronUp className="h-4 w-4 text-white/40" />}
      </button>

      {open && (
        <>
          <div ref={logRef} className="flex max-h-[340px] flex-col gap-2 overflow-y-auto border-t border-slate-800 px-3 py-3">
            {stream.length === 0 && <p className="py-6 text-center text-xs text-white/30">No messages yet — say hello.</p>}
            {stream.map((entry, i) => {
              if (entry.kind === 'pick') {
                // pickCode() owns the round.pick formatting — including the
                // snake mirror on even rounds — so it's called here rather
                // than re-derived from overall/round/teams (see CLAUDE.md's
                // "A pick number is not a seat number" note on exactly this
                // class of bug).
                const code = window.DraftEngine.pickCode(entry.overall, room.seats.length)
                return (
                  <div key={'pick-' + entry.overall + '-' + i} className="text-center text-[11px] text-white/35">
                    Pick {code} &middot; {entry.player}
                  </div>
                )
              }
              if (entry.kind === 'system') {
                return (
                  <div key={'sys-' + entry.id} className="text-center text-[11px] text-white/30">
                    {entry.text}
                  </div>
                )
              }
              const mine = entry.seat === mySeat
              const gifOk = entry.gif && engine.safeGif(entry.gif)
              return (
                <div key={'msg-' + entry.id} className={'flex flex-col ' + (mine ? 'items-end' : 'items-start')}>
                  <span className="text-[10px] text-white/30">
                    {mine ? 'You' : entry.name || 'Someone'} &middot; {timeLabel(entry.at)}
                  </span>
                  <div
                    className={
                      'mt-0.5 max-w-[240px] rounded-xl px-3 py-1.5 text-sm ' +
                      (mine ? 'bg-teal-500/20 text-white' : 'bg-white/5 text-white/90')
                    }
                  >
                    {entry.text && <p className="whitespace-pre-wrap break-words">{entry.text}</p>}
                    {gifOk && <img src={entry.gif} alt="" className="mt-1 max-w-full rounded-lg" />}
                  </div>
                  {room.reactions && room.reactions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(entry.reacts || []).map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => engine.sendReaction(entry.id, r.emoji)}
                          className={
                            'rounded-full border px-1.5 py-0.5 text-[11px] transition-colors duration-150 ' +
                            (r.you ? 'border-teal-400/60 bg-teal-500/15 text-teal-300' : 'border-slate-700 bg-slate-950/60 text-white/60 hover:border-slate-600')
                          }
                        >
                          {r.emoji} {r.count}
                        </button>
                      ))}
                      <ReactionAdd room={room} entry={entry} onReact={(emoji) => engine.sendReaction(entry.id, emoji)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {typingNames.length > 0 && (
            <p className="border-t border-slate-800 px-3 py-1 text-[11px] italic text-white/40">
              {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
            </p>
          )}

          {showGifPicker && (
            <div className="border-t border-slate-800 p-2">
              <input
                type="text"
                autoFocus
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                placeholder="Search GIFs…"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-teal-400/60 focus:outline-none"
              />
              <div className="mt-2 grid max-h-[160px] grid-cols-3 gap-1.5 overflow-y-auto">
                {gifResults.filter((g) => engine.safeGif(g.url)).map((g) => (
                  <button key={g.id} type="button" onClick={() => sendGif(g.url)} className="overflow-hidden rounded-md">
                    <img src={g.url} alt={g.alt || ''} className="h-16 w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-slate-800 p-2">
            <button
              type="button"
              onClick={() => setShowGifPicker((v) => !v)}
              className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150 ' + (showGifPicker ? 'border-teal-400/60 text-teal-300' : 'border-slate-800 text-white/50 hover:border-slate-700')}
              title="Send a GIF"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              onBlur={() => engine.sendTyping(false)}
              placeholder="Say something…"
              maxLength={500}
              className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-teal-400/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2]
                         text-white transition-transform duration-150 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// A small "add a reaction" trigger showing the full allow-list (room.reactions,
// server-defined — never a client-side constant, see the bridge comment on
// chatStream in app.js) so a message can pick up an emoji it doesn't have yet.
function ReactionAdd({ room, onReact }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-dashed border-slate-700 px-1.5 py-0.5 text-[11px] text-white/40 hover:border-slate-600 hover:text-white/60"
      >
        +
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1 shadow-lg">
          {(room.reactions || []).map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji)
                setOpen(false)
              }}
              className="text-sm transition-transform duration-100 hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
