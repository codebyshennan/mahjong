import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set as rtdbSet,
} from 'firebase/database'
import { doc, serverTimestamp as fsServerTimestamp, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { fsdb, rtdb } from './firebase'

/**
 * Sync presence to RTDB + Firestore at `<basePath>/<uid>`.
 *   - basePath = 'online' for lobby presence
 *   - basePath = `status/<roomId>/players` for in-game presence
 *
 * Returns the unsubscribe for the .info/connected listener. Tab-close is
 * handled by the RTDB onDisconnect handler (mirrored to Firestore by a
 * Cloud Function trigger). Logout clears via `clearPresence` below.
 */
export function startPresenceSync(user: User, basePath: string) {
  const path = `${basePath}/${user.uid}`
  const rtdbStatusRef = ref(rtdb, path)
  const fsStatusRef = doc(fsdb, path)

  const baseProfile = {
    displayName: user.displayName,
    photoURL: user.photoURL,
  }
  const offlineRtdb = { ...baseProfile, status: 'offline', last_changed: rtdbServerTimestamp() }
  const onlineRtdb = { ...baseProfile, status: 'online', last_changed: rtdbServerTimestamp() }
  const offlineFs = { ...baseProfile, state: 'offline' as const, last_changed: fsServerTimestamp() }
  const onlineFs = { ...baseProfile, state: 'online' as const, last_changed: fsServerTimestamp() }

  return onValue(ref(rtdb, '.info/connected'), (snap) => {
    if (snap.val() === false) {
      setDoc(fsStatusRef, offlineFs).catch(() => {})
      return
    }
    onDisconnect(rtdbStatusRef)
      .set(offlineRtdb)
      .then(() => {
        rtdbSet(rtdbStatusRef, onlineRtdb).catch(() => {})
        setDoc(fsStatusRef, onlineFs).catch(() => {})
      })
      .catch(() => {})
  })
}

/**
 * Mark the user offline at `<basePath>/<uid>`. Call before logout so the
 * presence collection reflects the explicit sign-out.
 */
export async function clearPresence(uid: string, basePath: string, profile: { displayName: string | null; photoURL: string | null }) {
  const path = `${basePath}/${uid}`
  const offlineRtdb = { ...profile, status: 'offline', last_changed: rtdbServerTimestamp() }
  const offlineFs = { ...profile, state: 'offline' as const, last_changed: fsServerTimestamp() }
  await Promise.allSettled([rtdbSet(ref(rtdb, path), offlineRtdb), setDoc(doc(fsdb, path), offlineFs)])
}
