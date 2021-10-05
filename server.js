import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { initializeApp } from 'firebase/app'
// import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, arrayUnion, arrayRemove, query, where } from 'firebase/firestore/lite'
import firebaseConfig from './environment.js'
import { 
  getAuth,
  signOut,
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider } from 'firebase/auth'
import { v4 as uuidv4 } from 'uuid'

const firebase = initializeApp(firebaseConfig)
const db = getFirestore(firebase)
// const analytics = getAnalytics(firebase)

// socketio configuration to connect
const app = express()
const server = http.createServer(app)

const io = new Server(server,{
  cors: {
      origins: ['http://localhost:3000','https://admin.socket.io'],
      methods: ['GET','POST']
    }
})
  
// get data fronm db
const getData = async (db) => {
  const users = collection(db, 'items')
  const usersSnapshot = await getDocs(users)
  const usersList = usersSnapshot.docs.map(doc=> doc.data());
  console.log(usersList)
  return usersList
}

app.set('view engine','ejs')
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))
app.use(cors())


app.get('/signout',(req,res)=> {
  const auth = getAuth()
  signOut(auth).then(()=>{
    // sign out successful
    console.log('Signed out')
  }).catch((error)=> {
    console.error(error)
  })
})

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
      return userCredential.user.updateProfile({
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


// authorisation middleware
const authRoute = (req,res,next)=>{
  const auth = getAuth()
  onAuthStateChanged(auth, (user)=> {
    if(user) {
      // https://firebase.google.com/docs/reference/js/firebase.User
      console.log(user.displayName)
      console.log(user.uid)
      console.log('User is signed in.')
      next()
    } else {
      console.log('User is signed out.')
      res.redirect('/login')
    }
  })
}

app.get('/',(req,res)=> {
  res.redirect(`/${uuidv4()}`)
})

app.get('/:room', (req,res)=> {
  res.render('game', {roomId: req.params.room})
})

app.get('/lobby', async (req,res)=> {
  res.render('lobby')
})


app.get('/interstitial/:room', (req,res)=>{

})

// app.post('/lobby/create')

io.of('/lobby').on('connection', socket=> {
  socket.on('create-and-join-room', async (callback)=> {
    const roomid = uuidv4()
    console.log(`room ${roomid} was created`)
    await setDoc(doc(db,'rooms', roomid), {
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
    const roomRef = doc(db, 'rooms', roomId)
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

      // the signed in user info
      const user = result.user
    })
})


// for web-based RTC
io.on('connection', (socket) => {
  
});








server.listen(3000, () => {
  console.log('listening on *:3000');
});