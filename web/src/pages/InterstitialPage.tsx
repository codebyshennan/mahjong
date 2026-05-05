import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  setDoc,
  updateDoc,
  where,
  query,
} from 'firebase/firestore'
import { useAuth } from '../auth/AuthContext'
import { fsdb } from '../lib/firebase'
import { startPresenceSync } from '../lib/presence'
import { useCollection } from '../lib/firestore-hooks'
import { useChat } from '../lib/rtdb-hooks'
import { WIND_EMOJI, WIND_ORDER } from '../lib/types'
import type { OnlinePresence, Room, RoomPlayer, Wind } from '../lib/types'

const DEFAULT_AVATAR =
  'https://pbs.twimg.com/profile_images/740272510420258817/sd2e6kJy_400x400.jpg'

export default function InterstitialPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  if (!roomId) return <Navigate to="/lobby" replace />

  return user ? <InterstitialBody roomId={roomId} signOut={signOut} navigate={navigate} /> : null
}

function InterstitialBody({
  roomId,
  signOut,
  navigate,
}: {
  roomId: string
  signOut: () => Promise<void>
  navigate: (path: string, opts?: { replace: boolean }) => void
}) {
  const { user } = useAuth()
  if (!user) return null

  const [room, setRoom] = useState<Room | null>(null)
  const [roomMissing, setRoomMissing] = useState(false)

  // Subscribe to the lobby room doc.
  useEffect(() => {
    const ref = doc(fsdb, 'lobby', roomId)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setRoomMissing(true)
        return
      }
      setRoom(snap.data() as Room)
    })
  }, [roomId])

  // Per-room presence under status/<roomId>/players/<uid>.
  useEffect(() => {
    return startPresenceSync(user, `status/${roomId}/players`)
  }, [user, roomId])

  // Readiness collection: doc-exists = ready.
  const readinessQuery = useMemo(
    () => collection(fsdb, 'lobby', roomId, 'readiness'),
    [roomId],
  )
  const { items: readyItems } = useCollection<{ ready: number }>(readinessQuery)
  const readyUids = useMemo(() => new Set(readyItems.map((i) => i.id)), [readyItems])

  // Per-room online status.
  const statusQuery = useMemo(
    () =>
      query(
        collection(fsdb, 'status', roomId, 'players'),
        where('state', '==', 'online'),
      ),
    [roomId],
  )
  const { items: statusItems } = useCollection<OnlinePresence>(statusQuery)
  const onlineUids = useMemo(() => new Set(statusItems.map((i) => i.id)), [statusItems])

  // Auto-redirect on game start: gameState doc creation.
  useEffect(() => {
    const gsRef = collection(fsdb, 'games', roomId, 'gameState')
    return onSnapshot(gsRef, (snap) => {
      if (!snap.empty) {
        navigate(`/game/${roomId}`, { replace: true })
      }
    })
  }, [roomId, navigate])

  // When a peer's status flips offline (closed tab), prune them from the lobby
  // players array. All clients run this; updates are idempotent.
  useEffect(() => {
    if (!room) return
    const stillHere = new Set(onlineUids)
    stillHere.add(user.uid) // we're here even if our status doc lags
    stillHere.add(room.host.uid) // never prune the host
    const stale = room.players.filter((p) => !stillHere.has(p.uid))
    if (stale.length === 0) return
    const ref = doc(fsdb, 'lobby', roomId)
    Promise.all(
      stale.map((p) =>
        updateDoc(ref, {
          players: arrayRemove(p),
          playerCount: increment(-1),
        }),
      ),
    ).catch(() => {})
  }, [onlineUids, room, roomId, user.uid])

  // Chat over RTDB.
  const { messages, send } = useChat(`interstitial/${roomId}/chats/`)

  if (roomMissing) {
    return (
      <CenteredMessage>
        <p>Room no longer exists.</p>
        <button
          onClick={() => navigate('/lobby', { replace: true })}
          className="mt-3 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-4 py-2 text-sm font-medium"
        >
          Back to lobby
        </button>
      </CenteredMessage>
    )
  }

  if (!room) {
    return <CenteredMessage>Loading room…</CenteredMessage>
  }

  const isHost = room.host.uid === user.uid
  const seats = buildSeats(room)
  const allReady = readyUids.size === 4 && room.playerCount === 4
  const __DEV_ALLOW_START__ = import.meta.env.DEV && readyUids.size >= 1

  const onToggleReady = async () => {
    const ref = doc(fsdb, 'lobby', roomId, 'readiness', user.uid)
    if (readyUids.has(user.uid)) await deleteDoc(ref)
    else await setDoc(ref, { ready: 1 })
  }

  const onLeaveRoom = async () => {
    const me: RoomPlayer = {
      uid: user.uid,
      displayName: user.displayName,
      photoURL: user.photoURL,
    }
    await updateDoc(doc(fsdb, 'lobby', roomId), {
      players: arrayRemove(me),
      playerCount: increment(-1),
    })
    await deleteDoc(doc(fsdb, 'lobby', roomId, 'readiness', user.uid))
    navigate('/lobby', { replace: true })
  }

  // Host-only stub start: write a minimal gameState doc to trigger redirects.
  // Full deck/hand setup moves to P5 where the Player + tileset modules land.
  const onStartGame = async () => {
    await setDoc(doc(fsdb, 'games', roomId, 'gameState', roomId), {
      roomId,
      host: user.uid,
      windCount: 0,
      currentWind: 'east',
      currentPlayer: 0,
      currentTurnNo: 0,
      currentHouse: 'east',
      diceRolled: 0,
      timeStarted: new Date(),
      tilesInDiscard: 0,
      tilesInHands: 0,
      tilesToPlay: 148,
      roundNumber: 1,
      dealerSeat: 0,
      _stub: true, // remove in P5 once real init lands
    })
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold">🀨 麻将之王</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">{user.displayName ?? user.email}</span>
          <button onClick={signOut} className="text-slate-300 hover:text-white">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Waiting room</h2>
            <p className="text-sm text-slate-500">
              {room.playerCount} / 4 players · {readyUids.size} ready
            </p>
          </div>
          <div className="flex gap-2">
            {isHost ? (
              <button
                onClick={onStartGame}
                disabled={!allReady && !__DEV_ALLOW_START__}
                className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-900 px-4 py-2 text-sm font-medium"
              >
                Start game
              </button>
            ) : (
              <button
                onClick={onLeaveRoom}
                className="rounded-md bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm"
              >
                Leave room
              </button>
            )}
          </div>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {seats.map((seat) => (
            <SeatCard
              key={seat.uid ?? seat.wind}
              seat={seat}
              isOwn={seat.uid === user.uid}
              isReady={seat.uid ? readyUids.has(seat.uid) : false}
              onToggleReady={onToggleReady}
            />
          ))}
        </ul>

        <ChatPanel
          messages={messages}
          send={(m) => send({ name: user.displayName ?? user.email ?? 'anon', message: m })}
        />
      </main>
    </div>
  )
}

interface Seat {
  uid: string | null
  displayName: string | null
  photoURL: string | null
  wind: Wind
}

function buildSeats(room: Room): Seat[] {
  const out: Seat[] = [
    {
      uid: room.host.uid,
      displayName: room.host.displayName,
      photoURL: room.host.photoURL,
      wind: 'east',
    },
  ]
  for (let i = 0; i < 3; i++) {
    const p = room.players[i]
    out.push({
      uid: p?.uid ?? null,
      displayName: p?.displayName ?? null,
      photoURL: p?.photoURL ?? null,
      wind: WIND_ORDER[i + 1],
    })
  }
  return out
}

function SeatCard({
  seat,
  isOwn,
  isReady,
  onToggleReady,
}: {
  seat: Seat
  isOwn: boolean
  isReady: boolean
  onToggleReady: () => void
}) {
  const empty = !seat.uid
  return (
    <li
      className={`rounded-lg p-4 ring-1 ${
        empty
          ? 'bg-slate-900 ring-slate-800 text-slate-600'
          : isReady
            ? 'bg-emerald-950/40 ring-emerald-800/60'
            : 'bg-slate-800/60 ring-slate-700'
      } flex flex-col items-center text-center gap-2`}
    >
      <div className="text-3xl" aria-hidden>
        {WIND_EMOJI[seat.wind]}
      </div>
      {empty ? (
        <p className="text-sm">Waiting for player…</p>
      ) : (
        <>
          <img
            src={seat.photoURL ?? DEFAULT_AVATAR}
            alt=""
            className="size-12 rounded-full ring-1 ring-slate-700"
          />
          <p className="font-medium text-sm">{seat.displayName ?? 'Anon'}</p>
          {isOwn ? (
            <button
              onClick={onToggleReady}
              className={`text-xs px-3 py-1 rounded-md ${
                isReady
                  ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {isReady ? 'Waiting…' : 'Ready'}
            </button>
          ) : (
            <span className="text-xs text-slate-400">{isReady ? 'Ready' : '…'}</span>
          )}
        </>
      )}
    </li>
  )
}

function ChatPanel({
  messages,
  send,
}: {
  messages: { id: string; data: { name: string; message: string } }[]
  send: (msg: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    setDraft('')
    await send(trimmed)
  }

  return (
    <section className="rounded-lg bg-slate-800/40 ring-1 ring-slate-700 flex flex-col h-72">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1 text-sm">
        {messages.length === 0 ? (
          <p className="text-slate-500">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id}>
              <span className="font-semibold mr-1">{m.data.name}:</span>
              <span>{m.data.message}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={onSubmit} className="border-t border-slate-700 p-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a message…"
          className="flex-1 rounded-md bg-slate-900 ring-1 ring-slate-700 focus:ring-emerald-500 focus:outline-none px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-3 py-1.5 text-sm font-medium"
        >
          Send
        </button>
      </form>
    </section>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center text-center p-6">
      <div>{children}</div>
    </div>
  )
}
