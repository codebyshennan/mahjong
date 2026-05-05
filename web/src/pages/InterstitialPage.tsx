import { Link, useParams } from 'react-router-dom'

export default function InterstitialPage() {
  const { roomId } = useParams<{ roomId: string }>()
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Interstitial</h1>
      <p className="text-slate-400">Room: {roomId}</p>
      <p className="text-slate-500">Chat + readiness coming in P4.</p>
      <Link to="/lobby" className="text-emerald-400 hover:text-emerald-300">
        ← Back to lobby
      </Link>
    </div>
  )
}
