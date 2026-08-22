import { motion } from 'framer-motion'

const FEATURES = [
  {
    title: 'Change a rule. Every number moves.',
    body: 'Every projection on the board reruns through the scoring table the instant you edit it — nothing is cached.',
  },
  {
    title: 'The score shows its working.',
    body: 'Points above replacement, not a black-box rating — you can always see what a number is measuring against.',
  },
  {
    title: 'Rebuilt every morning.',
    body: "ADP and injury data refresh nightly, so the board reflects this week's market, not last month's.",
  },
]

// The live PPR-toggle demo used to live in this section, in a two-column
// layout beside these three cards. A design review found it buried a full
// scroll down the page while the hero above showed a static, non-
// interactive board instead — so the demo moved up into Hero.jsx (see
// ScoringDemoCard.jsx) and isn't repeated here. What's left is the "why"
// behind a proof the reader has already clicked through once by the time
// they reach it, so a three-across row reads better than the narrower
// column these cards used to sit in.
export default function ShowYourWorking() {
  return (
    <section id="proof" className="relative isolate mx-auto max-w-7xl px-6 py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[400px] w-[900px]"
        style={{
          background: 'radial-gradient(ellipse 900px 400px at 50% 0%, rgba(34,211,238,0.05), transparent 70%)',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        className="max-w-[720px]"
      >
        {/* Left-aligned and italic, matching every other section header on
            the page now (RoomsGrid.jsx's "The Rooms") — this used to be
            centred, which a design review flagged as one of four different
            heading treatments on one page. The hero's own h1 is the
            reference point for alignment (left, per the review) and stays
            upright on purpose; it is the page's headline, not a section
            header, so it doesn't take the italic treatment these do. */}
        <h2 className="text-balance font-display text-[30px] font-extrabold italic leading-[1.15] tracking-[-0.015em] sm:text-[38px] sm:leading-[1.1] lg:text-[46px] lg:leading-[1.08] lg:tracking-[-0.025em]">
          <span className="text-white">Show Your Working </span>
          <span className="not-italic text-white/25">—</span>
          <span className="text-white"> No Black Box</span>
        </h2>
        <p className="mt-4 text-[17px] leading-[1.55] text-white/55">
          Every number Juke prints is one you can follow. Re-calculated live off real market data.
        </p>
      </motion.div>

      {/* items-stretch (grid's own default) so all three cards share the
          row's tallest height rather than each sizing to its own content —
          a design review caught these three rendering at three different
          heights. h-full on each card is what lets it actually fill that
          stretched cell instead of just being allowed to. */}
      <div className="mt-[42px] grid gap-[14px] lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex h-full flex-col rounded-[14px] border border-white/[0.07] bg-[#0d1216] px-[26px] py-6 transition-colors duration-200 hover:border-teal-400/70"
          >
            <h3 className="font-display text-[17px] font-bold text-white">{f.title}</h3>
            <p className="mt-[9px] text-[15px] leading-[1.55] text-[#8e9aa1]">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
