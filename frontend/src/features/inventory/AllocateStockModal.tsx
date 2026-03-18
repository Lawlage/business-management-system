import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import type { Client, Department, InventoryItem } from '../../types'

type AllocateStockModalProps = {
  item: InventoryItem
  onClose: () => void
  onAllocated: () => void
}

export function AllocateStockModal({ item, onClose, onAllocated }: AllocateStockModalProps) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const queryClient = useQueryClient()

  const [clientId, setClientId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () =>
      authedFetch<Client[]>('/api/clients?all=true', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30000,
  })

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const allocateMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/stock-allocations', {
        method: 'POST',
        body: JSON.stringify({
          inventory_item_id: item.id,
          client_id: Number(clientId),
          department_id: departmentId ? Number(departmentId) : null,
          quantity,
          unit_price: unitPrice !== '' ? Number(unitPrice) : null,
          notes: notes || null,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Stock allocated successfully.')
      void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['stock-allocations', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard', selectedTenantId] })
      onAllocated()
      onClose()
    },
    onError: (error: unknown) => {
      showNotice(
        (error as { message?: string })?.message ?? 'Allocation failed.',
        'error',
      )
    },
  })

  const handleSubmit = () => {
    if (!clientId) {
      showNotice('Please select a client.', 'error')
      return
    }
    if (quantity < 1) {
      showNotice('Quantity must be at least 1.', 'error')
      return
    }
    if (quantity > item.quantity_on_hand) {
      showNotice(`Only ${item.quantity_on_hand} unit(s) available.`, 'error')
      return
    }
    allocateMutation.mutate()
  }

  return (
    <Modal
      title={`Allocate Stock — ${item.name}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={allocateMutation.isPending}
          >
            Allocate
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">
            Client <span className="text-red-500">*</span>
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60"
          >
            <option value="">— Select client —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {departments.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60"
            >
              <option value="">— No department —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Quantity"
            type="number"
            min={1}
            max={item.quantity_on_hand}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            hint={`Available: ${item.quantity_on_hand}`}
          />

          <Input
            label="Unit Price ($)"
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            hint="Optional"
          />
        </div>

        <Textarea
          label="Notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  )
}
