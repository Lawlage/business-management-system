import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { useApi } from '../../hooks/useApi'
import type { ApiError } from '../../hooks/useApi'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'

export function BreakGlassPage() {
  const {
    superTenants,
    selectedTenantId,
    setSelectedTenantId,
    breakGlassToken,
    setBreakGlassToken,
    setIsSuperadminTenantWorkspace,
  } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const { authedFetch } = useApi()
  const navigate = useNavigate()

  const [breakGlassReason, setBreakGlassReason] = useState('')
  const [breakGlassConfirmed, setBreakGlassConfirmed] = useState(false)

  const startMutation = useMutation({
    mutationFn: () =>
      authedFetch<{ token: string }>(
        `/api/superadmin/tenants/${selectedTenantId}/break-glass`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: breakGlassReason,
            permission_confirmed: breakGlassConfirmed,
          }),
        },
      ),
    onSuccess: (data) => {
      setBreakGlassToken(data.token)
      showNotice('Break-glass session started.')
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const stopMutation = useMutation({
    mutationFn: () =>
      authedFetch(
        `/api/superadmin/tenants/${selectedTenantId}/break-glass/${breakGlassToken}/stop`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      setBreakGlassToken('')
      setIsSuperadminTenantWorkspace(false)
      setBreakGlassReason('')
      setBreakGlassConfirmed(false)
      showNotice('Break-glass session ended.')
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const enterMutation = useMutation({
    mutationFn: async () => {
      if (!breakGlassToken) {
        const data = await authedFetch<{ token: string }>(
          `/api/superadmin/tenants/${selectedTenantId}/break-glass`,
          {
            method: 'POST',
            body: JSON.stringify({
              reason: breakGlassReason,
              permission_confirmed: breakGlassConfirmed,
            }),
          },
        )
        setBreakGlassToken(data.token)
      }
    },
    onSuccess: () => {
      setIsSuperadminTenantWorkspace(true)
      void navigate('/app')
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  async function handleStop() {
    const ok = await confirm({
      title: 'End break-glass session?',
      message: 'You will exit tenant workspace and return to superadmin mode.',
      confirmLabel: 'End Session',
      variant: 'danger',
    })
    if (!ok) return
    stopMutation.mutate()
  }

  function handleEnter() {
    enterMutation.mutate()
  }

  return (
    <Card>
      <PageHeader title="Superadmin Tenant Access" />
      <p className="mb-4 text-sm text-[var(--ui-muted)]">
        Use this workflow only when approved and authorised to access a tenant workspace.
        All access is immutably logged.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          label="Select Tenant"
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
        >
          <option value="">Select tenant</option>
          {superTenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.slug})
            </option>
          ))}
        </Select>

        <Input
          label="Break-glass reason"
          value={breakGlassReason}
          onChange={(e) => setBreakGlassReason(e.target.value)}
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="rounded"
          checked={breakGlassConfirmed}
          onChange={(e) => setBreakGlassConfirmed(e.target.checked)}
        />
        I confirm tenant permission was received
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        {breakGlassToken && (
          <Button
            variant="danger"
            onClick={() => void handleStop()}
            isLoading={stopMutation.isPending}
          >
            End Break-Glass
          </Button>
        )}
        {!breakGlassToken && (
          <Button
            variant="secondary"
            onClick={() => startMutation.mutate()}
            isLoading={startMutation.isPending}
            disabled={!breakGlassConfirmed || !selectedTenantId || !breakGlassReason}
          >
            Start Break-Glass
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleEnter}
          isLoading={enterMutation.isPending}
        >
          Enter Tenant Workspace
        </Button>
      </div>

      <p className="mt-2 text-xs text-[var(--ui-muted)]">
        {breakGlassToken
          ? 'Break-glass session is active.'
          : 'No active break-glass session.'}
      </p>
    </Card>
  )
}
