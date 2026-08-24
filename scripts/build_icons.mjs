// Render the PNG icons from the SVGs that define them.
//
// This closes the gap CLAUDE.md has now recorded across three brand
// generations: "a raster export is invisible to every pass this project knows
// how to run, so it does not drift a little, it stays exactly where it was
// until somebody goes and looks." Orange survived a rebrand inside these files
// because nothing here could re-render them; the shark swap replaced them by
// hand. Neither needs to happen again - the SVGs are the source, and this
// makes the PNGs a build product of them.
//
// Playwright is already a dev dependency for the end-to-end suite, so this
// adds no new tooling. Same argument as scripts/build_og.html being driven
// from node rather than clicked: a headless browser has a filesystem, and a
// download link does not survive one.
//
//   node scripts/build_icons.mjs
//   py scripts/build_favicon_ico.py     <- run this afterwards; the .ico is
//                                          assembled from the PNGs this writes
//
// og-image.png is deliberately NOT in this list. It is a designed asset that
// arrived with the shark handoff, not a generated one, and scripts/build_og.html
// draws a plainer fallback - running it would quietly swap the designed card
// for a machine-drawn one. See CLAUDE.md's Files table.

import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUB = join(ROOT, 'web', 'public')

// source SVG -> [ [outputName, pixels], ... ]
const JOBS = [
  ['juke-favicon-16.svg',       [['favicon-16.png', 16]]],
  ['juke-favicon.svg',          [['favicon-32.png', 32], ['favicon-48.png', 48]]],
  ['juke-app-icon-dark.svg',    [['juke-app-icon-180.png', 180], ['juke-app-icon-192.png', 192],
                                 ['juke-app-icon-512.png', 512], ['juke-app-icon-1024.png', 1024]]],
  ['juke-app-icon-maskable.svg',[['juke-app-icon-maskable-512.png', 512]]],
]

// A byte count proves a file was written, not that it is an image. Read the
// PNG signature and the IHDR dimensions back off what we just wrote.
function verify(path, expect) {
  const b = readFileSync(path)
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!sig.every((v, i) => b[i] === v)) throw new Error(`${path}: not a PNG`)
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20)
  if (w !== expect || h !== expect) throw new Error(`${path}: ${w}x${h}, expected ${expect}`)
  return { w, h, bytes: b.length }
}

const browser = await chromium.launch()
let wrote = 0
for (const [src, outs] of JOBS) {
  const svg = readFileSync(join(PUB, src), 'utf8')
  for (const [name, px] of outs) {
    // deviceScaleFactor 1 and an exactly-sized viewport, so the screenshot is
    // the artwork at its own pixel count rather than a scaled crop of a page.
    const page = await browser.newPage({ viewport: { width: px, height: px }, deviceScaleFactor: 1 })
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:transparent}
       svg{display:block;width:${px}px;height:${px}px}</style>${svg}`,
      { waitUntil: 'load' }
    )
    const out = join(PUB, name)
    await page.locator('svg').screenshot({ path: out, omitBackground: true })
    await page.close()
    const v = verify(out, px)
    console.log(`  ${name.padEnd(30)} ${v.w}x${v.h}  ${v.bytes}b   <- ${src}`)
    wrote++
  }
}
await browser.close()

// The repo root keeps its own copies of the two small favicons and the .ico.
// They reach nobody on their own (Pages builds from web/), but git has always
// held them there and build_favicon_ico.py reads and writes there.
for (const n of ['favicon-16.png', 'favicon-32.png']) {
  writeFileSync(join(ROOT, n), readFileSync(join(PUB, n)))
  console.log(`  ${n.padEnd(30)} copied to repo root`)
}

console.log(`\n${wrote} PNGs rendered. Now run: py scripts/build_favicon_ico.py`)
