import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

// Heavy gameplay routes — code-split so login/lobby loads stay tiny.
const LobbyPage = lazy(() => import('./pages/LobbyPage'))
const InterstitialPage = lazy(() => import('./pages/InterstitialPage'))
const GamePage = lazy(() => import('./pages/GamePage'))
const PracticePage = lazy(() => import('./pages/PracticePage'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-300 flex items-center justify-center text-sm">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/lobby"
              element={
                <RequireAuth>
                  <LobbyPage />
                </RequireAuth>
              }
            />
            <Route
              path="/interstitial/:roomId"
              element={
                <RequireAuth>
                  <InterstitialPage />
                </RequireAuth>
              }
            />
            <Route
              path="/game/:roomId"
              element={
                <RequireAuth>
                  <GamePage />
                </RequireAuth>
              }
            />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
