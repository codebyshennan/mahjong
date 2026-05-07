/**
 * PageTransition — felt-green wipe overlay for the landing → practice handoff.
 *
 * Usage:
 *   const { transitionTo } = usePageTransition()
 *   transitionTo('/practice')   // wipes in, navigates, wipes out
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { TileFace } from '../solo/Tile'

// ─── Context ───────────────────────────────────────────────────────────────
interface TransitionCtx {
  transitionTo: (path: string) => void
}

const Ctx = createContext<TransitionCtx | null>(null)

export function usePageTransition() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePageTransition must be inside <PageTransitionProvider>')
  return ctx
}

// ─── Overlay ───────────────────────────────────────────────────────────────
const FELT_BG =
  'radial-gradient(ellipse at 50% 38%, #1a7a55 0%, #136a4a 40%, #0c4d35 75%, #08361f 100%)'

// Three face-down tiles that shuffle during the covered phase
const SHUFFLE_TILES = [0, 1, 2]

function Overlay() {
  return (
    <motion.div
      key="page-transition-overlay"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6"
      style={{ background: FELT_BG }}
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      exit={{ clipPath: 'inset(0 0% 0 100%)' }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Shuffling tiles — the same feel as ShuffleDealing */}
      <div className="flex items-end gap-3">
        {SHUFFLE_TILES.map(i => (
          <motion.span
            key={i}
            animate={{ y: [0, -18, 0], rotate: [i * 6 - 6, i * 6 + 8, i * 6 - 6] }}
            transition={{
              duration: 0.7,
              delay: i * 0.14,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ display: 'block' }}
          >
            <TileFace faceDown size="lg" />
          </motion.span>
        ))}
      </div>

      {/* Label */}
      <motion.p
        className="text-sm tracking-widest uppercase"
        style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--serif)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18 }}
      >
        Shuffling…
      </motion.p>
    </motion.div>
  )
}

// ─── Provider ──────────────────────────────────────────────────────────────
const COVER_MS  = 420   // time to let the wipe fully cover
const UNCOVER_DELAY_MS = 80  // gap between navigate() and starting the exit wipe

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [active, setActive] = useState(false)
  const inFlight = useRef(false)

  const transitionTo = useCallback(
    (path: string) => {
      if (inFlight.current) return
      inFlight.current = true
      setActive(true)

      setTimeout(() => {
        navigate(path)
        setTimeout(() => {
          setActive(false)
          inFlight.current = false
        }, UNCOVER_DELAY_MS)
      }, COVER_MS)
    },
    [navigate],
  )

  return (
    <Ctx.Provider value={{ transitionTo }}>
      {children}
      <AnimatePresence>{active && <Overlay />}</AnimatePresence>
    </Ctx.Provider>
  )
}
