import { useEffect, useState } from 'react'

// Mirrors app.js's renderHome(): a saved draft (localStorage, readSave())
// is the most useful thing this page can offer a returning visitor, so it
// is real state from the bridge, not a prototype placeholder.
function useSave() {
  const [save, setSave] = useState(null)

  useEffect(() => {
    const engine = typeof window !== 'undefined' ? window.JukeEngine : null
    if (!engine) return
    const data = engine.readSave()
    setSave(data && data.picks && data.picks.length ? data : null)
  }, [])

  return save
}

export default function ResumeBanner() {
  const save = useSave()
  const engine = typeof window !== 'undefined' ? window.JukeEngine : null

  if (!save) return null

  const total = save.league.teams * save.league.rounds
  const made = save.picks.length
  const done = made >= total

  return (
    <div className="mx-auto max-w-7xl px-6 pt-6">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {done ? 'Your finished draft' : 'You have a draft in progress'}
          </p>
          <p className="mt-1 text-xs text-white/50">
            {engine ? engine.settingsText(save.league) : ''} &middot; {made} of {total} picks
          </p>
        </div>
        {/* #/draft-room, not #/draft — see the comment on ROOMS[0].href in
            app.js. A save resumed onto the legacy route would still work
            (state.started reads the same localStorage save either way),
            it would just silently drop a returning manager onto the page
            none of this session's work touched. */}
        <a
          href="#/draft-room"
          className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-5 py-2 text-sm font-semibold text-white
                     shadow-glass transition-all duration-200 hover:scale-105"
        >
          {done ? 'Reopen it' : 'Resume'}
        </a>
      </div>
    </div>
  )
}
