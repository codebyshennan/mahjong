import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  applyChow,
  applyDiscard,
  applyDiscardWin,
  applyPong,
  applySelfDrawWin,
  newGame,
  nextRound,
  passClaimWindow,
} from './state.ts'
import type { Seat, SoloState } from './state.ts'
import { findChowOptions, findPongTiles } from './claims.ts'
import type { Tile } from '../game/tileset.ts'

// --- Tile fixtures (avoid relying on shuffled deck during unit tests).
let tileIdx = 0
const tile = (name: string, suit = '?'): Tile => ({
  name,
  suit,
  url: '',
  index: tileIdx++,
})
const numbered = (s: 'b' | 'c' | 'd', n: number, copy = 1): Tile => ({
  ...tile(`${s}${n}`),
  copy,
})
const wind = (name: string): Tile => tile(name)
const dragon = (color: string): Tile => tile(`${color}dragon`)

// Replace player hands directly. Also clears any flower/animal melds
// auto-checked during newGame()'s initial 13-tile deal so tests stay deterministic.
function setHand(state: SoloState, seat: Seat, hand: Tile[]) {
  state.players[seat].playerHand = hand
  state.players[seat].playerChecked = []
  state.players[seat].playerMelds = []
}
function setChecked(state: SoloState, seat: Seat, checked: Tile[]) {
  state.players[seat].playerChecked = checked
}

test('applyDiscard moves tile to discard pile and enters claim-window', () => {
  const s = newGame()
  s.turnPhase = 'discard' // bypass draw for the test
  setHand(s, 0, [numbered('b', 1), numbered('b', 2), numbered('b', 3)])
  applyDiscard(s, 0)
  assert.equal(s.turnPhase, 'claim-window')
  assert.equal(s.players[0].playerDiscarded.length, 1)
  assert.equal(s.players[0].playerDiscarded[0].name, 'b1')
  assert.equal(s.lastDiscard?.tile.name, 'b1')
})

test('passClaimWindow advances to next seat draw', () => {
  const s = newGame()
  s.turnPhase = 'discard'
  setHand(s, 0, [numbered('b', 1), numbered('b', 2)])
  applyDiscard(s, 0)
  passClaimWindow(s)
  assert.equal(s.turnPhase, 'draw')
  assert.equal(s.currentPlayer, 1)
  assert.equal(s.lastDiscard, null)
})

test('applyPong: claimer takes 2 from hand + 1 from discarder pile', () => {
  const s = newGame()
  // seat 0 discards a c5; seat 2 has two c5s and pongs.
  s.turnPhase = 'discard'
  s.currentPlayer = 0
  setHand(s, 0, [numbered('c', 5, 1)])
  setHand(s, 2, [numbered('c', 5, 2), numbered('c', 5, 3), numbered('b', 1)])
  applyDiscard(s, 0)
  assert.equal(s.lastDiscard?.tile.name, 'c5')

  const pongIdx = findPongTiles(s.players[2].playerHand, s.lastDiscard!.tile)
  assert.ok(pongIdx)
  applyPong(s, 2, pongIdx!)

  assert.equal(s.turnPhase, 'discard')
  assert.equal(s.currentPlayer, 2)
  assert.equal(s.players[0].playerDiscarded.length, 0, 'discarder pile reclaimed')
  assert.equal(s.players[2].playerHand.length, 1, 'two c5s left hand')
  assert.equal(s.players[2].playerMelds.length, 1)
  assert.equal(s.players[2].playerMelds[0].kind, 'pong')
  assert.equal(s.players[2].playerMelds[0].tiles.length, 3)
  assert.equal(s.players[2].playerChecked.length, 3)
})

test('applyChow only legal for seat right after discarder', () => {
  const s = newGame()
  s.turnPhase = 'discard'
  s.currentPlayer = 0
  setHand(s, 0, [numbered('b', 5, 1)])
  setHand(s, 1, [numbered('b', 6, 1), numbered('b', 7, 1), numbered('c', 1)])
  setHand(s, 2, [numbered('b', 6, 2), numbered('b', 7, 2)]) // also could form chow but isn't next
  applyDiscard(s, 0)

  // seat 2 attempts chow → must throw
  assert.throws(() => applyChow(s, 2, [0, 1]), /chow only legal/)

  // seat 1 chows correctly
  const opts = findChowOptions(s.players[1].playerHand, s.lastDiscard!.tile)
  assert.equal(opts.length, 1)
  applyChow(s, 1, opts[0].handIndices)
  assert.equal(s.turnPhase, 'discard')
  assert.equal(s.currentPlayer, 1)
  assert.equal(s.players[1].playerMelds[0].kind, 'chow')
  assert.equal(s.players[1].playerMelds[0].tiles.length, 3)
})

test('applyDiscardWin: claimer needs hand+discard to win', () => {
  const s = newGame()
  s.turnPhase = 'discard'
  s.currentPlayer = 0
  // Fully prefab seat 1 winning on c9 from seat 0:
  // 4 melds + 1 pair total. Already checked: 1 pong of b1 (3 tiles in checked).
  // In hand (10 tiles + 1 discard = 11): b2-b3-b4, c2-c2 (pair), c7-c8-c9 (chow with discard), c4-c5-c6 (chow).
  setHand(s, 1, [
    numbered('b', 2),
    numbered('b', 3),
    numbered('b', 4),
    numbered('c', 2, 1),
    numbered('c', 2, 2),
    numbered('c', 7),
    numbered('c', 8),
    numbered('c', 4),
    numbered('c', 5),
    numbered('c', 6),
  ])
  setChecked(s, 1, [numbered('b', 1, 1), numbered('b', 1, 2), numbered('b', 1, 3)])
  s.players[1].playerMelds = [
    {
      kind: 'pong',
      tiles: [numbered('b', 1, 1), numbered('b', 1, 2), numbered('b', 1, 3)],
    },
  ]
  setHand(s, 0, [numbered('c', 9)])
  applyDiscard(s, 0)
  applyDiscardWin(s, 1)
  assert.equal(s.turnPhase, 'over')
  assert.equal(s.winner, 1)
  assert.equal(s.winType, 'discard-win')
  assert.equal(s.winFromSeat, 0)
})

test('applySelfDrawWin: post-draw winning hand declared', () => {
  const s = newGame()
  s.currentPlayer = 0
  s.turnPhase = 'discard'
  // 14 tiles forming 4 melds + 1 pair: b1-b1-b1 pong, b2-b3-b4 chow,
  // c5-c5-c5 pong, d2-d3-d4 chow, dragon-dragon pair.
  setHand(s, 0, [
    numbered('b', 1, 1),
    numbered('b', 1, 2),
    numbered('b', 1, 3),
    numbered('b', 2),
    numbered('b', 3),
    numbered('b', 4),
    numbered('c', 5, 1),
    numbered('c', 5, 2),
    numbered('c', 5, 3),
    numbered('d', 2),
    numbered('d', 3),
    numbered('d', 4),
    dragon('red'),
    dragon('red'),
  ])
  applySelfDrawWin(s)
  assert.equal(s.turnPhase, 'over')
  assert.equal(s.winner, 0)
  assert.equal(s.winType, 'self-draw')
})

test('cannot pong own discard', () => {
  const s = newGame()
  s.turnPhase = 'discard'
  s.currentPlayer = 0
  setHand(s, 0, [numbered('c', 5, 1), numbered('c', 5, 2), numbered('c', 5, 3)])
  applyDiscard(s, 0)
  assert.throws(() => applyPong(s, 0, [0, 1]), /cannot claim own discard/)
})

test('findChowOptions enumerates all 3 sequences when in middle', () => {
  // Discard d5 and hold d3,d4,d6,d7 → chows: 3-4-5, 4-5-6, 5-6-7
  const hand = [numbered('d', 3), numbered('d', 4), numbered('d', 6), numbered('d', 7)]
  const opts = findChowOptions(hand, numbered('d', 5))
  assert.equal(opts.length, 3)
})

test('findPongTiles returns null when only one match', () => {
  const hand = [numbered('b', 5, 1), numbered('b', 6)]
  assert.equal(findPongTiles(hand, numbered('b', 5, 2)), null)
})

test('settleRound: discard-win sends 3× chips from feeder to winner', () => {
  const s = newGame()
  s.turnPhase = 'discard'
  s.currentPlayer = 0
  setHand(s, 1, [
    numbered('b', 2),
    numbered('b', 3),
    numbered('b', 4),
    numbered('c', 2, 1),
    numbered('c', 2, 2),
    numbered('c', 7),
    numbered('c', 8),
    numbered('c', 4),
    numbered('c', 5),
    numbered('c', 6),
  ])
  setChecked(s, 1, [numbered('b', 1, 1), numbered('b', 1, 2), numbered('b', 1, 3)])
  s.players[1].playerMelds = [
    {
      kind: 'pong',
      tiles: [numbered('b', 1, 1), numbered('b', 1, 2), numbered('b', 1, 3)],
    },
  ]
  setHand(s, 0, [numbered('c', 9)])
  applyDiscard(s, 0)
  applyDiscardWin(s, 1)

  assert.ok(s.result, 'result populated after win')
  const r = s.result!
  // Zero-sum: winner gain == discarder loss; uninvolved seats unaffected.
  assert.equal(r.chipDelta[1] + r.chipDelta[0], 0, 'zero-sum')
  assert.equal(r.chipDelta[1], r.chipsPerLoser * 3)
  assert.equal(r.chipDelta[2], 0)
  assert.equal(r.chipDelta[3], 0)
  assert.equal(s.players[1].chips - 1000, r.chipsPerLoser * 3)
  assert.equal(s.players[0].chips, 1000 - r.chipsPerLoser * 3)
})

test('nextRound: reshuffle, redeal, increment round, keep chips', () => {
  const s = newGame()
  s.turnPhase = 'discard'
  s.currentPlayer = 0
  setHand(s, 0, [
    numbered('b', 1, 1),
    numbered('b', 1, 2),
    numbered('b', 1, 3),
    numbered('b', 2),
    numbered('b', 3),
    numbered('b', 4),
    numbered('c', 5, 1),
    numbered('c', 5, 2),
    numbered('c', 5, 3),
    numbered('d', 2),
    numbered('d', 3),
    numbered('d', 4),
    dragon('red'),
    dragon('red'),
  ])
  applySelfDrawWin(s)
  const chipsAfterWin = s.players[0].chips
  assert.notEqual(chipsAfterWin, 1000)

  nextRound(s)
  assert.equal(s.turnPhase, 'draw')
  assert.equal(s.roundNumber, 2)
  assert.equal(s.winner, null)
  assert.equal(s.players[0].chips, chipsAfterWin, 'chips persist across rounds')
  // Each seat redealt 13 (modulo flower auto-checks pulling more from deck).
  for (const p of s.players) assert.ok(p.playerHand.length >= 13 - 8) // worst case all 8 flowers
})

void wind // keep import alive
