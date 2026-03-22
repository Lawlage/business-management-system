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
import type { ClientService, Department, FrequencyValue } from '../../types'

type PriceMode = 'value' | 'margin'

type ClientServiceForm = {
  description: string
  sale_price: string
  price_override: boolean
  invoice_date: string
  workflow_status: string
  notes: string
  department_id: number | null
}

type Props = {
  clientService: ClientService
  onClose: () => void
  onUpdated: () => void
  canEdit: boolean
  canDelete: boolean
}

export function ClientServiceDetailModal({ clientService, onClose, onUpdated, canEdit, canDelete }: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId, tenantTimezone } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details')

  const [form, setForm] = useState<ClientServiceForm>({
    description: clientService.description ?? '',
    sale_price: clientService.sale_price ?? '',
    price_override: clientService.price_override ?? false,
    invoice_date: clientService.invoice_date ? clientService.invoice_date.split('T')[0] : '',
    workflow_status: clientService.workflow_status ?? '',
    notes: clientService.notes ?? '',
    department_id: clientService.department_id ?? null,
  })

  const today = new Date().toISOString().split('T')[0]

  const [frequency, setFrequency] = useState<FrequencyValue | null>(
    clientService.frequency_type && clientService.frequency_value != null
      ? {
          type: clientService.frequency_type,
          value: clientService.frequency_value,
          startDate: clientService.frequency_start_date
            ? clientService.frequency_start_date.split('T')[0]
            : today,
        }
      : null,
  )

  const [priceMode, setPriceMode] = useState<PriceMode>('value')
  const [marginPct, setMarginPct] = useState('')
  const [profitEdit, setProfitEdit] = useState<string | null>(null)

  const costNum = parseFloat(String(clientService.renewable_product?.cost_price ?? '')) || 0
  const saleNum = parseFloat(form.sale_price) || 0
  const computedProfit = (saleNum - costNum).toFixed(2)

  const recomputeMargin = (sale: string) => {
    const s = parseFloat(sale) || 0
    if (costNum > 0 && s > 0) setMarginPct(((s - costNum) / costNum * 100).toFixed(2))
  }

  const handleSalePriceChange = (v: string) => {
    setField('sale_price', v)
    recomputeMargin(v)
  }

  const handleMarginChange = (pct: string) => {
    setMarginPct(pct)
    const p = parseFloat(pct) || 0
    setField('sale_price', (costNum * (1 + p / 100)).toFixed(2))
  }

  const handleProfitBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim()
    if (val === '' || isNaN(parseFloat(val))) {
      setProfitEdit(null)
      return
    }
    setField('sale_price', (costNum + parseFloat(val)).toFixed(2))
    setPriceMode('value')
    setProfitEdit(null)
  }

  const { data: departmentsData } = useQuery<Department[]>({
    queryKey: ['departments', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const setField = <K extends keyof ClientServiceForm>(key: K, value: ClientServiceForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/client-services/${clientService.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: form.description || null,
          sale_price: form.sale_price || null,
          price_override: form.price_override,
          invoice_date: form.invoice_date || null,
          workflow_status: form.workflow_status || null,
          notes: form.notes || null,
          department_id: form.department_id,
          frequency_type: frequency?.type ?? null,
          frequency_value: frequency?.value ?? null,
          frequency_start_date: frequency?.startDate ?? null,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Client service updated.')
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/client-services/${clientService.id}`, { method: 'DELETE', tenantScoped: true }),
    onSuccess: () => {
      showNotice('Client service moved to recycle bin.')
      void queryClient.invalidateQueries({ queryKey: ['client-services', selectedTenantId] })
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete client service?',
      message: 'This will move the client service to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteMutation.mutate()
  }

  const departments = departmentsData ?? []
  const productName = clientService.renewable_product?.name ?? `Product #${clientService.renewable_product_id}`
  const productSalePrice = clientService.renewable_product?.sale_price

  return (
    <Modal
      title={clientService.description ?? productName}
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
            <p className="text-sm text-[var(--ui-text)]">{clientService.client?.name ?? '—'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--ui-muted)' }}>
              Status
            </label>
            <Badge status={clientService.status ?? ''} />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--ui-muted)' }}>
              Next Due Date
            </label>
            <p className="text-sm text-[var(--ui-text)]">
              {clientService.next_due_date ? formatDate(clientService.next_due_date, tenantTimezone) : '—'}
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

          {/* Cost price (read-only from product) */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
              Cost Price (product)
            </label>
            <p className="text-sm text-[var(--ui-text)] px-3 py-2 rounded border border-[var(--ui-border)] bg-[var(--ui-input-bg)]">
              {clientService.renewable_product?.cost_price ? `$${clientService.renewable_product.cost_price}` : '—'}
            </p>
          </div>

          {/* Invoice Date */}
          <Input
            label="Invoice Date"
            type="date"
            value={form.invoice_date}
            onChange={(e) => setField('invoice_date', e.target.value)}
            disabled={!canEdit}
          />

          {/* Pricing strip: Override/Mode toggle → Profit → Sale Price */}
          <div className="md:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-3 items-end">
            {/* Override + Mode toggle */}
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium" style={{ color: 'var(--ui-text)' }}>
                Mode
              </label>
              {canEdit && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer text-[var(--ui-muted)]">
                  <input
                    type="checkbox"
                    checked={form.price_override}
                    onChange={(e) => {
                      const override = e.target.checked
                      setField('price_override', override)
                      if (!override) {
                        setField('sale_price', productSalePrice ?? '')
                        recomputeMargin(productSalePrice ?? '')
                      }
                    }}
                    className="rounded"
                  />
                  Override price
                </label>
              )}
              {canEdit && form.price_override && (
                <div className="flex rounded overflow-hidden border border-[var(--ui-border)] text-xs h-[38px]">
                  <button
                    type="button"
                    onClick={() => setPriceMode('value')}
                    className={[
                      'px-3 py-1 transition',
                      priceMode === 'value'
                        ? 'bg-[var(--ui-button-bg)] text-[var(--ui-button-text)]'
                        : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
                    ].join(' ')}
                  >
                    Value
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceMode('margin')}
                    className={[
                      'px-3 py-1 transition',
                      priceMode === 'margin'
                        ? 'bg-[var(--ui-button-bg)] text-[var(--ui-button-text)]'
                        : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
                    ].join(' ')}
                  >
                    % Margin
                  </button>
                </div>
              )}
            </div>

            {/* Profit */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
                Profit
              </label>
              {!canEdit || !form.price_override || priceMode === 'margin' ? (
                <p className="text-sm text-[var(--ui-text)] px-3 py-2 rounded border border-[var(--ui-border)] bg-[var(--ui-input-bg)]">
                  ${computedProfit}
                </p>
              ) : profitEdit !== null ? (
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-input-bg)] px-3 py-2 text-sm text-[var(--ui-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60"
                  value={profitEdit}
                  onChange={(e) => setProfitEdit(e.target.value)}
                  onBlur={handleProfitBlur}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className="w-full rounded border border-[var(--ui-border)] bg-[var(--ui-input-bg)] px-3 py-2 text-left text-sm text-[var(--ui-text)] hover:brightness-105"
                  onClick={() => setProfitEdit(computedProfit)}
                  title="Click to set profit directly"
                >
                  ${computedProfit}
                </button>
              )}
            </div>

            {/* Sale Price */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
                Sale Price
              </label>
              {!form.price_override ? (
                <p className="text-sm text-[var(--ui-muted)] px-3 py-2 rounded border border-[var(--ui-border)] bg-[var(--ui-input-bg)]">
                  {productSalePrice ? `$${productSalePrice}` : '—'}
                  <span className="ml-1 text-xs">(from product)</span>
                </p>
              ) : !canEdit ? (
                <p className="text-sm text-[var(--ui-text)] px-3 py-2 rounded border border-[var(--ui-border)] bg-[var(--ui-input-bg)]">
                  {form.sale_price ? `$${form.sale_price}` : '—'}
                </p>
              ) : priceMode === 'value' ? (
                <CurrencyInput value={form.sale_price} onChange={handleSalePriceChange} />
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="0"
                    value={marginPct}
                    onChange={(e) => handleMarginChange(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-[var(--ui-muted)] shrink-0">% = ${form.sale_price || '0.00'}</span>
                </div>
              )}
            </div>
          </div>

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
              {!canEdit && clientService.frequency_type && (
                <span className="ml-2 font-normal text-[var(--ui-muted)]">
                  ({formatFrequency(clientService.frequency_type, clientService.frequency_value)})
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
                {formatFrequency(clientService.frequency_type, clientService.frequency_value)}
                {clientService.frequency_start_date
                  ? ` · starting ${formatDate(clientService.frequency_start_date, tenantTimezone)}`
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
          entityType="client_service"
          entityId={clientService.id}
          canEdit={canEdit}
        />
      )}
    </Modal>
  )
}
