// ref from https://github.com/markmandel/happy-angry-surprised/blob/master/html/js/chat.js
import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { ref, serverTimestamp, onDisconnect, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, push, set, getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { collection, increment, getDocs, doc, getDoc, setDoc, getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, serverTimestamp as fsServerTimestamp} from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'

const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
const rtdb = getDatabase(firebase)
const fsdb = getFirestore(firebase)
connectAuthEmulator(auth, "http://localhost:9099")
connectDatabaseEmulator(rtdb, "localhost", 9000)
connectFirestoreEmulator(fsdb, "localhost", 8080)

window.addEventListener('DOMContentLoaded', async ()=> {

  let loggedInUser = {}
  let onlinePlayerCount = 0
  let hasStarted = false;
  const sendButton = document.getElementById('send-chat')
  const messageField = document.getElementById('chat-message')
  const messages = document.getElementById('chat-messages')

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

  onAuthStateChanged(auth, (user)=>{
    if(user) {
    // loggedInUser[accessToken] = await user.accessToken;
        loggedInUser['displayName'] = user.displayName;
        loggedInUser['uid'] = user.uid;
        loggedInUser['photoURL'] = user.photoURL;
        
        startDBSync(loggedInUser)
      } else {
        // user is signed out
        // window.location.pathname = '/login'
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

  const addUser = (player) => {
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
    const userId = document.createElement('p')
    userId.textContent = `PLAYER ${player.playerNo}`
    userId.style.wordBreak = 'break-all' 
    const playerWind = document.createElement('p')
    playerWind.textContent = WIND[player.playerWind]
    playerWind.classList.add('playerWind')

    cardContent.appendChild(cardTitle)
    cardContent.appendChild(displayName)
    cardContent.appendChild(userId)
    cardContent.appendChild(playerWind)

    const action = document.createElement('div')
    action.classList.add('card-action', 'readiness')
    action.textContent = 'READY'
    action.addEventListener('click', async (ev)=> {
      if(ev.target.textContent == 'READY') {
        action.textContent = 'WAITING...'
        
        action.classList.toggle('readiness')
        ev.target.parentElement.classList.toggle('deactivated')
        const roomRef = doc(fsdb, 'lobby','roomId')
        await updateDoc(roomRef, { "ready": increment(1)})
        // write to database to indicate availability
      } else {
        action.textContent = 'READY'
        action.classList.toggle('readiness')
        ev.target.parentElement.classList.toggle('deactivated')
        const roomRef = doc(fsdb, 'lobby','roomId')
        await updateDoc(roomRef, { "ready": increment(-1)})
        // write to database to indiciate availability
      }
    })

    card.appendChild(cardTitle)
    card.appendChild(cardContent)
    card.appendChild(action)

    const playerContainers = document.getElementById('playerContainers')
    playerContainers.appendChild(card)
  }


  // CHECK IF EVERYONE IS ONLINE
  const queryForOnlineUsers = query(collection(fsdb, 'status', roomId, 'players'), where('state','==','online'))
  onSnapshot(queryForOnlineUsers,(snapshot)=>{
    snapshot.docChanges().forEach((change)=> {
      if(change.type=="added") {
        onlinePlayerCount +=1
        const message = ' joined the room.'
        addChatMessage(change.doc.data().displayName, message)
      }

      if(change.type=="removed") {
        onlinePlayerCount -=1
        const message = ' left the room.'
        addChatMessage(change.doc.data().displayName, message)
        const userCard = document.getElementById(change.doc.data().uid)
        console.log(change.doc.data())
        userCard.remove()
      }
    })
  })

  // QUERY FOR PLAYER DETAILS
  const playersRef = doc(fsdb,'lobby', roomId)
  const queryForPlayers = await getDoc(playersRef)
  addUser(queryForPlayers.data().host)
  queryForPlayers.data().players.forEach((player)=>{
      addUser(player)
  })

  //  READ ONCE AND THEN LISTEN INDIVIDUALLY TO EACH ROOM FOR CHANGES
  // const interstitial = query(collection(db, "lobby"))
  // await getDocs(lobbyRooms).then( docs => {
  //   docs.forEach( doc => {
  //     const createdRoom = doc.data()
  //       if(createdRoom.host.uid != loggedInUser.uid ) {
  //         addRoomInvitation(doc.id, createdRoom)
  //       } else {
  //         addOwnRoom(doc.id, createdRoom)
  //       }
  //     }
  //   )
  // })


  const sendMessage = () => {
    const newMessage = {
      name: loggedInUser.displayName,
      message: messageField.value
    }
    messageField.value = ''
    set(push(chatRef), newMessage)
  }




  // TODO: build the chat UI
  sendButton.addEventListener('click', sendMessage)
  const chatRef = ref(rtdb, `interstitial/${roomId}/chats/`)
  onChildAdded(chatRef, (snapshot)=> {
    const message = snapshot.val()
    addChatMessage(message.name, message.message)
  })

  const gameStateRef = query(collection(fsdb, 'games', roomId, 'gameState'), where('roomId','==', roomId))
  onSnapshot(gameStateRef, (snapshot)=> {

  })



  // ONLY VISIBLE TO THE HOST
  const startGameInstance = async (roomId, hostid) => {
    // update gameState
    /** @type {*} */
    let gameState = {
        roomId: roomId,
        host: hostid,
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

    const newGameState = await addDoc(gameStateRef, gameState)
    return newGameState.id //generated id for the game state to be used as a subsequent reference
  }

  const startUpProcedures = (gameInstance) => {
    // write to database to create an instance of the game
    // countdown in the 
    setTimeout(()=>{
      addChatMessage('Game starting in', '3')
    },1000)
    setTimeout(()=>{
      addChatMessage('Game starting in', '2')
    },1000)
    setTimeout(()=>{
      addChatMessage('Game starting in', '1')
    },1000)
    setTimeout(()=>{
      window.location.pathname = `/game/${gameInstance}`
    },1000)
  }

  const showStartBtn = () => {
    const chat = document.getElementById('chat')
    const startButton = document.createElement('button')
    startButton.classList.add('start')
    startButton.addEventListener('click', ()=> {
      startUpProcedures(startGameInstance)
    })
  }
})