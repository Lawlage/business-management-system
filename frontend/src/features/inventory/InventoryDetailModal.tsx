import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import type { InventoryItem, CustomField, CustomFieldValueResponse } from '../../types'

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
}

export function InventoryDetailModal({
  item,
  onClose,
  onUpdated,
  canDelete,
  canEdit,
}: InventoryDetailModalProps) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()

  const [form, setForm] = useState<InventoryForm>({
    name: item.name ?? '',
    quantity_on_hand: item.quantity_on_hand ?? 0,
    minimum_on_hand: item.minimum_on_hand ?? 0,
    location: item.location ?? '',
    vendor: item.vendor ?? '',
    notes: item.notes ?? '',
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
          {canEdit && (
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={saveMutation.isPending}
            >
              Save Item
            </Button>
          )}
        </div>
      }
    >
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
    </Modal>
  )
}
