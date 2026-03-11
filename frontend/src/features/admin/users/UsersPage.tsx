import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../../../contexts/TenantContext'
import { useNotice } from '../../../contexts/NoticeContext'
import { useConfirm } from '../../../contexts/ConfirmContext'
import { useApi } from '../../../hooks/useApi'
import type { ApiError } from '../../../hooks/useApi'
import type { TenantUserMembership, AppRole } from '../../../types'
import { roleLabels } from '../../../types'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { PageHeader } from '../../../components/PageHeader'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonRow } from '../../../components/SkeletonRow'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'

type CreateUserForm = {
  name: string
  email: string
  password: string
  role: AppRole
}

const initialForm: CreateUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'standard_user',
}

export function UsersPage() {
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<CreateUserForm>(initialForm)

  const { data: users, isLoading } = useQuery<TenantUserMembership[]>({
    queryKey: ['tenant-users', selectedTenantId],
    queryFn: () =>
      authedFetch<TenantUserMembership[]>('/api/tenant-users', { tenantScoped: true }),
    enabled: !!selectedTenantId,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateUserForm) =>
      authedFetch('/api/tenant-users', {
        method: 'POST',
        body: JSON.stringify(data),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Tenant user created.')
      void queryClient.invalidateQueries({ queryKey: ['tenant-users', selectedTenantId] })
      setForm(initialForm)
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      authedFetch(`/api/tenant-users/${id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Tenant user removed.')
      void queryClient.invalidateQueries({ queryKey: ['tenant-users', selectedTenantId] })
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const toggleEditMutation = useMutation({
    mutationFn: ({ id, can_edit }: { id: number; can_edit: boolean }) =>
      authedFetch(`/api/tenant-users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ can_edit }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('User permissions updated.')
      void queryClient.invalidateQueries({ queryKey: ['tenant-users', selectedTenantId] })
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  async function handleRemove(id: number) {
    const ok = await confirm({
      title: 'Remove user?',
      message: 'The user will be removed from this tenant.',
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    removeMutation.mutate(id)
  }

  function handleToggleEdit(id: number, currentCanEdit: boolean) {
    toggleEditMutation.mutate({ id, can_edit: !currentCanEdit })
  }

  function handleCreate() {
    createMutation.mutate(form)
  }

  return (
    <Card>
      <PageHeader title="Tenant Users" />

      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <Input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <Input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
        <Select
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
        >
          <option value="standard_user">Standard User</option>
          <option value="sub_admin">Sub Admin</option>
          <option value="tenant_admin">Tenant Admin</option>
        </Select>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreate}
          isLoading={createMutation.isPending}
        >
          Add User
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {!isLoading && users && users.length === 0 && (
          <EmptyState message="No users in this tenant." />
        )}

        {!isLoading &&
          users &&
          users.map((membership) => (
            <div
              key={membership.id}
              className="flex items-center justify-between rounded-md border border-[var(--ui-border)] app-inner-box p-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--ui-text)]">
                  {membership.user.name}{' '}
                  <span className="text-[var(--ui-muted)]">({membership.user.email})</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                  {roleLabels[membership.role]} &mdash;{' '}
                  {membership.can_edit ? 'Can edit' : 'Read only'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleToggleEdit(membership.id, membership.can_edit)}
                  isLoading={
                    toggleEditMutation.isPending &&
                    (toggleEditMutation.variables as { id: number } | undefined)?.id ===
                      membership.id
                  }
                >
                  {membership.can_edit ? 'Revoke Edit' : 'Allow Edit'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleRemove(membership.id)}
                  isLoading={
                    removeMutation.isPending &&
                    (removeMutation.variables as number | undefined) === membership.id
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
      </div>
    </Card>
  )
}
