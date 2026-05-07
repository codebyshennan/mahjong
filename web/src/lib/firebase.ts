import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectDatabaseEmulator, getDatabase } from 'firebase/database'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { Database } from 'firebase/database'

const FIREBASE_DISABLED = import.meta.env.VITE_FIREBASE_DISABLED === 'true'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let auth: Auth | null = null
let fsdb: Firestore | null = null
let rtdb: Database | null = null

if (!FIREBASE_DISABLED) {
  const firebaseApp = initializeApp(firebaseConfig)
  auth = getAuth(firebaseApp)
  fsdb = getFirestore(firebaseApp)
  rtdb = getDatabase(firebaseApp)

  // Match the emulator ports defined in firebase.json (auth 12088, firestore
  // 14701, rtdb 15047). Only connect on localhost / 127.0.0.1.
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    connectAuthEmulator(auth, 'http://localhost:12088', { disableWarnings: true })
    connectFirestoreEmulator(fsdb, 'localhost', 14701)
    connectDatabaseEmulator(rtdb, 'localhost', 15047)
  }
}

export { auth, fsdb, rtdb }
