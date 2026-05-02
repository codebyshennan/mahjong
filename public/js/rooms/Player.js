import { ANIMAL_TILES, FLOWER_TILES } from './game/tileset.js'

class Player {
  constructor(uid, name, wind, playerNumber, chips = 1000, playerHand = [], playerDiscarded = [], playerChecked = [], currentScore = 0, playerMelds = []) {
    this.id = uid
    this.name = name
    this.wind = wind
    this.chips = chips
    this.playerNumber = playerNumber
    this.playerHand = playerHand
    this.playerChecked = playerChecked
    this.playerDiscarded = playerDiscarded
    this.currentScore = currentScore
    this.playerMelds = playerMelds
  }

  drawTile = (noOfTiles = 1, deck, updateGameState = () => {}) => {
    for (let drawCount = 0; drawCount < noOfTiles; drawCount += 1) {
      let newTile = deck.shift()
      if (!newTile) {
        console.warn('Deck exhausted')
        return
      }

      while (ANIMAL_TILES.includes(newTile.name) || FLOWER_TILES.includes(newTile.name)) {
        const meldKind = ANIMAL_TILES.includes(newTile.name) ? 'animal' : 'flower'
        this.playerChecked.push(newTile)
        this.playerMelds.push({ kind: meldKind, tiles: [newTile] })
        updateGameState('drawtiles')
        newTile = deck.pop()
        if (!newTile) {
          console.warn('Deck exhausted during flower replacement')
          return
        }
      }

      this.playerHand.push(newTile)
      updateGameState('drawtiles')
    }
  }
}

export default Player
