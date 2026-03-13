import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email }),
      })
      // Always show success — the backend never reveals whether an email exists.
      setSubmitted(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-shell density-comfortable flex min-h-screen items-center justify-center p-4 text-[var(--ui-text)]">
      <div className="w-full max-w-md rounded-xl border border-[var(--ui-border)] app-panel p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Forgot password</h1>

        {submitted ? (
          <>
            <p className="mt-3 text-sm text-[var(--ui-muted)]">
              If an account with that email exists, a password reset link has been sent. Check your inbox.
            </p>
            <Link
              to="/login"
              className="mt-5 block text-sm text-[var(--ui-muted)] hover:text-[var(--ui-text)] underline underline-offset-2"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--ui-muted)]">
              Enter your email address and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <Input
                label="Email"
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" variant="primary" isLoading={isSubmitting} className="w-full">
                Send reset link
              </Button>
            </form>

            <Link
              to="/login"
              className="mt-4 block text-sm text-[var(--ui-muted)] hover:text-[var(--ui-text)] underline underline-offset-2"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
