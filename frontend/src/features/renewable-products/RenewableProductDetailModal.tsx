import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { Badge } from '../../components/Badge'
import { CurrencyInput } from '../../components/CurrencyInput'
import { Select } from '../../components/Select'
import { AttachmentList } from '../../components/AttachmentList'
import FrequencyPicker from '../../components/FrequencyPicker'
import { formatDate, formatFrequency } from '../../lib/format'
import { renewableCategoryOptions } from '../../types'
import type { RenewableProduct, Renewable, PaginatedResponse, FrequencyValue } from '../../types'
import { CreateRenewableModal } from '../renewables/CreateRenewableModal'

type ProductForm = {
  name: string
  category: string
  vendor: string
  cost_price: string
  notes: string
}

type Props = {
  product: RenewableProduct
  onClose: () => void
  onUpdated: () => void
  canEdit: boolean
  canDelete: boolean
}

export function RenewableProductDetailModal({ product, onClose, onUpdated, canEdit, canDelete }: Props) {
  const { authedFetch } = useApi()
  const { selectedTenantId, tenantTimezone } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'applied' | 'documents'>('details')
  const [isApplyOpen, setIsApplyOpen] = useState(false)

  const [form, setForm] = useState<ProductForm>({
    name: product.name,
    category: product.category ?? 'contract',
    vendor: product.vendor ?? '',
    cost_price: product.cost_price,
    notes: product.notes ?? '',
  })

  const [frequency, setFrequency] = useState<FrequencyValue | null>(
    product.frequency_type && product.frequency_value != null
      ? { type: product.frequency_type, value: product.frequency_value }
      : null,
  )

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const { data: renewablesData, refetch: refetchRenewables } = useQuery<PaginatedResponse<Renewable>>({
    queryKey: ['renewable-product-renewables', selectedTenantId, product.id],
    queryFn: () =>
      authedFetch<PaginatedResponse<Renewable>>(`/api/renewables?renewable_product_id=${product.id}`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && activeTab === 'applied',
    staleTime: 0,
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/renewable-products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          frequency_type: frequency?.type ?? null,
          frequency_value: frequency?.value ?? null,
        }),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Renewable product updated.')
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/renewable-products/${product.id}`, { method: 'DELETE', tenantScoped: true }),
    onSuccess: () => {
      showNotice('Renewable product moved to recycle bin.')
      void queryClient.invalidateQueries({ queryKey: ['renewable-products', selectedTenantId] })
      onUpdated()
      onClose()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete renewable product?',
      message: 'This will move the product to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteMutation.mutate()
  }

  const renewables = renewablesData?.data ?? []

  return (
    <>
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
              {canEdit && activeTab === 'details' && (
                <Button
                  variant="primary"
                  onClick={() => saveMutation.mutate()}
                  isLoading={saveMutation.isPending}
                >
                  Save
                </Button>
              )}
              {canEdit && activeTab === 'applied' && (
                <Button variant="primary" size="sm" onClick={() => setIsApplyOpen(true)}>
                  + Apply to client
                </Button>
              )}
            </div>
          </div>
        }
      >
        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-[var(--ui-border)]">
          {(['details', 'applied', 'documents'] as const).map((tab) => (
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
              {tab === 'applied' ? 'Applied to clients' : tab}
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
              onChange={(v) => setField('cost_price', v)}
              disabled={!canEdit}
            />
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

        {activeTab === 'applied' && (
          <div className="space-y-2">
            {renewables.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--ui-muted)]">
                Not applied to any clients yet.
              </p>
            ) : (
              renewables.map((r) => (
                <div
                  key={r.id}
                  className="app-inner-box flex items-center gap-3 rounded-md border border-[var(--ui-border)] p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ui-text)]">
                      {r.client?.name ?? '—'}
                    </p>
                    <p className="text-xs text-[var(--ui-muted)]">
                      {r.description ?? product.name}
                      {r.next_due_date ? ` · Due ${formatDate(r.next_due_date, tenantTimezone)}` : ''}
                      {r.frequency_type
                        ? ` · ${formatFrequency(r.frequency_type, r.frequency_value)}`
                        : ''}
                      {r.sale_price ? ` · $${r.sale_price}` : ''}
                    </p>
                  </div>
                  <Badge status={r.status ?? ''} />
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <AttachmentList
            entityType="renewable_product"
            entityId={product.id}
            canEdit={canEdit}
          />
        )}
      </Modal>

      {isApplyOpen && (
        <CreateRenewableModal
          initialProduct={product}
          onClose={() => setIsApplyOpen(false)}
          onCreated={() => {
            setIsApplyOpen(false)
            void refetchRenewables()
            void queryClient.invalidateQueries({ queryKey: ['renewables', selectedTenantId] })
          }}
        />
      )}
    </>
  )
}
