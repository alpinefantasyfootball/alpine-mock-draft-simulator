import { useRef, useState } from 'react'

// Catmull-Rom through the real points, converted to the cubic-bezier
// segments SVG paths actually take — so the trend reads as a curve rather
// than the straight polyline segments a sharp zig-zag used to draw between
// every pair of grades.
function splinePath(points) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

const fmtChartDate = (ms) =>
  typeof ms === 'number' ? new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' }) : null

/* A real chart, not a row of solid blocks — gridlines at 0/50/100 so the
   axis a reader needs to judge "is 63 good" is on screen, not implied.
   Built from however many graded entries there actually are.

   Shared between TendenciesStrip.jsx's small card (gradeLast12, capped at
   12) and AllDraftsInsights.jsx's full-width section (gradeHistory,
   uncapped) — the same chart at two sizes rather than two copies of the
   spline math, which is exactly how this pair drifted the first time (see
   draftRoomPositions.js's own file comment on the same failure with a
   colour table instead of a chart).

   The axis labels are plain HTML text, not SVG <text> — the chart below is
   preserveAspectRatio="none" against a fluid-width container, so anything
   drawn inside its own coordinate space stretches non-uniformly with it. A
   straight gridline stretched that way is still a straight line; a "100"
   stretched that way is a visibly flattened glyph, which is what a reader
   was actually seeing before this fix. Text sitting outside the SVG is
   never subject to that scale at all. The viewBox height also matches the
   rendered CSS height exactly, for the same reason from the other
   direction — the two used to disagree (300x100 into a 353x84 box measured
   0.84x vertical against 1.18x horizontal), which is what was doing the
   stretching in the first place. */
export default function GradeTrendChart({ entries, height = 84 }) {
  const w = 300, h = height, padTop = Math.max(4, height * 0.06), innerH = h - padTop * 2
  const n = entries.length
  const stepX = n > 1 ? (w - 20) / (n - 1) : 0
  const points = entries.map((e, i) => ({
    ...e,
    x: 10 + i * stepX,
    y: padTop + innerH * (1 - Math.max(0, Math.min(100, e.score)) / 100),
  }))
  const path = splinePath(points)

  const [hoverIdx, setHoverIdx] = useState(null)
  const svgRef = useRef(null)

  const nearestIndex = (clientX) => {
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * w
    let idx = 0, best = Infinity
    points.forEach((p, i) => { const d = Math.abs(p.x - relX); if (d < best) { best = d; idx = i } })
    return idx
  }
  const handleMove = (e) => { if (n > 1) setHoverIdx(nearestIndex(e.clientX)) }
  const handleLeave = () => setHoverIdx(null)
  const handleTouch = (e) => {
    const t = e.touches[0]
    if (n > 1 && t) setHoverIdx(nearestIndex(t.clientX))
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null
  const hoveredDate = hovered ? fmtChartDate(hovered.completedAt) : null

  return (
    <div className="relative mt-1">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="block w-full touch-none"
        style={{ height }}
        aria-hidden="true"
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
      >
        <line x1="10" y1={padTop} x2={w - 10} y2={padTop} stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
        <line x1="10" y1={padTop + innerH / 2} x2={w - 10} y2={padTop + innerH / 2} stroke="rgba(255,255,255,0.08)" strokeWidth="0.7" />
        <line x1="10" y1={padTop + innerH} x2={w - 10} y2={padTop + innerH} stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
        {n > 1 && <path d={path} fill="none" stroke="#00E5FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
        {n === 1 && <circle cx={points[0].x} cy={points[0].y} r={3} fill="#00E5FF" stroke="#151b26" strokeWidth="1.2" />}
        {hovered && (
          <>
            <line x1={hovered.x} y1={padTop} x2={hovered.x} y2={padTop + innerH} stroke="rgba(255,255,255,0.16)" strokeWidth="0.7" />
            <circle cx={hovered.x} cy={hovered.y} r={3} fill="#00E5FF" stroke="#151b26" strokeWidth="1.3" />
          </>
        )}
      </svg>
      <span className="pointer-events-none absolute left-0 top-0 text-[9px] text-white/45">100</span>
      <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[9px] text-white/45">50</span>
      <span className="pointer-events-none absolute bottom-0 left-0 text-[9px] text-white/45">0</span>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+7px)] whitespace-nowrap rounded-md border border-white/10 bg-slate-panel px-2 py-1 text-[11px] shadow-lg"
          style={{ left: `${(hovered.x / w) * 100}%`, top: `${(hovered.y / h) * 100}%` }}
        >
          <span className="font-display text-[13px] font-bold text-teal-300">{hovered.grade || hovered.score}</span>
          <span className="ml-1.5 font-plex text-white/50">{hovered.score}</span>
          {hoveredDate && <span className="ml-1.5 text-white/35">{hoveredDate}</span>}
        </div>
      )}
    </div>
  )
}
