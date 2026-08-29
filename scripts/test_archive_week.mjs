// Offline check for scripts/archive_week.mjs's raw-to-short-key mapping and
// the points it produces -- the one piece of that script this project can
// actually test without live Sleeper access (see the PR this shipped in:
// api.sleeper.app is not reachable from every sandbox this runs in, so this
// exercises the real risk -- the translation, not the fetch -- against a
// synthetic stat line with a hand-computable answer, through the exact
// same pointsUnder()/rulesForFormat() the archive script and the live board
// both call.
//
//   node scripts/test_archive_week.mjs

import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { mapRawWeek } from './archive_week.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5185

function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    (function attempt() {
      const socket = net.createConnection(port, '127.0.0.1')
      socket.once('connect', () => { socket.destroy(); resolve() })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() > deadline) return reject(new Error(`nothing listening on 127.0.0.1:${port} after ${timeoutMs}ms`))
        setTimeout(attempt, 300)
      })
    })()
  })
}

let failures = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`)
  if (!ok) failures++
}

console.log('Starting the Vite dev server...')
// The vite binary directly, not `npm run dev` -- see archive_week.mjs's own
// comment on why: npm does not reliably forward the SIGTERM from
// vite.kill() to the process actually holding the port.
const vite = spawn(join(ROOT, 'web', 'node_modules', '.bin', 'vite'),
  ['--port', String(PORT), '--strictPort'], {
    cwd: join(ROOT, 'web'),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
vite.on('error', (err) => { console.error('Failed to start the Vite dev server:', err); process.exit(1) })

let browser
try {
  await waitForPort(PORT, 30_000)
  const pinnedChromium = '/opt/pw-browsers/chromium'
  browser = await chromium.launch(existsSync(pinnedChromium) ? { executablePath: pinnedChromium } : {})
  const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:${PORT}/index.html#/`)
  await page.waitForFunction(() => typeof state === 'object' && typeof suggestions === 'function')
  await page.waitForFunction(() => window.JukeEngine && window.JukeEngine.dataReady())
  const statKeys = await page.evaluate(() => window.JukeEngine.statKeys())

  // 50 rush yards, 1 rush TD, 4 catches, 30 receiving yards -- plus usage
  // fields that are never scored. By hand, against DEFAULT_RULES
  // (rush_yd 0.1, rush_td 6, rec_yd 0.1, rec 0/0.5/1 by format):
  //   standard = 5 + 6 + 0   + 3 = 14
  //   half     = 5 + 6 + 2   + 3 = 16
  //   ppr      = 5 + 6 + 4   + 3 = 18
  const raw = {
    rush_yd: 50, rush_td: 1, rec: 4, rec_yd: 30,
    off_snp: 45, tm_off_snp: 60, rec_tgt: 7,
  }

  console.log('mapRawWeek():')
  const { block, usage } = mapRawWeek(raw, statKeys)
  check('block.ry (rush_yd)', block.ry, 50)
  check('block.rt (rush_td)', block.rt, 1)
  check('block.rc (rec)', block.rc, 4)
  check('block.cy (rec_yd)', block.cy, 30)
  check('usage.offSnaps', usage.offSnaps, 45)
  check('usage.teamOffSnaps', usage.teamOffSnaps, 60)
  check('usage.targets', usage.targets, 7)
  check('usage.offSnapShare', usage.offSnapShare, 0.75)

  console.log('\npointsUnder(mapRawWeek(raw), rulesForFormat(fmt)):')
  const points = await page.evaluate(({ block, formats }) => {
    const out = {}
    formats.forEach((fmt) => { out[fmt] = pointsUnder(block, rulesForFormat(fmt)) })
    return out
  }, { block, formats: ['standard', 'half', 'ppr'] })
  check('standard', points.standard, 14)
  check('half', points.half, 16)
  check('ppr', points.ppr, 18)
} finally {
  if (browser) await browser.close()
  vite.kill()
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
