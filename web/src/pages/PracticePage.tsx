import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion, useAnimation } from 'framer-motion'
import { sortHand } from '../game/sortHand'
import type { Tile } from '../game/tileset'
import { checkWin } from '../game/winCheck'
import { findChowOptions, findPongTiles } from '../solo/claims'
import { decide } from '../solo/bot'
import type { Difficulty } from '../solo/bot'
import {
  applyChow,
  applyDiscard,
  applyDiscardWin,
  applyDraw,
  applyPong,
  applySelfDrawWin,
  newGame,
  nextRound,
  passClaimWindow,
} from '../solo/state'
import type { Seat, SoloPlayer, SoloState } from '../solo/state'
import { viewFor } from '../solo/seatView'

// ─── Inline SVG icon primitives ───────────────────────────────────────────────
function SvgIcon({ d, className = 'w-4 h-4' }: { d: string | string[]; className?: string }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

const ICONS = {
  volume:   ['M11 5 6 9H2v6h4l5 4V5z', 'M15.54 8.46a5 5 0 0 1 0 7.07', 'M19.07 4.93a10 10 0 0 1 0 14.14'],
  mute:     ['M11 5 6 9H2v6h4l5 4V5z', 'M23 9l-6 6', 'M17 9l6 6'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
             'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
  expand:   ['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7'],
  compress: ['M4 14h6v6', 'M20 10h-6V4', 'M14 10l7-7', 'M3 21l7-7'],
} satisfies Record<string, string[]>

const WIND_CFG: Record<string, { char: string; bg: string; text: string }> = {
  east:  { char: '東', bg: 'bg-red-800',     text: 'text-red-100'     },
  south: { char: '南', bg: 'bg-emerald-800', text: 'text-emerald-100' },
  west:  { char: '西', bg: 'bg-stone-600',   text: 'text-stone-100'   },
  north: { char: '北', bg: 'bg-blue-800',    text: 'text-blue-100'    },
}

function WindBadge({ wind, size = 'sm' }: { wind: string; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = WIND_CFG[wind] ?? { char: wind[0], bg: 'bg-stone-700', text: 'text-stone-100' }
  const sizeClass =
    size === 'lg' ? 'w-8 h-8 text-sm' : size === 'md' ? 'w-6 h-6 text-[11px]' : 'w-5 h-5 text-[9px]'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold shrink-0 ${sizeClass} ${cfg.bg} ${cfg.text}`}
    >
      {cfg.char}
    </span>
  )
}
import { HandBacks, MobileFanBacks, TileFace } from '../solo/Tile'
import { TableSurface } from '../solo/TableSurface'
import { Stamp } from '../solo/effects/Stamp'
import type { StampTone } from '../solo/effects/Stamp'
import { WinFlourish } from '../solo/effects/WinFlourish'
import { SpeechBubble } from '../solo/effects/SpeechBubble'
import { ShuffleDealing } from '../solo/effects/ShuffleDealing'
import type { Bubble } from '../lib/useSeatBubbles'
import { isMuted, playSfx, toggleMuted } from '../solo/sounds'
import { answerQuestion, coachInfo, isOptimalDiscard, shantenLabel, waitTiles } from '../solo/coach'
import { CoachInline } from '../solo/effects/CoachChat'
import { countSeen, remainingByGroup } from '../solo/tileCounts'
import type { TileGroup } from '../solo/tileCounts'
import { avgTai, loadStats, recordRound, resetStats, winRate } from '../solo/stats'
import type { PracticeStats } from '../solo/stats'

type GamePhase = 'intro' | 'dealing' | 'playing'

const BOT_DELAY_MS = 700
const CLAIM_PASS_DELAY_MS = 350
const HUMAN_CLAIM_TIMEOUT_MS = 8000
const HUMAN_SEAT: Seat = 0

const SPEEDS: { label: string; value: number }[] = [
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
]

const DIFFICULTIES: { label: string; value: Difficulty }[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Normal', value: 'normal' },
  { label: 'Hard', value: 'hard' },
]

function useHandTileSize(): 'md' | 'lg' {
  const [size, setSize] = useState<'md' | 'lg'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'md' : 'lg',
  )
  useEffect(() => {
    const handler = () => setSize(window.innerWidth < 640 ? 'md' : 'lg')
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return size
}

const PREFS_KEY = 'mahjong:practice-prefs'

interface Prefs {
  speed: number
  difficulty: Difficulty
  coach: boolean
  showCounter: boolean
}

const defaultPrefs: Prefs = {
  speed: 1,
  difficulty: 'normal',
  coach: false,
  showCounter: false,
}

function loadPrefs(): Prefs {
  if (typeof window === 'undefined') return defaultPrefs
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs
  } catch {
    return defaultPrefs
  }
}

function savePrefs(p: Prefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // ignore
  }
}

interface HumanClaims {
  canPong: [number, number] | null
  chowOptions: ReturnType<typeof findChowOptions>
  canWin: boolean
}

type SeatPos = 'bottom' | 'right' | 'top' | 'left'

export default function PracticePage() {
  const navigate = useNavigate()
  const [gamePhase, setGamePhase] = useState<GamePhase>('intro')
  const [state, setState] = useState<SoloState>(() => newGame())
  const [tick, setTick] = useState(0)
  const [muted, setMutedState] = useState(isMuted())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [flash, setFlash] = useState<{ text: string; tone: StampTone; subtitle?: string } | null>(null)
  const [winBurstId, setWinBurstId] = useState(0)
  const [recentDiscard, setRecentDiscard] = useState<{ seat: Seat; tile: Tile } | null>(null)
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null)
  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs())
  const [stats, setStats] = useState<PracticeStats>(() => loadStats())
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false)
  const [selectedSortedIdx, setSelectedSortedIdx] = useState<number | null>(null)
  const [claimDeadline, setClaimDeadline] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [justDrawnKey, setJustDrawnKey] = useState<string | null>(null)
  const [shakeNonce, setShakeNonce] = useState(0)
  const prevHandIdsRef = useRef<Set<string>>(new Set())
  const [botBubbles, setBotBubbles] = useState<Partial<Record<Seat, Bubble>>>({})
  const botPrevRef = useRef<Record<Seat, { checkedLen: number; isWinner: boolean }>>({
    0: { checkedLen: 0, isWinner: false },
    1: { checkedLen: 0, isWinner: false },
    2: { checkedLen: 0, isWinner: false },
    3: { checkedLen: 0, isWinner: false },
  })
  const busyRef = useRef(false)
  const lastEventRef = useRef<{
    discard: { seat: Seat; tile: Tile } | null
    winner: Seat | null
  }>({
    discard: state.lastDiscard,
    winner: state.winner,
  })
  const recordedWinnerRef = useRef<Seat | null>(null)

  const setPrefs = useCallback((next: Partial<Prefs>) => {
    setPrefsState((p) => {
      const merged = { ...p, ...next }
      savePrefs(merged)
      return merged
    })
  }, [])

  const bump = () => setTick((n) => n + 1)

  const speedDivisor = prefs.speed
  const botDelay = Math.round(BOT_DELAY_MS / speedDivisor)
  const passDelay = Math.round(CLAIM_PASS_DELAY_MS / speedDivisor)
  const humanClaimTimeout = Math.round(HUMAN_CLAIM_TIMEOUT_MS / speedDivisor)

  // Compute what the human could claim on the live discard.
  const humanClaims = useMemo<HumanClaims | null>(() => {
    if (state.turnPhase !== 'claim-window' || !state.lastDiscard) return null
    if (state.lastDiscard.seat === HUMAN_SEAT) return null
    const me = state.players[HUMAN_SEAT]
    const tile = state.lastDiscard.tile
    const canPong = findPongTiles(me.playerHand, tile)
    const isNextSeat = (state.lastDiscard.seat + 1) % 4 === HUMAN_SEAT
    const chowOptions = isNextSeat ? findChowOptions(me.playerHand, tile) : []
    const canWin = checkWin([...me.playerHand, tile], me.playerChecked).win
    if (!canPong && chowOptions.length === 0 && !canWin) return null
    return { canPong, chowOptions, canWin }
  }, [state, tick])

  const humanCanSelfDrawWin = useMemo(() => {
    if (state.turnPhase !== 'discard') return false
    if (state.currentPlayer !== HUMAN_SEAT) return false
    const me = state.players[HUMAN_SEAT]
    return checkWin(me.playerHand, me.playerChecked).win
  }, [state, tick])

  const me = state.players[HUMAN_SEAT]
  const myCoach = useMemo(
    () => coachInfo(me.playerHand, me.playerMelds),
    [me.playerHand, me.playerMelds, tick],
  )
  const myWaits = useMemo<string[]>(() => {
    if (!myCoach.tenpai) return []
    return waitTiles(me.playerHand, me.playerChecked)
  }, [myCoach.tenpai, me.playerHand, me.playerChecked, tick])
  const myWaitSet = useMemo(() => new Set(myWaits), [myWaits])
  const seenCounts = useMemo(() => countSeen(state, HUMAN_SEAT), [state, tick])

  // Track the freshly-drawn tile in the human's hand so we can pulse + flip it.
  useEffect(() => {
    const ids = new Set(
      state.players[HUMAN_SEAT].playerHand.map((t) => `${t.index}-${t.copy ?? 0}`),
    )
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
  }, [state.players, tick])

  const flagIllegal = useCallback(() => {
    playSfx('illegal')
    setShakeNonce((n) => n + 1)
  }, [])

  // Bot personality: small reactions when bots claim or win.
  useEffect(() => {
    const updates: Partial<Record<Seat, Bubble>> = {}
    for (const seat of [1, 2, 3] as Seat[]) {
      const p = state.players[seat]
      const prev = botPrevRef.current[seat]
      const isWinner = state.winner === seat
      if (!prev.isWinner && isWinner) {
        updates[seat] = {
          id: `${seat}-win-${Date.now()}`,
          text: 'Win!',
          ts: Date.now(),
          kind: 'reaction',
        }
      } else if (p.playerChecked.length > prev.checkedLen) {
        updates[seat] = {
          id: `${seat}-claim-${Date.now()}`,
          text: 'Ha!',
          ts: Date.now(),
          kind: 'reaction',
        }
      }
      botPrevRef.current[seat] = { checkedLen: p.playerChecked.length, isWinner }
    }
    // Fed-the-win drama: when a discard-win lands, the discarder reacts 😩.
    if (
      state.winner !== null &&
      state.winType === 'discard-win' &&
      state.lastDiscard &&
      state.lastDiscard.seat !== state.winner
    ) {
      const fedSeat = state.lastDiscard.seat
      if (fedSeat !== HUMAN_SEAT) {
        updates[fedSeat] = {
          id: `${fedSeat}-fed-${Date.now()}`,
          text: 'Oh no!',
          ts: Date.now(),
          kind: 'reaction',
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setBotBubbles((prev) => ({ ...prev, ...updates }))
    }
  }, [state, tick])

  // Expire bot bubbles after ~4.5s.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setBotBubbles((prev) => {
        let changed = false
        const next: Partial<Record<Seat, Bubble>> = {}
        for (const [k, v] of Object.entries(prev) as [string, Bubble][]) {
          if (now - v.ts > 4500) {
            changed = true
            continue
          }
          next[Number(k) as Seat] = v
        }
        return changed ? next : prev
      })
    }, 800)
    return () => clearInterval(id)
  }, [])

  // Sound + flash side-effects on phase transitions.
  useEffect(() => {
    const prev = lastEventRef.current
    if (state.lastDiscard && state.lastDiscard !== prev.discard) {
      playSfx('discard')
      setRecentDiscard(state.lastDiscard)
    }
    if (state.winner !== null && prev.winner === null) {
      playSfx('win')
      setWinBurstId((n) => n + 1)
      setFlash({
        text: 'MAHJONG!',
        tone: 'win',
        subtitle: state.winType === 'self-draw' ? '自摸 · self-draw' : '胡牌 · won on discard',
      })
      const t = setTimeout(() => setFlash(null), 2200)
      lastEventRef.current = { discard: state.lastDiscard, winner: state.winner }
      return () => clearTimeout(t)
    }
    lastEventRef.current = { discard: state.lastDiscard, winner: state.winner }
  }, [state.lastDiscard, state.winner, state.winType, tick])

  // Record stats once per round-end.
  useEffect(() => {
    if (state.turnPhase !== 'over') return
    if (recordedWinnerRef.current === state.winner && state.winner !== null) return
    if (recordedWinnerRef.current !== null && state.winner === null) return

    if (state.winner === null) {
      setStats(recordRound({ kind: 'draw' }))
    } else if (state.winner === HUMAN_SEAT && state.result) {
      setStats(
        recordRound({
          kind: state.winType === 'self-draw' ? 'self-draw-win' : 'discard-win',
          tai: state.result.scoring.tai,
        }),
      )
    } else {
      setStats(recordRound({ kind: 'lose' }))
    }
    recordedWinnerRef.current = state.winner
  }, [state.turnPhase, state.winner, state.winType, state.result])

  // Driver loop — one transition per tick.
  useEffect(() => {
    if (gamePhase !== 'playing') return
    if (state.turnPhase === 'over') return
    if (busyRef.current) return

    let action: (() => void) | null = null
    let delayMs = botDelay

    const seat = state.currentPlayer
    const isBot = state.players[seat].isBot

    if (state.turnPhase === 'draw' && isBot) {
      action = () => applyDraw(state)
    } else if (state.turnPhase === 'discard' && isBot) {
      const view = viewFor(state, seat)
      const decision = decide(view, prefs.difficulty)
      if (decision.kind === 'self-draw-win') action = () => applySelfDrawWin(state)
      else if (decision.kind === 'discard') {
        const idx = decision.tileIdx
        action = () => applyDiscard(state, idx)
      }
    } else if (state.turnPhase === 'claim-window' && state.lastDiscard) {
      // Pass 1: any bot can claim a win?
      let botWinSeat: Seat | null = null
      for (const s of [0, 1, 2, 3] as Seat[]) {
        if (s === state.lastDiscard.seat) continue
        if (!state.players[s].isBot) continue
        const view = viewFor(state, s)
        const decision = decide(view, prefs.difficulty)
        if (decision.kind === 'claim-win') {
          botWinSeat = s
          break
        }
      }
      if (botWinSeat !== null) {
        const winSeat = botWinSeat
        action = () => applyDiscardWin(state, winSeat)
        delayMs = passDelay
      } else if (humanClaims) {
        // Wait for human input — handled by the claim-timer effect below.
        return
      } else {
        // Pass 2: any bot wants to pong (hard difficulty only).
        let pongSeat: Seat | null = null
        let pongIndices: [number, number] | null = null
        for (const s of [0, 1, 2, 3] as Seat[]) {
          if (s === state.lastDiscard.seat) continue
          if (!state.players[s].isBot) continue
          const view = viewFor(state, s)
          const decision = decide(view, prefs.difficulty)
          if (decision.kind === 'claim-pong') {
            pongSeat = s
            pongIndices = decision.handIndices
            break
          }
        }
        if (pongSeat !== null && pongIndices) {
          const ps = pongSeat
          const pi = pongIndices
          action = () => applyPong(state, ps, pi)
          delayMs = passDelay
        } else {
          action = () => passClaimWindow(state)
          delayMs = passDelay
        }
      }
    }

    if (!action) return
    const run = action
    busyRef.current = true
    let cancelled = false
    void (async () => {
      await sleep(delayMs)
      if (cancelled) {
        busyRef.current = false
        return
      }
      try {
        run()
      } finally {
        busyRef.current = false
        bump()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gamePhase, state, tick, humanClaims, prefs.difficulty, botDelay, passDelay])

  // Claim countdown — only when the human has options on the table.
  useEffect(() => {
    if (humanClaims) {
      setClaimDeadline(Date.now() + humanClaimTimeout)
    } else {
      setClaimDeadline(null)
    }
  }, [humanClaims, humanClaimTimeout])

  useEffect(() => {
    if (claimDeadline === null) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [claimDeadline])

  // Auto-pass when the human countdown hits zero.
  useEffect(() => {
    if (gamePhase !== 'playing') return
    if (claimDeadline === null) return
    if (now < claimDeadline) return
    if (state.turnPhase !== 'claim-window') return
    if (busyRef.current) return
    busyRef.current = true
    try {
      passClaimWindow(state)
    } finally {
      busyRef.current = false
      bump()
    }
  }, [claimDeadline, now, state])

  // Clear tile selection when the discard window closes.
  useEffect(() => {
    if (state.turnPhase !== 'discard' || state.currentPlayer !== HUMAN_SEAT) {
      setSelectedSortedIdx(null)
    }
  }, [state.turnPhase, state.currentPlayer, tick])

  const onHumanDraw = useCallback(() => {
    if (state.currentPlayer !== HUMAN_SEAT || state.turnPhase !== 'draw') return
    applyDraw(state)
    playSfx('draw')
    bump()
  }, [state])

  const onHumanDiscard = useCallback(
    (tileIdx: number) => {
      if (state.currentPlayer !== HUMAN_SEAT || state.turnPhase !== 'discard') return
      applyDiscard(state, tileIdx)
      setSelectedSortedIdx(null)
      bump()
    },
    [state],
  )

  const onHumanSelfDrawWin = useCallback(() => {
    if (!humanCanSelfDrawWin) return
    applySelfDrawWin(state)
    bump()
  }, [state, humanCanSelfDrawWin])

  const onHumanPong = useCallback(() => {
    if (!humanClaims?.canPong) return
    playSfx('claim')
    setFlash({ text: 'PONG!', tone: 'claim' })
    setTimeout(() => setFlash(null), 900)
    applyPong(state, HUMAN_SEAT, humanClaims.canPong)
    bump()
  }, [state, humanClaims])

  const onHumanChow = useCallback(
    (idx: number) => {
      const opt = humanClaims?.chowOptions[idx]
      if (!opt) return
      playSfx('claim')
      setFlash({ text: 'CHOW!', tone: 'claim' })
      setTimeout(() => setFlash(null), 900)
      applyChow(state, HUMAN_SEAT, opt.handIndices)
      bump()
    },
    [state, humanClaims],
  )

  const onHumanClaimWin = useCallback(() => {
    if (!humanClaims?.canWin) return
    applyDiscardWin(state, HUMAN_SEAT)
    bump()
  }, [state, humanClaims])

  const onHumanPass = useCallback(() => {
    if (state.turnPhase !== 'claim-window') return
    passClaimWindow(state)
    bump()
  }, [state])

  const onNewGame = () => {
    busyRef.current = false
    setRecentDiscard(null)
    setSelectedSortedIdx(null)
    recordedWinnerRef.current = null
    setState(newGame())
    setGamePhase('dealing')
  }

  const onNextRound = () => {
    busyRef.current = false
    setRecentDiscard(null)
    setSelectedSortedIdx(null)
    recordedWinnerRef.current = null
    nextRound(state)
    bump()
  }

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const onToggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen?.()
    }
  }

  const onToggleMute = () => {
    const next = toggleMuted()
    setMutedState(next)
    if (!next) playSfx('click')
  }

  const onResetStats = () => {
    setStats(resetStats())
  }

  const myHandSorted = useMemo(() => sortHand(me.playerHand, 'name'), [me.playerHand, tick])
  const sortedIndexMap = useMemo(() => {
    const used = new Set<number>()
    return myHandSorted.map((t) => {
      const i = me.playerHand.findIndex((h, idx) => h.index === t.index && !used.has(idx))
      used.add(i)
      return i
    })
  }, [myHandSorted, me.playerHand, tick])

  const isMyTurn = state.currentPlayer === HUMAN_SEAT
  const winner = state.winner !== null ? state.players[state.winner] : null

  const myAdvice = useMemo(
    () =>
      buildAdvice({
        state,
        hand: me.playerHand,
        coach: myCoach,
        isMyTurn,
        humanCanSelfDrawWin,
        humanClaims,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, me.playerHand, myCoach, isMyTurn, humanCanSelfDrawWin, humanClaims, tick],
  )

  const onCoachAnswer = useCallback(
    (question: string) =>
      answerQuestion(question, {
        shanten: myCoach.shanten,
        tenpai: myCoach.tenpai,
        waits: myWaits,
        advice: myAdvice,
      }),
    [myCoach.shanten, myCoach.tenpai, myWaits, myAdvice],
  )

  // ── Two-step discard: first click selects, second click on same tile commits.
  const onTileTap = useCallback(
    (sortedIdx: number) => {
      if (!isMyTurn || state.turnPhase !== 'discard') {
        flagIllegal()
        return
      }
      if (selectedSortedIdx === sortedIdx) {
        onHumanDiscard(sortedIndexMap[sortedIdx])
      } else {
        playSfx('select')
        setSelectedSortedIdx(sortedIdx)
      }
    },
    [isMyTurn, state.turnPhase, selectedSortedIdx, sortedIndexMap, onHumanDiscard, flagIllegal],
  )

  // ── Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const key = e.key.toLowerCase()
      if (key === 'd' && isMyTurn && state.turnPhase === 'draw') {
        e.preventDefault()
        onHumanDraw()
        return
      }
      if (key === 'w') {
        if (humanCanSelfDrawWin) {
          e.preventDefault()
          onHumanSelfDrawWin()
          return
        }
        if (humanClaims?.canWin) {
          e.preventDefault()
          onHumanClaimWin()
          return
        }
      }
      if (key === 'p' && humanClaims?.canPong) {
        e.preventDefault()
        onHumanPong()
        return
      }
      if (humanClaims?.chowOptions.length) {
        const n = parseInt(key, 10)
        if (n >= 1 && n <= humanClaims.chowOptions.length) {
          e.preventDefault()
          onHumanChow(n - 1)
          return
        }
      }
      if ((key === 'escape' || key === 'x') && humanClaims) {
        e.preventDefault()
        onHumanPass()
        return
      }
      if (
        key === ' ' &&
        isMyTurn &&
        state.turnPhase === 'discard' &&
        selectedSortedIdx !== null
      ) {
        e.preventDefault()
        onHumanDiscard(sortedIndexMap[selectedSortedIdx])
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    isMyTurn,
    state.turnPhase,
    humanCanSelfDrawWin,
    humanClaims,
    selectedSortedIdx,
    sortedIndexMap,
    onHumanDraw,
    onHumanSelfDrawWin,
    onHumanClaimWin,
    onHumanPong,
    onHumanChow,
    onHumanPass,
    onHumanDiscard,
  ])

  const claimRemainingMs =
    claimDeadline === null ? null : Math.max(0, claimDeadline - now)
  const claimProgress =
    claimRemainingMs === null ? 0 : claimRemainingMs / humanClaimTimeout

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-[100dvh] flex flex-col bg-stone-950 text-stone-100 overflow-hidden">
        <header className="shrink-0 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur">
          <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-wide whitespace-nowrap flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-700 text-white text-[10px] font-bold leading-none">中</span>
                Practice
              </h1>
              <span className="hidden sm:inline text-xs text-stone-500">
                Round {state.roundNumber} · Turn {state.currentTurnNo} · Tiles {state.deck.length}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                <SegToggle
                  label="Speed"
                  value={prefs.speed}
                  options={SPEEDS}
                  onChange={(v) => setPrefs({ speed: v })}
                />
                <SegToggle
                  label="Bots"
                  value={prefs.difficulty}
                  options={DIFFICULTIES}
                  onChange={(v) => setPrefs({ difficulty: v })}
                />
                <ToggleBtn
                  active={prefs.coach}
                  onClick={() => setPrefs({ coach: !prefs.coach })}
                  title="Show shanten + dim deadweight"
                >
                  Coach
                </ToggleBtn>
                <ToggleBtn
                  active={prefs.showCounter}
                  onClick={() => setPrefs({ showCounter: !prefs.showCounter })}
                  title="Show remaining tile counts"
                >
                  Tiles
                </ToggleBtn>
                <button
                  onClick={onToggleMute}
                  className="rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 p-1.5"
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  <SvgIcon d={ICONS[muted ? 'mute' : 'volume']} />
                </button>
                <button
                  onClick={onToggleFullscreen}
                  className="rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 p-1.5"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  <SvgIcon d={ICONS[isFullscreen ? 'compress' : 'expand']} />
                </button>
                <button onClick={onNewGame} className="text-stone-300 hover:text-white text-sm">
                  Reshuffle
                </button>
              </div>
              <button
                onClick={onToggleMute}
                className="sm:hidden rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 p-1.5"
                title={muted ? 'Unmute' : 'Mute'}
              >
                <SvgIcon d={ICONS[muted ? 'mute' : 'volume']} />
              </button>
              <button
                className="sm:hidden rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 p-1.5"
                onClick={() => setMobileSettingsOpen((o) => !o)}
                title="Settings"
              >
                <SvgIcon d={ICONS.settings} />
              </button>
              <button
                onClick={() => navigate('/lobby', { replace: true })}
                className="text-stone-300 hover:text-white text-sm"
              >
                Lobby
              </button>
            </div>
          </div>
          {mobileSettingsOpen && (
            <div className="sm:hidden flex flex-wrap items-center gap-2 px-3 pb-2 pt-1 border-t border-stone-800/60">
              <span className="text-[10px] text-stone-500 w-full">
                Round {state.roundNumber} · Turn {state.currentTurnNo} · Tiles {state.deck.length}
              </span>
              <SegToggle
                label="Speed"
                value={prefs.speed}
                options={SPEEDS}
                onChange={(v) => setPrefs({ speed: v })}
              />
              <SegToggle
                label="Bots"
                value={prefs.difficulty}
                options={DIFFICULTIES}
                onChange={(v) => setPrefs({ difficulty: v })}
              />
              <ToggleBtn
                active={prefs.coach}
                onClick={() => setPrefs({ coach: !prefs.coach })}
                title="Show shanten + dim deadweight"
              >
                Coach
              </ToggleBtn>
              <ToggleBtn
                active={prefs.showCounter}
                onClick={() => setPrefs({ showCounter: !prefs.showCounter })}
                title="Show remaining tile counts"
              >
                Tiles
              </ToggleBtn>
              <button
                onClick={onToggleFullscreen}
                className="rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 p-1.5"
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <SvgIcon d={ICONS[isFullscreen ? 'compress' : 'expand']} />
              </button>
              <button onClick={onNewGame} className="text-stone-300 hover:text-white text-sm">
                Reshuffle
              </button>
            </div>
          )}
        </header>

        <StatsBar stats={stats} onReset={onResetStats} />

        <main className="relative flex-1 min-h-0 flex flex-col p-2 sm:p-3 gap-2 overflow-hidden">
          <Table
            state={state}
            isMyTurn={isMyTurn}
            myHandSorted={myHandSorted}
            sortedIndexMap={sortedIndexMap}
            selectedSortedIdx={selectedSortedIdx}
            coach={prefs.coach ? myCoach : null}
            onTileTap={onTileTap}
            recentDiscard={recentDiscard}
            justDrawnKey={justDrawnKey}
            shakeNonce={shakeNonce}
            botBubbles={botBubbles}
            myWaitSet={prefs.coach ? myWaitSet : null}
            seenCounts={prefs.coach ? seenCounts : null}
            hoveredSeat={hoveredSeat}
            onHoverSeat={setHoveredSeat}
            showTiles={gamePhase === 'playing'}
            coachAdvice={prefs.coach && gamePhase === 'playing' ? myAdvice : null}
            onCoachAnswer={prefs.coach ? onCoachAnswer : null}
          />

          <ActionBar
            state={state}
            isMyTurn={isMyTurn}
            humanCanSelfDrawWin={humanCanSelfDrawWin}
            humanClaims={humanClaims}
            claimProgress={claimProgress}
            claimRemainingMs={claimRemainingMs}
            selectedSortedIdx={selectedSortedIdx}
            onDraw={onHumanDraw}
            onSelfDrawWin={onHumanSelfDrawWin}
            onPong={onHumanPong}
            onChow={onHumanChow}
            onClaimWin={onHumanClaimWin}
            onPass={onHumanPass}
            onCommitDiscard={() =>
              selectedSortedIdx !== null && onHumanDiscard(sortedIndexMap[selectedSortedIdx])
            }
          />

          {prefs.showCounter && (
            <TileCounterPanel state={state} viewer={HUMAN_SEAT} tick={tick} />
          )}
        </main>

        <AnimatePresence>
          {flash && <Stamp text={flash.text} tone={flash.tone} subtitle={flash.subtitle} />}
        </AnimatePresence>

        <WinFlourish
          active={state.winner === HUMAN_SEAT && state.turnPhase === 'over'}
          selfDraw={state.winType === 'self-draw'}
          burstId={winBurstId}
        />

        <AnimatePresence>
          {state.turnPhase === 'over' && (
            <GameOverModal
              state={state}
              winner={winner}
              stats={stats}
              onNewGame={onNewGame}
              onNextRound={onNextRound}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {gamePhase !== 'playing' && (
            <ShuffleDealing
              phase={gamePhase}
              prefs={prefs}
              onPrefsChange={setPrefs}
              onStart={() => setGamePhase('dealing')}
              onDone={() => setGamePhase('playing')}
              playerHand={myHandSorted}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Header controls

function SegToggle<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { label: string; value: T }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-stone-500">{label}</span>
      <div className="flex rounded-md overflow-hidden ring-1 ring-stone-700">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={String(o.value)}
              onClick={() => onChange(o.value)}
              className={[
                'px-2 py-1 text-xs',
                active
                  ? 'bg-emerald-500 text-stone-900 font-semibold'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-200',
              ].join(' ')}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ToggleBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'rounded-md px-2.5 py-1 text-xs font-medium ring-1',
        active
          ? 'bg-amber-300 text-stone-900 ring-amber-400'
          : 'bg-stone-800 text-stone-200 ring-stone-700 hover:bg-stone-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats bar

function StatsBar({
  stats,
  onReset,
}: {
  stats: PracticeStats
  onReset: () => void
}) {
  if (stats.roundsPlayed === 0) return null
  const pct = Math.round(winRate(stats) * 100)
  const tai = avgTai(stats)
  return (
    <div className="border-b border-stone-900/80 bg-stone-950/60">
      <div className="mx-auto max-w-[1200px] px-3 sm:px-6 py-1.5 flex items-center gap-4 text-[11px] text-stone-400 flex-wrap">
        <Stat label="Rounds" value={String(stats.roundsPlayed)} />
        <Stat label="Wins" value={`${stats.wins} (${pct}%)`} />
        <Stat label="Streak" value={`${stats.currentStreak} · best ${stats.longestStreak}`} />
        <Stat label="Avg tai" value={tai ? tai.toFixed(1) : '—'} />
        <Stat label="Best tai" value={stats.maxTai ? String(stats.maxTai) : '—'} />
        <button
          onClick={onReset}
          className="ml-auto text-stone-500 hover:text-stone-300 text-[11px]"
        >
          reset stats
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-stone-500">{label}:</span>{' '}
      <span className="text-stone-200">{value}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Table

function Table({
  state,
  isMyTurn,
  myHandSorted,
  sortedIndexMap,
  selectedSortedIdx,
  coach,
  onTileTap,
  recentDiscard,
  justDrawnKey,
  shakeNonce,
  botBubbles,
  myWaitSet,
  seenCounts,
  hoveredSeat,
  onHoverSeat,
  showTiles,
  coachAdvice,
  onCoachAnswer,
}: {
  state: SoloState
  isMyTurn: boolean
  myHandSorted: Tile[]
  sortedIndexMap: number[]
  selectedSortedIdx: number | null
  coach: ReturnType<typeof coachInfo> | null
  onTileTap: (sortedIdx: number) => void
  recentDiscard: { seat: Seat; tile: Tile } | null
  justDrawnKey: string | null
  shakeNonce: number
  botBubbles: Partial<Record<Seat, Bubble>>
  myWaitSet: Set<string> | null
  seenCounts: Map<string, number> | null
  hoveredSeat: Seat | null
  onHoverSeat: (seat: Seat | null) => void
  showTiles: boolean
  coachAdvice: string | null
  onCoachAnswer: ((q: string) => string) | null
}) {
  const me = state.players[HUMAN_SEAT]
  const top = state.players[2]
  const right = state.players[1]
  const left = state.players[3]

  return (
    <TableSurface className="flex-1 min-h-0 flex flex-col">
      <div
        className="grid gap-2 sm:gap-3 flex-1 min-h-0 w-full"
        style={{
          gridTemplateColumns: 'minmax(70px, 0.5fr) minmax(0, 3.2fr) minmax(70px, 0.5fr)',
          gridTemplateRows: 'minmax(0, 0.9fr) minmax(0, 1.4fr) auto',
        }}
      >
        <div className="col-start-2 row-start-1">
          <SeatPanel
            player={top}
            state={state}
            pos="top"
            bubble={botBubbles[2]}
            onHover={onHoverSeat}
            showTiles={showTiles}
          />
        </div>
        <div className="col-start-1 row-start-1 row-span-3">
          <SeatPanel
            player={left}
            state={state}
            pos="left"
            bubble={botBubbles[3]}
            onHover={onHoverSeat}
            showTiles={showTiles}
          />
        </div>
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <CenterPool
            state={state}
            recentDiscard={recentDiscard}
            hoveredSeat={hoveredSeat}
            myWaitSet={myWaitSet}
            seenCounts={seenCounts}
          />
        </div>
        <div className="col-start-3 row-start-1 row-span-3">
          <SeatPanel
            player={right}
            state={state}
            pos="right"
            bubble={botBubbles[1]}
            onHover={onHoverSeat}
            showTiles={showTiles}
          />
        </div>
        <div className="col-start-2 row-start-3">
          <MeSeat
            me={me}
            state={state}
            isMyTurn={isMyTurn}
            myHandSorted={myHandSorted}
            sortedIndexMap={sortedIndexMap}
            selectedSortedIdx={selectedSortedIdx}
            coach={coach}
            onTileTap={onTileTap}
            justDrawnKey={justDrawnKey}
            shakeNonce={shakeNonce}
            onHover={onHoverSeat}
            showTiles={showTiles}
            coachAdvice={coachAdvice}
            onCoachAnswer={onCoachAnswer}
          />
        </div>
      </div>
    </TableSurface>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Opponent seat panels

function SeatPanel({
  player,
  state,
  pos,
  bubble,
  onHover,
  showTiles,
}: {
  player: SoloPlayer
  state: SoloState
  pos: Exclude<SeatPos, 'bottom'>
  bubble?: Bubble
  onHover: (seat: Seat | null) => void
  showTiles: boolean
}) {
  const active = state.currentPlayer === player.playerNumber && state.turnPhase !== 'over'
  const isRight = pos === 'right'
  const isLeft = pos === 'left'
  const isSide = isLeft || isRight
  const tileRotation: 0 | 90 | 180 | 270 = isRight ? 90 : isLeft ? 270 : 0

  const sideTileSize: 'sm' | 'md' = 'md'
  const sideOverlapStyle = isSide
    ? ({ marginTop: -6 } as React.CSSProperties)
    : undefined
  const handColumn = isSide ? (
    <>
      <div className="sm:hidden flex flex-col items-center gap-1">
        <MobileFanBacks count={player.playerHand.length} rotation={tileRotation} />
      </div>
      <div className="hidden sm:flex flex-col items-center shrink-0 min-h-0">
        {Array.from({ length: player.playerHand.length }).map((_, i) => (
          <div key={i} style={i === 0 ? undefined : sideOverlapStyle}>
            <TileFace faceDown size={sideTileSize} rotation={tileRotation} />
          </div>
        ))}
      </div>
    </>
  ) : (
    <>
      {/* Mobile top: show full fan */}
      <div className="sm:hidden flex flex-col items-center gap-0.5 shrink-0">
        <MobileFanBacks count={player.playerHand.length} max={player.playerHand.length} />
      </div>
      {/* Desktop top: grid of backs */}
      <div className="hidden sm:flex flex-col items-center gap-0.5 shrink-0">
        <HandBacks count={player.playerHand.length} size={sideTileSize} rotation={tileRotation} />
      </div>
    </>
  )
  const checkedColumn = player.playerChecked.length > 0 &&
    (isSide ? (
      <>
        <div className="sm:hidden flex flex-col items-center justify-center gap-0.5 text-center">
          <TileFace tile={player.playerChecked[0]} size="sm" rotation={tileRotation} />
          {player.playerChecked.length > 1 && (
            <span className="text-[9px] text-stone-400 leading-none">×{player.playerChecked.length}</span>
          )}
        </div>
        <div className="hidden sm:flex flex-col items-center shrink-0 min-h-0">
          {player.playerChecked.map((t, i) => (
            <div key={`${t.name}-${i}`} style={i === 0 ? undefined : sideOverlapStyle}>
              <TileFace tile={t} size={sideTileSize} rotation={tileRotation} />
            </div>
          ))}
        </div>
      </>
    ) : (
      <>
        <div className="sm:hidden flex flex-row items-center gap-0.5 shrink-0 flex-wrap justify-center">
          {player.playerChecked.map((t, i) => (
            <div key={`${t.name}-${i}`} style={i === 0 ? undefined : sideOverlapStyle}>
              <TileFace tile={t} size="sm" rotation={tileRotation} />
            </div>
          ))}
        </div>
        <div className="hidden sm:flex flex-row items-center gap-0.5 shrink-0 flex-wrap justify-center">
          {player.playerChecked.map((t, i) => (
            <div key={`${t.name}-${i}`} style={i === 0 ? undefined : sideOverlapStyle}>
              <TileFace tile={t} size={sideTileSize} rotation={tileRotation} />
            </div>
          ))}
        </div>
      </>
    ))

  return (
    <div
      onMouseEnter={() => onHover(player.playerNumber as Seat)}
      onMouseLeave={() => onHover(null)}
      className="relative h-full rounded-xl p-1.5 sm:p-2 flex flex-col min-h-0 overflow-visible sm:overflow-hidden cursor-pointer"
    >
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-3 z-20">
        <AnimatePresence>{bubble && <SpeechBubble bubble={bubble} />}</AnimatePresence>
      </div>

      {/* Desktop: full header */}
      <div className="hidden sm:block">
        <SeatHeader player={player} active={active} pos={pos} />
      </div>

      {/* Mobile top player: compact tag above fan */}
      {!isSide && (
        <div className="sm:hidden mb-0.5">
          <MobilePlayerTag player={player} active={active} isSide={false} />
        </div>
      )}

      {showTiles && (isSide ? (
        <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-1 sm:hidden">
          {/* Tiles first on mobile */}
          <div className="flex flex-row gap-1 items-center justify-center">
            {isRight ? <>{checkedColumn}{handColumn}</> : <>{handColumn}{checkedColumn}</>}
          </div>
          {/* Tag below tiles on mobile */}
          <MobilePlayerTag player={player} active={active} isSide={true} />
        </div>
      ) : (
        <div className="sm:hidden mt-0.5 flex flex-col gap-1 items-center justify-center flex-1 min-h-0">
          {handColumn}
          {checkedColumn}
        </div>
      ))}

      {/* Desktop tile layout (all positions) */}
      {showTiles && (
        <div className={`hidden sm:flex mt-2 ${isSide ? 'flex-row gap-2' : 'flex-col gap-1'} flex-1 min-h-0 items-center justify-center`}>
          {isSide ? (
            isRight ? <>{checkedColumn}{handColumn}</> : <>{handColumn}{checkedColumn}</>
          ) : (
            <>{handColumn}{checkedColumn}</>
          )}
        </div>
      )}
    </div>
  )
}

function MobilePlayerTag({
  player,
  active,
  isSide,
}: {
  player: SoloPlayer
  active: boolean
  isSide: boolean
}) {
  return (
    <div className={`flex items-center gap-1 ${isSide ? 'justify-center flex-col' : 'justify-center flex-row flex-wrap'}`}>
      <div className="flex items-center gap-1">
        {active && (
          <span className="block w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.9)]" />
        )}
        <WindBadge wind={player.wind} size="sm" />
      </div>
      <div className={`flex min-w-0 ${isSide ? 'flex-col items-center gap-0' : 'flex-col gap-0'}`}>
        <span
          className={`text-[9px] font-medium truncate max-w-[60px] leading-tight ${
            active ? 'text-amber-300' : 'text-stone-300'
          }`}
        >
          {player.name}
          {active && !isSide && <ThinkingDots />}
        </span>
        <span className="text-[8px] text-stone-500 tabular-nums leading-tight">
          {player.playerHand.length}張
          {player.playerChecked.length > 0 && ` · ${player.playerChecked.length}碰`}
        </span>
      </div>
    </div>
  )
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] ml-1.5 align-middle">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1 h-1 rounded-full bg-amber-300/90"
          animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
          transition={{ duration: 1.1, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

function SeatHeader({
  player,
  active,
  pos,
}: {
  player: SoloPlayer
  active: boolean
  pos: SeatPos
}) {
  const centered = pos !== 'bottom'
  const isHuman = pos === 'bottom'
  return (
    <div className={`flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
      <WindBadge wind={player.wind} size="md" />
      <div className={centered ? 'min-w-0 text-center' : 'flex-1 min-w-0'}>
        <p className={`text-sm truncate flex items-center ${active ? 'font-semibold text-amber-200' : 'font-medium text-stone-100'}`}>
          <span className="truncate">{player.name}</span>
          {active && !isHuman && <ThinkingDots />}
        </p>
        <p className="text-[10px] text-stone-400">
          Hand {player.playerHand.length} · Disc {player.playerDiscarded.length} · Chips{' '}
          {player.chips}
        </p>
      </div>
    </div>
  )
}

function DiscardGrid({
  tiles,
  myWaitSet,
  seenCounts,
  rotation = 0,
  maxCols,
}: {
  tiles: Tile[]
  myWaitSet: Set<string> | null
  seenCounts: Map<string, number> | null
  rotation?: 0 | 90 | 180 | 270
  /** Cap row width to N tiles before wrapping. */
  maxCols?: number
}) {
  const gridStyle: React.CSSProperties | undefined = maxCols
    ? {
        display: 'grid',
        gridTemplateColumns: `repeat(${maxCols}, minmax(0, auto))`,
        gap: '2px',
      }
    : undefined
  const scatter = maxCols !== undefined
  return (
    <div className={maxCols ? '' : 'flex flex-wrap gap-0.5'} style={gridStyle}>
      <AnimatePresence initial={false}>
        {tiles.map((t, i) => {
          const isWait = myWaitSet?.has(t.name) ?? false
          const isLast = i === tiles.length - 1
          const isDead = seenCounts ? (seenCounts.get(t.name) ?? 0) >= 4 : false
          // Deterministic jitter so the pile looks tossed, not gridded.
          const seed = t.index * 31 + (t.copy ?? 0) * 7 + i
          const rot = scatter ? ((seed % 13) - 6) : 0
          const dx = scatter ? ((seed * 5) % 7) - 3 : 0
          const dy = scatter ? ((seed * 11) % 5) - 2 : 0
          return (
            <motion.div
              key={`${t.index}-${i}`}
              initial={{ scale: 0.6, opacity: 0, y: -16 }}
              animate={{ scale: 1, opacity: 1, x: dx, y: dy, rotate: rot }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className={[
                'relative rounded-md',
                isWait ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(252,211,77,0.55)]' : '',
                isLast && !isWait ? 'ring-1 ring-emerald-300/60' : '',
                isDead && !isWait ? 'opacity-50 grayscale-[0.4]' : '',
              ].join(' ')}
              title={
                isWait
                  ? 'You were waiting on this tile'
                  : isDead
                    ? 'All 4 copies seen — dead tile'
                    : undefined
              }
            >
              <TileFace tile={t} size="md" rotation={rotation} />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Center pool — 4 discard piles arranged around a center status panel.
// Each pile is rotated as a whole so tiles face their owner.

function CenterPool({
  state,
  recentDiscard,
  hoveredSeat,
  myWaitSet,
  seenCounts,
}: {
  state: SoloState
  recentDiscard: { seat: Seat; tile: Tile } | null
  hoveredSeat: Seat | null
  myWaitSet: Set<string> | null
  seenCounts: Map<string, number> | null
}) {
  const claimable = state.turnPhase === 'claim-window' && state.lastDiscard !== null
  const recentName = recentDiscard ? state.players[recentDiscard.seat].name : null
  return (
    <div className="relative w-full h-full min-h-[120px] sm:min-h-[260px]">
      {([0, 1, 2, 3] as Seat[]).map((seat) => (
        <CenterPile
          key={seat}
          seat={seat}
          tiles={state.players[seat].playerDiscarded}
          dimmed={hoveredSeat !== null && hoveredSeat !== seat}
          myWaitSet={myWaitSet}
          seenCounts={seenCounts}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center px-3 py-2 rounded-lg bg-black/25 backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">
            Prevailing · {state.prevailingWind}
          </p>
          <p className="text-xs text-emerald-100/90 mt-0.5">{centerStatus(state)}</p>
          {recentDiscard && (
            <p className="text-[10px] mt-1 text-amber-200/80 uppercase tracking-wide">
              {recentName} discarded
              {claimable ? ' · open' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const PILE_POSITION: Record<Seat, string> = {
  0: 'absolute left-1/2 bottom-1',
  1: 'absolute right-1 top-1/2',
  2: 'absolute left-1/2 top-1',
  3: 'absolute left-1 top-1/2',
}

function CenterPile({
  seat,
  tiles,
  dimmed,
  myWaitSet,
  seenCounts,
}: {
  seat: Seat
  tiles: Tile[]
  dimmed: boolean
  myWaitSet: Set<string> | null
  seenCounts: Map<string, number> | null
}) {
  return (
    <div
      className={[
        PILE_POSITION[seat],
        'transition-all duration-200',
        dimmed ? 'opacity-20 blur-[0.5px]' : '',
      ].join(' ')}
      style={{ transform: rotateTransform(seat) }}
    >
      <div className="rounded-md p-1">
        <DiscardGrid
          tiles={tiles}
          myWaitSet={myWaitSet}
          seenCounts={seenCounts}
          rotation={0}
          maxCols={6}
        />
      </div>
    </div>
  )
}

function rotateTransform(seat: Seat): string {
  // CSS transforms apply right-to-left, so the translate (centering) must come
  // last in the string so it runs first, before the rotation about the box center.
  const center = seat === 0 || seat === 2 ? 'translateX(-50%)' : 'translateY(-50%)'
  const rot =
    seat === 1 ? 'rotate(-90deg)' : seat === 3 ? 'rotate(90deg)' : seat === 2 ? 'rotate(180deg)' : ''
  return rot ? `${rot} ${center}` : center
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom — me

function MeSeat({
  me,
  state,
  isMyTurn,
  myHandSorted,
  sortedIndexMap,
  selectedSortedIdx,
  coach,
  onTileTap,
  justDrawnKey,
  shakeNonce,
  onHover,
  showTiles,
  coachAdvice,
  onCoachAnswer,
}: {
  me: SoloPlayer
  state: SoloState
  isMyTurn: boolean
  myHandSorted: Tile[]
  sortedIndexMap: number[]
  selectedSortedIdx: number | null
  coach: ReturnType<typeof coachInfo> | null
  onTileTap: (sortedIdx: number) => void
  justDrawnKey: string | null
  shakeNonce: number
  onHover: (seat: Seat | null) => void
  showTiles: boolean
  coachAdvice: string | null
  onCoachAnswer: ((q: string) => string) | null
}) {
  const handTileSize = useHandTileSize()
  const canDiscard = isMyTurn && state.turnPhase === 'discard'
  const active = state.currentPlayer === HUMAN_SEAT && state.turnPhase !== 'over'

  const fanInfo = handTileSize === 'md' ? (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1.5">
        <WindBadge wind={me.wind} size="sm" />
        <span className={`text-xs font-semibold ${active ? 'text-amber-300' : 'text-stone-200'}`}>
          {me.name}
        </span>
      </div>
      <p className="text-[9px] text-stone-400 tabular-nums">
        Hand {me.playerHand.length} · Disc {me.playerDiscarded.length} · {me.chips}¥
      </p>
    </div>
  ) : null

  return (
    <div
      onMouseEnter={() => onHover(HUMAN_SEAT)}
      onMouseLeave={() => onHover(null)}
      className="rounded-xl p-2 sm:p-4"
    >
      {/* Desktop header (hidden on mobile — info lives inside the fan arc) */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between mb-3">
          <SeatHeader player={me} active={active} pos="bottom" />
          {showTiles && me.playerChecked.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-stone-400">Checked</span>
              <div className="flex flex-wrap gap-1">
                {me.playerChecked.map((t, i) => (
                  <TileFace key={`${t.name}-${i}`} tile={t} size="sm" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {onCoachAnswer && (
        <CoachInline advice={coachAdvice} onAnswer={onCoachAnswer} />
      )}

      {showTiles && handTileSize === 'md' && me.playerChecked.length > 0 && (
        <div className="sm:hidden flex justify-center gap-1 mb-1 flex-wrap">
          {me.playerChecked.map((t, i) => (
            <TileFace key={`${t.name}-${i}`} tile={t} size="sm" />
          ))}
        </div>
      )}

      {showTiles && (handTileSize === 'md' ? (
        <FanShakeContainer shakeNonce={shakeNonce} height={mfanContainerH(myHandSorted.length)} info={fanInfo}>
          <AnimatePresence initial={false}>
            {myHandSorted.map((t, i) => {
              const origIdx = sortedIndexMap[i]
              const isSelected = selectedSortedIdx === i
              const tileKey = `${t.index}-${t.copy ?? 0}`
              const isJustDrawn = justDrawnKey === tileKey
              const dim =
                canDiscard && coach && coach.perTile.size > 0
                  ? !isOptimalDiscard(coach, origIdx)
                  : false
              const { x, y, angle, row, col, tilesInRow } = calcMultiFanPos(i, myHandSorted.length)
              return (
                <motion.div
                  key={tileKey}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    marginLeft: -MFAN_TILE_W_HALF,
                    top: 0,
                    zIndex: mfanZIndex(row, col, tilesInRow),
                    transformOrigin: '50% 100%',
                  }}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{
                    x,
                    y: isSelected ? y - 20 : y,
                    rotate: angle,
                    opacity: dim ? 0.45 : 1,
                    scale: isSelected ? 1.08 : 1,
                  }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                >
                  <TileFace
                    tile={t}
                    size={handTileSize}
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
        </FanShakeContainer>
      ) : (
        <ShakeRow shakeNonce={shakeNonce}>
          <AnimatePresence initial={false}>
            {myHandSorted.map((t, i) => {
              const origIdx = sortedIndexMap[i]
              const isSelected = selectedSortedIdx === i
              const tileKey = `${t.index}-${t.copy ?? 0}`
              const isJustDrawn = justDrawnKey === tileKey
              const dim =
                canDiscard && coach && coach.perTile.size > 0
                  ? !isOptimalDiscard(coach, origIdx)
                  : false
              return (
                <motion.div
                  key={tileKey}
                  layout
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: isSelected ? -16 : 0, opacity: dim ? 0.45 : 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                >
                  <TileFace
                    tile={t}
                    size={handTileSize}
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
      ))}
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

// ─────────────────────────────────────────────────────────────────────────────
// Multi-row concentric arc fan (mobile only)

const MFAN_COLS = 7          // tiles per row
const MFAN_ROW_STEP = 48    // px between successive row center-tile y positions
const MFAN_ARC_DEG = 80     // total angular spread per row
const MFAN_R = 140           // arc radius
const MFAN_TILE_W_HALF = 22 // half of md tile width (44px)
const MFAN_TILE_H = 62       // md tile height

function calcMultiFanPos(i: number, total: number): { x: number; y: number; angle: number; row: number; col: number; tilesInRow: number } {
  const row = Math.floor(i / MFAN_COLS)
  const col = i % MFAN_COLS
  const tilesInRow = Math.min(MFAN_COLS, total - row * MFAN_COLS)
  const angle = tilesInRow <= 1 ? 0 : -MFAN_ARC_DEG / 2 + (col / (tilesInRow - 1)) * MFAN_ARC_DEG
  const rad = (angle * Math.PI) / 180
  return {
    x: MFAN_R * Math.sin(rad),
    y: row * MFAN_ROW_STEP + MFAN_R * (1 - Math.cos(rad)),
    angle,
    row,
    col,
    tilesInRow,
  }
}

function mfanContainerH(total: number): number {
  const rows = Math.ceil(total / MFAN_COLS)
  const arcDip = MFAN_R * (1 - Math.cos((MFAN_ARC_DEG / 2) * (Math.PI / 180)))
  // extra 52px at bottom for user-info label inside the arc bowl
  return (rows - 1) * MFAN_ROW_STEP + arcDip + MFAN_TILE_H + 52
}

function mfanZIndex(row: number, col: number, tilesInRow: number): number {
  // Front rows on top; within each row, center tiles highest
  const distFromCenter = Math.abs(col - (tilesInRow - 1) / 2)
  return row * 100 + Math.round(MFAN_COLS - distFromCenter)
}

function FanShakeContainer({
  shakeNonce,
  height,
  info,
  children,
}: {
  shakeNonce: number
  height: number
  info?: React.ReactNode
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
      style={{ position: 'relative', height, width: '100%' }}
    >
      {children}
      {info && (
        <div
          style={{
            position: 'absolute',
            bottom: 4,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {info}
        </div>
      )}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Action bar

function ActionBar({
  state,
  isMyTurn,
  humanCanSelfDrawWin,
  humanClaims,
  claimProgress,
  claimRemainingMs,
  selectedSortedIdx,
  onDraw,
  onSelfDrawWin,
  onPong,
  onChow,
  onClaimWin,
  onPass,
  onCommitDiscard,
}: {
  state: SoloState
  isMyTurn: boolean
  humanCanSelfDrawWin: boolean
  humanClaims: HumanClaims | null
  claimProgress: number
  claimRemainingMs: number | null
  selectedSortedIdx: number | null
  onDraw: () => void
  onSelfDrawWin: () => void
  onPong: () => void
  onChow: (idx: number) => void
  onClaimWin: () => void
  onPass: () => void
  onCommitDiscard: () => void
}) {
  const showDraw = isMyTurn && state.turnPhase === 'draw'
  const showDiscardHint = isMyTurn && state.turnPhase === 'discard' && !humanCanSelfDrawWin
  const showWaitHint =
    !isMyTurn && !humanClaims && state.turnPhase !== 'over'

  return (
    <motion.div
      layout
      className="mt-2 sm:mt-4 flex items-center justify-center gap-2 flex-wrap min-h-[44px]"
    >
      {showDraw && <PrimaryBtn onClick={onDraw}>Draw tile <span className="hidden sm:inline">(D)</span></PrimaryBtn>}
      {humanCanSelfDrawWin && (
        <WinBtn onClick={onSelfDrawWin}>Mahjong! 🀄 <span className="hidden sm:inline">(self-draw, W)</span></WinBtn>
      )}
      {humanClaims && (
        <>
          <ClaimTimer progress={claimProgress} remainingMs={claimRemainingMs ?? 0} />
          {humanClaims.canWin && <WinBtn onClick={onClaimWin}>Win on discard 🀄 <span className="hidden sm:inline">(W)</span></WinBtn>}
          {humanClaims.canPong && <PrimaryBtn onClick={onPong}>Pong <span className="hidden sm:inline">(P)</span></PrimaryBtn>}
          {humanClaims.chowOptions.map((opt, i) => (
            <PrimaryBtn key={i} onClick={() => onChow(i)}>
              Chow {opt.tileNames.join('-')} <span className="hidden sm:inline">({i + 1})</span>
            </PrimaryBtn>
          ))}
          <SecondaryBtn onClick={onPass}>Pass <span className="hidden sm:inline">(Esc)</span></SecondaryBtn>
        </>
      )}
      {showDiscardHint && (
        <>
          {selectedSortedIdx !== null ? (
            <PrimaryBtn onClick={onCommitDiscard}>Discard selected <span className="hidden sm:inline">(Space)</span></PrimaryBtn>
          ) : (
            <span className="text-xs text-emerald-200 italic">
              Tap a tile to select, tap again (or Space) to discard
            </span>
          )}
        </>
      )}
      {showWaitHint && (
        <span className="text-xs text-stone-400 italic">
          {state.players[state.currentPlayer].name} is{' '}
          {state.turnPhase === 'claim-window' ? 'discarding' : 'thinking'}…
        </span>
      )}
    </motion.div>
  )
}

function ClaimTimer({ progress, remainingMs }: { progress: number; remainingMs: number }) {
  const size = 32
  const radius = 13
  const circumference = 2 * Math.PI * radius
  const strokeDash = circumference * progress
  const seconds = Math.ceil(remainingMs / 1000)
  return (
    <div className="relative" style={{ width: size, height: size }} title="Time to decide">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={3}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progress < 0.25 ? '#f87171' : '#fbbf24'}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 100ms linear' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-stone-200 font-semibold">
        {seconds}
      </span>
    </div>
  )
}

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-stone-900 px-4 py-2 text-sm font-semibold shadow-md"
    >
      {children}
    </motion.button>
  )
}

function WinBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      animate={{ boxShadow: ['0 0 0 0 rgba(252,211,77,0.6)', '0 0 0 12px rgba(252,211,77,0)'] }}
      transition={{ duration: 1.2, repeat: Infinity }}
      onClick={onClick}
      className="rounded-md bg-amber-400 hover:bg-amber-300 text-stone-900 px-4 py-2 text-sm font-bold"
    >
      {children}
    </motion.button>
  )
}

function SecondaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="rounded-md bg-stone-700 hover:bg-stone-600 text-stone-100 px-4 py-2 text-sm"
    >
      {children}
    </motion.button>
  )
}


function buildAdvice(args: {
  state: SoloState
  hand: readonly Tile[]
  coach: ReturnType<typeof coachInfo>
  isMyTurn: boolean
  humanCanSelfDrawWin: boolean
  humanClaims: HumanClaims | null
}): string | null {
  const { state, hand, coach, isMyTurn, humanCanSelfDrawWin, humanClaims } = args
  if (state.turnPhase === 'over') return null
  if (humanCanSelfDrawWin) return 'Call mahjong now — you have a self-draw win (W).'
  if (humanClaims?.canWin) return 'Call win on this discard (W) — you have a winning hand.'
  if (humanClaims) {
    const parts: string[] = []
    if (humanClaims.canPong) parts.push('Pong (P)')
    if (humanClaims.chowOptions.length) parts.push(`Chow (${humanClaims.chowOptions.length} option${humanClaims.chowOptions.length > 1 ? 's' : ''})`)
    if (parts.length === 0) return 'Pass — nothing useful here (Esc).'
    return `Available: ${parts.join(' · ')}. Claim only if it advances your hand; otherwise pass (Esc).`
  }
  if (!isMyTurn) return null
  if (state.turnPhase === 'draw') return 'Draw a tile (D).'
  if (state.turnPhase === 'discard' && coach.perTile.size > 0) {
    const seen = new Set<string>()
    const names: string[] = []
    for (const [idx, sh] of coach.perTile) {
      if (sh !== coach.bestDiscardShanten) continue
      const t = hand[idx]
      if (!t || seen.has(t.name)) continue
      seen.add(t.name)
      names.push(t.name)
      if (names.length >= 3) break
    }
    if (names.length === 0) return null
    return `Discard ${names.join(' or ')} — keeps you ${shantenLabel(coach.bestDiscardShanten)}.`
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Tile counter panel

function tileUrl(name: string): string {
  if (name.endsWith('dragon')) return `/assets/svgtiles/dragon_${name.replace('dragon', '')}.svg`
  return `/assets/svgtiles/${name}.svg`
}

function TileCounterPanel({
  state,
  viewer,
  tick,
}: {
  state: SoloState
  viewer: Seat
  tick: number
}) {
  void tick
  const groups = useMemo(() => remainingByGroup(state, viewer), [state, viewer, tick])
  const order: { key: TileGroup; label: string }[] = [
    { key: 'bamboo', label: 'Bamboo 索' },
    { key: 'dots', label: 'Dots 筒' },
    { key: 'character', label: 'Character 萬' },
    { key: 'winds', label: 'Winds 風' },
    { key: 'dragons', label: 'Dragons 三元' },
  ]
  return (
    <div className="mt-3 rounded-lg bg-stone-900/70 ring-1 ring-stone-800 p-3">
      <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-3">
        Remaining tiles · dots = copies left
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {order.map(({ key, label }) => (
          <div key={key}>
            <p className="text-[10px] text-stone-500 mb-1.5">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {groups[key].map((entry) => (
                <div
                  key={entry.name}
                  title={`${entry.name}: ${entry.remaining} left`}
                  className={[
                    'flex flex-col items-center gap-1 transition-opacity',
                    entry.remaining === 0 ? 'opacity-25' : 'opacity-100',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'rounded shadow-sm ring-1 overflow-hidden',
                      entry.remaining === 0
                        ? 'ring-stone-700 bg-stone-800'
                        : entry.remaining === 1
                          ? 'ring-amber-600 bg-gradient-to-b from-stone-50 to-stone-200'
                          : 'ring-stone-400 bg-gradient-to-b from-stone-50 to-stone-200',
                    ].join(' ')}
                    style={{ width: 28, height: 39 }}
                  >
                    <img
                      src={tileUrl(entry.name)}
                      alt={entry.name}
                      className="w-full h-full object-contain p-0.5"
                    />
                  </div>
                  <div className="flex gap-[3px]">
                    {Array.from({ length: 4 }, (_, i) => (
                      <span
                        key={i}
                        className={[
                          'block w-1 h-1 rounded-full',
                          i < entry.remaining
                            ? entry.remaining === 1
                              ? 'bg-amber-400'
                              : entry.remaining === 2
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            : 'bg-stone-700',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Game-over modal

function GameOverModal({
  state,
  winner,
  stats,
  onNewGame,
  onNextRound,
}: {
  state: SoloState
  winner: SoloPlayer | null
  stats: PracticeStats
  onNewGame: () => void
  onNextRound: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="max-w-lg w-full rounded-2xl bg-stone-900 ring-1 ring-amber-400/50 shadow-2xl p-6 space-y-4"
      >
        {winner ? (
          <>
            <div>
              <p className="text-2xl font-bold text-amber-300">{winner.name} wins!</p>
              <p className="text-xs text-stone-400 mt-1">
                {state.winType === 'self-draw'
                  ? 'Self-draw 自摸'
                  : state.winType === 'discard-win' && state.winFromSeat !== null
                    ? `Won on discard from ${state.players[state.winFromSeat].name}`
                    : ''}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">
                Winning hand
              </p>
              <div className="flex flex-wrap gap-1">
                {winner.playerHand.map((t, i) => (
                  <TileFace key={`${t.name}-${i}`} tile={t} size="md" />
                ))}
              </div>
            </div>
            {winner.playerChecked.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-1">
                  Revealed melds
                </p>
                <div className="flex flex-wrap gap-1">
                  {winner.playerChecked.map((t, i) => (
                    <TileFace key={`${t.name}-${i}`} tile={t} size="md" />
                  ))}
                </div>
              </div>
            )}
            {state.result && (
              <div className="text-xs space-y-2 pt-3 border-t border-stone-800">
                <p className="font-semibold text-stone-200">
                  {state.result.scoring.tai} tai
                  {state.result.scoring.raw > state.result.scoring.tai &&
                    ` (capped from ${state.result.scoring.raw})`}{' '}
                  · {state.result.chipsPerLoser} chips per loser
                </p>
                {state.result.scoring.breakdown.length > 0 && (
                  <ul className="text-stone-400 list-disc list-inside">
                    {state.result.scoring.breakdown.map((b) => (
                      <li key={b.name}>
                        {b.name}: {b.tai}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {state.players.map((p) => {
                    const delta = state.result!.chipDelta[p.playerNumber as Seat]
                    return (
                      <div key={p.playerNumber} className="rounded bg-stone-800/60 px-2 py-1">
                        <p className="text-stone-400 text-[10px]">{p.name}</p>
                        <p>
                          {p.chips}{' '}
                          <span
                            className={
                              delta > 0
                                ? 'text-emerald-400'
                                : delta < 0
                                  ? 'text-rose-400'
                                  : 'text-stone-500'
                            }
                          >
                            ({delta >= 0 ? '+' : ''}
                            {delta})
                          </span>
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-lg">Round drawn — deck exhausted.</p>
        )}
        <div className="text-[11px] text-stone-400 border-t border-stone-800 pt-3 flex flex-wrap gap-x-4 gap-y-1">
          <span>Practice rounds: {stats.roundsPlayed}</span>
          <span>Wins: {stats.wins}</span>
          <span>
            Streak: {stats.currentStreak} (best {stats.longestStreak})
          </span>
          {stats.maxTai > 0 && <span>Best tai: {stats.maxTai}</span>}
        </div>
        <div className="flex gap-2 pt-2">
          <PrimaryBtn onClick={onNextRound}>Next round</PrimaryBtn>
          <SecondaryBtn onClick={onNewGame}>Reset game</SecondaryBtn>
        </div>
      </motion.div>
    </motion.div>
  )
}

function centerStatus(state: SoloState): string {
  if (state.turnPhase === 'over') return 'Round over'
  const name = state.players[state.currentPlayer].name
  const isYou = state.currentPlayer === HUMAN_SEAT
  const subject = isYou ? 'Your' : `${name}'s`
  if (state.turnPhase === 'claim-window') return `${subject} discard up for grabs`
  if (state.turnPhase === 'draw') return `${subject} draw`
  if (state.turnPhase === 'discard') return `${subject} discard`
  return ''
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
