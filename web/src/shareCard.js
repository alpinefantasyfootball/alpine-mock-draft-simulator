/* The shareable grade card, drawn to a canvas — not screenshotted from the
   DOM and not a template PNG. Same reasoning as the og-image and the hero
   product shot (see CLAUDE.md): a drawn card is generated from the exact
   figures on screen, so it can never drift from what the dashboard says,
   and it costs no dependency — html2canvas et al. exist to rasterise
   arbitrary DOM, and this card is not arbitrary.

   1200x630 — the link-preview aspect the og-image already uses, which is
   also what every chat app unfurls without cropping. */

const W = 1200
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

/* The og-image script refuses to write a card in a fallback face, because a
   share card silently rendered wrong looks finished and fails in somebody
   else's feed — same rule here. By the time this can be clicked the
   dashboard has been rendering Poppins for a while, so a miss means fonts
   genuinely failed and the button should say so rather than ship it. */
async function ensureFonts() {
  await Promise.all([
    document.fonts.load('900 300px "Poppins"'),
    document.fonts.load('700 44px "Poppins"'),
    document.fonts.load('600 26px "Poppins"'),
    document.fonts.load('400 22px "Inter"'),
  ])
  if (!document.fonts.check('900 300px "Poppins"')) {
    throw new Error('display font not loaded')
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
  ctx.font = '600 24px "Poppins", sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('J U K E   ·   D R A F T   R E P O R T', 64, 84)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 52px "Poppins", sans-serif'
  ctx.fillText(data.teamName, 64, 152)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 24px "Inter", sans-serif'
  ctx.fillText(`${data.leagueText}  ·  ${data.dateText}`, 64, 192)

  // the grade, huge, in the gradient — measured off its own metrics so the
  // rank column can sit beside it whatever letter (A+ vs F) it is
  const gradeGrad = ctx.createLinearGradient(64, 260, 380, 560)
  gradeGrad.addColorStop(0, TEAL)
  gradeGrad.addColorStop(1, PURPLE)
  ctx.fillStyle = gradeGrad
  ctx.font = '900 300px "Poppins", sans-serif'
  ctx.shadowColor = 'rgba(0,229,255,0.35)'
  ctx.shadowBlur = 60
  ctx.fillText(data.grade, 64, 520)
  ctx.shadowBlur = 0
  const gradeWidth = ctx.measureText(data.grade).width

  // Capped, not purely measured: a two-glyph grade ("D+") is wide enough
  // to push this column under the component panel at x=760 — seen, not
  // theorised. 460 leaves the widest line ("13 / 100 weighted score",
  // ~280px at 26px Inter) clear of the panel with room to spare.
  const rankX = Math.min(64 + gradeWidth + 48, 460)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '700 44px "Poppins", sans-serif'
  ctx.fillText(`${data.rankText} of ${data.teams}`, rankX, 400)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 26px "Inter", sans-serif'
  ctx.fillText(`${data.total} / 100 weighted score`, rankX, 444)

  // component panel, right side
  const px = 760
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
    ctx.font = '600 22px "Poppins", sans-serif'
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
  ctx.font = '600 24px "Poppins", sans-serif'
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
