import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectDatabaseEmulator, getDatabase } from 'firebase/database'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import type { Database } from 'firebase/database'

// Disabled when explicitly flagged OR when no real API key is present.
// Real Firebase API keys always start with "AIza"; "emulator"/undefined mean no real backend.
const apiKey: string = import.meta.env.VITE_FIREBASE_API_KEY ?? ''
const FIREBASE_DISABLED =
  import.meta.env.VITE_FIREBASE_DISABLED === 'true' || !apiKey.startsWith('AIza')

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// When FIREBASE_DISABLED=true, these are null at runtime but typed as non-null
// because multiplayer pages (which use them) are all behind RequireAuth and
// never render when there is no authenticated user.
let _auth: Auth | null = null
let _fsdb: Firestore | null = null
let _rtdb: Database | null = null

if (!FIREBASE_DISABLED) {
  const firebaseApp = initializeApp(firebaseConfig)
  _auth = getAuth(firebaseApp)
  _fsdb = getFirestore(firebaseApp)
  _rtdb = getDatabase(firebaseApp)

  // Match the emulator ports defined in firebase.json (auth 12088, firestore
  // 14701, rtdb 15047). Only connect on localhost / 127.0.0.1.
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    connectAuthEmulator(_auth, 'http://localhost:12088', { disableWarnings: true })
    connectFirestoreEmulator(_fsdb, 'localhost', 14701)
    connectDatabaseEmulator(_rtdb, 'localhost', 15047)
  }
}

export const auth = _auth as Auth
export const fsdb = _fsdb as Firestore
export const rtdb = _rtdb as Database
