import { SignInButton, SignUpButton, SignedOut } from '@clerk/clerk-react'
import KickoffPill from './shell/KickoffPill.jsx'
import RoomsGridAlive from './RoomsGridAlive.jsx'
import { useAccountUiReady } from '../hooks/useAccountUiReady.js'

/* The homepage above the fold — design_handoff_v3_alive 2ag/3ag.

   One responsive tree at every width, where the homepage has had two since
   the mobile pass: a `sm:hidden` HomePhone and a `hidden sm:block` desktop
   page. That split was a real product decision at the time and this handoff
   reverses it for this screen specifically — 2ag and 3ag are the same
   content in two layouts, not two different screens, so a second copy would
   be the "written down twice" rule in markup with nothing bought for it.

   It also removes a cost Homepage.jsx's own comment already names: both
   trees were prerendered and both MOUNTED on every device, because
   CSS-hidden is still mounted. One tree mounts once.

   ---- What this replaces, and what is under it ----

   Replaces: Header (ShellHeader), Hero, RoomsGrid, and HomePhone's whole
   top half.

   Under it is the footer and nothing else. TakeAPick, ShowYourWorking and
   ClosingCta rendered here for one commit — kept on the reasoning that a
   mock which stops after one screenful is not the same claim as "delete the
   rest of the page" — and the owner has since taken all three off. So the
   page is the handoff's own shape now, which ends at the rooms grid, plus
   the footer, which was never optional: it holds the only links to the
   privacy policy and terms.

   All three components still exist unrendered in web/src/components (see
   Homepage.jsx, where the removal is recorded). Nothing here needs to know
   about them; this note exists because its previous version said they were
   still under this and that stopped being true. */

function Card({ gradient, eyebrow, eyebrowColor, title, sub, glyph, href, dataHeroCta }) {
  const style = gradient
    ? { background: 'linear-gradient(100deg,#44D4E2,#82A1F6)' }
    : { background: '#151920', border: '1px solid #252930' }

  return (
    <a
      href={href}
      data-hero-cta={dataHeroCta ? '' : undefined}
      className="flex min-h-[150px] flex-col justify-between rounded-[18px] p-4 transition-transform duration-150 hover:scale-[1.01] sm:min-h-[170px] sm:rounded-[20px] sm:p-[22px]"
      style={style}
    >
      <span className="text-[26px] sm:text-[30px]" aria-hidden="true">
        {glyph}
      </span>
      <span>
        <span
          className="block font-mono text-[9px] tracking-[0.12em] sm:text-[10px]"
          style={{ color: eyebrowColor }}
        >
          {eyebrow}
        </span>
        <span
          className="mt-1 block font-display text-[22px] font-extrabold leading-none sm:text-[28px]"
          style={{ color: gradient ? '#0D0F15' : '#fff' }}
        >
          {title}
        </span>
        <span
          className="mt-1 block text-[12px] sm:text-[13px]"
          style={{ color: gradient ? '#14343d' : '#8A9BAA' }}
        >
          {sub}
        </span>
      </span>
    </a>
  )
}

function AccountCard() {
  const ready = useAccountUiReady()

  const signup = (
    <button
      type="button"
      className="flex-1 whitespace-nowrap rounded-full px-3 py-3 text-[14px] font-bold text-surface-page transition-transform duration-150 hover:scale-[1.02] sm:px-5"
      style={{ background: 'linear-gradient(100deg,#44D4E2,#82A1F6)' }}
    >
      Sign up
    </button>
  )
  const login = (
    <button
      type="button"
      className="flex-1 whitespace-nowrap rounded-full border border-flow-pillEdge px-3 py-3 text-[14px] font-semibold text-voidInk-primary transition-colors duration-150 hover:border-white/30 sm:px-5"
    >
      Log in
    </button>
  )

  const card = (
    <div className="rounded-[18px] border border-line-hairline bg-[#151920] p-[18px] sm:rounded-[22px] sm:p-[26px]">
      <span className="font-mono text-[11px] tracking-[0.14em] text-teal">OPTIONAL</span>
      <div className="mt-2 font-display text-[22px] font-bold text-white sm:mt-2.5 sm:text-[28px]">
        Keep your drafts on every device
      </div>
      <p className="mb-3.5 mt-1.5 text-[14px] leading-[1.5] text-voidInk-body sm:mb-[18px] sm:mt-2 sm:text-[15px]">
        An account saves your mocks and unlocks league connect from Sleeper, ESPN, Yahoo or CBS.
        Mocks still run fine without one.
      </p>
      <div className="flex gap-2 sm:gap-2.5">
        {ready ? (
          <>
            <SignUpButton mode="modal">{signup}</SignUpButton>
            <SignInButton mode="modal">{login}</SignInButton>
          </>
        ) : (
          <>
            {signup}
            {login}
          </>
        )}
      </div>
    </div>
  )

  /* Signed in there is nothing left to offer: the mocks already sync. The
     whole card goes rather than the buttons alone, which is the rule
     HomePhone's own account card already follows — a card whose entire
     purpose is two controls has nothing to say without them. Without a
     Clerk key there is no SignedOut to render inside, so the card stands
     on its own and simply opens nothing, the same fallback every other
     account surface here makes. */
  if (!ready) return card
  return <SignedOut>{card}</SignedOut>
}

export default function HomeAlive() {
  /* Read here rather than inside the footer line's own branch: <SignedOut>
     throws without a ClerkProvider ancestor, and main.jsx renders no
     provider at all in a keyless build. A keyless clone therefore shows the
     line unconditionally, which is correct for it — nobody can be signed in
     there. Same shape as AccountCard above. */
  const ready = useAccountUiReady()

  return (
    <div className="relative overflow-hidden px-5 pb-6 pt-[22px] sm:px-10 sm:pb-14 sm:pt-10">
      {/* The watermark is the mark itself at 12%, not a background image:
          one file, already in web/public, already the one copy of the
          geometry every icon in the project is generated from. */}
      <img
        src="/juke-shark-mark.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-[70px] -top-[30px] w-[260px] object-contain opacity-[0.12] sm:-right-[120px] sm:-top-20 sm:w-[620px]"
      />

      <div className="relative mx-auto max-w-[1280px]">
        <div className="lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-12">
          <div>
            <div className="flex items-center justify-between gap-3">
              {/* whitespace-nowrap because a flex item shrinks below its
                  own content by default, and this one has room: measured at
                  375px it wants 194px of a 335px row with the pill taking
                  ~118 beside it. Without this it wrapped to two lines with
                  60px of the row left empty, which reads as a headline that
                  did not fit rather than as one that was allowed to break. */}
              {/* data-hero-eyebrow marks the first thing under the header,
                  which is what phone.spec.mjs measures the gap to. An
                  attribute rather than a text or element match, because
                  that check has now been broken twice by the copy's casing
                  and once by the element changing from a span to a p —
                  none of which is what it is testing. */}
              <span
                data-hero-eyebrow
                className="whitespace-nowrap font-display text-[13px] font-bold italic tracking-[0.12em] text-mint sm:text-[14px]"
              >
                <span aria-hidden="true">✨</span> AGILITY THROUGH ANALYTICS
              </span>
              {/* ShellHeader carries this above `sm`; here below it. See
                  that file's own note on the two homes. */}
              <KickoffPill className="sm:hidden" />
            </div>

            <h1 className="mt-3.5 font-display text-[54px] font-extrabold uppercase italic leading-[0.9] text-white sm:mt-4 sm:text-[72px] lg:text-[88px]">
              Know the move
              <br />
              <span className="text-mint">before your league.</span>
            </h1>

            <p className="mt-3.5 max-w-[44ch] text-[15px] leading-[1.45] text-voidInk-body sm:mt-[22px] sm:text-[18px] sm:leading-[1.5]">
              Plug in your league from any major platform. Juke tracks who&apos;s rising, who&apos;s
              fading, and which room to handle it in.
            </p>

            <div className="mt-5 grid max-w-[560px] grid-cols-2 gap-2.5 sm:mt-7 sm:gap-3">
              {/* data-hero-cta: sonar.spec.mjs hit-tests this to tell an
                  overlay that has really gone from one that is merely
                  transparent. It goes on the primary action, which on this
                  page is the gradient card rather than a button — the
                  marker follows the job, not the element. Losing it is
                  what the mobile pass already recorded once: splitting a
                  page orphans every attribute only one half of it
                  carries, and the failure reads as a missing element
                  rather than a missing marker. */}
              <Card
                gradient
                dataHeroCta
                glyph="🏈"
                eyebrow="PRACTICE"
                eyebrowColor="#14343d"
                title="Mock Draft"
                sub="Free · no account"
                href="#/rooms/draft"
              />
              {/* Connect goes to the rooms rather than straight at a
                  sign-up modal. There is no connect flow yet, and the
                  handoff's own global rule is that every connect route
                  goes through account creation first — so the honest
                  destination today is the place that shows what connecting
                  buys, which is the locked previews. */}
              <Card
                glyph="🚪"
                eyebrow="BRING YOUR LEAGUE"
                eyebrowColor="#00E5FF"
                title="Connect"
                sub="Sleeper · ESPN · Yahoo · CBS"
                href="#/rooms"
              />
            </div>

            <a
              href="#/rooms/draft"
              className="mt-2.5 flex max-w-[560px] items-center justify-between gap-3 rounded-[14px] border border-dashed border-flow-pillEdge px-4 py-3 text-[14px] text-voidInk-primary transition-colors duration-150 hover:border-teal/50 sm:px-[18px] sm:py-3.5"
            >
              <span className="flex items-center gap-2.5">
                <span className="text-teal" aria-hidden="true">
                  ✨
                </span>
                Or draft with friends — same board, real managers
              </span>
              <span className="text-ink-muted" aria-hidden="true">
                ›
              </span>
            </a>
          </div>

          <div className="mt-[18px] lg:mt-9">
            <AccountCard />
          </div>
        </div>

        <div className="mt-[26px] sm:mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-mono text-[11px] tracking-[0.14em] text-voidInk-primary">
              <span aria-hidden="true">🚪</span> THE ROOMS
            </span>
          </div>
          <RoomsGridAlive />
        </div>

        {/* Signed out only, and the reason is that it stops being true:
            "no account needed" is a promise to somebody deciding whether to
            make one, and it reads as a shrug to somebody who already has. */}
        {(() => {
          const line = (
            <p className="mt-[22px] text-center font-mono text-[10px] tracking-[0.14em] text-voidInk-muted">
              FREE · NO ACCOUNT NEEDED · RUNS IN YOUR BROWSER
            </p>
          )
          return ready ? <SignedOut>{line}</SignedOut> : line
        })()}
      </div>
    </div>
  )
}
