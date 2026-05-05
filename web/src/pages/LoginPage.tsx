import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
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
      setError(`Login failed (${code})`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="🀨 麻将之王">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} required autoFocus />
        <Field label="Password" type="password" value={password} onChange={setPassword} required />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-900 font-medium py-2"
        >
          {submitting ? 'Signing in…' : 'Login'}
        </button>
      </form>
      <div className="pt-4 text-center text-sm text-slate-400">
        New here?{' '}
        <Link to="/register" className="text-emerald-400 hover:text-emerald-300">
          Create an account
        </Link>
      </div>
    </AuthShell>
  )
}

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-800/60 ring-1 ring-slate-700 p-6 space-y-6">
        <h1 className="text-2xl text-center font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  required,
  autoFocus,
}: {
  label: string
  type: string
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
