import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useNotice } from '../../contexts/NoticeContext'
import { slaItemDefaults } from '../../types'

type Props = {
  onClose: () => void
  onCreated: () => void
}

type SlaItemForm = typeof slaItemDefaults

export function CreateSlaItemModal({ onClose, onCreated }: Props) {
  const { authedFetch } = useApi()
  const { showNotice } = useNotice()

  const [form, setForm] = useState<SlaItemForm>({ ...slaItemDefaults })

  const setField = <K extends keyof SlaItemForm>(key: K, value: SlaItemForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const createMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/sla-items', {
        method: 'POST',
        body: JSON.stringify(form),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('SLA item created.')
      onCreated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to create SLA item.', 'error')
    },
  })

  return (
    <Modal
      title="Create SLA Item"
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
        />
        <Input
          label="SKU"
          required
          value={form.sku}
          onChange={(e) => setField('sku', e.target.value)}
        />
        <Input
          label="Tier"
          value={form.tier}
          onChange={(e) => setField('tier', e.target.value)}
          placeholder="e.g. Gold, Silver, Bronze"
        />
        <div /> {/* grid spacer */}
        <CurrencyInput
          label="Cost Price"
          value={form.cost_price}
          onChange={(v) => setField('cost_price', v)}
        />
        <CurrencyInput
          label="Sale Price"
          value={form.sale_price}
          onChange={(v) => setField('sale_price', v)}
        />
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
