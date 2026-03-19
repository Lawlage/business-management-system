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
import { Select } from '../../components/Select'
import { AttachmentList } from '../../components/AttachmentList'
import FrequencyPicker from '../../components/FrequencyPicker'
import { formatDate, formatFrequency } from '../../lib/format'
import { renewableWorkflowOptions } from '../../types'
import type { Renewable, Department, FrequencyValue } from '../../types'

type RenewableForm = {
  description: string
  sale_price: string
  workflow_status: string
  notes: string
  department_id: number | null
}

type Props = {
  renewable: Renewable
  onClose: () => void
  onUpdated: () => void
  canEdit: boolean
  canDelete: boolean
}

export function RenewableDetailModal({ renewable, onClose, onUpdated, canEdit, canDelete }: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId, tenantTimezone } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details')

  const [form, setForm] = useState<RenewableForm>({
    description: renewable.description ?? '',
    sale_price: renewable.sale_price ?? '0.00',
    workflow_status: renewable.workflow_status ?? '',
    notes: renewable.notes ?? '',
    department_id: renewable.department_id ?? null,
  })

  const today = new Date().toISOString().split('T')[0]

  const [frequency, setFrequency] = useState<FrequencyValue | null>(
    renewable.frequency_type && renewable.frequency_value != null
      ? {
          type: renewable.frequency_type,
          value: renewable.frequency_value,
          startDate: renewable.frequency_start_date ?? today,
        }
      : null,
  )

  const { data: departmentsData } = useQuery<Department[]>({
    queryKey: ['departments', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const setField = <K extends keyof RenewableForm>(key: K, value: RenewableForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/renewables/${renewable.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          frequency_type: frequency?.type ?? null,
          frequency_value: frequency?.value ?? null,
          frequency_start_date: frequency?.startDate ?? null,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Renewable updated.')
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/renewables/${renewable.id}`, { method: 'DELETE', tenantScoped: true }),
    onSuccess: () => {
      showNotice('Renewable moved to recycle bin.')
      void queryClient.invalidateQueries({ queryKey: ['renewables', selectedTenantId] })
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete renewable?',
      message: 'This will move the renewable to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteMutation.mutate()
  }

  const departments = departmentsData ?? []
  const productName = renewable.renewable_product?.name ?? `Product #${renewable.renewable_product_id}`

  return (
    <Modal
      title={renewable.description ?? productName}
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
          <div>
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
          {/* Read-only product/status info */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--ui-muted)' }}>
              Product
            </label>
            <p className="text-sm text-[var(--ui-text)]">{productName}</p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--ui-muted)' }}>
              Client
            </label>
            <p className="text-sm text-[var(--ui-text)]">{renewable.client?.name ?? '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--ui-muted)' }}>
              Status
            </label>
            <Badge status={renewable.status ?? ''} />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--ui-muted)' }}>
              Next Due Date
            </label>
            <p className="text-sm text-[var(--ui-text)]">
              {renewable.next_due_date ? formatDate(renewable.next_due_date, tenantTimezone) : '—'}
            </p>
          </div>

          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            disabled={!canEdit}
            className="md:col-span-2"
            placeholder="Defaults to product name"
          />

          <CurrencyInput
            label="Sale Price"
            value={form.sale_price}
            onChange={(v) => setField('sale_price', v)}
            disabled={!canEdit}
          />

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
              Department
            </label>
            <select
              value={form.department_id ?? ''}
              onChange={(e) => setField('department_id', e.target.value ? Number(e.target.value) : null)}
              disabled={!canEdit}
              className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none disabled:opacity-60"
              style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
              Renewal Frequency
              {!canEdit && renewable.frequency_type && (
                <span className="ml-2 font-normal text-[var(--ui-muted)]">
                  ({formatFrequency(renewable.frequency_type, renewable.frequency_value)})
                </span>
              )}
            </label>
            {canEdit ? (
              <FrequencyPicker
                value={frequency}
                onChange={setFrequency}
                showStartDate
              />
            ) : (
              <p className="text-sm text-[var(--ui-muted)]">
                {formatFrequency(renewable.frequency_type, renewable.frequency_value)}
                {renewable.frequency_start_date
                  ? ` · starting ${formatDate(renewable.frequency_start_date, tenantTimezone)}`
                  : ''}
              </p>
            )}
          </div>

          <Select
            label="Workflow Status"
            value={form.workflow_status}
            onChange={(e) => setField('workflow_status', e.target.value)}
            disabled={!canEdit}
            className="md:col-span-2"
          >
            <option value="">— None —</option>
            {renewableWorkflowOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
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

      {activeTab === 'documents' && (
        <AttachmentList
          entityType="renewable"
          entityId={renewable.id}
          canEdit={canEdit}
        />
      )}
    </Modal>
  )
}
