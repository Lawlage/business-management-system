import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { useApi } from '../../hooks/useApi'
import type { ApiError } from '../../hooks/useApi'
import type { Tenant } from '../../types'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { Input } from '../../components/Input'
import { Badge } from '../../components/Badge'

type TenantForm = {
  name: string
  slug: string
}

type AdminForm = {
  first_name: string
  last_name: string
  email: string
  password: string
}

const initialTenantForm: TenantForm = { name: '', slug: '' }
const initialAdminForm: AdminForm = { first_name: '', last_name: '', email: '', password: '' }

export function TenantsPage() {
  const { setSuperTenants } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [tenantForm, setTenantForm] = useState<TenantForm>(initialTenantForm)
  const [adminForm, setAdminForm] = useState<AdminForm>(initialAdminForm)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['superadmin-tenants'],
    queryFn: () => authedFetch<Tenant[]>('/api/superadmin/tenants'),
    staleTime: 0,
  })

  useEffect(() => {
    if (tenants) {
      setSuperTenants(tenants)
    }
  }, [tenants, setSuperTenants])

  const createMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/superadmin/tenants', {
        method: 'POST',
        body: JSON.stringify({ ...tenantForm, tenant_admin: adminForm }),
      }),
    onSuccess: () => {
      showNotice('Tenant created with tenant admin.')
      void queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      setTenantForm(initialTenantForm)
      setAdminForm(initialAdminForm)
      setIsCreateOpen(false)
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const suspendMutation = useMutation({
    mutationFn: (id: string) =>
      authedFetch(`/api/superadmin/tenants/${id}/suspend`, { method: 'POST' }),
    onSuccess: () => {
      showNotice('Tenant suspended.')
      void queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] })
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const unsuspendMutation = useMutation({
    mutationFn: (id: string) =>
      authedFetch(`/api/superadmin/tenants/${id}/unsuspend`, { method: 'POST' }),
    onSuccess: () => {
      showNotice('Tenant unsuspended.')
      void queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] })
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      authedFetch(`/api/superadmin/tenants/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showNotice('Tenant deleted.')
      void queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] })
    },
    onError: (error: ApiError | Error) => {
      showNotice((error as ApiError | Error)?.message ?? 'Request failed', 'error')
    },
  })

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Delete tenant?',
      message: 'This action is high-risk and will permanently remove the tenant and all their data.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    deleteMutation.mutate(id)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  return (
    <Card>
      <PageHeader
        title="Tenants"
        action={
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            + Create Tenant
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

        {!isLoading && tenants && tenants.length === 0 && (
          <EmptyState message="No tenants found." />
        )}

        {!isLoading &&
          tenants &&
          tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="flex items-center justify-between rounded-md border border-[var(--ui-border)] app-inner-box p-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--ui-text)]">
                  {tenant.name}{' '}
                  <span className="text-[var(--ui-muted)]">({tenant.slug})</span>
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-[var(--ui-muted)]">Status:</span>
                  <Badge status={tenant.status === 'active' ? 'Active' : 'Suspended'} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {tenant.status === 'active' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => suspendMutation.mutate(tenant.id)}
                    isLoading={
                      suspendMutation.isPending &&
                      (suspendMutation.variables as string | undefined) === tenant.id
                    }
                  >
                    Suspend
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => unsuspendMutation.mutate(tenant.id)}
                    isLoading={
                      unsuspendMutation.isPending &&
                      (unsuspendMutation.variables as string | undefined) === tenant.id
                    }
                  >
                    Unsuspend
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleDelete(tenant.id)}
                  isLoading={
                    deleteMutation.isPending &&
                    (deleteMutation.variables as string | undefined) === tenant.id
                  }
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
      </div>

      {isCreateOpen && (
        <Modal
          title="Create Tenant + Admin"
          onClose={() => { setIsCreateOpen(false); setTenantForm(initialTenantForm); setAdminForm(initialAdminForm) }}
          maxWidth="md"
          footer={
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={() => createMutation.mutate()}
                isLoading={createMutation.isPending}
              >
                Create Tenant + Admin
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="grid gap-3">
            <Input
              label="Tenant Name"
              placeholder="Tenant Name"
              required
              value={tenantForm.name}
              onChange={(e) => setTenantForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Tenant Slug"
              placeholder="tenant-slug"
              required
              value={tenantForm.slug}
              onChange={(e) => setTenantForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <Input
              label="Admin First Name"
              placeholder="Admin First Name"
              required
              value={adminForm.first_name}
              onChange={(e) => setAdminForm((f) => ({ ...f, first_name: e.target.value }))}
            />
            <Input
              label="Admin Last Name"
              placeholder="Admin Last Name"
              required
              value={adminForm.last_name}
              onChange={(e) => setAdminForm((f) => ({ ...f, last_name: e.target.value }))}
            />
            <Input
              label="Admin Email"
              placeholder="Admin Email"
              type="email"
              required
              value={adminForm.email}
              onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Admin Password"
              placeholder="Admin Password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={adminForm.password}
              onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
            />
          </form>
        </Modal>
      )}
    </Card>
  )
}
