import { useEffect, useRef } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'

// The phone draft room's one new interaction primitive: a sheet whose own
// HEIGHT is the state, not its position — the board sits fixed behind it
// (DraftBoardPeek.jsx) and never scrolls or resizes itself, so revealing
// more of it is purely a matter of the sheet getting shorter. That's a
// different gesture from PlayerProfileModal.jsx's own mobile sheet, which
// drags on `y` to dismiss from one fixed height — this one never dismisses
// itself and has three resting heights instead of one, so a translateY
// approach doesn't fit: the header/tab bar this wraps has to stay pinned to
// the sheet's own top edge at every height, which is what animating
// `height` directly (via a motion value bound to inline style, not a CSS
// transition) gives for free.
export const SHEET_SNAPS = [188, 470, 700]
const SHEET_MIN = 150
const SHEET_MAX = 720
// "Dragging" vs. "tapping the handle" is the one thing a bare onClick can't
// tell apart on a touch device — every tap fires a few pixels of pointer
// jitter first. 4px matches the design brief's own threshold.
const TAP_SLOP = 4

function nearestSnapIndex(h) {
  let best = 0
  let bestDist = Infinity
  SHEET_SNAPS.forEach((s, i) => {
    const d = Math.abs(s - h)
    if (d < bestDist) { bestDist = d; best = i }
  })
  return best
}

/**
 * Controlled on `snapIndex` (0/1/2 into SHEET_SNAPS) the same way any other
 * piece of DraftRoom state is — a composer opening can push the sheet to
 * its tallest snap (see ChatTabPhone.jsx) by changing the prop, exactly like
 * every other cross-component "open this" in this app.
 *
 * Uncontrolled *during* a drag: the live height lives on a framer-motion
 * motion value bound straight to `style.height`, so dragging never round-
 * trips through React state on every pointer-move frame. `onSnapIndexChange`
 * only fires once, on release, with the settled index.
 */
export default function BottomSheet({ snapIndex, onSnapIndexChange, header, children, className }) {
  const height = useMotionValue(SHEET_SNAPS[snapIndex])
  // The height the drag started from — offset.y is relative to the drag's
  // own start, not to the sheet, so the live height has to be computed as
  // "where we started minus how far up/down the pointer has moved" rather
  // than accumulated delta-by-delta (accumulating would drift under
  // framer's own sub-pixel rounding over a long drag).
  const dragStartH = useRef(SHEET_SNAPS[snapIndex])
  const draggedPastSlop = useRef(false)
  const controlsRef = useRef(null)

  // A prop-driven snap change (composer opening, tap-to-cycle already
  // reported up) animates in; nothing here fights a drag in progress
  // because this only runs when snapIndex itself changes, and a drag never
  // writes to that prop until release.
  useEffect(() => {
    controlsRef.current?.stop()
    controlsRef.current = animate(height, SHEET_SNAPS[snapIndex], { type: 'spring', stiffness: 420, damping: 42 })
    return () => controlsRef.current?.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapIndex])

  const handleDragStart = () => {
    controlsRef.current?.stop()
    dragStartH.current = height.get()
    draggedPastSlop.current = false
  }

  const handleDrag = (_, info) => {
    if (Math.abs(info.offset.y) > TAP_SLOP) draggedPastSlop.current = true
    // Dragging the handle up (negative offset.y) grows the sheet.
    const next = Math.min(SHEET_MAX, Math.max(SHEET_MIN, dragStartH.current - info.offset.y))
    height.set(next)
  }

  const handleDragEnd = () => {
    if (!draggedPastSlop.current) {
      // A tap: cycle forward regardless of where the drag jitter left the
      // height, so a tap always means "one step on," never "wherever a
      // few stray pixels of touch noise happened to land."
      const next = (snapIndex + 1) % SHEET_SNAPS.length
      onSnapIndexChange(next)
      controlsRef.current = animate(height, SHEET_SNAPS[next], { type: 'spring', stiffness: 420, damping: 42 })
      return
    }
    const next = nearestSnapIndex(height.get())
    onSnapIndexChange(next)
    controlsRef.current = animate(height, SHEET_SNAPS[next], { type: 'spring', stiffness: 420, damping: 42 })
  }

  return (
    <motion.div
      style={{ height }}
      className={
        'fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-[20px] border-t border-slate-rule bg-slate-bar shadow-[0_-18px_40px_rgba(0,0,0,0.45)] ' +
        (className || '')
      }
    >
      {/* The handle is the whole drag surface — content below scrolls on
          its own, and giving the whole sheet `drag="y"` would fight that
          scroll gesture on every list the sheet ever holds. touch-none on
          just this row is what stops the browser starting a page scroll
          on iOS Safari before framer's own pointer handling gets a look at
          it (see PlayerProfileModal.jsx's identical `touch-none` on the
          drag surface for the same reason). */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center justify-center active:cursor-grabbing"
      >
        <div className="h-[5px] w-11 rounded-full bg-slate-rule" style={{ marginTop: 9, marginBottom: 6 }} />
        {header}
      </motion.div>

      <div className="min-h-0 flex-1">{children}</div>
    </motion.div>
  )
}
