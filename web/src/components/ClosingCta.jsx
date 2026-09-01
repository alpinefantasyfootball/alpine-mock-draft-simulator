// The page's last word before the footer — same CTA copy and destination as
// the hero's primary button on purpose (the brief is explicit: "Copy is
// 'Start a Free Mock Draft' in both places — keep them identical"), so a
// reader who scrolled the whole page without deciding sees the exact same
// offer they already passed on once, not a second, slightly different pitch.
export default function ClosingCta() {
  return (
    // A standalone band now, not a full-bleed section: margin-top: 96px per
    // §2 rather than the padding-top-on-the-following-element pattern every
    // other section boundary uses — this one is its own bordered, radiused
    // panel (Design Tokens' "16 (band)" radius), so it needs a real margin
    // outside its own box rather than padding that would sit inside the
    // border. The old radial purple glow is gone, replaced by the panel's
    // own gradient fill — the same "one defined surface, not an ad-hoc
    // decorative effect" argument §1 makes for the rest of the page.
    <section className="relative mx-auto mt-[96px] max-w-[1200px] overflow-hidden rounded-[16px] border border-line-hairline px-10 py-10"
      style={{ background: 'linear-gradient(110deg, #151A29, #13161C 60%)' }}
    >
      {/* flex-col below lg, same as the row it becomes at lg: one <a>,
          rendered once — a size-only responsive change, unlike Hero.jsx's
          two full alternate trees, because nothing about this band's copy
          or destination differs by width. That's deliberate: this file's
          own top comment already documents keeping this band's CTA and the
          hero's identical as the reason this band repeats the hero's rather
          than writing a second one. That rule is unchanged; both strings
          just moved together, from "Start a Free Mock Draft" to "Enter the
          Draft Room" — the revised mobile handoff's one-screen-one-CTA
          rule, which also demotes the price out of every button on the page
          and into a single mono line under the hero's pair. A mobile-only
          reword would still break the rule; this is not one, because
          Hero.jsx and Header.jsx's sticky bar changed with it. Full width
          and 54px tall below lg to clear the handoff's own primary-CTA
          floor. */}
      <div className="relative flex flex-col gap-8 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-12">
        <div>
          {/* Italic to match RoomsGrid.jsx's and ShowYourWorking.jsx's own
              section headers — a design review found this one upright
              while those two were italic, one of four different heading
              treatments on a single page. */}
          <h2 className="font-display text-[clamp(30px,3vw,40px)] font-extrabold italic leading-none text-voidInk-primary">
            Open the Draft Room.
          </h2>
          <p className="mt-3 text-[17px] text-voidInk-body">No setup, no league import. Pick your scoring and start.</p>
        </div>

        {/* data-hero-cta: same marker Hero.jsx's own CTAs carry. Header.jsx's
            sticky bottom bar was only ever watching the hero's copy of this
            button, so scrolling this far left it floating a third, identical
            "Enter the Draft Room" over this section's own — reported directly
            (four total appearances of the button on one mobile page, two of
            them stacked at once at every section that has its own). */}
        {/* Same gradient as Hero's primary, §10's own instruction — but no
            glow here: the closing band already carries its own gradient
            fill (this file's own top comment), so a second glow on top of
            it would be competing with the surface it sits on rather than
            lifting off it the way it does against Hero's plain void
            ground. */}
        <a
          href="#/drafts"
          data-hero-cta=""
          className="flex h-[54px] w-full shrink-0 items-center justify-center rounded-full text-base font-bold text-[#0B0D12]
                     transition-all duration-200 active:scale-[0.98] lg:h-auto lg:w-auto lg:px-8 lg:py-4"
          style={{ background: 'linear-gradient(100deg, #44D4E2, #82A1F6)' }}
        >
          Enter the Draft Room
        </a>
      </div>
    </section>
  )
}
