import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface TableSurfaceProps {
  children: React.ReactNode
  /** Number of slow drifting motes (default 14). */
  motes?: number
  /** Optional className appended to the container (e.g. for spacing tweaks). */
  className?: string
}

/**
 * Mahjong table surface — felt + wood frame + vignette + center spotlight + ambient motes.
 * All decorative layers are pointer-events-none so they never intercept clicks.
 */
export function TableSurface({ children, motes = 14, className = '' }: TableSurfaceProps) {
  const reduce = useReducedMotion()
  return (
    <div
      className={`relative rounded-[28px] overflow-hidden ${className}`}
      style={{
        background:
          'radial-gradient(ellipse at 50% 38%, #1a7a55 0%, #136a4a 40%, #0c4d35 75%, #08361f 100%)',
        boxShadow:
          'inset 0 0 0 8px #3b2515, inset 0 0 0 14px #6a4427, inset 0 0 0 16px #3b2515, inset 0 0 120px rgba(0,0,0,0.55), 0 28px 70px -22px rgba(0,0,0,0.85)',
      }}
    >
      {/* Wood-grain frame highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,210,150,0.10) 0%, rgba(0,0,0,0) 6%, rgba(0,0,0,0) 94%, rgba(255,210,150,0.06) 100%)',
        }}
      />
      {/* Felt grain — SVG fractal noise tinted dark green */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
        style={{ backgroundImage: `url("${FELT_NOISE_DATA_URI}")`, backgroundSize: '320px 320px' }}
      />
      {/* Crosshatch weave — fine threads at ±45° to suggest billiard-cloth weave */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 4px),' +
            'repeating-linear-gradient(-45deg, rgba(0,0,0,0.45) 0 1px, transparent 1px 4px)',
        }}
      />
      {/* Center spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(255,234,182,0.18) 0%, rgba(255,234,182,0.06) 28%, rgba(0,0,0,0) 60%)',
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)',
        }}
      />
      {/* Ambient motes */}
      {!reduce && motes > 0 && <Motes count={motes} />}

      <div className="relative z-10 p-3 sm:p-5 flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  )
}

function Motes({ count }: { count: number }) {
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: ((i * 47) % 100) + ((i * 13) % 7),
        delay: (i * 0.7) % 8,
        duration: 14 + ((i * 5) % 9),
        size: 2 + (i % 3),
      })),
    [count],
  )
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {seeds.map((m, i) => (
        <motion.span
          key={i}
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: '-10%', opacity: [0, 0.6, 0.6, 0] }}
          transition={{
            duration: m.duration,
            delay: m.delay,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.1, 0.85, 1],
          }}
          style={{
            position: 'absolute',
            left: `${m.left}%`,
            width: m.size,
            height: m.size,
            borderRadius: '9999px',
            background: 'rgba(255,234,182,0.6)',
            filter: 'blur(0.5px)',
            boxShadow: '0 0 6px rgba(255,234,182,0.45)',
          }}
        />
      ))}
    </div>
  )
}

// 320x320 SVG turbulence — encoded once to avoid asset wiring.
const FELT_NOISE_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'>
      <filter id='n' x='0' y='0'>
        <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/>
        <feColorMatrix values='0 0 0 0 0.05  0 0 0 0 0.30  0 0 0 0 0.18  0 0 0 0.45 0'/>
      </filter>
      <rect width='100%' height='100%' filter='url(#n)'/>
    </svg>`,
  )
