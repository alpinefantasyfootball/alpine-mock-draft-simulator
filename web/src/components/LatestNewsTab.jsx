import { useEffect, useState } from 'react'

// No id, no news — deliberately not a fallback to a name search or to
// league-wide headlines: an empty panel is a player we could not link, and
// the pipeline has already written him into unmatched.txt. Showing
// somebody else's news under this name is the one outcome worse than
// showing none (see CLAUDE.md's "Latest news" section).
export default function LatestNewsTab({ engine, player }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    setItems(null)
    const theirId = engine.sourceId(player, 'tank')
    if (!theirId || typeof window === 'undefined' || !window.Live || !window.Live.news) {
      setItems([])
      return
    }

    // Which player this answer belongs to is checked when it lands, not
    // when it was asked for — closing this player and opening another
    // before the fetch resolves must not render into the new one's tab.
    let stale = false
    window.Live.news(theirId)
      .then((data) => {
        if (stale) return
        const rows = (data && data.items || []).map(engine.newsItemView).filter(Boolean)
        setItems(rows)
      })
      .catch(() => { if (!stale) setItems([]) })

    return () => { stale = true }
  }, [engine, player.id, player.name])

  // Loading: render nothing rather than a spinner — same contract the
  // score strip and the legacy news panel both keep. It resolves in well
  // under a second against the worker's own cache.
  if (items === null) return null

  if (items.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-muted">
        No recent headlines for this player.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 lg:gap-3">
      {items.map((n) => (
        <a
          key={n.url}
          href={n.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-rule bg-slate-sunk/50 p-2.5 lg:p-4 transition-colors duration-150 hover:border-teal-400/40"
        >
          <p className="text-sm lg:text-base font-semibold text-white">{n.title}</p>
          {n.summary && <p className="mt-1 lg:mt-1.5 text-xs lg:text-sm leading-relaxed text-white/50">{n.summary}</p>}
          <p className="mt-1.5 lg:mt-2 text-[10px] lg:text-xs uppercase tracking-wide text-ink-muted">
            {n.source}{n.when ? ` · ${n.when}` : ''}
          </p>
        </a>
      ))}
      <p className="mt-1 lg:mt-2 text-xs lg:text-sm leading-relaxed text-ink-muted">
        Headlines from our news provider, linked rather than reproduced. Juke does not write these and does not endorse them.
      </p>
    </div>
  )
}
