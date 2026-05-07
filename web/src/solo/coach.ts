// Coaching helpers — built on top of shanten. Strictly read-only computations
// over a player's hand; never mutates state.

import type { Tile, Meld } from '../game/tileset'
import { checkWin } from '../game/winCheck'
import { shanten, shantenAfterDiscard } from './shanten'

const ALL_TILE_NAMES: readonly string[] = [
  ...['b', 'd', 'c'].flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${s}${n}`)),
  'east', 'south', 'west', 'north',
  'reddragon', 'greendragon', 'bluedragon',
]

const TILE_LABELS: Record<string, string> = {
  east: 'East 東',
  south: 'South 南',
  west: 'West 西',
  north: 'North 北',
  reddragon: 'Red 中',
  greendragon: 'Green 發',
  bluedragon: 'White 白',
}

const SUIT_LABEL: Record<string, string> = {
  b: 'bam',
  d: 'dot',
  c: 'char',
}

export function tileNameLabel(name: string): string {
  if (/^[bdc]\d$/.test(name)) return `${name[1]}${SUIT_LABEL[name[0]]}`
  return TILE_LABELS[name] ?? name
}

export interface CoachInfo {
  /** Shanten of current hand (after a draw → 14 tiles) or -1 if winning. */
  shanten: number
  /** True when shanten ≤ 0. */
  tenpai: boolean
  /** Best (lowest) shanten reachable by some discard from a 14-tile hand. */
  bestDiscardShanten: number
  /**
   * Original-hand-index → shanten resulting from discarding that tile.
   * Only populated when hand has 14 tiles (during discard phase).
   */
  perTile: Map<number, number>
}

function lockedMeldCount(checkedMelds: readonly Meld[]): number {
  let n = 0
  for (const m of checkedMelds) {
    if (m.kind === 'pong' || m.kind === 'chow' || m.kind.startsWith('kong')) n++
  }
  return n
}

export function coachInfo(hand: readonly Tile[], melds: readonly Meld[]): CoachInfo {
  const locked = lockedMeldCount(melds)
  const sh = shanten(hand, locked)
  if (hand.length < 14) {
    return {
      shanten: sh,
      tenpai: sh <= 0,
      bestDiscardShanten: sh,
      perTile: new Map(),
    }
  }
  const perDiscard = shantenAfterDiscard(hand, locked)
  const perTile = new Map<number, number>()
  let best = Infinity
  for (const r of perDiscard) {
    perTile.set(r.tileIdx, r.shanten)
    if (r.shanten < best) best = r.shanten
  }
  return {
    shanten: sh,
    tenpai: sh <= 0,
    bestDiscardShanten: best === Infinity ? sh : best,
    perTile,
  }
}

/** True for tiles whose discard leaves shanten at the minimum across the hand. */
export function isOptimalDiscard(info: CoachInfo, originalHandIdx: number): boolean {
  const sh = info.perTile.get(originalHandIdx)
  if (sh === undefined) return true
  return sh === info.bestDiscardShanten
}

/**
 * Tile names that, if drawn or claimed, would complete the hand.
 * Returns [] when the hand isn't tenpai. Stub Tile objects suffice because
 * checkWin only inspects `name` and `isSpecialName(name)`.
 */
export function waitTiles(hand: readonly Tile[], checked: readonly Tile[]): string[] {
  const out: string[] = []
  const checkedArr = [...checked]
  for (const name of ALL_TILE_NAMES) {
    const stub = { name, url: '', suit: '', index: -1 } as Tile
    if (checkWin([...hand, stub], checkedArr).win) out.push(name)
  }
  return out
}

export function shantenLabel(sh: number): string {
  if (sh === -1) return 'winning hand'
  if (sh === 0) return 'tenpai (1 away)'
  return `${sh} away from tenpai`
}

export interface CoachQuestionContext {
  shanten: number
  tenpai: boolean
  waits: string[]
  advice: string | null
}

export function answerQuestion(question: string, ctx: CoachQuestionContext): string {
  const q = question.toLowerCase()

  if (/discard|throw|get rid|should i|what.*play|best.*tile/.test(q)) {
    return ctx.advice ?? "Draw a tile first, then I can advise on discards."
  }
  if (/wait|waiting|need.*win|complete.*hand|finish.*hand/.test(q)) {
    if (!ctx.tenpai) return `You're ${shantenLabel(ctx.shanten)} — keep building before thinking about waits.`
    if (ctx.waits.length === 0) return "You're tenpai! I couldn't identify specific wait tiles right now."
    return `Waiting on: ${ctx.waits.map(tileNameLabel).join(', ')}.`
  }
  if (/hand|status|how.*doing|how.*far|shanten.*number/.test(q)) {
    return ctx.advice ?? `Hand status: ${shantenLabel(ctx.shanten)}.`
  }
  if (/what.*tenpai|tenpai.*mean|explain.*tenpai/.test(q)) {
    return "Tenpai (聽牌) means your hand is one tile away from winning. You're waiting for a specific tile to complete your hand."
  }
  if (/what.*shanten|shanten.*mean|explain.*shanten/.test(q)) {
    return `Shanten counts how many tiles away from tenpai you are. 0 = tenpai, -1 = winning hand. Yours is currently ${ctx.shanten}.`
  }
  if (/pong/.test(q)) {
    return "Pong (碰): Claim any player's discard when you have 2 matching tiles in hand. Creates a locked triple."
  }
  if (/chow|sequence|run|straight/.test(q)) {
    return "Chow (吃): Claim a discard from the player to your left to complete a sequence of 3 consecutive same-suit tiles."
  }
  if (/kong|quad|four of/.test(q)) {
    return "Kong (槓): 4 identical tiles — locks a quad and draws a replacement from the back of the deck."
  }
  if (/how.*win|win.*condition|mahjong.*mean/.test(q)) {
    return "To win: complete 4 melds (pongs/chows/kongs of 3) + 1 pair. Flowers and animals auto-check and add bonus points."
  }
  if (/tai|score|point|scoring|value/.test(q)) {
    return "Tai (台) are scoring units — more tai = higher payout. Common sources: self-draw (自摸), all one suit, all-concealed hand."
  }
  if (/flower|animal|special/.test(q)) {
    return "Flowers and animals are bonus tiles. When drawn, they auto-check and you draw a replacement. They earn tai but don't count toward melds."
  }
  return "I can help with: what to discard, your waits, hand status, or explain pong / chow / tenpai / shanten. Try asking one of those!"
}
