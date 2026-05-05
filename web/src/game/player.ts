import { ANIMAL_TILES, FLOWER_TILES } from './tileset'
import type { Meld, Tile, Wind } from './tileset'

export interface Player {
  id: string
  name: string
  wind: Wind
  playerNumber: number
  chips: number
  currentScore: number
  playerHand: Tile[]
  playerChecked: Tile[]
  playerDiscarded: Tile[]
  playerMelds: Meld[]
}

export interface PlayerInit {
  id: string
  name: string
  wind: Wind
  playerNumber: number
  chips?: number
}

export function makePlayer(init: PlayerInit): Player {
  return {
    id: init.id,
    name: init.name,
    wind: init.wind,
    playerNumber: init.playerNumber,
    chips: init.chips ?? 1000,
    currentScore: 0,
    playerHand: [],
    playerChecked: [],
    playerDiscarded: [],
    playerMelds: [],
  }
}

const isFlowerName = (name: string) => (FLOWER_TILES as readonly string[]).includes(name)
const isAnimalName = (name: string) => (ANIMAL_TILES as readonly string[]).includes(name)

/**
 * Draw `count` tiles into `player.playerHand`, mutating `deck` in place.
 * Flower/animal tiles auto-check into `playerChecked` + `playerMelds` and
 * trigger a replacement draw from the bottom of the deck (`pop()`), matching
 * the original Player.drawTile behaviour. `onDraw` fires once per deck pull
 * (hand-tile or replacement) so callers can update tile counters.
 */
export function drawTile(
  player: Player,
  count: number,
  deck: Tile[],
  onDraw: () => void = () => {},
): void {
  for (let i = 0; i < count; i++) {
    let tile = deck.shift()
    if (!tile) return

    while (isFlowerName(tile.name) || isAnimalName(tile.name)) {
      const kind = isAnimalName(tile.name) ? 'animal' : 'flower'
      player.playerChecked.push(tile)
      player.playerMelds.push({ kind, tiles: [tile] })
      onDraw()
      tile = deck.pop()
      if (!tile) return
    }

    player.playerHand.push(tile)
    onDraw()
  }
}
