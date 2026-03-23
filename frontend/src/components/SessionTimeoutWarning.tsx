import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useApi } from '../hooks/useApi'
import { Button } from './Button'

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000 // 24 hours (matches Sanctum config)
const WARNING_BEFORE_MS = 5 * 60 * 1000 // 5 minutes before expiry

export function SessionTimeoutWarning() {
  const { token, isAuthenticated, login } = useAuth()
  const { authedFetch } = useApi()
  const [showWarning, setShowWarning] = useState(false)
  const [renewing, setRenewing] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setShowWarning(false)
      return
    }

    // Track when token was last set/renewed
    const issuedAt = Number(localStorage.getItem('token_issued_at') || Date.now())
    if (!localStorage.getItem('token_issued_at')) {
      localStorage.setItem('token_issued_at', String(Date.now()))
    }

    const expiresAt = issuedAt + TOKEN_LIFETIME_MS
    const warningAt = expiresAt - WARNING_BEFORE_MS
    const now = Date.now()
    const delay = Math.max(0, warningAt - now)

    const timer = window.setTimeout(() => setShowWarning(true), delay)
    return () => clearTimeout(timer)
  }, [isAuthenticated, token])

  async function handleRenew() {
    setRenewing(true)
    try {
      const data = await authedFetch<{ token: string }>('/api/auth/refresh', {
        method: 'POST',
      })
      login(data.token)
      localStorage.setItem('token_issued_at', String(Date.now()))
      setShowWarning(false)
    } catch {
      // If refresh fails, the user will be logged out on next API call
    } finally {
      setRenewing(false)
    }
  }

  if (!showWarning) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] rounded-lg border border-amber-600 bg-amber-950/95 p-4 shadow-2xl backdrop-blur-sm max-w-sm">
      <p className="text-sm font-medium text-amber-200">Session expiring soon</p>
      <p className="mt-1 text-xs text-amber-300/80">
        Your session will expire in about 5 minutes. Renew to stay logged in.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="primary" onClick={() => void handleRenew()} isLoading={renewing}>
          Renew Session
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowWarning(false)}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
