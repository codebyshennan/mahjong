class Player {
  // push this into database
  /**
   * Creates an instance of Player.
   * @param {*} name
   * @param {*} wind
   * @param {*} playerNumber
   * @memberof Player
   */
  constructor(uid, name, wind, playerNumber, chips = 1000, playerHand = [], playerDiscarded = [], playerChecked = [], currentScore = 0){
    this.id = uid
    this.name = name 
    this.wind = wind
    this.chips = chips
    this.playerNumber = playerNumber
    this.playerHand = playerHand
    this.playerChecked = playerChecked
    this.playerDiscarded = playerDiscarded
    this.currentScore = currentScore
    }

  /**
   *
   *
   * @param {*} arrayOfTileNames
   * @param {*} type
   * @memberof Player
   */
  highlightTilesToBeMergedWith = (arrayOfTileNames, type) => {
    arrayOfTileNames.forEach((tilename,index) => {
      const tiles = document.querySelectorAll(`.${tilename}`)
      const idx = tiles.length > 1 ? index : 0
      tiles[idx].classList.add(`'${type}'`)
      tiles[idx].style.border = '2px solid red'
    })
  }

  
  /**
   *
   *
   * @param {*} playerHand
   * @memberof Player
   */
  tallyByName = (playerHand) => {
    const sortedHand = sortHand(playerHand, 'name')
      // tally hand by name
    let playerHandTally = {}

    // get statistics about hand
    for(let i=0; i< sortedHand.length; i++){
      if(playerHandTally[sortedHand[i].name]){
        playerHandTally[sortedHand[i].name] +=1
      } else {
        playerHandTally[sortedHand[i].name] =1
      }
    }

    return playerHandTally;
  }

  /**
   *
   *
   * @param {number} [noOfTiles=1]
   * @param {string} [type='normal']
   * @memberof Player
   */
  drawTile = (noOfTiles = 1, type = 'normal') => {
    // deck.shift for normal draws
    // deck.pop for flowers

    for(let drawCount = 0; drawCount < noOfTiles; drawCount+=1) {
      let newTile
      if(type == 'normal') {
        newTile = deckInPlay.shift()
      } else if(type == 'special') {
        console.log('Drawing special...')
        newTile = deckInPlay.pop()
      }

      if(ANIMAL_TILES.includes(newTile.name) || FLOWER_TILES.includes(newTile.name)) {
        console.log('Special drawn...')
        this.playerChecked.push(newTile)
        this.drawTile(1,'special')
      } else {
        this.playerHand.push(newTile)
      }

      updateGameState('drawtiles')
    }
  }

  
  /**
   *
   *
   * @param {*} tile
   * @memberof Player
   */
  discardTile = (tile) => {
    // find the index of the tile in the player's hand
    console.log('Discarding tile ', tile)
    const tileIndex = this.playerHand.findIndex(playerTile => playerTile.index == tile.index)
    const discardedTile = this.playerHand.splice(tileIndex, 1)
    this.playerDiscarded.push(discardedTile[0])

    timer.clearAll()
    updateGameState('discardtiles')
    updateGameState('nextround')
    commitPlayerHand(this)
  }

  /**
   *
   *
   * @param {*} tile
   * @param {*} withThisCombi
   * @memberof Player
   */
  eatTile = (eatFromPlayer, tile, withThisCombi) => {
    console.log(`Adding ${tile.name} to checked`)
  
    let checkedGroup = []
    checkedGroup.push(tile)
    eatFromPlayer.pop()

    withThisCombi.forEach(tileName => {
      const tileToBeChecked = this.playerHand.find(tile=> tile.name == tileName)
      const tileIndex = this.playerHand.findIndex(tile => tile.name == tileName)
      this.playerHand.splice(tileIndex,1)
      checkedGroup.push(tileToBeChecked)
    })

    this.playerChecked.push(sortHand(checkedGroup))

    timer.clearAll()
    updateGameState('eattiles')
    renderBoard()
  }

  /**
   *
   *
   * @memberof Player
   */
  skipTurn = () => {
    const currentPlayerHand = this.playerHand
    const randomIndex = Math.floor(currentPlayerHand.length * Math.random())
    const randomTile = currentPlayerHand[randomIndex]
    this.discardTile(randomTile)
  }

  /**
   *
   *
   * @memberof Player
   */
  showSimplifiedHand = () => {
    return this.playerHand.map( tile => {
      
      const name = tile.name
      const index = tile.index
      const simplifiedObj = { name, index}

      return simplifiedObj
    })
  }

  /**
   *
   *
   * @param {*} discardedTile
   * @memberof Player
   */
  checkIfCanBeEaten = (discardedTile) => {
    const playerTally = this.tallyByName(this.playerHand)
    console.log('TALLY BY NAME: ', playerTally)
    // check if the discarded tile can complete a set of non-sequential tiles i.e. NOT tiles with numbers
    if(discardedTile.index > 108) {
      if (playerTally[discardedTile.name] >= 2 ) {
        possibleMergeCombinations.push([discardedTile.name, discardedTile.name])
        this.highlightTilesToBeMergedWith([discardedTile.name],'same')
        return true
      }
      // highlight the tiles to be eaten
    } else {
      // deconstruct the discarded tile (numbered) to get the name and number
      let hasOutcome = false
      const discardedTileChar = discardedTile.name.substr(0,1) 
      const discardedTileNo = +discardedTile.name.substr(1,1)

      // if the discardedtile can complete a pair of duplicates or if the discardedtile can form part of a sequence e.g. X,_,_ || _,X,_ || _,_,X
      if (playerTally[discardedTile.name] == 2) {
        possibleMergeCombinations.push([discardedTile.name, discardedTile.name])
        this.highlightTilesToBeMergedWith([discardedTile.name],'same')
        hasOutcome = true
      } 
      if (playerTally[discardedTileChar+(discardedTileNo+1)] && playerTally[discardedTileChar+(discardedTileNo+2)]) {
        console.log(' X , _ , _ ')
        possibleMergeCombinations.push([discardedTileChar+(discardedTileNo+1), discardedTileChar+(discardedTileNo+2)])
        this.highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo+1),discardedTileChar+(discardedTileNo+2)],'first')
        hasOutcome = true
      } 
      if (playerTally[discardedTileChar+(discardedTileNo-1)] && playerTally[discardedTileChar+(discardedTileNo+1)]) {
        console.log(' _ , X , _ ')
        possibleMergeCombinations.push([discardedTileChar+(discardedTileNo-1), discardedTileChar+(discardedTileNo+1)])
        this.highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo-1),discardedTileChar+(discardedTileNo+1)],'middle')
        hasOutcome = true
      } 
      if (playerTally[discardedTileChar+(discardedTileNo-1)] && playerTally[discardedTileChar+(discardedTileNo-2)]) {
        console.log(' _ , _ , X ')
        possibleMergeCombinations.push([discardedTileChar+(discardedTileNo-1), discardedTileChar+(discardedTileNo-2)])
        this.highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo-1),discardedTileChar+(discardedTileNo-2)],'last')
        hasOutcome = true
      }
      return hasOutcome
    }
  }
}


export default Player