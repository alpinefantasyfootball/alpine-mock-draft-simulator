import { useState } from 'react'
import { Check, Copy, Download, Share2 } from 'lucide-react'
import { drawShareCard, canvasToBlob } from '../shareCard.js'
import { SonarPulse } from './SonarLoader.jsx'

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
  // Which button is mid-draw.
  //
  // Read the measurement before extending this. The handoff wired Sonar here on
  // the grounds that drawShareCard() "awaits fonts and remote headshots", and
  // half of that is not true: shareCard.js has no image in it at all, and its
  // only await is ensureFonts(), which resolves against faces the page loaded
  // long ago. A real draw measures 39ms end to end. SonarPulse gates itself at
  // 300ms, so nothing is ever drawn into these buttons today - correctly, by
  // rule 01, and that is the whole reason the gate is structural rather than a
  // thing each call site decides.
  //
  // It stays wired because the gate makes it free and the day this grows a
  // remote asset is the day it needs it. What earns its place now is the
  // re-entry guard below.
  const [busy, setBusy] = useState(null)
  const flash = (key, note) => {
    setStatus({ key, note })
    setTimeout(() => setStatus({ key: null, note: '' }), 2200)
  }

  // Guards re-entry as well as marking the button. Three clicks on Download is
  // three cards drawn and three files saved, and the second and third are
  // slower than the first because they are competing with it.
  const run = async (key, fn) => {
    if (busy) return
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
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
    'flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-rule px-3.5 py-1.5 text-xs font-semibold ' +
    'text-white/70 transition-colors duration-150 hover:border-teal-400/60 hover:text-teal-300 lg:min-h-0'

  // One glyph slot, three states, in priority order: drawing, then the flash of
  // success, then the button's own icon. 14px rather than SonarPulse's own 20
  // default so it occupies exactly the h-3.5 w-3.5 box the icons do - a wider
  // mark would grow the button by 6px the moment it was pressed, and a control
  // that resizes under the cursor is worse than one that says nothing. The mask
  // takes currentColor, so it needs no colour of its own on either variant.
  const glyph = (key, Icon) =>
    busy === key ? (
      <SonarPulse width={14} />
    ) : status.key === key ? (
      <Check className="h-3.5 w-3.5 text-teal-300" />
    ) : (
      <Icon className="h-3.5 w-3.5" />
    )

  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-t border-white/5 pt-4">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        Share this result
      </span>
      {canNativeShare && (
        <button type="button" onClick={() => run('share', nativeShare)} className={btn} aria-busy={busy === 'share'}>
          {glyph('share', Share2)}
          Share…
        </button>
      )}
      {canCopy && (
        <button type="button" onClick={() => run('copy', copyImage)} className={btn} aria-busy={busy === 'copy'}>
          {glyph('copy', Copy)}
          Copy image
        </button>
      )}
      <button type="button" onClick={() => run('download', download)} className={btn} aria-busy={busy === 'download'}>
        {glyph('download', Download)}
        Download PNG
      </button>
      {status.note && <span className="text-xs text-ink-muted">{status.note}</span>}
    </div>
  )
}
