// Archive one week of real NFL actuals -- raw stats, usage, injury/depth
// status, and fantasy points under all three scoring presets -- so the
// 2026 season gets recorded week by week instead of only ever existing as
// whatever players.js/stats.js happen to say tonight (see CLAUDE.md's note
// on the pipeline overwriting its own output every run). This is the
// substrate a projections backtest and the future Waiver Room both need,
// and neither can be built retroactively once a week's games are gone.
//
// Like scripts/freeze_baseline.mjs, this is JS rather than Python because
// scoring must go through app.js's own pointsUnder()/rulesForFormat() --
// never a second copy of that arithmetic -- so it drives the real app in a
// headless browser exactly the same way. Everything else (fetching Sleeper,
// writing the archive) is plain Node; no new runtime dependency.
//
//   node scripts/archive_week.mjs [--season 2026] [--week 3] [--force]
//
// With no --week, the most recently completed week is read off Sleeper's
// own `state/nfl` endpoint (its `week` advances at each week's roster lock,
// so `state.week - 1` is the week that just finished). If that week's stats
// endpoint has nothing yet -- the normal case for anyone running this before
// kickoff, or if the cron fires early -- nothing is written: an empty
// archive would otherwise permanently occupy that week's slot (archives are
// append-only, see below) and block the real data from ever landing once
// the games are actually played.
//
// Archives are append-only: a week that already has a manifest.json is left
// alone unless --force is passed.

import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import net from 'node:net'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Overridable the same way worker/wrangler.toml's TANK01_BASE points the
// news proxy at a local stub in tests -- Sleeper cannot be reached from
// every sandbox this runs in, so this is what let the write/refuse/--force
// path be smoke-tested against a fake Sleeper before ever touching the
// real one.
const SLEEPER = process.env.SLEEPER_BASE || 'https://api.sleeper.app/v1'
const FORMATS = ['standard', 'half', 'ppr']
const PORT = 5184

// Sleeper sends these on a player's weekly stat row but they are
// deliberately not in STAT_FIELDS/STAT_KEYS -- see build_players.py's own
// comment on why (20.5KB of stats.js for a panel that does not exist yet).
// That argument is about a file loaded on every visit; it does not apply to
// an archive read once a week by a future backtest, so they are captured
// here under their own names rather than lost. None of these are scored --
// they never pass through pointsUnder().
const USAGE_RAW_KEYS = {
  rec_tgt: 'targets',
  off_snp: 'offSnaps',
  tm_off_snp: 'teamOffSnaps',
  def_snp: 'defSnaps',
  tm_def_snp: 'teamDefSnaps',
  st_snp: 'stSnaps',
  tm_st_snp: 'teamStSnaps',
}

function outDir(season, week) {
  return join(ROOT, 'data', 'season', String(season), `week-${String(week).padStart(2, '0')}`)
}

// Pure and side-effect-free: turns one player's raw Sleeper weekly row into
// the short-keyed shape pointsUnder()/STAT_KEYS expects, plus the usage
// fields above and a derived offensive snap share (targets need a team
// total Sleeper does not send on the row, so target share is not computed
// -- see the README in the output directory). statKeys is STAT_KEYS itself,
// read live off the running app rather than a second copy of it.
export function mapRawWeek(raw, statKeys) {
  const block = {}
  // statKeys maps RULE -> SHORT KEY (e.g. "rush_yd" -> "ry"), the same
  // direction pointsUnder() reads it in, so the raw value goes in under
  // Sleeper's own name and comes out under stats.js's short one.
  //
  // Sparse by position the same way stats.js is -- a kicker's row simply
  // has no rush_yd/rec_yd keys to read -- but unlike build_players.py's own
  // compact(), a real zero is kept rather than dropped. compact() drops
  // zeros because stats.js is a render-blocking script on every page load
  // and a zero costs the same bytes as any other value; neither argument
  // applies to a file read once a week by a backtest, and "he had zero
  // catches" is a fact worth keeping, not noise.
  Object.entries(statKeys).forEach(([rule, shortKey]) => {
    const value = raw[rule]
    if (value !== undefined && value !== null) block[shortKey] = value
  })

  const usage = {}
  Object.entries(USAGE_RAW_KEYS).forEach(([rawKey, name]) => {
    const value = raw[rawKey]
    if (value !== undefined && value !== null) usage[name] = value
  })
  if (usage.offSnaps !== undefined && usage.teamOffSnaps) {
    usage.offSnapShare = Math.round((usage.offSnaps / usage.teamOffSnaps) * 1000) / 1000
  }

  return { block, usage }
}

function parseArgs(argv) {
  const args = { season: 2026, week: null, force: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--season') args.season = Number(argv[++i])
    else if (argv[i] === '--week') args.week = Number(argv[++i])
    else if (argv[i] === '--force') args.force = true
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return args
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

async function fetchJson(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'juke-draft-room/1.0' },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { season } = args
  let { week } = args

  if (week === null) {
    console.log('No --week given; asking Sleeper what week it currently is...')
    const state = await fetchJson(`${SLEEPER}/state/nfl`)
    // state.week advances at each week's roster lock, so the week that just
    // finished is one behind it. Logged plainly rather than trusted
    // silently, since this is the one guess in the whole script.
    week = state.week - 1
    console.log(`  state/nfl says season=${state.season} season_type=${state.season_type} week=${state.week} -> using week ${week}`)
  }
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    throw new Error(`Week resolved to ${week}, which is not 1-18. Pass --week explicitly.`)
  }

  const DIR = outDir(season, week)
  const ACTUALS_FILE = join(DIR, 'actuals.json')
  const MANIFEST_FILE = join(DIR, 'manifest.json')

  if (!args.force && (existsSync(ACTUALS_FILE) || existsSync(MANIFEST_FILE))) {
    console.log(`${season} week ${week} is already archived at ${DIR}.`)
    console.log('Archives are append-only; refusing to overwrite without --force.')
    return
  }

  console.log(`Fetching ${season} week ${week} stats from Sleeper...`)
  const weeklyFetchedAt = new Date().toISOString()
  const weekly = await fetchJson(`${SLEEPER}/stats/nfl/regular/${season}/${week}`)
  const ids = Object.keys(weekly)
  console.log(`  ${ids.length} players with a stat line`)

  if (ids.length === 0) {
    console.log(`Nothing to archive yet for ${season} week ${week} -- not writing an empty`)
    console.log('placeholder, which would permanently occupy this week\'s slot (archives')
    console.log('are append-only) and block the real data once the games are played.')
    return
  }

  console.log('Fetching the player master (depth chart, injury status, current team)...')
  const playerMasterFetchedAt = new Date().toISOString()
  const playerMaster = await fetchJson(`${SLEEPER}/players/nfl`)

  console.log('\nStarting the Vite dev server (real STAT_KEYS/pointsUnder(), no build step)...')
  // The vite binary directly, not `npm run dev` -- npm interposes its own
  // process between this one and vite, and does not reliably forward the
  // SIGTERM from vite.kill() to the process actually holding the port,
  // leaving an orphan behind. Same "orphaned wrangler dev outlives the run
  // that started it" failure CLAUDE.md already documents for the worker.
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
    browser = await chromium.launch(
      existsSync(pinnedChromium) ? { executablePath: pinnedChromium } : {})
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${PORT}/index.html#/`)
    await page.waitForFunction(
      () => typeof state === 'object' && typeof suggestions === 'function')
    await page.waitForFunction(() => window.JukeEngine && window.JukeEngine.dataReady())

    const statKeys = await page.evaluate(() => window.JukeEngine.statKeys())

    // Mapped in Node (mapRawWeek() is plain JS, no browser needed for it),
    // then scored in one round trip for the whole week rather than one
    // page.evaluate() per player -- a week can carry several hundred stat
    // lines, and that many separate browser round trips is pure IPC
    // overhead for no benefit.
    const mapped = ids.map((id) => ({ id, ...mapRawWeek(weekly[id], statKeys) }))
    const pointsById = await page.evaluate(({ mapped, formats }) => {
      const out = {}
      mapped.forEach(({ id, block }) => {
        const row = {}
        formats.forEach((fmt) => { row[fmt] = pointsUnder(block, rulesForFormat(fmt)) })
        out[id] = row
      })
      return out
    }, { mapped, formats: FORMATS })

    const players = mapped.map(({ id, block, usage }) => {
      const raw = weekly[id]
      const master = playerMaster[id] || {}
      return {
        id,
        name: master.full_name ?? null,
        pos: master.position ?? null,
        // The stat row's own team, not the player master's current one --
        // this is what makes an in-season trade visible in the archive.
        // Confirmed present on the raw row: build_players.py's own
        // IGNORED_KEYS lists "team" among the season-stats keys it
        // deliberately drops, which is only there to drop because Sleeper
        // sends it.
        team: raw.team ?? master.team ?? null,
        injuryStatus: master.injury_status || master.status || '',
        depthChartPosition: master.depth_chart_position ?? null,
        depthChartOrder: master.depth_chart_order ?? null,
        stats: block,
        usage,
        points: pointsById[id],
      }
    })

    console.log(`Scored ${players.length} players under ${FORMATS.join('/')}.`)

    const actuals = { season, week, players }
    mkdirSync(DIR, { recursive: true })
    const actualsText = JSON.stringify(actuals, null, 2) + '\n'
    const payloadHash = createHash('sha256').update(actualsText).digest('hex')

    const manifest = {
      season,
      week,
      capturedAt: new Date().toISOString(),
      gitSha: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(),
      sourceData: {
        weeklyStatsFetchedAt: weeklyFetchedAt,
        playerMasterFetchedAt,
      },
      counts: { players: players.length },
      payload: { file: 'actuals.json', sha256: payloadHash },
      generator: { script: 'scripts/archive_week.mjs', nodeVersion: process.version },
    }

    writeFileSync(ACTUALS_FILE, actualsText)
    writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n')

    const writtenHash = createHash('sha256').update(readFileSync(ACTUALS_FILE)).digest('hex')
    if (writtenHash !== payloadHash) {
      throw new Error(`hash mismatch after write: manifest says ${payloadHash}, file hashes to ${writtenHash}`)
    }

    console.log(`\nWrote ${ACTUALS_FILE}`)
    console.log(`Wrote ${MANIFEST_FILE}`)
    console.log(`sha256 verified: ${payloadHash}`)
  } finally {
    if (browser) await browser.close()
    vite.kill()
  }
}

// Guarded so scripts/test_archive_week.mjs can import mapRawWeek() without
// triggering a live Sleeper fetch and a vite/browser boot.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
