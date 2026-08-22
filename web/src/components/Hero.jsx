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

      <div className="relative mx-auto grid max-w-7xl gap-[72px] px-6 pb-[76px] pt-[92px] lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          {/* Mobile eyebrow/headline/paragraph/CTAs are a separate stack
              from desktop's, not a resized copy of it — the mobile handoff
              (design_handoff_mobile) writes shorter, phone-specific copy
              throughout the hero, the same way Header.jsx already renders
              two whole <JukeLogo> instances rather than one resized by CSS.
              lg:hidden / hidden lg:* is the toggle, matching that precedent. */}
          <span className="font-plex text-[11.5px] font-bold tracking-[0.14em] text-teal-400 lg:hidden">
            FREE &middot; UNLIMITED MOCKS
          </span>
          <span className="hidden items-center gap-[9px] rounded-full border border-mint/30 bg-mint/[0.06] px-[15px] py-[7px] text-[11.5px] font-bold tracking-[0.13em] text-mint lg:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
            </span>
            AGILITY THROUGH ANALYTICS
          </span>

          {/* 39px Archivo 900, per the handoff — Archivo is already fetched
              (index.html's Google Fonts link, weights 400..900) for
              JukeLogo.jsx's wordmark, so this costs no extra request, but
              nothing routes it through a Tailwind utility: font-display
              resolves to Barlow Condensed (tailwind.config.js), the Draft
              Room's own display face. JukeLogo.jsx reaches Archivo with an
              inline fontFamily rather than a new config token for the same
              single-call-site reason; this follows that precedent instead
              of inventing a second way to ask for the same font. Desktop's
              own h1 (font-display, Barlow Condensed) is untouched below. */}
          <h1
            className="mt-4 text-balance text-[39px] font-black leading-[1.02] tracking-[-0.035em] text-white lg:hidden"
            style={{ fontFamily: "'Archivo', sans-serif" }}
          >
            Mock draft until the board makes sense.
          </h1>

          {/* The brief's 64px is a desktop-only value (prototype captured at
              ~1440px) — scaled down for narrower widths rather than copied
              literally, or "Master the draft." alone overflows a phone's
              own padding before wrapping ever gets a say. */}
          <h1 className="mt-7 hidden text-balance font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-[52px] sm:leading-[1.04] lg:block lg:text-[64px] lg:leading-[1.03] lg:tracking-[-0.032em]">
            <span className="text-white">Master the draft.</span>
            <br />
            <span className="text-mint">Dominate the season.</span>
          </h1>

          {/* Mobile paragraph keeps the same "name what's live" discipline
              the desktop rewrite below already follows, but doesn't repeat
              the handoff's literal "eleven opponents" — that's an artifact
              of the mock's own 12-team illustration, and the app's real
              default (league.teams in app.js) is 10, with the room
              configurable 4-24 wide from the setup screen. Desktop's own
              paragraph already avoids committing to a seat count for the
              same reason; this one follows suit rather than printing a
              number that's wrong for most rooms drafted. */}
          <p className="mt-4 max-w-[480px] text-pretty text-base leading-[1.55] text-white/55 lg:hidden">
            Draft against a room of CPU opponents that react to your picks, then get a graded
            report that shows its working. Change your scoring rules and every number reruns.
          </p>

          {/* Rewritten off a design review: the previous copy ("power your
              entire fantasy football lifecycle with advanced VORP metrics,
              predictive modeling, and real-time simulations") promised five
              rooms that don't exist yet, one paragraph above a grid that
              itself says so. This names only what a visitor can actually
              click right now — the scoring toggle immediately to the right
              is the proof, not just a claim next to one. */}
          <p className="mt-6 hidden max-w-[530px] text-pretty text-[17.5px] leading-[1.6] text-white/55 lg:block">
            Free, unlimited mock drafts against a board that reruns live on your own scoring
            rules — standard, half or full PPR, recalculated the instant you change it — against
            CPU opponents that understand ADP, tiers and replacement value.
          </p>

          {/* Two stacked 54px CTAs, mobile only. "See how it works" points
              at #proof rather than the how-it-works doc: SiteNav.jsx's own
              NAV_LINKS already uses #proof for the identical "How It Works"
              label, and a second destination behind the same words would be
              exactly the two-headers drift that file was written to end. */}
          <div className="mt-8 flex flex-col gap-3 lg:hidden">
            <a
              href="#/draft-room"
              className="flex h-[54px] w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7B1FA2] text-base font-bold text-white
                         shadow-glass transition-all duration-200 active:scale-[0.98]"
            >
              Start a mock draft
            </a>
            <a
              href="#proof"
              className="flex h-[54px] w-full items-center justify-center rounded-full border border-white/20 text-base font-bold text-white
                         transition-colors duration-200 hover:border-teal-400/60 hover:text-teal-300"
            >
              See how it works
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
              Start a Free Mock Draft
            </a>
            <a
              href="#rooms"
              className="group inline-flex items-center gap-2 text-base font-semibold text-white/90 transition-colors hover:text-mint"
            >
              Explore The Rooms
              <ChevronRight className="h-4 w-4 text-teal-400 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
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
