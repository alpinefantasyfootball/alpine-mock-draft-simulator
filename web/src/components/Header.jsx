import { useEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import JukeLogo from './juke-logo/JukeLogo.jsx'
import ComingSoonModal from './ComingSoonModal.jsx'
import MobileNavSheet from './MobileNavSheet.jsx'
import { NavLinks, AccountButtons } from './SiteNav.jsx'

// NavLinks/AccountButtons come from SiteNav.jsx now rather than a second
// literal copy — this file's own comment used to say the homepage was "out
// of scope for the pass that added [SiteNav.jsx], so nothing there was
// touched," which is exactly the drift SiteNav.jsx exists to prevent once
// something *does* touch this file again. This pass is that something: the
// mobile hamburger sheet needs the same list LobbyBar.jsx already reads from
// there, and a second copy behind it would be the identical two-headers bug
// SiteNav.jsx was written to fix, just moved one level down into "which
// list does the mobile sheet see." NavLinks (rather than mapping NAV_LINKS
// directly, the way this file used to) is the same fix applied a second
// time, for "The Rooms" dropdown and the currentRoom indicator — see
// SiteNav.jsx's own comment on NavLinks. This file never passes
// currentRoom: the homepage isn't "inside" any room, which is also why
// NAV_LINKS no longer carries a permanent "Draft Room" entry at all — see
// that array's own comment.
/* The sticky bottom CTA hides while ANY primary "Enter the Draft Room" CTA
   is on screen — Hero's own pair, RoomsGrid's live-room card, and
   ClosingCta's closing band all carry the same data-hero-cta marker now.

   This used to watch only Hero's copy of the button, on the reasoning that
   the same button showing twice in one viewport looks wrong. That's still
   the reasoning; it just didn't go far enough. Homepage v4 pass 2 added two
   more sections with their own full "Enter the Draft Room" CTA (the Rooms
   grid's live card, the closing band) and neither one told this hook it
   existed — so scrolling to either one floated an identical sticky-bar
   button directly over a section that already had one, the exact bug this
   hook exists to prevent, just unfixed at two more places. Reported
   directly: four total appearances of the button on one mobile page.

   An IntersectionObserver on the real elements rather than scroll offsets:
   every one of these sections' heights can change (copy length, a chart's
   loading state), and a hardcoded pixel range is wrong the first time any
   of them does. It watches what actually matters and needs no threshold
   arithmetic re-derived per section.

   Defaults to hidden and reveals on the first callback, so the bar never
   flashes over a CTA that was on screen all along. If none of the marked
   CTAs exist — any page that is not the homepage — the observer never
   fires and the bar stays visible, which is the correct fallback: on a
   page with no other CTA, this is the only one. */
function useAnyCtaOnScreen() {
  const [onScreen, setOnScreen] = useState(true)

  useEffect(() => {
    // Multiple targets, one shared observer: onScreen is true whenever
    // *any* of them is intersecting, tracked as a set rather than the
    // single boolean the old one-target version used, since entries only
    // report the targets whose intersection state actually changed.
    const intersecting = new Set()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) intersecting.add(entry.target)
          else intersecting.delete(entry.target)
        })
        setOnScreen(intersecting.size > 0)
      },
      // A sliver counts as on screen: the bar reappearing while a CTA is
      // still half visible is the same double-CTA, just briefer.
      { threshold: 0.15 },
    )

    // RoomsGrid's own CTA doesn't exist at mount — it's behind
    // window.JukeEngine.rooms(), read in RoomsGrid's own effect, so the
    // component renders null for one or more paints before that marked
    // button is ever in the DOM. A querySelectorAll run once here, on
    // this effect's own mount, misses it permanently: not because the bar
    // fails to hide over it, but because this hook never learns the
    // element exists at all. Caught by watching the actual page rather
    // than trusting the fix: the sticky bar stayed visible, aria-hidden
    // "false", directly over RoomsGrid's fully-on-screen CTA.
    //
    // No height filter is needed to skip Hero's hidden mobile/desktop
    // twin the way the single-query version needed one: a display:none
    // element has no box to intersect, so IntersectionObserver reports it
    // as never-intersecting on its own — observing it costs nothing.
    const observed = new WeakSet()
    function observeNew() {
      const all = document.querySelectorAll('[data-hero-cta]')
      // A page with no marked CTA at all — anything but the homepage —
      // has nothing for the observer to ever fire on, so onScreen would
      // sit at its initial `true` forever and the bar would stay hidden
      // with no other CTA on the page to justify that. Checked on every
      // scan, not just the first, since it has to stay correct as
      // RoomsGrid's element arrives (0 markers -> hide bar goes away).
      if (all.length === 0) setOnScreen(false)
      all.forEach((el) => {
        if (observed.has(el)) return
        observed.add(el)
        io.observe(el)
      })
    }
    observeNew()

    const mo = new MutationObserver(observeNew)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [])

  return onScreen
}

export default function Header() {
  const ctaOnScreen = useAnyCtaOnScreen()
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
        this pass.

        Homepage cosmetic revision §13 gives this bar its own exact surface
        (page-bg at 88% alpha, a hairline border) and a padding value —
        applied here as px-10 (horizontal only; matches every other
        section's own 40px content-container padding from §2, so the nav's
        content now lines up edge-to-edge with the rest of the page).
        Deliberately NOT switched to vertical padding-driven sizing: h-14/
        h-16 is read in two other places (Homepage.jsx's <main> padding,
        index.css's scroll-padding-top) and style.css's own .to-top button
        positioning depends on it too — CLAUDE.md documents this as a
        three-way tracked value on purpose. Swapping the sizing mechanism
        would be a real layout change chasing a cosmetic one, for a
        difference (56/64px fixed vs. ~58/~66px padding-driven) too small
        to be worth that risk. */}
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#20242B] bg-[#0D0F15]/[0.88] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-10 px-10 md:h-16">
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
        {/* min-h-[44px] flex items-center: the logo itself renders ~26px
            tall at size=19 (measured during homepage v4 pass 3's
            tap-target audit) and stays that size — this pads the link's
            own hit area around it rather than growing the mark. h-14's
            56px row has room to centre a 44px target inside it. */}
        <a href="#/" aria-label="Juke home" className="flex min-h-[44px] shrink-0 items-center">
          <span className="md:hidden"><JukeLogo size={19} /></span>
          <span className="hidden md:block"><JukeLogo size={38} /></span>
        </a>

        <nav className="hidden shrink-0 items-center gap-7 md:flex">
          <NavLinks
            linkClassName="text-[15px] font-medium text-[#B5B7BD] transition-colors hover:text-white"
            modalRef={modalRef}
          />
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
            className="inline-flex h-11 items-center justify-center rounded-full px-3 text-sm text-white/60 transition-colors hover:text-white"
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
          <AccountButtons modalRef={modalRef} variant="ghost" />
        </div>
      </div>

      {/* The status strip (live dot, player count, ADP time, league shape)
          lived here — homepage v4 pass 2's replacement for the old marquee
          ticker. Removed as redundant once the rest of the page carried the
          same facts elsewhere. The header stays `fixed`, unchanged: removing
          a row from inside it just makes the pinned box shorter, which is
          why Homepage.jsx's <main> padding and index.css's
          scroll-padding-top both had to shrink with it — see the comments
          on both. */}

      <ComingSoonModal ref={modalRef} />
    </header>

    {/* A true sibling of <header>, not a descendant, for the identical
        reason the bottom action bar below is one: MobileNavSheet's own
        panel is `fixed inset-0`, and backdrop-blur-md on <header> is a CSS
        filter — any filter/backdrop-filter on an ancestor becomes the
        containing block for a position:fixed descendant, the same rule
        transform follows. Nested inside <header> this resolved the sheet's
        `inset-0` against the *header's own* short box (h-14/h-16) instead
        of the viewport: measured live, the panel's rendered height was
        exactly 56px, with its nav links and account buttons overflowing
        that box uncontained and reading as pasted over the hero underneath
        rather than a slide-in drawer. ComingSoonModal stays inside
        <header> — a native <dialog> promotes to the browser's own top
        layer on showModal(), which sits above this containing-block
        question entirely, so it was never the same bug. */}
    <MobileNavSheet open={navOpen} onClose={() => setNavOpen(false)} modalRef={modalRef} variant="ghost" />

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
      className={
        'fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] px-4 py-2 transition-[opacity,transform] duration-200 lg:hidden ' +
        (ctaOnScreen ? 'pointer-events-none translate-y-full opacity-0' : 'translate-y-0 opacity-100')
      }
      aria-hidden={ctaOnScreen}
      style={{ background: 'rgba(11,14,20,0.95)', backdropFilter: 'blur(12px)', paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <a
        href="#/drafts"
        className="flex h-[50px] w-full items-center justify-center rounded-full text-[15px] font-bold text-[#0B0D12] transition-transform active:scale-[0.98]"
        style={{
          background: 'linear-gradient(100deg, #44D4E2, #82A1F6)',
          boxShadow: '0 10px 34px -14px rgba(63,177,234,0.7)',
        }}
      >
        Enter the Draft Room
      </a>
    </div>
    </>
  )
}
