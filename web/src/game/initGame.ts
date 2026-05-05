import { doc, writeBatch, type Firestore } from 'firebase/firestore'
import { buildDeck } from './deck'
import { drawTile, makePlayer } from './player'
import type { Player } from './player'
import { WIND_TILES } from './tileset'
import type { Tile, Wind } from './tileset'

export interface SeatInput {
  uid: string
  displayName: string
}

export interface GameStateDoc {
  roomId: string
  host: string
  players: { playerId: string; playerWind: Wind }[]
  windCount: number
  currentWind: Wind
  currentPlayer: number
  currentTurnNo: number
  currentHouse: Wind
  diceRolled: number
  timeStarted: Date
  tilesInDiscard: number
  tilesInHands: number
  tilesToPlay: number
  roundNumber: number
  dealerSeat: number
}

/**
 * Host-only: build the deck, deal 13 to each seat, write the 4 per-player
 * tile docs + deck doc + gameState doc atomically. Seat order is
 * [host, ...other 3 players]; winds are assigned east → south → west → north.
 *
 * The gameState write is the last batch op — its creation is what
 * InterstitialPage's onSnapshot listens for to redirect every tab to /game.
 */
export async function initGame(
  fsdb: Firestore,
  roomId: string,
  host: SeatInput,
  others: SeatInput[],
): Promise<void> {
  if (others.length !== 3) {
    throw new Error(`initGame requires 3 non-host players, got ${others.length}`)
  }

  const deck: Tile[] = buildDeck()
  const seats: SeatInput[] = [host, ...others]

  const gameState: GameStateDoc = {
    roomId,
    host: host.uid,
    players: [],
    windCount: 0,
    currentWind: 'east',
    currentPlayer: 0,
    currentTurnNo: 0,
    currentHouse: 'east',
    diceRolled: 0,
    timeStarted: new Date(),
    tilesInDiscard: 0,
    tilesInHands: 0,
    tilesToPlay: 148,
  roundNumber: 1,
    dealerSeat: 0,
  }

  const onDraw = () => {
    gameState.tilesInHands += 1
    gameState.tilesToPlay -= 1
  }

  const players: Player[] = seats.map((seat, i) =>
    makePlayer({
      id: seat.uid,
      name: seat.displayName,
      wind: WIND_TILES[i],
      playerNumber: i,
    }),
  )

  for (const p of players) drawTile(p, 13, deck, onDraw)

  gameState.players = players.slice(1).map((p) => ({
    playerId: p.id,
    playerWind: p.wind,
  }))

  const batch = writeBatch(fsdb)

  for (const p of players) {
    const metaRef = doc(fsdb, 'games', roomId, 'players', p.id)
    batch.set(metaRef, {
      id: p.id,
      name: p.name,
      wind: p.wind,
      chips: p.chips,
      playerNumber: p.playerNumber,
      currentScore: p.currentScore,
    })

    const handRef = doc(fsdb, 'games', roomId, 'players', p.id, 'tiles', 'playerHand')
    batch.set(handRef, { playerHand: p.playerHand })

    const checkedRef = doc(fsdb, 'games', roomId, 'players', p.id, 'tiles', 'playerChecked')
    batch.set(checkedRef, { playerChecked: p.playerChecked, playerMelds: p.playerMelds })

    const discardedRef = doc(fsdb, 'games', roomId, 'players', p.id, 'tiles', 'playerDiscarded')
    batch.set(discardedRef, { playerDiscarded: p.playerDiscarded })
  }

  const deckRef = doc(fsdb, 'games', roomId, 'deck', 'deckInPlay')
  batch.set(deckRef, { deckInPlay: deck })

  // gameState last so the InterstitialPage redirect listener fires only after
  // every other doc is in place.
  const gameStateRef = doc(fsdb, 'games', roomId, 'gameState', roomId)
  batch.set(gameStateRef, gameState)

  await batch.commit()
}
