import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ChatMessage } from '../../lib/types'

const REACTIONS = ['👍', '😂', '😱', '😤', '🔥', '👏', '🎉', '🀄'] as const

interface ChatDrawerProps {
  messages: { id: string; data: ChatMessage }[]
  send: (msg: ChatMessage) => Promise<void>
  selfName: string
  selfUid: string
}

export function ChatDrawer({ messages, send, selfName, selfUid }: ChatDrawerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [lastSeenIdx, setLastSeenIdx] = useState(messages.length)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Keep "last seen" in sync when the drawer is open.
  useEffect(() => {
    if (open) setLastSeenIdx(messages.length)
  }, [open, messages.length])

  // Auto-scroll to bottom on new messages while open.
  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, open])

  const unread = useMemo(() => {
    if (open) return 0
    // Don't count my own messages — I just sent them.
    let n = 0
    for (let i = lastSeenIdx; i < messages.length; i++) {
      if (messages[i].data.uid !== selfUid) n++
    }
    return n
  }, [open, lastSeenIdx, messages, selfUid])

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    await send({ name: selfName, message: text, uid: selfUid, kind: 'text' })
    setDraft('')
  }

  const sendReaction = async (emoji: string) => {
    await send({ name: selfName, message: emoji, uid: selfUid, kind: 'reaction' })
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md bg-stone-800 hover:bg-stone-700 text-stone-100 px-2.5 py-1 text-xs ring-1 ring-stone-700"
        title="Chat"
      >
        💬 Chat
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-rose-500 text-white px-1 ring-2 ring-stone-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Quick reaction shelf — always visible next to the chat button */}
      <div className="flex items-center gap-1">
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => sendReaction(e)}
            className="text-lg leading-none px-1.5 py-1 rounded-md hover:bg-stone-800 ring-1 ring-stone-700/60"
            title={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 z-40 h-screen w-[320px] sm:w-[360px] bg-stone-950/95 backdrop-blur border-l border-stone-800 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
              <h2 className="text-sm font-semibold tracking-wide">Table Chat</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-stone-400 hover:text-white text-sm"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {messages.length === 0 ? (
                <p className="text-xs text-stone-500 italic">No messages yet — say hi 👋</p>
              ) : (
                messages.map((m) => {
                  const mine = m.data.uid === selfUid
                  const isReaction = m.data.kind === 'reaction'
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={[
                          'max-w-[80%] rounded-2xl px-3 py-1.5 text-sm',
                          isReaction ? 'text-2xl bg-transparent' : '',
                          !isReaction && mine
                            ? 'bg-emerald-500 text-stone-900 rounded-br-sm'
                            : '',
                          !isReaction && !mine
                            ? 'bg-stone-800 text-stone-100 rounded-bl-sm ring-1 ring-stone-700'
                            : '',
                        ].join(' ')}
                      >
                        {!isReaction && !mine && (
                          <p className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-0.5">
                            {m.data.name}
                          </p>
                        )}
                        <p className={isReaction ? '' : 'whitespace-pre-wrap break-words'}>
                          {m.data.message}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <form onSubmit={onSend} className="border-t border-stone-800 p-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                maxLength={200}
                className="flex-1 rounded-md bg-stone-900 border border-stone-700 focus:border-emerald-500 focus:outline-none px-3 py-1.5 text-sm text-stone-100"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-stone-900 px-3 py-1.5 text-sm font-semibold"
              >
                Send
              </button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
