import { useRef } from 'react'
import { SignUpButton } from '@clerk/clerk-react'
import ConnectLeagueModal from './ConnectLeagueModal.jsx'
import { useAccountUiReady } from '../../hooks/useAccountUiReady.js'
import { useSignedIn } from '../../hooks/useAuthState.js'

/* "Connect a league", everywhere it is offered — and it now connects one.

   This was a waitlist. Sleeper connect is real, so the button opens the
   real flow: username, pick a league, done.

   ---- Signed out, it asks for an account first ----

   Not a nicety: a connection is stored against an account, so there is
   nowhere to put one without it. That is also the handoff's own global
   rule — "Connect-league always routes through account creation first" —
   and why the locked rooms say "Sign up & connect" rather than naming a
   platform. Signed out this renders Clerk's sign-up trigger wearing the
   same label; signed in it opens the connect dialog.

   One component rather than a ref threaded through four screens: the
   header's chip, the signed-in homepage card, the Rooms lobby's unlock bar
   and the You screen's row all offer the same thing, and they were
   otherwise each going to point somewhere slightly different — two of them
   at #/rooms and #/you, which is a redirect standing in for an answer.

   Each instance owns its own <dialog>, which is cheap and is what lets a
   caller drop this in without plumbing. `variant` covers the four shapes
   the design draws. */

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

export default function ConnectLeagueCta({
  variant = 'gradient',
  label = 'Connect a league',
  onConnected,
  children,
}) {
  const ref = useRef(null)
  const ready = useAccountUiReady()
  const signedIn = useSignedIn()

  const cls = VARIANTS[variant] || VARIANTS.gradient
  const style = variant === 'gradient'
    ? { background: 'linear-gradient(100deg,#44D4E2,#82A1F6)' }
    : undefined

  const trigger = (onClick) => (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children || label}
    </button>
  )

  /* Signed out: the same control, opening sign-up. Without a Clerk key
     there is no SignUpButton to wrap it in, so it renders inert — the
     fallback every account surface here makes rather than throwing. */
  if (!signedIn) {
    if (!ready) return trigger(undefined)
    return <SignUpButton mode="modal">{trigger(undefined)}</SignUpButton>
  }

  return (
    <>
      {trigger(() => ref.current?.open())}
      <ConnectLeagueModal ref={ref} onConnected={onConnected} />
    </>
  )
}
