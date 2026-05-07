import { motion } from 'framer-motion'
import type { Bubble } from '../../lib/useSeatBubbles'

/**
 * Floating speech bubble for chat or reactions.
 * Positioned by the parent (use absolute + top/left); this is the visual.
 */
export function SpeechBubble({
  bubble,
  align = 'top',
}: {
  bubble: Bubble
  align?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const isReaction = bubble.kind === 'reaction'
  return (
    <motion.div
      key={bubble.id}
      initial={{ scale: 0.4, opacity: 0, y: align === 'top' ? 8 : align === 'bottom' ? -8 : 0 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.6, opacity: 0, y: -10, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
      className={[
        'pointer-events-none select-none whitespace-nowrap max-w-[220px]',
        isReaction ? 'text-3xl' : 'text-xs',
      ].join(' ')}
    >
      {isReaction ? (
        <span
          className="inline-block"
          style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}
        >
          {bubble.text}
        </span>
      ) : (
        <span
          className="inline-block px-3 py-1.5 rounded-2xl bg-stone-50 text-stone-900 ring-1 ring-stone-300 font-medium"
          style={{ boxShadow: '0 6px 16px -4px rgba(0,0,0,0.5)' }}
        >
          {bubble.text}
        </span>
      )}
    </motion.div>
  )
}
