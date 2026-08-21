import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AppHeader from './components/AppHeader.jsx'
import DraftRoom from './components/DraftRoom.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// #appbar-root lives inside #appbar, which applyRoute() already shows and
// hides (home vs. draft route) — same contract as the two mounts above.
const appbarRoot = document.getElementById('appbar-root')
if (appbarRoot) {
  ReactDOM.createRoot(appbarRoot).render(
    <React.StrictMode>
      <AppHeader />
    </React.StrictMode>,
  )
}

// #draftroom-root is not inside #view-home or #view-app, and nothing in
// app.js shows or hides it — DraftRoom itself watches location.hash and
// renders null off the #/draft-room route, so this mount is always safe to
// create regardless of which route is active.
const draftRoomRoot = document.getElementById('draftroom-root')
if (draftRoomRoot) {
  ReactDOM.createRoot(draftRoomRoot).render(
    <React.StrictMode>
      <DraftRoom />
    </React.StrictMode>,
  )
}
