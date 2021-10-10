import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged, connectAuthEmulator, signOut } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, onDisconnect, serverTimestamp, ref, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, connectDatabaseEmulator, push, set } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { increment, collection, getDocs, doc, getDoc, setDoc, getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, serverTimestamp as fsServerTimestamp } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'

// FIREBASE FIRESTORE INITIALIZATION
const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
const rtdb = getDatabase(firebase)
const fsdb = getFirestore(firebase)
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

  let loggedInUser = {}

  // LOBBY STATES
  const ROOM_STATE = { OPEN: 1, JOINED: 2, FULL: 3 }
  const wind = {0: 'east', 1:'south',2:'west',3:'north'}
  const startDBSync = (loggedInUser) => {
    // Create a reference to this user's specific status node.
    // This is where we will store data about being online/offline.
    const userStatusDatabaseRef = ref(rtdb, `/online/${loggedInUser.uid}`)

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
    const userStatusFirestoreRef = doc(fsdb, `/online/${loggedInUser.uid}`)

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
        const userName = document.getElementById('userName');
        userName.innerText = `Welcome ${user.displayName}`
        startDBSync(loggedInUser)
      } else {
        // user is signed out
        // window.location.pathname = '/login'
    }
  })

  const messages = document.getElementById('chat-messages')

  // Add a chat message to the chat UI
  const addChatMessage = (name, message) => {
    const item = document.createElement('li')
    item.innerHTML = `<strong>${name}</strong> ${message}`

    const messageList = messages.querySelector('ul')
    messageList.appendChild(item)
    messages.scrollTop = messageList.scrollHeight;
  }

  // CHECK IF EVERYONE IS ONLINE
    const queryForOnlineUsers = query(collection(fsdb, 'online'), where('state','==','online'))
    onSnapshot(queryForOnlineUsers,(snapshot)=>{
      snapshot.docChanges().forEach((change)=> {
        if(change.type=="added") {
          const online = '🟢'
          addChatMessage(online, change.doc.data().displayName)
        }

        if(change.type=="removed") {
          [...document.querySelectorAll('li')].forEach( (item) => {
            if (item.innerText.includes(change.doc.data().displayName) && item.innerText.includes('🟢')) {
              item.parentNode.removeChild(item)
            }
          })
        }
      })
    })

    const queryForOfflineUsers = query(collection(fsdb, 'online'), where('state','==','offline'))
    onSnapshot(queryForOfflineUsers,(snapshot)=>{
      snapshot.docChanges().forEach((change)=> {
        if(change.type=="added") {
          const offline = '🔴'
          addChatMessage(offline, change.doc.data().displayName)
        }

        if(change.type=="removed") {
          [...document.querySelectorAll('li')].forEach( (item) => {
            if (item.innerText.includes(change.doc.data().displayName) && item.innerText.includes('🔴')) {
              item.parentNode.removeChild(item)
            }
          })
        }
      })
    })

  const joinRoom = async (key) =>{
    console.log('Attempting to join game of key: ', key)
    const userOwnedRoomQuery = doc(fsdb,'lobby', key)
    const snapshot = await getDoc(userOwnedRoomQuery)

    if(snapshot.data().host.uid == loggedInUser.uid) {
      window.location.pathname = `/interstitial/${key}`
    } else {
      try {
          await runTransaction(fsdb, async (transaction) => {
            const room = await transaction.get(doc(fsdb, 'lobby', key))
            if(!room.exists()){
              throw "Room does not exist!"
            }
            
            const newPlayer = {
                uid: loggedInUser.uid,
                displayName: loggedInUser.displayName,
                photoURL: loggedInUser.photoURL,
              }

            transaction.update(doc(fsdb, 'lobby', key), { "players": arrayUnion(newPlayer), "state": ROOM_STATE.JOINED, "playerCount": increment(1)})
        }).then(()=> {
          window.location.pathname = `/interstitial/${key}`
        })
      } catch (error) {
        console.error(error)
      }
        
    }
  }


  /**
   * For each room that was created,
   *
   * @param {*} key
   * @param {*} room
   */
  const addRoomInvitation = (key, room) => {
    const roomItem = document.createElement('div')
    roomItem.id = key
    roomItem.classList.add('card', 'horizontal')
    roomItem.innerHTML = `<div class="card-image"
                              style="background-image: url(https://static.vecteezy.com/system/resources/thumbnails/000/124/091/small/mahjong-hand-drawn-vector.jpg);
                                background-repeat: no-repeat;
                                min-width: 300px;"></div>
                            <div class="card-stacked">
                              <div class="card-content">
                                ${room.playerCount} / 3
                                ${Object.keys(ROOM_STATE)[room.state]}
                              </div>
                              <div class="card-action join-room">JOIN ${room.host.displayName.toUpperCase()} ROOM</div>
                            </div>`
    roomItem.addEventListener('click', ()=> {
      joinRoom(key)
    })
    const roomList = document.getElementById('roomList');
    roomList.appendChild(roomItem)
  }

  const addOwnRoom = (key, room) => {
    const roomItem = document.createElement('div')
    roomItem.id = key
    roomItem.classList.add('card', 'horizontal')
    roomItem.innerHTML = `<div class="card-image"
                              style="background-image: url(https://static.vecteezy.com/system/resources/thumbnails/000/124/091/small/mahjong-hand-drawn-vector.jpg);
                                background-repeat: no-repeat;
                                min-width: 300px;"></div>
                            <div class="card-stacked">
                              <div class="card-content">
                                ${room.playerCount} / 3
                                ${Object.keys(ROOM_STATE)[room.state]}
                              </div>
                              <div class="card-action join-room"> GO BACK TO YOUR CRIB </div>
                            </div>`
    roomItem.addEventListener('click', ()=> {
      joinRoom(key)
    })
    const roomList = document.getElementById('roomList');
    roomList.appendChild(roomItem)
  }

  //  READ ONCE AND THEN LISTEN INDIVIDUALLY TO EACH ROOM FOR CHANGES
  const lobbyRooms = collection(fsdb, "lobby")
  onSnapshot(lobbyRooms, rooms => {
    const roomList = document.getElementById('roomList')
    roomList.innerHTML = ''
    rooms.forEach( room => {
      const createdRoom = room.data()
        if(createdRoom.host.uid != loggedInUser.uid ) {
          addRoomInvitation(room.id, createdRoom)
        } else {
          addOwnRoom(room.id, createdRoom)
        }
      }
    )
  })


  let initFirebase = true;

  // listen to changes in no of pax in the room
  // listen for the waiting queue
  const openRooms = collection(fsdb, "lobby")
  onSnapshot(openRooms, (collection)=> {
    
    // SET INIT FLAG TO INDICATE FIRST INITIALIZATION OF FIRESTORE
    if(initFirebase) {
      initFirebase = false
    }
    collection.docs.forEach(doc=> {
      console.log(doc)
      console.log(doc.id)
      console.log('Doc data: ', doc.data())
    })
    console.log(collection)

    // doc changes provides change types "added", "modified", "removed"
    console.log('Changes to collecton', collection.docChanges())  
    console.log('data',collection.size)
  })

  const createRoom = async() => {
    console.log('Creating a game room...')
    const currentGame = {
      host: {
        uid: loggedInUser.uid,
        displayName: loggedInUser.displayName,
        photoURL: loggedInUser.photoURL,
        playerWind: wind[0],
        playerNo: 0
      },
      state: ROOM_STATE.OPEN,
      players: [],
      playerCount: 1,
    }

    // CHECK IF YOU'VE ALREADY CREATED A ROOM
    // if have, disable the add room functionality
    const userOwnedRoomQuery = query(collection(fsdb, 'lobby'), where('host.uid', '==', `${loggedInUser.uid}`))
    const hostedRoom = await getDocs(userOwnedRoomQuery)
    console.log(hostedRoom)
    if(!hostedRoom.empty) {
      toastr.error('You can only host one room at a time.')
    } else {
        const roomDetail = await addDoc(collection(fsdb, "lobby"), currentGame)
        window.location.pathname = `/interstitial/${roomDetail.id}`
    }
  }

  const createRmBtn = document.getElementById('create-room');
  createRmBtn.addEventListener('click', createRoom)
    // join an open game with the available key
})