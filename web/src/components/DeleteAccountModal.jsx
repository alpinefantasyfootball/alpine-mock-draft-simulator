import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { X } from 'lucide-react'

// The one destructive account action, and the reason it exists now rather
// than later: CLAUDE.md's Task 3 plan calls for building this while the
// data model is one table, because retrofitting it after real beta users
// have accounts is much worse. A native <dialog>, same imperative-ref
// pattern as SignInModal.jsx/EarlyAccessModal.jsx.
//
// No "type DELETE to confirm" text field — the confirm state below (a
// second, unmistakably red button reading what it does) is the same
// friction this app already asks for a destructive action elsewhere
// (DraftRoom.jsx's own "Discard draft"), and a typed-confirmation field is
// a pattern for something a lot more catastrophic than one person's own
// account.
const DeleteAccountModal = forwardRef(function DeleteAccountModal({ onDeleted }, ref) {
  const dialogRef = useRef(null)
  // ask | deleting | done | error
  const [status, setStatus] = useState('ask')

  useImperativeHandle(ref, () => ({
    open() {
      setStatus('ask')
      dialogRef.current?.showModal()
    },
  }))

  const close = () => dialogRef.current?.close()

  const confirmDelete = async () => {
    setStatus('deleting')
    const deleteAccount = typeof window !== 'undefined' && window.Account && window.Account.deleteAccount
    const result = deleteAccount ? await deleteAccount() : { ok: false }
    if (result && result.ok) {
      setStatus('done')
      onDeleted?.()
    } else {
      setStatus('error')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="delete-account-dialog m-auto rounded-2xl border border-white/10 bg-charcoal p-0 text-white"
      onClick={(e) => {
        if (e.target === dialogRef.current && status !== 'deleting') close()
      }}
    >
      <div className="w-[min(90vw,26rem)] p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-lg font-bold text-white">
            {status === 'done' ? 'Account deleted' : 'Delete your account'}
          </h3>
          {status !== 'deleting' && (
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mr-1.5 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {status === 'done' ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Your account, your email address, and your saved-draft locker on our server have
              all been deleted. Mocks already saved in this browser are untouched — deleting an
              account only removes what was synced to it.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-6 w-full rounded-full bg-white/10 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              This deletes your account, your email address, and everything in your server-side
              locker — every saved draft and completed mock synced to it. It can't be undone.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Mocks already saved in this browser stay right where they are; only what's on our
              server goes away.
            </p>
            {status === 'error' && (
              <p className="mt-2 text-xs text-rose-300">
                That didn't go through. Try again in a moment.
              </p>
            )}
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={close}
                disabled={status === 'deleting'}
                className="flex-1 rounded-full border border-white/15 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={status === 'deleting'}
                className="flex-1 rounded-full bg-rose-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'deleting' ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
})

export default DeleteAccountModal
