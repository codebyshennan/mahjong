// Tiny WebAudio synth — no asset files. Each sound is a short oscillator burst.

export type SfxKind =
  | 'click'
  | 'select'
  | 'discard'
  | 'draw'
  | 'claim'
  | 'win'
  | 'illegal'
  | 'flower'
  | 'turn'

const STORAGE_KEY = 'mahjong:muted'

let ctx: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface BeepOpts {
  freq: number
  durationMs: number
  type?: OscillatorType
  attack?: number
  release?: number
  gain?: number
  detune?: number
  endFreq?: number
}

function beep({
  freq,
  durationMs,
  type = 'sine',
  attack = 0.005,
  release = 0.04,
  gain = 0.18,
  detune = 0,
  endFreq,
}: BeepOpts) {
  const c = ensureCtx()
  if (!c) return
  const now = c.currentTime
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationMs / 1000)
  }
  osc.detune.setValueAtTime(detune, now)
  env.gain.setValueAtTime(0, now)
  env.gain.linearRampToValueAtTime(gain, now + attack)
  env.gain.linearRampToValueAtTime(0, now + Math.max(attack + 0.005, durationMs / 1000) + release)
  osc.connect(env).connect(c.destination)
  osc.start(now)
  osc.stop(now + durationMs / 1000 + release + 0.05)
}

function noiseBurst({ durationMs, gain = 0.08 }: { durationMs: number; gain?: number }) {
  const c = ensureCtx()
  if (!c) return
  const now = c.currentTime
  const length = Math.max(1, Math.floor(c.sampleRate * (durationMs / 1000)))
  const buffer = c.createBuffer(1, length, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const env = c.createGain()
  env.gain.setValueAtTime(gain, now)
  env.gain.linearRampToValueAtTime(0, now + durationMs / 1000)
  // Lowpass shapes it into a wood "thud" rather than white-noise hiss.
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(900, now)
  src.connect(filter).connect(env).connect(c.destination)
  src.start(now)
  src.stop(now + durationMs / 1000 + 0.02)
}

export function playSfx(kind: SfxKind) {
  if (muted) return
  switch (kind) {
    case 'click':
      beep({ freq: 880, durationMs: 25, type: 'triangle', gain: 0.08 })
      break
    case 'select':
      // Soft pickup — slightly higher pitched, very brief.
      beep({ freq: 1020, durationMs: 18, type: 'sine', gain: 0.07 })
      break
    case 'discard':
      // Wood "thock" — noise burst + low square thump.
      noiseBurst({ durationMs: 60, gain: 0.12 })
      beep({ freq: 280, durationMs: 50, type: 'square', gain: 0.12, endFreq: 180 })
      setTimeout(() => beep({ freq: 200, durationMs: 60, type: 'triangle', gain: 0.08 }), 18)
      break
    case 'draw':
      // Quick rising chirp — tile reveal.
      beep({ freq: 540, durationMs: 70, type: 'sine', gain: 0.1, endFreq: 760 })
      break
    case 'claim':
      // Bright two-note announce.
      beep({ freq: 660, durationMs: 90, type: 'sine', gain: 0.16 })
      setTimeout(() => beep({ freq: 880, durationMs: 140, type: 'sine', gain: 0.16 }), 90)
      break
    case 'win':
      // Triumphal arpeggio.
      const notes = [523, 659, 784, 1047, 1319]
      notes.forEach((f, i) =>
        setTimeout(
          () => beep({ freq: f, durationMs: 200, type: 'sine', gain: 0.18 }),
          i * 110,
        ),
      )
      // Sparkle tail.
      setTimeout(() => {
        ;[2093, 2637].forEach((f, i) =>
          setTimeout(() => beep({ freq: f, durationMs: 90, type: 'triangle', gain: 0.1 }), i * 90),
        )
      }, 600)
      break
    case 'illegal':
      // Low buzz — falling pitch + fuzz.
      beep({ freq: 220, durationMs: 90, type: 'sawtooth', gain: 0.1, endFreq: 110 })
      setTimeout(
        () => beep({ freq: 180, durationMs: 60, type: 'sawtooth', gain: 0.08, endFreq: 90 }),
        70,
      )
      break
    case 'flower':
      // Wind-chime sparkle.
      ;[1320, 1760, 2093, 2637].forEach((f, i) =>
        setTimeout(
          () => beep({ freq: f, durationMs: 90, type: 'sine', gain: 0.07 }),
          i * 50,
        ),
      )
      break
    case 'turn':
      // Soft "ding" cue when it becomes your turn.
      beep({ freq: 880, durationMs: 80, type: 'sine', gain: 0.08 })
      setTimeout(() => beep({ freq: 1320, durationMs: 100, type: 'sine', gain: 0.06 }), 60)
      break
  }
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted)
  return muted
}
