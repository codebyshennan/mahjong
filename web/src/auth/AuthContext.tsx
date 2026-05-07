import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { clearPresence } from '../lib/presence'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (params: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Bump to force a re-render when Firebase mutates the User in place
  // (e.g. after updateProfile, where setUser(sameRef) bails on identity equality).
  const [, bump] = useState({})

  useEffect(() => {
    if (!auth) { setLoading(false); return }
    const unsubscribe = onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!auth) return
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp: AuthContextValue['signUp'] = async ({ email, password, firstName, lastName }) => {
    if (!auth) return
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: `${firstName} ${lastName}` })
    bump({})
  }

  const signOut = async () => {
    if (!auth) return
    if (user) {
      await clearPresence(user.uid, 'online', {
        displayName: user.displayName,
        photoURL: user.photoURL,
      })
    }
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
