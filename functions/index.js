import express from 'express'
import cors from 'cors'
import { initializeApp } from 'firebase/app'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import firebaseConfig from './firebaseConfig.js'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import admin from 'firebase-admin'
import * as functions from 'firebase-functions/v1'
import { readFileSync } from 'fs'

const { PROJECT_ID, DATABASE_URL } = process.env

const app = express()

const firebase = initializeApp(firebaseConfig)
const auth = getAuth()

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true'

if (isEmulator) {
  admin.initializeApp({
    projectId: PROJECT_ID,
    databaseURL: DATABASE_URL
  })
} else {
  const serviceAccount = JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url), 'utf8'))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL
  })
}

const rtdb = getDatabase(firebase)
const fsdb = getFirestore(firebase)

if (isEmulator) {
  connectAuthEmulator(auth, 'http://localhost:12088')
  connectDatabaseEmulator(rtdb, 'localhost', 15047)
  connectFirestoreEmulator(fsdb, 'localhost', 14701)
}

const firestore = admin.firestore()

const allowedOrigins = isEmulator
  ? ['http://localhost:5000', 'http://127.0.0.1:5000']
  : ['https://mahjong-7d9ae.firebaseapp.com', 'https://mahjong-7d9ae.web.app']

app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: allowedOrigins }))

// Room/game IDs are UUIDs — reject anything else to prevent XSS in EJS injection
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

app.get('/', (req, res) => {
  res.redirect('/login')
})

app.get('/register', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300, s-maxage=600')
  res.render('register')
})

app.post('/register', (req, res) => {
  const { firstname, lastname, email, password } = req.body
  if (!firstname || !lastname || !email || !password) {
    return res.status(400).send('All fields are required')
  }
  if (password.length < 6) {
    return res.status(400).send('Password must be at least 6 characters')
  }
  admin.auth().createUser({
    email,
    password,
    displayName: `${firstname} ${lastname}`
  }).then(() => {
    res.redirect('/login')
  }).catch((error) => {
    console.error('Registration error:', error.code, error.message)
    res.status(400).send('Registration failed: ' + error.code)
  })
})

app.get('/login', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300, s-maxage=600')
  res.render('login')
})

app.get('/demo/lobby', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.render('lobby', { demoMode: true })
})

app.get('/demo/interstitial', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.render('interstitial', { roomKey: 'demo-room', demoMode: true })
})

app.get('/demo/game', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.render('game', { roomId: 'demo-room', demoMode: true })
})

app.get('/lobby', (req, res) => {
  res.render('lobby')
})

app.get('/interstitial/:key', (req, res) => {
  if (!UUID_REGEX.test(req.params.key)) {
    return res.redirect('/lobby')
  }
  res.render('interstitial', { roomKey: req.params.key })
})

app.post('/interstitial/createGame', (req, res) => {
  res.status(501).send('Not implemented')
})

app.get('/game/:room', (req, res) => {
  if (!UUID_REGEX.test(req.params.room)) {
    return res.redirect('/lobby')
  }
  res.render('game', { roomId: req.params.room })
})

export const application = functions.https.onRequest(app)

export const onUserStatusChanged = functions.database.ref('/status/{roomId}/players/{uid}').onUpdate(
  async (change, context) => {
    const eventStatus = change.after.val()
    const userStatusFirestoreRef = firestore.doc(`status/${context.params.roomId}/players/${context.params.uid}`)
    const statusSnapshot = await change.after.ref.once('value')
    const status = statusSnapshot.val()
    functions.logger.log(status, eventStatus)
    if (status.last_changed > eventStatus.last_changed) {
      return null
    }
    eventStatus.last_changed = new Date(eventStatus.last_changed)
    return userStatusFirestoreRef.set(eventStatus)
  }
)

export const onLobbyStatusChanged = functions.database.ref('/online/{uid}').onUpdate(
  async (change, context) => {
    const lobbyStatus = change.after.val()
    const lobbyStatusFSRef = firestore.doc(`online/${context.params.uid}`)
    const lobbyStatusSnapShot = await change.after.ref.once('value')
    const statusSnapShot = lobbyStatusSnapShot.val()
    functions.logger.log(statusSnapShot, lobbyStatus)
    if (statusSnapShot.last_changed > lobbyStatus.last_changed) {
      return null
    }
    lobbyStatus.last_changed = new Date(lobbyStatus.last_changed)
    return lobbyStatusFSRef.set(lobbyStatus)
  }
)
