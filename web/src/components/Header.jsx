import { useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import Ticker from './Ticker.jsx'
import JukeLogo from './juke-logo/JukeLogo.jsx'
import ComingSoonModal from './ComingSoonModal.jsx'
import MobileNavSheet from './MobileNavSheet.jsx'
import { NAV_LINKS, AccountButtons } from './SiteNav.jsx'

// NAV_LINKS/AccountButtons come from SiteNav.jsx now rather than a second
// literal copy — this file's own comment used to say the homepage was "out
// of scope for the pass that added [SiteNav.jsx], so nothing there was
// touched," which is exactly the drift SiteNav.jsx exists to prevent once
// something *does* touch this file again. This pass is that something: the
// mobile hamburger sheet needs the same list LobbyBar.jsx already reads from
// there, and a second copy behind it would be the identical two-headers bug
// SiteNav.jsx was written to fix, just moved one level down into "which
// list does the mobile sheet see."
export default function Header() {
  const modalRef = useRef(null)
  const [navOpen, setNavOpen] = useState(false)

  return (
    // A Fragment, not a single <header> return — the bottom action bar
    // below has to be a true sibling of it, not a descendant. backdrop-blur
    // is a filter, and any CSS filter/backdrop-filter on an ancestor makes
    // that ancestor the containing block for a position:fixed descendant,
    // the same way transform does — so a `fixed bottom-0` nested inside
    // this blurred, top-pinned <header> resolved "bottom" against the
    // *header's own* short box, not the viewport, and rendered right under
    // the top bar instead of at the screen's true bottom edge. Splitting
    // them into two independently-fixed elements is the actual fix, not a
    // different bottom-* value inside the same wrong containing block.
    <>
    {/* Two stacked rows now rather than one: the ticker used to share row 1
        with the logo and nav, flex-1 between them — fine with no nav, but a
        four-link nav plus a marquee competing for the same 64px is exactly
        the "runs behind the logo and clips mid-word" layout the redesign
        exists to fix. Row 2 is the ticker's own space, nothing else in it.

        h-14 (56px) below md, h-16 (64px) at md+: the mobile handoff specifies
        56px for this bar and desktop was already built at 64px — rather than
        shrinking desktop to match a spec that never asked for it, the row
        takes two heights the same way LobbyBar.jsx's 56px already does at
        every width, just gated here since Header.jsx's desktop height predates
        this pass. */}
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-void/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-10 px-4 md:h-16 md:px-6">
        {/* Two instances behind a wrapper's hidden/block, not a className
            passed straight to JukeLogo: the component's own root <span>
            hardcodes display:inline-flex as an inline style so its mark and
            wordmark line up, and an inline style always wins over a
            Tailwind display class of any specificity — md:hidden on the
            component itself would be silently defeated, the same
            translucency-over-opaque trap this codebase already has a rule
            about, just for `display` instead of colour. The wrapper's own
            display is plain and un-fought-over, so its hidden/block toggle
            actually applies. */}
        <a href="#/" aria-label="Juke home" className="shrink-0">
          <span className="md:hidden"><JukeLogo size={19} /></span>
          <span className="hidden md:block"><JukeLogo size={38} /></span>
        </a>

        <nav className="hidden shrink-0 items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-white/60 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Log in stays a text link at every width — the mockup keeps it
            beside the hamburger rather than folding it into the sheet, so
            it's one tap rather than two for the one account action a visitor
            is likeliest to already have a reason to press. Sign Up moves
            into the sheet: two CTAs competing for a 375px-wide row is the
            same crowding problem the bottom action bar exists to solve for
            the page's real primary action. */}
        <div className="ml-auto flex shrink-0 items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={() =>
              modalRef.current?.open(
                'Accounts are not live yet',
                'There is nothing to log into so far. Your drafts save to this device, ' +
                  'so you can close the tab and pick up where you left off.'
              )
            }
            className="rounded-full px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
          <AccountButtons modalRef={modalRef} />
        </div>
      </div>

      {/* lg:block, not md: the ticker is a horizontal-scroll marquee of
          short stat cards — legible at tablet width, where it already ran
          before this pass, but review item 24's whole complaint (clipped
          mid-word, competing with whatever is beneath it) is worse, not
          better, in the ~375px this bar drops to below md. Cut on mobile
          per the mobile handoff's own Prompt 2, kept everywhere it already
          worked. */}
      <div className="hidden lg:block">
        <Ticker />
      </div>

      <MobileNavSheet open={navOpen} onClose={() => setNavOpen(false)} modalRef={modalRef} />
      <ComingSoonModal ref={modalRef} />
    </header>

    {/* Sticky bottom action bar — the marketing shell's other half, and a
        true sibling of <header> above rather than a descendant of it.
        backdrop-blur-md on <header> is a CSS filter, and any
        filter/backdrop-filter on an ancestor becomes the containing block
        for a position:fixed descendant — the same rule transform follows —
        so a bottom-0 element nested inside that blurred, top-pinned header
        resolved "bottom" against the *header's own* short box instead of
        the viewport, and rendered right under the top bar rather than at
        the screen's true bottom edge. This had to become a sibling, not a
        different offset inside the same wrong containing block, which is
        the whole reason this file returns a Fragment now.

        Same rgba(11,14,20) ground and top hairline the mockup specifies;
        style.css's own .to-top button shifts up to clear this exact bar
        below the same 1024px breakpoint — see the comment there if this
        bar's height or breakpoint ever changes, since that rule has to
        track it. */}
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] px-4 py-2 lg:hidden"
      style={{ background: 'rgba(11,14,20,0.95)', backdropFilter: 'blur(12px)', paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <a
        href="#/draft-room"
        className="flex h-[50px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-[15px] font-bold text-white shadow-glass transition-transform active:scale-[0.98]"
      >
        Start a mock draft — free
      </a>
    </div>
    </>
  )
}
