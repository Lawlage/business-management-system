import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { CurrencyInput } from '../../components/CurrencyInput'
import { NumberInput } from '../../components/NumberInput'
import { Textarea } from '../../components/Textarea'
import type { Client, Department, PaginatedResponse, SlaItem } from '../../types'

type Props = {
  slaItem: SlaItem
  onClose: () => void
  onApplied: () => void
}

export function ApplySlaModal({ slaItem, onClose, onApplied }: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()

  const [clientId, setClientId] = useState<number | null>(null)
  const [departmentId, setDepartmentId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(slaItem.sale_price)
  const [notes, setNotes] = useState('')

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () =>
      authedFetch<PaginatedResponse<Client>>('/api/clients?page=1', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data: departmentsData } = useQuery({
    queryKey: ['departments', selectedTenantId],
    queryFn: () =>
      authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const applyMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/sla-allocations', {
        method: 'POST',
        body: JSON.stringify({
          sla_item_id: slaItem.id,
          client_id: clientId,
          department_id: departmentId || null,
          quantity,
          unit_price: unitPrice,
          notes: notes || null,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('SLA item applied.')
      onApplied()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Failed to apply SLA item.', 'error')
    },
  })

  const clients = clientsData?.data ?? []
  const departments = departmentsData ?? []

  return (
    <Modal
      title={`Apply "${slaItem.name}" to Client`}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => applyMutation.mutate()}
            isLoading={applyMutation.isPending}
            disabled={!clientId}
          >
            Apply
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
            Client <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            value={clientId ?? ''}
            onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none"
            style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
          >
            <option value="">Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
              style={{ background: 'var(--ui-bg)', color: 'var(--ui-text)' }}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        <NumberInput
          label="Quantity"
          value={quantity}
          onChange={setQuantity}
          min={1}
        />

        <CurrencyInput
          label="Unit Price"
          value={unitPrice}
          onChange={setUnitPrice}
        />

        <Textarea
          label="Notes"
          className="md:col-span-2"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  )
}
