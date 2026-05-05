import { ANIMAL_TILES, FLOWER_TILES, WIND_TILES, NUMBERED_TILES } from '../rooms/game/tileset.js'

const isSpecial = (tile) => FLOWER_TILES.includes(tile.name) || ANIMAL_TILES.includes(tile.name)
const isNumbered = (tile) => /^[bdc]\d$/.test(tile.name)

// Score how "useful" a tile is to keep. Higher = keep, lower = discard first.
// v1 heuristic: pairs/triplets are sticky; numbered tiles in the middle of a
// run are sticky; isolated honor tiles and edge numbers are easy to throw.
const scoreTile = (tile, hand) => {
  if (isSpecial(tile)) return 100  // already handled, won't actually be in hand
  const tally = hand.filter((t) => t.name === tile.name).length
  let score = tally * 10  // pairs are valuable, triplets very valuable

  if (isNumbered(tile)) {
    const suit = tile.name[0]
    const num = +tile.name[1]
    if (hand.some((t) => t.name === `${suit}${num - 1}`)) score += 4
    if (hand.some((t) => t.name === `${suit}${num + 1}`)) score += 4
    if (hand.some((t) => t.name === `${suit}${num - 2}`)) score += 2
    if (hand.some((t) => t.name === `${suit}${num + 2}`)) score += 2
    if (num === 1 || num === 9) score -= 1  // edges harder to use
  } else if (WIND_TILES.includes(tile.name) || tile.name.endsWith('dragon')) {
    if (tally === 1) score -= 3  // lone honor — easy throw
  }

  return score
}

export const chooseDiscard = (hand) => {
  const candidates = hand.filter((t) => !isSpecial(t))
  if (candidates.length === 0) return hand[0]
  let worst = candidates[0]
  let worstScore = scoreTile(worst, hand)
  for (const tile of candidates) {
    const s = scoreTile(tile, hand)
    if (s < worstScore) { worst = tile; worstScore = s }
  }
  return worst
}

// AI claim policy on an opponent's discard:
//   1. If win possible → win
//   2. If pong possible → 50% claim (keeps games varied)
//   3. Skip chow (less critical, simpler)
export const decideClaim = (state, seat) => {
  const tile = state.lastDiscard
  if (!tile) return null
  if (state.canWinOnDiscard(seat, tile)) return { kind: 'win' }
  if (state.canPong(seat, tile) && Math.random() < 0.5) {
    return { kind: 'pong', combo: [tile.name, tile.name] }
  }
  return null
}
