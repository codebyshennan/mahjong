import { ANIMAL_TILES, FLOWER_TILES } from '../rooms/game/tileset.js'

const isSpecial = (name) => FLOWER_TILES.includes(name) || ANIMAL_TILES.includes(name)

// Numbered tile: single letter prefix (b=bamboo, d=dots, c=character) + digit
const isNumbered = (name) => /^[bdc]\d$/.test(name)

const removeTileByName = (tiles, name) => {
  const idx = tiles.findIndex(t => t.name === name)
  if (idx === -1) return null
  const copy = [...tiles]
  copy.splice(idx, 1)
  return copy
}

// Try to form 'needed' melds from 'tiles'. Returns true if possible.
const canFormMelds = (tiles, needed) => {
  if (needed === 0) return tiles.length === 0
  if (tiles.length < 3) return false

  const sorted = [...tiles].sort((a, b) => a.name.localeCompare(b.name))
  const first = sorted[0]
  const rest = sorted.slice(1)

  // Try pong (3 of same name)
  const pong2 = removeTileByName(rest, first.name)
  if (pong2) {
    const pong3 = removeTileByName(pong2, first.name)
    if (pong3 && canFormMelds(pong3, needed - 1)) return true
  }

  // Try chow (3 consecutive numbered tiles)
  if (isNumbered(first.name)) {
    const suit = first.name[0]
    const no = parseInt(first.name[1])
    if (no <= 7) {
      const mid = removeTileByName(rest, `${suit}${no + 1}`)
      if (mid) {
        const tail = removeTileByName(mid, `${suit}${no + 2}`)
        if (tail && canFormMelds(tail, needed - 1)) return true
      }
    }
  }

  return false
}

/**
 * Check if a player's current state is a winning hand (4 melds + 1 pair).
 * @param {Array} hand - tiles in playerHand
 * @param {Array} checked - tiles in playerChecked (includes eaten melds, flowers, animals)
 * @returns {{ win: boolean, pair: string|null }}
 */
export const checkWin = (hand, checked = []) => {
  const playableHand = hand.filter(t => !isSpecial(t.name))
  const eatenMelds = Math.floor(checked.filter(t => !isSpecial(t.name)).length / 3)
  const meldsNeeded = 4 - eatenMelds
  const expectedHandSize = meldsNeeded * 3 + 2 // melds * 3 tiles + 1 pair of 2

  if (playableHand.length !== expectedHandSize) return { win: false, pair: null }

  const seenPairs = new Set()
  for (const tile of playableHand) {
    if (seenPairs.has(tile.name)) continue
    const tally = playableHand.filter(t => t.name === tile.name).length
    if (tally < 2) continue

    seenPairs.add(tile.name)
    let removed = 0
    const remaining = playableHand.filter(t => {
      if (t.name === tile.name && removed < 2) { removed++; return false }
      return true
    })

    if (canFormMelds(remaining, meldsNeeded)) {
      return { win: true, pair: tile.name }
    }
  }

  return { win: false, pair: null }
}
