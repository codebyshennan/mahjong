import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import type { Tile } from '../../game/tileset'
import { TileFace } from '../Tile'

type Difficulty = 'easy' | 'normal' | 'hard'

export interface DealingPrefs {
  speed: number
  difficulty: Difficulty
}

interface Props {
  phase: 'intro' | 'dealing'
  prefs: DealingPrefs
  onPrefsChange: (p: Partial<DealingPrefs>) => void
  onStart: () => void
  onDone: () => void
  playerHand: Tile[]
}

const SPEEDS = [
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
]
const DIFFICULTIES: { label: string; value: Difficulty }[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Normal', value: 'normal' },
  { label: 'Hard', value: 'hard' },
]

// 24 face-down scatter tiles — 6 per seat, deterministic positions.
const SCATTER_TILES = Array.from({ length: 24 }, (_, i) => {
  const seat = Math.floor(i / 6) as 0 | 1 | 2 | 3
  const seed = i + 1
  return {
    id: i,
    seat,
    shuffleDx: Math.sin(seed * 7.31) * 68,
    shuffleDy: Math.cos(seed * 5.17) * 48,
    shuffleRot: Math.sin(seed * 11.71) * 35,
    dealDelay: i * 0.038,
  }
})

const DEAL_TARGETS: Record<0 | 1 | 2 | 3, { x: number; y: number; rotate: number }> = {
  0: { x: 0, y: 280, rotate: 0 },
  1: { x: 320, y: 0, rotate: -90 },
  2: { x: 0, y: -280, rotate: 180 },
  3: { x: -320, y: 0, rotate: 90 },
}

type AnimStage = 'shuffle' | 'deal'

export function ShuffleDealing({ phase, prefs, onPrefsChange, onStart, onDone, playerHand }: Props) {
  const [animStage, setAnimStage] = useState<AnimStage>('shuffle')
  const [label, setLabel] = useState('Shuffling…')
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (phase !== 'dealing') return
    setAnimStage('shuffle')
    setLabel('Shuffling…')
    const t1 = setTimeout(() => {
      setLabel('Dealing…')
      setAnimStage('deal')
    }, 1200)
    const t2 = setTimeout(() => onDoneRef.current(), 3200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [phase])

  return createPortal(
    <>
      {/* Translucent backdrop — shows the felt table through it */}
      <div className="fixed inset-0 z-[9998] bg-stone-950/80" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="fixed inset-0 z-[9999]"
      >
        {phase === 'intro' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <IntroCard prefs={prefs} onPrefsChange={onPrefsChange} onStart={onStart} />
          </div>
        ) : (
          <DealingView animStage={animStage} label={label} playerHand={playerHand} />
        )}
      </motion.div>
    </>,
    document.body,
  )
}

// ─── Intro card ───────────────────────────────────────────────────────────────

function IntroCard({
  prefs,
  onPrefsChange,
  onStart,
}: {
  prefs: DealingPrefs
  onPrefsChange: (p: Partial<DealingPrefs>) => void
  onStart: () => void
}) {
  return (
    <motion.div
      initial={{ scale: 0.88, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="w-full max-w-sm mx-4 rounded-2xl bg-stone-900 ring-1 ring-emerald-700/40 shadow-2xl p-8 flex flex-col items-center gap-6"
    >
      <div className="text-center">
        <div className="text-5xl mb-3 select-none">🀄</div>
        <h1 className="text-2xl font-bold text-stone-100 tracking-wide">Practice Mode</h1>
        <p className="text-sm text-stone-400 mt-1">Singapore rules · Solo vs bots</p>
      </div>

      <div className="w-full flex flex-col gap-3">
        <SettingRow label="Speed">
          {SPEEDS.map((o) => (
            <SegBtn
              key={o.value}
              active={prefs.speed === o.value}
              onClick={() => onPrefsChange({ speed: o.value })}
            >
              {o.label}
            </SegBtn>
          ))}
        </SettingRow>
        <SettingRow label="Bots">
          {DIFFICULTIES.map((o) => (
            <SegBtn
              key={o.value}
              active={prefs.difficulty === o.value}
              onClick={() => onPrefsChange({ difficulty: o.value })}
            >
              {o.label}
            </SegBtn>
          ))}
        </SettingRow>
      </div>

      <motion.button
        onClick={onStart}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        animate={{
          boxShadow: [
            '0 0 0 0 rgba(52,211,153,0.45)',
            '0 0 0 14px rgba(52,211,153,0)',
          ],
        }}
        transition={{ duration: 1.6, repeat: Infinity }}
        className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-900 font-bold text-lg py-3 shadow-lg"
      >
        Start Game
      </motion.button>
    </motion.div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-widest text-stone-500 w-10 shrink-0">
        {label}
      </span>
      <div className="flex rounded-lg overflow-hidden ring-1 ring-stone-700 flex-1">
        {children}
      </div>
    </div>
  )
}

function SegBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-emerald-500 text-stone-900'
          : 'bg-stone-800 text-stone-300 hover:bg-stone-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ─── Dealing animation ────────────────────────────────────────────────────────

function DealingView({
  animStage,
  label,
  playerHand,
}: {
  animStage: AnimStage
  label: string
  playerHand: Tile[]
}) {
  return (
    <div className="absolute inset-0">
      {/* Scatter tiles — shuffle in center, fly outward on deal */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: 560, height: 420 }}>
          {SCATTER_TILES.map((tile) => {
            const target = DEAL_TARGETS[tile.seat]
            return (
              <motion.div
                key={tile.id}
                className="absolute"
                style={{ width: 44, height: 62, top: '50%', left: '50%', marginTop: -31, marginLeft: -22 }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
                animate={
                  animStage === 'shuffle'
                    ? { x: tile.shuffleDx, y: tile.shuffleDy, rotate: tile.shuffleRot, opacity: 1 }
                    : {
                        x: target.x * 0.45 + tile.shuffleDx * 0.2,
                        y: target.y * 0.45 + tile.shuffleDy * 0.2,
                        rotate: target.rotate,
                        opacity: 0,
                        scale: 0.5,
                      }
                }
                transition={
                  animStage === 'shuffle'
                    ? { type: 'spring', stiffness: 110, damping: 13, delay: tile.id * 0.025 }
                    : { type: 'spring', stiffness: 220, damping: 20, delay: tile.dealDelay * 0.6 }
                }
              >
                <TileBack />
              </motion.div>
            )
          })}

          {/* Status label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <motion.p
                key={label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-emerald-300/80 tracking-widest uppercase font-medium"
              >
                {label}
              </motion.p>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500/60"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player tiles — deal phase: fly in from above to the bottom row */}
      {animStage === 'deal' && (
        <div className="absolute bottom-16 sm:bottom-20 left-0 right-0 flex justify-center flex-wrap gap-1 px-4">
          {playerHand.map((tile, i) => (
            <motion.div
              key={`${tile.index}-${tile.copy ?? 0}`}
              initial={{ y: -60, opacity: 0, scale: 0.75 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 24,
                delay: 0.08 + i * 0.07,
              }}
            >
              <TileFace tile={tile} size="md" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function TileBack() {
  return (
    <div className="relative w-full h-full rounded-[6px] bg-gradient-to-b from-emerald-700 to-emerald-900 ring-1 ring-emerald-950 shadow-[0_2px_0_0_rgba(0,0,0,0.35),0_4px_10px_-2px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-1.5 rounded-sm border border-emerald-950/50 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.15)_0_4px,transparent_4px_8px)]" />
    </div>
  )
}
