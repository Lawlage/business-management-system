import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser } from '../types'

type AuthContextType = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string) => void
  logout: () => void
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem('auth_token'))

  // Set loading when token changes (render-time adjustment)
  const [prevToken, setPrevToken] = useState(token)
  if (token !== prevToken) {
    setPrevToken(token)
    if (token) {
      setIsLoading(true)
    }
  }

  useEffect(() => {
    if (!token) return

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Session expired')
        const payload = (await res.json()) as { user: AuthUser }
        setUser(payload.user)
        setIsAuthenticated(true)
      })
      .catch(() => {
        localStorage.removeItem('auth_token')
        setToken(null)
        setUser(null)
        setIsAuthenticated(false)
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const login = (newToken: string) => {
    localStorage.setItem('auth_token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, isLoading, login, logout, setUser, setIsAuthenticated }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
