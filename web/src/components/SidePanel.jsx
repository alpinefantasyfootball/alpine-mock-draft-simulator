/* One panel in the desktop draft room's bottom row — a bordered column
   that scrolls its own contents, headed either by a plain title or by a
   row of tabs. Shared so panels cannot drift apart in header height,
   border or padding; the Players panel is PlayerHub instead, because it
   carries the profile drawer and its own filter chrome.

   The two headers are the same height on purpose: a tabbed panel sitting
   beside a titled one with a different header depth reads as a
   misalignment rather than a distinction.

   Desktop only by composition rather than by a class of its own: every
   caller sits inside DraftRoom's panel row, so this never needs to know
   about breakpoints.

   border-slate-700, not -800: this panel's own tab row (Queue/Roster) sits
   directly beside DraftLogDock's tab row (Chat/Log/Picks), same height,
   same underline style, and a design review read the two as one four-item
   strip with two selections lit at once rather than as two adjacent
   two-item bars. They already are two separate bars with two separate
   active states — the fix is making the seam between them read as one at
   a glance, not restructuring what's already correct underneath it. */
export default function SidePanel({ title, count, tabs, active, onTab, action, children }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-slate-700 bg-slate-900/40 last:border-r-0">
      {tabs ? (
        <div className="flex shrink-0 border-b border-slate-700">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              className={
                'flex-1 border-b-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors duration-150 ' +
                (active === t.key
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-white/40 hover:text-white/60')
              }
            >
              {t.label}
              {t.count > 0 ? <span className="ml-1 text-teal-400">{t.count}</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            {title}
            {count > 0 ? <span className="ml-1 text-teal-400">{count}</span> : null}
          </span>
          {action}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
