import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { CurrencyInput } from '../../components/CurrencyInput'
import { Select } from '../../components/Select'
import { SearchCombobox } from '../../components/SearchCombobox'
import FrequencyPicker from '../../components/FrequencyPicker'
import { useNotice } from '../../contexts/NoticeContext'
import { renewableWorkflowOptions } from '../../types'
import type { Client, Department, PaginatedResponse, Product, FrequencyValue } from '../../types'

type PriceMode = 'value' | 'margin'

type Props = {
  initialProduct?: Product
  presetClientId?: number | null
  presetClientName?: string
  onClose: () => void
  onCreated: () => void
}

export function CreateClientServiceModal({
  initialProduct,
  presetClientId,
  presetClientName,
  onClose,
  onCreated,
}: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialProduct ?? null)
  const [description, setDescription] = useState(initialProduct?.name ?? '')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientId, setClientId] = useState<number | null>(presetClientId ?? null)
  const [departmentId, setDepartmentId] = useState<number | null>(initialProduct?.department_id ?? null)
  const [salePrice, setSalePrice] = useState(initialProduct?.sale_price ?? '')
  const [priceOverride, setPriceOverride] = useState(false)
  const [priceMode, setPriceMode] = useState<PriceMode>('value')
  const [marginPct, setMarginPct] = useState('')
  const [profitEdit, setProfitEdit] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [invoiceDate, setInvoiceDate] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState('')
  const [notes, setNotes] = useState('')
  const today = new Date().toISOString().split('T')[0]

  const [serviceType, setServiceType] = useState<'recurring' | 'one_off'>('recurring')

  const [frequency, setFrequency] = useState<FrequencyValue | null>(
    initialProduct?.frequency_type && initialProduct?.frequency_value != null
      ? { type: initialProduct.frequency_type, value: initialProduct.frequency_value, startDate: today }
      : null,
  )

  const costNum = parseFloat(String(selectedProduct?.cost_price ?? '')) || 0
  const saleNum = parseFloat(salePrice) || 0
  const computedProfit = (saleNum - costNum).toFixed(2)

  const recomputeMargin = (cost: string, sale: string) => {
    const c = parseFloat(cost) || 0
    const s = parseFloat(sale) || 0
    if (c > 0 && s > 0) setMarginPct(((s - c) / c * 100).toFixed(2))
  }

  const handleSalePriceChange = (v: string) => {
    setSalePrice(v)
    recomputeMargin(String(selectedProduct?.cost_price ?? ''), v)
    if (selectedProduct && v !== (selectedProduct.sale_price ?? '')) {
      setPriceOverride(true)
    } else {
      setPriceOverride(false)
    }
  }

  const handleMarginChange = (pct: string) => {
    setMarginPct(pct)
    const p = parseFloat(pct) || 0
    const newSale = (costNum * (1 + p / 100)).toFixed(2)
    setSalePrice(newSale)
    if (selectedProduct && newSale !== (selectedProduct.sale_price ?? '')) {
      setPriceOverride(true)
    } else {
      setPriceOverride(false)
    }
  }

  const handleProfitBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim()
    if (val === '' || isNaN(parseFloat(val))) {
      setProfitEdit(null)
      return
    }
    const newSale = (costNum + parseFloat(val)).toFixed(2)
    setSalePrice(newSale)
    setPriceMode('value')
    setPriceOverride(selectedProduct ? newSale !== (selectedProduct.sale_price ?? '') : true)
    setProfitEdit(null)
  }

  // Load all products for combobox (only if no initialProduct)
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['products-all', selectedTenantId],
    queryFn: () =>
      authedFetch<PaginatedResponse<Product>>('/api/products?per_page=200', {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !initialProduct,
    staleTime: 30_000,
  })

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () =>
      authedFetch<Client[]>('/api/clients?all=true', { tenantScoped: true }),
    enabled: !!selectedTenantId && !presetClientId,
    staleTime: 30_000,
  })

  const { data: departmentsData } = useQuery({
    queryKey: ['departments', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const productOptions = (productsData?.data ?? []).map((p) => ({
    id: p.id,
    label: p.name,
    sublabel: p.category ?? undefined,
    _raw: p,
  }))

  const clientOptions = (clientsData ?? []).map((c) => ({
    id: c.id,
    label: c.name,
    _raw: c,
  }))
  const departments = departmentsData ?? []

  function handleProductSelect(p: Product) {
    setSelectedProduct(p)
    if (!description) setDescription(p.name)
    const newSale = p.sale_price ?? ''
    setSalePrice(newSale)
    setPriceOverride(false)
    recomputeMargin(String(p.cost_price ?? ''), newSale)
    if (p.frequency_type && p.frequency_value != null) {
      setFrequency({ type: p.frequency_type, value: p.frequency_value, startDate: today })
    } else {
      setFrequency(null)
    }
    if (p.department_id) {
      setDepartmentId(p.department_id)
    }
  }

  const createMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/client-services', {
        method: 'POST',
        body: JSON.stringify({
          renewable_product_id: selectedProduct!.id,
          description: description || null,
          client_id: clientId,
          department_id: departmentId || null,
          sale_price: salePrice || null,
          quantity,
          price_override: priceOverride,
          invoice_date: invoiceDate || null,
          workflow_status: workflowStatus || null,
          service_type: serviceType,
          notes: notes || null,
          frequency_type: serviceType === 'recurring' ? (frequency?.type ?? null) : null,
          frequency_value: serviceType === 'recurring' ? (frequency?.value ?? null) : null,
          frequency_start_date: serviceType === 'recurring' ? (frequency?.startDate ?? null) : null,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Client service created.')
      onCreated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to create client service.', 'error')
    },
  })

  const canSubmit = !!selectedProduct && !!clientId

  return (
    <Modal
      title="Create Client Service"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
            disabled={!canSubmit}
          >
            Create
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* Service type selector */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
            Service Type
          </label>
          <div className="flex rounded overflow-hidden border border-[var(--ui-border)] text-sm w-fit">
            {(['recurring', 'one_off'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setServiceType(type)}
                className={[
                  'px-4 py-1.5 transition',
                  serviceType === type
                    ? 'bg-[var(--ui-button-bg)] text-[var(--ui-button-text)]'
                    : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
                ].join(' ')}
              >
                {type === 'one_off' ? 'One-off' : 'Recurring'}
              </button>
            ))}
          </div>
        </div>

        {/* Product picker */}
        {!initialProduct ? (
          <div className="md:col-span-2">
            <SearchCombobox
              label="Product"
              required
              placeholder="Search products..."
              options={productOptions}
              value={
                selectedProduct
                  ? { id: selectedProduct.id, label: selectedProduct.name, sublabel: selectedProduct.category ?? undefined }
                  : null
              }
              onChange={(opt) => {
                const raw = productOptions.find((o) => o.id === opt.id)?._raw
                if (raw) handleProductSelect(raw)
              }}
              onClear={() => setSelectedProduct(null)}
              isLoading={loadingProducts}
            />
          </div>
        ) : (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
              Product
            </label>
            <input
              value={initialProduct.name}
              disabled
              className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm opacity-70"
              style={{ background: 'var(--ui-panel-bg)', color: 'var(--ui-muted)' }}
            />
          </div>
        )}

        {/* Cost price read-only (from product) */}
        {selectedProduct && (
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
              Cost Price (product)
            </label>
            <input
              value={selectedProduct.cost_price ? `$${selectedProduct.cost_price}` : '—'}
              disabled
              className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm opacity-70"
              style={{ background: 'var(--ui-panel-bg)', color: 'var(--ui-muted)' }}
            />
          </div>
        )}

        {/* Invoice Date (aligned with cost price row) */}
        <Input
          label="Invoice Date"
          type="date"
          value={invoiceDate}
          onChange={(e) => setInvoiceDate(e.target.value)}
        />

        {/* Pricing strip: Mode toggle → Profit → Sale Price */}
        {selectedProduct && (
          <div className="md:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-3 items-end">
            {/* Mode toggle */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
                Mode
              </label>
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
            </div>

            {/* Profit */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
                Profit
              </label>
              {priceMode === 'margin' ? (
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
                  onFocus={(e) => e.target.select()}
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
              {priceMode === 'value' ? (
                <CurrencyInput value={salePrice} onChange={handleSalePriceChange} />
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="0"
                    value={marginPct}
                    onChange={(e) => handleMarginChange(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-[var(--ui-muted)] shrink-0">% = ${salePrice || '0.00'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quantity + Total */}
        <div>
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={String(quantity)}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
            Total
          </label>
          <p className="text-sm text-[var(--ui-text)] px-3 py-2 rounded border border-[var(--ui-border)] bg-[var(--ui-input-bg)]">
            {salePrice ? `$${(quantity * parseFloat(salePrice)).toFixed(2)}` : '—'}
          </p>
        </div>

        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="md:col-span-2"
          placeholder="Defaults to product name"
        />

        {/* Client */}
        <div className="md:col-span-2">
          {presetClientId ? (
            <>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
                Client
              </label>
              <input
                value={presetClientName ?? String(presetClientId)}
                disabled
                className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm opacity-70"
                style={{ background: 'var(--ui-panel-bg)', color: 'var(--ui-muted)' }}
              />
            </>
          ) : (
            <SearchCombobox
              label="Client"
              required
              placeholder="Search clients..."
              options={clientOptions}
              value={selectedClient ? { id: selectedClient.id, label: selectedClient.name } : null}
              onChange={(opt) => {
                const raw = clientOptions.find((o) => o.id === opt.id)?._raw
                if (raw) {
                  setSelectedClient(raw)
                  setClientId(raw.id)
                }
              }}
              onClear={() => { setSelectedClient(null); setClientId(null) }}
              isLoading={loadingClients}
            />
          )}
        </div>

        {departments.length > 0 && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
              Department
            </label>
            <select
              value={departmentId ?? ''}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none"
              style={{ background: 'var(--ui-panel-bg)', color: 'var(--ui-text)' }}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {serviceType === 'recurring' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
              Renewal Schedule
            </label>
            <FrequencyPicker
              value={frequency}
              onChange={setFrequency}
              showStartDate
            />
          </div>
        )}

        <Select
          label="Workflow Status"
          value={workflowStatus}
          onChange={(e) => setWorkflowStatus(e.target.value)}
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
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  )
}
