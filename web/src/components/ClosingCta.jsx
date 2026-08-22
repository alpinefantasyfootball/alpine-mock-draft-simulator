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
      <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-12 px-6 py-[84px]">
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

        <a
          href="#/draft-room"
          className="shrink-0 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-[34px] py-[17px] text-base font-bold text-white
                     shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
        >
          Start a Free Mock Draft
        </a>
      </div>
    </section>
  )
}
