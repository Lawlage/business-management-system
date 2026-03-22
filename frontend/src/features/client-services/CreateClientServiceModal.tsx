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
  const [departmentId, setDepartmentId] = useState<number | null>(null)
  const [salePrice, setSalePrice] = useState('')
  const [workflowStatus, setWorkflowStatus] = useState('')
  const [notes, setNotes] = useState('')
  const today = new Date().toISOString().split('T')[0]

  const [frequency, setFrequency] = useState<FrequencyValue | null>(
    initialProduct?.frequency_type && initialProduct?.frequency_value != null
      ? { type: initialProduct.frequency_type, value: initialProduct.frequency_value, startDate: today }
      : null,
  )

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
    if (p.frequency_type && p.frequency_value != null) {
      setFrequency({ type: p.frequency_type, value: p.frequency_value, startDate: today })
    } else {
      setFrequency(null)
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
          sale_price: salePrice,
          workflow_status: workflowStatus || null,
          notes: notes || null,
          frequency_type: frequency?.type ?? null,
          frequency_value: frequency?.value ?? null,
          frequency_start_date: frequency?.startDate ?? null,
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

  const canSubmit = !!selectedProduct && !!clientId && !!frequency && !!salePrice

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
              value={`$${selectedProduct.cost_price}`}
              disabled
              className="w-full px-3 py-2 rounded border border-[var(--ui-border)] text-sm opacity-70"
              style={{ background: 'var(--ui-panel-bg)', color: 'var(--ui-muted)' }}
            />
          </div>
        )}

        <CurrencyInput
          label="Sale Price"
          required
          value={salePrice}
          onChange={setSalePrice}
        />

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

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--ui-text)' }}>
            Renewal Frequency <span className="ml-0.5 text-red-400">*</span>
          </label>
          <FrequencyPicker
            value={frequency}
            onChange={setFrequency}
            showStartDate
          />
        </div>

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
