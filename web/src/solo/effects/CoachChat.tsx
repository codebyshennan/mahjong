import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

function IconCompass({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

function IconMic({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function IconMicOff({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

interface Message {
  id: string
  role: 'coach' | 'user'
  text: string
}

const SPEECH_SUPPORTED =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

const MAX_VISIBLE = 3

export function CoachInline({
  advice,
  onAnswer,
}: {
  advice: string | null
  onAnswer: (question: string) => string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const prevAdviceRef = useRef<string | null>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (!advice || advice === prevAdviceRef.current) return
    prevAdviceRef.current = advice
    setMessages((m) => {
      const next = [...m, { id: `coach-${Date.now()}`, role: 'coach' as const, text: advice }]
      return next.slice(-MAX_VISIBLE * 2)
    })
  }, [advice])

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const answer = onAnswer(trimmed)
      setMessages((m) => {
        const next = [
          ...m,
          { id: `user-${Date.now()}`, role: 'user' as const, text: trimmed },
          { id: `coach-${Date.now() + 1}`, role: 'coach' as const, text: answer },
        ]
        return next.slice(-MAX_VISIBLE * 2)
      })
      setInput('')
    },
    [onAnswer],
  )

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.onresult = (e: any) => {
      const text: string | undefined = e.results[0]?.[0]?.transcript
      if (text) send(text)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }, [send])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const visible = messages.slice(-MAX_VISIBLE)

  return (
    <div className="flex flex-col items-center gap-1.5 mb-2 w-full pointer-events-none select-none">
      {/* Message pills */}
      <div className="flex flex-col items-center gap-1 w-full max-w-lg px-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={['w-full flex', m.role === 'user' ? 'justify-end' : 'justify-center'].join(
                ' ',
              )}
            >
              <span
                className={[
                  'inline-block px-3 py-1 rounded-2xl text-xs leading-relaxed max-w-[90%]',
                  m.role === 'coach'
                    ? 'bg-black/30 text-stone-100 ring-1 ring-white/10 backdrop-blur-sm'
                    : 'bg-emerald-600/50 text-white ring-1 ring-emerald-400/30 backdrop-blur-sm',
                ].join(' ')}
              >
                {m.role === 'coach' && <IconCompass className="inline-block w-3 h-3 mr-1.5 opacity-60 shrink-0 align-middle" />}
                {m.text}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input row */}
      <div className="pointer-events-auto flex items-center gap-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder="Ask coach…"
          className="bg-black/25 text-stone-100 text-xs rounded-full px-3 py-1 outline-none placeholder:text-stone-400/70 focus:bg-black/40 focus:ring-1 focus:ring-white/20 transition-colors w-36 sm:w-48 backdrop-blur-sm"
        />
        {SPEECH_SUPPORTED && (
          <button
            onClick={listening ? stopListening : startListening}
            className={[
              'rounded-full w-6 h-6 flex items-center justify-center transition-colors',
              listening
                ? 'bg-red-500/70 text-white animate-pulse'
                : 'bg-black/25 text-stone-300 hover:bg-black/40 backdrop-blur-sm',
            ].join(' ')}
            title={listening ? 'Stop listening' : 'Speak'}
          >
            {listening
              ? <IconMicOff className="w-3.5 h-3.5" />
              : <IconMic className="w-3.5 h-3.5" />
            }
          </button>
        )}
      </div>
    </div>
  )
}
