import { useRef } from 'react'
import EarlyAccessModal from '../EarlyAccessModal.jsx'

/* "Connect a league", everywhere it is offered, doing the one honest thing
   it can do today.

   There is no league connect in this project — no Sleeper/ESPN/Yahoo/CBS
   import — so every control that offers it is a control that cannot act,
   which is the dead-end this app has shipped before and has a rule about.
   What it can do is take an email for the thing being asked for, which is
   exactly what EarlyAccessModal exists for and what the locked rooms'
   "Sign up & connect" already funnels toward.

   One component rather than a ref threaded through four screens: the
   header's chip, the signed-in homepage card, the Rooms lobby's unlock bar
   and the You screen's "Add a league" row all offer the same thing, and
   they were otherwise each going to point somewhere slightly different —
   two of them at #/rooms and #/you, which is a redirect standing in for an
   answer.

   Each instance owns its own <dialog>, which is cheap and is what lets a
   caller drop this in without plumbing. `variant` covers the four shapes
   the design draws; the copy is fixed because it is the same promise every
   time, and the source string is what tells the waitlist which surface the
   ask came from. */

const VARIANTS = {
  gradient:
    'inline-flex items-center justify-center whitespace-nowrap rounded-full px-5 py-3 text-[14px] font-bold text-surface-page transition-transform duration-150 hover:scale-[1.02]',
  outline:
    'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-flow-pillEdge px-5 py-3 text-[14px] font-semibold text-voidInk-primary transition-colors duration-150 hover:border-white/30',
  chip:
    'hidden items-center gap-2 rounded-full border border-flow-pillEdge px-3 py-[7px] text-[13px] font-semibold text-voidInk-primary transition-colors duration-150 hover:border-teal/50 sm:inline-flex',
  row:
    'flex w-full items-center justify-between gap-3 rounded-[14px] border border-dashed border-flow-pillEdge px-4 py-3 text-left text-[14px] text-voidInk-primary transition-colors duration-150 hover:border-teal/50',
}

const COPY =
  'League connect is in build. Leave an email and we will tell you the moment you can plug your league in.'

export default function ConnectLeagueCta({
  variant = 'gradient',
  source = 'connect-league',
  label = 'Connect a league',
  children,
}) {
  const ref = useRef(null)

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.open(COPY, source)}
        className={VARIANTS[variant] || VARIANTS.gradient}
        style={variant === 'gradient' ? { background: 'linear-gradient(100deg,#44D4E2,#82A1F6)' } : undefined}
      >
        {children || label}
      </button>
      <EarlyAccessModal ref={ref} />
    </>
  )
}
