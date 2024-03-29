// ref from https://github.com/markmandel/happy-angry-surprised/blob/master/html/js/chat.js
import { refDeck, buildDeck } from '../../utils/makeDeck.js'
import sortHand from '../../utils/sorthand.js'
import {timer, startTimer} from '../../utils/timer.js'
import diceRoll from '../../utils/diceroll.js'
import { WIND_TILES, ANIMAL_TILES, FLOWER_TILES} from '../game/tileset.js'
import { playerMetaInfoConverter, playerCheckedConverter, playerHandConverter, playerDiscardedConverter } from '../game/converters.js'
import Player from '../Player.js'

import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged, connectAuthEmulator, signOut } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { ref, serverTimestamp, onDisconnect, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, push, set, getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { writeBatch, collection, increment, getDocs, doc, getDoc, setDoc, updateDoc,getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, serverTimestamp as fsServerTimestamp} from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'


const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
const rtdb = getDatabase(firebase)
const fsdb = getFirestore(firebase)
connectAuthEmulator(auth, "http://localhost:9099")
connectDatabaseEmulator(rtdb, "localhost", 9000)
connectFirestoreEmulator(fsdb, "localhost", 8080)

window.addEventListener('DOMContentLoaded', async ()=> {

  // GLOBALS 
  let loggedInUser = {}
  const sendButton = document.getElementById('send-chat')
  const messageField = document.getElementById('chat-message')
  const messages = document.getElementById('chat-messages')
  
  // SET NAVBAR DETAILS
  document.getElementById('logout').addEventListener('click', (ev)=> {
    ev.preventDefault()
    signOut(auth).then(()=> {
      window.location.pathname ='/login'
    })
  })

    // once ready reaches 3-4pax, start game
  // write the db that room has started
  // once room state is start, all the buttons disabled, including chat
  let firstInit = true
  const readyRef = collection(fsdb, 'lobby', roomId, 'readiness')
  onSnapshot(readyRef, (snapshot)=> {
    if(firstInit) {
      firstInit = false
      return
    } else {
      const startButton=document.getElementById('startButton')
      console.log(snapshot.size)
      if(snapshot.size == 4){
       startButton.disabled == false
      } else {
        startButton.disabled == true
      }
      snapshot.docs.forEach(doc=> {
        
        snapshot.docChanges().forEach(change=> {
          console.log(change.doc)
          const readyId = change.doc.id
          const playerCard = document.getElementById(readyId);          
          // const actionButton = playerCard.lastElementChild
          playerCard.classList.toggle('deactivated')
          // actionButton.classList.toggle('readiness')
          if(change.type == 'added'){
            // actionButton.textContent = "WAITING..."
          } else if(change.type == 'removed'){
            // actionButton.textContent = "READY"
          }
        })
      })
    }
  })
  const gamelobby = document.getElementById('gamelobby');

  const showStartBtn = () => {
    const startButton = document.createElement('button')
    startButton.classList.add('start')
    startButton.id = 'startButton'
    startButton.textContent = 'Start Game'
    startButton.addEventListener('click', (ev)=> {
      ev.preventDefault()
      startGameInstance(roomId, loggedInUser.uid)
    })
    // disable start button until all four players are ready
    // startButton.disabled = true
    gamelobby.appendChild(startButton)
  }

  const showLeaveBtn = ()=> {
      // ALLOW USERS TO LEAVE THE ROOM
    const leaveButton = document.createElement('button')
    leaveButton.id = 'leave-room'
    leaveButton.textContent = 'Leave Room'
    leaveButton.addEventListener('click', (ev)=>{
      ev.preventDefault()
      window.location.pathname = '/lobby'
    })
    gamelobby.appendChild(leaveButton)
  }



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
        // This ensures that our firestore cache is aware of the switch to offline
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

  onAuthStateChanged(auth, async (user)=>{
    if(user) {
      loggedInUser['displayName'] = user.displayName;
      loggedInUser['uid'] = user.uid;
      loggedInUser['photoURL'] = user.photoURL;
      const userName = document.getElementById('userName');
      userName.innerText = `Welcome ${user.displayName}`

      // flag if the current user is the game host
      const gameRoomRef = doc(fsdb,'lobby', roomId)
      const gameRoomData = await getDoc(gameRoomRef)
      if(gameRoomData.exists() && gameRoomData.data().host.uid == user.uid) {
        loggedInUser['host'] == true;
        showStartBtn()
      } else {
        loggedInUser['host'] == false;
        showLeaveBtn()
      }

      startDBSync(loggedInUser)
      } else {
        // user is signed out
        window.location.pathname = '/login'
    }
  })

  // Add a chat message to the chat UI
  const addChatMessage = (name, message) => {
    const item = document.createElement('li')
    item.innerHTML = `<strong>${name}</strong> ${message}`

    const messageList = messages.querySelector('ul')
    messageList.appendChild(item)
    messages.scrollTop = messageList.scrollHeight;
  }

  const addUser = (player, windCount) => {
    const WIND = { 
      east: "🀀",
      south: "🀁",
      west: "🀂",
      north: "🀃",
    }
    const card = document.createElement('div')
    card.classList.add('card','darken-1', 'col','s3')
    card.id = player.uid

    const cardContent = document.createElement('div')
    cardContent.classList.add('card-content')

    const cardTitle = document.createElement('div')
    const displayImg = document.createElement('img')
    displayImg.src = player.photoURL ? player.photoURL : 'https://pbs.twimg.com/profile_images/740272510420258817/sd2e6kJy_400x400.jpg'
    cardTitle.appendChild(displayImg)

    const displayName = document.createElement('p')
    displayName.textContent = player.displayName
    displayName.style.fontWeight = 'bold'
    const playerWind = document.createElement('p')
    playerWind.textContent = WIND[WIND_TILES[windCount]]
    playerWind.classList.add('playerWind')

    cardContent.appendChild(cardTitle)
    cardContent.appendChild(displayName)
    cardContent.appendChild(playerWind)
    card.appendChild(cardTitle)
    card.appendChild(cardContent)

    if(player.uid == loggedInUser.uid){
      const action = document.createElement('div')
      action.classList.add('card-action', 'readiness')
      action.textContent = 'READY'
      action.addEventListener('click', async (ev)=> {
        if(ev.target.textContent == 'READY') {
          action.textContent = 'WAITING...'
          action.classList.toggle('readiness')
          ev.target.parentElement.classList.toggle('deactivated')
          const roomRef = doc(fsdb, 'lobby', roomId, 'readiness', loggedInUser.uid)
          await setDoc(roomRef, { "ready": 1})
          // write to database to indicate availability
        } else {
          action.textContent = 'READY'
          action.classList.toggle('readiness')
          ev.target.parentElement.classList.toggle('deactivated')
          const roomRef = doc(fsdb, 'lobby', roomId, 'readiness', loggedInUser.uid)
          console.log('Removing doc')
          await deleteDoc(roomRef)
          // write to database to indicate availability
        }
      })
      card.appendChild(action)
    }

    const playerContainers = document.getElementById('playerContainers')
    playerContainers.appendChild(card)
  }

  // CHECK IF EVERYONE IS ONLINE
  const queryForOnlineUsers = query(collection(fsdb, 'status', roomId, 'players'), where('state','==','online'))
  onSnapshot(queryForOnlineUsers,  (snapshot)=>{
    snapshot.docChanges().forEach(async(change)=> {
      if(change.type=="added") {
        const message = ' joined the room.'
        addChatMessage(change.doc.data().displayName, message)
        const updatePlayers = (await getDoc(doc(fsdb,'lobby', roomId))).data().players
        await updateDoc(doc(fsdb,'lobby', roomId),{
          "playerCount": updatePlayers.length
        })
      }

      // Remove the player if he exits the room
      if(change.type=="removed") {
        const message = ' left the room.'
        addChatMessage(change.doc.data().displayName, message)
        const updatePlayers = (await getDoc(doc(fsdb,'lobby', roomId))).data().players.filter(player=> player.displayName != change.doc.data().displayName)
        await updateDoc(doc(fsdb,'lobby', roomId),{
          "players": updatePlayers,
          "playerCount": updatePlayers.length
        })
      }
    })
  })

  const renderUserCards = (users) => {
    // reset board
      document.getElementById('playerContainers').innerHTML = ''
      addUser(users.host,0)
      for(let playerCount=0; playerCount < users.players.length; playerCount +=1 ){
        addUser(users.players[playerCount], playerCount+1)
      }
  }

  // QUERY FOR PLAYER DETAILS
  const playersRef = doc(fsdb,'lobby', roomId)
  onSnapshot(playersRef, (doc)=> {
    renderUserCards(doc.data())
  })
  
  // INSTANTIATE CHAT FUNCTIONALITY
  const chatRef = ref(rtdb, `interstitial/${roomId}/chats/`)

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
    addChatMessage(message.name, message.message)
  })


  // LISTEN FOR STARTUP BY HOST
  const gameStateRef = collection(fsdb, 'games', roomId, 'gameState')
  onSnapshot(gameStateRef, (gameInit)=> {
    gameInit.docChanges().forEach( doc=>{
      if(doc.type == "added") {
        return startUpProcedures(roomId)
      }
    })
    })
  
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