import { ANIMAL_TILES, FLOWER_TILES, isWindName } from '../game/tileset'
import { checkWin } from '../game/winCheck'
import { findPongTiles } from './claims'
import type { SeatView } from './seatView'
import { shanten, shantenAfterDiscard } from './shanten'

export type Difficulty = 'easy' | 'normal' | 'hard'

export type BotDecision =
  | { kind: 'discard'; tileIdx: number }
  | { kind: 'self-draw-win' }
  | { kind: 'claim-win' }
  | { kind: 'claim-pong'; handIndices: [number, number] }
  | { kind: 'pass-claim' }

const isSpecial = (name: string) =>
  (FLOWER_TILES as readonly string[]).includes(name) ||
  (ANIMAL_TILES as readonly string[]).includes(name)

function visibleCount(view: SeatView, tileName: string): number {
  let n = 0
  for (const p of view.public) {
    for (const t of p.discards) if (t.name === tileName) n++
    for (const m of p.melds) for (const t of m.tiles) if (t.name === tileName) n++
  }
  for (const t of view.myChecked) if (t.name === tileName) n++
  return n
}

function lockedMelds(view: SeatView): number {
  return view.myMelds.filter(
    (m) => m.kind === 'pong' || m.kind === 'chow' || m.kind.startsWith('kong'),
  ).length
}

export function decide(view: SeatView, difficulty: Difficulty = 'normal'): BotDecision {
  if (view.turnPhase === 'discard') {
    if (checkWin(view.myHand, view.myChecked).win) return { kind: 'self-draw-win' }
    return { kind: 'discard', tileIdx: pickDiscard(view, difficulty) }
  }

  if (view.turnPhase === 'claim-window') {
    if (!view.lastDiscard) return { kind: 'pass-claim' }
    if (view.lastDiscard.seat === view.seat) return { kind: 'pass-claim' }

    if (checkWin([...view.myHand, view.lastDiscard.tile], view.myChecked).win) {
      return { kind: 'claim-win' }
    }

    if (difficulty === 'hard') {
      const pong = considerPong(view)
      if (pong) return { kind: 'claim-pong', handIndices: pong }
    }
    return { kind: 'pass-claim' }
  }

  throw new Error(`bot decide() called in phase ${view.turnPhase}`)
}

function pickDiscard(view: SeatView, difficulty: Difficulty): number {
  const hand = view.myHand
  if (hand.length === 0) throw new Error('empty hand on discard')

  // Specials shouldn't be in hand, but if they are, dump first regardless.
  for (let i = 0; i < hand.length; i++) {
    if (isSpecial(hand[i].name)) return i
  }

  if (difficulty === 'easy') {
    return Math.floor(Math.random() * hand.length)
  }

  const ranked = shantenAfterDiscard(hand, lockedMelds(view))
  const minSh = ranked[0].shanten
  const tied = ranked.filter((r) => r.shanten === minSh)
  if (tied.length === 1) return tied[0].tileIdx

  const seatWind = view.myWind
  const prevailingWind = view.prevailingWind
  type Rank = { tileIdx: number; visible: number; honorPenalty: number }
  const scored: Rank[] = tied.map(({ tileIdx }) => {
    const tile = hand[tileIdx]
    const honorPenalty =
      isWindName(tile.name) && tile.name !== seatWind && tile.name !== prevailingWind
        ? -1
        : 0
    return { tileIdx, visible: visibleCount(view, tile.name), honorPenalty }
  })
  scored.sort((a, b) => {
    if (a.honorPenalty !== b.honorPenalty) return a.honorPenalty - b.honorPenalty
    if (a.visible !== b.visible) return b.visible - a.visible
    return 0
  })
  return scored[0].tileIdx
}

/** Hard-mode: claim pong only if it doesn't worsen shanten. */
function considerPong(view: SeatView): [number, number] | null {
  if (!view.lastDiscard) return null
  const tile = view.lastDiscard.tile
  const pair = findPongTiles(view.myHand, tile)
  if (!pair) return null

  const before = shanten(view.myHand, lockedMelds(view))
  const without = view.myHand.filter((_, i) => i !== pair[0] && i !== pair[1])
  const after = shanten(without, lockedMelds(view) + 1)
  return after <= before ? pair : null
}
