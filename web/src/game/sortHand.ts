import type { Tile } from './tileset'

export type SortBy = 'name' | 'index'

export function sortHand(playerHand: readonly Tile[], by: SortBy = 'name'): Tile[] {
  const sorted = [...playerHand]
  if (by === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  } else {
    sorted.sort((a, b) => a.index - b.index)
  }
  return sorted
}
