/* One panel in the desktop draft room's bottom row — a titled, bordered
   column that scrolls its own contents. Shared so the Queue, Roster and
   Chat panels cannot drift apart in header size, border or padding; the
   Players panel is PlayerHub instead, because it carries the profile
   drawer and its own filter chrome.

   Desktop only by composition rather than by a class of its own: every
   caller sits inside DraftRoom's `hidden lg:flex` panel row, so this
   never needs to know about breakpoints. */
export default function SidePanel({ title, count, action, children }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-slate-800 bg-slate-900/40 last:border-r-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
          {title}
          {count > 0 ? <span className="ml-1 text-teal-400">{count}</span> : null}
        </span>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
