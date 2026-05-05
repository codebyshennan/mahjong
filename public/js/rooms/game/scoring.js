import { ANIMAL_TILES, FLOWER_TILES, WIND_TILES, DRAGON_TILES } from './tileset.js'

// Singapore flower-to-seat-wind mapping (the two flower sets — seasons +
// gentlemen — both index onto the four winds in the same order).
const FLOWER_TO_WIND = {
  spring: 'east', plum: 'east',
  summer: 'south', orchid: 'south',
  autumn: 'west', chrysanthemum: 'west',
  winter: 'north', bamboo: 'north',
}

const isNumbered = (name) => /^[bdc]\d$/.test(name)
const isDragon = (name) => DRAGON_TILES.includes(name)
const isWind = (name) => WIND_TILES.includes(name)
const isSpecial = (name) => FLOWER_TILES.includes(name) || ANIMAL_TILES.includes(name)
const suitOf = (name) => isNumbered(name) ? name[0] : null

const isTripletKind = (kind) =>
  kind === 'pong' || kind === 'kong-exposed' || kind === 'kong-concealed' || kind === 'kong-promoted'

// Concealed sets in playerHand decompose as triplets-plus-one-pair when every
// tile-name has count 3 and exactly one has count 2. Strict tally check —
// rejects any chow (which would leave names at count 1).
const canDecomposeAsTriplesPlusPair = (tiles) => {
  const tally = {}
  for (const t of tiles) tally[t.name] = (tally[t.name] || 0) + 1
  let pairs = 0
  let triplets = 0
  for (const name in tally) {
    if (tally[name] === 3) triplets += 1
    else if (tally[name] === 2) pairs += 1
    else return false
  }
  return pairs === 1
}

/**
 * Compute Singapore tai for a winning player. Caller is responsible for
 * confirming the hand is winning (via checkWin) before calling.
 *
 * @param {object} player - has playerHand, playerChecked, playerMelds, wind
 * @param {object} gameState - has currentWind (prevailing wind)
 * @param {'self-draw'|'discard-win'} winType
 * @param {object} [options]
 * @param {number} [options.limit=5] - tai cap (Q1; Singapore standard 5)
 * @returns {{ tai: number, breakdown: Array<{name: string, tai: number}>, raw: number }}
 */
export const calculateTai = (player, gameState, winType, options = {}) => {
  const limit = options.limit ?? 5
  const breakdown = []

  const seatWind = player.wind
  const prevailingWind = (gameState && gameState.currentWind) || 'east'
  const melds = player.playerMelds || []

  // Animals: 1 tai each
  const animalCount = melds.filter(m => m.kind === 'animal').length
  if (animalCount > 0) breakdown.push({ name: 'animal', tai: animalCount })

  // Matching flowers: 1 tai per flower whose wind matches the player's seat
  const matchingFlowers = melds
    .filter(m => m.kind === 'flower')
    .filter(m => FLOWER_TO_WIND[m.tiles[0].name] === seatWind)
    .length
  if (matchingFlowers > 0) breakdown.push({ name: 'flower-set', tai: matchingFlowers })

  // Build a hand tally so concealed (in-hand) triplets of winds/dragons also count.
  // A winning hand can't carry 3 of a wind/dragon as anything other than a triplet
  // (winds/dragons can't chow; the eye is at most 2). So tally >= 3 implies a set.
  const meldNameIs = (m, name) => isTripletKind(m.kind) && m.tiles[0].name === name
  const handTally = {}
  for (const tile of (player.playerHand || [])) {
    handTally[tile.name] = (handTally[tile.name] || 0) + 1
  }
  const hasTripletOf = (name) =>
    melds.some(m => meldNameIs(m, name)) || (handTally[name] || 0) >= 3

  // Seat-wind triplet
  if (hasTripletOf(seatWind)) breakdown.push({ name: 'seat-wind', tai: 1 })

  // Prevailing-wind triplet (independent — if seat === prevailing, both fire,
  // for 2 tai total, per Singapore convention).
  if (hasTripletOf(prevailingWind)) breakdown.push({ name: 'prevailing-wind', tai: 1 })

  // Dragon triplets: 1 tai per dragon colour with a set
  const dragonTripletCount = DRAGON_TILES.filter(d => hasTripletOf(d)).length
  if (dragonTripletCount > 0) breakdown.push({ name: 'dragon', tai: dragonTripletCount })

  // Self-draw: 1 tai
  if (winType === 'self-draw') breakdown.push({ name: 'self-draw', tai: 1 })

  // Color analysis (half / full). Look at all numbered + honor tiles across
  // hand and checked. Exclude specials (flowers/animals) — they don't count
  // toward suit purity.
  const allTiles = [
    ...(player.playerHand || []),
    ...(player.playerChecked || []),
  ].filter(t => !isSpecial(t.name))

  const numberedTiles = allTiles.filter(t => isNumbered(t.name))
  const honorTiles = allTiles.filter(t => isWind(t.name) || isDragon(t.name))
  const suits = new Set(numberedTiles.map(t => suitOf(t.name)))

  if (suits.size === 1 && honorTiles.length === 0) {
    breakdown.push({ name: 'full-color', tai: 4 })
  } else if ((suits.size === 1 && honorTiles.length > 0) || (suits.size === 0 && honorTiles.length > 0)) {
    breakdown.push({ name: 'half-color', tai: 2 })
  }

  // All-pongs (碰碰胡): no chow in visible melds AND concealed sets in hand
  // decompose as triplets + 1 pair.
  const visibleSets = melds.filter(m => isTripletKind(m.kind) || m.kind === 'chow')
  const hasChow = visibleSets.some(m => m.kind === 'chow')
  if (!hasChow) {
    const playableHand = (player.playerHand || []).filter(t => !isSpecial(t.name))
    if (canDecomposeAsTriplesPlusPair(playableHand)) {
      breakdown.push({ name: 'all-pongs', tai: 2 })
    }
  }

  const raw = breakdown.reduce((sum, b) => sum + b.tai, 0)
  const tai = Math.min(raw, limit)
  return { tai, breakdown, raw }
}

/**
 * Convert tai to chips. Q4: chips = base * 2^(tai-1), capped implicitly by
 * the tai cap upstream.
 *
 * @param {number} tai
 * @param {number} [base=2]
 * @returns {number}
 */
export const taiToChips = (tai, base = 2) => {
  if (tai <= 0) return 0
  return base * Math.pow(2, tai - 1)
}
