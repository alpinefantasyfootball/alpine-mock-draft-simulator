import { existsSync, cpSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

// The site is still one static tree, not two — app.js et al. are still
// plain files with no build step of their own. This just moves the ones
// Vite doesn't know about into the same output directory Vite writes to,
// so a Cloudflare Pages deploy sees one complete site. room.js is
// deliberately excluded: it is loaded by the Cloudflare Worker only and
// is never referenced from any page.
//
// Exported (not just run) so vite.config.js's dev-server middleware can
// serve this exact list too — one list, not a second copy of it that
// drifts the way ROOMS once did.
export const LEGACY_FILES = [
  'app.js',
  'draft-engine.js',
  'live.js',
  'theme.js',
  'back-to-top.js',
  'players.js',
  'stats.js',
  'style.css',
  '404.html',
  '_headers',
]

export const LEGACY_DIRS = ['docs']

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.resolve(__dirname, '../dist')

function main() {
  if (!existsSync(OUT_DIR)) {
    throw new Error(`${OUT_DIR} does not exist — run "vite build" before this script.`)
  }

  const copied = []
  const missing = []

  for (const name of LEGACY_FILES) {
    const src = path.join(REPO_ROOT, name)
    if (!existsSync(src)) {
      missing.push(name)
      continue
    }
    cpSync(src, path.join(OUT_DIR, name))
    copied.push(name)
  }

  for (const name of LEGACY_DIRS) {
    const src = path.join(REPO_ROOT, name)
    if (!existsSync(src)) {
      missing.push(name + '/')
      continue
    }
    cpSync(src, path.join(OUT_DIR, name), { recursive: true })
    copied.push(name + '/')
  }

  // Count what survived, not what was attempted — a silent short list here
  // is exactly the "rebuild nobody sees" failure this project has hit before.
  console.log(`copy-legacy-assets: copied ${copied.length}/${LEGACY_FILES.length + LEGACY_DIRS.length}`)
  copied.forEach((name) => console.log(`  + ${name}`))

  if (missing.length) {
    console.error(`copy-legacy-assets: MISSING ${missing.length}:`)
    missing.forEach((name) => console.error(`  - ${name}`))
    process.exit(1)
  }
}

// Only run when this file is executed directly, not when vite.config.js
// imports LEGACY_FILES for the dev-server middleware. process.argv[1] is an
// OS path (backslashes on Windows); import.meta.url is always a file: URL
// (forward slashes, percent-encoded) — comparing them as strings without
// pathToFileURL is false on Windows even when this *is* the entry module,
// which is how the copy silently never ran.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
