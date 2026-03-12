import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { validate, hasErrors } from '../../lib/validation'
import type { ValidationErrors } from '../../lib/validation'
import type { CustomField } from '../../types'
import { inventoryDefaults } from '../../types'

type CreateInventoryModalProps = {
  onClose: () => void
  onCreated: () => void
}

type InventoryForm = typeof inventoryDefaults

export function CreateInventoryModal({ onClose, onCreated }: CreateInventoryModalProps) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()

  const [form, setForm] = useState<InventoryForm>({ ...inventoryDefaults })
  const [errors, setErrors] = useState<ValidationErrors<InventoryForm>>({})
  const [customValues, setCustomValues] = useState<Record<number, string | number | boolean | null>>({})

  const { data: customFields } = useQuery<CustomField[]>({
    queryKey: ['custom-fields', selectedTenantId, 'inventory'],
    queryFn: () =>
      authedFetch<CustomField[]>('/api/custom-fields?entity_type=inventory', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const item = await authedFetch<{ id: number }>('/api/inventory', {
        method: 'POST',
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
      showNotice('Inventory item created.')
      onCreated()
      onClose()
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Request failed',
        'error',
      )
    },
  })

  const handleSubmit = () => {
    const newErrors = validate<InventoryForm>(
      [
        { field: 'name', required: true, message: 'Name is required.' },
        { field: 'sku', required: true, message: 'SKU is required.' },
        { field: 'quantity_on_hand', min: 0, message: 'Quantity must be 0 or greater.' },
        { field: 'minimum_on_hand', min: 0, message: 'Minimum must be 0 or greater.' },
      ],
      form,
    )

    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    mutation.mutate()
  }

  const setField = <K extends keyof InventoryForm>(key: K, value: InventoryForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
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
        />
      )
    }

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
      />
    )
  }

  return (
    <Modal
      title="Create Inventory Item"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="primary" isLoading={mutation.isPending} onClick={handleSubmit}>
            Create Item
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Name"
          required
          error={errors.name}
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />

        <Input
          label="SKU"
          required
          error={errors.sku}
          value={form.sku}
          onChange={(e) => setField('sku', e.target.value)}
        />

        <Input
          label="Quantity on Hand"
          type="number"
          min={0}
          error={errors.quantity_on_hand}
          value={form.quantity_on_hand}
          onChange={(e) => setField('quantity_on_hand', Number(e.target.value))}
        />

        <Input
          label="Minimum on Hand"
          type="number"
          min={0}
          error={errors.minimum_on_hand}
          value={form.minimum_on_hand}
          onChange={(e) => setField('minimum_on_hand', Number(e.target.value))}
        />

        <Input
          label="Location"
          value={form.location}
          onChange={(e) => setField('location', e.target.value)}
        />

        <Input
          label="Vendor"
          value={form.vendor}
          onChange={(e) => setField('vendor', e.target.value)}
        />

        <Textarea
          label="Notes"
          className="md:col-span-2"
          rows={3}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
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
