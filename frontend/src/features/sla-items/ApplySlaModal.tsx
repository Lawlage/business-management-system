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
import { SearchCombobox } from '../../components/SearchCombobox'
import type { Client, Department, PaginatedResponse, SlaItem } from '../../types'

type Props = {
  slaItem?: SlaItem
  presetClientId?: number | null
  presetClientName?: string
  onClose: () => void
  onApplied: () => void
}

export function ApplySlaModal({ slaItem, presetClientId, presetClientName, onClose, onApplied }: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId } = useTenant()
  const { showNotice } = useNotice()

  const [clientId, setClientId] = useState<number | null>(presetClientId ?? null)
  const [departmentId, setDepartmentId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(slaItem?.sale_price ?? '0.00')
  const [notes, setNotes] = useState('')
  const [renewalDate, setRenewalDate] = useState('')
  const [selectedSlaItem, setSelectedSlaItem] = useState<SlaItem | null>(slaItem ?? null)

  const { data: clientsData } = useQuery({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () =>
      authedFetch<PaginatedResponse<Client>>('/api/clients?page=1', { tenantScoped: true }),
    enabled: !!selectedTenantId && !presetClientId,
    staleTime: 30_000,
  })

  const { data: departmentsData } = useQuery({
    queryKey: ['departments', selectedTenantId],
    queryFn: () =>
      authedFetch<Department[]>('/api/departments', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  // Fetch all SLA items upfront so the combobox can scroll + filter client-side
  const { data: allSlaItemsData, isLoading: loadingSlaItems } = useQuery({
    queryKey: ['sla-items-all', selectedTenantId],
    queryFn: () =>
      authedFetch<PaginatedResponse<SlaItem>>('/api/sla-items?per_page=200', { tenantScoped: true }),
    enabled: !!selectedTenantId && !slaItem,
    staleTime: 30_000,
  })

  const applyMutation = useMutation({
    mutationFn: () =>
      authedFetch('/api/sla-allocations', {
        method: 'POST',
        body: JSON.stringify({
          sla_item_id: selectedSlaItem!.id,
          client_id: clientId,
          department_id: departmentId || null,
          quantity,
          unit_price: unitPrice,
          notes: notes || null,
          renewal_date: renewalDate || null,
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
  const allSlaItems = allSlaItemsData?.data ?? []

  const slaOptions = allSlaItems.map((s) => ({
    id: s.id,
    label: s.name,
    sublabel: s.sku,
    _raw: s,
  }))

  const canSubmit = !!selectedSlaItem && !!clientId

  const title = slaItem ? `Apply "${slaItem.name}" to Client` : 'Apply SLA to Client'

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={() => applyMutation.mutate()}
            isLoading={applyMutation.isPending}
            disabled={!canSubmit}
          >
            Apply
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* SLA item picker — only shown when no slaItem preset */}
        {!slaItem && (
          <div className="md:col-span-2">
            <SearchCombobox
              label="SLA Item"
              required
              placeholder="Search by name or SKU…"
              options={slaOptions}
              value={selectedSlaItem ? { id: selectedSlaItem.id, label: selectedSlaItem.name, sublabel: selectedSlaItem.sku } : null}
              onChange={(opt) => {
                const raw = slaOptions.find((o) => o.id === opt.id)?._raw ?? null
                if (raw) {
                  setSelectedSlaItem(raw)
                  setUnitPrice(raw.sale_price)
                }
              }}
              onClear={() => setSelectedSlaItem(null)}
              isLoading={loadingSlaItems}
            />
          </div>
        )}

        {/* Client selector */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
            Client <span className="text-red-500 ml-0.5">*</span>
          </label>
          {presetClientId ? (
            <input
              value={presetClientName ?? String(presetClientId)}
              disabled
              className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm opacity-70"
              style={{ background: 'var(--ui-panel-bg)', color: 'var(--ui-muted)' }}
            />
          ) : (
            <select
              value={clientId ?? ''}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none"
              style={{ background: 'var(--ui-panel-bg)', color: 'var(--ui-text)' }}
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--ui-text)' }}>
            Renewal Date
          </label>
          <input
            type="date"
            value={renewalDate}
            onChange={(e) => setRenewalDate(e.target.value)}
            className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm focus:border-[var(--ui-button-bg)] focus:outline-none"
            style={{ background: 'var(--ui-panel-bg)', color: 'var(--ui-text)' }}
          />
        </div>

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
