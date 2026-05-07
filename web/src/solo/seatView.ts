import type { Meld, Tile, Wind } from '../game/tileset'
import type { Seat, SoloState, TurnPhase } from './state'

/**
 * What a single seat is allowed to know — own hand + everyone's public state
 * (melds, discards, hand sizes). No deck contents, no opponents' hidden tiles.
 * Bots MUST consume only this; passing them the full state would be cheating.
 */
export interface SeatView {
  seat: Seat
  myWind: Wind
  prevailingWind: Wind
  myHand: Tile[]
  myMelds: Meld[]
  myChecked: Tile[]
  /** Public per-seat info. Index 0..3. */
  public: {
    seat: Seat
    name: string
    wind: Wind
    handCount: number
    melds: Meld[]
    discards: Tile[]
  }[]
  deckRemaining: number
  currentPlayer: Seat
  turnPhase: TurnPhase
  lastDiscard: SoloState['lastDiscard']
}

export function viewFor(state: SoloState, seat: Seat): SeatView {
  const me = state.players[seat]
  return {
    seat,
    myWind: me.wind,
    prevailingWind: state.prevailingWind,
    myHand: [...me.playerHand],
    myMelds: [...me.playerMelds],
    myChecked: [...me.playerChecked],
    public: state.players.map((p) => ({
      seat: p.playerNumber as Seat,
      name: p.name,
      wind: p.wind,
      handCount: p.playerHand.length,
      melds: [...p.playerMelds],
      discards: [...p.playerDiscarded],
    })),
    deckRemaining: state.deck.length,
    currentPlayer: state.currentPlayer,
    turnPhase: state.turnPhase,
    lastDiscard: state.lastDiscard,
  }
}
