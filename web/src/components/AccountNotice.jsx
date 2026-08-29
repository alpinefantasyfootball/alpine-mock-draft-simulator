import { X } from 'lucide-react'
import { useAccount } from '../hooks/useAccount.js'

// The one-time confirmation a magic-link click produces — "you're signed
// in," "your 6 saved mocks are now on your account," or the expired/used/
// unknown-link copy the acceptance criteria call for. Set once by
// account.js's own consumeFromUrl() and read here through the same
// useAccount() hook every other account-aware component uses, rather than
// a second state channel just for this one message.
//
// Lives in Header.jsx, which is mounted on every route (see CLAUDE.md's
// "CSS-hidden is still mounted" rule — #root sits inside app.js's
// #view-home and is hidden rather than unmounted on other routes) — and
// that is also the only place a notice can ever actually appear, because a
// magic link always lands on a fresh page load at "#/" (see account.js's
// own comment on why the token rides the query string rather than the
// hash), never mid-session from inside the Draft Room.
const COPY = {
  expired: 'That sign-in link has expired. Request a new one.',
  used: 'That sign-in link has already been used. Request a new one.',
  unknown: "That link isn't valid. Request a new one.",
}

export default function AccountNotice() {
  const account = useAccount()
  const notice = account && account.notice
  if (!notice) return null

  const dismiss = () => window.Account?.dismissNotice()

  let message
  if (notice.type === 'welcome') {
    const n = notice.migratedCount
    message = `You're signed in. Your ${n} saved mock${n === 1 ? '' : 's'} ${n === 1 ? 'is' : 'are'} now on your account.`
  } else if (notice.type === 'signed-in') {
    message = "You're signed in."
  } else {
    message = COPY[notice.error] || "That sign-in link didn't work. Request a new one."
  }

  return (
    <div className="fixed inset-x-0 top-20 z-[80] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-white/10 bg-[#141821] px-4 py-2.5 text-sm text-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)]">
        <span>{message}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-white/40 transition-colors hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
