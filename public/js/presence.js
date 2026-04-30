import { auth, rtdb, fsdb } from './firebase-init.js'
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js'
import { doc, setDoc, serverTimestamp as fsServerTimestamp } from 'https://www.gstatic.com/firebasejs/9.1.1/firebase-firestore.js'

/**
 * Starts RTDB + Firestore presence sync for the given user.
 * statusBasePath: e.g. 'online' (lobby) or 'status/<roomId>/players' (game/interstitial)
 */
export const startDBSync = (loggedInUser, statusBasePath) => {
  const path = `${statusBasePath}/${loggedInUser.uid}`
  const userStatusDatabaseRef = ref(rtdb, path)
  const userStatusFirestoreRef = doc(fsdb, path)

  const isOfflineForDatabase = {
    displayName: loggedInUser.displayName,
    photoURL: loggedInUser.photoURL,
    status: 'offline',
    last_changed: serverTimestamp(),
  }
  const isOnlineForDatabase = {
    displayName: loggedInUser.displayName,
    photoURL: loggedInUser.photoURL,
    status: 'online',
    last_changed: serverTimestamp(),
  }
  const isOfflineForFirestore = {
    displayName: loggedInUser.displayName,
    photoURL: loggedInUser.photoURL,
    state: 'offline',
    last_changed: fsServerTimestamp(),
  }
  const isOnlineForFirestore = {
    displayName: loggedInUser.displayName,
    photoURL: loggedInUser.photoURL,
    state: 'online',
    last_changed: fsServerTimestamp(),
  }

  onValue(ref(rtdb, '.info/connected'), (snapshot) => {
    if (snapshot.val() == false) {
      setDoc(userStatusFirestoreRef, isOfflineForFirestore)
      return
    }
    onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase)
      .then(() => {
        set(userStatusDatabaseRef, isOnlineForDatabase)
        setDoc(userStatusFirestoreRef, isOnlineForFirestore)
      })
  })
}
