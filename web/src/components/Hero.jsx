import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import ScoringDemoCard from './ScoringDemoCard.jsx'

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background glow, per the brief — an ellipse behind the text
          column rather than a full-bleed band, so it reads as depth on the
          void background rather than a second surface. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 left-1/2 h-[620px] w-[1100px] -translate-x-[30%]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(34,211,238,0.11), rgba(123,31,162,0.05) 45%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto grid max-w-7xl gap-[72px] px-6 pb-[76px] pt-9 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-[92px]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          {/* One eyebrow at every width now, and it is desktop's mint pill.
              The phone used to get its own teal mono line reading
              "FREE · UNLIMITED MOCKS" — the revised mobile handoff retires
              it on brand-architecture grounds rather than typographic ones:
              price was the first thing a visitor read, and naming the
              category pinned the brand to one room while the Rooms section
              four rows below says five more are coming. "Free" is still
              said, in its own mono line under the CTA pair.

              The paragraph and CTAs below stay split by breakpoint — those
              really are phone-specific — so this is one element leaving that
              arrangement, not the arrangement being abandoned. */}
          <span className="inline-flex items-center gap-[9px] rounded-full border border-mint/30 bg-mint/[0.06] px-[15px] py-[7px] text-[11.5px] font-bold tracking-[0.13em] text-mint">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
            </span>
            AGILITY THROUGH ANALYTICS
          </span>

          {/* One headline at every width, in font-display (Barlow Condensed).
              The phone used to get its own 39px Archivo 900 sentence; the
              revised handoff retires it for the reason its own note gives —
              Archivo is the wordmark's face, and every section header on
              this page is font-display, so a display headline in a second
              face is the odd one out rather than the phone-specific choice
              it looked like.

              46px/700 at 1.04 below sm is the handoff's own value. sm and
              above keep exactly the sizes and the 800 weight they already
              had, so this is a change to the phone and to nothing else —
              the earlier note about 64px being a ~1440px capture still
              holds for the steps above.

              A condensed face is what makes 46px fit 390px at all: "Master
              the draft." at 39px Archivo was already close to the padding,
              and this is seven points larger. */}
          <h1 className="mt-5 text-balance font-display text-[46px] font-bold leading-[1.04] tracking-[-0.02em] sm:mt-7 sm:text-[52px] sm:font-extrabold sm:leading-[1.04] lg:text-[64px] lg:leading-[1.03] lg:tracking-[-0.032em]">
            <span className="text-white">Master the draft.</span>
            <br />
            <span className="text-mint">Dominate the season.</span>
          </h1>

          {/* One paragraph at both widths, and it is the phone's.

              These were two entirely different sentences — the phone said
              "Draft against a room of CPU opponents…", desktop said "Free,
              unlimited mock drafts against a board that reruns live…" — which
              is a different message about the product depending on the width
              of the window it is read in. Reported from the live site as
              exactly that.

              Desktop's is the one that goes, for the same reason the eyebrow
              and the CTAs already changed: it opens on the price. After that
              pass, desktop's own hero was arguing with itself — a brand
              eyebrow and headline, "Enter the Draft Room" underneath, and a
              paragraph between them leading with "Free, unlimited mock
              drafts". The revised handoff says to keep this sentence verbatim
              on the phone and explicitly not to promote desktop's; making it
              the only one is the same instruction with the divergence removed.

              It is also the better sentence on its own terms, which is worth
              recording so nobody swaps it back. It names no seat count — the
              app's default is 10 and the room is configurable 4-24 wide, so
              any number here is wrong for most rooms drafted — and it says
              what the product does rather than what it costs. Price now lives
              in the mono line under the CTA pair, once, on both widths. */}
          <p className="mt-4 max-w-[480px] text-pretty text-base leading-[1.55] text-white/55 lg:mt-6 lg:max-w-[530px] lg:text-[17.5px] lg:leading-[1.6]">
            Draft against a room of CPU opponents that react to your picks, then get a graded
            report that shows its working. Change your scoring rules and every number reruns.
          </p>

          {/* Two stacked 54px CTAs, mobile only. The secondary is "Explore
              The Rooms" pointing at #rooms — desktop's own pair, rather than
              the "See how it works" → #proof this used to carry. Both are
              live destinations on this page; what decided it is that the
              hero's job here is to hand the reader the brand's shape (one
              room live, five coming) rather than to re-explain the method
              the section directly below is already the proof of.

              The primary is "Enter the Draft Room", which is now the only
              CTA string on the page — Header.jsx's sticky bar and
              ClosingCta.jsx's band say it too. ClosingCta's own comment
              already required the band and the hero to be identical at
              every width; that rule is unchanged, all three strings just
              moved together. */}
          <div className="mt-8 flex flex-col gap-3 lg:hidden">
            <a
              href="#/draft-room"
              className="flex h-[54px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-base font-bold text-white
                         shadow-glass transition-all duration-200 active:scale-[0.98]"
            >
              Enter the Draft Room
            </a>
            <a
              href="#rooms"
              className="flex h-[54px] w-full items-center justify-center rounded-full border border-white/20 text-base font-bold text-white
                         transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300"
            >
              Explore The Rooms
            </a>
          </div>

          <div className="mt-9 hidden flex-wrap items-center gap-[26px] lg:flex">
            {/* #/draft-room, not #/draft — see the comment on ROOMS in
                app.js. This is the product's actual "start" button, so it
                was the most direct way this bug shipped. */}
            <a
              href="#/draft-room"
              className="rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] px-8 py-4 text-base font-bold text-white
                         shadow-glass transition-all duration-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]"
            >
              Enter the Draft Room
            </a>
            <a
              href="#rooms"
              className="group inline-flex items-center gap-2 text-base font-semibold text-white/90 transition-colors hover:text-mint"
            >
              Explore The Rooms
              <ChevronRight className="h-4 w-4 text-teal-400 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          {/* Where the price went, on both breakpoints. It is true, it is
              worth saying, and it is no longer the first thing read — which
              is the whole of the change: a mono caption under the action
              rather than the eyebrow above the headline, or (on desktop
              until now) the opening words of the paragraph.

              It sits outside both CTA blocks deliberately. The handoff only
              specifies it for the phone, and writing it there would have left
              desktop with no price claim at all once its paragraph stopped
              leading with one — which is the same divergence this pass exists
              to close, introduced from the other direction.

              Not a tap target, so exempt from the 44px floor; 11.5px is the
              handoff's own value and sits on the type floor for mono. */}
          <p className="mt-3 text-center font-plex text-[11.5px] tracking-[0.1em] text-[#7C8A99] lg:mt-5 lg:text-left">
            FREE &middot; UNLIMITED &middot; NO ACCOUNT
          </p>
        </motion.div>

        {/* Not rotated, not floating — squared and aligned as a real second
            grid column, unlike the tilted card this replaced. The brief is
            explicit about this being deliberate: a denser, more structured
            page reads calmer without a tilted panel drawing the eye first.

            This used to be a static, non-interactive "Live board" list —
            five rows of names nobody could touch. A design review pointed
            out that the one genuinely interactive proof on the page (the
            PPR toggle below) was buried a full scroll down while the hero
            showed a picture of a board instead of the real thing. Swapped
            for the same live demo rather than removed outright: max-w-md
            (was max-w-sm) because six ranked rows want a little more room
            than five static ones did. */}
        <motion.div
          className="relative mx-auto w-full max-w-md"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <ScoringDemoCard />
        </motion.div>
      </div>
    </section>
  )
}
