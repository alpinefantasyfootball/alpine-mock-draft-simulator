// The page's last word before the footer — same CTA copy and destination as
// the hero's primary button on purpose (the brief is explicit: "Copy is
// 'Start a Free Mock Draft' in both places — keep them identical"), so a
// reader who scrolled the whole page without deciding sees the exact same
// offer they already passed on once, not a second, slightly different pitch.
export default function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06]">
      {/* h-[420px] with the gradient centred in the middle of it (not at
          its bottom edge) rather than the 300px/"at 50% 100%" version this
          replaced — that put the glow's brightest point exactly on the
          section's own bottom edge, so the fade's other half was never
          drawn and the visible half read as cut off by a hard straight
          line right where the footer starts (a design review flagged this
          precisely). Centring it gives the falloff room to reach fully
          transparent on every side before it can meet an edge, on a
          section short enough that the box's own top can safely run past
          the section's — by then the gradient has nothing left to clip. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-[420px] w-[900px]"
        style={{
          background: 'radial-gradient(ellipse 900px 170px at 50% 50%, rgba(123,31,162,0.12), transparent 70%)',
        }}
      />
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
      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-6 py-[84px] lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-12">
        <div>
          {/* Italic to match RoomsGrid.jsx's and ShowYourWorking.jsx's own
              section headers — a design review found this one upright
              while those two were italic, one of four different heading
              treatments on a single page. */}
          <h2 className="font-display text-[26px] font-extrabold italic leading-[1.15] tracking-[-0.015em] text-white sm:text-[34px] sm:leading-[1.12] sm:tracking-[-0.025em]">
            Open the Draft Room.
          </h2>
          <p className="mt-[10px] text-base text-white/55">No setup, no league import. Pick your scoring and start.</p>
        </div>

        {/* data-hero-cta: same marker Hero.jsx's own CTAs carry. Header.jsx's
            sticky bottom bar was only ever watching the hero's copy of this
            button, so scrolling this far left it floating a third, identical
            "Enter the Draft Room" over this section's own — reported directly
            (four total appearances of the button on one mobile page, two of
            them stacked at once at every section that has its own). */}
        <a
          href="#/drafts"
          data-hero-cta=""
          className="flex h-[54px] w-full shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-base font-bold text-white
                     shadow-glass transition-all duration-200 active:scale-[0.98] lg:h-auto lg:w-auto lg:px-[34px] lg:py-[17px] lg:hover:scale-105 lg:hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
        >
          Enter the Draft Room
        </a>
      </div>
    </section>
  )
}
