import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { Badge } from '../../components/Badge'
import { formatDate } from '../../lib/format'
import type { AccountManager, Client, Renewable, StockAllocation, PaginatedResponse } from '../../types'

type ClientDetailModalProps = {
  client: Client
  onClose: () => void
  onUpdated: () => void
  canDelete: boolean
  canEdit: boolean
}

type ClientForm = {
  name: string
  contact_name: string
  email: string
  phone: string
  website: string
  notes: string
  account_manager_id: number | null
}

export function ClientDetailModal({
  client,
  onClose,
  onUpdated,
  canDelete,
  canEdit,
}: ClientDetailModalProps) {
  const { authedFetch } = useApi()
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'renewals' | 'allocations'>('details')

  const canAllocate = role === 'sub_admin' || role === 'tenant_admin' || role === 'global_superadmin'

  const { data: renewalsData } = useQuery<PaginatedResponse<Renewable>>({
    queryKey: ['client-renewables', selectedTenantId, client.id],
    queryFn: () =>
      authedFetch<PaginatedResponse<Renewable>>(
        `/api/renewables?client_id=${client.id}&page=1`,
        { tenantScoped: true },
      ),
    enabled: !!selectedTenantId && activeTab === 'renewals',
    staleTime: 0,
  })

  const { data: allocationsData, refetch: refetchAllocations } = useQuery<PaginatedResponse<StockAllocation>>({
    queryKey: ['client-allocations', selectedTenantId, client.id],
    queryFn: () =>
      authedFetch<PaginatedResponse<StockAllocation>>(
        `/api/stock-allocations?client_id=${client.id}`,
        { tenantScoped: true },
      ),
    enabled: !!selectedTenantId && activeTab === 'allocations',
    staleTime: 0,
  })

  const cancelAllocationMutation = useMutation({
    mutationFn: (allocationId: number) =>
      authedFetch(`/api/stock-allocations/${allocationId}/cancel`, {
        method: 'POST',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Allocation cancelled.')
      void refetchAllocations()
      void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
    },
    onError: (error: unknown) => {
      showNotice((error as { message?: string })?.message ?? 'Cancel failed.', 'error')
    },
  })

  const { data: accountManagers = [] } = useQuery<AccountManager[]>({
    queryKey: ['account-managers', selectedTenantId],
    queryFn: () => authedFetch<AccountManager[]>('/api/account-managers', { tenantScoped: true }),
    enabled: !!selectedTenantId && canEdit,
    staleTime: 60_000,
  })

  const [form, setForm] = useState<ClientForm>({
    name: client.name ?? '',
    contact_name: client.contact_name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    website: client.website ?? '',
    notes: client.notes ?? '',
    account_manager_id: client.account_manager_id ?? null,
  })

  const setField = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: async (data: ClientForm) => {
      await authedFetch(`/api/clients/${client.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        tenantScoped: true,
      })
    },
    onSuccess: () => {
      showNotice('Client updated.')
      onUpdated()
      onClose()
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Client moved to recycle bin.')
      onUpdated()
      onClose()
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const handleSave = () => {
    const submittedForm = { ...form }
    if (submittedForm.website && !/^https?:\/\//i.test(submittedForm.website)) {
      submittedForm.website = `https://${submittedForm.website}`
    }
    saveMutation.mutate(submittedForm)
  }

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete client?',
      message: 'This will move the client to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  return (
    <Modal
      title="Client Detail"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <div>
            {canDelete && activeTab === 'details' && (
              <Button
                variant="danger"
                onClick={() => void handleDelete()}
                isLoading={deleteMutation.isPending}
              >
                Delete
              </Button>
            )}
          </div>
          {canEdit && activeTab === 'details' && (
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={saveMutation.isPending}
            >
              Save Client
            </Button>
          )}
        </div>
      }
    >
      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-[var(--ui-border)]">
        {(['details', 'renewals', 'allocations'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2 text-sm font-medium capitalize transition',
              activeTab === tab
                ? 'border-b-2 border-[var(--ui-button-bg)] text-[var(--ui-button-bg)]'
                : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'renewals' && (
        <div className="space-y-2">
          {!renewalsData || renewalsData.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No renewals linked to this client.</p>
          ) : (
            renewalsData.data.map((r) => (
              <div key={r.id} className="app-inner-box flex items-center justify-between gap-3 rounded-md border border-[var(--ui-border)] p-3">
                <div>
                  <p className="text-sm font-medium text-[var(--ui-text)]">
                    {r.description ?? r.renewable_product?.name ?? `Renewable #${r.id}`}
                  </p>
                  <p className="text-xs text-[var(--ui-muted)]">
                    {r.renewable_product?.name ?? '—'}
                    {r.next_due_date ? ` · Due ${formatDate(r.next_due_date)}` : ''}
                  </p>
                </div>
                <Badge status={r.status ?? ''} />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'allocations' && (
        <div className="space-y-2">
          {!allocationsData || allocationsData.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No stock allocations for this client.</p>
          ) : (
            allocationsData.data.map((a) => (
              <div key={a.id} className="app-inner-box flex items-center gap-3 rounded-md border border-[var(--ui-border)] p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--ui-text)]">{a.inventory_item?.name ?? '—'}</p>
                  <p className="text-xs text-[var(--ui-muted)]">
                    {a.inventory_item?.sku} · Qty: {a.quantity}
                    {a.unit_price ? ` · $${a.unit_price} ea` : ''}
                    {a.unit_price ? ` · Total: $${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : ''}
                    {' · '}{formatDate(a.created_at, tenantTimezone)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge status={a.status} />
                  {a.status === 'allocated' && canAllocate && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => cancelAllocationMutation.mutate(a.id)}
                      isLoading={cancelAllocationMutation.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'details' && (
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Contact Name"
          value={form.contact_name}
          onChange={(e) => setField('contact_name', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Phone"
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Website"
          type="url"
          value={form.website}
          onChange={(e) => setField('website', e.target.value)}
          disabled={!canEdit}
        />

        <Select
          label="Account Manager"
          value={form.account_manager_id ?? ''}
          onChange={(e) =>
            setField('account_manager_id', e.target.value ? Number(e.target.value) : null)
          }
          disabled={!canEdit}
        >
          <option value="">None</option>
          {accountManagers.map((am) => (
            <option key={am.id} value={am.id}>
              {am.name}
            </option>
          ))}
        </Select>

        <Textarea
          label="Notes"
          className="md:col-span-2"
          rows={3}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          disabled={!canEdit}
        />
      </div>
      )}
    </Modal>
  )
}
