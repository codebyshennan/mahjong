import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../auth/AuthContext'

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
      setError(`Registration failed (${code})`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-800/60 ring-1 ring-slate-700 p-6 space-y-6">
        <h1 className="text-2xl text-center font-semibold tracking-tight">Register</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" value={firstName} onChange={setFirstName} required autoFocus />
            <Field label="Last name" value={lastName} onChange={setLastName} required />
          </div>
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-900 font-medium py-2"
          >
            {submitting ? 'Creating account…' : 'Register'}
          </button>
        </form>
        <div className="pt-2 text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300">
            Login
          </Link>
        </div>
      </div>
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
      <span className="text-sm text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        className="w-full rounded-md bg-slate-900 ring-1 ring-slate-700 focus:ring-emerald-500 focus:outline-none px-3 py-2"
      />
    </label>
  )
}
