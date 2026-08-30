/* The shareable draft report, drawn to a canvas — not screenshotted from the
   DOM and not a template PNG. Same reasoning as the og-image and the hero
   product shot (see CLAUDE.md): a drawn card is generated from the exact
   figures on screen, so it can never drift from what the dashboard says,
   and it costs no dependency — html2canvas et al. exist to rasterise
   arbitrary DOM, and this card is not arbitrary.

   Width is fixed at 1200 — the link-preview aspect the og-image already
   uses. Height is not: this used to be a fixed 630px "social card" holding
   only the grade, the four component bars and the two callouts, and Share/
   Copy/Download all drew that same short card. Reported directly: those
   three buttons all rendered "just the top portion" of the report. A
   drafter wants the thing they can send to their league — the roster VORP
   matrix, the value timeline, the room standings — not a teaser for it. So
   the canvas grows to fit whatever the report actually has: a 24-team room
   or an 18-round bench draws a taller image, a short 4-team league draws a
   shorter one, and nothing here hardcodes a row count. */

import { POS_MATTE, posTint } from './components/draftRoomPositions.js'

const W = 1200
// The left text margin and where the component panel starts. The grade sizing
// below solves against both, so neither may be written down twice.
const TEXT_X = 64
const PANEL_X = 760
const GRADE_MAX_PX = 300
const HEADER_H = 630

const CONTENT_X = TEXT_X
const CONTENT_W = W - TEXT_X * 2

const TEAL = '#00E5FF'
const PURPLE = '#7B1FA2'
const ROSE_A = '#F43F5E'
const ROSE_B = '#FB7185'
const BG = '#0B0E14'
const PANEL = '#131A24'

/* The one real logo on the card, not just the eyebrow's spelled-out
   "J U K E". juke-mark.svg specifically, not one of its ground-specific
   siblings — JukeLogo.jsx's own SURFACE map names it as the variant baked
   for a #0B0E14 background ("obsidian"), and BG above is that exact hex.
   Drawing juke-mark-void.svg or -appbar.svg here would carry the wrong
   negative-space colour baked into the file and read as a mismatched logo
   the moment it landed on this card's ground — see CLAUDE.md's "The
   shark" and "A variant per ground, not one file you recolour" for why
   there is no single mark file that works on every surface. */
const MARK_SRC = '/juke-mark.svg'
const MARK_ASPECT = 564 / 352 // do not stretch — same ratio JukeLogo.jsx and build_og.html use

// The four grade components, same order and names as the dashboard's radar.
const COMPONENTS = [
  { key: 'startersScaled', label: 'Starters' },
  { key: 'valueScaled', label: 'Value' },
  { key: 'buildScaled', label: 'Build' },
  { key: 'byePenaltyScaled', label: 'Byes' },
]

// Six hues, one per position — read straight off draftRoomPositions.js
// rather than hand-copied as hex.
//
// This used to be a literal table, with a comment arguing that a canvas
// fillStyle cannot read a Tailwind class name so a commented copy was
// "the honest option rather than pretending there's a shared source."
// The premise was wrong: this file is an ES module in the same bundle as
// every component, so it can import the map like anything else — what it
// cannot read is the *Tailwind theme*, which is a different thing. And
// the copy did exactly what a second copy of a load-bearing fact does.
// It went on naming the stock Tailwind orange/emerald/blue/fuchsia/
// yellow/indigo scales after the site moved to its own matte palette, so
// a share card drew six positions in colours the product no longer used
// anywhere — silently, because nobody puts a share card next to a board.
//
// POS_MATTE is the fill; posTint() is the same value as a background at
// the 15% POS_BADGE uses, so the card and a chip are one formula.
const POS_COLORS = Object.fromEntries(
  Object.keys(POS_MATTE).map((pos) => [pos, { bg: posTint(pos, 0.15), fg: POS_MATTE[pos] }]),
)
const POS_NEUTRAL = { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.4)' }

/* document.fonts.check() cannot answer the question this guard is asking, and
   for months it answered it wrongly. It reports whether the faces that *would*
   be used are loaded — and a family with no @font-face rule anywhere has
   nothing to load, so it returns true for any name at all, including one that
   certainly does not exist. Measured on the live page: the check below and the
   same call for a deliberately invented family both returned true.

   That is not academic. This file asked for a face index.html stopped
   requesting at the rebrand, and the guard went on passing while every card
   drew in the browser's default sans — the precise failure the paragraph below
   says must not happen, hidden by the check meant to prevent it.

   So the test is a measurement, which can actually fail: draw a probe string in
   the face we want and in a name nothing can match. Identical widths mean ours
   fell back to the same default. tests/share-card.spec.mjs guards the other
   half of it — that index.html is still asking for what this file draws with. */
function faceIsReal(family, ctx) {
  const probe = 'AWjgq0123 juke'
  ctx.font = `900 72px "${family}", monospace`
  const wanted = ctx.measureText(probe).width
  ctx.font = '900 72px "ZzNoSuchFaceXYZ", monospace'
  return wanted !== ctx.measureText(probe).width
}

/* The og-image script refuses to write a card in a fallback face, because a
   share card silently rendered wrong looks finished and fails in somebody
   else's feed — same rule here. By the time this can be clicked the dashboard
   has been rendering both of these faces for a while, so a miss means fonts
   genuinely failed and the button should say so rather than ship it.

   Archivo is the display face because scripts/build_og.html already moved the
   link-preview card onto it at the rebrand and this file was missed. Both cards
   say the same thing about the same draft, so they use the same face — and it
   is one index.html actually requests. Inter is checked too, which it never
   was; it carries three lines here and could fail the same silent way. */
async function ensureFonts() {
  await Promise.all([
    document.fonts.load('900 300px "Archivo"'),
    document.fonts.load('700 52px "Archivo"'),
    document.fonts.load('600 24px "Archivo"'),
    document.fonts.load('400 24px "Inter"'),
  ])
  const ctx = document.createElement('canvas').getContext('2d')
  for (const family of ['Archivo', 'Inter']) {
    if (!faceIsReal(family, ctx)) throw new Error(`${family} did not load`)
  }
}

/* The one actual image this file draws — everything else on the card is
   canvas text and gradients, per the file comment at the top. Fetched and
   decoded from an object URL rather than a bare `new Image().src = MARK_SRC`,
   matching how scripts/build_og.html already solves this identical problem
   for the link-preview card: a network miss surfaces here as a thrown error
   instead of a card silently drawn with a hole where the mark should be —
   the same "refuse rather than ship it broken" rule ensureFonts() already
   follows for the two faces, applied to the one image alongside them. The
   geometry itself stays out of this bundle; only the loader lives here. */
async function loadMark() {
  const res = await fetch(MARK_SRC)
  if (!res.ok) throw new Error(`${MARK_SRC} returned ${res.status}`)
  const svg = await res.text()
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('the mark did not decode'))
    img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function posBadge(ctx, pos, x, y, w, h) {
  const c = (pos && POS_COLORS[pos]) || POS_NEUTRAL
  ctx.fillStyle = c.bg
  roundRect(ctx, x, y, w, h, 6)
  ctx.fill()
  ctx.fillStyle = c.fg
  ctx.font = '700 15px "Archivo", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(pos || '—', x + w / 2, y + h / 2 + 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function sectionTitle(ctx, title, sub, x, y) {
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 26px "Archivo", sans-serif'
  ctx.fillText(title, x, y)
  if (sub) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '400 17px "Inter", sans-serif'
    ctx.fillText(sub, x, y + 24)
  }
}

// A centred-baseline bar, the same convention VorpRow/TimelineRow use on
// screen: teal grows right of the midline, rose grows left. gap === null
// draws the baseline with nothing on it — the K/DST dash on the live panel.
function centerBar(ctx, x, y, w, gap, maxAbs) {
  const midX = x + w / 2
  const barH = 12
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(midX, y - barH / 2 - 3)
  ctx.lineTo(midX, y + barH / 2 + 3)
  ctx.stroke()
  if (gap === null || !maxAbs) return
  const half = Math.max(6, Math.min(w / 2, (Math.abs(gap) / maxAbs) * (w / 2)))
  const positive = gap >= 0
  const barX = positive ? midX : midX - half
  const grad = ctx.createLinearGradient(barX, 0, barX + half, 0)
  if (positive) {
    grad.addColorStop(0, TEAL)
    grad.addColorStop(1, PURPLE)
  } else {
    grad.addColorStop(0, ROSE_B)
    grad.addColorStop(1, ROSE_A)
  }
  ctx.fillStyle = grad
  roundRect(ctx, barX, y - barH / 2, half, barH, barH / 2)
  ctx.fill()
}

const ROW_LABEL_W = 68
const ROW_NAME_W = 260
const ROW_VALUE_W = 90
const ROW_GAP_PAD = 20
const ROW_BAR_X = CONTENT_X + ROW_LABEL_W + ROW_GAP_PAD + ROW_NAME_W + ROW_GAP_PAD
const ROW_BAR_W = CONTENT_X + CONTENT_W - ROW_VALUE_W - ROW_GAP_PAD - ROW_BAR_X

function gapValueText(ctx, gap, x, yBase) {
  ctx.font = '700 18px "Archivo", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = gap === null ? 'rgba(255,255,255,0.35)' : gap >= 0 ? TEAL : ROSE_B
  ctx.fillText(gap === null ? '—' : (gap >= 0 ? '+' : '') + Math.round(gap), x, yBase)
  ctx.textAlign = 'left'
}

// Word-wraps into `maxLines` at most, appending an ellipsis to the last
// line if the text still doesn't fit — used only for the one-that-got-away
// sentence, which is the single piece of freeform prose on this card.
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ')
  let line = ''
  let lines = []
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    let last = lines[maxLines - 1]
    while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) {
      last = last.slice(0, -1)
    }
    lines[maxLines - 1] = last + '…'
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight))
  return lines.length * lineHeight
}

export async function drawShareCard(data) {
  // Run concurrently: neither depends on the other, and both are the same
  // "refuse rather than ship a broken card" contract, so a failure in
  // either one aborts the draw before any pixel is painted.
  const [markImg] = await Promise.all([loadMark(), ensureFonts()])

  const vorpRows = data.vorpRows || []
  const timeline = data.timeline || []
  const standings = data.standings || []

  const vorpMax = Math.max(1, ...vorpRows.filter((r) => r.gap !== null).map((r) => Math.abs(r.gap)))
  const tlMax = Math.max(1, ...timeline.map((r) => Math.abs(r.gap)))

  const SECTION_GAP = 40
  const TITLE_H = 56
  const VORP_ROW_H = 44
  const TIMELINE_ROW_H = 42
  const STANDINGS_ROW_H = 38
  const AWAY_H = data.oneThatGotAwayText ? 190 : 0
  const FOOTER_H = 64

  let H = HEADER_H
  if (AWAY_H) H += SECTION_GAP + AWAY_H
  if (vorpRows.length) H += SECTION_GAP + TITLE_H + vorpRows.length * VORP_ROW_H
  if (timeline.length) H += SECTION_GAP + TITLE_H + timeline.length * TIMELINE_ROW_H
  if (standings.length) H += SECTION_GAP + TITLE_H + standings.length * STANDINGS_ROW_H
  H += SECTION_GAP + FOOTER_H

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // ground
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // faint brand glows, top-right and bottom-left of the header only — the
  // report body below reads better on a flat ground once it's several
  // screens tall, the same reasoning the hero product shot's own fade
  // uses for where it does and doesn't spend a gradient.
  const glow1 = ctx.createRadialGradient(W - 120, 80, 0, W - 120, 80, 420)
  glow1.addColorStop(0, 'rgba(123,31,162,0.22)')
  glow1.addColorStop(1, 'rgba(123,31,162,0)')
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, HEADER_H)
  const glow2 = ctx.createRadialGradient(140, HEADER_H - 60, 0, 140, HEADER_H - 60, 420)
  glow2.addColorStop(0, 'rgba(0,229,255,0.10)')
  glow2.addColorStop(1, 'rgba(0,229,255,0)')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, HEADER_H)

  // neon rule across the top — every stop earns its keep on the dark ground
  const rule = ctx.createLinearGradient(0, 0, W, 0)
  rule.addColorStop(0, TEAL)
  rule.addColorStop(1, PURPLE)
  ctx.fillStyle = rule
  ctx.fillRect(0, 0, W, 6)

  /* The shark, left of the eyebrow. Sized off the eyebrow line it sits
     beside (24px Archivo) rather than a number chosen by eye, so the two
     read as one lockup and a future face change keeps them in proportion —
     64px is close to what JukeLogo.jsx's own `size * 1.7` would produce for
     text this size (size 24 -> ~41px there; wider here on purpose, since a
     card meant to be glanced at small in a group chat needs more presence
     than a 21px header lockup does). Height is derived, never a second
     number that could drift from the aspect ratio. */
  const MARK_W = 64
  const MARK_H = Math.round(MARK_W / MARK_ASPECT)
  ctx.drawImage(markImg, TEXT_X, 55, MARK_W, MARK_H)

  // eyebrow + identity
  ctx.fillStyle = TEAL
  ctx.font = '600 24px "Archivo", sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('J U K E   ·   D R A F T   R E P O R T', TEXT_X + MARK_W + 20, 84)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 52px "Archivo", sans-serif'
  ctx.fillText(data.teamName, 64, 152)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 24px "Inter", sans-serif'
  ctx.fillText(`${data.leagueText}  ·  ${data.dateText}`, 64, 192)

  /* The grade is sized to its column rather than pinned at a fixed 300px, and
     the difference is not cosmetic. A hardcoded size is a promise about one
     typeface's metrics, and it is exactly the promise this card broke when it
     moved to Archivo: 900 weight sets a two-glyph grade 431px wide at 300px,
     against a column that cannot start further right than 429 without running
     under the component panel. "1st of 10" printed straight through the plus
     sign. The old code capped the column's *position* instead, which cannot
     help — past the cap the text simply lands on top of the grade rather than
     beside it.

     Deriving the size means the next face change is a re-render rather than a
     redraw. The budget: the column's widest line has to clear the panel with a
     margin, and everything left of it is the grade plus the gap. Single-glyph
     grades keep the full 300px, since they were never the problem. Swept
     across all thirteen grades: every one clears both the panel and the grade
     beside it.

     The widest line used to be the weighted score ("100 / 100 weighted score",
     307px at 26px Inter). That line is gone — a letter grade sitting beside an
     x/100 reads against twelve years of schooling that says A means 90+, and
     this card was printing "A" next to 69. The letter is finishing position
     and always was; the number was a room-relative composite on a different
     scale, and no arrangement of the two survives a reader applying the
     meaning they already have. See the grade section in CLAUDE.md for the
     measurements behind dropping it rather than recurving it.

     So the widest line is now the rank, and the constant is re-derived rather
     than left at a figure describing a line that no longer exists: measured
     with Archivo actually loaded, "24th of 24" is 206px at 700 44px, the worst
     of every realistic rank-and-size pair.

     230 rather than 206, because this constant *is* the clearance — the grade
     grows until the rank column starts at exactly `PANEL_X - 24 - RANK_COL_W`,
     so the gap between the longest rank line and the panel is
     `RANK_COL_W - rankWidth` and nothing else. At 210 that came out 6px on a
     24-team card, which is not a margin, it is a near miss that the next face
     change turns into an overlap. 230 leaves 24px, the same gutter the panel
     already keeps.

     The grade still gets most of the freed width: a two-glyph grade rendered
     208px against the old 307-wide column and renders 262px against this one. */
  const RANK_COL_W = 230
  const GRADE_GAP = 40
  const rankXMax = PANEL_X - 24 - RANK_COL_W
  ctx.font = `900 ${GRADE_MAX_PX}px "Archivo", sans-serif`
  const gradeAtMax = ctx.measureText(data.grade).width
  const gradeSize = Math.min(
    GRADE_MAX_PX,
    Math.floor((GRADE_MAX_PX * (rankXMax - GRADE_GAP - TEXT_X)) / gradeAtMax),
  )
  const gradeWidth = (gradeAtMax * gradeSize) / GRADE_MAX_PX

  // The gradient follows the glyphs rather than a fixed box, or a grade drawn
  // smaller than that box shows one slice of the ramp instead of all of it.
  const gradeGrad = ctx.createLinearGradient(
    TEXT_X,
    520 - gradeSize * 0.72,
    TEXT_X + gradeWidth,
    520,
  )
  gradeGrad.addColorStop(0, TEAL)
  gradeGrad.addColorStop(1, PURPLE)
  ctx.fillStyle = gradeGrad
  ctx.font = `900 ${gradeSize}px "Archivo", sans-serif`
  ctx.shadowColor = 'rgba(0,229,255,0.35)'
  ctx.shadowBlur = 60
  ctx.fillText(data.grade, TEXT_X, 520)
  ctx.shadowBlur = 0

  /* One line now, so it is centred on the grade rather than left where the
     top half of a pair used to sit. The two lines were at 400 and 444, an
     optical centre near 422; a single 44px line reaches the same centre with
     its baseline at 430. */
  const rankX = TEXT_X + gradeWidth + GRADE_GAP
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 44px "Archivo", sans-serif'
  ctx.fillText(`${data.rankText} of ${data.teams}`, rankX, 430)

  // component panel, right side
  const px = PANEL_X
  const py = 240
  const pw = 376
  const ph = 250
  ctx.fillStyle = PANEL
  roundRect(ctx, px, py, pw, ph, 16)
  ctx.fill()
  ctx.strokeStyle = 'rgba(148,163,184,0.25)'
  ctx.lineWidth = 1
  roundRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 16)
  ctx.stroke()

  COMPONENTS.forEach((c, i) => {
    const rowY = py + 52 + i * 52
    const score = Math.round(data.components[c.key])
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '600 22px "Archivo", sans-serif'
    ctx.fillText(c.label, px + 28, rowY)
    ctx.fillStyle = TEAL
    ctx.textAlign = 'right'
    ctx.fillText(String(score), px + pw - 28, rowY)
    ctx.textAlign = 'left'
    // track + fill
    const barY = rowY + 10
    const barW = pw - 56
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, px + 28, barY, barW, 8, 4)
    ctx.fill()
    if (score > 0) {
      const fillGrad = ctx.createLinearGradient(px + 28, 0, px + 28 + barW, 0)
      fillGrad.addColorStop(0, TEAL)
      fillGrad.addColorStop(1, PURPLE)
      ctx.fillStyle = fillGrad
      roundRect(ctx, px + 28, barY, Math.max(8, (barW * score) / 100), 8, 4)
      ctx.fill()
    }
  })

  /* Starters, Value and Byes are min-max scaled against the room a report
     was drawn from — the worst of that room's teams reads 0 there, the
     best reads 100, and neither means anything outside that one room.
     Build never goes through that transform (see CLAUDE.md's "Roster
     construction is the one component that is not scaled"); it's the same
     absolute 0-100 score in every room. Reported directly: a shared card
     with Value at 0 read as "this draft had zero value" rather than "worst
     value of these 10 teams" — same fix as the live dashboard's own
     "vs. room" / "own scale" tag, just as one caption line here since a
     canvas panel this narrow has no room for a tag on every row. */
  ctx.fillStyle = 'rgba(255,255,255,0.38)'
  ctx.font = '400 13px "Inter", sans-serif'
  ctx.fillText('Starters/Value/Byes: vs. room · Build: own scale', px, py + ph + 22)

  // callouts along the bottom of the header, when the draft produced them
  ctx.font = '400 24px "Inter", sans-serif'
  const footY = 572
  if (data.bestValue) {
    ctx.fillStyle = TEAL
    ctx.fillText('BEST VALUE', 64, footY)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(data.bestValue, 64 + 160, footY)
  }
  if (data.biggestReach) {
    ctx.fillStyle = '#FB7185'
    ctx.fillText('BIGGEST REACH', 620, footY)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(data.biggestReach, 620 + 200, footY)
  }
  /* Projected win % — computed by the dashboard (winPctForRoom(), app.js)
     and shown on screen next to the rank, and until now the one figure in
     that row the card silently dropped: nobody excluded it on purpose,
     shareData's object literal just never named it. Drawn as a third stat
     here, in the same label/value convention as the two callouts above,
     rather than appended to the rank line itself — that line's width is
     already solved against the panel it has to clear (see the grade-sizing
     comment above), and a variable-width suffix is exactly what that
     comment warns can push it under the panel again. Same
     `typeof === 'number'` guard the dashboard renders behind, so a draft
     with no room-wide win-probability model draws no line at all rather
     than a broken "NaN%".

     The value's x is measured off the label rather than a second hand-tuned
     offset like the two callouts above use — those were eyeballed once
     against a label of fixed, known text ("BEST VALUE", "BIGGEST REACH")
     that never changes length. "PROJECTED WIN %" is a new label with no
     history of being checked against a real render, so it earns the same
     `ctx.measureText()` this file already leans on for the truncation loops
     below rather than a third guessed number. */
  if (typeof data.winPct === 'number') {
    const winLabel = 'PROJECTED WIN %'
    ctx.fillStyle = TEAL
    ctx.fillText(winLabel, 64, footY + 40)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(`${Math.round(data.winPct * 100)}%`, 64 + ctx.measureText(winLabel).width + 14, footY + 40)
  }

  // watermark, top-right of the header
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '600 24px "Archivo", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('jukeff.com', W - 64, 84)
  ctx.textAlign = 'left'

  // ---- everything below is the report itself, not the summary card ----
  let y = HEADER_H

  if (AWAY_H) {
    y += SECTION_GAP
    const bx = CONTENT_X
    const bw = CONTENT_W
    const by = y
    const bh = AWAY_H
    ctx.fillStyle = 'rgba(183,132,224,0.06)'
    roundRect(ctx, bx, by, bw, bh, 16)
    ctx.fill()
    ctx.strokeStyle = 'rgba(183,132,224,0.4)'
    ctx.lineWidth = 2
    roundRect(ctx, bx + 1, by + 1, bw - 2, bh - 2, 16)
    ctx.stroke()

    ctx.fillStyle = '#B784E0'
    ctx.font = '700 22px "Archivo", sans-serif'
    ctx.fillText('THE ONE THAT GOT AWAY', bx + 28, by + 40)

    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = '400 20px "Inter", sans-serif'
    const textW = data.oneThatGotAwayDelta !== null && data.oneThatGotAwayDelta !== undefined ? bw - 280 : bw - 56
    wrapText(ctx, data.oneThatGotAwayText, bx + 28, by + 76, textW, 28, 3)

    if (data.oneThatGotAwayDelta !== null && data.oneThatGotAwayDelta !== undefined) {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#B784E0'
      ctx.font = '900 48px "Archivo", sans-serif'
      ctx.fillText(`+${Math.round(data.oneThatGotAwayDelta)}`, bx + bw - 28, by + 78)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '600 14px "Archivo", sans-serif'
      ctx.fillText('LINEUP PTS FORGONE', bx + bw - 28, by + 100)
      ctx.textAlign = 'left'
    }
    y = by + bh
  }

  if (vorpRows.length) {
    y += SECTION_GAP
    sectionTitle(ctx, 'VORP Matrix', 'Each starter against a replacement-level player at his position', CONTENT_X, y + 20)
    y += TITLE_H
    vorpRows.forEach((row) => {
      const rowY = y + VORP_ROW_H / 2
      posBadge(ctx, row.pos, CONTENT_X, rowY - 15, ROW_LABEL_W, 30)
      /* '#FFFFFF', not an alpha-blended white — the VORP figure beside
         this name (gapValueText, below) already draws in solid TEAL/
         ROSE_B, opaque from the start. An alpha-blended near-white looks
         identical on screen but isn't the same pixel data: platforms
         that re-encode a shared PNG as JPEG quantize the blended-toward-
         background RGB a name at 0.88 alpha actually holds, while a
         fully opaque white has nothing to drift toward. Matches the
         header's own team name and section titles, which were already
         solid white — this row was the one place a player's own name
         was drawn dimmer than the number beside it. */
      ctx.fillStyle = row.name ? '#FFFFFF' : 'rgba(255,255,255,0.35)'
      ctx.font = '600 19px "Inter", sans-serif'
      const nameX = CONTENT_X + ROW_LABEL_W + ROW_GAP_PAD
      let label = row.name || 'Empty'
      while (ctx.measureText(label).width > ROW_NAME_W && label.length > 1) label = label.slice(0, -1)
      if (label !== (row.name || 'Empty')) label = label.slice(0, -1) + '…'
      ctx.fillText(label, nameX, rowY + 6)
      centerBar(ctx, ROW_BAR_X, rowY, ROW_BAR_W, row.gap, vorpMax)
      gapValueText(ctx, row.gap, CONTENT_X + CONTENT_W, rowY + 6)
      y += VORP_ROW_H
    })
  }

  if (timeline.length) {
    y += SECTION_GAP
    sectionTitle(ctx, 'Draft Value Timeline', "Where each pick landed against the board's rank", CONTENT_X, y + 20)
    y += TITLE_H
    timeline.forEach((row) => {
      const rowY = y + TIMELINE_ROW_H / 2
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '700 14px "Archivo", sans-serif'
      ctx.fillText(`R${row.round}`, CONTENT_X, rowY + 5)
      posBadge(ctx, row.pos, CONTENT_X + 34, rowY - 13, 44, 26)
      // Same fix as the VORP Matrix row above, for the same reason — solid
      // white rather than a 0.82-alpha near-white, so this name compresses
      // as crisply as the VORP figure beside it once a platform re-encodes
      // the exported PNG.
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '600 18px "Inter", sans-serif'
      const nameX = CONTENT_X + ROW_LABEL_W + ROW_GAP_PAD
      let label = row.name
      while (ctx.measureText(label).width > ROW_NAME_W && label.length > 1) label = label.slice(0, -1)
      if (label !== row.name) label = label.slice(0, -1) + '…'
      ctx.fillText(label, nameX, rowY + 6)
      centerBar(ctx, ROW_BAR_X, rowY, ROW_BAR_W, row.gap, tlMax)
      gapValueText(ctx, row.gap, CONTENT_X + CONTENT_W, rowY + 6)
      y += TIMELINE_ROW_H
    })
  }

  if (standings.length) {
    y += SECTION_GAP
    sectionTitle(ctx, 'Room Standings', 'Best to worst', CONTENT_X, y + 20)
    y += TITLE_H
    standings.forEach((t) => {
      const rowY = y + STANDINGS_ROW_H / 2
      if (t.isMine) {
        ctx.fillStyle = 'rgba(0,229,255,0.08)'
        roundRect(ctx, CONTENT_X - 12, rowY - STANDINGS_ROW_H / 2 + 3, CONTENT_W + 24, STANDINGS_ROW_H - 6, 8)
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '700 17px "Archivo", sans-serif'
      ctx.fillText(String(t.rank), CONTENT_X, rowY + 6)
      ctx.fillStyle = t.isMine ? '#5EEAD4' : 'rgba(255,255,255,0.7)'
      ctx.font = t.isMine ? '700 18px "Inter", sans-serif' : '400 18px "Inter", sans-serif'
      let label = t.teamName
      const nameX = CONTENT_X + 44
      const nameMax = CONTENT_W - 44 - 60
      while (ctx.measureText(label).width > nameMax && label.length > 1) label = label.slice(0, -1)
      if (label !== t.teamName) label = label.slice(0, -1) + '…'
      ctx.fillText(label, nameX, rowY + 6)
      ctx.textAlign = 'right'
      ctx.fillStyle = t.isMine ? TEAL : 'rgba(255,255,255,0.55)'
      ctx.font = '700 18px "Archivo", sans-serif'
      ctx.fillText(t.grade, CONTENT_X + CONTENT_W, rowY + 6)
      ctx.textAlign = 'left'
      y += STANDINGS_ROW_H
    })
  }

  // footer
  y += SECTION_GAP
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(CONTENT_X, y)
  ctx.lineTo(CONTENT_X + CONTENT_W, y)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '400 18px "Inter", sans-serif'
  ctx.fillText('Built with the real board, the real projections and the real scoring rules — jukeff.com', CONTENT_X, y + 40)

  return canvas
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
