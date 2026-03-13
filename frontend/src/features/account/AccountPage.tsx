import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useApi } from '../../hooks/useApi'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import type { AuthUser } from '../../types'
import type { ApiError } from '../../hooks/useApi'

type ProfilePayload = { first_name: string; last_name: string; email: string }
type PasswordPayload = {
  current_password: string
  new_password: string
  new_password_confirmation: string
}

function fieldErrors(err: unknown, field: string): string {
  const apiErr = err as ApiError | null
  return apiErr?.errors?.[field]?.[0] ?? ''
}

export function AccountPage() {
  const { user, setUser } = useAuth()
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()

  // --- Profile form state ---
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')

  // --- Password form state ---
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const profileMutation = useMutation<{ user: AuthUser }, ApiError, ProfilePayload>({
    mutationFn: (payload) =>
      authedFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setUser(data.user)
      showNotice('Profile updated.')
    },
    onError: () => {
      showNotice('Failed to update profile.', 'error')
    },
  })

  const passwordMutation = useMutation<{ message: string }, ApiError, PasswordPayload>({
    mutationFn: (payload) =>
      authedFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      showNotice('Password updated.')
    },
    onError: () => {
      showNotice('Failed to update password.', 'error')
    },
  })

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault()
    profileMutation.mutate({ first_name: firstName, last_name: lastName, email })
  }

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault()
    passwordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: confirmPassword,
    })
  }

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-xl font-semibold">My Account</h1>

      {/* Profile section */}
      <section className="app-panel rounded-xl border border-[var(--ui-border)] p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4">Profile</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="First name"
                id="profile-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              {fieldErrors(profileMutation.error, 'first_name') && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors(profileMutation.error, 'first_name')}</p>
              )}
            </div>
            <div>
              <Input
                label="Last name"
                id="profile-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
              {fieldErrors(profileMutation.error, 'last_name') && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors(profileMutation.error, 'last_name')}</p>
              )}
            </div>
          </div>
          <div>
            <Input
              label="Email"
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {fieldErrors(profileMutation.error, 'email') && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors(profileMutation.error, 'email')}</p>
            )}
          </div>
          <Button type="submit" variant="primary" isLoading={profileMutation.isPending}>
            Save profile
          </Button>
        </form>
      </section>

      {/* Change password section */}
      <section className="app-panel rounded-xl border border-[var(--ui-border)] p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="relative">
            <Input
              label="Current password"
              id="current-password"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              aria-label="Toggle current password"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-2 top-[2.1rem] p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {fieldErrors(passwordMutation.error, 'current_password') && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors(passwordMutation.error, 'current_password')}</p>
            )}
          </div>

          <div className="relative">
            <Input
              label="New password"
              id="new-password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label="Toggle new password"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-2 top-[2.1rem] p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {fieldErrors(passwordMutation.error, 'new_password') && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors(passwordMutation.error, 'new_password')}</p>
            )}
          </div>

          <div className="relative">
            <Input
              label="Confirm new password"
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label="Toggle confirm password"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-2 top-[2.1rem] p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <p className="text-xs text-[var(--ui-muted)]">
            Password must be at least 12 characters and include uppercase, lowercase, a number, and a symbol.
          </p>

          <Button type="submit" variant="primary" isLoading={passwordMutation.isPending}>
            Update password
          </Button>
        </form>
      </section>
    </div>
  )
}
