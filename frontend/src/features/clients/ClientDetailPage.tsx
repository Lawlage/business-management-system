import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MoreVertical } from 'lucide-react'
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
import { CreateClientServiceModal } from '../client-services/CreateClientServiceModal'
import { ClientServiceDetailModal } from '../client-services/ClientServiceDetailModal'
import { AllocateStockModal } from '../inventory/AllocateStockModal'
import { ApplySlaModal } from '../sla-items/ApplySlaModal'
import type { Client, Renewable, StockAllocation, SlaAllocation, SlaGroup, PaginatedResponse } from '../../types'

type ClientForm = {
  name: string
  contact_name: string
  email: string
  phone: string
  website: string
  notes: string
}

type ActiveModal =
  | { type: 'create-renewable' }
  | { type: 'view-renewable'; renewable: Renewable }
  | { type: 'allocate-stock' }
  | { type: 'apply-sla' }
  | null

function ClientDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { authedFetch, getHeaders } = useApi()
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'renewals' | 'allocations' | 'documents' | 'sla-coverage'>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canDelete = role === 'tenant_admin' || role === 'global_superadmin'
  const canEdit = role !== 'standard_user'
  const canAllocate = role === 'sub_admin' || role === 'tenant_admin' || role === 'global_superadmin'

  // Fetch client
  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['client', selectedTenantId, id],
    queryFn: () => authedFetch<Client>(`/api/clients/${id ?? ''}`, { tenantScoped: true }),
    enabled: !!selectedTenantId && !!id,
  })

  const [form, setForm] = useState<ClientForm>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
  })

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

  // Client services query
  const { data: renewalsData, refetch: refetchRenewals } = useQuery<PaginatedResponse<Renewable>>({
    queryKey: ['client-renewables', selectedTenantId, id],
    queryFn: () =>
      authedFetch<PaginatedResponse<Renewable>>(`/api/client-services?client_id=${id ?? ''}&page=1`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !!id && activeTab === 'renewals',
  })

  // Stock allocations query
  const { data: stockData, isLoading: stockLoading, refetch: refetchStock } = useQuery<PaginatedResponse<StockAllocation>>({
    queryKey: ['client-stock-allocations', selectedTenantId, id],
    queryFn: () =>
      authedFetch<PaginatedResponse<StockAllocation>>(`/api/stock-allocations?client_id=${id ?? ''}`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !!id && activeTab === 'allocations',
  })

  // SLA allocations query
  const { data: slaData, isLoading: slaLoading, refetch: refetchSla } = useQuery<PaginatedResponse<SlaAllocation>>({
    queryKey: ['client-sla-allocations', selectedTenantId, id],
    queryFn: () =>
      authedFetch<PaginatedResponse<SlaAllocation>>(`/api/sla-allocations?client_id=${id ?? ''}`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !!id && activeTab === 'allocations',
  })

  // SLA coverage data
  const { data: slaGroups = [] } = useQuery<SlaGroup[]>({
    queryKey: ['sla-groups', selectedTenantId],
    queryFn: () => authedFetch<SlaGroup[]>('/api/sla-groups', { tenantScoped: true }),
    enabled: !!selectedTenantId && activeTab === 'sla-coverage',
    staleTime: 60_000,
  })

  const { data: activeSlaData } = useQuery<PaginatedResponse<SlaAllocation>>({
    queryKey: ['client-sla-active', selectedTenantId, id],
    queryFn: () =>
      authedFetch<PaginatedResponse<SlaAllocation>>(`/api/sla-allocations?client_id=${id ?? ''}&status=active&per_page=200`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !!id && activeTab === 'sla-coverage',
  })

  const activeSlaItemIds = new Set((activeSlaData?.data ?? []).map((a) => a.sla_item_id))

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
      setIsEditing(false)
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
    setMenuOpen(false)
    const confirmed = await confirm({
      title: 'Delete client?',
      message: 'This will move the client to recycle bin.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (confirmed) deleteMutation.mutate()
  }

  async function handleUpload(file: File) {
    if (!client) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('entity_type', 'client')
      formData.append('entity_id', String(client.id))

      const response = await fetch('/api/attachments', {
        method: 'POST',
        headers: getHeaders({ tenantScoped: true, isFormData: true }),
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error((err as { message?: string })?.message ?? 'Upload failed.')
      }

      showNotice('File uploaded.')
      void queryClient.invalidateQueries({ queryKey: ['attachments', selectedTenantId, 'client', client.id] })
    } catch (err) {
      showNotice((err as { message?: string })?.message ?? 'Upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      void handleUpload(file)
      e.target.value = ''
    }
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

  return (
    <>
      <Card>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/app/clients')}
              className="flex items-center gap-1.5 text-sm text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Clients
            </button>
            <span className="text-[var(--ui-muted)] shrink-0">/</span>
            <h1 className="text-lg font-semibold text-[var(--ui-text)] truncate">{client.name}</h1>
          </div>

          {/* Action menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-border)] transition"
              aria-label="Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-20 min-w-[180px] rounded-md border border-[var(--ui-border)] bg-[var(--ui-panel-bg)] shadow-lg py-1">
                  {canEdit && (
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-[var(--ui-text)] hover:bg-[var(--ui-border)] transition"
                      onClick={() => { setMenuOpen(false); setActiveTab('renewals'); setActiveModal({ type: 'create-renewable' }) }}
                    >
                      Apply Client Service
                    </button>
                  )}
                  {canAllocate && (
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-[var(--ui-text)] hover:bg-[var(--ui-border)] transition"
                      onClick={() => { setMenuOpen(false); setActiveModal({ type: 'allocate-stock' }) }}
                    >
                      Allocate Stock
                    </button>
                  )}
                  {canAllocate && (
                    <button
                      className="w-full px-4 py-2 text-left text-sm text-[var(--ui-text)] hover:bg-[var(--ui-border)] transition"
                      onClick={() => { setMenuOpen(false); setActiveModal({ type: 'apply-sla' }) }}
                    >
                      Apply SLA
                    </button>
                  )}
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-[var(--ui-text)] hover:bg-[var(--ui-border)] transition"
                    onClick={() => {
                      setMenuOpen(false)
                      setActiveTab('documents')
                      setTimeout(() => fileInputRef.current?.click(), 50)
                    }}
                  >
                    Upload Document
                  </button>
                  {canDelete && (
                    <>
                      <div className="my-1 border-t border-[var(--ui-border)]" />
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-[var(--ui-border)] transition"
                        onClick={() => void handleDelete()}
                      >
                        Delete Client
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hidden file input for upload */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-[var(--ui-border)]">
          {(['details', 'renewals', 'allocations', 'documents', 'sla-coverage'] as const).map((tab) => (
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
              {tab === 'sla-coverage' ? 'SLA Coverage' : tab === 'renewals' ? 'Products' : tab}
            </button>
          ))}
        </div>

        {/* Details tab */}
        {activeTab === 'details' && (
          <>
            {isEditing ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Name"
                    required
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                  <Input
                    label="Contact Name"
                    value={form.contact_name}
                    onChange={(e) => setField('contact_name', e.target.value)}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                  />
                  <Input
                    label="Phone"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                  />
                  <Input
                    label="Website"
                    type="url"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                  />
                  <div />
                  <Textarea
                    label="Notes"
                    className="md:col-span-2"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    isLoading={saveMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </div>
              </>
            ) : (
              <>
                <dl className="grid gap-3 md:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wide mb-0.5">Name</dt>
                    <dd className="text-[var(--ui-text)]">{client.name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wide mb-0.5">Contact</dt>
                    <dd className="text-[var(--ui-text)]">{client.contact_name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wide mb-0.5">Email</dt>
                    <dd className="text-[var(--ui-text)]">{client.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wide mb-0.5">Phone</dt>
                    <dd className="text-[var(--ui-text)]">{client.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wide mb-0.5">Website</dt>
                    <dd className="text-[var(--ui-text)]">
                      {client.website ? (
                        <a href={client.website} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--ui-accent)]">
                          {client.website}
                        </a>
                      ) : '—'}
                    </dd>
                  </div>
                  {client.notes && (
                    <div className="md:col-span-2">
                      <dt className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wide mb-0.5">Notes</dt>
                      <dd className="text-[var(--ui-text)] whitespace-pre-wrap">{client.notes}</dd>
                    </div>
                  )}
                </dl>
                {canEdit && (
                  <div className="mt-4 flex justify-end">
                    <Button variant="secondary" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Client Services tab */}
        {activeTab === 'renewals' && (
          <div className="space-y-2">
            {!renewalsData || renewalsData.data.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No client services linked to this client.</p>
            ) : (
              renewalsData.data.map((r) => (
                <button
                  key={r.id}
                  className="app-inner-box w-full flex items-center justify-between gap-3 rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105"
                  onClick={() => setActiveModal({ type: 'view-renewable', renewable: r })}
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--ui-text)]">
                      {r.description ?? r.renewable_product?.name ?? `Renewable #${r.id}`}
                    </p>
                    <p className="text-xs text-[var(--ui-muted)]">
                      {r.renewable_product?.name ?? '—'}
                      {r.next_due_date ? ` · Due ${formatDate(r.next_due_date, tenantTimezone)}` : ''}
                    </p>
                  </div>
                  <Badge status={r.status ?? ''} />
                </button>
              ))
            )}
          </div>
        )}

        {/* Allocations tab */}
        {activeTab === 'allocations' && (
          <div>
            {(stockLoading || slaLoading) ? (
              <div className="space-y-2">
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
              </div>
            ) : !hasAllocations ? (
              <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No allocations for this client.</p>
            ) : (
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
                      <p className="text-sm font-medium text-[var(--ui-text)]">
                        {a.sla_item?.name ?? '—'} <span className="text-xs font-normal text-[var(--ui-muted)]">(SLA)</span>
                      </p>
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
            )}
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && client && (
          <div className="space-y-3">
            {uploading && (
              <p className="text-sm text-[var(--ui-muted)]">Uploading...</p>
            )}
            <AttachmentList
              entityType="client"
              entityId={client.id}
              canEdit={canEdit}
              hideUpload={true}
            />
          </div>
        )}

        {/* SLA Coverage heat map tab */}
        {activeTab === 'sla-coverage' && (
          <div>
            {slaGroups.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No SLA groups defined. Add groups in Settings.</p>
            ) : (
              <div className="space-y-4">
                {slaGroups.map((group) => {
                  const items = group.sla_items ?? []
                  return (
                    <div key={group.id}>
                      <h4 className="mb-2 text-sm font-semibold text-[var(--ui-text)]">{group.name}</h4>
                      {items.length === 0 ? (
                        <p className="text-xs text-[var(--ui-muted)]">No SLA items in this group.</p>
                      ) : (
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))` }}>
                          {items.map((item) => {
                            const covered = activeSlaItemIds.has(item.id)
                            return (
                              <div
                                key={item.id}
                                className={[
                                  'rounded-md border px-3 py-2 text-sm',
                                  covered
                                    ? 'border-green-600 bg-green-950/30 text-green-400'
                                    : 'border-amber-600 bg-amber-950/20 text-amber-400',
                                ].join(' ')}
                              >
                                <span className="mr-1">{covered ? '✓' : '—'}</span>
                                {item.name}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Modals */}
      {activeModal?.type === 'create-renewable' && (
        <CreateClientServiceModal
          onClose={() => setActiveModal(null)}
          onCreated={() => { void refetchRenewals(); setActiveModal(null) }}
          presetClientId={client.id}
          presetClientName={client.name}
        />
      )}

      {activeModal?.type === 'view-renewable' && (
        <ClientServiceDetailModal
          clientService={activeModal.renewable}
          onClose={() => setActiveModal(null)}
          onUpdated={() => { void refetchRenewals() }}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeModal?.type === 'allocate-stock' && (
        <AllocateStockModal
          presetClientId={client.id}
          presetClientName={client.name}
          onClose={() => setActiveModal(null)}
          onAllocated={() => {
            void refetchStock()
            void queryClient.invalidateQueries({ queryKey: ['inventory', selectedTenantId] })
          }}
        />
      )}

      {activeModal?.type === 'apply-sla' && (
        <ApplySlaModal
          presetClientId={client.id}
          presetClientName={client.name}
          onClose={() => setActiveModal(null)}
          onApplied={() => { void refetchSla() }}
        />
      )}
    </>
  )
}

export function ClientDetailPage() {
  return (
    <ErrorBoundary>
      <ClientDetailContent />
    </ErrorBoundary>
  )
}
