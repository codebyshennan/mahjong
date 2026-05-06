import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { AnimatePresence, MotionConfig, motion, useAnimation } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { fsdb } from '../lib/firebase'
import { discardTile, drawForTurn } from '../game/turnActions'
import type { GameStateDoc } from '../game/initGame'
import type { Tile, Wind } from '../game/tileset'
import { WIND_EMOJI } from '../lib/types'
import { HandBacks, TileFace } from '../solo/Tile'
import { TableSurface } from '../solo/TableSurface'
import { isMuted, playSfx, toggleMuted } from '../solo/sounds'
import { useChat } from '../lib/rtdb-hooks'
import { useSeatBubbles, type Bubble } from '../lib/useSeatBubbles'
import { ChatDrawer } from '../solo/effects/ChatDrawer'
import { SpeechBubble } from '../solo/effects/SpeechBubble'

interface PlayerMeta {
  id: string
  name: string
  wind: Wind
  chips: number
  playerNumber: number
  currentScore: number
}

type SeatPos = 'bottom' | 'right' | 'top' | 'left'

const SEAT_OFFSETS: Record<SeatPos, { x: number; y: number }> = {
  bottom: { x: 0, y: 220 },
  right: { x: 320, y: 0 },
  top: { x: 0, y: -220 },
  left: { x: -320, y: 0 },
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
  const [muted, setMutedState] = useState(isMuted())
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [justDrawnKey, setJustDrawnKey] = useState<string | null>(null)
  const [shakeNonce, setShakeNonce] = useState(0)
  const prevHandIdsRef = useRef<Set<string>>(new Set())

  const { messages: chatMessages, send: sendChat } = useChat(`game/${roomId}/chats/`)
  const bubbles = useSeatBubbles(chatMessages, 5500)

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

  // Track freshly-drawn tile in my hand.
  useEffect(() => {
    const ids = new Set(myHand.map((t) => `${t.index}-${t.copy ?? 0}`))
    let newId: string | null = null
    if (prevHandIdsRef.current.size > 0) {
      for (const id of ids) {
        if (!prevHandIdsRef.current.has(id)) {
          newId = id
          break
        }
      }
    }
    prevHandIdsRef.current = ids
    if (newId) {
      setJustDrawnKey(newId)
      const t = setTimeout(() => setJustDrawnKey(null), 1400)
      return () => clearTimeout(t)
    }
  }, [myHand])

  const me = useMemo(() => players.find((p) => p.id === user.uid) ?? null, [players, user.uid])
  const isMyTurn = !!gameState && !!me && gameState.currentPlayer === me.playerNumber
  const phase = gameState?.turnPhase ?? 'draw'

  // Cue when it becomes your turn.
  const wasMyTurnRef = useRef(false)
  useEffect(() => {
    if (isMyTurn && !wasMyTurnRef.current) playSfx('turn')
    wasMyTurnRef.current = isMyTurn
  }, [isMyTurn])

  const flagIllegal = () => {
    playSfx('illegal')
    setShakeNonce((n) => n + 1)
  }

  const onDraw = async () => {
    if (busy) return
    if (!isMyTurn || phase !== 'draw') {
      flagIllegal()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await drawForTurn(fsdb, roomId, user.uid)
      playSfx('draw')
    } catch (e) {
      setError((e as Error).message)
      flagIllegal()
    } finally {
      setBusy(false)
    }
  }

  const onTileTap = async (tileIndex: number) => {
    if (busy) return
    if (!isMyTurn || phase !== 'discard') {
      flagIllegal()
      return
    }
    if (selectedIdx !== tileIndex) {
      playSfx('select')
      setSelectedIdx(tileIndex)
      return
    }
    // Confirm discard.
    setBusy(true)
    setError(null)
    try {
      await discardTile(fsdb, roomId, user.uid, tileIndex)
      playSfx('discard')
      setSelectedIdx(null)
    } catch (e) {
      setError((e as Error).message)
      flagIllegal()
    } finally {
      setBusy(false)
    }
  }

  const onToggleMute = () => {
    const next = toggleMuted()
    setMutedState(next)
    if (!next) playSfx('click')
  }

  if (!gameState) {
    return (
      <CenteredMessage>
        <p>Loading game…</p>
      </CenteredMessage>
    )
  }

  const opponents = players.filter((p) => p.id !== user.uid)
  // Place opponents around the table relative to me (left/top/right by player number).
  const myNumber = me?.playerNumber ?? 0
  const seatFor = (oppNumber: number): Exclude<SeatPos, 'bottom'> => {
    const diff = (oppNumber - myNumber + 4) % 4
    if (diff === 1) return 'right'
    if (diff === 2) return 'top'
    return 'left'
  }

  // Find the most recent discard across all players to animate into the center pool.
  const lastDiscardEntry = (() => {
    let best: { tile: Tile; pos: SeatPos; uid: string; name: string } | null = null
    let bestLen = 0
    for (const p of players) {
      const ds = discarded[p.id] ?? []
      if (ds.length === 0) continue
      if (ds.length >= bestLen) {
        bestLen = ds.length
        const pos: SeatPos = p.id === user.uid ? 'bottom' : seatFor(p.playerNumber)
        best = { tile: ds[ds.length - 1], pos, uid: p.id, name: p.name }
      }
    }
    return best
  })()

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-stone-950 text-stone-100">
        <header className="flex items-center justify-between gap-3 px-6 py-3 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-wide">🀨 麻将之王</h1>
            <span className="text-xs text-stone-500">
              Round {gameState.roundNumber} · Turn {gameState.currentTurnNo} · Tiles{' '}
              {gameState.tilesToPlay}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={onToggleMute}
              className="rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 px-2.5 py-1 text-xs"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={() => navigate('/lobby', { replace: true })}
              className="text-stone-300 hover:text-white"
            >
              Lobby
            </button>
            <button onClick={signOut} className="text-stone-300 hover:text-white">
              Logout
            </button>
          </div>
        </header>

        <main className="relative mx-auto max-w-[1200px] p-4">
          <TableSurface>
            <div
              className="grid gap-3 sm:gap-4"
              style={{
                gridTemplateColumns: 'minmax(140px, 1fr) minmax(0, 2.4fr) minmax(140px, 1fr)',
                gridTemplateRows: 'minmax(140px, auto) minmax(160px, 1fr) auto',
              }}
            >
              {opponents
                .filter((p) => seatFor(p.playerNumber) === 'top')
                .map((p) => (
                  <div key={p.id} className="col-start-2 row-start-1">
                    <OpponentSeat
                      player={p}
                      checked={checked[p.id] ?? []}
                      discarded={discarded[p.id] ?? []}
                      isCurrent={gameState.currentPlayer === p.playerNumber}
                      pos="top"
                    />
                  </div>
                ))}
              {opponents
                .filter((p) => seatFor(p.playerNumber) === 'left')
                .map((p) => (
                  <div key={p.id} className="col-start-1 row-start-2">
                    <OpponentSeat
                      player={p}
                      checked={checked[p.id] ?? []}
                      discarded={discarded[p.id] ?? []}
                      isCurrent={gameState.currentPlayer === p.playerNumber}
                      pos="left"
                    />
                  </div>
                ))}
              <div className="col-start-2 row-start-2 flex items-center justify-center">
                <CenterPool entry={lastDiscardEntry} prevailing={gameState.currentWind} />
              </div>
              {opponents
                .filter((p) => seatFor(p.playerNumber) === 'right')
                .map((p) => (
                  <div key={p.id} className="col-start-3 row-start-2">
                    <OpponentSeat
                      player={p}
                      checked={checked[p.id] ?? []}
                      discarded={discarded[p.id] ?? []}
                      isCurrent={gameState.currentPlayer === p.playerNumber}
                      pos="right"
                    />
                  </div>
                ))}
              <div className="col-span-3 row-start-3">
                <MeSeat
                  me={me}
                  hand={myHand}
                  checked={me ? (checked[me.id] ?? []) : []}
                  discarded={me ? (discarded[me.id] ?? []) : []}
                  isMyTurn={isMyTurn}
                  phase={phase}
                  selectedIdx={selectedIdx}
                  justDrawnKey={justDrawnKey}
                  shakeNonce={shakeNonce}
                  onTileTap={onTileTap}
                />
              </div>
            </div>
          </TableSurface>

          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap min-h-[44px]">
            {isMyTurn && phase === 'draw' && (
              <PrimaryBtn onClick={onDraw} disabled={busy}>
                Draw tile
              </PrimaryBtn>
            )}
            {isMyTurn && phase === 'discard' && selectedIdx !== null && (
              <PrimaryBtn onClick={() => onTileTap(selectedIdx)} disabled={busy}>
                Discard selected
              </PrimaryBtn>
            )}
            {isMyTurn && phase === 'discard' && selectedIdx === null && (
              <span className="text-xs text-emerald-200 italic">
                Tap a tile to select, tap again to discard
              </span>
            )}
            {!isMyTurn && (
              <span className="text-xs text-stone-400 italic">
                Waiting for{' '}
                {players[gameState.currentPlayer]?.name ?? 'next player'}…
              </span>
            )}
            {error && <span className="text-xs text-rose-400">{error}</span>}
          </div>
        </main>
      </div>
    </MotionConfig>
  )
}

function OpponentSeat({
  player,
  checked,
  discarded,
  isCurrent,
  pos,
}: {
  player: PlayerMeta
  checked: Tile[]
  discarded: Tile[]
  isCurrent: boolean
  pos: Exclude<SeatPos, 'bottom'>
}) {
  const isVertical = pos === 'left' || pos === 'right'
  return (
    <div
      className={[
        'relative h-full rounded-xl p-2.5 ring-1 transition-shadow',
        isCurrent
          ? 'ring-amber-300/80 animate-seat-glow bg-emerald-900/30'
          : 'ring-stone-800/60 bg-emerald-950/20',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{WIND_EMOJI[player.wind]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{player.name}</p>
          <p className="text-[10px] text-stone-400">
            Chips {player.chips} · Score {player.currentScore}
          </p>
        </div>
        {isCurrent && (
          <span className="text-[10px] uppercase tracking-wide bg-amber-300 text-stone-900 px-1.5 py-0.5 rounded font-bold">
            Turn
          </span>
        )}
      </div>
      <div className={`mt-2 flex ${isVertical ? 'flex-col' : 'flex-row'} gap-2`}>
        <div className={`flex ${isVertical ? 'justify-center' : 'items-center justify-center'} flex-1`}>
          {/* We don't subscribe to opponents' hand counts directly — show 13 backs as a proxy.
              When melds are extended, just show face-down stack sized by checked count. */}
          <HandBacks count={Math.max(0, 13 - checked.length)} size="sm" rotation={isVertical ? 90 : 0} />
        </div>
        {checked.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {checked.map((t, i) => (
              <TileFace key={`${t.index}-${i}`} tile={t} size="sm" />
            ))}
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="text-[10px] uppercase tracking-wider text-stone-400/80 mb-1">
          Discards · {discarded.length}
        </p>
        <div className="flex flex-wrap gap-0.5">
          <AnimatePresence initial={false}>
            {discarded.map((t, i) => (
              <motion.div
                key={`${t.index}-${i}`}
                initial={{ scale: 0.6, opacity: 0, y: -16 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                <TileFace tile={t} size="sm" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function CenterPool({
  entry,
  prevailing,
}: {
  entry: { tile: Tile; pos: SeatPos; uid: string; name: string } | null
  prevailing: Wind
}) {
  const offset = entry ? SEAT_OFFSETS[entry.pos] : { x: 0, y: 0 }
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/60">
          Prevailing · {prevailing}
        </p>
      </div>
      <div className="h-[110px] w-[110px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {entry ? (
            <motion.div
              key={`${entry.uid}-${entry.tile.index}-${entry.tile.copy ?? 0}`}
              initial={{
                x: offset.x,
                y: offset.y,
                scale: 0.55,
                opacity: 0,
                rotate: offset.x > 0 ? -22 : offset.x < 0 ? 22 : 0,
              }}
              animate={{
                x: [offset.x, offset.x * 0.45, 0],
                y: [offset.y, offset.y * 0.45 - 70, 0],
                scale: [0.55, 1.1, 1],
                rotate: [offset.x > 0 ? -22 : offset.x < 0 ? 22 : 0, 0, 0],
                opacity: [0, 1, 1],
              }}
              exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.18 } }}
              transition={{ duration: 0.55, times: [0, 0.55, 1], ease: ['easeOut', 'easeIn'] }}
              className="flex flex-col items-center gap-1"
              style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))' }}
            >
              <TileFace tile={entry.tile} size="lg" />
              <span className="text-[10px] uppercase tracking-wide text-amber-200/80">
                {entry.name}
              </span>
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-emerald-200/40 italic"
            >
              waiting for first discard
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function MeSeat({
  me,
  hand,
  checked,
  discarded,
  isMyTurn,
  phase,
  selectedIdx,
  justDrawnKey,
  shakeNonce,
  onTileTap,
}: {
  me: PlayerMeta | null
  hand: Tile[]
  checked: Tile[]
  discarded: Tile[]
  isMyTurn: boolean
  phase: GameStateDoc['turnPhase']
  selectedIdx: number | null
  justDrawnKey: string | null
  shakeNonce: number
  onTileTap: (i: number) => void
}) {
  const canDiscard = isMyTurn && phase === 'discard'
  const active = isMyTurn

  return (
    <div
      className={[
        'rounded-xl p-3 sm:p-4 ring-1 transition-shadow',
        active
          ? 'ring-amber-300/80 animate-seat-glow bg-emerald-900/30'
          : 'ring-stone-800/60 bg-emerald-950/20',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{me ? WIND_EMOJI[me.wind] : '?'}</span>
          <div>
            <p className="text-sm font-medium">
              {me?.name ?? 'You'}{' '}
              <span className="text-xs text-stone-400">(you)</span>
            </p>
            <p className="text-[10px] text-stone-400">
              Chips {me?.chips ?? 0} · Hand {hand.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {checked.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-stone-400">Checked</span>
              <div className="flex flex-wrap gap-1">
                {checked.map((t, i) => (
                  <TileFace key={`${t.index}-${i}`} tile={t} size="sm" />
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-stone-400">
              Discards · {discarded.length}
            </span>
            <div className="flex flex-wrap gap-0.5">
              <AnimatePresence initial={false}>
                {discarded.map((t, i) => (
                  <motion.div
                    key={`${t.index}-${i}`}
                    initial={{ scale: 0.6, opacity: 0, y: -16 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  >
                    <TileFace tile={t} size="sm" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <ShakeRow shakeNonce={shakeNonce}>
        <AnimatePresence initial={false}>
          {hand.map((t, i) => {
            const tileKey = `${t.index}-${t.copy ?? 0}`
            const isSelected = selectedIdx === i
            const isJustDrawn = justDrawnKey === tileKey
            return (
              <motion.div
                key={tileKey}
                layout
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: isSelected ? -16 : 0, opacity: 1 }}
                exit={{ y: -30, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
              >
                <TileFace
                  tile={t}
                  size="lg"
                  onClick={canDiscard ? () => onTileTap(i) : undefined}
                  selectable={canDiscard}
                  highlight={isSelected}
                  flipIn={isJustDrawn}
                  pulse={isJustDrawn}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </ShakeRow>
    </div>
  )
}

function ShakeRow({
  shakeNonce,
  children,
}: {
  shakeNonce: number
  children: React.ReactNode
}) {
  const controls = useAnimation()
  useEffect(() => {
    if (shakeNonce > 0) {
      void controls.start({
        x: [0, -7, 7, -5, 5, -3, 3, 0],
        transition: { duration: 0.42, ease: 'easeOut' },
      })
    }
  }, [shakeNonce, controls])
  return (
    <motion.div
      animate={controls}
      className="flex flex-wrap gap-1 justify-center pt-2"
      style={{ perspective: 800 }}
    >
      {children}
    </motion.div>
  )
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.04 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-stone-900 px-4 py-2 text-sm font-semibold shadow-md"
    >
      {children}
    </motion.button>
  )
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center text-center p-6">
      <div>{children}</div>
    </div>
  )
}
