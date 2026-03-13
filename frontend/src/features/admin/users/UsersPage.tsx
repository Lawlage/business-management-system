import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../../../contexts/TenantContext'
import { useNotice } from '../../../contexts/NoticeContext'
import { useConfirm } from '../../../contexts/ConfirmContext'
import { useApi } from '../../../hooks/useApi'
import type { ApiError } from '../../../hooks/useApi'
import type { TenantUserMembership, AppRole } from '../../../types'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { Modal } from '../../../components/Modal'
import { PageHeader } from '../../../components/PageHeader'
import { EmptyState } from '../../../components/EmptyState'
import { SkeletonRow } from '../../../components/SkeletonRow'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'

type CreateUserForm = {
  first_name: string
  last_name: string
  email: string
  password: string
  role: AppRole
}

const initialForm: CreateUserForm = {
  first_name: '',
  last_name: '',
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
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data: users, isLoading } = useQuery<TenantUserMembership[]>({
    queryKey: ['tenant-users', selectedTenantId],
    queryFn: () =>
      authedFetch<TenantUserMembership[]>('/api/tenant-users', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
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
      setIsCreateOpen(false)
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: number) =>
      authedFetch(`/api/tenant-users/${userId}`, {
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

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: AppRole }) =>
      authedFetch(`/api/tenant-users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Role updated.')
      void queryClient.invalidateQueries({ queryKey: ['tenant-users', selectedTenantId] })
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  async function handleRemove(userId: number) {
    const ok = await confirm({
      title: 'Remove user?',
      message: 'The user will be removed from this tenant.',
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (!ok) return
    removeMutation.mutate(userId)
  }

  function handleCreate() {
    createMutation.mutate(form)
  }

  return (
    <Card>
      <PageHeader
        title="Tenant Users"
        action={
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            + Create User
          </Button>
        }
      />

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
                  {membership.user.first_name} {membership.user.last_name}{' '}
                  <span className="text-[var(--ui-muted)]">({membership.user.email})</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                  Last login:{' '}
                  {membership.user.last_login_at
                    ? new Date(membership.user.last_login_at).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded border border-[var(--ui-border)] bg-[var(--ui-panel)] px-2 py-1 text-xs text-[var(--ui-text)]"
                  value={membership.role}
                  disabled={
                    changeRoleMutation.isPending &&
                    changeRoleMutation.variables?.userId === membership.user.id
                  }
                  onChange={(e) =>
                    changeRoleMutation.mutate({ userId: membership.user.id, role: e.target.value as AppRole })
                  }
                >
                  <option value="standard_user">Standard User</option>
                  <option value="sub_admin">Sub Admin</option>
                  <option value="tenant_admin">Tenant Admin</option>
                </select>
                <button
                  className="rounded border border-red-500 bg-transparent px-2 py-1 text-xs text-red-500 hover:bg-red-500 hover:text-white disabled:opacity-50"
                  onClick={() => void handleRemove(membership.user.id)}
                  disabled={
                    removeMutation.isPending &&
                    removeMutation.variables === membership.user.id
                  }
                >
                  {removeMutation.isPending && removeMutation.variables === membership.user.id
                    ? '…'
                    : 'Remove'}
                </button>
              </div>
            </div>
          ))}
      </div>

      {isCreateOpen && (
        <Modal
          title="Create User"
          onClose={() => { setIsCreateOpen(false); setForm(initialForm) }}
          maxWidth="md"
          footer={
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleCreate}
                isLoading={createMutation.isPending}
              >
                Add User
              </Button>
            </div>
          }
        >
          <div className="grid gap-3">
            <Input
              label="First Name"
              placeholder="First Name"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            />
            <Input
              label="Last Name"
              placeholder="Last Name"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            />
            <Input
              label="Email"
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Password"
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <Select
              label="Role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
            >
              <option value="standard_user">Standard User</option>
              <option value="sub_admin">Sub Admin</option>
              <option value="tenant_admin">Tenant Admin</option>
            </Select>
          </div>
        </Modal>
      )}
    </Card>
  )
}
