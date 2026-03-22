import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { CurrencyInput } from '../../components/CurrencyInput'
import { Select } from '../../components/Select'
import FrequencyPicker from '../../components/FrequencyPicker'
import { useNotice } from '../../contexts/NoticeContext'
import { renewableProductDefaults, renewableCategoryOptions } from '../../types'
import type { FrequencyValue } from '../../types'

type Props = {
  onClose: () => void
  onCreated: () => void
}

type ProductForm = typeof renewableProductDefaults

type PriceMode = 'value' | 'margin'

export function CreateProductModal({ onClose, onCreated }: Props) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()

  const [form, setForm] = useState<ProductForm>({ ...renewableProductDefaults })
  const [frequency, setFrequency] = useState<FrequencyValue | null>(null)
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

  const createMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          cost_price: form.cost_price || null,
          sale_price: form.sale_price || null,
          frequency_type: frequency?.type ?? null,
          frequency_value: frequency?.value ?? null,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Product created.')
      onCreated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to create product.', 'error')
    },
  })

  return (
    <Modal
      title="Create Product"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
          >
            Create
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Name"
          required
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          className="md:col-span-2"
        />
        <Select
          label="Category"
          value={form.category}
          onChange={(e) => setField('category', e.target.value)}
        >
          {renewableCategoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
        <Input
          label="Vendor"
          value={form.vendor}
          onChange={(e) => setField('vendor', e.target.value)}
        />

        <CurrencyInput
          label="Cost Price"
          value={form.cost_price}
          onChange={handleCostChange}
        />

        {/* Pricing strip: Mode toggle → Profit → Sale Price */}
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
          />
        </div>
        <Textarea
          label="Notes"
          className="md:col-span-2"
          rows={3}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
        />
      </div>
    </Modal>
  )
}
