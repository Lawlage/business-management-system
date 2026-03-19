import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { formatDate } from '../../lib/format'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { CreateRenewableModal } from './CreateRenewableModal'
import { RenewableDetailModal } from './RenewableDetailModal'
import type { Renewable, PaginatedResponse } from '../../types'
import { renewableWorkflowOptions } from '../../types'

const expiryPresets = [
  { value: '', label: 'All' },
  { value: 'next_30_days', label: 'Next 30 days' },
  { value: 'next_3_months', label: 'Next 3 months' },
  { value: 'next_6_months', label: 'Next 6 months' },
  { value: 'next_12_months', label: 'Next 12 months' },
]

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'No action needed', label: 'No action needed' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Action Required', label: 'Action Required' },
  { value: 'Urgent', label: 'Urgent' },
  { value: 'Expired', label: 'Expired' },
]

function RenewablesContent() {
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allRenewables, setAllRenewables] = useState<Renewable[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedRenewable, setSelectedRenewable] = useState<Renewable | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWorkflow, setFilterWorkflow] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterExpiryPreset, setFilterExpiryPreset] = useState('')

  const canCreate = role !== 'standard_user'
  const canEdit = role !== 'standard_user'
  const canDelete = role === 'tenant_admin' || role === 'global_superadmin'

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setSearch('')
    setDebouncedSearch('')
    setFilterStatus('')
    setFilterWorkflow('')
    setFilterClientId('')
    setFilterExpiryPreset('')
    setPage(1)
    setAllRenewables([])
  }, [selectedTenantId])

  useEffect(() => {
    setPage(1)
    setAllRenewables([])
  }, [debouncedSearch, filterStatus, filterWorkflow, filterClientId, filterExpiryPreset])

  const hasActiveFilters = !!(debouncedSearch || filterStatus || filterWorkflow || filterClientId || filterExpiryPreset)

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setFilterStatus('')
    setFilterWorkflow('')
    setFilterClientId('')
    setFilterExpiryPreset('')
  }

  const { data: clientList } = useQuery({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () => authedFetch<{ id: number; name: string }[]>('/api/clients?all=1', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['renewables', selectedTenantId, debouncedSearch, filterStatus, filterWorkflow, filterClientId, filterExpiryPreset, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterStatus) params.set('status', filterStatus)
      if (filterWorkflow) params.set('workflow_status', filterWorkflow)
      if (filterClientId) params.set('client_id', filterClientId)
      if (filterExpiryPreset) params.set('expiry_preset', filterExpiryPreset)
      return authedFetch<PaginatedResponse<Renewable>>(`/api/renewables?${params.toString()}`, {
        tenantScoped: true,
      })
    },
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllRenewables(data.data)
    } else {
      setAllRenewables((prev) => [...prev, ...data.data])
    }
  }, [data, page])

  const hasMore = data ? page < data.last_page : false

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['renewables', selectedTenantId] })
    setPage(1)
    setAllRenewables([])
  }

  const handleUpdated = () => {
    void queryClient.invalidateQueries({ queryKey: ['renewables', selectedTenantId] })
    setPage(1)
    setAllRenewables([])
  }

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="Renewables"
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + Apply Renewable
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3">
        <Input
          placeholder="Search renewables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <div className="min-w-[9rem]">
          <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        <div className="min-w-[11rem]">
          <Select label="Workflow" value={filterWorkflow} onChange={(e) => setFilterWorkflow(e.target.value)}>
            <option value="">All</option>
            {renewableWorkflowOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </div>

        <div className="min-w-[8rem] max-w-[180px]">
          <Select label="Client" value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)}>
            <option value="">All</option>
            {clientList?.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </Select>
        </div>

        <div className="min-w-[9rem]">
          <Select label="Expiry" value={filterExpiryPreset} onChange={(e) => setFilterExpiryPreset(e.target.value)}>
            {expiryPresets.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          Clear filters
        </Button>
      </div>

      {allRenewables.length > 0 && (
        <div className="mb-2 hidden md:grid md:grid-cols-[2fr_1.5fr_1.5fr_1fr_1.3fr_1fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          <span>Description</span>
          <span>Client</span>
          <span>Product</span>
          <span>Next Due</span>
          <span>Status / Workflow</span>
          <span>Sale Price</span>
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
        ) : allRenewables.length === 0 ? (
          <EmptyState
            message={hasActiveFilters ? 'No renewables match your filters.' : 'No renewables found. Apply a renewable product to a client to get started.'}
            action={
              canCreate && !hasActiveFilters ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  Apply Renewable
                </Button>
              ) : undefined
            }
          />
        ) : (
          allRenewables.map((r) => (
            <button
              key={r.id}
              className="app-inner-box w-full rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
              onClick={() => setSelectedRenewable(r)}
            >
              <div className="grid gap-2 md:grid-cols-[2fr_1.5fr_1.5fr_1fr_1.3fr_1fr]">
                <span className="font-medium text-sm text-[var(--ui-text)] truncate">
                  {r.description ?? r.renewable_product?.name ?? '—'}
                </span>
                <span className="text-sm text-[var(--ui-muted)] truncate">
                  {r.client?.name ?? '—'}
                </span>
                <span className="text-sm text-[var(--ui-muted)] truncate">
                  {r.renewable_product?.name ?? '—'}
                </span>
                <span className="text-sm text-[var(--ui-muted)]">
                  {r.next_due_date ? formatDate(r.next_due_date, tenantTimezone) : '—'}
                </span>
                <div className="flex flex-col gap-1">
                  <Badge status={r.status ?? ''} />
                  {r.workflow_status && (
                    <span className="text-xs text-[var(--ui-muted)] truncate">{r.workflow_status}</span>
                  )}
                </div>
                <span className="text-sm text-[var(--ui-muted)]">
                  {r.sale_price ? `$${r.sale_price}` : '—'}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {!isFirstLoad && allRenewables.length > 0 && (
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isFetching && !isFirstLoad}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      )}

      {isCreateOpen && (
        <CreateRenewableModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedRenewable && (
        <RenewableDetailModal
          renewable={selectedRenewable}
          onClose={() => setSelectedRenewable(null)}
          onUpdated={handleUpdated}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </Card>
  )
}

export function RenewablesPage() {
  return (
    <ErrorBoundary>
      <RenewablesContent />
    </ErrorBoundary>
  )
}
