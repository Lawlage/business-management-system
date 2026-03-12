import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { validate, hasErrors } from '../../lib/validation'
import type { ValidationErrors } from '../../lib/validation'
import type { CustomField } from '../../types'
import { renewalCategoryOptions, renewalWorkflowOptions, renewalDefaults } from '../../types'

type CreateRenewalModalProps = {
  onClose: () => void
  onCreated: () => void
}

type RenewalForm = typeof renewalDefaults

export function CreateRenewalModal({ onClose, onCreated }: CreateRenewalModalProps) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()

  const [form, setForm] = useState<RenewalForm>({ ...renewalDefaults })
  const [errors, setErrors] = useState<ValidationErrors<RenewalForm>>({})
  const [customValues, setCustomValues] = useState<Record<number, string | number | boolean | null>>({})

  const { data: customFields } = useQuery<CustomField[]>({
    queryKey: ['custom-fields', selectedTenantId, 'renewal'],
    queryFn: () =>
      authedFetch<CustomField[]>('/api/custom-fields?entity_type=renewal', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const renewal = await authedFetch<{ id: number }>('/api/renewals', {
        method: 'POST',
        body: JSON.stringify(form),
        tenantScoped: true,
      })
      if (customFields && customFields.length > 0) {
        await authedFetch(`/api/custom-field-values/renewal/${renewal.id}`, {
          method: 'PUT',
          body: JSON.stringify({ values: customValues }),
          tenantScoped: true,
        })
      }
    },
    onSuccess: () => {
      showNotice('Renewal created.')
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
    const newErrors = validate<RenewalForm>(
      [
        { field: 'title', required: true, message: 'Title is required.' },
        { field: 'expiration_date', required: true, message: 'Expiration date is required.' },
      ],
      form,
    )

    setErrors(newErrors)
    if (hasErrors(newErrors)) return

    mutation.mutate()
  }

  const setField = <K extends keyof RenewalForm>(key: K, value: RenewalForm[K]) => {
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
      title="Create Renewal"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="primary" isLoading={mutation.isPending} onClick={handleSubmit}>
            Create Renewal
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Title"
          required
          error={errors.title}
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
        />

        <Select
          label="Type"
          value={form.category}
          onChange={(e) => setField('category', e.target.value)}
        >
          {renewalCategoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Input
          label="Expiration Date"
          type="date"
          required
          error={errors.expiration_date}
          value={form.expiration_date}
          onChange={(e) => setField('expiration_date', e.target.value)}
        />

        <Select
          label="Workflow Status"
          value={form.workflow_status}
          onChange={(e) => setField('workflow_status', e.target.value)}
        >
          <option value="">Select status</option>
          {renewalWorkflowOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>

        <Textarea
          label="Notes"
          className="md:col-span-2"
          rows={3}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
        />

        <div className="flex items-center md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-[var(--ui-text)]">
            <input
              type="checkbox"
              checked={form.auto_renews}
              onChange={(e) => setField('auto_renews', e.target.checked)}
              className="rounded border-[var(--ui-border)]"
            />
            Auto-renews
          </label>
        </div>

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
