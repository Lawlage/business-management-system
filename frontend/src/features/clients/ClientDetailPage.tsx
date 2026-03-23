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
import { Select } from '../../components/Select'
import { Textarea } from '../../components/Textarea'
import { Badge } from '../../components/Badge'
import { SkeletonRow } from '../../components/SkeletonRow'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { AttachmentList } from '../../components/AttachmentList'
import { formatDate } from '../../lib/format'
import { CreateClientServiceModal } from '../client-services/CreateClientServiceModal'
import { ClientServiceDetailModal } from '../client-services/ClientServiceDetailModal'
import { AllocateStockModal } from '../inventory/AllocateStockModal'
import type { AccountManager, Client, Renewable, StockAllocation, PaginatedResponse } from '../../types'

type ClientForm = {
  name: string
  contact_name: string
  email: string
  phone: string
  website: string
  notes: string
  account_manager_id: number | null
}

type ActiveModal =
  | { type: 'create-renewable' }
  | { type: 'view-renewable'; renewable: Renewable }
  | { type: 'allocate-stock' }
  | null

function ClientDetailContent() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { authedFetch, getHeaders } = useApi()
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { showNotice } = useNotice()
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'details' | 'services' | 'stock' | 'documents'>(() => {
    const saved = sessionStorage.getItem('clientDetailTab')
    if (saved === 'services' || saved === 'stock' || saved === 'documents') return saved
    return 'details'
  })
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    sessionStorage.setItem('clientDetailTab', tab)
  }
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

  const { data: accountManagers = [] } = useQuery<AccountManager[]>({
    queryKey: ['account-managers', selectedTenantId],
    queryFn: () => authedFetch<AccountManager[]>('/api/account-managers', { tenantScoped: true }),
    enabled: !!selectedTenantId && isEditing,
    staleTime: 60_000,
  })

  const [form, setForm] = useState<ClientForm>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    account_manager_id: null,
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
      account_manager_id: client.account_manager_id ?? null,
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
    enabled: !!selectedTenantId && !!id && activeTab === 'services',
  })

  // Stock allocations query
  const { data: stockData, isLoading: stockLoading, refetch: refetchStock } = useQuery<PaginatedResponse<StockAllocation>>({
    queryKey: ['client-stock-allocations', selectedTenantId, id],
    queryFn: () =>
      authedFetch<PaginatedResponse<StockAllocation>>(`/api/stock-allocations?client_id=${id ?? ''}`, {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId && !!id && activeTab === 'stock',
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
                      onClick={() => { setMenuOpen(false); handleTabChange('services'); setActiveModal({ type: 'create-renewable' }) }}
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
                  <button
                    className="w-full px-4 py-2 text-left text-sm text-[var(--ui-text)] hover:bg-[var(--ui-border)] transition"
                    onClick={() => {
                      setMenuOpen(false)
                      handleTabChange('documents')
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
          {(['details', 'services', 'stock', 'documents'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={[
                'px-4 py-2 text-sm font-medium capitalize transition',
                activeTab === tab
                  ? 'border-b-2 border-[var(--ui-button-bg)] text-[var(--ui-button-bg)]'
                  : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]',
              ].join(' ')}
            >
              {tab === 'services' ? 'Services' : tab === 'stock' ? 'Stock' : tab}
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
                  <Select
                    label="Account Manager"
                    value={form.account_manager_id ?? ''}
                    onChange={(e) =>
                      setField('account_manager_id', e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">None</option>
                    {accountManagers.map((am) => (
                      <option key={am.id} value={am.id}>
                        {am.name}
                      </option>
                    ))}
                  </Select>
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
                    <dd className="text-[var(--ui-text)]">
                      {client.email ? (
                        <a href={`mailto:${client.email}`} className="underline hover:text-[var(--ui-accent)]">
                          {client.email}
                        </a>
                      ) : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wide mb-0.5">Phone</dt>
                    <dd className="text-[var(--ui-text)]">
                      {client.phone ? (
                        <a href={`tel:${client.phone}`} className="underline hover:text-[var(--ui-accent)]">
                          {client.phone}
                        </a>
                      ) : '—'}
                    </dd>
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
                  <div>
                    <dt className="text-[var(--ui-muted)] text-xs font-medium uppercase tracking-wide mb-0.5">Account Manager</dt>
                    <dd className="text-[var(--ui-text)]">
                      {client.account_manager
                        ? `${client.account_manager.first_name} ${client.account_manager.last_name}`
                        : '—'}
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

        {/* Services tab */}
        {activeTab === 'services' && (
          <div className="space-y-2">
            {canEdit && (
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => setActiveModal({ type: 'create-renewable' })}>
                  + Add Service
                </Button>
              </div>
            )}
            {!renewalsData || renewalsData.data.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No client services linked to this client.</p>
            ) : (
              renewalsData.data.map((r) => (
                <button
                  key={r.id}
                  className="app-inner-box w-full flex items-center justify-between gap-3 rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105"
                  onClick={() => setActiveModal({ type: 'view-renewable', renewable: r })}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--ui-text)]">
                      {r.description ?? r.renewable_product?.name ?? `Service #${r.id}`}
                    </p>
                    <p className="text-xs text-[var(--ui-muted)]">
                      {r.renewable_product?.name ?? '—'}
                      {r.next_due_date ? ` · Due ${formatDate(r.next_due_date, tenantTimezone)}` : ''}
                      {r.service_type === 'one_off' ? ' · One-off' : ''}
                      {(r.quantity ?? 1) > 1 ? ` · Qty: ${r.quantity}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r.sale_price && (
                      <span className="text-sm text-[var(--ui-muted)]">
                        ${((r.quantity ?? 1) * parseFloat(r.sale_price)).toFixed(2)}
                      </span>
                    )}
                    <Badge status={r.status ?? ''} />
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Stock tab */}
        {activeTab === 'stock' && (
          <div>
            {stockLoading ? (
              <div className="space-y-2">
                <SkeletonRow cols={4} />
                <SkeletonRow cols={4} />
              </div>
            ) : stockAllocations.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--ui-muted)]">No stock allocations for this client.</p>
            ) : (
              <div className="space-y-2">
                {stockAllocations.map((a) => (
                  <div key={a.id} className="app-inner-box flex items-center gap-3 rounded-md border border-[var(--ui-border)] p-3">
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
              </div>
            )}
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && client && (
          <div className="space-y-3">
            {canEdit && (
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Upload Document
                </Button>
              </div>
            )}
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
