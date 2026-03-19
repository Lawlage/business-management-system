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

export function CreateRenewableProductModal({ onClose, onCreated }: Props) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()

  const [form, setForm] = useState<ProductForm>({ ...renewableProductDefaults })
  const [frequency, setFrequency] = useState<FrequencyValue | null>(null)

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const createMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/renewable-products', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          frequency_type: frequency?.type ?? null,
          frequency_value: frequency?.value ?? null,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Renewable product created.')
      onCreated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to create renewable product.', 'error')
    },
  })

  return (
    <Modal
      title="Create Renewable Product"
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
          onChange={(v) => setField('cost_price', v)}
        />
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
