import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, ref, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, connectDatabaseEmulator, push, set } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'


// lobby controls who has created rooms
const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
const db = getDatabase(firebase)
connectDatabaseEmulator(db, "localhost", 9000)

const loggedInUser = {}

onAuthStateChanged(auth, (user)=> {
  if (user) {
    // loggedInUser[accessToken] = await user.accessToken;
    loggedInUser['displayName'] = user.displayName;
    loggedInUser['uid'] = user.uid;
    loggedInUser['photoURL'] = user.photoURL;
    console.log(loggedInUser)
  } else {
    // user is signed out
    window.location.pathname = '/login'
  }
})

// Set a database reference to the lobby JSON object
const lobbyRef = ref(db, 'lobby')

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
                              
                            </div>
                            <div class="card-action join-room" onClick="joinRoom(${key})">JOIN ${room.host.displayName.toUpperCase()} ROOM</div>
                          </div>`
  const roomList = document.getElementById('roomList');
  roomList.appendChild(roomItem)
}

// states a room could be in
const ROOM_STATE = { OPEN: 1, JOINED: 2, FULL: 3 }
// const GAME_STATE = { DICEROLL: 0, EAST: 1, SOUTH: 2, WEST: 3, NORTH: 4}

const openRooms = query(lobbyRef, orderByChild('state'), equalTo(ROOM_STATE.OPEN))
onChildAdded(openRooms, (snapshot)=> {
  const data = snapshot.val();
  console.log('Room added:', data)
  addRoomInvitation(snapshot.key,data)

  // ignore our own created games
  if(data.host.uid != loggedInUser.uid) {
    addRoomInvitation(snapshot.key,data)
  }
})

onChildRemoved(openRooms, (snapshot)=> {
  const item = document.querySelector(`#${snapshot.key}`)
  if(item) {
    item.remove();
  }
})

const createRoom = () => {
  console.log('Creating a game room...')
  const currentGame = {
    host: {
      uid: loggedInUser.uid,
      displayName: loggedInUser.displayName
    },
    state: ROOM_STATE.OPEN
  }

  // gets a new key from pushing into the database
  const key = push(lobbyRef)
  console.log(key.key)
  set(key, currentGame)
  .then(()=>{
    window.location.pathname = `/interstitial/${key.key}`
  })
  .catch((error)=> {
    if(error) {
      console.error('Error creating room:',error)
      // toastr an error
    } else {
      // disable access to joining other games
      console.log('game created with key: ', key)
      // drop this game if the user disconnects
      key.onDisconnect().remove()
      // gameList.style.display = "none"
      // watchGame(key.key)
    }
  })
}

const createRmBtn = document.getElementById('create-room');
createRmBtn.addEventListener('click', createRoom)
  // join an open game with the available key
  const joinRoom = (key) =>{
    console.log('Attempting to join game of key: ', key)
    
    lobbyRef.child(key).transaction( (room)=> {
      // only join if someone else hasn't
      if(room.joiners.length < 3) {
        room.state = ROOM_STATE.JOINED
        room.joiners.push({
          uid: loggedInUser.uid,
          displayName: loggedInUser.displayName
        })
      }
      return room
    }, (error, committed, snapshot) => {
      if (committed) {
        if(snapshot.val().joiners.find(user.uid)) {
          // enableCreateRoom(false)
          // watchGame(key)
        } else {
          // toastr "Room already joined. Please choose another"
        }
      } else {
        console.log('Could not commit when trying to join game:', error)
        // toastr "Error joining game"
      }
    })
  }

    const playerReady = () => {
      // send to the user the readiness state of the player
      
    }



