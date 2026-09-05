import { POS_CHALK, CELL_INK } from '../draftRoomPositions.js'

/* The three shapes every locked preview is built from.

   They are here rather than in shell/ because they are sample content, not
   chrome: nothing outside a blurred preview draws them, and when a room
   gets its real body these go with the sample rather than staying behind as
   half a design system. Anything that survives that day belongs in shell/.

   Sample content is still `aria-hidden` and `inert` by the time a reader
   meets it — LockedPreview does that once on the wrapper, so none of these
   repeats it. */

export function SampleCard({ className = '', style, children }) {
  return (
    <div
      className={'rounded-[18px] border border-line-hairline bg-[#151920] p-4 ' + className}
      style={style}
    >
      {children}
    </div>
  )
}

/* The gradient-bordered "here is what we would do about it" card — the
   Suggested Counter, Next 3 Weeks and League Chatter all share it, each in
   its own accent. Two values per room and both come from the handoff: the
   dark end of the wash, and the border at 35% of the accent. */
export function AccentCard({ accent, wash, eyebrow, children }) {
  return (
    <div
      className="mt-3 rounded-[18px] p-4"
      style={{
        background: `linear-gradient(160deg, ${wash}, #111419 70%)`,
        border: `1px solid ${accent}59`,
      }}
    >
      <span className="font-mono text-[10px] tracking-[0.14em]" style={{ color: accent }}>
        {eyebrow}
      </span>
      {children}
    </div>
  )
}

/* The position square. `size` because the handoff draws it at 44px in a
   waiver row, 36px in a start/sit row and 28px for a manager avatar — and
   the radius moves with it, 12/8, which is the radius scale's own "control
   vs card" split rather than a value per call site. */
export function PosTile({ pos, size = 36 }) {
  return (
    <span
      className="grid shrink-0 place-items-center font-display font-extrabold"
      style={{
        width: size,
        height: size,
        borderRadius: size >= 44 ? 12 : 8,
        background: POS_CHALK[pos] || POS_CHALK.DST,
        color: CELL_INK,
        fontSize: size >= 44 ? 14 : 13,
      }}
    >
      {pos}
    </span>
  )
}

/* A proportion bar: track, fill, and an optional centre tick.

   The tick is what makes a fairness bar readable — 46% means nothing
   without a mark at 50 to read it against — and it is deliberately not
   drawn on the win-probability bar, where there is no midpoint that means
   anything and a tick would invent one. */
export function Bar({ pct, from, to, tick = false }) {
  return (
    <div className="relative mt-3 h-2 rounded-full bg-flow-tile">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})` }}
      />
      {tick ? (
        <span className="absolute left-1/2 top-[-4px] h-4 w-[2px] bg-white" />
      ) : null}
    </div>
  )
}
