import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface ConfettiProps {
  /** Forces a re-burst when this number changes. */
  burstId: number
  /** Number of pieces (default 70). */
  count?: number
}

const COLORS = ['#fbbf24', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#f472b6', '#fde047']

/** Burst confetti from screen center. Mounts only while `burstId` exists; remount via key to retrigger. */
export function Confetti({ burstId, count = 70 }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i * 137.508) % 360 // golden-angle scatter
        const distance = 220 + ((i * 53) % 220)
        return {
          id: i,
          angle,
          distance,
          color: COLORS[i % COLORS.length],
          delay: ((i % 14) * 0.015),
          size: 6 + (i % 3) * 3,
          spin: ((i % 2 === 0) ? 1 : -1) * (540 + ((i * 71) % 540)),
        }
      }),
    [count, burstId],
  )

  return (
    <div
      key={burstId}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      <div className="absolute left-1/2 top-1/2">
        {pieces.map((p) => {
          const rad = (p.angle * Math.PI) / 180
          const dx = Math.cos(rad) * p.distance
          const dy = Math.sin(rad) * p.distance
          return (
            <motion.span
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
              animate={{
                x: [0, dx, dx],
                y: [0, dy * 0.4, dy + 240],
                opacity: [0, 1, 1, 0],
                rotate: [0, p.spin],
              }}
              transition={{
                duration: 1.7,
                delay: p.delay,
                times: [0, 0.12, 0.7, 1],
                ease: ['easeOut', 'easeIn'],
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: p.size,
                height: p.size * 0.55,
                background: p.color,
                borderRadius: 2,
                boxShadow: '0 1px 0 rgba(0,0,0,0.25)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
