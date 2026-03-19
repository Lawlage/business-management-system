import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { CurrencyInput } from '../../components/CurrencyInput'
import { useNotice } from '../../contexts/NoticeContext'
import { slaItemDefaults } from '../../types'
import type { SlaGroup } from '../../types'

type Props = {
  onClose: () => void
  onCreated: () => void
}

type SlaItemForm = typeof slaItemDefaults

export function CreateSlaItemModal({ onClose, onCreated }: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()

  const { data: groupsData } = useQuery<SlaGroup[]>({
    queryKey: ['sla-groups', selectedTenantId],
    queryFn: () => authedFetch<SlaGroup[]>('/api/sla-groups', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

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
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
            SLA Group
          </label>
          <select
            value={form.sla_group_id ?? ''}
            onChange={(e) => setField('sla_group_id', e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none"
            style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
          >
            <option value="">No group</option>
            {(groupsData ?? []).map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
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
