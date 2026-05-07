import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../auth/AuthContext'
import { usePageTransition } from '../lib/PageTransition'

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const { transitionTo } = usePageTransition()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/lobby" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/lobby', { replace: true })
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : 'auth/unknown'
      setError(friendlyError(code))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="text-center space-y-1 mb-6">
        <h1
          className="text-4xl"
          style={{ fontFamily: 'var(--display)', color: 'var(--ink)' }}
        >
          麻将之王
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink-mute)', fontFamily: 'var(--serif)' }}>
          Sign in to play with friends
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoFocus />
        <Field label="Password" type="password" value={password} onChange={setPassword} required />
        {error && (
          <p
            className="text-sm rounded-md px-3 py-2"
            style={{
              background: 'var(--seal-pale)',
              color: 'var(--seal)',
              border: '1px solid oklch(60% 0.165 38 / 0.25)',
              fontFamily: 'var(--serif)',
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg px-6 py-3 font-semibold text-sm transition-all duration-150 active:scale-95 disabled:opacity-60"
          style={{
            background: 'var(--jade)',
            color: 'var(--ivory)',
            boxShadow: '0 2px 0 var(--jade-shade), 0 6px 16px oklch(70% 0.075 162 / 0.20)',
            fontFamily: 'var(--serif)',
          }}
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm">
        <p style={{ color: 'var(--ink-mute)', fontFamily: 'var(--serif)' }}>
          New here?{' '}
          <Link
            to="/register"
            style={{ color: 'var(--seal)', fontFamily: 'var(--serif)' }}
            className="font-medium hover:underline"
          >
            Create an account
          </Link>
        </p>
        <div className="w-full h-px" style={{ background: 'var(--paper-edge)' }} />
        <Link
          to="/practice"
          className="text-sm hover:underline"
          style={{ color: 'var(--ink-faint)', fontFamily: 'var(--serif)' }}
        >
          Play Solo — No account needed →
        </Link>
      </div>
    </AuthShell>
  )
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper min-h-screen flex flex-col items-center justify-center p-5">
      {/* Top accent line */}
      <div className="w-full max-w-sm mb-0 h-1 rounded-t-lg" style={{ background: 'var(--wood)' }} />
      <div
        className="w-full max-w-sm rounded-b-xl p-7"
        style={{
          background: 'var(--ivory)',
          boxShadow: 'var(--shadow-lift)',
          border: '1px solid var(--ivory-line)',
          borderTop: 'none',
        }}
      >
        {children}
      </div>
      <Link
        to="/"
        className="mt-5 text-xs hover:underline"
        style={{ color: 'var(--ink-faint)', fontFamily: 'var(--serif)' }}
      >
        ← Back to home
      </Link>
    </div>
  )
}

function Field({
  label,
  type = 'text',
  value,
  onChange,
  required,
  autoFocus,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  autoFocus?: boolean
}) {
  return (
    <label className="block space-y-1">
      <span
        className="text-xs font-medium tracking-wide uppercase"
        style={{ color: 'var(--ink-mute)', fontFamily: 'var(--serif)' }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        className="w-full rounded-md px-3 py-2 text-sm outline-none transition-all"
        style={{
          background: 'var(--paper-soft)',
          border: '1px solid var(--ivory-line)',
          color: 'var(--ink)',
          fontFamily: 'var(--serif)',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--jade)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--ivory-line)')}
      />
    </label>
  )
}

function friendlyError(code: string): string {
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Incorrect email or password'
  }
  if (code.includes('too-many-requests')) return 'Too many attempts — try again later'
  if (code.includes('network')) return 'Network error — check your connection'
  return `Sign-in failed (${code})`
}
