import {
  ANIMAL_SUITS,
  ANIMAL_TILES,
  DRAGON_SUITS,
  DRAGON_TILES,
  FLOWER_SUITS,
  FLOWER_TILES,
  NUMBERED_TILES,
  SUIT_LIST,
  WIND_SUITS,
  WIND_TILES,
} from './tileset'
import type { Tile } from './tileset'

/** Build a fresh, ordered deck of 148 tiles. */
export function buildTiles(): Tile[] {
  const tiles: Tile[] = []

  // 108 numbered (bamboo/dots/character × 1-9 × 4 copies)
  for (let suitIdx = 0; suitIdx < NUMBERED_TILES.length; suitIdx++) {
    const prefix = NUMBERED_TILES[suitIdx][0] // 'b' / 'd' / 'c'
    for (let copy = 0; copy < 4; copy++) {
      for (let count = 0; count < 9; count++) {
        tiles.push({
          name: `${prefix}${count + 1}`,
          url: `/assets/svgtiles/${prefix}${count + 1}.svg`,
          suit: SUIT_LIST[suitIdx][count],
          copy: copy + 1,
          count: count + 1,
          index: count + 1 + 9 * copy + 36 * suitIdx,
        })
      }
    }
  }

  // 12 dragons (red/green/blue × 4 copies). NOTE: original deck builder pushes
  // dragons before winds; we preserve that ordering for index parity.
  for (let dIdx = 0; dIdx < DRAGON_TILES.length; dIdx++) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({
        name: `${DRAGON_TILES[dIdx]}dragon`,
        url: `/assets/svgtiles/dragon_${DRAGON_TILES[dIdx]}.svg`,
        suit: DRAGON_SUITS[dIdx],
        copy: copy + 1,
        index: 124 + dIdx * 4 + copy,
      })
    }
  }

  // 16 winds (east/south/west/north × 4 copies)
  for (let wIdx = 0; wIdx < WIND_TILES.length; wIdx++) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({
        name: WIND_TILES[wIdx],
        url: `/assets/svgtiles/${WIND_TILES[wIdx]}.svg`,
        suit: WIND_SUITS[wIdx],
        copy: copy + 1,
        count: wIdx + 1,
        index: 108 + wIdx * 4 + copy,
      })
    }
  }

  // 8 flowers (plum/orchid/chrysanthemum/bamboo + spring/summer/autumn/winter)
  for (let fIdx = 0; fIdx < FLOWER_TILES.length; fIdx++) {
    tiles.push({
      name: FLOWER_TILES[fIdx],
      url: `/assets/svgtiles/${FLOWER_TILES[fIdx]}.svg`,
      suit: FLOWER_SUITS[fIdx],
      count: (fIdx % 4) + 1,
      index: 136 + (fIdx + 1),
    })
  }

  // 4 animals
  for (let aIdx = 0; aIdx < ANIMAL_TILES.length; aIdx++) {
    tiles.push({
      name: ANIMAL_TILES[aIdx],
      url: `/assets/svgtiles/${ANIMAL_TILES[aIdx]}.svg`,
      suit: ANIMAL_SUITS[aIdx],
      index: 144 + (aIdx + 1),
    })
  }

  return tiles
}

/** In-place-style swap shuffle (matches the original — not Fisher-Yates). */
function shuffleTiles(deck: readonly Tile[]): Tile[] {
  const shuffled = [...deck]
  for (let i = 0; i < shuffled.length; i++) {
    const j = Math.floor(Math.random() * shuffled.length)
    const tmp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = tmp
  }
  return shuffled
}

export function buildDeck(): Tile[] {
  return shuffleTiles(buildTiles())
}

/** Map of tile name → suit emoji, useful for quick rendering shortcuts. */
export function refDeck(): Record<string, string> {
  const ref: Record<string, string> = {}
  for (const tile of buildTiles()) ref[tile.name] = tile.suit
  return ref
}
