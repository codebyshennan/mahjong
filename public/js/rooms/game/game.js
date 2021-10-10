import sortHand from '../../utils/sorthand.js'
import {timer, startTimer} from '../../utils/timer.js'
import diceRoll from '../../utils/diceroll.js'
import { WIND_TILES, ANIMAL_TILES, FLOWER_TILES} from './tileset.js'
import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { ref, serverTimestamp, onDisconnect, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, push, set, getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { collection, getDocs, doc, getDoc, setDoc, getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, serverTimestamp as fsServerTimestamp, writeBatch} from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'
import { playerMetaInfoConverter, playerCheckedConverter, playerHandConverter, playerDiscardedConverter } from './converters.js'

const chineseChars = {
  'east': "东",
  'south': "南",
  'west': "西",
  'north': "北",
}

const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
const rtdb = getDatabase(firebase)
export const fsdb = getFirestore(firebase)
connectAuthEmulator(auth, "http://localhost:9099")
connectDatabaseEmulator(rtdb, "localhost", 9000)
connectFirestoreEmulator(fsdb, "localhost", 8080)

window.addEventListener('DOMContentLoaded', async () => {
  
  let gameState
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
        renderBoard()
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


  document.getElementById('logout').addEventListener('click', (ev)=> {
    ev.preventDefault()
    signOut(auth).then(()=> {
      window.location.pathname ='/login'
    })
  })
  let mainPlayerCheckedRef,rightPlayerCheckedRef, topPlayerCheckedRef,leftPlayerCheckedRef
  let mainPlayerDiscardRef,rightPlayerDiscardRef, topPlayerDiscardRef,leftPlayerDiscardRef
  let checkedRefs =[rightPlayerCheckedRef, topPlayerCheckedRef, leftPlayerCheckedRef, mainPlayerCheckedRef]
  let discardRefs = [rightPlayerDiscardRef, topPlayerDiscardRef,leftPlayerDiscardRef, mainPlayerDiscardRef]
  // GET GAME STATE AND SET THE CONTAINERS FOR EACH
  // right, top, left, main
  const playersDiv = [...document.querySelectorAll('.players')]
  const playerWind = [...document.querySelectorAll('.playerWind')]
  const gameStateRef = doc(fsdb, 'games', roomId, 'gameState', roomId)
  console.log(roomId)
  const importGameState = (await getDoc(gameStateRef)).data()
  console.log(importGameState)
  if(importGameState.host == loggedInUser.uid) {
    playersDiv[3].id = importGameState.currentWind
    playerWind[3].innerText = chineseChars[importGameState.currentWind]
    checkedRefs[3] = doc(fsdb,'games', roomId, 'players', importGameState.host,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
    discardRefs[3] = doc(fsdb,'games', roomId, 'players', importGameState.host,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
    for (let windCount = 0; windCount < 3; windCount +=1) {
      playersDiv[windCount].id = importGameState.players[windCount].playerId
      playerWind[windCount].innerText = chineseChars[importGameState.players[windCount].playerWind]
      checkedRefs[windCount] = doc(fsdb,'games', roomId, 'players', importGameState.players[windCount].playerId,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
      discardRefs[windCount] = doc(fsdb,'games', roomId, 'players', importGameState.players[windCount].playerId,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
    }
  } else {
      const mainPlayer = importGameState.players.filter(player => player.playerId == loggedInUser.uid)
      playersDiv[3].id = mainPlayer[0].playerId;
      playerWind[3].innerText = chineseChars[WIND_TILES[mainPlayerIndex+1]]
      checkedRefs[3] = doc(fsdb,'games', roomId, 'players', mainPlayer[0].playerId,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
      discardRefs[3] = doc(fsdb,'games', roomId, 'players', mainPlayer[0].playerId,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
      const playerWind = mainPlayer[0].playerWind
      const playerWindIndex = WIND_TILES.indexOf(playerWind)
      for(let windCount=0; windCount < 3; windCount+=1){
        const nextPlayer = importGameState.players.filter(player => player.playerWind == WIND_TILES[playerWindIndex+windCount+1%4])
        if(nextPlayer.length==0) {
          checkedRefs[windCount] = doc(fsdb,'games', roomId, 'players', importGameState.host,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
          discardRefs[windCount] = doc(fsdb,'games', roomId, 'players', importGameState.host,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
        } else{
          checkedRefs[windCount] = doc(fsdb,'games', roomId, 'players', nextPlayer[0].playerId,'tiles', 'playerChecked').withConverter(playerCheckedConverter)
          discardRefs[windCount] = doc(fsdb,'games', roomId, 'players', nextPlayer[0].playerId,'tiles', 'playerDiscarded').withConverter(playerDiscardedConverter)
        }
      }
    }
  
  

  // GET RESPECTIVE PLAYERS REF
  const topPlayer = document.getElementById('topPlayer')
  const leftPlayer = document.getElementById('leftPlayer')
  const rightPlayer = document.getElementById('rightPlayer')
  const mainPlayer = document.getElementById('mainPlayer')


  const sendButton = document.getElementById('send-chat')
  const messageField = document.getElementById('chat-message')
  const messages = document.getElementById('chat-messages')

  // const GAME_STATE = { DICEROLL: 0, EAST: 1, SOUTH: 2, WEST: 3, NORTH: 4}

  let PLAYERS = []
  let possibleMergeCombinations = []
  let deckInPlay
  let loggedInUser = {}


  const startDBSync = (loggedInUser) => {
    // Create a reference to this user's specific status node.
    // This is where we will store data about being online/offline.
    const userStatusDatabaseRef = ref(rtdb, `/status/${roomId}/players/${loggedInUser.uid}`)

    // We'll create two constants which we will write to 
    // the Realtime database when this device is offline
    // or online.
    const isOfflineForDatabase = {
      displayName: loggedInUser.displayName,
          photoURL: loggedInUser.photoURL,
      status: 'offline',
      last_changed: serverTimestamp()
    }

    const isOnlineForDatabase = {
      displayName: loggedInUser.displayName,
          photoURL: loggedInUser.photoURL,
      status: 'online',
      last_changed: serverTimestamp()
    }

    // Create a reference to the special '.info/connected' path in 
    // Realtime Database. This path returns `true` when connected
    // and `false` when disconnected.
    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
      // if we're not currently connected, don't do anything
      if(snapshot.val() == false){
        return;
      }

      // if we are currently connected, then use the onDisconnect()
      // method to add a set which will; only trigger once this client has disconnected by
      // 1. closing the app 2. losing internet, or any other means.

      onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase)
        .then( ()=> {
          // the promise returned will resolve as soon as the server acknowledges the onDisconnect request,
          // NOT once we've actually disconnected:
          // https://firebase.google.com/docs/reference/js/firebase.database.OnDisconnect
          // we can now safely set ourselves as 'online' knowing that the server will mark us as offline once we lose connection 
          set(userStatusDatabaseRef, isOnlineForDatabase)
        })
    })

    // UPDATING FIRESTORE LOCAL CACHE
    const userStatusFirestoreRef = doc(fsdb, `/status/${roomId}/players/${loggedInUser.uid}`)

    // firestore uses a different server timestamp value, so we'll create two constants,
    // (same as the ones in the rtdb) for Firestore state

    const isOfflineForFirestore = {
      displayName: loggedInUser.displayName,
          photoURL: loggedInUser.photoURL,
      state: 'offline',
      last_changed: fsServerTimestamp(),
    }

    const isOnlineForFirestore = {
      displayName: loggedInUser.displayName,
          photoURL: loggedInUser.photoURL,
      state: 'online',
      last_changed: fsServerTimestamp(),
    }

    onValue(ref(rtdb, '.info/connected'), (snapshot)=> {
      if(snapshot.val() == false) {
        // instead of simply returning, we will set Firestore's state to offline
        // This ensures taht our firestore cache is aware of the switch to offline
        setDoc(userStatusFirestoreRef, isOfflineForFirestore)
        return 
      }

      onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase)
        .then(()=>{
          set(userStatusDatabaseRef, isOnlineForDatabase)

          // we'll also add firestore set here for when we come online
          setDoc(userStatusFirestoreRef, isOnlineForFirestore)
        })
    })

    onSnapshot(userStatusFirestoreRef, (doc)=> {
      const isOnline = doc.data().state == 'online'
      console.log('Is user online? ', isOnline)
    })
  }


  // newGame(12,'east')
  /**
   * Begins a new game instance
   *
   * @param {number} diceRolled
   * @param {string} house
   */
  const newGame = async(diceRolled=0, house=0) => {

    deckInPlay = buildDeck()
    
    PLAYERS = [
      // new Player('player1', 'east', 0),
      new Player('player2', 'north', 1),
      new Player('player3', 'west', 2),
      new Player('player4', 'south', 3)
    ]
    


    // listen to player tiles changes, especially their hand length and their discarded pile
    const otherPlayersDiscardedRef = query(collection(fsdb,'games', roomId, 'players'), where('id', '!=', loggedInUser.uid))
    onSnapshot(otherPlayersDiscardedRef, (querySnapshot) => {
      console.log(querySnapshot.docChanges())
      querySnapshot.docChanges().forEach(change=>{
          // no matter the type of change we'd want to rerender the board
          // get the player id of the player who committed the addition
          console.log(change.doc.data().id)
          console.log(change.doc.data().playerDiscarded)
          // how to eat this tile
          // remove from competitor hand
          // put into own hand
      })
    })
  }

  /**
   * Begins a new round
   *
   */
  const startRound = () => {
    // shift indicator to current player
    const currentPlayer = PLAYERS[gameState.currentPlayer]
    currentPlayer.drawTile()
    updateGameState('drawtiles')
    const timerDisplay = document.getElementById('timer')
    startTimer(10, timerDisplay, currentPlayer.skipTurn)
  }


  onAuthStateChanged(auth, async (user)=>{
    if(user) {
    // loggedInUser[accessToken] = await user.accessToken;
        loggedInUser['displayName'] = user.displayName;
        loggedInUser['uid'] = user.uid;
        loggedInUser['photoURL'] = user.photoURL;
        const userName = document.getElementById('userName');
        userName.innerText = `Welcome ${user.displayName}`
        startDBSync(loggedInUser)
        const gameRoomRef = doc(fsdb, 'lobby', roomId)
        const gamePlayers = (await getDoc(gameRoomRef)).data()
        if(gamePlayers.host.uid == user.uid) {
          loggedInUser['playerWind'] = gamePlayers.host.uid
        } else {
          loggedInUser['playerWind'] = gamePlayers.players.filter(player=> player.uid == user.uid)['playerWind']
        }

        // retrieve gamestate
        newGame()
        startRound()
      } else {
        // user is signed out
        // window.location.pathname = '/login'
    }
  })

    const chatRef = ref(rtdb, `games/${roomId}/chats/`)

    const addToChat = (name='', message) => {
      const item = document.createElement('li')
      item.innerHTML = `<strong>${name}</strong> ${message}`

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

    onChildAdded(chatRef, (snapshot)=> {
      const message = snapshot.val()
      addToChat(message.name, message.message)
    })


  // CHECK IF EVERYONE IS ONLINE
  const queryForUsers = query(collection(fsdb, 'status', roomId, 'players'), where('state','==','online'))
  onSnapshot(queryForUsers,(snapshot)=>{
    snapshot.docChanges().forEach((change)=> {
      if(change.type=="added") {
        onlinePlayerCount +=1
        const message = 'User ' + change.doc.id + ' is online.'
        console.log(message)
        addToChat(message)
      }

      if(change.type=="removed") {
        onlinePlayerCount -=1
        const message = 'User ' + change.doc.id + ' is offline.'
        console.log(message)
        addToChat(message)
      }
    })
  })

  /**
   * Updates to the overall game state depending on the actions that were taken by a player
   *
   * @param {string} type
   * @param {number} [playerNumber=0]
   */
  const updateGameState = (type, playerNumber = 0) => {

    // const updateGameLog = () =>{
    //   const gamelog = document.getElementById('gameLog')
    //   gamelog.innerText = JSON.stringify(gameState,null,2)
    // }

    switch (type) {
      case 'nextround':
        ++gameState.windCount
        gameState.currentWind = WIND_TILES[gameState.windCount%4]
        gameState.currentPlayer = ++gameState.currentPlayer % 4
        gameState.currentTurnNo++
        // updateGameLog()
        startRound()
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
        gameState.currentPlayer = playerNumber // TODO: need to change this to reflect the player who clicked
        gameState.currentTurnNo++
        // updateGameLog()
        const timerDisplay = document.getElementById('timer')
        startTimer(10, timerDisplay, PLAYERS[gameState.currentPlayer].skipTurn)
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


  /**
   * Renders the game board through DOM manipulation
   *
   */
  const renderBoard = ()=> {

    // // check game state
    // if(gameState.tilesToPlay == 15) {
    //   alert('GAME OVER')
    //   updateGameState('gameover')
    //   return
    // }

    // const currentHand = PLAYERS[0].playerHand
    // const currentChecked = PLAYERS[0].playerChecked.flat(2)
    // const playerDiscarded = PLAYERS[0].playerDiscarded
    // const playerHand = document.getElementById('playerHand');
    // const playerChecked = document.getElementById('playerChecked');
    // const playerDiscardPile = document.getElementById('playerDiscardPile') 
    // playerChecked.innerText=''
    // playerHand.innerText =''
    // playerDiscardPile.innerText = ''

    // // RENDER PLAYER HAND
    // if(currentHand.length>0) {
    //   currentHand.forEach(playerTile => {
    //     const tileContainer = document.createElement('div')
    //     tileContainer.classList.add('tile', playerTile.name)
    //     tileContainer.id = playerTile.index
    //     tileContainer.addEventListener('click', (ev)=> {
    //       // immediately disable the clicking of other tiles
    //       if(gameState.currentPlayer == 0 ) {
    //         // discardTile(ev.target)
    //         const tileIndex = ev.target.parentElement.id
    //         const tileToBeRemoved = currentHand.find(tile=> tile.index == tileIndex)
    //         PLAYERS[0].discardTile(tileToBeRemoved)
    //       }
    //     })
    //     const tileImg = document.createElement('img')
    //     tileImg.src = playerTile.url;
    //     tileContainer.appendChild(tileImg)
    //     playerHand.appendChild(tileContainer)
    //   })

    //   currentChecked.forEach(playerTile => {
    //     const tileContainer = document.createElement('div')
    //     tileContainer.classList.add('tile')
    //     const tileImg = document.createElement('img')
    //     tileImg.src = playerTile.url;
    //     tileContainer.appendChild(tileImg)
    //     playerChecked.appendChild(tileContainer)
    //   })

    //   playerDiscarded.forEach(playerTile => {
    //     const tileContainer = document.createElement('div')
    //     tileContainer.id = playerTile.index
    //     tileContainer.classList.add('tile')
    //     const tileImg = document.createElement('img')
    //     tileImg.src = playerTile.url
    //     tileContainer.appendChild(tileImg)

    //     // insert into the dropzone randomly      
    //     playerDiscardPile.appendChild(tileContainer)
    //   })
    // }


    // // RENDER PLAYER DISPLAY OF OPPONENT TILES (hidden)
    // for(let remainingPlayer = 0; remainingPlayer < PLAYERS.length-1; remainingPlayer +=1){
    //   const playerHands = ['leftPlayer','topPlayer','rightPlayer']
    //   const remainingPlayerHand = document.getElementById(`${playerHands[remainingPlayer]}Hand`);
    //   const remainingPlayerChecked = document.getElementById(`${playerHands[remainingPlayer]}Checked`);
    //   const playerDiscardPile = document.getElementById(`${playerHands[remainingPlayer]}Discard`)
    //   remainingPlayerChecked.innerText = ''
    //   remainingPlayerHand.innerText=''
    //   playerDiscardPile.innerText = ''
    //   const nextPlayerHand = PLAYERS[remainingPlayer+1].playerHand
    //   const nextPlayerChecked = PLAYERS[remainingPlayer+1].playerChecked
    //   const nextPlayerDiscarded = PLAYERS[remainingPlayer+1].playerDiscarded

    //   if(nextPlayerHand.length>0) {
    //     nextPlayerHand.forEach(playerTile => {
    //       const tileContainer = document.createElement('div')
    //       tileContainer.classList.add('tile')
    //       const tileImg = document.createElement('img')
    //       tileImg.style.backgroundColor = 'brown'
    //       tileContainer.appendChild(tileImg)
    //       remainingPlayerHand.appendChild(tileContainer)
    //     })
    //   }

    //   if(nextPlayerChecked.length > 0 ) {
    //     nextPlayerChecked.forEach(playerTile => {
    //       const tileContainer = document.createElement('div')
    //       tileContainer.classList.add('tile')
    //       const tileImg = document.createElement('img')
    //       tileImg.src = playerTile.url
    //       tileContainer.appendChild(tileImg)
    //       remainingPlayerChecked.appendChild(tileContainer)
    //     })
    //   }

    //   if(nextPlayerDiscarded.length > 0 ) {
    //     nextPlayerDiscarded.forEach(playerTile => {
    //       const tileContainer = document.createElement('div')
    //       tileContainer.classList.add('tile')
    //       const tileImg = document.createElement('img')
    //       tileImg.src = playerTile.url
    //       tileContainer.appendChild(tileImg)
    //       playerDiscardPile.appendChild(tileContainer)
    //     })
    //   }
    // }

    // // RENDER EAT POSSIBILITY
    
    // // reset merge combinations
    // possibleMergeCombinations = []
    // console.log(refDeck())

    // const playerControls = document.getElementById('playerControls').getElementsByClassName('content')[3]

    // // [0,2,3] -> [3,1,2]
    // const justDiscarded = PLAYERS[(gameState.currentPlayer+7) % 4].playerDiscarded
    //   // activate when discard pile is not empty and not player's own discard
    
    // if(justDiscarded.length > 0 && gameState.currentPlayer != 1  ) {
    //   console.log('CHECKING EAT POSSIBILITY')
    //   const lastDiscardedTile = justDiscarded[justDiscarded.length-1]
    //   if(PLAYERS[0].checkIfCanBeEaten(lastDiscardedTile)) {
        
    //     let set = new Set(possibleMergeCombinations.map(JSON.stringify))
    //     let possibleUniqueCombinations = Array.from(set).map(JSON.parse)

    //     // give the player options which one to eat
    //     possibleUniqueCombinations.forEach(combo => {
    //       const eatDiscardedTile = document.createElement('button')
    //       eatDiscardedTile.id = combo
    //       for(const tileName of combo) {
    //         eatDiscardedTile.textContent += refDeck()[tileName]
    //       }

    //       eatDiscardedTile.addEventListener('click', (ev)=> {
    //         // TODO: eat the tiles based on the combinations
    //         const tileCombiToCheck = ev.target.id.split(',')
    //         PLAYERS[0].eatTile(justDiscarded, lastDiscardedTile, tileCombiToCheck)
    //       })
    //       playerControls.appendChild(eatDiscardedTile)
    //     })
        

    //   } else {
    //     playerControls.innerText = "NOTHING TO EAT"
    //   }
    // }

  }

  renderBoard()
})