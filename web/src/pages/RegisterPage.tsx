import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../auth/AuthContext'
import { AuthShell } from './LoginPage'
import { usePageTransition } from '../lib/PageTransition'

export default function RegisterPage() {
  const { user, signUp } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/lobby" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setSubmitting(true)
    try {
      await signUp({ email, password, firstName, lastName })
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
          Create your account to play with friends
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" value={firstName} onChange={setFirstName} required autoFocus />
          <Field label="Last name" value={lastName} onChange={setLastName} required />
        </div>
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
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
            background: 'var(--seal)',
            color: 'var(--ivory)',
            boxShadow: '0 2px 0 var(--wood-deep), 0 6px 20px oklch(60% 0.165 38 / 0.25)',
            fontFamily: 'var(--serif)',
          }}
        >
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm">
        <p style={{ color: 'var(--ink-mute)', fontFamily: 'var(--serif)' }}>
          Already registered?{' '}
          <Link
            to="/login"
            style={{ color: 'var(--jade-shade)', fontFamily: 'var(--serif)' }}
            className="font-medium hover:underline"
          >
            Sign in
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
  if (code.includes('email-already-in-use')) return 'An account with this email already exists'
  if (code.includes('invalid-email')) return 'Please enter a valid email address'
  if (code.includes('weak-password')) return 'Password must be at least 6 characters'
  if (code.includes('network')) return 'Network error — check your connection'
  return `Registration failed (${code})`
}
