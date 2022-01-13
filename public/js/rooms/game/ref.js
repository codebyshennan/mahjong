
  
  // ONLY VISIBLE TO THE HOST
  const startGameInstance = async (roomId, hostId) => {
    let deckInPlay= buildDeck()
    let otherPlayers = []

    // update gameState
    /** @type {*} */
    let gameState = {
        roomId: roomId,
        host: hostId,
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
        tilesToPlay: 148
      }

    /**
   * Updates to the overall game state depending on the actions that were taken by a player
   *
   * @param {string} type
   * @param {number} [playerNumber=0]
   */
  const updateGameState = (type, playerNumber = 0) => {


    switch (type) {
      case 'drawtiles':
        gameState.tilesInHands++
        gameState.tilesToPlay--
        // updateGameLog()
        break;

      default:
        // updateGameLog()
        break;
    }
  }

// TODO: put this as a cloud function
    // wind and player no
    const playerGameInit = async (uid, displayName, wind, playerNo) => {
      // set the metainformation of the player within its own document
      const initBatch = writeBatch(fsdb)
      const playerMetaRef = doc(fsdb, 'games', roomId, 'players', uid)
                            .withConverter(playerMetaInfoConverter)
      const currentPlayer = new Player(uid, displayName, wind , playerNo)
      currentPlayer.drawTile(13)
      initBatch.set(playerMetaRef, currentPlayer)
      
      const playerHandRef = doc(fsdb, 'games', roomId, 'players', uid, 'tiles', 'playerHand')
                            .withConverter(playerHandConverter)
      initBatch.set(playerHandRef, currentPlayer)

      const playerCheckedRef = doc(fsdb, 'games', roomId, 'players', uid, 'tiles', 'playerChecked')
                              .withConverter(playerCheckedConverter)
      initBatch.set(playerCheckedRef, currentPlayer)

      const playerDiscardedRef = doc(fsdb, 'games', roomId, 'players', uid, 'tiles', 'playerDiscarded')
                                .withConverter(playerDiscardedConverter)
      initBatch.set(playerDiscardedRef, currentPlayer)

      await initBatch.commit()
    }

    const players = (await getDoc(doc(fsdb,'lobby', roomId))).data().players
    playerGameInit(loggedInUser.uid, loggedInUser.displayName, 'east',0)

    for(let count=0; count < 3; count+=1){
      playerGameInit(players[count].uid, players[count].displayName, WIND_TILES[count+1], count+1)
      otherPlayers.push({playerId: players[count].uid, playerWind: WIND_TILES[count+1]})
    }

    gameState.players = otherPlayers    

    const deckRef = doc(fsdb, 'games', roomId, 'deck', 'deckInPlay')
    await setDoc(deckRef, {"deckInPlay": deckInPlay})

    // get all the id of the players

    // return newGameState.id //generated id for the game state to be used as a subsequent reference
    const gameStateInit = doc(fsdb, 'games', roomId, 'gameState', roomId)
    await setDoc(gameStateInit, gameState)
  }


  const startUpProcedures = (gameInstance) => {
    addChatMessage('Transporting all players to Room Id: ', gameInstance)
    // write to database to create an instance of the game
    // use toastr to countdown instead
    setTimeout(()=>{
      addChatMessage('Game starting in', '3')
    },1000)
    setTimeout(()=>{
      addChatMessage('Game starting in', '2')
    },2000)
    setTimeout(()=>{
      addChatMessage('Game starting in', '1')
    },3000)
    setTimeout(()=>{
      window.location.pathname = `/game/${gameInstance}`
    },4000)
  }

})