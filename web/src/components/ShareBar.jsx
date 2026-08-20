import { useState } from 'react'
import { Check, Copy, Download, Share2 } from 'lucide-react'
import { drawShareCard, canvasToBlob } from '../shareCard.js'

/* The share row under the grade — the roadmap's "missing ending": a
   finished draft should produce something you can send to your league.
   Three doors to the same PNG, each shown only where the browser can
   actually open it (dead-control rule):

   - Share… uses the native sheet where navigator.share supports files —
     phones, mostly, which is where leagues actually talk.
   - Copy image goes to the clipboard where ClipboardItem exists — the
     desktop path: copy, paste straight into the group chat.
   - Download always exists, because a file on disk is the one door every
     browser has.

   Failure is a visible state on the button that failed, not an alert and
   not silence — a share button that quietly does nothing is the "Send did
   nothing whatsoever" chat bug in a party hat. */
export default function ShareBar({ shareData }) {
  const [status, setStatus] = useState({ key: null, note: '' })
  const flash = (key, note) => {
    setStatus({ key, note })
    setTimeout(() => setStatus({ key: null, note: '' }), 2200)
  }

  const makeBlob = async () => canvasToBlob(await drawShareCard(shareData))

  const filename = () =>
    'juke-draft-' +
    shareData.teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
    '.png'

  const nativeShare = async () => {
    try {
      const file = new File([await makeBlob()], filename(), { type: 'image/png' })
      if (navigator.canShare && !navigator.canShare({ files: [file] })) throw new Error('cannot share files')
      await navigator.share({ files: [file], title: 'My Juke draft grade' })
      flash('share', 'Shared')
    } catch (err) {
      // The user closing the native sheet is a choice, not a failure.
      if (err && err.name === 'AbortError') return
      flash('share', 'Sharing failed — try Copy or Download')
    }
  }

  const copyImage = async () => {
    try {
      const blob = await makeBlob()
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
      flash('copy', 'Copied — paste it anywhere')
    } catch (err) {
      flash('copy', "Couldn't copy — try Download")
    }
  }

  const download = async () => {
    try {
      const url = URL.createObjectURL(await makeBlob())
      const a = document.createElement('a')
      a.href = url
      a.download = filename()
      a.click()
      // Revoked on a delay: revoking synchronously races the browser
      // actually reading the blob for the download in some engines.
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      flash('download', 'Saved')
    } catch (err) {
      flash('download', "Couldn't render the card")
    }
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share
  const canCopy =
    typeof navigator !== 'undefined' && !!navigator.clipboard && typeof window !== 'undefined' && !!window.ClipboardItem

  const btn =
    'flex items-center gap-1.5 rounded-full border border-slate-700 px-3.5 py-1.5 text-xs font-semibold ' +
    'text-white/70 transition-colors duration-150 hover:border-teal-400/60 hover:text-teal-300'

  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-t border-white/5 pt-4">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">
        Share this result
      </span>
      {canNativeShare && (
        <button type="button" onClick={nativeShare} className={btn}>
          {status.key === 'share' ? <Check className="h-3.5 w-3.5 text-teal-300" /> : <Share2 className="h-3.5 w-3.5" />}
          Share…
        </button>
      )}
      {canCopy && (
        <button type="button" onClick={copyImage} className={btn}>
          {status.key === 'copy' ? <Check className="h-3.5 w-3.5 text-teal-300" /> : <Copy className="h-3.5 w-3.5" />}
          Copy image
        </button>
      )}
      <button type="button" onClick={download} className={btn}>
        {status.key === 'download' ? <Check className="h-3.5 w-3.5 text-teal-300" /> : <Download className="h-3.5 w-3.5" />}
        Download PNG
      </button>
      {status.note && <span className="text-xs text-white/45">{status.note}</span>}
    </div>
  )
}
