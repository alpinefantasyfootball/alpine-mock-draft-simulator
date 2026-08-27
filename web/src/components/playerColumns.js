/* The player list's scrollable stat columns — a union across positions,
   the way Sleeper's own board does it, rather than a different column set
   per player. A running back's passing cells are blank, not missing: a
   fixed grid is what lets every row line up under one header, and it is
   the only shape a shared horizontal scroll can have.

   The raw keys are the ones the projection block actually stores — the
   same `pa/py/pt/ra/ry/rt/tg/rc/cy/ct` logColumns() reads in app.js, not
   a second naming of the same stats.

   Deliberately absent: a per-game average. It needs projGames(), which is
   position-dependent because Sleeper stamps a team defense's projection
   `gp: 1` — the divisor bug perGame() exists to prevent (see CLAUDE.md).
   The season total is honest for every position without that caveat, and
   the player card carries per-game where the position is known.

   `sortable` marks the columns DraftRoom's sort reader can order by. The
   counting stats are all sortable through the same raw-key path; ADP,
   points and VORP keep their existing readers. */

// `positions`, where present, is which posFilter values keep this group —
// undefined means "every position", for the groups every player has an
// opinion on. A design review caught the gap this exists to close: with a
// WR filter active the Passing group was still three columns of em-dashes,
// which reads as a broken table rather than an irrelevant one. Filtered by
// PlayerQueueSidebar.jsx, never here — this file stays the one union list
// Sleeper-style boards already promise, per its own header comment; "ALL"
// still renders every group exactly as before.
export const STAT_GROUPS = [
  { label: '', keys: ['bye', 'adp'] },
  { label: 'Projected', keys: ['pts', 'vorp'] },
  { label: 'Passing', keys: ['py', 'pt', 'pi'], positions: ['QB'] },
  { label: 'Rushing', keys: ['ra', 'ry', 'rt'], positions: ['QB', 'RB'] },
  /* No TGT column. Sleeper shows one and their own projections do not
     fill it — measured here too: 0 of 220 players carry a projected
     target, against 157 with projected receptions. CLAUDE.md's rule about
     it is exactly this case — copy the layout, not the gap in it — so the
     column that would be a dash for everybody is simply not drawn. */
  { label: 'Receiving', keys: ['rc', 'cy', 'ct'], positions: ['RB', 'WR', 'TE'] },
  /* The model's own group, teal-labelled to mark it apart from the plain
     projection above — see JUKE/TIER/LASTS in statValue() below. Shown for
     every position on purpose: an unranked K/DST prints an em dash rather
     than the group disappearing, the same withholding rule
     overallScore()/survivalProbability() already apply themselves. */
  { label: 'Juke', keys: ['juke', 'tier', 'lasts'], teal: true },
]

/* The phone pool leads with the numbers a pick is actually made on — PTS,
   VORP, JUKE, LASTS — before a swipe reaches anything else, where desktop
   leads with BYE/ADP because it has the width to show everything at once.
   Same six groups as STAT_GROUPS, reordered and re-split rather than a
   second column list: Juke's own three (JUKE/LASTS/TIER, in that order —
   the two decision numbers before the reference one) come right after
   Projected, and BYE/ADP move into their own trailing blank group. Every
   key still resolves through STAT_COLUMNS/statValue() — this only changes
   which order the same columns are read in. */
export const MOBILE_GROUPS = [
  { label: 'Projected', keys: ['pts', 'vorp'] },
  { label: 'Juke', keys: ['juke', 'lasts', 'tier'], teal: true },
  { label: '', keys: ['adp', 'bye'] },
  { label: 'Passing', keys: ['py', 'pt', 'pi'], positions: ['QB'] },
  { label: 'Rushing', keys: ['ra', 'ry', 'rt'], positions: ['QB', 'RB'] },
  { label: 'Receiving', keys: ['rc', 'cy', 'ct'], positions: ['RB', 'WR', 'TE'] },
]

// Every mobile numeric column is this one flat width regardless of its own
// desktop width (40-50px, varying per column) — the handoff's own number,
// chosen so identity(208) + the first four columns(4x48=192) sums to
// exactly 400px, fitting a 402px screen with nothing to swipe for the four
// numbers a pick actually turns on.
export const MOBILE_COL_WIDTH = 48

/* `dir` is which way reads as "best first" on the very first click of a
   column that was not already active — ascending for ADP, where pick 1 is
   the best, descending for everything else, where more is better. Same
   convention a spreadsheet uses.

   TIER is ascending for the same reason as ADP: T1 is the best tier, so a
   smaller number sorts first. It's a rank within a position rather than a
   cross-position ordering — sorted with posFilter at ALL, a T1 kicker and
   a T1 receiver land next to each other with nothing in common but the
   label — but that's the same trade-off raw rushing yards already makes
   under a WR filter, not a reason to withhold the control from someone
   who has narrowed the list to one position first.

   LASTS is ascending too, on purpose: the lowest survival odds are the
   players actually worth acting on, so sorting to see them first matches
   how the column's own colour-coding already reads (lastsTone() calls
   anything under 25% a real risk). It's most informative near the top of
   a real draft, since survivalProbability() weighs against nextOverall —
   a player five rounds of picks away from being reachable again reads
   close to 100% either way, so a lot of the board ties there and just
   keeps whatever order it already had. That's a narrower usefulness, not
   a broken sort. */
export const STAT_COLUMNS = [
  { key: 'bye', label: 'BYE', width: 40 },
  { key: 'adp', label: 'ADP', width: 44, sortable: true, dir: 'asc' },
  { key: 'pts', label: 'PTS', width: 50, sortable: true, dir: 'desc', tone: 'strong' },
  /* Value over replacement — the raw, un-clamped points-above-replacement
     figure (engine.replacementGap()), not overallScore()'s 0-100 share.
     Those are two different numbers about the same idea, and JUKE below is
     the share; a column called VORP showing the share too would just be
     JUKE printed twice. */
  { key: 'vorp', label: 'VORP', width: 50, sortable: true, dir: 'desc', tone: 'teal' },
  { key: 'py', label: 'YDS', width: 50, stat: true, sortable: true, dir: 'desc' },
  { key: 'pt', label: 'TD', width: 40, stat: true, sortable: true, dir: 'desc' },
  { key: 'pi', label: 'INT', width: 40, stat: true, sortable: true, dir: 'desc' },
  { key: 'ra', label: 'ATT', width: 44, stat: true, sortable: true, dir: 'desc' },
  { key: 'ry', label: 'YDS', width: 50, stat: true, sortable: true, dir: 'desc' },
  { key: 'rt', label: 'TD', width: 40, stat: true, sortable: true, dir: 'desc' },
  { key: 'rc', label: 'REC', width: 44, stat: true, sortable: true, dir: 'desc' },
  { key: 'cy', label: 'YDS', width: 50, stat: true, sortable: true, dir: 'desc' },
  { key: 'ct', label: 'TD', width: 40, stat: true, sortable: true, dir: 'desc' },
  // overallScore() — the same "Juke score" used everywhere else on the
  // site, as a share of the best figure on the board. Sortable: this is
  // the one DraftRoom's reader already had a branch for (it used to be
  // what 'vorp' sorted by), so 'juke' just takes over that same reader.
  { key: 'juke', label: 'JUKE', width: 44, sortable: true, dir: 'desc', tone: 'teal' },
  { key: 'tier', label: 'TIER', width: 44, sortable: true, dir: 'asc' },
  { key: 'lasts', label: 'LASTS', width: 50, sortable: true, dir: 'asc' },
]

/* Derived rather than a second hand-written copy, so the header, the
   mobile chips and DraftRoom's sort always agree about which direction a
   first click means. */
export const SORT_DEFAULT_DIR = Object.fromEntries(
  STAT_COLUMNS.filter((c) => c.sortable).map((c) => [c.key, c.dir])
)

/* The handful worth a chip on a phone. Every column is sortable from the
   table header on either breakpoint; these are the ones a thumb should
   not have to scroll sideways to reach. Board is here because the board's
   own ADP order is the default and needs a way back to it. */
export const MOBILE_SORTS = [
  { key: 'board', label: 'Board' },
  { key: 'adp', label: 'ADP' },
  { key: 'pts', label: 'Pts' },
  { key: 'juke', label: 'Juke' },
]

// Raw counting stats live on the projection block; the derived ones come
// from readers the list already has. Returns null for "this player has no
// such stat", which renders as a dash rather than a zero — the same rule
// the rest of the app follows about absent versus nought.
//
// ctx: { pointsFor, vorpFor, valueFor, survivalFor, projOf } — season
// toggles (the Players tab's "2025 Season" mode) live entirely in which
// functions the caller passes as pointsFor/vorpFor, never here: PTS/VORP
// read whatever ctx hands them, so a caller with no season concept (the
// mobile sheet, the Board tab's dock) just passes the plain projected
// readers and gets the plain projected behaviour, unchanged.
export function statValue(col, player, ctx) {
  if (col.key === 'adp') {
    return typeof player.adp === 'number' && Number.isFinite(player.adp) ? player.adp.toFixed(1) : null
  }
  if (col.key === 'bye') return player.bye || null
  if (col.key === 'pts') {
    const v = ctx.pointsFor(player)
    return v == null ? null : Math.round(v)
  }
  if (col.key === 'vorp') {
    const v = ctx.vorpFor(player)
    return v == null ? null : Math.round(v)
  }
  if (col.key === 'juke') {
    const v = ctx.valueFor(player)
    return v == null ? null : Math.round(v)
  }
  if (col.key === 'tier') return player.tier != null ? 'T' + player.tier : null
  // A rounded percentage — the % suffix and the three-band colour
  // (rose/amber/ink-soft) are display concerns, applied where the cell is
  // actually painted (see lastsTone() below), not baked in here.
  if (col.key === 'lasts') {
    const v = ctx.survivalFor(player)
    return v == null ? null : Math.round(v * 100)
  }
  const proj = ctx.projOf(player)
  const raw = proj ? proj[col.key] : undefined
  // 0 is a real projected zero here (a back with no targets), but the
  // feed also zero-fills, so an absent key and a zero both read as
  // nothing worth a column cell.
  return raw ? Math.round(raw) : null
}

// LASTS is the one column whose colour depends on its own value rather
// than being fixed for the whole column (every other column's colour is
// `col.tone`, read as-is). Thresholds match the design handoff and the
// Decide tab's own survival cards: under 25% is a real risk (rose), 25-59%
// is a coin flip worth queuing for (amber), 60%+ reads as safe to wait on
// (ink-soft, the same quiet tone an unremarkable number gets everywhere
// else in this table).
export function lastsTone(pct) {
  if (pct == null) return null
  return pct < 25 ? 'rose' : pct < 60 ? 'amber' : 'soft'
}
