import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useTenant } from '../../contexts/TenantContext'
import { formatDate, formatRenewalCategory } from '../../lib/format'
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
import { CreateRenewalModal } from './CreateRenewalModal'
import type { Renewal, PaginatedResponse } from '../../types'
import { renewalCategoryOptions, renewalWorkflowOptions } from '../../types'

type RenewalsPageProps = {
  onOpenRenewal: (renewal: Renewal) => void
}

const expiryPresets = [
  { value: '', label: 'All' },
  { value: 'next_30_days', label: 'Next 30 days' },
  { value: 'next_3_months', label: 'Next 3 months' },
  { value: 'next_6_months', label: 'Next 6 months' },
  { value: 'next_12_months', label: 'Next 12 months' },
  { value: 'custom', label: 'Custom...' },
]

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'No action needed', label: 'No action needed' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Action Required', label: 'Action Required' },
  { value: 'Urgent', label: 'Urgent' },
  { value: 'Expired', label: 'Expired' },
]

function RenewalsContent({ onOpenRenewal }: RenewalsPageProps) {
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [allRenewals, setAllRenewals] = useState<Renewal[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Search + filter state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWorkflow, setFilterWorkflow] = useState('')
  const [filterAutoRenews, setFilterAutoRenews] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterExpiryPreset, setFilterExpiryPreset] = useState('')
  const [filterExpiryMonths, setFilterExpiryMonths] = useState('')

  const canCreate = role !== 'standard_user'

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset on tenant switch
  useEffect(() => {
    setSearch('')
    setDebouncedSearch('')
    setFilterCategory('')
    setFilterStatus('')
    setFilterWorkflow('')
    setFilterAutoRenews('')
    setFilterClientId('')
    setFilterExpiryPreset('')
    setFilterExpiryMonths('')
    setPage(1)
    setAllRenewals([])
  }, [selectedTenantId])

  // Reset pagination when any filter or search changes
  useEffect(() => {
    setPage(1)
    setAllRenewals([])
  }, [debouncedSearch, filterCategory, filterStatus, filterWorkflow, filterAutoRenews, filterClientId, filterExpiryPreset, filterExpiryMonths])

  const hasActiveFilters = !!(debouncedSearch || filterCategory || filterStatus || filterWorkflow || filterAutoRenews || filterClientId || filterExpiryPreset)

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setFilterCategory('')
    setFilterStatus('')
    setFilterWorkflow('')
    setFilterAutoRenews('')
    setFilterClientId('')
    setFilterExpiryPreset('')
    setFilterExpiryMonths('')
  }

  // Fetch clients for the filter dropdown
  const { data: clientList } = useQuery({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () =>
      authedFetch<{ id: number; name: string }[]>('/api/clients?all=1', {
        tenantScoped: true,
      }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['renewals', selectedTenantId, debouncedSearch, filterCategory, filterStatus, filterWorkflow, filterAutoRenews, filterClientId, filterExpiryPreset, filterExpiryMonths, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterCategory) params.set('category', filterCategory)
      if (filterStatus) params.set('status', filterStatus)
      if (filterWorkflow) params.set('workflow_status', filterWorkflow)
      if (filterAutoRenews) params.set('auto_renews', filterAutoRenews)
      if (filterClientId) params.set('client_id', filterClientId)
      if (filterExpiryPreset) {
        params.set('expiry_preset', filterExpiryPreset)
        if (filterExpiryPreset === 'custom' && filterExpiryMonths) {
          params.set('expiry_months', filterExpiryMonths)
        }
      }
      return authedFetch<PaginatedResponse<Renewal>>(`/api/renewals?${params.toString()}`, {
        tenantScoped: true,
      })
    },
    enabled: !!selectedTenantId,
    staleTime: 0,
  })

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllRenewals(data.data)
    } else {
      setAllRenewals((prev) => [...prev, ...data.data])
    }
  }, [data, page])

  const hasMore = data ? page < data.last_page : false

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['renewals', selectedTenantId] })
    setPage(1)
    setAllRenewals([])
  }

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="Renewals"
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              + Create Renewal
            </Button>
          ) : undefined
        }
      />

      {/* Search bar */}
      <div className="mb-3">
        <Input
          placeholder="Search renewals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter controls */}
      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <div className="w-36">
          <Select label="Type" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All</option>
            {renewalCategoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        <div className="w-36">
          <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        <div className="w-44">
          <Select label="Workflow" value={filterWorkflow} onChange={(e) => setFilterWorkflow(e.target.value)}>
            <option value="">All</option>
            {renewalWorkflowOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </div>

        <div className="w-28">
          <Select label="Auto-Renews" value={filterAutoRenews} onChange={(e) => setFilterAutoRenews(e.target.value)}>
            <option value="">All</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </Select>
        </div>

        <div className="w-40">
          <Select label="Client" value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)}>
            <option value="">All</option>
            {clientList?.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </Select>
        </div>

        <div className="w-40">
          <Select label="Expiry" value={filterExpiryPreset} onChange={(e) => setFilterExpiryPreset(e.target.value)}>
            {expiryPresets.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        {filterExpiryPreset === 'custom' && (
          <div className="w-28">
            <Input
              label="Months"
              type="number"
              min={1}
              max={60}
              value={filterExpiryMonths}
              onChange={(e) => setFilterExpiryMonths(e.target.value)}
              placeholder="e.g. 6"
            />
          </div>
        )}

        {hasActiveFilters && (
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table header -- hidden on mobile */}
      {allRenewals.length > 0 && (
        <div className="mb-2 hidden md:grid md:grid-cols-[2fr_1.5fr_1.3fr_1.2fr_0.8fr_1fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          <span>Title</span>
          <span>Client</span>
          <span>Type / Status</span>
          <span>Workflow</span>
          <span>Auto</span>
          <span>Expires</span>
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
        ) : allRenewals.length === 0 ? (
          <EmptyState
            message={hasActiveFilters ? 'No renewals match your filters.' : 'No renewals found. Create your first renewal to get started.'}
            action={
              canCreate && !hasActiveFilters ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  Create Renewal
                </Button>
              ) : undefined
            }
          />
        ) : (
          allRenewals.map((renewal) => (
            <button
              key={renewal.id}
              className="app-inner-box w-full rounded-md border border-[var(--ui-border)] p-3 text-left transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60"
              onClick={() => onOpenRenewal(renewal)}
            >
              <div className="grid gap-2 md:grid-cols-[2fr_1.5fr_1.3fr_1.2fr_0.8fr_1fr]">
                <span className="font-medium text-sm text-[var(--ui-text)] truncate">{renewal.title}</span>

                <span className="text-sm text-[var(--ui-muted)] truncate">
                  {renewal.client?.name ?? '—'}
                </span>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--ui-muted)]">
                    {formatRenewalCategory(renewal.category)}
                  </span>
                  <Badge status={renewal.status} />
                </div>

                <span className="text-sm text-[var(--ui-muted)] truncate">
                  {renewal.workflow_status ?? '—'}
                </span>

                <span className="text-sm text-[var(--ui-muted)]">
                  {renewal.auto_renews ? 'Yes' : 'No'}
                </span>

                <span className="text-sm text-[var(--ui-muted)]">
                  {formatDate(renewal.expiration_date, tenantTimezone)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {!isFirstLoad && allRenewals.length > 0 && (
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isFetching && !isFirstLoad}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      )}

      {isCreateOpen && (
        <CreateRenewalModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </Card>
  )
}

export function RenewalsPage({ onOpenRenewal }: RenewalsPageProps) {
  return (
    <ErrorBoundary>
      <RenewalsContent onOpenRenewal={onOpenRenewal} />
    </ErrorBoundary>
  )
}
