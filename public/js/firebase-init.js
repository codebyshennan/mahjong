import firebaseConfig from './config.js'
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-auth.js";
import { getDatabase, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { getFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'

const firebase = initializeApp(firebaseConfig)
export const auth = getAuth()
export const rtdb = getDatabase(firebase)
export const fsdb = getFirestore(firebase)

if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  connectAuthEmulator(auth, "http://localhost:12088")
  connectDatabaseEmulator(rtdb, "localhost", 15047)
  connectFirestoreEmulator(fsdb, "localhost", 14701)
}
