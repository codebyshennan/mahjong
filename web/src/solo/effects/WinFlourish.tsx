import { AnimatePresence, motion } from 'framer-motion'
import { Confetti } from './Confetti'

interface WinFlourishProps {
  active: boolean
  selfDraw: boolean
  burstId: number
}

/**
 * Big celebratory overlay shown the moment a round ends in a win.
 * Confetti + a swooping golden dragon emoji + a bright "MAHJONG!" announce.
 * Caller drives `active` (true while the modal/round-end is on screen) and bumps `burstId` per win.
 */
export function WinFlourish({ active, selfDraw, burstId }: WinFlourishProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={burstId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-30"
        >
          <Confetti burstId={burstId} />
          {/* Dragon swoops across the table from left to right */}
          <motion.span
            initial={{ x: '-30vw', y: 80, scale: 0.6, rotate: -10, opacity: 0 }}
            animate={{
              x: ['-30vw', '50vw', '130vw'],
              y: [80, -60, 100],
              scale: [0.6, 1.3, 0.7],
              rotate: [-10, 6, -4],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: 2.2, times: [0, 0.5, 1], ease: 'easeInOut' }}
            className="absolute top-[30%] left-0 text-[120px] sm:text-[160px]"
            style={{ filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.5))' }}
          >
            🐉
          </motion.span>
          {/* Mahjong banner */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0, y: -40 }}
            animate={{ scale: [0.4, 1.15, 1], opacity: 1, y: 0 }}
            transition={{ duration: 0.6, times: [0, 0.6, 1], ease: 'easeOut', delay: 0.15 }}
            className="absolute inset-x-0 top-[18%] flex items-center justify-center"
          >
            <div
              className="px-8 py-3 rounded-2xl ring-2 ring-amber-200/90"
              style={{
                background:
                  'linear-gradient(135deg, #fde047 0%, #fbbf24 35%, #ef4444 100%)',
                boxShadow:
                  '0 0 0 4px rgba(0,0,0,0.4), 0 24px 60px -10px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 0 rgba(0,0,0,0.25)',
              }}
            >
              <span className="block text-5xl sm:text-7xl font-black text-stone-900 drop-shadow-[0_3px_0_rgba(255,255,255,0.45)] tracking-wider">
                MAHJONG! 🀄
              </span>
              <span className="block mt-1 text-center text-xs uppercase tracking-[0.3em] text-stone-900/80">
                {selfDraw ? '自摸 · self-draw' : '胡牌 · won on discard'}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
