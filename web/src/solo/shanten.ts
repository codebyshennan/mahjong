import type { Tile } from '../game/tileset'

// 34-bucket histogram: 0-8 bamboo 1-9, 9-17 dots 1-9, 18-26 character 1-9,
// 27-30 winds (east,south,west,north), 31-33 dragons (red,green,blue).
// Flowers/animals never enter the hand-counting path; nameToIdx returns -1.
function nameToIdx(name: string): number {
  if (/^[bdc]\d$/.test(name)) {
    const suit = name[0]
    const n = parseInt(name[1], 10) - 1
    if (suit === 'b') return n
    if (suit === 'd') return 9 + n
    if (suit === 'c') return 18 + n
  }
  switch (name) {
    case 'east': return 27
    case 'south': return 28
    case 'west': return 29
    case 'north': return 30
    case 'reddragon': return 31
    case 'greendragon': return 32
    case 'bluedragon': return 33
  }
  return -1
}

export function tally(tiles: readonly Tile[]): number[] {
  const t = new Array<number>(34).fill(0)
  for (const tile of tiles) {
    const idx = nameToIdx(tile.name)
    if (idx >= 0) t[idx]++
  }
  return t
}

interface Decomp {
  melds: number
  partials: number
}

/**
 * Greedy/exhaustive decomposition of a numbered suit slice [start, end). Tries
 * pong, chow, pair, ryanmen, kanchan, and floater at each tile, returning the
 * decomposition with max (melds × 2 + partials).
 */
function decomposeSuit(counts: number[], start: number, end: number): Decomp {
  let i = start
  while (i < end && counts[i] === 0) i++
  if (i >= end) return { melds: 0, partials: 0 }

  let best: Decomp = { melds: 0, partials: 0 }
  const score = (d: Decomp) => d.melds * 2 + d.partials
  const better = (a: Decomp, b: Decomp) => (score(a) > score(b) ? a : b)

  // Pong
  if (counts[i] >= 3) {
    counts[i] -= 3
    const r = decomposeSuit(counts, i, end)
    counts[i] += 3
    best = better(best, { melds: r.melds + 1, partials: r.partials })
  }
  // Chow
  if (i + 2 < end && counts[i + 1] >= 1 && counts[i + 2] >= 1) {
    counts[i]--; counts[i + 1]--; counts[i + 2]--
    const r = decomposeSuit(counts, i, end)
    counts[i]++; counts[i + 1]++; counts[i + 2]++
    best = better(best, { melds: r.melds + 1, partials: r.partials })
  }
  // Pair (partial pong)
  if (counts[i] >= 2) {
    counts[i] -= 2
    const r = decomposeSuit(counts, i, end)
    counts[i] += 2
    best = better(best, { melds: r.melds, partials: r.partials + 1 })
  }
  // Ryanmen / penchan partial [i, i+1]
  if (i + 1 < end && counts[i + 1] >= 1) {
    counts[i]--; counts[i + 1]--
    const r = decomposeSuit(counts, i, end)
    counts[i]++; counts[i + 1]++
    best = better(best, { melds: r.melds, partials: r.partials + 1 })
  }
  // Kanchan partial [i, i+2]
  if (i + 2 < end && counts[i + 2] >= 1) {
    counts[i]--; counts[i + 2]--
    const r = decomposeSuit(counts, i, end)
    counts[i]++; counts[i + 2]++
    best = better(best, { melds: r.melds, partials: r.partials + 1 })
  }
  // Floater (drop this tile)
  counts[i]--
  const r = decomposeSuit(counts, i, end)
  counts[i]++
  best = better(best, r)

  return best
}

/** Honors can only pong or pair; no chow. Independent per honor index. */
function decomposeHonors(counts: number[]): Decomp {
  let melds = 0
  let partials = 0
  for (let i = 27; i < 34; i++) {
    if (counts[i] >= 3) melds++
    else if (counts[i] === 2) partials++
  }
  return { melds, partials }
}

function decomposeAll(counts: number[]): Decomp {
  let melds = 0
  let partials = 0
  for (let suit = 0; suit < 3; suit++) {
    const start = suit * 9
    const r = decomposeSuit(counts, start, start + 9)
    melds += r.melds
    partials += r.partials
  }
  const honors = decomposeHonors(counts)
  melds += honors.melds
  partials += honors.partials
  return { melds, partials }
}

/**
 * Standard-form shanten. `lockedMelds` = number of already-revealed pong/chow/kong
 * in playerChecked (flowers/animals don't count). Returns -1 for winning hands,
 * 0 for tenpai, ≥1 for further-out hands.
 */
export function shanten(handTiles: readonly Tile[], lockedMelds = 0): number {
  const counts = tally(handTiles)
  let best = Infinity

  const evalShanten = (melds: number, partials: number, hasPair: boolean): number => {
    const totalMelds = lockedMelds + melds
    // Cap partials so total groups (melds + partials + pair) ≤ 5.
    const groupBudget = 4 - totalMelds
    const cappedPartials = Math.min(partials, Math.max(0, groupBudget))
    return (4 - totalMelds) * 2 - cappedPartials - (hasPair ? 1 : 0)
  }

  // Try each tile name as the designated pair.
  for (let p = 0; p < 34; p++) {
    if (counts[p] < 2) continue
    counts[p] -= 2
    const d = decomposeAll(counts)
    counts[p] += 2
    const sh = evalShanten(d.melds, d.partials, true)
    if (sh < best) best = sh
  }
  // Also try no designated pair (rare for winning hands but matters for early shanten).
  {
    const d = decomposeAll(counts)
    const sh = evalShanten(d.melds, d.partials, false)
    if (sh < best) best = sh
  }

  return Math.max(best, -1)
}

/**
 * For each tile in a 14-tile hand, the shanten that results from discarding
 * that tile. Returns indices+shanten sorted ascending by shanten (best first).
 */
export function shantenAfterDiscard(
  handTiles: readonly Tile[],
  lockedMelds = 0,
): { tileIdx: number; shanten: number }[] {
  const out: { tileIdx: number; shanten: number }[] = []
  for (let i = 0; i < handTiles.length; i++) {
    const remaining = [...handTiles.slice(0, i), ...handTiles.slice(i + 1)]
    out.push({ tileIdx: i, shanten: shanten(remaining, lockedMelds) })
  }
  out.sort((a, b) => a.shanten - b.shanten)
  return out
}
