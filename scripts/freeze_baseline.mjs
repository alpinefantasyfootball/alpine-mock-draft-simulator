// Freeze the 2026 preseason baseline — the one thing this project can only
// capture once, before Week 1 kicks off. See data/baselines/2026/preseason/
// README.md for why a prospective, hashed snapshot is worth more than a
// retrospective score computed against a projection file that has been
// overwritten every night since.
//
// This is JS, not Python, and driven through a real (headless) browser, on
// purpose: every number here — points, VORP, replacement level, tiers —
// already exists as a function in app.js, and CLAUDE.md's rule about the
// league shape applies just as hard to scoring and VORP. Reimplementing any
// of pointsUnder()/rulesForFormat()/replacementRank()/buildTiers() in Python
// would be exactly the "written down twice" bug this project keeps finding
// in other places. So this script boots the real page in a real (headless)
// Chromium — the same thing tests/helpers.mjs's openApp() does — and reads
// the answers straight out of the running app, the same way a browser would.
//
// It does not need a production build: web/vite.config.js's dev-server
// middleware serves app.js/players.js/stats.js straight off the repo root
// (see its own comment), so `vite dev` carries tonight's real data with no
// build step, the same guarantee CLAUDE.md documents for local development.
//
//   node scripts/freeze_baseline.mjs
//
// Refuses outright if a baseline already exists in the output directory —
// see the acceptance criteria in the Phase 1 plan. There is no --force flag:
// a baseline that needs redoing is deleted by hand, with the reason written
// in the commit message, not silently clobbered by a re-run.

import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import net from 'node:net'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'data', 'baselines', '2026', 'preseason')
const BASELINE_FILE = join(OUT_DIR, 'baseline.json')
const MANIFEST_FILE = join(OUT_DIR, 'manifest.json')

const SEASON = 2026
const FORMATS = ['standard', 'half', 'ppr']
const PORT = 5183

if (existsSync(BASELINE_FILE) || existsSync(MANIFEST_FILE)) {
  console.error(`A ${SEASON} preseason baseline already exists at ${OUT_DIR}.`)
  console.error('It is frozen on purpose — see the README in that directory — and this')
  console.error('script refuses to overwrite it. If it genuinely needs to be redone,')
  console.error('delete both files by hand and say why in the commit message.')
  process.exit(1)
}

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

// The two "when was this data actually pulled" timestamps — read off the
// generated files' own header comments rather than re-derived, the same
// "ask the deployed artifact" instinct CLAUDE.md applies to cache-busting.
// Neither file exposes these as a JS global (PLAYERS_META does carry its own
// copy and is read separately, in-browser, below; stats.js only ever writes
// it into the header comment), so this is a plain text read, not a page
// eval.
function generatedStamp(file) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const m = text.match(/Generated\s*:\s*(.+)/)
  return m ? m[1].trim() : null
}

console.log(`Freezing the ${SEASON} preseason baseline...`)
console.log(`players.js generated: ${generatedStamp('players.js')}`)
console.log(`stats.js generated:   ${generatedStamp('stats.js')}`)

console.log('\nStarting the Vite dev server (repo-root data, no build step)...')
const vite = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
  cwd: join(ROOT, 'web'),
  stdio: ['ignore', 'pipe', 'pipe'],
})
let viteOutput = ''
vite.stdout.on('data', (d) => { viteOutput += d })
vite.stderr.on('data', (d) => { viteOutput += d })
vite.on('error', (err) => { console.error('Failed to start the Vite dev server:', err); process.exit(1) })

let browser
try {
  await waitForPort(PORT, 30000)

  // Some sandboxes pre-install a chromium build under a fixed path, pinned
  // separately from whatever @playwright/test version npm resolves, and
  // block a fresh `playwright install` from fetching a matching one. Prefer
  // that path when it exists; otherwise let Playwright resolve its own
  // managed browser, which is the normal case in CI and on a real machine.
  const pinnedChromium = '/opt/pw-browsers/chromium'
  browser = await chromium.launch(
    existsSync(pinnedChromium) ? { executablePath: pinnedChromium } : {})
  const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:${PORT}/index.html#/`)

  // Same boot check tests/helpers.mjs's openApp() uses. `state` is a
  // top-level `const` in app.js, so it never becomes a `window` property —
  // only a bare identifier reference resolves it, the same way app.js's own
  // code reads it.
  await page.waitForFunction(
    () => typeof state === 'object' && typeof suggestions === 'function')
  await page.waitForFunction(() => window.JukeEngine && window.JukeEngine.dataReady())

  const playersMeta = await page.evaluate(() => window.JukeEngine.playersMeta())
  const statKeys = await page.evaluate(() => window.JukeEngine.statKeys())
  const projectedKeys = await page.evaluate(
    () => (typeof PROJECTED_KEYS === 'undefined' ? null : PROJECTED_KEYS))

  // The roster shape stays fixed across all three presets — only
  // league.scoring/league.rules change below. This is the Alpine league's
  // own default (app.js's `league` object at load), the one every control
  // on the setup screen still defaults to.
  const leagueShape = await page.evaluate(() => ({
    teams: league.teams,
    rounds: league.rounds,
    starters: Object.assign({}, league.starters),
    flex: league.flex,
    superflex: league.superflex,
    bench: league.bench,
  }))

  const formats = {}
  for (const fmt of FORMATS) {
    console.log(`\nScoring the board under "${fmt}"...`)
    const snapshot = await page.evaluate((fmt) => {
      // Exactly the seed app.js itself uses at load (`league.rules =
      // rulesForFormat(league.scoring)`), just parameterised — not a second
      // scoring path. buildBoard() is what every setup-screen/format change
      // already calls: it loads that format's own ADP set, sorts it,
      // assigns posRank/overall, then buildTiers() and buildProjections(),
      // which is what fills in projPts, projPosRank, REPLACEMENT_PTS and
      // BEST_VOR — the exact same globals every other screen reads.
      league.scoring = fmt;
      league.rules = rulesForFormat(fmt);
      buildBoard();

      return {
        replacementRank: Object.fromEntries(POSITIONS.map((pos) => [pos, replacementRank(pos)])),
        replacementPts: Object.assign({}, REPLACEMENT_PTS),
        bestVor: BEST_VOR,
        players: board.map((p) => ({
          id: p.id,
          name: p.name,
          pos: p.pos,
          team: p.team,
          bye: p.bye,
          adp: p.adp,
          sd: p.sd,
          td: p.td,
          inj: p.inj,
          posRank: p.posRank,
          overall: p.overall,
          tier: p.tier,
          projPts: p.projPts,
          projPosRank: p.projPosRank === undefined ? null : p.projPosRank,
          // replacementGap() is the exact function the sheet/Insights VORP
          // matrix already read this figure through — not re-derived here.
          vorp: replacementGap(p),
        })),
      };
    }, fmt)

    // Round off float noise from subtracting two already-rounded numbers
    // (pointsUnder() itself rounds to a tenth of a point; the subtraction
    // in replacementGap() does not re-round). Presentation only — the
    // underlying numbers are untouched.
    snapshot.players.forEach((p) => {
      if (p.vorp !== null) p.vorp = Math.round(p.vorp * 10) / 10
    })
    snapshot.bestVor = Math.round(snapshot.bestVor * 10) / 10

    console.log(`  ${snapshot.players.length} players, replacement rank ${JSON.stringify(snapshot.replacementRank)}`)
    formats[fmt] = snapshot
  }

  // Sanity check: replacement RANK depends only on league shape (teams,
  // starters, flex, superflex), never on scoring, so it must be identical
  // across all three formats. If it isn't, something above is wrong.
  const rankStrings = FORMATS.map((f) => JSON.stringify(formats[f].replacementRank))
  if (new Set(rankStrings).size !== 1) {
    throw new Error(`replacementRank() disagreed across formats: ${rankStrings.join(' vs ')}`)
  }

  // The raw projection block — before any scoring preset touches it — for
  // every player id that appears on any of the three boards. Pulled once,
  // by id, straight out of stats.js's own PLAYER_STATS; not re-derived from
  // the per-format boards above.
  const ids = [...new Set(FORMATS.flatMap((f) => formats[f].players.map((p) => p.id).filter(Boolean)))]
  const rawProjections = await page.evaluate((ids) => {
    const out = {};
    ids.forEach((id) => {
      const rec = typeof PLAYER_STATS === 'undefined' ? null : PLAYER_STATS[id];
      out[id] = rec && rec.p ? rec.p : null;
    });
    return out;
  }, ids)

  console.log(`\nCollected raw projections for ${Object.values(rawProjections).filter(Boolean).length} of ${ids.length} ids.`)

  const baseline = {
    season: SEASON,
    kind: 'preseason',
    leagueShape,
    schema: { statKeys, projectedKeys },
    formats,
    rawProjections,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const baselineText = JSON.stringify(baseline, null, 2) + '\n'
  const payloadHash = createHash('sha256').update(baselineText).digest('hex')

  const manifest = {
    season: SEASON,
    kind: 'preseason',
    doNotRegenerate: 'This is a frozen preseason snapshot, not generated data. ' +
      'Never re-run scripts/freeze_baseline.mjs over it and never hand-edit ' +
      'baseline.json or this file — see the README.md in this directory for why.',
    frozenAt: new Date().toISOString(),
    gitSha: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(),
    sourceData: {
      playersJsGenerated: generatedStamp('players.js'),
      statsJsGenerated: generatedStamp('stats.js'),
    },
    leagueShape,
    formats: FORMATS,
    counts: Object.fromEntries(FORMATS.map((f) => [f, formats[f].players.length])),
    rawProjectionCount: Object.values(rawProjections).filter(Boolean).length,
    payload: { file: 'baseline.json', sha256: payloadHash },
    generator: { script: 'scripts/freeze_baseline.mjs', nodeVersion: process.version },
  }

  writeFileSync(BASELINE_FILE, baselineText)
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n')

  // Verify against what actually landed on disk, not against the in-memory
  // string — a byte count proves a file was written, not that it matches.
  const writtenHash = createHash('sha256').update(readFileSync(BASELINE_FILE)).digest('hex')
  if (writtenHash !== payloadHash) {
    throw new Error(`hash mismatch after write: manifest says ${payloadHash}, file hashes to ${writtenHash}`)
  }

  console.log(`\nWrote ${BASELINE_FILE}`)
  console.log(`Wrote ${MANIFEST_FILE}`)
  console.log(`sha256 verified: ${payloadHash}`)
} finally {
  if (browser) await browser.close()
  vite.kill()
}
