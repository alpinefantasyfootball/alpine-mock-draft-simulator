import ConfigureDraftForm from './ConfigureDraftForm.jsx'
import DraftLocker from './DraftLocker.jsx'

// Mounted into #setup-root, inside app.js's #tab-setup — which app.js
// already shows/hides correctly (home vs. draft route, setup vs. live
// board) without this component ever reading location.hash itself. Same
// contract the homepage's #root keeps: mount once, let app.js own routing.
export default function DraftSettings() {
  return (
    <div className="flex min-h-full flex-col bg-obsidian px-6 py-8 text-white lg:px-10 lg:py-10">
      <div className="mb-6 shrink-0">
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Draft Settings &amp; Locker</h1>
        <p className="mt-1 text-sm text-white/50">Set up a mock, or pick up where a past one left off.</p>
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="lg:basis-2/5">
          <ConfigureDraftForm />
        </div>
        <div className="relative lg:basis-3/5 lg:min-h-[420px]">
          {/* Absolute fill, not a viewport-calc height — same fix as the
              three-column screen in DraftRoom.jsx (see its comment): the
              calc was a guess at the row's height, and a wrong guess left
              the Locker's bottom edge misaligned with the form's. */}
          <div className="lg:absolute lg:inset-0">
            <DraftLocker />
          </div>
        </div>
      </div>
    </div>
  )
}
