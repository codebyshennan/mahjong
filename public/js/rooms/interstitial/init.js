

import firebaseConfig from '../../config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'

import { ref, serverTimestamp, onDisconnect, query, orderByChild, equalTo, onValue, onChildAdded, onChildRemoved, push, set } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { collection, getDocs, doc, getDoc, setDoc, getFirestore, connectFirestoreEmulator, onSnapshot, addDoc, arrayUnion, arrayRemove, deleteDoc, collectionGroup, runTransaction, where, FieldValue} from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'

import Chat from '/js/rooms/interstitial/chat.js'


// Interstitial displays the pre-game chat function, the players that are waiting for game to start. Also allows the players to select which wind they want to be in and whether they are ready to start the game.

// 
const firebase = initializeApp(firebaseConfig)
const auth = getAuth()
const rtdb = getDatabase(firebase)
const fsdb = getFirestore(firebase)
// connectDatabaseEmulator(rtdb, "localhost", 9000)
// connectFirestoreEmulator(fsdb, "localhost", 8080)

const loggedInUser = {}

onAuthStateChanged(auth, (user)=>{
  if(user) {
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


// Create a reference to this user's specific status node.
// This is where we will store data about being online/offline.
const userStatusDatabaseRef = ref(rtdb, `/status/${loggedInUser.uid}`)

// We'll create two constants which we will write to 
// the Realtime database when this device is offline
// or online.
const isOfflineForDatabase = {
  status: 'offline',
  last_changed: serverTimestamp()
}

const isOnlineForDatabase = {
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
const userStatusFirestoreRef = doc(fsdb, `/status/${loggedInUser.uid}`)

// firestore uses a different server timestamp value, so we'll create two constants,
// (same as the ones in the rtdb) for Firestore state

const isOfflineForFirestore = {
  state: 'offline',
  last_changed: serverTimestamp(),
}

const isOnlineForFirestore = {
  state: 'online',
  last_changed: serverTimestamp(),
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

  

// ref from https://github.com/markmandel/happy-angry-surprised/blob/master/html/js/chat.js

// Application starts by loading the in-room users and chat functionality
window.onload = () => {
  // showUsers.init()
  Chat().init()
}