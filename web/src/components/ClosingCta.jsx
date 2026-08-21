// The page's last word before the footer — same CTA copy and destination as
// the hero's primary button on purpose (the brief is explicit: "Copy is
// 'Start a Free Mock Draft' in both places — keep them identical"), so a
// reader who scrolled the whole page without deciding sees the exact same
// offer they already passed on once, not a second, slightly different pitch.
export default function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-[300px] w-[800px]"
        style={{
          background: 'radial-gradient(ellipse 800px 300px at 50% 100%, rgba(123,31,162,0.1), transparent 70%)',
        }}
      />
      <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-12 px-6 py-[84px]">
        <div>
          <h2 className="font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.015em] text-white sm:text-[34px] sm:leading-[1.12] sm:tracking-[-0.025em]">
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
