import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  increment,
  query,
  runTransaction,
  where,
} from 'firebase/firestore'
import { useAuth } from '../auth/AuthContext'
import { fsdb } from '../lib/firebase'
import { startPresenceSync } from '../lib/presence'
import { useCollection } from '../lib/firestore-hooks'
import { ROOM_STATE, ROOM_STATE_LABEL } from '../lib/types'
import type { OnlinePresence, Room } from '../lib/types'

export default function LobbyPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [actionError, setActionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Register presence on mount; release on unmount (sets state offline so other tabs see it).
  useEffect(() => {
    if (!user) return
    return startPresenceSync(user, 'online')
  }, [user])

  const onlineQuery = useMemo(
    () => query(collection(fsdb, 'online'), where('state', '==', 'online')),
    [],
  )
  const lobbyQuery = useMemo(() => collection(fsdb, 'lobby'), [])

  const { items: onlineUsers } = useCollection<OnlinePresence>(onlineQuery)
  const { items: rooms } = useCollection<Room>(lobbyQuery)

  const myUid = user?.uid

  const onCreateRoom = async () => {
    if (!user) return
    setActionError(null)
    setCreating(true)
    try {
      const existing = await getDocs(
        query(collection(fsdb, 'lobby'), where('host.uid', '==', user.uid)),
      )
      if (!existing.empty) {
        setActionError('You can only host one room at a time.')
        navigate(`/interstitial/${existing.docs[0].id}`)
        return
      }
      const roomDoc = await addDoc(collection(fsdb, 'lobby'), {
        host: {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          playerWind: 'east',
          playerNo: 0,
        },
        state: ROOM_STATE.OPEN,
        players: [],
        playerCount: 1,
      } satisfies Room)
      navigate(`/interstitial/${roomDoc.id}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setCreating(false)
    }
  }

  const onJoinRoom = async (roomId: string, room: Room) => {
    if (!user) return
    setActionError(null)
    if (room.host.uid === user.uid) {
      navigate(`/interstitial/${roomId}`)
      return
    }
    try {
      await runTransaction(fsdb, async (tx) => {
        const ref = doc(fsdb, 'lobby', roomId)
        const snap = await tx.get(ref)
        if (!snap.exists()) throw new Error('Room does not exist')
        const data = snap.data() as Room
        if (data.playerCount >= 4) throw new Error('Room is full')
        if (data.players.some((p) => p.uid === user.uid)) return
        tx.update(ref, {
          players: arrayUnion({
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
          }),
          state: ROOM_STATE.JOINED,
          playerCount: increment(1),
        })
      })
      navigate(`/interstitial/${roomId}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to join room')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold">🀨 麻将之王</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">{user?.displayName || user?.email}</span>
          <button onClick={signOut} className="text-slate-300 hover:text-white">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
        {actionError && (
          <div className="rounded-md bg-rose-950/60 ring-1 ring-rose-800 px-4 py-2 text-sm text-rose-300">
            {actionError}
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Rooms</h2>
            <button
              onClick={onCreateRoom}
              disabled={creating}
              className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-900 px-4 py-2 text-sm font-medium"
            >
              {creating ? 'Creating…' : 'Create room'}
            </button>
          </div>
          {rooms.length === 0 ? (
            <p className="text-sm text-slate-500">No open rooms. Create one to start a game.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rooms.map(({ id, data }) => {
                const isOwn = data.host.uid === myUid
                const isFull = data.playerCount >= 4
                const label = ROOM_STATE_LABEL[data.state]
                return (
                  <li
                    key={id}
                    className="rounded-lg bg-slate-800/60 ring-1 ring-slate-700 p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {isOwn ? 'Your room' : `${data.host.displayName ?? 'Anon'}'s room`}
                      </div>
                      <div className="text-sm text-slate-400">
                        {data.playerCount} / 4 · {label}
                      </div>
                    </div>
                    <button
                      onClick={() => onJoinRoom(id, data)}
                      disabled={!isOwn && isFull}
                      className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-1.5 text-sm"
                    >
                      {isOwn ? 'Re-enter' : isFull ? 'Full' : 'Join'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-medium mb-3">Online ({onlineUsers.length})</h2>
          {onlineUsers.length === 0 ? (
            <p className="text-sm text-slate-500">Just you for now.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {onlineUsers.map(({ id, data }) => (
                <li
                  key={id}
                  className="rounded-full bg-slate-800/60 ring-1 ring-slate-700 px-3 py-1 text-sm flex items-center gap-2"
                >
                  <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
                  {data.displayName ?? 'Anon'}
                  {id === myUid && <span className="text-xs text-slate-500">(you)</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
