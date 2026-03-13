import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token, email, password, password_confirmation: confirmation }),
      })

      const data = (await res.json()) as {
        message?: string
        errors?: Record<string, string[]>
      }

      if (!res.ok) {
        if (data.errors) {
          const flat: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(data.errors)) {
            flat[key] = msgs[0] ?? ''
          }
          setFieldErrors(flat)
        } else {
          setError(data.message ?? 'Failed to reset password.')
        }
        return
      }

      navigate('/login?reset=1')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="app-shell density-comfortable flex min-h-screen items-center justify-center p-4 text-[var(--ui-text)]">
        <div className="w-full max-w-md rounded-xl border border-[var(--ui-border)] app-panel p-6 shadow-sm">
          <p className="text-sm text-red-400">Invalid or missing reset link. Please request a new one.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell density-comfortable flex min-h-screen items-center justify-center p-4 text-[var(--ui-text)]">
      <div className="w-full max-w-md rounded-xl border border-[var(--ui-border)] app-panel p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">Choose a new password for <strong>{email}</strong>.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="relative">
            <Input
              label="New password"
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label="Toggle password visibility"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-[2.1rem] p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
            )}
          </div>

          <div className="relative">
            <Input
              label="Confirm new password"
              id="reset-confirm"
              type={showConfirm ? 'text' : 'password'}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label="Toggle confirm password visibility"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-2 top-[2.1rem] p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <p className="text-xs text-[var(--ui-muted)]">
            Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.
          </p>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {fieldErrors.email && <p className="text-sm text-red-400">{fieldErrors.email}</p>}

          <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full">
            Reset password
          </Button>
        </form>
      </div>
    </div>
  )
}
