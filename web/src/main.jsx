import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import DraftSettings from './components/DraftSettings.jsx'
import AppHeader from './components/AppHeader.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// #setup-root lives inside #tab-setup, which app.js's own applyRoute()/
// enterDraftUI() already show and hide correctly (home vs. draft, setup vs.
// live board) — this root just needs to exist; it never touches routing
// itself, same contract the #root mount above already keeps.
const setupRoot = document.getElementById('setup-root')
if (setupRoot) {
  ReactDOM.createRoot(setupRoot).render(
    <React.StrictMode>
      <DraftSettings />
    </React.StrictMode>,
  )
}

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
