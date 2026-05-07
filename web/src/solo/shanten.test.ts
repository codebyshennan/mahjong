import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { shanten } from './shanten.ts'
import type { Tile } from '../game/tileset.ts'

let nextIdx = 0
const t = (name: string): Tile => ({ name, suit: '?', url: '', index: nextIdx++ })
const num = (s: 'b' | 'c' | 'd', n: number): Tile => t(`${s}${n}`)

const expand = (specs: string[]): Tile[] =>
  specs.flatMap((s) => {
    const m = s.match(/^(\d+)([bcd])$/) // e.g. "3b" → b3
    if (!m) return [t(s)] // honor name like 'east'
    const count = parseInt(m[1], 10)
    const suit = m[2] as 'b' | 'c' | 'd'
    const n = count
    return [num(suit, n)]
  })

// Helper: build by listing each tile name.
const hand = (...names: string[]): Tile[] => names.map((n) => t(n))

test('winning hand shanten = -1', () => {
  // 4 melds + 1 pair: b1b1b1, b2b3b4, c5c5c5, d2d3d4, redr-redr
  const h = [
    ...expand(['1b', '1b', '1b']),
    ...expand(['2b', '3b', '4b']),
    ...expand(['5c', '5c', '5c']),
    ...expand(['2d', '3d', '4d']),
    t('reddragon'), t('reddragon'),
  ]
  assert.equal(shanten(h, 0), -1)
})

test('tenpai (one away from winning) shanten = 0', () => {
  // 3 melds + 1 pair + ryanmen waiting: b1b1b1 + b2b3b4 + c5c5c5 + d2d3 (needs d1 or d4) + RR
  const h = hand(
    'b1', 'b1', 'b1',
    'b2', 'b3', 'b4',
    'c5', 'c5', 'c5',
    'd2', 'd3',
    'reddragon', 'reddragon',
  )
  assert.equal(shanten(h, 0), 0)
})

test('1-shanten (two away)', () => {
  // 2 melds + 2 partials + pair: b1b1b1 + b2b3b4 + c5c5 (pair) + d2d3 (partial) + e2e3 (partial)
  // 13 tiles
  const h = hand(
    'b1', 'b1', 'b1',
    'b2', 'b3', 'b4',
    'c5', 'c5',
    'd2', 'd3',
    'd5', 'd6',
    'east',
  )
  // Best decomposition: 2 melds (b1×3, b2-b3-b4), pair c5c5,
  // 2 partials (d2-d3, d5-d6), 1 floater (east). Shanten = (4-2)*2 - 2 - 1 = 1.
  assert.equal(shanten(h, 0), 1)
})

test('all-honors hand: pongs + pair only', () => {
  // 4 honor pongs + 1 pair (winning, all-honors variant)
  const h = [
    t('east'), t('east'), t('east'),
    t('south'), t('south'), t('south'),
    t('west'), t('west'), t('west'),
    t('north'), t('north'), t('north'),
    t('reddragon'), t('reddragon'),
  ]
  assert.equal(shanten(h, 0), -1)
})

test('locked melds reduce target meld count', () => {
  // With 2 lockedMelds (e.g. 2 pongs already in playerChecked), need 2 more melds + pair.
  // Hand has c5c5c5 + d2d3d4 + RR + 2 floaters = 11 tiles, but should report -1
  // because lockedMelds covers 6 of the 14-tile target.
  const h = hand(
    'c5', 'c5', 'c5',
    'd2', 'd3', 'd4',
    'reddragon', 'reddragon',
  )
  // 8 tiles in hand + 2 locked melds = 14 tile slots. 2 melds + 1 pair = 8. Need 2 more melds from locked (6 tiles).
  // 2 + 2 = 4 melds, 1 pair. Win. shanten = -1.
  assert.equal(shanten(h, 2), -1)
})

test('empty hand = far from win', () => {
  const h: Tile[] = []
  // shanten of empty hand: 4 melds + 1 pair away. (4-0)*2 - 0 - 0 = 8.
  assert.equal(shanten(h, 0), 8)
})

test('tiles in pure noise (no pairs, no runs) are high shanten', () => {
  // Mix of distant tiles
  const h = hand('b1', 'b5', 'b9', 'c1', 'c5', 'c9', 'd1', 'd5', 'd9', 'east', 'south', 'west', 'reddragon')
  const sh = shanten(h, 0)
  // Without any group structure, shanten ≥ 5 (worst-case far).
  assert.ok(sh >= 5, `expected far shanten, got ${sh}`)
})
