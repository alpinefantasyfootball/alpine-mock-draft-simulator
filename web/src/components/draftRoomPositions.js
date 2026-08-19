// The same badge palette ShowYourWorking.jsx already established for
// web/src (violet/emerald/sky/amber) — extended with K/DST rather than
// reinvented, so the draft room and the scoring demo don't drift into two
// different position colour systems on the same site. This is deliberately
// NOT the legacy board's --qb/--rb/etc CSS custom properties: those were
// darkened until white text cleared 4.5:1 for a solid fill (see CLAUDE.md's
// "Team colour" and contrast sections), which is a different constraint
// than a translucent badge sitting on dark glass here.
export const POS_BADGE = {
  QB: 'bg-violet-500/15 text-violet-300',
  RB: 'bg-emerald-500/15 text-emerald-300',
  WR: 'bg-sky-500/15 text-sky-300',
  TE: 'bg-amber-500/15 text-amber-300',
  K: 'bg-teal-500/15 text-teal-300',
  DST: 'bg-slate-500/15 text-slate-300',
}

export const POS_LIST = ['QB', 'RB', 'WR', 'TE']

// Same position -> hue mapping as POS_BADGE, applied to a whole drafted
// grid cell instead of just the badge inside it — a semi-transparent tint
// + matching border, never a solid fill, so player name and team stay
// readable at 74px-cell scale without a second contrast pass.
export const POS_CELL = {
  QB: 'border-violet-500/30 bg-violet-500/10',
  RB: 'border-emerald-500/30 bg-emerald-500/10',
  WR: 'border-sky-500/30 bg-sky-500/10',
  TE: 'border-amber-500/30 bg-amber-500/10',
  K: 'border-teal-500/30 bg-teal-500/10',
  DST: 'border-slate-500/30 bg-slate-500/10',
}
