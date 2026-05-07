import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from './types'

export interface Bubble {
  /** Unique id from the rtdb push key — used to drive AnimatePresence. */
  id: string
  text: string
  ts: number
  kind: 'text' | 'reaction'
}

/**
 * Tracks the most-recent ephemeral message per sender (uid first, falling back to name).
 * Bubbles auto-expire after `ttlMs` so each seat shows just the latest thing said.
 */
export function useSeatBubbles(
  messages: { id: string; data: ChatMessage }[],
  ttlMs = 5000,
): Record<string, Bubble> {
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({})
  const lastSeenLenRef = useRef(0)

  useEffect(() => {
    if (messages.length <= lastSeenLenRef.current) {
      lastSeenLenRef.current = messages.length
      return
    }
    setBubbles((prev) => {
      const next = { ...prev }
      for (let i = lastSeenLenRef.current; i < messages.length; i++) {
        const m = messages[i]
        const key = m.data.uid ?? m.data.name
        next[key] = {
          id: m.id,
          text: m.data.message,
          ts: Date.now(),
          kind: m.data.kind === 'reaction' ? 'reaction' : 'text',
        }
      }
      return next
    })
    lastSeenLenRef.current = messages.length
  }, [messages])

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setBubbles((prev) => {
        let changed = false
        const next: Record<string, Bubble> = {}
        for (const [k, b] of Object.entries(prev)) {
          if (now - b.ts > ttlMs) {
            changed = true
            continue
          }
          next[k] = b
        }
        return changed ? next : prev
      })
    }, 800)
    return () => clearInterval(id)
  }, [ttlMs])

  return bubbles
}
