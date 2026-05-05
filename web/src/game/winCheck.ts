import { isNumberedName, isSpecialName } from './tileset'
import type { Tile } from './tileset'

function removeTileByName(tiles: Tile[], name: string): Tile[] | null {
  const idx = tiles.findIndex((t) => t.name === name)
  if (idx === -1) return null
  const copy = [...tiles]
  copy.splice(idx, 1)
  return copy
}

/** Recursive search for `needed` melds (chow or pong) in the remaining tiles. */
function canFormMelds(tiles: Tile[], needed: number): boolean {
  if (needed === 0) return tiles.length === 0
  if (tiles.length < 3) return false

  const sorted = [...tiles].sort((a, b) => a.name.localeCompare(b.name))
  const first = sorted[0]
  const rest = sorted.slice(1)

  // Pong (3 of same name)
  const pong2 = removeTileByName(rest, first.name)
  if (pong2) {
    const pong3 = removeTileByName(pong2, first.name)
    if (pong3 && canFormMelds(pong3, needed - 1)) return true
  }

  // Chow (3 consecutive numbered tiles, same suit)
  if (isNumberedName(first.name)) {
    const suit = first.name[0]
    const no = parseInt(first.name[1], 10)
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

export interface WinResult {
  win: boolean
  pair: string | null
}

/**
 * Check whether `hand + checked` forms a winning hand (4 melds + 1 pair).
 * Caller passes the live hand; the function ignores specials when counting.
 */
export function checkWin(hand: Tile[], checked: Tile[] = []): WinResult {
  const playableHand = hand.filter((t) => !isSpecialName(t.name))
  const eatenMelds = Math.floor(
    checked.filter((t) => !isSpecialName(t.name)).length / 3,
  )
  const meldsNeeded = 4 - eatenMelds
  const expectedHandSize = meldsNeeded * 3 + 2 // melds * 3 + 1 pair of 2

  if (playableHand.length !== expectedHandSize) return { win: false, pair: null }

  const seenPairs = new Set<string>()
  for (const tile of playableHand) {
    if (seenPairs.has(tile.name)) continue
    const tally = playableHand.filter((t) => t.name === tile.name).length
    if (tally < 2) continue

    seenPairs.add(tile.name)
    let removed = 0
    const remaining = playableHand.filter((t) => {
      if (t.name === tile.name && removed < 2) {
        removed += 1
        return false
      }
      return true
    })

    if (canFormMelds(remaining, meldsNeeded)) {
      return { win: true, pair: tile.name }
    }
  }

  return { win: false, pair: null }
}
