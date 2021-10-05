import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'
import { initializeApp } from 'firebase/app'
// import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore/lite'
import { 
  getAuth,
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider } from 'firebase/auth'
import { v4 as uuidv4 } from 'uuid'

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCZxHXBsKxpepn-CHCKGdgnDNcjonCo8ec",
  authDomain: "mahjong-7d9ae.firebaseapp.com",
  databaseURL: "https://mahjong-7d9ae-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mahjong-7d9ae",
  storageBucket: "mahjong-7d9ae.appspot.com",
  messagingSenderId: "786831681379",
  appId: "1:786831681379:web:f4b3f6beaa559156209556",
  measurementId: "G-4JDXRRGDV0"
};

const firebase = initializeApp(firebaseConfig)
const db = getFirestore(firebase)
// const analytics = getAnalytics(firebase)

// socketio configuration to connect
const app = express()
const server = http.createServer(app)

const io = new Server(server,{
  cors: {
      origins: ['http://localhost:5500','https://admin.socket.io'],
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


// authorisation middleware
// app.use((req,res,next)=>{
//   const auth = getAuth()
//   onAuthStateChanged(auth, (user)=> {
//     if(user) {
//       // https://firebase.google.com/docs/reference/js/firebase.User
//       console.log(user.displayName)
//       console.log(user.uid)
//       console.log('User is signed in.')
//       next()
//     } else {
//       console.log('User is signed out.')
//       res.redirect('/')
//     }
//   })
// })

app.get('/',(req,res)=> {
  res.redirect(`/${uuidv4()}`)
})

app.get('/:room', (req,res)=> {
  res.render('game', {roomId: req.params.room})
})

io.on('connection', socket => {

  console.log('a user connected');
  console.log(socket.client.conn.id)


  socket.on('create-room', async ()=> {
    const roomid = uuidv4()
    console.log(`room ${roomid} was created`)
    await setDoc(doc(db,'rooms', roomid), {
      roomid: `${roomid}`,
      noOfPlayers: 1,
      gameState: 'Not Ready',
      players: [`${socket.client.conn.id}`],
      dateCreated: new Date()
    })
  })


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


app.post('/register', (req,res)=>{
  const { email, password} = req.body
  // create new users
  const auth = getAuth();
  createUserWithEmailAndPassword(auth,email, password)
    .then((userCredential)=> {
      const user = userCredential.user;
      // TODO: save it in localstorage for persistence 
    }).catch((error)=> {
      const errorCode = error.code
      const errorMessage = error.message;
      // TODO: toastr this shit
    })
})


app.get('/main', (req, res) => {  
  res.send(getData(db));
});

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

app.get('/login', (req,res)=>{
  res.render('login')
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