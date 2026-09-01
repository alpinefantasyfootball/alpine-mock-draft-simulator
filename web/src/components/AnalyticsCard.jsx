// One shared shell for every cell in the Draft Lobby's analytics grid — same
// border/background/radius so the nine cells read as one grid rather than
// nine independently-styled boxes, the same reasoning DraftInsightsDashboard
// .jsx's own PANEL constant documents for its family of sections. A card
// wanting a non-neutral header (WeakestSpotCard's rose eyebrow) skips the
// `title` prop and renders its own first line instead, rather than this
// component growing a colour prop for one caller.
export default function AnalyticsCard({ title, sub, right, children }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/[0.07] bg-slate-panel p-4">
      {(title || right) && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/50">{title}</h2>}
            {sub && <p className="mt-0.5 text-[10.5px] text-ink-muted">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
