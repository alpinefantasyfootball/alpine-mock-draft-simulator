import Ticker from './Ticker.jsx'
import JukeLogo from './juke-logo/JukeLogo.jsx'

// Same "not live yet" dialog the rest of the site already uses (#soonDlg,
// wired by app.js's notYet()) — a second, React-only "coming soon" message
// would be one more copy of the same fact to keep in sync.
function notYet(title, body) {
  if (typeof window !== 'undefined' && window.JukeEngine) {
    window.JukeEngine.notYet(title, body)
  }
}

export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-obsidian/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <a href="#/" aria-label="Juke home" className="shrink-0">
          <JukeLogo size={21} />
        </a>

        <Ticker />

        <nav className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() =>
              notYet(
                'Accounts are not live yet',
                'There is nothing to log into so far. Your drafts save to this device, ' +
                  'so you can close the tab and pick up where you left off.'
              )
            }
            className="rounded-full px-4 py-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() =>
              notYet(
                'Sign-up is coming',
                'Juke does not have accounts yet. Everything here is free and needs no ' +
                  'sign-up, and your drafts already save to this device.'
              )
            }
            className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-4 py-2 text-sm font-semibold text-white
                       shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
          >
            Sign Up
          </button>
        </nav>
      </div>
    </header>
  )
}
