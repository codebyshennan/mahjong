import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { initializeApp } from 'firebase/app'
// import { getAnalytics } from "firebase/analytics";
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import firebaseConfig from './public/js/config.js'
import { 
  getAuth,
  signOut,
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  connectAuthEmulator } from 'firebase/auth'
import { v4 as uuidv4 } from 'uuid'
import admin from 'firebase-admin'
import * as functions from 'firebase-functions'
// https://www.stefanjudis.com/snippets/how-to-import-json-files-in-es-modules-node-js/
import { readFile } from 'fs/promises'
const serviceAccount = JSON.parse(await readFile( new URL('./serviceAccountKey.json', import.meta.url)))


// INITIALISE FIREBASE AS DATABASE
const firebase = initializeApp(firebaseConfig)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mahjong-7d9ae-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const rtdb = getDatabase(firebase)
// connectDatabaseEmulator(rtdb, "localhost", 9000)



// const analytics = getAnalytics(firebase)

// SERVER CONFIGURATION TO HOST PEERJS CONNECTIONS
const app = express()
const server = http.createServer(app)

const io = new Server(server,{
  cors: {
      origins: ['http://localhost:3000','https://admin.socket.io'],
      methods: ['GET','POST']
    }
})


// GLOBAL APP CONFIG FOR EXPRESS
app.set('view engine','ejs')
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))
app.use(cors())

// ROUTES
// DEFAULT
app.get('/', (req,res)=>{
  res.render('/lobby')
})

// REGISTER NEW USERS
app.get('/register', (req,res)=>{
  res.render('register')
})
.post('/register', (req,res)=>{
  const { firstname, lastname, email, password} = req.body
  console.log(firstname, lastname, email, password)
  // create new users
  const auth = getAuth();
  console.log('getting credentials')
  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential)=> {
       userCredential.updateProfile({
        displayName: `${firstname} ${lastname}`
      }).then((result)=> {
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
  res.render('login')
})

// app.post('/login', (req,res)=> {
//   const { idToken } = req.body
//   admin.auth().verifyIdToken(idToken).then((decodedToken)=> {
//     const uid = decodedToken.uid
//     console.log(uid)
//   })
// })

app.post('/login/form', (req,res)=> {
  const auth = getAuth()
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential)=> {
      const user = userCredential.user;
      // TODO: save it in localstorage for persistence
      res.redirect('/main')
    }).catch((error)=> {
      const errorCode = error.code
      const errorMessage = error.message;
      // TODO: toastr this shit
    })
})

app.post('/login/google', (req,res)=>{
  const auth = getAuth()
  const provider = new GoogleAuthProvider
  signInWithPopup(auth, provider)
    .then((result)=>{
      // this gives you a Google Access Token
      const credential = provider.credentialFromResult(result)
      const token = credential.accessToken

      console.log(credential)
      console.log(token)
      console.log(result.user)
      // the signed in user info
      const user = result.user
    })
})

app.post('/login/facebook', (req,res)=>{
  const auth = getAuth()
  const provider = new FacebookAuthProvider
  signInWithPopup(auth, provider)
    .then((result)=>{
      // this gives you a Google Access Token
      const credential = provider.credentialFromResult(result)
      const token = credential.accessToken

      console.log(credential)
      console.log(token)
      console.log(result.user)
      // the signed in user info
      const user = result.user
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

// LOBBY
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

// GAME ROOMS
app.get('/:new',(req,res)=> {
  res.redirect(`/room/${uuidv4()}`)
})

// In the gameroom, the client js file reads the rtdb for the 
app.get('/room/:room', (req,res)=> {
  res.render('game', {roomId: req.params.room})
})

// app.post('/lobby/create')

io.of('/lobby').on('connection', socket=> {
  socket.on('create-and-join-room', async (callback)=> {
    const roomid = uuidv4()
    console.log(`room ${roomid} was created`)
    await setDoc(doc(rtdb,'rooms', roomid), {
      roomid: `${roomid}`,
      noOfPlayers: 1,
      gameState: 'Not Ready',
      players: [`${socket.client.conn.id}`],
      dateCreated: new Date()
    }).then(result=> {
      console.log(result)
      callback(roomid)
    })
  })
})


io.of('/game').on('connection', socket => {

  console.log('a user connected');
  console.log(socket.client.conn.id)

  socket.on('my message', (msg) => {
    io.emit('my broadcast', `server: ${msg}`);
  });

  socket.on('join-room', async (roomId, userId)=>{
    console.log('Joined Room: ', roomId)
    socket.join(roomId);
    const roomRef = doc(rtdb, 'rooms', roomId)
    await updateDoc(roomRef, {
      players: arrayUnion(userId)
    })

    // broadcast doesn't seem to work
    socket.to(roomId).emit('user-connected', userId)

    socket.on('disconnect', async ()=> {
        await updateDoc(roomRef, {
        players: arrayRemove(userId)
      })
      socket.to(roomId).emit('user-disconnected', userId)
    })
  })
})









server.listen(3000, () => {
  console.log('listening on *:3000');
});