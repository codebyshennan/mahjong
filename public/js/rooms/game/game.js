import sortHand from '../../utils/sorthand.js'
import {timer, startTimer} from '../../utils/timer.js'
import diceRoll from '../../utils/diceroll.js'
import { WIND_TILES, ANIMAL_TILES, FLOWER_TILES} from './tileset.js'
import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { ref, serverTimestamp, onDisconnect, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, push, set, getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { collection, getDocs, doc, getDoc, setDoc, getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, serverTimestamp as fsServerTimestamp, writeBatch} from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'

const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
const rtdb = getDatabase(firebase)
export const fsdb = getFirestore(firebase)
connectAuthEmulator(auth, "http://localhost:9099")
connectDatabaseEmulator(rtdb, "localhost", 9000)
connectFirestoreEmulator(fsdb, "localhost", 8080)

window.addEventListener('DOMContentLoaded', async ()=> {
  document.getElementById('logout').addEventListener('click', (ev)=> {
    ev.preventDefault()
    signOut(auth).then(()=> {
      window.location.pathname ='/login'
    })
  })

  const sendButton = document.getElementById('send-chat')
  const messageField = document.getElementById('chat-message')
  const messages = document.getElementById('chat-messages')

const signout = ()=> {
  signOut(auth).then(()=> {
    window.location.pathname ='/login'
  })
}

// ROOM_ID is declared in upperscope
const roomId = ROOM_ID
const gameId = ROOM_ID
console.log(roomId)
// const GAME_STATE = { DICEROLL: 0, EAST: 1, SOUTH: 2, WEST: 3, NORTH: 4}

let PLAYERS = []
let possibleMergeCombinations = []
let deckInPlay
let onlinePlayerCount = 0

let gameState = {
        roomId: roomId,
        host: 0,
        windCount: 0,
        currentWind: 'east',
        currentPlayer: 0,
        currentTurnNo: 0,
        currentHouse: '',
        diceRolled: 0,
        timeStarted: new Date(),
        tilesInDiscard: 0,
        tilesInHands: 0,
        tilesToPlay: 148
      }



let loggedInUser = {}
let currentPlayer

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

  const updateGameLog = () =>{
    const gamelog = document.getElementById('gamelog')
    gamelog.innerText = JSON.stringify(gameState,null,2)
  }

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
const updateCurrentPlayerInfo = (id,name,wind,chips,playerNo) => {
  currentPlayer.id = id
  currentPlayer.name = name
  currentPlayer.wind = wind
  currentPlayer.chips = chips
  currentPlayer.playerNo = playerNo
}

const playerMetaInfoConverter = {
  toFirestore: (player) => {
    return {
      id: player.id,
      name : player.name ,
      wind : player.wind,
      chips : player.chips,
      playerNumber : player.playerNumber,
      currentScore : player.currentScore,
    }
  }, 
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data(options)
    updateCurrentPlayerInfo(data.id, data.name, data.wind, data.chips, data.playerNumber)
  }
}

const playerHandConverter = {
  toFirestore: (player)=> {
    return {
      playerHand: player.playerHand
    }
  },
  fromFirestore: (snapshot,options) => {
    const data = snapshot.data(options)
    return data.playerHand
  }
}

const playerDiscardedConverter = {
  toFirestore: (player)=> {
    return {
      playerDiscarded: player.playerDiscarded
    }
  },
  fromFirestore: (snapshot,options) => {
    const data = snapshot.data(options)
    return data.playerDiscarded
  }
}

const playerCheckedConverter = {
  toFirestore: (player)=> {
    return {
      playerChecked: player.playerChecked
    }
  },
  fromFirestore: (snapshot,options) => {
    const data = snapshot.data(options)
    return data.playerChecked
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