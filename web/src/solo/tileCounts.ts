import {
  DRAGON_TILES,
  NUMBERED_TILES,
  WIND_TILES,
  isSpecialName,
} from '../game/tileset'
import type { SoloState } from './state'
import type { Seat } from './state'

export type TileGroup = 'bamboo' | 'dots' | 'character' | 'winds' | 'dragons'

export interface RemainingEntry {
  name: string
  label: string
  remaining: number
}

const SUIT_PREFIX: Record<'bamboo' | 'dots' | 'character', string> = {
  bamboo: 'b',
  dots: 'd',
  character: 'c',
}

const WIND_LABEL: Record<string, string> = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
}

const DRAGON_LABEL: Record<string, string> = {
  reddragon: '中',
  greendragon: '發',
  bluedragon: '白',
}

/**
 * Count copies of every relevant tile name visible to `viewer` — opponents'
 * concealed hands are NOT counted (we don't know them). My own hand IS counted.
 */
export function countSeen(state: SoloState, viewer: Seat): Map<string, number> {
  const seen = new Map<string, number>()
  const bump = (name: string) => seen.set(name, (seen.get(name) ?? 0) + 1)

  for (const p of state.players) {
    for (const t of p.playerDiscarded) bump(t.name)
    for (const t of p.playerChecked) bump(t.name)
  }
  for (const t of state.players[viewer].playerHand) bump(t.name)
  return seen
}

export function remainingByGroup(
  state: SoloState,
  viewer: Seat,
): Record<TileGroup, RemainingEntry[]> {
  const seen = countSeen(state, viewer)
  const out: Record<TileGroup, RemainingEntry[]> = {
    bamboo: [],
    dots: [],
    character: [],
    winds: [],
    dragons: [],
  }
  for (const suit of NUMBERED_TILES) {
    const group = suit as 'bamboo' | 'dots' | 'character'
    for (let n = 1; n <= 9; n++) {
      const name = `${SUIT_PREFIX[group]}${n}`
      out[group].push({
        name,
        label: String(n),
        remaining: 4 - (seen.get(name) ?? 0),
      })
    }
  }
  for (const w of WIND_TILES) {
    if (isSpecialName(w)) continue
    out.winds.push({
      name: w,
      label: WIND_LABEL[w] ?? w,
      remaining: 4 - (seen.get(w) ?? 0),
    })
  }
  for (const d of DRAGON_TILES) {
    const name = `${d}dragon`
    out.dragons.push({
      name,
      label: DRAGON_LABEL[name] ?? d,
      remaining: 4 - (seen.get(name) ?? 0),
    })
  }
  return out
}
