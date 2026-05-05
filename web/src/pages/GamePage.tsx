import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../auth/AuthContext'
import { fsdb } from '../lib/firebase'
import { discardTile, drawForTurn } from '../game/turnActions'
import type { GameStateDoc } from '../game/initGame'
import type { Tile, Wind } from '../game/tileset'
import { WIND_EMOJI } from '../lib/types'

interface PlayerMeta {
  id: string
  name: string
  wind: Wind
  chips: number
  playerNumber: number
  currentScore: number
}

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  if (!roomId) return <Navigate to="/lobby" replace />
  return user ? <GameBody roomId={roomId} signOut={signOut} navigate={navigate} /> : null
}

function GameBody({
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

  const [gameState, setGameState] = useState<GameStateDoc | null>(null)
  const [players, setPlayers] = useState<PlayerMeta[]>([])
  const [myHand, setMyHand] = useState<Tile[]>([])
  const [checked, setChecked] = useState<Record<string, Tile[]>>({})
  const [discarded, setDiscarded] = useState<Record<string, Tile[]>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ref = doc(fsdb, 'games', roomId, 'gameState', roomId)
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setGameState(null)
        return
      }
      setGameState(snap.data() as GameStateDoc)
    })
  }, [roomId])

  useEffect(() => {
    const ref = collection(fsdb, 'games', roomId, 'players')
    return onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) => d.data() as PlayerMeta)
      list.sort((a, b) => a.playerNumber - b.playerNumber)
      setPlayers(list)
    })
  }, [roomId])

  // Subscribe only to *my own* hand — opponents' hands stay hidden.
  useEffect(() => {
    const ref = doc(fsdb, 'games', roomId, 'players', user.uid, 'tiles', 'playerHand')
    return onSnapshot(ref, (snap) =>
      setMyHand((snap.data()?.playerHand as Tile[] | undefined) ?? []),
    )
  }, [roomId, user.uid])

  // Public per-player checked + discarded subscriptions, keyed by uid.
  useEffect(() => {
    if (players.length === 0) return
    const unsubs = players.flatMap((p) => [
      onSnapshot(
        doc(fsdb, 'games', roomId, 'players', p.id, 'tiles', 'playerChecked'),
        (snap) =>
          setChecked((prev) => ({
            ...prev,
            [p.id]: (snap.data()?.playerChecked as Tile[] | undefined) ?? [],
          })),
      ),
      onSnapshot(
        doc(fsdb, 'games', roomId, 'players', p.id, 'tiles', 'playerDiscarded'),
        (snap) =>
          setDiscarded((prev) => ({
            ...prev,
            [p.id]: (snap.data()?.playerDiscarded as Tile[] | undefined) ?? [],
          })),
      ),
    ])
    return () => unsubs.forEach((u) => u())
  }, [players, roomId])

  const me = useMemo(() => players.find((p) => p.id === user.uid) ?? null, [players, user.uid])
  const isMyTurn = !!gameState && !!me && gameState.currentPlayer === me.playerNumber
  const phase = gameState?.turnPhase ?? 'draw'

  const onDraw = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await drawForTurn(fsdb, roomId, user.uid)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onDiscard = async (tileIndex: number) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await discardTile(fsdb, roomId, user.uid, tileIndex)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!gameState) {
    return (
      <CenteredMessage>
        <p>Loading game…</p>
      </CenteredMessage>
    )
  }

  const opponents = players.filter((p) => p.id !== user.uid)

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">🀨 麻将之王</h1>
          <span className="text-xs text-slate-500">
            Round {gameState.roundNumber} · Turn {gameState.currentTurnNo} ·{' '}
            Tiles left {gameState.tilesToPlay}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => navigate('/lobby', { replace: true })}
            className="text-slate-300 hover:text-white"
          >
            Lobby
          </button>
          <button onClick={signOut} className="text-slate-300 hover:text-white">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {opponents.map((p) => (
            <OpponentPanel
              key={p.id}
              player={p}
              checked={checked[p.id] ?? []}
              discarded={discarded[p.id] ?? []}
              isCurrent={gameState.currentPlayer === p.playerNumber}
            />
          ))}
        </section>

        <section className="rounded-lg ring-1 ring-slate-700 bg-slate-800/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{me ? WIND_EMOJI[me.wind] : '?'}</span>
              <div>
                <p className="font-medium text-sm">
                  {me?.name ?? user.displayName ?? user.email}{' '}
                  <span className="text-xs text-slate-400">(you)</span>
                </p>
                <p className="text-xs text-slate-500">
                  Chips {me?.chips ?? 0} · Hand {myHand.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isMyTurn ? (
                <span className="text-xs px-2 py-1 rounded bg-emerald-500 text-slate-900 font-medium">
                  Your turn — {phase === 'draw' ? 'draw a tile' : 'discard a tile'}
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                  Waiting for{' '}
                  {players.length === 4
                    ? (players[gameState.currentPlayer]?.name ?? 'next player')
                    : 'players to load'}
                  …
                </span>
              )}
              <button
                onClick={onDraw}
                disabled={!isMyTurn || phase !== 'draw' || busy}
                className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-900 px-3 py-1.5 text-sm font-medium"
              >
                Draw
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div>
            <p className="text-xs text-slate-500 mb-1">Checked / Flowers</p>
            <TileRow tiles={me ? (checked[me.id] ?? []) : []} />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Hand</p>
            <TileRow
              tiles={myHand}
              onClick={isMyTurn && phase === 'discard' ? onDiscard : undefined}
              clickable={isMyTurn && phase === 'discard' && !busy}
            />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Your discards</p>
            <TileRow tiles={me ? (discarded[me.id] ?? []) : []} />
          </div>
        </section>
      </main>
    </div>
  )
}

function OpponentPanel({
  player,
  checked,
  discarded,
  isCurrent,
}: {
  player: PlayerMeta
  checked: Tile[]
  discarded: Tile[]
  isCurrent: boolean
}) {
  return (
    <div
      className={`rounded-lg p-3 ring-1 ${
        isCurrent ? 'ring-emerald-500 bg-emerald-950/30' : 'ring-slate-700 bg-slate-800/40'
      } space-y-2`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{WIND_EMOJI[player.wind]}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{player.name}</p>
          <p className="text-xs text-slate-500">Chips {player.chips}</p>
        </div>
        {isCurrent && (
          <span className="text-[10px] uppercase tracking-wide bg-emerald-500 text-slate-900 px-1.5 py-0.5 rounded">
            Turn
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] text-slate-500 mb-0.5">Checked</p>
        <TileRow tiles={checked} dense />
      </div>
      <div>
        <p className="text-[10px] text-slate-500 mb-0.5">Discards ({discarded.length})</p>
        <TileRow tiles={discarded} dense />
      </div>
    </div>
  )
}

function TileRow({
  tiles,
  onClick,
  clickable,
  dense,
}: {
  tiles: Tile[]
  onClick?: (index: number) => void
  clickable?: boolean
  dense?: boolean
}) {
  if (tiles.length === 0) {
    return <p className="text-xs text-slate-600 italic">—</p>
  }
  const size = dense ? 'text-2xl' : 'text-4xl'
  return (
    <div className="flex flex-wrap gap-1">
      {tiles.map((t, i) => (
        <button
          key={`${t.name}-${t.copy ?? 0}-${i}`}
          type="button"
          onClick={onClick ? () => onClick(i) : undefined}
          disabled={!clickable}
          title={t.name}
          className={`${size} leading-none px-1 py-0.5 rounded ring-1 ring-slate-700 bg-slate-900 ${
            clickable ? 'hover:bg-emerald-900/40 hover:ring-emerald-500 cursor-pointer' : 'cursor-default'
          }`}
        >
          {t.suit}
        </button>
      ))}
    </div>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center text-center p-6">
      <div>{children}</div>
    </div>
  )
}
