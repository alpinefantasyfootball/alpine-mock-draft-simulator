import { useEffect, useState } from 'react'

/* The in-app wait, from design package 03.
 *
 * The mark holds still and only the teeth and the eyes move: teeth sweep left
 * to right, the eyes flicker once, on a 1.6s loop that runs for as long as the
 * thing being waited on takes. It replaced SonarLoader's ring-and-mark for the
 * Lobby -> Draft Room transition.
 *
 * Everything that animates is inside <juke-mark variant="loader">'s shadow
 * root. juke-mark.js ships unedited from the design package and is loaded as a
 * classic script in index.html, so it is already defined by the time any React
 * module evaluates - the same guarantee window.JukeEngine relies on, and for
 * the same reason.
 *
 * WHY THIS IS NOT THE SPLASH. Package 01's variant="form" is a cold-launch
 * reveal with a beginning and an end; this is the loop. Using the reveal for
 * an in-app wait gives you an animation that finishes and then sits there,
 * which reads as a hung screen rather than a busy one. The design package says
 * so in as many words and it is worth not rediscovering.
 *
 * WHY IT MUST NOT REMOUNT. The loop is continuous and seamless - the teeth run
 * on negative delays stepped 55ms apart, so it is already mid-flight on its
 * first frame and mounting it at any moment looks like a loop in progress
 * rather than one starting. Remounting the element resets the sweep, and a
 * reset mid-wait is a visible stutter. So the element is rendered once and the
 * layer's own fade is what changes; nothing here keys the element on state
 * that moves while the layer is up.
 */

/* 126px desktop, 104px mobile, from the design package. Width only - the mark
   keeps its own 564:352 ratio and setting a height squashes it. The inline
   sizes are for the reuse case in item 8 of the package: any in-app wait
   longer than ~400ms wants this at 40-56px beside a status line, rather than a
   second spinner invented for the purpose. */
const SIZES = {
  screen: 'w-[104px] sm:w-[126px]',
  inline: 'w-[40px] sm:w-[56px]',
}

export default function DraftRoomLoader({
  tier = 'screen',
  /* Real state, never a progress fiction - the design package's own wording.
     "Entering draft room" / "Seating 12 teams", not a percentage nobody can
     honour. */
  label = 'Entering draft room',
  sub = '',
  /* Rendered when the wait has gone on longer than anyone should watch. See
     the 15s cap in DraftRoom.jsx: this component draws the error, the caller
     decides when there is one, the same contract usageFor() and
     projectionSummary() already have with their own components. */
  error = '',
  className = '',
}) {
  /* The variant swap has to be a script. juke-mark.js carries no
     reduced-motion handling of its own and its animations are inside a shadow
     root, so no stylesheet here can reach them however the selector is
     written. Asking the element for a different variant is the supported way
     to get a different thing out of it.

     Initialised false and corrected in an effect rather than read during
     render: this component is inside the one hydrated React root (see
     main.jsx), and a value read from matchMedia during the first client render
     is a value the server could not have produced. That is the hydration
     mismatch DeferredPortals exists to avoid, and it throws away the whole
     prerender rather than just this subtree. One frame of the animated mark
     before it settles to static is the honest cost and it is invisible next to
     the 160ms fade-in. */
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let mq
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    } catch (e) {
      return
    }
    const sync = () => setReduced(mq.matches)
    sync()
    /* addEventListener rather than addListener, with a fallback: Safari only
       grew the modern form on MediaQueryList in 14. */
    if (mq.addEventListener) mq.addEventListener('change', sync)
    else if (mq.addListener) mq.addListener(sync)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync)
      else if (mq.removeListener) mq.removeListener(sync)
    }
  }, [])

  const screen = tier === 'screen'

  return (
    /* role="status" with aria-live="polite" and an accessible name, from the
       package. The name is on the container rather than on the mark: juke-mark
       renders its own <svg role="img" aria-label="Juke"> inside the shadow
       root, which names the graphic, and what a screen reader needs here is
       what the app is doing, not what the picture is of. */
    <div
      role="status"
      aria-live="polite"
      aria-label={error || label}
      data-draft-loader={tier}
      className={
        (screen
          ? 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-[#151D2B]'
          : 'flex items-center gap-[18px]') +
        ' ' + className
      }
    >
      {/* Flat #151D2B, matched to the design package's own ground. No water and
          no vignette - this is a transition, not a splash. */}
      <div className={SIZES[tier] || SIZES.screen}>
        <juke-mark variant={reduced ? 'static' : 'loader'}></juke-mark>
      </div>

      {/* The status text stays under reduced motion. Losing the animation is
          the point; losing the sentence that says what is happening would
          leave a still picture and no explanation, which is worse than the
          animation it replaced. */}
      {(label || sub || error) && (
        <div className={screen ? 'flex flex-col items-center gap-1 text-center' : 'flex flex-col gap-1'}>
          <div className="text-[14px] font-medium text-[#e8eaf0]">{error || label}</div>
          {!error && sub ? <div className="text-[12.5px] text-[#8b93a5]">{sub}</div> : null}
        </div>
      )}
    </div>
  )
}
