import KickoffPill from './KickoffPill.jsx'

/* The hero every room page opens with — design_handoff_v3_alive's
   "Room hero (shared by c/d/e/h/i)".

   Back chevron, a mono eyebrow in the room's own accent, an italic
   Barlow Condensed H1, and one line of sub-copy. The ground is the room's
   accent at 13% alpha fading out by 70%, over `flow.hero`.

   ---- Why the accent arrives as a prop and not a class ----

   Six rooms, one component, and Tailwind's JIT finds classes by grepping
   source text — so `text-[${accent}]` emits nothing and the eyebrow renders
   in whatever it inherits. That is the same trap draftRoomPositions.js
   already documents for its two class maps ("written out as full literal
   class strings ... rather than built from a name -> hue map with template
   interpolation"). Here the hue is a per-room datum read off ROOMS through
   the bridge rather than one of six known values, so the answer is an
   inline style, not six literal class strings.

   ---- The kickoff pill ----

   Rendered here below `sm` and by ShellHeader above it. The design puts it
   on the eyebrow's own row on a phone (2ag/2au) and in the header on
   desktop (3ag/3au); one component with two homes is the honest reading of
   that, rather than two pills that could disagree. */

export default function RoomHero({
  accent = '#00E5FF',
  glyph,
  eyebrow,
  title,
  children,
  backHref = '#/rooms',
  backLabel = 'Rooms',
}) {
  return (
    <div
      className="border-b border-white/[0.05] pb-[18px] pt-[18px] sm:pb-10 sm:pt-8"
      style={{ background: `linear-gradient(180deg, ${accent}22, transparent 70%), #1E2733` }}
    >
      {/* Padding inside the column, so the room title starts on the same
          left margin as the header above it and as the room's own content
          below. See HomeAlive.jsx for the measurement; this is the other
          half of it. The gradient stays on the wrapper and stays full
          bleed. */}
      <div className="mx-auto max-w-[1280px] px-5 sm:px-10">
        <div className="flex items-start justify-between gap-3">
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[20px] leading-none text-ink-muted transition-colors duration-150 hover:text-voidInk-primary sm:text-[17px]"
          >
            ‹<span className="hidden text-[17px] font-normal sm:inline">{backLabel}</span>
          </a>
          <KickoffPill className="sm:hidden" />
        </div>

        <div
          className="mb-1.5 mt-2 font-mono text-[11px] tracking-[0.1em]"
          style={{ color: accent }}
        >
          {glyph ? <span className="mr-1.5">{glyph}</span> : null}
          {eyebrow}
        </div>

        <h1 className="m-0 font-display text-[44px] font-extrabold uppercase italic leading-[0.92] text-white sm:text-[64px]">
          {title}
        </h1>

        {children ? (
          <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.45] text-voidInk-body sm:mt-3 sm:text-[16px]">
            {children}
          </p>
        ) : null}
      </div>
    </div>
  )
}
