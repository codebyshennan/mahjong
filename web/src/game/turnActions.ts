import { doc, runTransaction, type Firestore } from 'firebase/firestore'
import { ANIMAL_TILES, FLOWER_TILES } from './tileset'
import type { Meld, Tile } from './tileset'

const isFlower = (n: string) => (FLOWER_TILES as readonly string[]).includes(n)
const isAnimal = (n: string) => (ANIMAL_TILES as readonly string[]).includes(n)

/**
 * Draw a single tile from the deck into the current player's hand.
 * Auto-checks flower/animal tiles into playerChecked + playerMelds and
 * pulls a replacement from the bottom of the deck. Updates
 * gameState.tilesInHands / tilesToPlay and flips turnPhase to 'discard'.
 *
 * Run as a transaction so concurrent reads of the deck stay consistent.
 */
export async function drawForTurn(
  fsdb: Firestore,
  roomId: string,
  uid: string,
): Promise<void> {
  const deckRef = doc(fsdb, 'games', roomId, 'deck', 'deckInPlay')
  const handRef = doc(fsdb, 'games', roomId, 'players', uid, 'tiles', 'playerHand')
  const checkedRef = doc(fsdb, 'games', roomId, 'players', uid, 'tiles', 'playerChecked')
  const gsRef = doc(fsdb, 'games', roomId, 'gameState', roomId)

  await runTransaction(fsdb, async (tx) => {
    const [deckSnap, handSnap, checkedSnap, gsSnap] = await Promise.all([
      tx.get(deckRef),
      tx.get(handRef),
      tx.get(checkedRef),
      tx.get(gsRef),
    ])
    const deck = (deckSnap.data()?.deckInPlay as Tile[] | undefined) ?? []
    const hand = (handSnap.data()?.playerHand as Tile[] | undefined) ?? []
    const checked = (checkedSnap.data()?.playerChecked as Tile[] | undefined) ?? []
    const melds = (checkedSnap.data()?.playerMelds as Meld[] | undefined) ?? []
    const gs = gsSnap.data() as
      | { tilesInHands: number; tilesToPlay: number; turnPhase: string }
      | undefined
    if (!gs) throw new Error('gameState missing')
    if (gs.turnPhase !== 'draw') throw new Error('not your draw phase')

    let drawn = 0
    let tile = deck.shift()
    while (tile && (isFlower(tile.name) || isAnimal(tile.name))) {
      const kind: Meld['kind'] = isAnimal(tile.name) ? 'animal' : 'flower'
      checked.push(tile)
      melds.push({ kind, tiles: [tile] })
      drawn += 1
      tile = deck.pop()
    }
    if (!tile) throw new Error('deck exhausted')
    hand.push(tile)
    drawn += 1

    tx.set(deckRef, { deckInPlay: deck })
    tx.set(handRef, { playerHand: hand })
    tx.set(checkedRef, { playerChecked: checked, playerMelds: melds })
    tx.update(gsRef, {
      tilesInHands: gs.tilesInHands + drawn,
      tilesToPlay: gs.tilesToPlay - drawn,
      turnPhase: 'discard',
    })
  })
}

/**
 * Discard a single tile from hand. Moves it to playerDiscarded, advances
 * currentPlayer, flips turnPhase to 'draw', bumps currentTurnNo.
 */
export async function discardTile(
  fsdb: Firestore,
  roomId: string,
  uid: string,
  tileIndex: number,
): Promise<void> {
  const handRef = doc(fsdb, 'games', roomId, 'players', uid, 'tiles', 'playerHand')
  const discardedRef = doc(fsdb, 'games', roomId, 'players', uid, 'tiles', 'playerDiscarded')
  const gsRef = doc(fsdb, 'games', roomId, 'gameState', roomId)

  await runTransaction(fsdb, async (tx) => {
    const [handSnap, discardedSnap, gsSnap] = await Promise.all([
      tx.get(handRef),
      tx.get(discardedRef),
      tx.get(gsRef),
    ])
    const hand = [...((handSnap.data()?.playerHand as Tile[] | undefined) ?? [])]
    const discarded = [...((discardedSnap.data()?.playerDiscarded as Tile[] | undefined) ?? [])]
    const gs = gsSnap.data() as
      | { currentPlayer: number; currentTurnNo: number; tilesInDiscard: number; tilesInHands: number; turnPhase: string }
      | undefined
    if (!gs) throw new Error('gameState missing')
    if (gs.turnPhase !== 'discard') throw new Error('not your discard phase')

    const removed = hand.splice(tileIndex, 1)[0]
    if (!removed) throw new Error('tile index out of range')
    discarded.push(removed)

    tx.set(handRef, { playerHand: hand })
    tx.set(discardedRef, { playerDiscarded: discarded })
    tx.update(gsRef, {
      currentPlayer: (gs.currentPlayer + 1) % 4,
      currentTurnNo: gs.currentTurnNo + 1,
      tilesInHands: gs.tilesInHands - 1,
      tilesInDiscard: gs.tilesInDiscard + 1,
      turnPhase: 'draw',
    })
  })
}
