import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { CurrencyInput } from '../../components/CurrencyInput'
import { AttachmentList } from '../../components/AttachmentList'
import { renewalCategoryOptions, renewalWorkflowOptions } from '../../types'
import type { Renewal, CustomField, CustomFieldValueResponse, Department } from '../../types'

type RenewalDetailModalProps = {
  renewal: Renewal
  onClose: () => void
  onUpdated: () => void
  canDelete: boolean
  canEdit: boolean
}

type RenewalForm = {
  title: string
  client_id: number | null
  department_id: number | null
  category: string
  expiration_date: string
  workflow_status: string
  auto_renews: boolean
  notes: string
  cost_price: string
  sale_price: string
}

export function RenewalDetailModal({
  renewal,
  onClose,
  onUpdated,
  canDelete,
  canEdit,
}: RenewalDetailModalProps) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()

  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details')

  const [form, setForm] = useState<RenewalForm>({
    title: renewal.title ?? '',
    client_id: renewal.client_id ?? null,
    department_id: renewal.department_id ?? null,
    category: renewal.category ?? '',
    expiration_date: renewal.expiration_date ?? '',
    workflow_status: renewal.workflow_status ?? '',
    auto_renews: renewal.auto_renews ?? false,
    notes: renewal.notes ?? '',
    cost_price: renewal.cost_price ?? '0.00',
    sale_price: renewal.sale_price ?? '0.00',
  })

  const [customValues, setCustomValues] = useState<Record<number, string | number | boolean | null>>({})

  const setField = <K extends keyof RenewalForm>(key: K, value: RenewalForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Fetch clients for the dropdown
  const { data: clientList } = useQuery({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () =>
      authedFetch<{ id: number; name: string }[]>('/api/clients?all=1', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  // Fetch custom field definitions for renewals
  const { data: customFields } = useQuery<CustomField[]>({
    queryKey: ['custom-fields', selectedTenantId, 'renewal'],
    queryFn: () =>
      authedFetch<CustomField[]>('/api/custom-fields?entity_type=renewal', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  // Fetch existing custom field values for this renewal
  const { data: customFieldValues } = useQuery<CustomFieldValueResponse[]>({
    queryKey: ['custom-field-values', selectedTenantId, 'renewal', renewal.id],
    queryFn: () =>
      authedFetch<CustomFieldValueResponse[]>(
        `/api/custom-field-values/renewal/${renewal.id}`,
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
      await authedFetch(`/api/renewals/${renewal.id}`, {
        method: 'PUT',
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
      showNotice('Renewal updated.')
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
      authedFetch(`/api/renewals/${renewal.id}`, {
        method: 'DELETE',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Renewal moved to recycle bin.')
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
      title: 'Delete renewal?',
      message: 'This will move the renewal to recycle bin.',
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
    <Modal
      title="Renewal Detail"
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
              Save Renewal
            </Button>
          )}
        </div>
      }
    >
      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-[var(--ui-border)]">
        {(['details', 'documents'] as const).map((tab) => (
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
          label="Title"
          required
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          disabled={!canEdit}
        />

        <Select
          label="Client"
          value={form.client_id !== null ? String(form.client_id) : ''}
          onChange={(e) => setField('client_id', e.target.value ? Number(e.target.value) : null)}
          disabled={!canEdit}
        >
          <option value="">— No client —</option>
          {clientList?.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </Select>

        {departments.length > 0 && (
          <Select
            label="Department"
            value={form.department_id !== null ? String(form.department_id) : ''}
            onChange={(e) => setField('department_id', e.target.value ? Number(e.target.value) : null)}
            disabled={!canEdit}
          >
            <option value="">— No department —</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </Select>
        )}

        <Select
          label="Type"
          value={form.category}
          onChange={(e) => setField('category', e.target.value)}
          disabled={!canEdit}
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
          value={form.expiration_date?.slice(0, 10) ?? ''}
          onChange={(e) => setField('expiration_date', e.target.value)}
          disabled={!canEdit}
        />

        <Select
          label="Workflow Status"
          value={form.workflow_status}
          onChange={(e) => setField('workflow_status', e.target.value)}
          disabled={!canEdit}
        >
          <option value="">Select status</option>
          {renewalWorkflowOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>

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

        <div className="flex items-center md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-[var(--ui-text)]">
            <input
              type="checkbox"
              checked={form.auto_renews}
              onChange={(e) => setField('auto_renews', e.target.checked)}
              disabled={!canEdit}
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
      )}

      {activeTab === 'documents' && (
        <AttachmentList
          entityType="renewal"
          entityId={renewal.id}
          canEdit={canEdit}
        />
      )}
    </Modal>
  )
}
