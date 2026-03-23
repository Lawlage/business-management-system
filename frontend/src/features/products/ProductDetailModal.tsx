import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { CurrencyInput } from '../../components/CurrencyInput'
import { Select } from '../../components/Select'
import { AttachmentList } from '../../components/AttachmentList'
import FrequencyPicker from '../../components/FrequencyPicker'
import { renewableCategoryOptions } from '../../types'
import type { Product, FrequencyValue } from '../../types'

type ProductForm = {
  name: string
  category: string
  vendor: string
  cost_price: string
  sale_price: string
  notes: string
}

type PriceMode = 'value' | 'margin'

type Props = {
  product: Product
  onClose: () => void
  onUpdated: () => void
  canEdit: boolean
  canDelete: boolean
}

export function ProductDetailModal({ product, onClose, onUpdated, canEdit, canDelete }: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details')

  const [form, setForm] = useState<ProductForm>({
    name: product.name,
    category: product.category ?? 'contract',
    vendor: product.vendor ?? '',
    cost_price: product.cost_price ?? '',
    sale_price: product.sale_price ?? '',
    notes: product.notes ?? '',
  })

  const [frequency, setFrequency] = useState<FrequencyValue | null>(
    product.frequency_type && product.frequency_value != null
      ? { type: product.frequency_type, value: product.frequency_value }
      : null,
  )

  const [priceMode, setPriceMode] = useState<PriceMode>('value')
  const [marginPct, setMarginPct] = useState('')
  const [profitEdit, setProfitEdit] = useState<string | null>(null)

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const costNum = parseFloat(form.cost_price) || 0
  const saleNum = parseFloat(form.sale_price) || 0
  const computedProfit = (saleNum - costNum).toFixed(2)

  const recomputeMargin = (cost: string, sale: string) => {
    const c = parseFloat(cost) || 0
    const s = parseFloat(sale) || 0
    if (c > 0 && s > 0) setMarginPct(((s - c) / c * 100).toFixed(2))
  }

  const handleCostChange = (v: string) => {
    setField('cost_price', v)
    if (priceMode === 'margin') {
      const cost = parseFloat(v) || 0
      const pct = parseFloat(marginPct) || 0
      setField('sale_price', (cost * (1 + pct / 100)).toFixed(2))
    } else {
      recomputeMargin(v, form.sale_price)
    }
  }

  const handleSalePriceChange = (v: string) => {
    setField('sale_price', v)
    recomputeMargin(form.cost_price, v)
  }

  const handleMarginChange = (pct: string) => {
    setMarginPct(pct)
    const cost = parseFloat(form.cost_price) || 0
    const p = parseFloat(pct) || 0
    setField('sale_price', (cost * (1 + p / 100)).toFixed(2))
  }

  const handleProfitBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim()
    if (val === '' || isNaN(parseFloat(val))) {
      setProfitEdit(null)
      return
    }
    const profit = parseFloat(val)
    setField('sale_price', (costNum + profit).toFixed(2))
    setPriceMode('value')
    setProfitEdit(null)
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch<{ skipped_count?: number }>(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          cost_price: form.cost_price || null,
          sale_price: form.sale_price || null,
          frequency_type: frequency?.type ?? null,
          frequency_value: frequency?.value ?? null,
        }),
        tenantScoped: true,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['client-services', selectedTenantId] })
      onUpdated()
      onClose()
      if (res && res.skipped_count && res.skipped_count > 0) {
        showNotice(
          `Product updated. ${res.skipped_count} client service(s) with price overrides were not updated.`,
        )
      } else {
        showNotice('Product updated.')
      }
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const handleSave = async () => {
    const costChanged = form.cost_price !== (product.cost_price ?? '')
    const saleChanged = form.sale_price !== (product.sale_price ?? '')
    if (costChanged || saleChanged) {
      const ok = await confirm({
        title: 'Update product pricing?',
        message: 'Client services using this product with overridden prices will not have their sale price updated automatically.',
        confirmLabel: 'Continue',
      })
      if (!ok) return
    }
    saveMutation.mutate()
  }

  const deleteMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/products/${product.id}`, { method: 'DELETE', tenantScoped: true }),
    onSuccess: () => {
      showNotice('Product moved to recycle bin.')
      void queryClient.invalidateQueries({ queryKey: ['products', selectedTenantId] })
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete product?',
      message: 'This will move the product to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteMutation.mutate()
  }

  const handleViewClientServices = () => {
    onClose()
    navigate(`/app/client-services?product_id=${product.id}`)
  }

  return (
    <Modal
      title={product.name}
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
            <Button variant="secondary" size="sm" onClick={handleViewClientServices}>
              View in Client Services
            </Button>
            {canEdit && activeTab === 'details' && (
              <Button
                variant="primary"
                onClick={() => void handleSave()}
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
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            disabled={!canEdit}
            className="md:col-span-2"
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
            disabled={!canEdit}
          >
            {renewableCategoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <Input
            label="Vendor"
            value={form.vendor}
            onChange={(e) => setField('vendor', e.target.value)}
            disabled={!canEdit}
          />

          <CurrencyInput
            label="Cost Price"
            value={form.cost_price}
            onChange={handleCostChange}
            disabled={!canEdit}
          />

          {/* Pricing strip: Mode toggle → Profit → Sale Price */}
          <div className="md:col-span-2 grid grid-cols-[auto_1fr_1fr] gap-3 items-end">
            {/* Mode toggle */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
                Mode
              </label>
              {canEdit ? (
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
              ) : (
                <div className="h-[38px]" />
              )}
            </div>

            {/* Profit */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
                Profit
              </label>
              {!canEdit || priceMode === 'margin' ? (
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
              {!canEdit ? (
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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
              Default Duration
            </label>
            <FrequencyPicker
              value={frequency}
              onChange={setFrequency}
              disabled={!canEdit}
            />
          </div>
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
          entityType="product"
          entityId={product.id}
          canEdit={canEdit}
        />
      )}
    </Modal>
  )
}
