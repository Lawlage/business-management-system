import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'

export function LoginPage() {
  const { login } = useAuth()
  const [searchParams] = useSearchParams()
  const wasReset = searchParams.get('reset') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState('')

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = (await res.json()) as { token?: string; message?: string }

      if (!res.ok) {
        setAuthError(data.message ?? 'Login failed. Please check your credentials.')
        return
      }

      if (data.token) {
        login(data.token)
      }
    } catch {
      setAuthError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-shell density-comfortable flex min-h-screen items-center justify-center p-4 text-[var(--ui-text)]">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-xl border border-[var(--ui-border)] app-panel p-6 shadow-sm"
      >
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">Use your platform credentials to access the system.</p>

        {wasReset && (
          <p className="mt-3 text-sm text-green-400">Password reset successfully. You can now sign in.</p>
        )}

        <div className="mt-4 space-y-4">
          <Input
            label="Email"
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />

          <div className="relative">
            <Input
              label="Password"
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              aria-label="Toggle password"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-[2.1rem] p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="mt-2 text-right">
          <Link
            to="/forgot-password"
            className="text-xs text-[var(--ui-muted)] hover:text-[var(--ui-text)] underline underline-offset-2"
          >
            Forgot password?
          </Link>
        </div>

        {authError && (
          <p className="mt-3 text-sm text-red-400">{authError}</p>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="mt-5 w-full"
        >
          Sign in
        </Button>
      </form>
    </div>
  )
}
