import { useEffect, useState } from 'react'
import { onChildAdded, onValue, push, ref, set as rtdbSet } from 'firebase/database'
import { rtdb } from './firebase'
import type { ChatMessage } from './types'

interface ChatHandle {
  messages: { id: string; data: ChatMessage }[]
  send: (msg: ChatMessage) => Promise<void>
}

/**
 * Subscribe to a chat path under RTDB and expose a `send`. Uses onChildAdded
 * (each new message triggers an append) rather than onValue, so chat history
 * grows incrementally without rebuilding the whole list.
 */
export function useChat(path: string): ChatHandle {
  const [messages, setMessages] = useState<{ id: string; data: ChatMessage }[]>([])

  useEffect(() => {
    const chatRef = ref(rtdb, path)
    const unsub = onChildAdded(chatRef, (snap) => {
      const id = snap.key ?? Math.random().toString(36)
      setMessages((prev) => [...prev, { id, data: snap.val() as ChatMessage }])
    })
    return () => {
      unsub()
      setMessages([])
    }
  }, [path])

  return {
    messages,
    send: async (msg) => {
      await rtdbSet(push(ref(rtdb, path)), msg)
    },
  }
}

/**
 * Subscribe to a single RTDB value. Useful for game-wide flags. Returns the
 * raw value or null when the path is empty / not yet loaded.
 */
export function useRtdbValue<T>(path: string | null): T | null {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    if (!path) {
      setValue(null)
      return
    }
    const unsub = onValue(ref(rtdb, path), (snap) => {
      setValue(snap.val() as T | null)
    })
    return unsub
  }, [path])
  return value
}
