import { useState, useEffect } from 'react'
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
import { CurrencyInput } from '../../components/CurrencyInput'
import { AttachmentList } from '../../components/AttachmentList'
import { formatDate } from '../../lib/format'
import { AllocateStockModal } from './AllocateStockModal'
import type { InventoryItem, CustomField, CustomFieldValueResponse, StockAllocation, PaginatedResponse } from '../../types'

type InventoryDetailModalProps = {
  item: InventoryItem
  onClose: () => void
  onUpdated: () => void
  canDelete: boolean
  canEdit: boolean
}

type InventoryForm = {
  name: string
  quantity_on_hand: number
  minimum_on_hand: number
  location: string
  vendor: string
  notes: string
  cost_price: string
  sale_price: string
  barcode: string
}

export function InventoryDetailModal({
  item,
  onClose,
  onUpdated,
  canDelete,
  canEdit,
}: InventoryDetailModalProps) {
  const { authedFetch } = useApi()
  const { selectedTenantId, role, tenantTimezone } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'allocations' | 'documents'>('details')
  const [isAllocateOpen, setIsAllocateOpen] = useState(false)

  const canAllocate = role === 'sub_admin' || role === 'tenant_admin' || role === 'global_superadmin'

  const { data: allocationsData, refetch: refetchAllocations } = useQuery<PaginatedResponse<StockAllocation>>({
    queryKey: ['item-allocations', selectedTenantId, item.id],
    queryFn: () =>
      authedFetch<PaginatedResponse<StockAllocation>>(
        `/api/stock-allocations?inventory_item_id=${item.id}`,
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
      onUpdated()
    },
    onError: (error: unknown) => {
      showNotice((error as { message?: string })?.message ?? 'Cancel failed.', 'error')
    },
  })

  const [form, setForm] = useState<InventoryForm>({
    name: item.name ?? '',
    quantity_on_hand: item.quantity_on_hand ?? 0,
    minimum_on_hand: item.minimum_on_hand ?? 0,
    location: item.location ?? '',
    vendor: item.vendor ?? '',
    notes: item.notes ?? '',
    cost_price: item.cost_price ?? '0.00',
    sale_price: item.sale_price ?? '0.00',
    barcode: item.barcode ?? '',
  })

  const [customValues, setCustomValues] = useState<Record<number, string | number | boolean | null>>({})

  const setField = <K extends keyof InventoryForm>(key: K, value: InventoryForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Fetch custom field definitions for inventory
  const { data: customFields } = useQuery<CustomField[]>({
    queryKey: ['custom-fields', selectedTenantId, 'inventory'],
    queryFn: () =>
      authedFetch<CustomField[]>('/api/custom-fields?entity_type=inventory', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  // Fetch existing custom field values for this item
  const { data: customFieldValues } = useQuery<CustomFieldValueResponse[]>({
    queryKey: ['custom-field-values', selectedTenantId, 'inventory', item.id],
    queryFn: () =>
      authedFetch<CustomFieldValueResponse[]>(
        `/api/custom-field-values/inventory/${item.id}`,
        { tenantScoped: true },
      ),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  // Seed customValues state from fetched values
  useEffect(() => {
    if (!customFieldValues) return
    const map: Record<number, string | number | boolean | null> = {}
    for (const v of customFieldValues) {
      map[v.definition_id] = v.value
    }
    setCustomValues(map)
  }, [customFieldValues])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await authedFetch(`/api/inventory/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
        tenantScoped: true,
      })
      if (customFields && customFields.length > 0) {
        await authedFetch(`/api/custom-field-values/inventory/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify({ values: customValues }),
          tenantScoped: true,
        })
      }
    },
    onSuccess: () => {
      showNotice('Inventory item updated.')
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
      authedFetch(`/api/inventory/${item.id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Inventory item moved to recycle bin.')
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
    saveMutation.mutate()
  }

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete inventory item?',
      message: 'This will move the item to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate()
    }
  }

  function renderCustomField(field: CustomField) {
    const rawValue = customValues[field.id] ?? null

    if (field.field_type === 'boolean') {
      return (
        <div key={field.id} className="flex items-center">
          <label className="flex items-center gap-2 text-sm text-[var(--ui-text)]">
            <input
              type="checkbox"
              checked={rawValue === true}
              onChange={(e) =>
                setCustomValues((prev) => ({ ...prev, [field.id]: e.target.checked }))
              }
              disabled={!canEdit}
              className="rounded border-[var(--ui-border)]"
            />
            {field.name}
          </label>
        </div>
      )
    }

    if (field.field_type === 'currency') {
      return (
        <div key={field.id}>
          {canEdit ? (
            <Input
              label={`${field.name} ($)`}
              type="number"
              step="0.01"
              value={rawValue !== null ? String(rawValue) : ''}
              onChange={(e) =>
                setCustomValues((prev) => ({
                  ...prev,
                  [field.id]: e.target.value === '' ? null : e.target.value,
                }))
              }
              onBlur={(e) => {
                if (e.target.value === '') return
                const rounded = parseFloat(e.target.value).toFixed(2)
                setCustomValues((prev) => ({ ...prev, [field.id]: rounded }))
              }}
            />
          ) : (
            <Input
              label={field.name}
              value={rawValue !== null ? `$${Number(rawValue).toFixed(2)}` : ''}
              disabled
            />
          )}
        </div>
      )
    }

    if (field.field_type === 'number') {
      return (
        <Input
          key={field.id}
          label={field.name}
          type="number"
          step="any"
          value={rawValue !== null ? String(rawValue) : ''}
          onChange={(e) =>
            setCustomValues((prev) => ({
              ...prev,
              [field.id]: e.target.value === '' ? null : e.target.value,
            }))
          }
          disabled={!canEdit}
        />
      )
    }

    if (field.field_type === 'date') {
      return (
        <Input
          key={field.id}
          label={field.name}
          type="date"
          value={rawValue !== null ? String(rawValue) : ''}
          onChange={(e) =>
            setCustomValues((prev) => ({
              ...prev,
              [field.id]: e.target.value || null,
            }))
          }
          disabled={!canEdit}
        />
      )
    }

    if (field.field_type === 'dropdown' && field.dropdown_options) {
      return (
        <Select
          key={field.id}
          label={field.name}
          value={rawValue !== null ? String(rawValue) : ''}
          onChange={(e) =>
            setCustomValues((prev) => ({
              ...prev,
              [field.id]: e.target.value || null,
            }))
          }
          disabled={!canEdit}
        >
          <option value="">— Select —</option>
          {field.dropdown_options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      )
    }

    // text / json / fallback
    return (
      <Input
        key={field.id}
        label={field.name}
        value={rawValue !== null ? String(rawValue) : ''}
        onChange={(e) =>
          setCustomValues((prev) => ({
            ...prev,
            [field.id]: e.target.value || null,
          }))
        }
        disabled={!canEdit}
      />
    )
  }

  return (
    <>
    <Modal
      title="Inventory Detail"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between">
          <div>
            {canDelete && (
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
            {canAllocate && activeTab === 'details' && (
              <Button variant="secondary" onClick={() => setIsAllocateOpen(true)}>
                Allocate Stock
              </Button>
            )}
            {canEdit && activeTab === 'details' && (
              <Button
                variant="primary"
                onClick={handleSave}
                isLoading={saveMutation.isPending}
              >
                Save Item
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

      {activeTab === 'documents' && (
        <AttachmentList
          entityType="inventory"
          entityId={item.id}
          canEdit={canEdit}
        />
      )}

      {activeTab === 'allocations' ? (
        <div className="space-y-2">
          {!allocationsData || allocationsData.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No allocations yet.</p>
          ) : (
            <>
              <div className="mb-2 hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
                <span>Client</span>
                <span>Qty</span>
                <span>Unit Price</span>
                <span>Total</span>
                <span>Date</span>
                <span />
              </div>
              {allocationsData.data.map((a) => (
                <div key={a.id} className="app-inner-box flex items-center gap-3 rounded-md border border-[var(--ui-border)] p-3">
                  <div className="grid flex-1 gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
                    <span className="text-sm font-medium text-[var(--ui-text)]">{a.client?.name ?? '—'}</span>
                    <span className="text-sm text-[var(--ui-text)]">{a.quantity}</span>
                    <span className="text-sm text-[var(--ui-muted)]">{a.unit_price ? `$${a.unit_price}` : '—'}</span>
                    <span className="text-sm text-[var(--ui-muted)]">{a.unit_price ? `$${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : '—'}</span>
                    <span className="text-xs text-[var(--ui-muted)]">{formatDate(a.created_at, tenantTimezone)}</span>
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
              ))}
            </>
          )}
        </div>
      ) : (
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
          value={item.sku}
          disabled
          hint="SKU cannot be changed after creation."
        />

        <Input
          label="Quantity on Hand"
          type="number"
          min={0}
          value={form.quantity_on_hand}
          onChange={(e) => setField('quantity_on_hand', Number(e.target.value))}
          disabled={!canEdit}
        />

        <Input
          label="Minimum on Hand"
          type="number"
          min={0}
          value={form.minimum_on_hand}
          onChange={(e) => setField('minimum_on_hand', Number(e.target.value))}
          disabled={!canEdit}
        />

        <Input
          label="Location"
          value={form.location}
          onChange={(e) => setField('location', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Vendor"
          value={form.vendor}
          onChange={(e) => setField('vendor', e.target.value)}
          disabled={!canEdit}
        />

        <Input
          label="Barcode / EAN"
          value={form.barcode}
          onChange={(e) => setField('barcode', e.target.value)}
          disabled={!canEdit}
          placeholder="e.g. 5901234123457"
        />

        <div /> {/* grid spacer */}

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

        {customFields && customFields.length > 0 && (
          <>
            <div className="md:col-span-2 border-t border-[var(--ui-border)] pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
                Custom Fields
              </p>
            </div>
            {customFields.map((field) => renderCustomField(field))}
          </>
        )}
      </div>
      )}
    </Modal>

    {isAllocateOpen && (
      <AllocateStockModal
        item={item}
        onClose={() => setIsAllocateOpen(false)}
        onAllocated={() => {
          void refetchAllocations()
          onUpdated()
        }}
      />
    )}
    </>
  )
}
