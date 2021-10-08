import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, ref, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, connectDatabaseEmulator, push, set } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { collection, getDocs, doc, getDoc, setDoc, getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'





// FIREBASE FIRESTORE INITIALIZATION
const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
// const db = getDatabase(firebase)
const db = getFirestore(firebase)
// connectDatabaseEmulator(db, "localhost", 9000)
connectFirestoreEmulator(db, "localhost", 8080)

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

const joinRoom = async (key) =>{
  console.log('Attempting to join game of key: ', key)
  const userOwnedRoomQuery = doc(db,'lobby',key)
  const snapshot = await getDoc(userOwnedRoomQuery)
  console.log(snapshot)
  try {
      await runTransaction(db, async (transaction) => {
        const room = await transaction.get(doc(db, 'lobby', key))
        if(!room.exists()){
          throw "Room does not exist!"
        }
        
        const newPlayer = {
            uid: loggedInUser.uid,
            displayName: loggedInUser.displayName
          }

        transaction.update(doc(db, 'lobby', key), { players: arrayUnion(newPlayer)})
        // if players
        // update state: ROOM_STATE.JOINED
    })
   } catch (error) {
    console.error(error)
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
                              
                            </div>
                            <div class="card-action join-room"> GO BACK TO YOUR CRIB </div>
                          </div>`
  roomItem.addEventListener('click', ()=> {
    joinRoom(key)
  })
  const roomList = document.getElementById('roomList');
  roomList.appendChild(roomItem)
}


// LOBBY STATES
const ROOM_STATE = { OPEN: 1, JOINED: 2, FULL: 3 }

//  READ ONCE AND THEN LISTEN INDIVIDUALLY TO EACH ROOM FOR CHANGES
const lobbyRooms = query(collection(db, "lobby"))
await getDocs(lobbyRooms).then( docs => {
  docs.forEach( doc => {
    const createdRoom = doc.data()
      if(createdRoom.host.uid != loggedInUser.uid ) {
        addRoomInvitation(doc.id, createdRoom)
      } else {
        addOwnRoom(doc.id, createdRoom)
      }
    }
  )
})


let initFirebase = true;

// listen to changes in no of pax in the room
// listen for the waiting queue

onSnapshot(collection(db, "lobby"), { includeMetadataChanges: true }, (collection)=> {
  
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
// onChildAdded(openRooms, (snapshot)=> {
//   const data = snapshot.val();
//   console.log('Room added:', data)
//   addRoomInvitation(snapshot.key,data)

//   // ignore our own created games
//   if(data.host.uid != loggedInUser.uid) {
//     addRoomInvitation(snapshot.key,data)
//   }
// })

// onChildRemoved(openRooms, (snapshot)=> {
//   const item = document.querySelector(`#${snapshot.key}`)
//   if(item) {
//     item.remove();
//   }
// })

const createRoom = async() => {
  console.log('Creating a game room...')
  const currentGame = {
    host: {
      uid: loggedInUser.uid,
      displayName: loggedInUser.displayName
    },
    state: ROOM_STATE.OPEN,
    players: []
  }

  // CHECK IF YOU'VE ALREADY CREATED A ROOM
  // if have, disable the add room functionality
  const userOwnedRoomQuery = query(collection(db, 'lobby'), where('host.uid', '==', `${loggedInUser.uid}`))
  const hostedRoom = await getDocs(userOwnedRoomQuery)
  console.log(hostedRoom)
  if(!hostedRoom.empty) {
    toastr.error('You can only host one room at a time.')
  } else {
      const roomDetail = await addDoc(collection(db, "lobby"), currentGame)
      window.location.pathname = `/interstitial/${roomDetail.id}`
  }
}

const createRmBtn = document.getElementById('create-room');
createRmBtn.addEventListener('click', createRoom)
  // join an open game with the available key


    const playerReady = () => {
      // send to the user the readiness state of the player
      
    }



