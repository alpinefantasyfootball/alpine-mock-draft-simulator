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

export const STAT_GROUPS = [
  { label: '', keys: ['adp', 'bye'] },
  { label: 'Projected', keys: ['pts', 'vorp'] },
  { label: 'Passing', keys: ['py', 'pt', 'pi'] },
  { label: 'Rushing', keys: ['ra', 'ry', 'rt'] },
  /* No TGT column. Sleeper shows one and their own projections do not
     fill it — measured here too: 0 of 220 players carry a projected
     target, against 157 with projected receptions. CLAUDE.md's rule about
     it is exactly this case — copy the layout, not the gap in it — so the
     column that would be a dash for everybody is simply not drawn. */
  { label: 'Receiving', keys: ['rc', 'cy', 'ct'] },
]

/* `dir` is which way reads as "best first" on the very first click of a
   column that was not already active — ascending for ADP, where pick 1 is
   the best, descending for everything else, where more is better. Same
   convention a spreadsheet uses. */
export const STAT_COLUMNS = [
  { key: 'adp', label: 'ADP', width: 46, sortable: true, dir: 'asc' },
  { key: 'bye', label: 'BYE', width: 40 },
  { key: 'pts', label: 'PTS', width: 50, sortable: true, dir: 'desc', tone: 'strong' },
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
  { key: 'vorp', label: 'VORP' },
]

// Raw counting stats live on the projection block; the four derived ones
// come from readers the list already has. Returns null for "this player
// has no such stat", which renders as a dash rather than a zero — the
// same rule the rest of the app follows about absent versus nought.
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
    const v = ctx.valueFor(player)
    return v == null ? null : Math.round(v)
  }
  const proj = ctx.projOf(player)
  const raw = proj ? proj[col.key] : undefined
  // 0 is a real projected zero here (a back with no targets), but the
  // feed also zero-fills, so an absent key and a zero both read as
  // nothing worth a column cell.
  return raw ? Math.round(raw) : null
}
