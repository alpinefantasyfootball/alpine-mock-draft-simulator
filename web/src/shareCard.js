/* The shareable grade card, drawn to a canvas — not screenshotted from the
   DOM and not a template PNG. Same reasoning as the og-image and the hero
   product shot (see CLAUDE.md): a drawn card is generated from the exact
   figures on screen, so it can never drift from what the dashboard says,
   and it costs no dependency — html2canvas et al. exist to rasterise
   arbitrary DOM, and this card is not arbitrary.

   1200x630 — the link-preview aspect the og-image already uses, which is
   also what every chat app unfurls without cropping. */

const W = 1200
// The left text margin and where the component panel starts. The grade sizing
// below solves against both, so neither may be written down twice.
const TEXT_X = 64
const PANEL_X = 760
const GRADE_MAX_PX = 300
const H = 630

const TEAL = '#00E5FF'
const PURPLE = '#7B1FA2'
const BG = '#0B0E14'
const PANEL = '#131A24'

// The four grade components, same order and names as the dashboard's radar.
const COMPONENTS = [
  { key: 'startersScaled', label: 'Starters' },
  { key: 'valueScaled', label: 'Value' },
  { key: 'buildScaled', label: 'Build' },
  { key: 'byePenaltyScaled', label: 'Byes' },
]

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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function drawShareCard(data) {
  await ensureFonts()

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // ground
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // faint brand glows in the corners, echoing the dashboard's backdrop
  const glow1 = ctx.createRadialGradient(W - 120, 80, 0, W - 120, 80, 420)
  glow1.addColorStop(0, 'rgba(123,31,162,0.22)')
  glow1.addColorStop(1, 'rgba(123,31,162,0)')
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)
  const glow2 = ctx.createRadialGradient(140, H - 60, 0, 140, H - 60, 420)
  glow2.addColorStop(0, 'rgba(0,229,255,0.10)')
  glow2.addColorStop(1, 'rgba(0,229,255,0)')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)

  // neon rule across the top — every stop earns its keep on the dark ground
  const rule = ctx.createLinearGradient(0, 0, W, 0)
  rule.addColorStop(0, TEAL)
  rule.addColorStop(1, PURPLE)
  ctx.fillStyle = rule
  ctx.fillRect(0, 0, W, 6)

  // eyebrow + identity
  ctx.fillStyle = TEAL
  ctx.font = '600 24px "Archivo", sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('J U K E   ·   D R A F T   R E P O R T', 64, 84)

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
     redraw. The budget: the column's widest line is the score
     ("100 / 100 weighted score", 307px at 26px Inter), it has to clear the
     panel with a margin, and everything left of it is the grade plus the gap.
     Single-glyph grades keep the full 300px, since they were never the problem.
     Swept across all thirteen grades: every one clears both the panel and the
     grade beside it. */
  const RANK_COL_W = 307
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

  const rankX = TEXT_X + gradeWidth + GRADE_GAP
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 44px "Archivo", sans-serif'
  ctx.fillText(`${data.rankText} of ${data.teams}`, rankX, 400)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 26px "Inter", sans-serif'
  ctx.fillText(`${data.total} / 100 weighted score`, rankX, 444)

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

  // callouts along the bottom, when the draft produced them
  ctx.font = '400 24px "Inter", sans-serif'
  let footY = 572
  if (data.bestValue) {
    ctx.fillStyle = TEAL
    ctx.fillText('BEST VALUE', 64, footY)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(data.bestValue, 64 + 160, footY)
    footY += 0
  }
  if (data.biggestReach) {
    ctx.fillStyle = '#FB7185'
    ctx.fillText('BIGGEST REACH', 620, footY)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(data.biggestReach, 620 + 200, footY)
  }

  // the marketing line the whole card exists for
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '600 24px "Archivo", sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('jukeff.com', W - 64, 84)
  ctx.textAlign = 'left'

  return canvas
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
  })
}
