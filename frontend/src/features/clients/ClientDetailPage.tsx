import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { useNotice } from '../../contexts/NoticeContext'
import { useConfirm } from '../../contexts/ConfirmContext'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { Textarea } from '../../components/Textarea'
import { Badge } from '../../components/Badge'
import { SkeletonRow } from '../../components/SkeletonRow'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { AttachmentList } from '../../components/AttachmentList'
import { formatDate } from '../../lib/format'
import type { Client, Renewal, StockAllocation, SlaAllocation, PaginatedResponse } from '../../types'

type ClientForm = {
  name: string
  contact_name: string
  email: string
  phone: string
  website: string
  notes: string
}

type AllocationView = 'by_client' | 'by_item'

// Groups stock and SLA allocations by item name for the "By Item" view
type AllocationGroup = {
  key: string
  label: string
  sku: string
  type: 'stock' | 'sla'
  stockAllocations: StockAllocation[]
  slaAllocations: SlaAllocation[]
}

function buildAllocationGroups(
  stockAllocations: StockAllocation[],
  slaAllocations: SlaAllocation[],
): AllocationGroup[] {
  const map = new Map<string, AllocationGroup>()

  for (const a of stockAllocations) {
    const key = `stock-${a.inventory_item_id}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: a.inventory_item?.name ?? `Item #${a.inventory_item_id}`,
        sku: a.inventory_item?.sku ?? '',
        type: 'stock',
        stockAllocations: [],
        slaAllocations: [],
      })
    }
    map.get(key)!.stockAllocations.push(a)
  }

  for (const a of slaAllocations) {
    const key = `sla-${a.sla_item_id}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: a.sla_item?.name ?? `SLA #${a.sla_item_id}`,
        sku: a.sla_item?.sku ?? '',
        type: 'sla',
        stockAllocations: [],
        slaAllocations: [],
      })
    }
    map.get(key)!.slaAllocations.push(a)
  }

  return Array.from(map.values())
}

function AllocationGroupRow({
  group,
  tenantTimezone,
  canAllocate,
  onCancelStock,
  onCancelSla,
  isCancellingStock,
  isCancellingSla,
}: {
  group: AllocationGroup
  tenantTimezone: string
  canAllocate: boolean
  onCancelStock: (id: number) => void
  onCancelSla: (id: number) => void
  isCancellingStock: boolean
  isCancellingSla: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const totalQty =
    group.stockAllocations.reduce((s, a) => s + a.quantity, 0) +
    group.slaAllocations.reduce((s, a) => s + a.quantity, 0)

  const activeCount =
    group.stockAllocations.filter((a) => a.status === 'allocated').length +
    group.slaAllocations.filter((a) => a.status === 'active').length

  return (
    <div className="rounded-md border border-[var(--ui-border)] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="app-inner-box w-full flex items-center gap-3 p-3 text-left hover:brightness-105 transition"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--ui-muted)] shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--ui-muted)] shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--ui-text)] truncate">{group.label}</p>
          <p className="text-xs text-[var(--ui-muted)]">
            {group.sku} · {group.type === 'sla' ? 'SLA' : 'Inventory'} · Total qty: {totalQty}
            {activeCount > 0 && ` · ${activeCount} active`}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--ui-border)] divide-y divide-[var(--ui-border)]">
          {group.stockAllocations.map((a) => (
            <div key={`s-${a.id}`} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--ui-muted)]">
                  Qty: {a.quantity}
                  {a.unit_price ? ` · $${a.unit_price} ea · Total: $${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : ''}
                  {a.department ? ` · ${a.department.name}` : ''}
                  {' · '}{formatDate(a.created_at, tenantTimezone)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge status={a.status} />
                {a.status === 'allocated' && canAllocate && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onCancelStock(a.id)}
                    isLoading={isCancellingStock}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
          {group.slaAllocations.map((a) => (
            <div key={`a-${a.id}`} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--ui-muted)]">
                  Qty: {a.quantity}
                  {a.unit_price ? ` · $${a.unit_price} ea · Total: $${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : ''}
                  {a.department ? ` · ${a.department.name}` : ''}
                  {' · '}{formatDate(a.created_at, tenantTimezone)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge status={a.status} />
                {a.status === 'active' && canAllocate && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onCancelSla(a.id)}
                    isLoading={isCancellingSla}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClientDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { authedFetch } = useApi()
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'renewals' | 'allocations' | 'documents'>('details')
  const [allocationView, setAllocationView] = useState<AllocationView>('by_client')

  const canDelete = role === 'tenant_admin' || role === 'global_superadmin'
  const canEdit = role !== 'standard_user'
  const canAllocate = role === 'sub_admin' || role === 'tenant_admin' || role === 'global_superadmin'

  // Fetch client
  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['client', selectedTenantId, id],
    queryFn: () => authedFetch<Client>(`/api/clients/${id ?? ''}`, { tenantScoped: true }),
    enabled: !!selectedTenantId && !!id,
    staleTime: 0,
  })

  const [form, setForm] = useState<ClientForm>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
  })

  // Sync form when client loads
  const [formInitialized, setFormInitialized] = useState(false)
  if (client && !formInitialized) {
    setForm({
      name: client.name ?? '',
      contact_name: client.contact_name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      website: client.website ?? '',
      notes: client.notes ?? '',
    })
    setFormInitialized(true)
  }

  const setField = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Renewals query
  const { data: renewalsData } = useQuery<PaginatedResponse<Renewal>>({
    queryKey: ['client-renewals', selectedTenantId, id],
    queryFn: () =>
      authedFetch<PaginatedResponse<Renewal>>(`/api/renewals?client_id=${id ?? ''}&page=1`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !!id && activeTab === 'renewals',
    staleTime: 0,
  })

  // Stock allocations query
  const { data: stockData, refetch: refetchStock } = useQuery<PaginatedResponse<StockAllocation>>({
    queryKey: ['client-stock-allocations', selectedTenantId, id],
    queryFn: () =>
      authedFetch<PaginatedResponse<StockAllocation>>(`/api/stock-allocations?client_id=${id ?? ''}`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !!id && activeTab === 'allocations',
    staleTime: 0,
  })

  // SLA allocations query
  const { data: slaData, refetch: refetchSla } = useQuery<PaginatedResponse<SlaAllocation>>({
    queryKey: ['client-sla-allocations', selectedTenantId, id],
    queryFn: () =>
      authedFetch<PaginatedResponse<SlaAllocation>>(`/api/sla-allocations?client_id=${id ?? ''}`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !!id && activeTab === 'allocations',
    staleTime: 0,
  })

  const cancelStockMutation = useMutation({
    mutationFn: (allocationId: number) =>
      authedFetch(`/api/stock-allocations/${allocationId}/cancel`, {
        method: 'POST',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Allocation cancelled.')
      void refetchStock()
      void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Cancel failed.', 'error')
    },
  })

  const cancelSlaMutation = useMutation({
    mutationFn: (allocationId: number) =>
      authedFetch(`/api/sla-allocations/${allocationId}/cancel`, {
        method: 'POST',
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('SLA allocation cancelled.')
      void refetchSla()
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Cancel failed.', 'error')
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: ClientForm) =>
      authedFetch(`/api/clients/${id ?? ''}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        tenantScoped: true,
      }),
    onSuccess: () => {
      showNotice('Client updated.')
      void queryClient.invalidateQueries({ queryKey: ['clients', selectedTenantId] })
      void queryClient.invalidateQueries({ queryKey: ['client', selectedTenantId, id] })
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      authedFetch(`/api/clients/${id ?? ''}`, { method: 'DELETE', tenantScoped: true }),
    onSuccess: () => {
      showNotice('Client moved to recycle bin.')
      void queryClient.invalidateQueries({ queryKey: ['clients', selectedTenantId] })
      navigate('/app/clients')
    },
    onError: (err: unknown) => {
      showNotice((err as { message?: string })?.message ?? 'Request failed', 'error')
    },
  })

  const handleSave = () => {
    const submitted = { ...form }
    if (submitted.website && !/^https?:\/\//i.test(submitted.website)) {
      submitted.website = `https://${submitted.website}`
    }
    saveMutation.mutate(submitted)
  }

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete client?',
      message: 'This will move the client to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteMutation.mutate()
  }

  if (clientLoading) {
    return (
      <Card>
        <div className="space-y-2">
          <SkeletonRow cols={4} />
          <SkeletonRow cols={4} />
          <SkeletonRow cols={4} />
        </div>
      </Card>
    )
  }

  if (!client) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-[var(--ui-muted)]">Client not found.</p>
      </Card>
    )
  }

  const stockAllocations = stockData?.data ?? []
  const slaAllocations = slaData?.data ?? []
  const hasAllocations = stockAllocations.length > 0 || slaAllocations.length > 0
  const allocationGroups = buildAllocationGroups(stockAllocations, slaAllocations)

  return (
    <Card>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/app/clients')}
          className="flex items-center gap-1.5 text-sm text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Clients
        </button>
        <span className="text-[var(--ui-muted)]">/</span>
        <h1 className="text-lg font-semibold text-[var(--ui-text)] truncate">{client.name}</h1>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-[var(--ui-border)]">
        {(['details', 'renewals', 'allocations', 'documents'] as const).map((tab) => (
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
            {tab}
          </button>
        ))}
      </div>

      {/* Details tab */}
      {activeTab === 'details' && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              disabled={!canEdit}
            />
            <Input
              label="Contact Name"
              value={form.contact_name}
              onChange={(e) => setField('contact_name', e.target.value)}
              disabled={!canEdit}
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              disabled={!canEdit}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              disabled={!canEdit}
            />
            <Input
              label="Website"
              type="url"
              value={form.website}
              onChange={(e) => setField('website', e.target.value)}
              disabled={!canEdit}
            />
            <div /> {/* grid spacer */}
            <Textarea
              label="Notes"
              className="md:col-span-2"
              rows={3}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              {canDelete && (
                <Button
                  variant="danger"
                  onClick={() => void handleDelete()}
                  isLoading={deleteMutation.isPending}
                >
                  Delete
                </Button>
              )}
            </div>
            {canEdit && (
              <Button
                variant="primary"
                onClick={handleSave}
                isLoading={saveMutation.isPending}
              >
                Save Client
              </Button>
            )}
          </div>
        </>
      )}

      {/* Renewals tab */}
      {activeTab === 'renewals' && (
        <div className="space-y-2">
          {!renewalsData || renewalsData.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No renewals linked to this client.</p>
          ) : (
            renewalsData.data.map((r) => (
              <div
                key={r.id}
                className="app-inner-box flex items-center justify-between gap-3 rounded-md border border-[var(--ui-border)] p-3"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--ui-text)]">{r.title}</p>
                  <p className="text-xs text-[var(--ui-muted)]">
                    {r.category} · Expires {formatDate(r.expiration_date)}
                  </p>
                </div>
                <Badge status={r.status} />
              </div>
            ))
          )}
        </div>
      )}

      {/* Allocations tab */}
      {activeTab === 'allocations' && (
        <div>
          {/* Toggle */}
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setAllocationView('by_client')}
              className={[
                'px-3 py-1.5 rounded text-sm font-medium transition',
                allocationView === 'by_client'
                  ? 'bg-[var(--ui-button-bg)] text-[var(--ui-button-text)]'
                  : 'border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
              ].join(' ')}
            >
              By Client
            </button>
            <button
              onClick={() => setAllocationView('by_item')}
              className={[
                'px-3 py-1.5 rounded text-sm font-medium transition',
                allocationView === 'by_item'
                  ? 'bg-[var(--ui-button-bg)] text-[var(--ui-button-text)]'
                  : 'border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
              ].join(' ')}
            >
              By Item
            </button>
          </div>

          {!hasAllocations ? (
            <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No allocations for this client.</p>
          ) : allocationView === 'by_client' ? (
            // Flat chronological view
            <div className="space-y-2">
              {stockAllocations.map((a) => (
                <div key={`s-${a.id}`} className="app-inner-box flex items-center gap-3 rounded-md border border-[var(--ui-border)] p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ui-text)]">{a.inventory_item?.name ?? '—'}</p>
                    <p className="text-xs text-[var(--ui-muted)]">
                      {a.inventory_item?.sku} · Qty: {a.quantity}
                      {a.unit_price ? ` · $${a.unit_price} ea · Total: $${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : ''}
                      {a.department ? ` · ${a.department.name}` : ''}
                      {' · '}{formatDate(a.created_at, tenantTimezone)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={a.status} />
                    {a.status === 'allocated' && canAllocate && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => cancelStockMutation.mutate(a.id)}
                        isLoading={cancelStockMutation.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {slaAllocations.map((a) => (
                <div key={`a-${a.id}`} className="app-inner-box flex items-center gap-3 rounded-md border border-[var(--ui-border)] p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ui-text)]">{a.sla_item?.name ?? '—'} <span className="text-xs font-normal text-[var(--ui-muted)]">(SLA)</span></p>
                    <p className="text-xs text-[var(--ui-muted)]">
                      {a.sla_item?.sku} · Qty: {a.quantity}
                      {a.unit_price ? ` · $${a.unit_price} ea · Total: $${(a.quantity * parseFloat(a.unit_price)).toFixed(2)}` : ''}
                      {a.department ? ` · ${a.department.name}` : ''}
                      {' · '}{formatDate(a.created_at, tenantTimezone)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={a.status} />
                    {a.status === 'active' && canAllocate && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => cancelSlaMutation.mutate(a.id)}
                        isLoading={cancelSlaMutation.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // By Item accordion view
            <div className="space-y-2">
              {allocationGroups.map((group) => (
                <AllocationGroupRow
                  key={group.key}
                  group={group}
                  tenantTimezone={tenantTimezone}
                  canAllocate={canAllocate}
                  onCancelStock={(allocationId) => cancelStockMutation.mutate(allocationId)}
                  onCancelSla={(allocationId) => cancelSlaMutation.mutate(allocationId)}
                  isCancellingStock={cancelStockMutation.isPending}
                  isCancellingSla={cancelSlaMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && client && (
        <AttachmentList
          entityType="client"
          entityId={client.id}
          canEdit={canEdit}
        />
      )}
    </Card>
  )
}

export function ClientDetailPage() {
  return (
    <ErrorBoundary>
      <ClientDetailContent />
    </ErrorBoundary>
  )
}
