import { isNumberedName } from '../game/tileset'
import type { Tile } from '../game/tileset'

/** Indices in `hand` of two tiles matching `tile.name`, or null. */
export function findPongTiles(hand: readonly Tile[], tile: Tile): [number, number] | null {
  const matches: number[] = []
  for (let i = 0; i < hand.length; i++) {
    if (hand[i].name === tile.name) matches.push(i)
    if (matches.length === 2) return [matches[0], matches[1]]
  }
  return null
}

/**
 * Possible chow combinations for `tile` (the discarded one). Each entry is a
 * pair of indices in `hand` whose tiles + the discard form a valid 3-in-a-row
 * in the same suit. Empty array if no chow possible (e.g. discard is honor).
 */
export function findChowOptions(
  hand: readonly Tile[],
  tile: Tile,
): { handIndices: [number, number]; tileNames: [string, string, string] }[] {
  if (!isNumberedName(tile.name)) return []
  const suit = tile.name[0]
  const n = parseInt(tile.name[1], 10)

  const findFirst = (name: string, skip = -1): number => {
    for (let i = 0; i < hand.length; i++) {
      if (i === skip) continue
      if (hand[i].name === name) return i
    }
    return -1
  }

  const out: { handIndices: [number, number]; tileNames: [string, string, string] }[] = []
  // [n-2, n-1, n]
  if (n >= 3) {
    const a = findFirst(`${suit}${n - 2}`)
    const b = a >= 0 ? findFirst(`${suit}${n - 1}`, a) : -1
    if (a >= 0 && b >= 0) {
      out.push({
        handIndices: [a, b],
        tileNames: [`${suit}${n - 2}`, `${suit}${n - 1}`, tile.name],
      })
    }
  }
  // [n-1, n, n+1]
  if (n >= 2 && n <= 8) {
    const a = findFirst(`${suit}${n - 1}`)
    const b = a >= 0 ? findFirst(`${suit}${n + 1}`, a) : -1
    if (a >= 0 && b >= 0) {
      out.push({
        handIndices: [a, b],
        tileNames: [`${suit}${n - 1}`, tile.name, `${suit}${n + 1}`],
      })
    }
  }
  // [n, n+1, n+2]
  if (n <= 7) {
    const a = findFirst(`${suit}${n + 1}`)
    const b = a >= 0 ? findFirst(`${suit}${n + 2}`, a) : -1
    if (a >= 0 && b >= 0) {
      out.push({
        handIndices: [a, b],
        tileNames: [tile.name, `${suit}${n + 1}`, `${suit}${n + 2}`],
      })
    }
  }
  return out
}
