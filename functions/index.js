import express from 'express'
import cors from 'cors'
import { initializeApp } from 'firebase/app'
// import { getAnalytics } from "firebase/analytics";
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import firebaseConfig from './firebaseConfig.js'
import { 
  getAuth,
  signOut,
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  connectAuthEmulator } from 'firebase/auth'
import admin from 'firebase-admin'
import * as functions from 'firebase-functions'
// https://www.stefanjudis.com/snippets/how-to-import-json-files-in-es-modules-node-js/
import { readFile } from 'fs/promises'
const serviceAccount = JSON.parse(await readFile( new URL('./serviceAccountKey.json', import.meta.url)))

// INITIALISING EXPRESS
const app = express()

// INITIALIZING FIREBASE (RTDB FOR CHAT / FSDB FOR GAMES AND LOBBY)
const firebase = initializeApp(firebaseConfig)
const auth = getAuth();
connectAuthEmulator(auth, "http://localhost:9099")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mahjong-7d9ae-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const rtdb = getDatabase(firebase)
const fsdb = getFirestore(firebase)
connectDatabaseEmulator(rtdb, "localhost", 9000)
connectFirestoreEmulator(fsdb, "localhost", 8080)
// const analytics = getAnalytics(firebase)

const firestore=admin.firestore()

// GLOBAL APP CONFIG FOR EXPRESS
app.set('view engine','ejs')
// app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))
app.use(cors())

// ROUTES
// DEFAULT
app.get('/', (req,res)=>{
  res.redirect('/login')
})

// REGISTER NEW USERS
app.get('/register', (req,res)=>{
  res.set('Cache-Control', 'public, max-age=300,s-max=600')
  res.render('register')
})
.post('/register', (req,res)=>{
  res.set('Cache-Control', 'public, max-age=300,s-max=600')
  const { firstname, lastname, email, password} = req.body
  console.log(firstname, lastname, email, password)
  // create new users
  
  console.log('getting credentials')
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential)=> {
       userCredential.updateProfile({
        displayName: `${firstname} ${lastname}`
      }).then((result)=> {
        res.render("lobby")
        console.log(result)
      })

      // TODO: save it in localstorage for persistence 
    }).catch((error)=> {
      const errorCode = error.code
      const errorMessage = error.message;
      // TODO: toastr this shit
    })
    // res.redirect('/login')
})

// LOGIN 
app.get('/login', (req,res)=>{
  res.set('Cache-Control', 'public, max-age=300,s-max=600')
  res.render('login')
})

app.post('/login/form', (req,res)=> {
  // res.set('Cache-Control', 'public, max-age=300,s-max=600')
  const { email, password } = req.body
  const auth = getAuth()
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential)=> {
      const user = userCredential.user;
      console.log(user)
      // TODO: save it in localstorage for persistence
      res.redirect('/lobby')
    }).catch((error)=> {
      const errorCode = error.code
      const errorMessage = error.message;
      // TODO: toastr this shit
    })
})


// SIGN OUT
app.post('/signout',(req,res)=> {
  const auth = getAuth()
  signOut(auth).then(()=>{
    // sign out successful
    console.log('Signed out')
  }).catch((error)=> {
    console.error(error)
  })
})

// ROOM STRUCTURE
// LOBBY -> INTERSTITIAL -> GAME

// << LOBBY >>
// After you login and authenticate, it will bring you to a game lobby
// Game lobby (SPA) will display the available games within the server
// Lobby allows you to create or join rooms
app.get('/lobby', (req,res)=> {
  res.render('lobby')
})

// INTERSTITIAL
// After you create a room, you get into the waiting area where players can chat and indicate if they are ready or not. 
// Once all are ready, the host can start the game, and all players are transported to a room with an already established game room id
app.get('/interstitial/:key', (req,res)=>{
  // TODO: use the admin sdk to check if the room is 
  // if(room) {
    res.render('interstitial', {roomKey: req.params.key})
  // }
})

app.post('/interstitial/createGame', (req,res)=>{
  
})


// In the gameroom, the client js file reads the rtdb for the 
app.get('/game/:room', (req,res)=> {
  res.render('game', {roomId: req.params.room})
})

export const application = functions.https.onRequest(app)
export const onUserStatusChanged = functions.database.ref('/status/{roomId}/players/{uid}').onUpdate(
  async (change, context) => {
    // get the data written to rtdb
    const eventStatus = change.after.val()
    // then use other event data to create a ref to the corresponding firestore document
    const userStatusFirestoreRef = firestore.doc(`status/${context.params.roomId}/players/${context.params.uid}`)

    // it is likely that the rtdb that triggered this event has already been overwritten 
    // by a fast change in the online/offline status, so we'll re-read the current data and compare the timestamps

    const statusSnapshot = await change.after.ref.once('value')
    const status = statusSnapshot.val()
    functions.logger.log(status, eventStatus);

    // if the current timestamp for this data is newer than the data that triggered this event, we exit this fn
    if(status.last_changed > eventStatus.last_changed) {
      return null;
    }

    // otherwise, we convert the last_changed field to a Date
    eventStatus.last_changed = new Date(eventStatus.last_changed)
    console.log('New Event', eventStatus)
    // and write it to firestore
    return userStatusFirestoreRef.set(eventStatus)
  }
)
export const onLobbyStatusChanged = functions.database.ref('/online/{uid}').onUpdate(
  async (change, context) => {
    // get the data written to rtdb
    const lobbyStatus = change.after.val()
    // then use other event data to create a ref to the corresponding firestore document
    const lobbyStatusFSRef = firestore.doc(`online/${context.params.uid}`)

    // it is likely that the rtdb that triggered this event has already been overwritten 
    // by a fast change in the online/offline status, so we'll re-read the current data and compare the timestamps

    const lobbyStatusSnapShot = await change.after.ref.once('value')
    const statusSnapShot = lobbyStatusSnapShot.val()
    functions.logger.log(statusSnapShot, lobbyStatus);

    // if the current timestamp for this data is newer than the data that triggered this event, we exit this fn
    if(statusSnapShot.last_changed > lobbyStatus.last_changed) {
      return null;
    }

    // otherwise, we convert the last_changed field to a Date
    lobbyStatus.last_changed = new Date(lobbyStatus.last_changed)
    console.log('New Event', lobbyStatus)
    // and write it to firestore
    return lobbyStatusFSRef.set(lobbyStatus)
  }
)


// // CHECK WIN FUNCTIONS
// export const checkWinningHand = functions.firestore.document('games/{gameId}/players/{playerId}/tiles/playerHand').onUpdate(
//   async(change, context)=> {
//     const playerHandStatus = change.after.val()
//     const playerCheckedRef = firestore.doc(`games/${context.params.gameId}/players/${context.params.playerId}/tiles/playerChecked`)
//     const playerCheckedStatus = await getDoc(playerCheckedRef)
//     // data => playerChecked.data()
//     // checkwin logic (playerHandStatus, playerCheckedStatus)
    
//     const winningCombi = {
//       winner: `${context.params.playerId}`,
//       combination: playerHandStatus,
//       checked: playerCheckedStatus
//     }

//     const winnerRef = firestore.doc(`games/${context.params.gameId}`) 
//     return winnerRef.set(winningCombi)
//   }


