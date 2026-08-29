import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { X } from 'lucide-react'

// Real accounts, replacing Phase 0's "leave an email, we'll tell you when
// it's ready" (EarlyAccessModal.jsx) at the one place that promise used to
// be made — see AccountButtons in SiteNav.jsx. Built the same way that
// modal is: a native <dialog>, opened imperatively through a ref, so
// showModal() traps focus and returns it to the trigger on close for free.
//
// Email plus magic link, no password field anywhere in this component —
// the whole reason that's the design (see CLAUDE.md's Task 3 section) is
// that a sign-in form doesn't need one.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SignInModal = forwardRef(function SignInModal(_props, ref) {
  const dialogRef = useRef(null)
  const [email, setEmail] = useState('')
  // idle | invalid | submitting | sent | too-soon | error
  const [status, setStatus] = useState('idle')

  useImperativeHandle(ref, () => ({
    open() {
      setEmail('')
      setStatus('idle')
      dialogRef.current?.showModal()
    },
  }))

  const close = () => dialogRef.current?.close()

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setStatus('invalid')
      return
    }
    setStatus('submitting')
    // window.Account is a plain classic script global (account.js), loaded
    // and run before this module ever executes — same guard
    // EarlyAccessModal.jsx already uses for window.Live.signup.
    const requestLink = typeof window !== 'undefined' && window.Account && window.Account.requestLink
    const result = requestLink ? await requestLink(trimmed) : { ok: false }
    if (result && result.ok) {
      setStatus('sent')
    } else if (result && result.error === 'too-soon') {
      setStatus('too-soon')
    } else {
      setStatus('error')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="signin-dialog m-auto rounded-2xl border border-white/10 bg-charcoal p-0 text-white"
      onClick={(e) => {
        if (e.target === dialogRef.current) close()
      }}
    >
      <div className="w-[min(90vw,26rem)] p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-lg font-bold text-white">Sign in to Juke</h3>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="-mr-1.5 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === 'sent' ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Check <b className="text-white/80">{email.trim()}</b> for a sign-in link. It works
              once and expires in 15 minutes.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] py-2.5 text-sm font-semibold text-white
                         shadow-glass transition-all duration-200 hover:scale-105
                         motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              No password — we'll email you a one-time link. Everything you can do signed out
              still works signed in; the only thing an account adds is a locker that follows you
              between devices.
            </p>

            <label htmlFor="signin-email" className="mt-5 block text-xs font-semibold uppercase tracking-wide text-white/40">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (status !== 'idle' && status !== 'submitting') setStatus('idle')
              }}
              placeholder="you@example.com"
              aria-invalid={status === 'invalid'}
              aria-describedby={status !== 'idle' && status !== 'submitting' ? 'signin-msg' : undefined}
              className={
                'mt-1.5 w-full rounded-lg border bg-obsidian/60 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none ' +
                (status === 'invalid'
                  ? 'border-rose-400/60 focus:border-rose-400/60'
                  : 'border-white/10 focus:border-teal-400/60')
              }
            />

            {status === 'invalid' && (
              <p id="signin-msg" className="mt-2 text-xs text-rose-300">
                That doesn't look like an email address.
              </p>
            )}
            {status === 'too-soon' && (
              <p id="signin-msg" className="mt-2 text-xs text-rose-300">
                A link was already sent to this address in the last minute. Check your inbox
                (and spam folder) before requesting another.
              </p>
            )}
            {status === 'error' && (
              <p id="signin-msg" className="mt-2 text-xs text-rose-300">
                That didn't send. Try again in a moment.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="mt-4 w-full rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] py-2.5 text-sm font-semibold text-white
                         shadow-glass transition-all duration-200 hover:scale-105
                         disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
                         motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              {status === 'submitting' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </dialog>
  )
})

export default SignInModal
