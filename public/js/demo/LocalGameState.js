import { buildDeck } from '../utils/makeDeck.js'
import { ANIMAL_TILES, FLOWER_TILES, WIND_TILES } from '../rooms/game/tileset.js'
import { checkWin } from '../utils/winCheck.js'

const isSpecial = (tile) => FLOWER_TILES.includes(tile.name) || ANIMAL_TILES.includes(tile.name)

export const SEAT_NAMES = ['You', 'South Bot', 'West Bot', 'North Bot']

const makePlayer = (seat) => ({
  seat,
  name: SEAT_NAMES[seat],
  wind: WIND_TILES[seat],
  isHuman: seat === 0,
  hand: [],
  checked: [],
  discarded: [],
})

export class LocalGameState {
  constructor() {
    this.reset()
  }

  reset() {
    this.deck = buildDeck()
    this.players = [0, 1, 2, 3].map(makePlayer)
    this.currentSeat = 0
    this.awaitingDiscard = false
    this.lastDiscard = null
    this.lastDiscardSeat = null
    this.winner = null
    this.roundEnd = false
    this._dealInitial()
  }

  _dealInitial() {
    for (let round = 0; round < 13; round += 1) {
      this.players.forEach((p) => this._drawIntoHand(p))
    }
    this.players.forEach((p) => this._resolveFlowers(p))
  }

  _resolveFlowers(player) {
    let i = 0
    while (i < player.hand.length) {
      const tile = player.hand[i]
      if (isSpecial(tile)) {
        player.hand.splice(i, 1)
        player.checked.push(tile)
        const replacement = this.deck.pop()
        if (!replacement) { this._endAsDraw(); return }
        player.hand.push(replacement)
      } else {
        i += 1
      }
    }
  }

  _drawIntoHand(player) {
    const tile = this.deck.shift()
    if (!tile) { this._endAsDraw(); return null }
    player.hand.push(tile)
    return tile
  }

  // Draw a tile for the seat about to play. Auto-replaces flowers/animals
  // by drawing from the bottom of the deck (matches game.js behavior).
  drawForCurrent() {
    const player = this.players[this.currentSeat]
    let tile = this.deck.shift()
    while (tile && isSpecial(tile)) {
      player.checked.push(tile)
      tile = this.deck.pop()
    }
    if (!tile) { this._endAsDraw(); return null }
    player.hand.push(tile)
    this.awaitingDiscard = true
    return tile
  }

  discard(seat, tileIndex) {
    const player = this.players[seat]
    const idx = player.hand.findIndex((t) => t.index === tileIndex)
    if (idx < 0) return null
    const [tile] = player.hand.splice(idx, 1)
    player.discarded.push(tile)
    this.lastDiscard = tile
    this.lastDiscardSeat = seat
    this.awaitingDiscard = false
    return tile
  }

  // Move tile from a discarder's pile into the eater's checked, plus extra
  // hand tiles. `combo` is the array of tile NAMES taken from the eater's hand.
  applyClaim(eaterSeat, combo) {
    const eater = this.players[eaterSeat]
    const discarder = this.players[this.lastDiscardSeat]
    const claimedTile = discarder.discarded.pop()
    const meld = [claimedTile]
    combo.forEach((tileName) => {
      const handIdx = eater.hand.findIndex((t) => t.name === tileName)
      if (handIdx >= 0) {
        meld.push(eater.hand.splice(handIdx, 1)[0])
      }
    })
    meld.sort((a, b) => a.name.localeCompare(b.name))
    meld.forEach((t) => eater.checked.push(t))
    this.currentSeat = eaterSeat
    this.awaitingDiscard = true
    this.lastDiscard = null
    this.lastDiscardSeat = null
  }

  advanceTurn() {
    this.currentSeat = (this.currentSeat + 1) % 4
  }

  declareWin(seat, source) {
    const player = this.players[seat]
    this.winner = { seat, name: player.name, type: source }
    this.roundEnd = true
  }

  _endAsDraw() {
    if (this.roundEnd) return
    this.winner = null
    this.roundEnd = true
  }

  // Helpers for AI / claim checks.
  tallyHandByName(seat) {
    const player = this.players[seat]
    const tally = {}
    player.hand.forEach((t) => { tally[t.name] = (tally[t.name] || 0) + 1 })
    return tally
  }

  canPong(seat, tile) {
    if (!tile) return false
    const tally = this.tallyHandByName(seat)
    return (tally[tile.name] || 0) >= 2
  }

  // Chow combos available for `seat` against `tile`. Only the seat immediately
  // after the discarder is allowed (Singapore rule). Returns array of
  // [otherTileName, otherTileName] pairs that complete a sequence.
  chowOptions(seat, tile, discarderSeat) {
    if (!tile) return []
    if ((discarderSeat + 1) % 4 !== seat) return []
    if (tile.index > 108) return []  // numbered tiles only
    const tally = this.tallyHandByName(seat)
    const suit = tile.name.substr(0, 1)
    const num = +tile.name.substr(1, 1)
    const options = []
    if (tally[`${suit}${num + 1}`] && tally[`${suit}${num + 2}`]) {
      options.push([`${suit}${num + 1}`, `${suit}${num + 2}`])
    }
    if (tally[`${suit}${num - 1}`] && tally[`${suit}${num + 1}`]) {
      options.push([`${suit}${num - 1}`, `${suit}${num + 1}`])
    }
    if (tally[`${suit}${num - 1}`] && tally[`${suit}${num - 2}`]) {
      options.push([`${suit}${num - 1}`, `${suit}${num - 2}`])
    }
    return options
  }

  // Test win on a hand+discard combo without mutating state.
  canWinOnDiscard(seat, tile) {
    if (!tile) return false
    const player = this.players[seat]
    const trialHand = [...player.hand, tile]
    return checkWin(trialHand, player.checked).win
  }

  canSelfDrawWin(seat) {
    const player = this.players[seat]
    return checkWin(player.hand, player.checked).win
  }
}
