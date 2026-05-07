import { motion } from 'framer-motion'

export type StampTone = 'claim' | 'win' | 'neutral'

interface StampProps {
  text: string
  tone?: StampTone
  subtitle?: string
}

const TONE: Record<StampTone, { gradient: string; ring: string; text: string; streak: string }> = {
  claim: {
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 60%, #b45309 100%)',
    ring: 'ring-2 ring-amber-300/80',
    text: 'text-stone-900',
    streak: 'rgba(251,191,36,0.55)',
  },
  win: {
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #fbbf24 100%)',
    ring: 'ring-2 ring-amber-200/90',
    text: 'text-amber-50',
    streak: 'rgba(239,68,68,0.55)',
  },
  neutral: {
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 60%, #0369a1 100%)',
    ring: 'ring-2 ring-sky-200/80',
    text: 'text-white',
    streak: 'rgba(56,189,248,0.5)',
  },
}

/**
 * Big fighting-game style action stamp — used for PONG!, CHOW!, KONG!, and MAHJONG! moments.
 * Animates in with a hard scale-punch, slight tilt, and a streak sweep behind.
 * Auto-mounts/unmounts via parent's AnimatePresence — caller controls duration.
 */
export function Stamp({ text, tone = 'claim', subtitle }: StampProps) {
  const t = TONE[tone]
  return (
    <motion.div
      key={text}
      initial={{ scale: 0.2, rotate: -12, opacity: 0 }}
      animate={{ scale: [0.2, 1.25, 1], rotate: [-12, -2, -6], opacity: 1 }}
      exit={{ scale: 1.6, opacity: 0, transition: { duration: 0.22 } }}
      transition={{ duration: 0.45, times: [0, 0.6, 1], ease: 'easeOut' }}
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center"
    >
      {/* Streak background sweep */}
      <motion.div
        aria-hidden
        initial={{ x: '-110%', opacity: 0 }}
        animate={{ x: '110%', opacity: [0, 0.85, 0] }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute inset-y-0 w-1/3"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${t.streak} 50%, transparent 100%)`,
          filter: 'blur(20px)',
        }}
      />
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ y: 30 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 14 }}
          className={[
            'relative px-10 py-5 rounded-2xl ring-offset-2 ring-offset-stone-950',
            t.ring,
            t.text,
          ].join(' ')}
          style={{
            background: t.gradient,
            boxShadow:
              '0 0 0 4px rgba(0,0,0,0.35), 0 30px 60px -10px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -3px 0 rgba(0,0,0,0.25)',
          }}
        >
          <span className="block text-7xl sm:text-8xl font-black tracking-wider drop-shadow-[0_4px_0_rgba(0,0,0,0.35)]">
            {text}
          </span>
        </motion.div>
        {subtitle && (
          <motion.span
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.3 }}
            className="mt-3 px-3 py-1 rounded-full bg-stone-950/80 text-amber-200 text-xs uppercase tracking-[0.25em] ring-1 ring-amber-300/40"
          >
            {subtitle}
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}
