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
  item?: InventoryItem
  presetClientId?: number | null
  presetClientName?: string
  onClose: () => void
  onAllocated: () => void
}

export function AllocateStockModal({ item, presetClientId, presetClientName, onClose, onAllocated }: AllocateStockModalProps) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()
  const queryClient = useQueryClient()

  const [clientId, setClientId] = useState(presetClientId ? String(presetClientId) : '')
  const [departmentId, setDepartmentId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(item ?? null)
  const [itemSearch, setItemSearch] = useState('')

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () =>
      authedFetch<Client[]>('/api/clients?all=true', { tenantScoped: true }),
    enabled: !!selectedTenantId && !presetClientId,
    staleTime: 30000,
  })

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments', selectedTenantId],
    queryFn: () => authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data: inventorySearchData } = useQuery<{ data: InventoryItem[] }>({
    queryKey: ['inventory-search', selectedTenantId, itemSearch],
    queryFn: () =>
      authedFetch<{ data: InventoryItem[] }>(
        `/api/inventory?search=${encodeURIComponent(itemSearch)}&per_page=20`,
        { tenantScoped: true },
      ),
    enabled: !!selectedTenantId && !item && itemSearch.length > 0,
    staleTime: 5_000,
  })

  const inventoryResults = inventorySearchData?.data ?? []

  const availableQty = selectedItem?.quantity_on_hand ?? Infinity

  const allocateMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/stock-allocations', {
        method: 'POST',
        body: JSON.stringify({
          inventory_item_id: selectedItem!.id,
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
    if (!selectedItem) {
      showNotice('Please select an inventory item.', 'error')
      return
    }
    if (!clientId) {
      showNotice('Please select a client.', 'error')
      return
    }
    if (quantity < 1) {
      showNotice('Quantity must be at least 1.', 'error')
      return
    }
    if (quantity > availableQty) {
      showNotice(`Only ${availableQty} unit(s) available.`, 'error')
      return
    }
    allocateMutation.mutate()
  }

  const title = item ? `Allocate Stock — ${item.name}` : 'Allocate Stock'

  return (
    <Modal
      title={title}
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
        {/* Inventory item picker — only shown when no item preset */}
        {!item && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">
              Inventory Item <span className="text-red-500">*</span>
            </label>
            {selectedItem ? (
              <div className="flex items-center gap-2 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)]">
                <span className="flex-1">{selectedItem.name} <span className="text-[var(--ui-muted)]">({selectedItem.sku})</span></span>
                <button
                  type="button"
                  onClick={() => { setSelectedItem(null); setItemSearch('') }}
                  className="text-xs text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-text)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)]/60"
                />
                {inventoryResults.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)]">
                    {inventoryResults.map((inv) => (
                      <li key={inv.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--ui-border)] text-[var(--ui-text)]"
                          onClick={() => { setSelectedItem(inv); setItemSearch('') }}
                        >
                          {inv.name} <span className="text-[var(--ui-muted)]">({inv.sku})</span>
                          <span className="ml-2 text-xs text-[var(--ui-muted)]">On hand: {inv.quantity_on_hand}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Client selector */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--ui-text)]">
            Client <span className="text-red-500">*</span>
          </label>
          {presetClientId ? (
            <input
              value={presetClientName ?? String(presetClientId)}
              disabled
              className="w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm text-[var(--ui-muted)] opacity-70"
            />
          ) : (
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
          )}
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
            max={availableQty === Infinity ? undefined : availableQty}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            hint={availableQty !== Infinity ? `Available: ${availableQty}` : undefined}
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
