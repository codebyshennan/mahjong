import { buildDeck } from '../game/deck'
import { drawTile, makePlayer } from '../game/player'
import type { Player } from '../game/player'
import { calculateTai, taiToChips } from '../game/scoring'
import type { ScoringResult } from '../game/scoring'
import { WIND_TILES } from '../game/tileset'
import type { Meld, Tile, Wind } from '../game/tileset'
import { checkWin } from '../game/winCheck'

/** 'claim-window' = a discard sits exposed; any seat may pong/chow/win before draw. */
export type TurnPhase = 'draw' | 'discard' | 'claim-window' | 'over'
export type Seat = 0 | 1 | 2 | 3

export interface SoloPlayer extends Player {
  isBot: boolean
}

export interface SoloState {
  deck: Tile[]
  players: [SoloPlayer, SoloPlayer, SoloPlayer, SoloPlayer]
  /** Seat whose turn it is. During claim-window this is the seat that *just discarded*. */
  currentPlayer: Seat
  currentTurnNo: number
  prevailingWind: Wind
  turnPhase: TurnPhase
  /** Tile most recently discarded; sits in the discarder's discard pile. */
  lastDiscard: { seat: Seat; tile: Tile } | null
  roundNumber: number
  winner: Seat | null
  winType: 'self-draw' | 'discard-win' | null
  /** When `winType === 'discard-win'`, which seat fed the winning tile. */
  winFromSeat: Seat | null
  /** Settled scoring info for the round, populated when phase becomes 'over'. */
  result: RoundResult | null
}

export interface RoundResult {
  scoring: ScoringResult
  chipsPerLoser: number
  chipDelta: Record<Seat, number>
}

const SEAT_NAMES: Record<Seat, string> = { 0: 'You', 1: 'Bot 南', 2: 'Bot 西', 3: 'Bot 北' }

export function newGame(): SoloState {
  const deck = buildDeck()

  const players = ([0, 1, 2, 3] as Seat[]).map((i) => {
    const base = makePlayer({
      id: `seat-${i}`,
      name: SEAT_NAMES[i],
      wind: WIND_TILES[i],
      playerNumber: i,
    })
    return { ...base, isBot: i !== 0 } as SoloPlayer
  }) as [SoloPlayer, SoloPlayer, SoloPlayer, SoloPlayer]

  for (const p of players) drawTile(p, 13, deck)

  return {
    deck,
    players,
    currentPlayer: 0,
    currentTurnNo: 0,
    prevailingWind: 'east',
    turnPhase: 'draw',
    lastDiscard: null,
    roundNumber: 1,
    winner: null,
    winType: null,
    winFromSeat: null,
    result: null,
  }
}

/**
 * Settle scoring after a win. Singapore casual rule:
 *   - self-draw: each non-winner pays `chips`.
 *   - discard win (包牌-style): the discarder pays the full 3× share alone.
 *
 * Mutates `state.result` and each player's `chips` + `currentScore`.
 */
function settleRound(state: SoloState): void {
  if (state.winner === null || state.winType === null) return
  const winner = state.players[state.winner]
  const scoring = calculateTai(winner, { currentWind: state.prevailingWind }, state.winType)
  const baseChips = taiToChips(scoring.tai)
  const chipDelta: Record<Seat, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }

  if (state.winType === 'self-draw') {
    for (const p of state.players) {
      if (p.playerNumber === state.winner) continue
      chipDelta[p.playerNumber as Seat] = -baseChips
      chipDelta[state.winner] += baseChips
    }
  } else if (state.winType === 'discard-win' && state.winFromSeat !== null) {
    const owe = baseChips * 3
    chipDelta[state.winFromSeat] = -owe
    chipDelta[state.winner] = owe
  }

  for (const p of state.players) {
    p.chips += chipDelta[p.playerNumber as Seat]
    p.currentScore += chipDelta[p.playerNumber as Seat]
  }

  state.result = {
    scoring,
    chipsPerLoser: baseChips,
    chipDelta,
  }
}

export function applyDraw(state: SoloState): SoloState {
  if (state.turnPhase !== 'draw') throw new Error('not draw phase')
  if (state.deck.length === 0) {
    state.turnPhase = 'over'
    return state
  }
  const player = state.players[state.currentPlayer]
  drawTile(player, 1, state.deck)
  state.turnPhase = 'discard'
  return state
}

export function applyDiscard(state: SoloState, tileIdx: number): SoloState {
  if (state.turnPhase !== 'discard') throw new Error('not discard phase')
  const player = state.players[state.currentPlayer]
  const removed = player.playerHand.splice(tileIdx, 1)[0]
  if (!removed) throw new Error('tile index out of range')
  player.playerDiscarded.push(removed)
  state.lastDiscard = { seat: state.currentPlayer, tile: removed }
  state.turnPhase = 'claim-window'
  return state
}

/** No claims made: advance to the next seat's draw. Clears lastDiscard. */
export function passClaimWindow(state: SoloState): SoloState {
  if (state.turnPhase !== 'claim-window') throw new Error('not claim-window phase')
  state.currentPlayer = ((state.currentPlayer + 1) % 4) as Seat
  state.currentTurnNo += 1
  state.turnPhase = 'draw'
  state.lastDiscard = null
  return state
}

/**
 * Claim a pong on the live discard. `claimer` must be ≠ discarder. Removes 2
 * matching tiles from claimer's hand + the discard tile (popping the discarder's
 * pile), pushes a `pong` meld, advances to claimer's discard phase.
 */
export function applyPong(
  state: SoloState,
  claimer: Seat,
  handIndices: [number, number],
): SoloState {
  if (state.turnPhase !== 'claim-window') throw new Error('not claim-window phase')
  if (state.lastDiscard === null) throw new Error('no discard to claim')
  if (claimer === state.lastDiscard.seat) throw new Error('cannot claim own discard')

  const claimerPlayer = state.players[claimer]
  const discarderPlayer = state.players[state.lastDiscard.seat]
  const discardTile = state.lastDiscard.tile

  // Pop the tile back out of the discarder's pile (it's the most recent push).
  if (discarderPlayer.playerDiscarded[discarderPlayer.playerDiscarded.length - 1] !== discardTile) {
    throw new Error('lastDiscard not at top of discarder pile')
  }
  discarderPlayer.playerDiscarded.pop()

  const sorted = [...handIndices].sort((a, b) => b - a) // descending for safe splice
  const removed: Tile[] = []
  for (const idx of sorted) {
    const t = claimerPlayer.playerHand.splice(idx, 1)[0]
    if (!t || t.name !== discardTile.name) {
      throw new Error('pong indices do not match discard name')
    }
    removed.unshift(t)
  }

  const meldTiles = [...removed, discardTile]
  const meld: Meld = { kind: 'pong', tiles: meldTiles }
  claimerPlayer.playerChecked.push(...meldTiles)
  claimerPlayer.playerMelds.push(meld)

  state.currentPlayer = claimer
  state.currentTurnNo += 1
  state.turnPhase = 'discard'
  state.lastDiscard = null
  return state
}

/**
 * Claim a chow. Only legal for the seat immediately after the discarder.
 * `handIndices` are the two tiles that, with the discard, form a valid chow.
 */
export function applyChow(
  state: SoloState,
  claimer: Seat,
  handIndices: [number, number],
): SoloState {
  if (state.turnPhase !== 'claim-window') throw new Error('not claim-window phase')
  if (state.lastDiscard === null) throw new Error('no discard to claim')
  const expectedClaimer = ((state.lastDiscard.seat + 1) % 4) as Seat
  if (claimer !== expectedClaimer) throw new Error('chow only legal for seat after discarder')

  const claimerPlayer = state.players[claimer]
  const discarderPlayer = state.players[state.lastDiscard.seat]
  const discardTile = state.lastDiscard.tile

  if (discarderPlayer.playerDiscarded[discarderPlayer.playerDiscarded.length - 1] !== discardTile) {
    throw new Error('lastDiscard not at top of discarder pile')
  }
  discarderPlayer.playerDiscarded.pop()

  const sorted = [...handIndices].sort((a, b) => b - a)
  const removed: Tile[] = []
  for (const idx of sorted) {
    const t = claimerPlayer.playerHand.splice(idx, 1)[0]
    if (!t) throw new Error('chow index out of range')
    removed.unshift(t)
  }

  const meldTiles = [...removed, discardTile]
  const meld: Meld = { kind: 'chow', tiles: meldTiles }
  claimerPlayer.playerChecked.push(...meldTiles)
  claimerPlayer.playerMelds.push(meld)

  state.currentPlayer = claimer
  state.currentTurnNo += 1
  state.turnPhase = 'discard'
  state.lastDiscard = null
  return state
}

/**
 * Claim a win on the live discard. Caller must have already verified
 * `checkWin(hand + discard, checked)` returns win=true.
 */
export function applyDiscardWin(state: SoloState, claimer: Seat): SoloState {
  if (state.turnPhase !== 'claim-window') throw new Error('not claim-window phase')
  if (state.lastDiscard === null) throw new Error('no discard to claim')

  const claimerPlayer = state.players[claimer]
  const result = checkWin(
    [...claimerPlayer.playerHand, state.lastDiscard.tile],
    claimerPlayer.playerChecked,
  )
  if (!result.win) throw new Error('hand + discard does not win')

  // Visually attach the winning tile to the hand so the breakdown can see it.
  claimerPlayer.playerHand.push(state.lastDiscard.tile)
  state.players[state.lastDiscard.seat].playerDiscarded.pop()

  state.winner = claimer
  state.winType = 'discard-win'
  state.winFromSeat = state.lastDiscard.seat
  state.turnPhase = 'over'
  state.lastDiscard = null
  settleRound(state)
  return state
}

/** Self-draw win: caller must have verified checkWin on current hand+checked. */
export function applySelfDrawWin(state: SoloState): SoloState {
  if (state.turnPhase !== 'discard') throw new Error('self-draw win must follow a draw')
  const seat = state.currentPlayer
  const player = state.players[seat]
  const result = checkWin(player.playerHand, player.playerChecked)
  if (!result.win) throw new Error('hand does not win')

  state.winner = seat
  state.winType = 'self-draw'
  state.winFromSeat = null
  state.turnPhase = 'over'
  settleRound(state)
  return state
}

/**
 * Reshuffle and redeal for a new round. Carries over each player's chip total
 * and increments roundNumber. Wind rotation is intentionally omitted for v1 —
 * keeps the practice loop simple; revisit if/when porting back to multiplayer.
 */
export function nextRound(state: SoloState): void {
  const deck = buildDeck()
  for (const p of state.players) {
    p.playerHand = []
    p.playerChecked = []
    p.playerDiscarded = []
    p.playerMelds = []
  }
  for (const p of state.players) drawTile(p, 13, deck)

  state.deck = deck
  state.currentPlayer = 0
  state.currentTurnNo = 0
  state.turnPhase = 'draw'
  state.lastDiscard = null
  state.winner = null
  state.winType = null
  state.winFromSeat = null
  state.result = null
  state.roundNumber += 1
}
