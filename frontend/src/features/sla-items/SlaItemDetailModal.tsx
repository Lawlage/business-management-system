import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { Badge } from '../../components/Badge'
import { CurrencyInput } from '../../components/CurrencyInput'
import { AttachmentList } from '../../components/AttachmentList'
import { formatDate } from '../../lib/format'
import type { SlaItem, SlaAllocation, SlaGroup, PaginatedResponse } from '../../types'

type SlaItemForm = {
  name: string
  sku: string
  tier: string
  cost_price: string
  sale_price: string
  notes: string
  sla_group_id: number | null
}

type Props = {
  item: SlaItem
  onClose: () => void
  onUpdated: () => void
  canEdit: boolean
  canDelete: boolean
}

export function SlaItemDetailModal({ item, onClose, onUpdated, canEdit, canDelete }: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId, tenantTimezone } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'allocations' | 'documents'>('details')

  const [form, setForm] = useState<SlaItemForm>({
    name: item.name,
    sku: item.sku,
    tier: item.tier ?? '',
    cost_price: item.cost_price,
    sale_price: item.sale_price,
    notes: item.notes ?? '',
    sla_group_id: item.sla_group_id ?? null,
  })

  const { data: groupsData } = useQuery<SlaGroup[]>({
    queryKey: ['sla-groups', selectedTenantId],
    queryFn: () => authedFetch<SlaGroup[]>('/api/sla-groups', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const setField = <K extends keyof SlaItemForm>(key: K, value: SlaItemForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const { data: allocationsData, refetch: refetchAllocations } = useQuery<PaginatedResponse<SlaAllocation>>({
    queryKey: ['sla-item-allocations', selectedTenantId, item.id],
    queryFn: () =>
      authedFetch<PaginatedResponse<SlaAllocation>>(`/api/sla-allocations?sla_item_id=${item.id}`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && activeTab === 'allocations',
    staleTime: 0,
  })

  const cancelMutation = useMutation({
    mutationFn: (allocationId: number) =>
      authedFetch(`/api/sla-allocations/${allocationId}/cancel`, {
        method: 'POST',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Allocation cancelled.')
      void refetchAllocations()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Cancel failed.', 'error')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/sla-items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('SLA item updated.')
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/sla-items/${item.id}`, { method: 'DELETE', tenantScoped: true }),
    onSuccess: () => {
      showNotice('SLA item moved to recycle bin.')
      void queryClient.invalidateQueries({ queryKey: ['sla-items', selectedTenantId] })
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete SLA item?',
      message: 'This will move the SLA item to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteMutation.mutate()
  }

  const allocations = allocationsData?.data ?? []

  return (
    <>
      <Modal
        title={item.name}
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
            <div className="flex gap-2">
              {canEdit && activeTab === 'details' && (
                <Button
                  variant="primary"
                  onClick={() => saveMutation.mutate()}
                  isLoading={saveMutation.isPending}
                >
                  Save
                </Button>
              )}
            </div>
          </div>
        }
      >
        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-[var(--ui-border)]">
          {(['details', 'allocations', 'documents'] as const).map((tab) => (
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
              label="SKU"
              required
              value={form.sku}
              onChange={(e) => setField('sku', e.target.value)}
              disabled={!canEdit}
            />
            <Input
              label="Tier"
              value={form.tier}
              onChange={(e) => setField('tier', e.target.value)}
              disabled={!canEdit}
              placeholder="e.g. Gold, Silver, Bronze"
            />
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
                SLA Group
              </label>
              <select
                value={form.sla_group_id ?? ''}
                onChange={(e) => setField('sla_group_id', e.target.value ? Number(e.target.value) : null)}
                disabled={!canEdit}
                className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none disabled:opacity-60"
                style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
              >
                <option value="">No group</option>
                {(groupsData ?? []).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <CurrencyInput
              label="Cost Price"
              value={form.cost_price}
              onChange={(v) => setField('cost_price', v)}
              disabled={!canEdit}
            />
            <CurrencyInput
              label="Sale Price"
              value={form.sale_price}
              onChange={(v) => setField('sale_price', v)}
              disabled={!canEdit}
            />
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

        {activeTab === 'allocations' && (
          <div className="space-y-2">
            {allocations.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No allocations for this SLA item.</p>
            ) : (
              allocations.map((a) => (
                <div key={a.id} className="app-inner-box flex items-center gap-3 rounded-md border border-[var(--ui-border)] p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ui-text)]">{a.client?.name ?? '—'}</p>
                    <p className="text-xs text-[var(--ui-muted)]">
                      Qty: {a.quantity}
                      {a.unit_price ? ` · $${a.unit_price} ea · Total: $${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : ''}
                      {a.department ? ` · ${a.department.name}` : ''}
                      {' · '}{formatDate(a.created_at, tenantTimezone)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={a.status} />
                    {a.status === 'active' && canEdit && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => cancelMutation.mutate(a.id)}
                        isLoading={cancelMutation.isPending}
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

        {activeTab === 'documents' && (
          <AttachmentList
            entityType="sla_item"
            entityId={item.id}
            canEdit={canEdit}
          />
        )}
      </Modal>

    </>
  )
}
