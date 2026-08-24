// Separate from main.jsx on purpose: main.jsx's job is mounting three
// React roots into a page that already exists (#root, #appbar-root,
// #draftroom-root) and tearing down the sonar overlay, none of which make
// sense — or are even possible — running in Node during a build step
// rather than in a browser against a real document. This file's only job
// is exporting the one tree scripts/prerender.mjs needs: App itself, the
// same component main.jsx mounts at #root.
import App from './App.jsx'

export default App
