import sortHand from '../../utils/sorthand.js'
import { refDeck } from '../../utils/makeDeck.js'
import {timer, startTimer} from '../../utils/timer.js'
import diceRoll from '../../utils/diceroll.js'
import { WIND_TILES, ANIMAL_TILES, FLOWER_TILES} from './tileset.js'
import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged, connectAuthEmulator, signOut } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { ref, serverTimestamp, onDisconnect, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, push, set, getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { collection, getDocs, doc, getDoc, setDoc, getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, serverTimestamp as fsServerTimestamp, writeBatch} from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'
import { playerMetaInfoConverter, playerCheckedConverter, playerHandConverter, playerDiscardedConverter } from './converters.js'

// toastr["success"]("<div><input class="input-small" value="textbox"/>&nbsp;<a href="http://johnpapa.net" target="_blank">This is a hyperlink</a></div><div><button type="button" id="okBtn" class="btn btn-primary">Close me</button><button type="button" id="surpriseBtn" class="btn" style="margin: 0 8px 0 8px">Surprise me</button></div>")
// for reference


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
  let gameState, deckInPlay, currentPlayer
  let possibleMergeCombinations = []
  let loggedInUser = {}
  
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

  // GET GAME STATE AND SET THE CONTAINERS FOR EACH
  // right, top, left, main
  const playersDiv = [...document.querySelectorAll('.players')]
  const playerWind = [...document.querySelectorAll('.playerWind')]
  const gameStateRef = doc(fsdb, 'games', roomId, 'gameState', roomId)


  const commitPlayerHand = async (player, gameState) => {
    const initBatch = writeBatch(fsdb)
    initBatch.set(mainPlayerMetaRef, player)
    initBatch.set(mainPlayerHandRef, player)
    initBatch.set(mainPlayerCheckedRef, player)
    initBatch.set(mainPlayerDiscardRef, player)
    initBatch.set(gameStateRef, gameState)
    await initBatch.commit()
  }

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
      renderPlayer(this.playerHand,this.playerChecked,this.playerDiscarded)
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
      renderPlayer(this.playerHand,this.playerChecked, this.playerDiscarded)
      commitPlayerHand(this, gameState)
    }

    /**
     *
     *
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

      this.playerChecked.push(sortHand(checkedGroup))

      renderPlayer(this.playerHand,this.playerChecked, this.playerDiscarded)

      timer.clearAll()
      updateGameState('eattiles')
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


  gameState = (await getDoc(gameStateRef)).data()
  console.log(gameState)

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

  const renderPlayer = (hand, check, discard) => {
    const playerHand = document.getElementById('playerHand');
    const playerChecked = document.getElementById('playerChecked');
    const playerDiscardPile = document.getElementById('playerDiscardPile') 
    playerChecked.innerText=''
    playerHand.innerText =''
    playerDiscardPile.innerText = ''

    // RENDER PLAYER HAND
    if(hand.length>0) {
      hand.forEach(playerTile => {
        const tileContainer = document.createElement('div')
        tileContainer.classList.add('tile', playerTile.name)
        tileContainer.id = playerTile.index
        tileContainer.addEventListener('click', (ev)=> {
          // immediately disable the clicking of other tiles
          if(gameState.currentPlayer == 0 ) {
            // discardTile(ev.target)
            const tileIndex = ev.target.parentElement.id
            const tileToBeRemoved = hand.find(tile=> tile.index == tileIndex)
            currentPlayer.discardTile(tileToBeRemoved)
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

  const renderOpponent = (destination, tiles) => {
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


  onAuthStateChanged(auth, async (user)=>{
    if(user) {
    // loggedInUser[accessToken] = await user.accessToken;
        loggedInUser['displayName'] = user.displayName;
        loggedInUser['uid'] = user.uid;
        loggedInUser['photoURL'] = user.photoURL;
        const userName = document.getElementById('userName');
        userName.innerText = `Welcome ${user.displayName}`
        startDBSync(loggedInUser)
        
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
      renderPlayer(mainPlayerHand, mainPlayerChecked, mainPlayerDiscarded)
      currentPlayer = new Player(metaInfo.id, metaInfo.name, metaInfo.wind, metaInfo.playerNumber, metaInfo.chips, mainPlayerHand, mainPlayerDiscarded, mainPlayerChecked, metaInfo.currentScore)
      // RENDER OTHER PLAYER TILES
      for(let i=0; i<3;i+=1){
        onSnapshot(checkedRefs[i], (snapshot)=> {
           // right,top, left
          const playerHands = ['rightPlayer','topPlayer','leftPlayer']
          const destination = document.getElementById(`${playerHands[i]}Checked`)
          renderOpponent(destination, snapshot.data())
        })

         onSnapshot(discardRefs[i], (snapshot)=> {
          const discardTiles = snapshot.data()
           // right,top, left
          const playerHands = ['rightPlayer','topPlayer','leftPlayer']
          const destination = document.getElementById(`${playerHands[i]}Discard`)
          renderOpponent(destination,discardTiles)

          if(discardTiles.length > 0 && gameState.currentPlayer != (currentPlayer.playerNumber+1)%4  ) {
            console.log('CHECKING EAT POSSIBILITY')
            const lastDiscardedTile = discardTiles[discardTiles.length-1]
            if(currentPlayer.checkIfCanBeEaten(lastDiscardedTile)) {
              
              let set = new Set(possibleMergeCombinations.map(JSON.stringify))
              let possibleUniqueCombinations = Array.from(set).map(JSON.parse)

              // give the player options which one to eat
              possibleUniqueCombinations.forEach(combo => {
                const eatDiscardedTile = document.createElement('button')
                eatDiscardedTile.id = combo
                for(const tileName of combo) {
                  eatDiscardedTile.textContent += refDeck()[tileName]
                }
                eatDiscardedTile.addEventListener('click', (ev)=> {
                  // TODO: eat the tiles based on the combinations
                  const tileCombiToCheck = ev.target.id.split(',')
                  currentPlayer.eatTile(lastDiscardedTile, tileCombiToCheck)
                })
                alertify.alert(eatDiscardedTile).setting({'modal': false}, {'basic': true}); 
                // toastr['info'](eatDiscardedTile)
              })
            } else {
              // toastr['warning']("Nothing to eat.")
              alertify.alert('Nothing to eat').setting({'modal': false}, {'basic': true}); 
            }
          }
        })
      }

      // render dummy tiles
      for(let i=0; i<3;i+=1){
        const playerHands = ['rightPlayer','topPlayer','leftPlayer']
        const destination = document.getElementById(`${playerHands[i]}Hand`)
        for(let j=0; j<14;j+=1){
          const tileContainer = document.createElement('div')
          tileContainer.classList.add('tile')
          const tileImg = document.createElement('img')
          tileImg.style.backgroundColor = 'limegreen'
          tileContainer.appendChild(tileImg)
          destination.appendChild(tileContainer)
        }
      }

      // DETERMINE NEXT COURSE OF ACTION FROM GAME STATE CHANGES
      onSnapshot(gameStateRef, async (snapshot)=> {
        let currentGameState = snapshot.data()
        addToChat('STATUS: ', `${WIND_TILES[currentGameState.currentPlayer].toUpperCase()} TURN`)

        // reset indicator colors
        const indicators = [...document.getElementById('playerControls').children]
        indicators.forEach(child => {
          child.style.backgroundColor = 'transparent'
        })

        const highlightWind = document.getElementById(`${WIND_TILES[currentGameState.currentPlayer]}`)
        highlightWind.parentNode.style.backgroundColor = 'tomato'
        if(currentPlayer.playerNumber != currentGameState.currentPlayer) {
          return
        } else {
          startTimer(10, timerDisplay, currentPlayer.skipTurn)
          // restart timer
          // display turn no to everyone
          // check if turn is own
          // if not, ignore and start timer

          // if it is, get the deck, draw a tile, and update the deck
          const deckRef = doc(fsdb, 'games', roomId, 'deck','deckInPlay')
          deckInPlay = (await getDoc(deckRef)).data().deckInPlay
          currentPlayer.drawTile()
        }

      })

    } else {
        // user is signed out
        window.location.pathname = '/login'
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
  const updateGameState = (gameState, type, playerNumber = 0) => {

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

})