import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, statSync, createReadStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { LEGACY_FILES, LEGACY_DIRS } from './scripts/copy-legacy-assets.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
}

// Vite's dev server only serves web/ and web/public/ — app.js and its
// siblings live one level up, at the true repo root, and that does not
// change (see copy-legacy-assets.mjs). This serves the same file list
// from there during `vite dev`, off the same LEGACY_FILES/LEGACY_DIRS the
// production build copies, so window.JukeEngine carries real data locally
// without a full build on every change.
function legacyAssets() {
  return {
    name: 'legacy-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url.split('?')[0]
        const name = pathname.replace(/^\//, '')
        const isFile = LEGACY_FILES.includes(name)
        const isDir = LEGACY_DIRS.some((dir) => pathname.startsWith(`/${dir}/`))
        if (!isFile && !isDir) return next()

        const filePath = path.join(REPO_ROOT, name)
        if (!existsSync(filePath) || !statSync(filePath).isFile()) return next()

        const ext = path.extname(filePath)
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
        createReadStream(filePath).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), legacyAssets()],
})
