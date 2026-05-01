import sortHand from '../../utils/sorthand.js'
import { refDeck } from '../../utils/makeDeck.js'
import {timer, startTimer} from '../../utils/timer.js'
import { WIND_TILES, ANIMAL_TILES, FLOWER_TILES} from './tileset.js'
import { checkWin } from '../../utils/winCheck.js'
import { auth, rtdb, fsdb } from '../../firebase-init.js'
export { fsdb }
import { startDBSync } from '../../presence.js'
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { ref, push, set, onChildAdded } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, query, where, serverTimestamp as fsServerTimestamp, writeBatch} from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'
import { playerMetaInfoConverter, playerCheckedConverter, playerHandConverter, playerDiscardedConverter } from './converters.js'



// STARTUP THE APPLICATION
window.addEventListener('DOMContentLoaded', async () => {
  

  let deckInPlay, currentPlayer
  let possibleMergeCombinations = []
  let loggedInUser = {}
  let lastCheckedTileIndex = null
  
  const chineseChars = {
    'east': "东",
    'south': "南",
    'west': "西",
    'north': "北",
  }
  
  const sendButton = document.getElementById('send-chat')
  const messageField = document.getElementById('chat-message')
  const messages = document.getElementById('chat-messages')
  const timerDisplay = document.getElementById('timer')

  // SETUP LISTENERS FOR RESPECTIVE PLAYERS CHECKED AND DISCARDED (don't listen to their main hands (always 13-14))
  let mainPlayerHandRef, mainPlayerMetaRef
  let mainPlayerCheckedRef, rightPlayerCheckedRef, topPlayerCheckedRef,leftPlayerCheckedRef
  let mainPlayerDiscardRef, rightPlayerDiscardRef, topPlayerDiscardRef,leftPlayerDiscardRef
  let checkedRefs = [rightPlayerCheckedRef, topPlayerCheckedRef, leftPlayerCheckedRef]
  let discardRefs = [rightPlayerDiscardRef, topPlayerDiscardRef, leftPlayerDiscardRef]

  // GET GAME STATE AND SET THE CONTAINERS FOR EACH PLAYER
  // in the following sequence: right, top, left, main
  const playersDiv = [...document.querySelectorAll('.players')]
  const playerWind = [...document.querySelectorAll('.playerWind')]
  const gameStateRef = doc(fsdb, 'games', roomId, 'gameState', roomId)
    let gameState = (await getDoc(gameStateRef)).data()


  /**
   *
   * commits the current player hand into firestore
   * @param {*} player
   * @param {*} gameState
   */
  const commitPlayerHandToFS = async (player, gameState) => {
    const initBatch = writeBatch(fsdb)
    initBatch.set(mainPlayerMetaRef, player)
    initBatch.set(mainPlayerHandRef, player)
    initBatch.set(mainPlayerCheckedRef, player)
    initBatch.set(mainPlayerDiscardRef, player)
    initBatch.set(gameStateRef, gameState)
    await initBatch.commit()
  }

  /**
   * creates a player instance to store the player meta-information
   * provides helper functions to manipulate player hand
   * @class Player
   */
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
     * Provides a clean and clear tally of the player's current hand status by tile name
     * 
     * @param {*} playerHand
     * @memberof Player
     */
    tallyByName = () => {
      const sortedHand = sortHand(this.playerHand, 'name')
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
     * Draws a tile from the deck
     * TODO: deck.drawTile(player)
     * @param {number} [noOfTiles=1]
     * @param {string} [type='normal']
     * @memberof Player
     */
    drawTile = (noOfTiles = 1, type = 'normal') => {
      for(let drawCount = 0; drawCount < noOfTiles; drawCount+=1) {
        let newTile = type === 'special' ? deckInPlay.pop() : deckInPlay.shift()

        if (!newTile) {
          console.warn('Deck exhausted — draw game')
          return
        }

        // Auto-check flowers/animals and draw replacements iteratively (no recursion)
        while(ANIMAL_TILES.includes(newTile.name) || FLOWER_TILES.includes(newTile.name)) {
          this.playerChecked.push(newTile)
          updateGameState(gameState, 'drawtiles')
          newTile = deckInPlay.pop()
          if (!newTile) {
            console.warn('Deck exhausted during flower replacement')
            return
          }
        }

        this.playerHand.push(newTile)
        updateGameState(gameState, 'drawtiles')
      }
      renderPlayerTiles(this.playerHand, this.playerChecked, this.playerDiscarded)
    }

    
    /**
     *
     * Discards a particular tile within a player's hand
     * Returns a Boolean value to indicate success
     * @param {*} tile
     * @memberof Player
     */
    discardTile = (tile) => {
      // find the index of the tile in the player's hand
      console.log('Discarding tile ', tile)
      const tileIndex = this.playerHand.findIndex(playerTile => playerTile.index == tile.index)
      if(tileIndex<0) {
        console.log("Tile not found within the player's hand")
        return false;
      } else {
        const discardedTile = this.playerHand.splice(tileIndex, 1)
        this.playerDiscarded.push(discardedTile[0])
        return true;
      }
    }

    /**
     *
     * Takes in a tile and adds in to the player's hand
     * @param {*} tile
     * @param {*} withThisCombi
     * @memberof Player
     */
    eatTile = (tile, withThisCombi) => {
      console.log(`Adding ${tile.name} to checked`)
    
      let checkedGroup = []
      checkedGroup.push(tile)

      withThisCombi.forEach(tileName => {
        const tileToBeChecked = this.playerHand.find(tile=> tile.name == tileName)
        const tileIndex = this.playerHand.findIndex(tile => tile.name == tileName)
        this.playerHand.splice(tileIndex,1)
        checkedGroup.push(tileToBeChecked)
      })

      sortHand(checkedGroup).forEach(t => this.playerChecked.push(t))
    }

    /**
     *
     * Displays a simplfied version of the player hand
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
     * processes the tile and checks if the tile can be eaten as part of a sequence or a triple
     * @param {*} discardedTile
     * @memberof Player
     */
    checkIfCanBeEaten = (discardedTile) => {
     
      /**
       *
       * Highlight the players tiles that can be merged with the combinations within
       * @param {*} arrayOfTileNames
       * @param {*} type
       * @memberof Player
       */
      const highlightTilesToBeMergedWith = (arrayOfTileNames, type) => {
        arrayOfTileNames.forEach((tilename,index) => {
          const tiles = document.querySelectorAll(`.${tilename}`)
          const idx = tiles.length > 1 ? index : 0
          tiles[idx].classList.add(type)
          tiles[idx].style.border = '2px solid red'
        })
      }

      
      const playerTally = this.tallyByName(this.playerHand)
      console.log('TALLY BY NAME: ', playerTally)
      // check if the discarded tile can complete a set of non-sequential tiles i.e. NOT tiles with numbers
      if(discardedTile.index > 108) {
        if (playerTally[discardedTile.name] >= 2 ) {
          possibleMergeCombinations.push([discardedTile.name, discardedTile.name])
          highlightTilesToBeMergedWith([discardedTile.name],'same')
          return true
        }
        // highlight the tiles to be eaten
        return false
      } else {
        // deconstruct the discarded tile (numbered) to get the name and number
        let hasOutcome = false
        const discardedTileChar = discardedTile.name.substr(0,1) 
        const discardedTileNo = +discardedTile.name.substr(1,1)

        // if the discardedtile can complete a pair of duplicates or if the discardedtile can form part of a sequence e.g. X,_,_ || _,X,_ || _,_,X
        if (playerTally[discardedTile.name] >= 2) {
          possibleMergeCombinations.push([discardedTile.name, discardedTile.name])
          highlightTilesToBeMergedWith([discardedTile.name],'same')
          hasOutcome = true
        } 
        if (playerTally[discardedTileChar+(discardedTileNo+1)] && playerTally[discardedTileChar+(discardedTileNo+2)]) {
          console.log(' X , _ , _ ')
          possibleMergeCombinations.push([discardedTileChar+(discardedTileNo+1), discardedTileChar+(discardedTileNo+2)])
          highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo+1),discardedTileChar+(discardedTileNo+2)],'first')
          hasOutcome = true
        } 
        if (playerTally[discardedTileChar+(discardedTileNo-1)] && playerTally[discardedTileChar+(discardedTileNo+1)]) {
          console.log(' _ , X , _ ')
          possibleMergeCombinations.push([discardedTileChar+(discardedTileNo-1), discardedTileChar+(discardedTileNo+1)])
          highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo-1),discardedTileChar+(discardedTileNo+1)],'middle')
          hasOutcome = true
        } 
        if (playerTally[discardedTileChar+(discardedTileNo-1)] && playerTally[discardedTileChar+(discardedTileNo-2)]) {
          console.log(' _ , _ , X ')
          possibleMergeCombinations.push([discardedTileChar+(discardedTileNo-1), discardedTileChar+(discardedTileNo-2)])
          highlightTilesToBeMergedWith([discardedTileChar+(discardedTileNo-1),discardedTileChar+(discardedTileNo-2)],'last')
          hasOutcome = true
        }
        return hasOutcome
      }
    }
  }  


  const skipTurn = (player) => {
      const currentPlayerHand = player.playerHand
      const randomIndex = Math.floor(currentPlayerHand.length * Math.random())
      const randomTile = currentPlayerHand[randomIndex]
      player.discardTile(randomTile)
      
      timer.clearAll()
      updateGameState(gameState,'discardtiles')
      updateGameState(gameState,'nextround')
      renderPlayerTiles(player.playerHand,player.playerChecked, player.playerDiscarded)
      commitPlayerHandToFS(player, gameState)
    }

  // TODO: push this back to the browser
  document.getElementById('logout').addEventListener('click', (ev)=> {
    ev.preventDefault()
    signOut(auth).then(()=> {
      window.location.pathname ='/login'
    })
  })

  
  /**
   * Synchronizes the online/offline status of the user between the RTDB and FS
   *
   * @param {*} loggedInUser
   */

  /**
   * Displays the players own tiles in his own playing field
   *
   * @param {*} hand
   * @param {*} check
   * @param {*} discard
   */
  const renderPlayerTiles = (hand, check, discard) => {
    const playerHand = document.getElementById('playerHand');
    const playerChecked = document.getElementById('playerChecked');
    const playerDiscardPile = document.getElementById('playerDiscardPile') 
    playerChecked.innerText = ''
    playerHand.innerText = ''
    playerDiscardPile.innerText = ''

    // RENDER PLAYER HAND
    if(hand.length>0) {
      hand.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.classList.add('tile', playerTile.name)
        tileContainer.id = playerTile.index
        tileContainer.addEventListener('click', (ev)=> {
          // immediately disable the clicking of other tiles
          if(gameState.currentPlayer == currentPlayer.playerNumber) {
            // discardTile(ev.target)
            const tileIndex = ev.currentTarget.id
            const tileToBeRemoved = hand.find(tile=> tile.index == tileIndex)
            currentPlayer.discardTile(tileToBeRemoved)

            timer.clearAll()
            updateGameState(gameState,'discardtiles')
            updateGameState(gameState,'nextround')
            gameState.awaitingDiscard = false
            renderPlayerTiles(currentPlayer.playerHand,currentPlayer.playerChecked, currentPlayer.playerDiscarded)
            commitPlayerHandToFS(currentPlayer, gameState)
            
          }
        })
        const tileImg = document.createElement('img')
        tileImg.src = playerTile.url;
        tileContainer.appendChild(tileImg)
        playerHand.appendChild(tileContainer)
      })

      check.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.classList.add('tile')
        const tileImg = document.createElement('img')
        tileImg.src = playerTile.url;
        tileContainer.appendChild(tileImg)
        playerChecked.appendChild(tileContainer)
      })

      discard.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.id = playerTile.index
        tileContainer.classList.add('tile')
        const tileImg = document.createElement('img')
        tileImg.src = playerTile.url
        tileContainer.appendChild(tileImg)

        // insert into the dropzone randomly      
        playerDiscardPile.appendChild(tileContainer)
      })
    }
  }

  /**
   * Identifies where the opponent sits, and render his checked and discarded tiles
   *
   * @param {*} destination
   * @param {*} tiles
   */
  const renderOpponentTiles = (destination, tiles) => {
    // reset
    destination.innerHTML = ''
      
    tiles.forEach(tile => {
      const tileContainer = document.createElement('div')
      tileContainer.classList.add('tile')
      const tileImg = document.createElement('img')
      tileImg.src = tile.url
      tileContainer.appendChild(tileImg)
      destination.appendChild(tileContainer)
    })
  }

  // GETS THE USER DETAILS AND RENDERS THE PAGE BASED ON DATA REFERENCING USERID
  onAuthStateChanged(auth, async (user)=>{
    if(user) {
    // Retrieves the user details based on his authstate
        loggedInUser['displayName'] = user.displayName;
        loggedInUser['uid'] = user.uid;
        loggedInUser['photoURL'] = user.photoURL;
        const userName = document.getElementById('userName');
        userName.innerText = `Welcome ${user.displayName}`
        startDBSync(loggedInUser, `status/${roomId}/players`)
        
      if(gameState.host == user.uid) {
        playersDiv[3].id = gameState.host
        playerWind[3].innerText = chineseChars[gameState.currentWind]
        playerWind[3].id = gameState.currentWind
        mainPlayerHandRef = doc(fsdb,'games', roomId,'players', user.uid, 'tiles','playerHand').withConverter(playerHandConverter)
        mainPlayerCheckedRef = doc(fsdb,'games', roomId, 'players', user.uid,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
        mainPlayerDiscardRef = doc(fsdb,'games', roomId, 'players', user.uid,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
        mainPlayerMetaRef = doc(fsdb, 'games', roomId, 'players', user.uid).withConverter(playerMetaInfoConverter)
        
        for (let windCount = 0; windCount < 3; windCount +=1) {
          playersDiv[windCount].id = gameState.players[windCount].playerId
          playerWind[windCount].innerText = chineseChars[gameState.players[windCount].playerWind]
          playerWind[windCount].id = gameState.players[windCount].playerWind
          checkedRefs[windCount] = doc(fsdb,'games', roomId, 'players', gameState.players[windCount].playerId,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
          discardRefs[windCount] = doc(fsdb,'games', roomId, 'players', gameState.players[windCount].playerId,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
        }
      } else {
        // guestsAnswering()
        const mainPlayer = gameState.players.filter(player => player.playerId == user.uid)
        playersDiv[3].id = mainPlayer[0].playerId;
        playerWind[3].innerText = chineseChars[mainPlayer[0].playerWind]
        playerWind[3].id = mainPlayer[0].playerWind
        mainPlayerHandRef = doc(fsdb,'games',roomId,'players',mainPlayer[0].playerId,'tiles','playerHand').withConverter(playerHandConverter)
        mainPlayerMetaRef = doc(fsdb, 'games', roomId, 'players', mainPlayer[0].playerId).withConverter(playerMetaInfoConverter)
        mainPlayerCheckedRef = doc(fsdb,'games', roomId, 'players', mainPlayer[0].playerId,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
        mainPlayerDiscardRef = doc(fsdb,'games', roomId, 'players', mainPlayer[0].playerId,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
        const mainPlayerWind = mainPlayer[0].playerWind
        const playerWindIndex = WIND_TILES.indexOf(mainPlayerWind)
        for(let windCount=0; windCount < 3; windCount+=1){
          
          const nextPlayer = gameState.players.filter(player => player.playerWind == WIND_TILES[(playerWindIndex+windCount+1)%4])
          
          if(nextPlayer.length==0) {
            playersDiv[windCount].id = gameState.host;
            playerWind[windCount].innerText = chineseChars[gameState.currentWind]
            playerWind[windCount].id = gameState.currentWind
            checkedRefs[windCount] = doc(fsdb,'games', roomId, 'players', gameState.host,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
            discardRefs[windCount] = doc(fsdb,'games', roomId, 'players', gameState.host,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
          } else{
            playersDiv[windCount].id = nextPlayer[0].playerId;
            playerWind[windCount].innerText = chineseChars[nextPlayer[0].playerWind]
            playerWind[windCount].id = nextPlayer[0].playerWind
            checkedRefs[windCount] = doc(fsdb,'games', roomId, 'players', nextPlayer[0].playerId,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
            discardRefs[windCount] = doc(fsdb,'games', roomId, 'players', nextPlayer[0].playerId,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
          }
        }
      }

      // RENDER PLAYER TILES
      const mainPlayerHand = (await getDoc(mainPlayerHandRef)).data()
      const mainPlayerChecked = (await getDoc(mainPlayerCheckedRef)).data()
      const mainPlayerDiscarded = (await getDoc(mainPlayerDiscardRef)).data()
      const metaInfo = (await getDoc(mainPlayerMetaRef)).data()
      renderPlayerTiles(mainPlayerHand, mainPlayerChecked, mainPlayerDiscarded)
      currentPlayer = new Player(metaInfo.id, metaInfo.name, metaInfo.wind, metaInfo.playerNumber, metaInfo.chips, mainPlayerHand, mainPlayerDiscarded, mainPlayerChecked, metaInfo.currentScore)

      // POPULATE SEAT LABELS (own + 3 opponents)
      document.getElementById('mainSeatLabel').textContent =
        `${currentPlayer.name} · ${chineseChars[currentPlayer.wind]}`

      const seatLabelIds = ['rightSeatLabel', 'topSeatLabel', 'leftSeatLabel']
      for(let i = 0; i < 3; i += 1) {
        const opponentUid = playersDiv[i].id
        const opponentWindKey = playerWind[i].id
        const opponentMetaRef = doc(fsdb, 'games', roomId, 'players', opponentUid)
                                  .withConverter(playerMetaInfoConverter)
        const opponentMeta = (await getDoc(opponentMetaRef)).data()
        if (opponentMeta) {
          document.getElementById(seatLabelIds[i]).textContent =
            `${opponentMeta.name} · ${chineseChars[opponentWindKey]}`
        }
      }

      // RENDER OTHER PLAYER TILES
      for(let i=0; i<3;i+=1){
        onSnapshot(checkedRefs[i], (snapshot)=> {
           // right,top, left
          const playerHands = ['rightPlayer','topPlayer','leftPlayer']
          const destination = document.getElementById(`${playerHands[i]}Checked`)
          renderOpponentTiles(destination, snapshot.data())
        })

         onSnapshot(discardRefs[i], (snapshot)=> {
          const discardTiles = snapshot.data()
           // right,top, left
          const playerHands = ['rightPlayer','topPlayer','leftPlayer']
          const destination = document.getElementById(`${playerHands[i]}Discard`)
          renderOpponentTiles(destination,discardTiles)

          if(discardTiles.length > 0 && gameState.currentPlayer != (currentPlayer.playerNumber+1)%4) {
            const lastDiscardedTile = discardTiles[discardTiles.length-1]
            if(lastDiscardedTile.index === lastCheckedTileIndex) return
            lastCheckedTileIndex = lastDiscardedTile.index

            possibleMergeCombinations = []
            const eatOptionsDiv = document.getElementById('eatOptions')
            eatOptionsDiv.innerHTML = ''

            if(currentPlayer.checkIfCanBeEaten(lastDiscardedTile)) {
              let set = new Set(possibleMergeCombinations.map(JSON.stringify))
              let possibleUniqueCombinations = Array.from(set).map(JSON.parse)

              // T6.3: only the player immediately right of the discarder can chow
              const canChow = currentPlayer.playerNumber === (gameState.currentPlayer + 1) % 4
              if (!canChow) {
                possibleUniqueCombinations = possibleUniqueCombinations.filter(combo => combo[0] === combo[1])
              }

              possibleUniqueCombinations.forEach(combo => {
                const eatBtn = document.createElement('button')
                eatBtn.className = 'waves-effect waves-light btn-small'
                for(const tileName of combo) {
                  eatBtn.textContent += refDeck()[tileName]
                }
                eatBtn.addEventListener('click', async () => {
                  currentPlayer.eatTile(lastDiscardedTile, combo)
                  renderPlayerTiles(currentPlayer.playerHand, currentPlayer.playerChecked, currentPlayer.playerDiscarded)
                  timer.clearAll()
                  updateGameState(gameState, 'eattiles')

                  // Eater becomes current player; awaitingDiscard tells the snapshot
                  // handler to skip the auto-draw — eater took from discard, just discards next.
                  gameState.currentPlayer = currentPlayer.playerNumber
                  gameState.awaitingDiscard = true

                  // Atomic: splice eaten tile from discarder's pile + write eater's
                  // state + write game state. Prevents tile-in-two-places bug.
                  try {
                    await runTransaction(fsdb, async (tx) => {
                      const discardSnap = await tx.get(discardRefs[i])
                      const pile = discardSnap.data() || []
                      if (pile.length > 0 && pile[pile.length - 1].index === lastDiscardedTile.index) {
                        pile.pop()
                      }
                      tx.set(discardRefs[i], { playerDiscarded: pile })
                      tx.set(mainPlayerMetaRef, currentPlayer)
                      tx.set(mainPlayerHandRef, currentPlayer)
                      tx.set(mainPlayerCheckedRef, currentPlayer)
                      tx.set(mainPlayerDiscardRef, currentPlayer)
                      tx.set(gameStateRef, gameState)
                    })
                  } catch (err) {
                    console.error('Eat-tile transaction failed:', err)
                  }

                  eatOptionsDiv.innerHTML = ''
                  lastCheckedTileIndex = null
                  const { win } = checkWin(currentPlayer.playerHand, currentPlayer.playerChecked)
                  if (win) showWinScreen('discard-win')
                })
                eatOptionsDiv.appendChild(eatBtn)
              })
            }
          }
        })
      }

      // render opponent hand backs (face-down jade tiles)
      for(let i=0; i<3;i+=1){
        const playerHands = ['rightPlayer','topPlayer','leftPlayer']
        const destination = document.getElementById(`${playerHands[i]}Hand`)
        for(let j=0; j<14;j+=1){
          const tileBack = document.createElement('div')
          tileBack.classList.add('tile', 'tile--back')
          tileBack.setAttribute('aria-hidden', 'true')
          destination.appendChild(tileBack)
        }
      }

      // DETERMINE NEXT COURSE OF ACTION FROM GAME STATE CHANGES
      onSnapshot(gameStateRef, async (snapshot)=> {
        let currentGameState = snapshot.data()

        if (currentGameState.winner) {
          timer.clearAll()
          if (!document.getElementById('winOverlay')) {
            showLossScreen(currentGameState.winner)
          }
          return
        }

        // clear eat options on new turn
        const eatOptionsDiv = document.getElementById('eatOptions')
        if(eatOptionsDiv) eatOptionsDiv.innerHTML = ''
        lastCheckedTileIndex = null

        // reset indicator colors
        const indicators = [...document.getElementById('playerControls').children]
        indicators.forEach(child => {
          child.style.backgroundColor = 'transparent'
        })

        const highlightWind = document.getElementById(`${WIND_TILES[currentGameState.currentPlayer]}`)
        highlightWind.parentNode.style.backgroundColor = 'tomato'

        const turnBanner = document.getElementById('turnBanner')
        if(currentPlayer.playerNumber === currentGameState.currentPlayer) {
          turnBanner.textContent = 'YOUR TURN'
          turnBanner.className = 'turn-banner turn-banner--active'
          addToChat('STATUS: ', 'YOUR TURN')
        } else {
          turnBanner.textContent = `${WIND_TILES[currentGameState.currentPlayer].toUpperCase()}'S TURN`
          turnBanner.className = 'turn-banner'
          addToChat('STATUS: ', `${WIND_TILES[currentGameState.currentPlayer].toUpperCase()} TURN`)
        }

        if(currentPlayer.playerNumber != currentGameState.currentPlayer) {
          return
        } else {
          startTimer(10, timerDisplay, () => skipTurn(currentPlayer))

          // If the eater just took from a discard, they don't draw — they discard next.
          if (currentGameState.awaitingDiscard) {
            return
          }

          // Otherwise: fresh turn. Draw a tile from the deck.
          const deckRef = doc(fsdb, 'games', roomId, 'deck','deckInPlay')
          deckInPlay = (await getDoc(deckRef)).data().deckInPlay
          currentPlayer.drawTile()
          await setDoc(deckRef, { deckInPlay: deckInPlay })
          renderPlayerTiles(currentPlayer.playerHand, currentPlayer.playerChecked, currentPlayer.playerDiscarded)
          const { win } = checkWin(currentPlayer.playerHand, currentPlayer.playerChecked)
          if (win) {
            timer.clearAll()
            showWinScreen('self-draw')
          }
        }

      })

    } else {
        // user is signed out
        window.location.pathname = '/login'
    }
  })



  // CHECK IF EVERYONE IS ONLINE
  const queryForUsers = query(collection(fsdb, 'status', roomId, 'players'), where('state','==','online'))
  onSnapshot(queryForUsers,(snapshot)=>{
    snapshot.docChanges().forEach((change)=> {
      if(change.type=="added") {
        const message = change.doc.data().displayName + ' is back online.'
        addToChat('STATUS: ', message)
      }

      if(change.type=="removed") {
        const message = change.doc.data().displayName + ' went offline.'
        addToChat('STATUS: ', message)
      }
    })
  })

  /**
   * Updates to the overall game state depending on the actions that were taken by a player
   *
   * @param {string} type
   * @param {number} [playerNumber=0]
   */
  const updateGameState = (gameState, type) => {

    // const updateGameLog = () =>{
    //   const gamelog = document.getElementById('gameLog')
    //   gamelog.innerText = JSON.stringify(gameState,null,2)
    // }

    switch (type) {
      case 'nextround':
        gameState.currentPlayer = ++gameState.currentPlayer % 4
        gameState.currentTurnNo++
        // updateGameLog()
        // startRound()
        break;

      case 'drawtiles':
        gameState.tilesInHands++
        gameState.tilesToPlay--
        // updateGameLog()
        break;

      case 'discardtiles':
        gameState.tilesInDiscard++
        gameState.tilesInHands--
        // updateGameLog()
        break;

      case 'eattiles':
        gameState.tilesInDiscard--
        gameState.tilesInHands++
        gameState.currentTurnNo++
        // updateGameLog()
        const timerDisplay = document.getElementById('timer')
        startTimer(10, timerDisplay, () => skipTurn(currentPlayer))
        break;

      case 'wingame':
        break;

      case 'gameover':
        timer.clearAll()
        // updateGameLog()
        break;

      default:
        // updateGameLog()
        break;
    }
  }

  
  const showWinScreen = (type) => {
    const overlay = document.createElement('div')
    overlay.id = 'winOverlay'
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:white;font-size:2rem;gap:1rem;'
    const msg = type === 'self-draw' ? '🀄 自摸！(Self Draw Win!)' : '🀄 胡！(Discard Win!)'
    const msgEl = document.createElement('div')
    msgEl.textContent = msg
    const playerEl = document.createElement('div')
    playerEl.style.fontSize = '1rem'
    playerEl.textContent = `Winner: ${currentPlayer.name}`
    overlay.appendChild(msgEl)
    overlay.appendChild(playerEl)
    document.body.appendChild(overlay)
    updateGameState(gameState, 'wingame')
    setDoc(gameStateRef, { winner: { uid: currentPlayer.id, name: currentPlayer.name, type } }, { merge: true })
    commitPlayerHandToFS(currentPlayer, gameState)
  }

  const showLossScreen = (winner) => {
    const overlay = document.createElement('div')
    overlay.id = 'winOverlay'
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:white;font-size:2rem;gap:1rem;'
    const msgEl = document.createElement('div')
    msgEl.textContent = '💀 Game Over!'
    const winnerEl = document.createElement('div')
    winnerEl.style.fontSize = '1rem'
    const winType = winner.type === 'self-draw' ? '自摸 (Self Draw)' : '胡 (Discard Win)'
    winnerEl.textContent = `${winner.name} wins by ${winType}`
    overlay.appendChild(msgEl)
    overlay.appendChild(winnerEl)
    document.body.appendChild(overlay)
  }

  /*
  CHAT FUNCTIONALITY
  */

  const chatRef = ref(rtdb, `games/${roomId}/chats/`)

  const addToChat = (name='', message) => {
    const item = document.createElement('li')
    const nameNode = document.createElement('strong')
    nameNode.textContent = name
    item.appendChild(nameNode)
    item.appendChild(document.createTextNode(' ' + message))
    const messageList = messages.querySelector('ul')
    messageList.appendChild(item)
    messages.scrollTop = messageList.scrollHeight;
  }

  const sendMessage = () => {
    const newMessage = {
      name: loggedInUser.displayName,
      message: messageField.value
    }
    messageField.value = ''
    set(push(chatRef), newMessage)
  }

  sendButton.addEventListener('click', sendMessage)

  messageField.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault()
      sendMessage()
    }
  })

  onChildAdded(chatRef, (snapshot)=> {
    const message = snapshot.val()
    addToChat(message.name, message.message)
  })

})

