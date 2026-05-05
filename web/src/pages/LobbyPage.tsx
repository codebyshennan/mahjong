import { useAuth } from '../auth/AuthContext'

export default function LobbyPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold">🀨 麻将之王</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">{user?.displayName || user?.email}</span>
          <button onClick={signOut} className="text-slate-300 hover:text-white">
            Logout
          </button>
        </div>
      </header>
      <main className="p-8">
        <p className="text-slate-400">Lobby coming in P3.</p>
      </main>
    </div>
  )
}
