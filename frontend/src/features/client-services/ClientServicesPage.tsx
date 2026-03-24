import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../../hooks/useApi'
import { useDebounce } from '../../hooks/useDebounce'
import { useTenant } from '../../contexts/TenantContext'
import { formatDate } from '../../lib/format'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { StatusLegend } from '../../components/StatusLegend'
import { Input } from '../../components/Input'
import { Select } from '../../components/Select'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/SkeletonRow'
import { LoadMoreButton } from '../../components/LoadMoreButton'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { CreateClientServiceModal } from './CreateClientServiceModal'
import { ClientServiceDetailModal } from './ClientServiceDetailModal'
import type { ClientService, Product, PaginatedResponse } from '../../types'
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

function ClientServicesContent() {
  const { selectedTenantId, tenantTimezone, role } = useTenant()
  const { authedFetch } = useApi()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // filterProductId lives in the URL so it reacts to navigate() calls from other pages
  const filterProductId = searchParams.get('product_id') ?? ''
  const setFilterProductId = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (id) {
          next.set('product_id', id)
        } else {
          next.delete('product_id')
        }
        return next
      },
      { replace: true },
    )
  }

  const [page, setPage] = useState(1)
  const [allClientServices, setAllClientServices] = useState<ClientService[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedClientService, setSelectedClientService] = useState<ClientService | null>(null)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWorkflow, setFilterWorkflow] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterExpiryPreset, setFilterExpiryPreset] = useState('')

  const canCreate = role !== 'standard_user'
  const canEdit = role !== 'standard_user'
  const canDelete = role === 'tenant_admin' || role === 'global_superadmin'

  // Reset all filters when the tenant changes (not on initial load: '' → 'id')
  const [prevTenantId, setPrevTenantId] = useState<string | undefined>(undefined)
  if (selectedTenantId !== prevTenantId) {
    if (prevTenantId !== undefined) {
      setSearch('')
      setFilterStatus('')
      setFilterWorkflow('')
      setFilterClientId('')
      setFilterExpiryPreset('')
      setPage(1)
      setAllClientServices([])
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('product_id')
        return next
      }, { replace: true })
    }
    setPrevTenantId(selectedTenantId)
  }

  // Reset pagination on filter change
  const filterKey = `${debouncedSearch}|${filterStatus}|${filterWorkflow}|${filterClientId}|${filterProductId}|${filterExpiryPreset}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
    setAllClientServices([])
  }

  const hasActiveFilters = !!(debouncedSearch || filterStatus || filterWorkflow || filterClientId || filterProductId || filterExpiryPreset)

  const clearFilters = () => {
    setSearch('')
    setFilterStatus('')
    setFilterWorkflow('')
    setFilterClientId('')
    setFilterExpiryPreset('')
    setFilterProductId('')
  }

  const { data: clientList } = useQuery({
    queryKey: ['clients-all', selectedTenantId],
    queryFn: () => authedFetch<{ id: number; name: string }[]>('/api/clients?all=1', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-all', selectedTenantId],
    queryFn: () => authedFetch<PaginatedResponse<Product>>('/api/products?per_page=200', { tenantScoped: true }),
    enabled: !!selectedTenantId,
    staleTime: 30_000,
  })

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['client-services', selectedTenantId, debouncedSearch, filterStatus, filterWorkflow, filterClientId, filterProductId, filterExpiryPreset, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterStatus) params.set('status', filterStatus)
      if (filterWorkflow) params.set('workflow_status', filterWorkflow)
      if (filterClientId) params.set('client_id', filterClientId)
      if (filterProductId) params.set('renewable_product_id', filterProductId)
      if (filterExpiryPreset) params.set('expiry_preset', filterExpiryPreset)
      return authedFetch<PaginatedResponse<ClientService>>(`/api/client-services?${params.toString()}`, {
        tenantScoped: true,
      })
    },
    enabled: !!selectedTenantId,
  })

  // Accumulate paginated data
  const [prevData, setPrevData] = useState<typeof data>()
  if (data !== prevData) {
    setPrevData(data)
    if (data) {
      if (page === 1) {
        setAllClientServices(data.data)
      } else {
        setAllClientServices((prev) => [...prev, ...data.data])
      }
    }
  }

  const hasMore = data ? page < data.last_page : false

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ['client-services', selectedTenantId] })
    setPage(1)
    setAllClientServices([])
  }

  const handleUpdated = () => {
    void queryClient.invalidateQueries({ queryKey: ['client-services', selectedTenantId] })
    setPage(1)
    setAllClientServices([])
  }

  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field ? (
      sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
    ) : (
      <ChevronsUpDown size={10} className="opacity-30 group-hover:opacity-60" />
    )

  const sortedClientServices = useMemo(() => {
    if (!sortField) return allClientServices
    return [...allClientServices].sort((a, b) => {
      let aVal: string | number | null | undefined
      let bVal: string | number | null | undefined
      if (sortField === 'description') { aVal = a.description ?? a.renewable_product?.name; bVal = b.description ?? b.renewable_product?.name }
      else if (sortField === 'client') { aVal = a.client?.name; bVal = b.client?.name }
      else if (sortField === 'product') { aVal = a.renewable_product?.name; bVal = b.renewable_product?.name }
      else if (sortField === 'next_due_date') { aVal = a.next_due_date; bVal = b.next_due_date }
      else if (sortField === 'status') { aVal = a.status; bVal = b.status }
      else if (sortField === 'quantity') { aVal = a.quantity ?? 1; bVal = b.quantity ?? 1 }
      else if (sortField === 'sale_price') { aVal = a.sale_price ? parseFloat(a.sale_price) : null; bVal = b.sale_price ? parseFloat(b.sale_price) : null }
      else if (sortField === 'total') {
        aVal = a.sale_price ? (a.quantity ?? 1) * parseFloat(a.sale_price) : null
        bVal = b.sale_price ? (b.quantity ?? 1) * parseFloat(b.sale_price) : null
      }
      if (aVal == null) return sortDir === 'asc' ? 1 : -1
      if (bVal == null) return sortDir === 'asc' ? -1 : 1
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })
  }, [allClientServices, sortField, sortDir])

  const isFirstLoad = isLoading && page === 1

  return (
    <Card>
      <PageHeader
        title="Client Services"
        description="Track products applied to clients, renewal schedules, pricing, and workflow status."
        action={
          <div className="flex items-center gap-3">
            <StatusLegend statuses={['No action needed', 'Upcoming', 'Action Required', 'Urgent', 'Expired']} />
            {canCreate && (
              <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                + Apply Client Service
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-3">
        <Input
          placeholder="Search client services..."
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

        <div className="min-w-[10rem] max-w-[200px]">
          <Select label="Product" value={filterProductId} onChange={(e) => setFilterProductId(e.target.value)}>
            <option value="">All</option>
            {(productsData?.data ?? []).map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
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

      {isError && (
        <div className="mb-4 rounded-md border border-red-700 bg-red-950/60 p-3 text-sm text-red-300">
          {(error as { message?: string })?.message ?? 'Failed to load data.'}
        </div>
      )}

      {allClientServices.length > 0 && (
        <div className="sticky-list-header mb-2 hidden md:grid md:grid-cols-[2fr_1.5fr_1.5fr_1fr_1.3fr_0.5fr_0.8fr_0.8fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
          {([['description','Description'],['client','Client'],['product','Product'],['next_due_date','Next Due'],['status','Status / Workflow'],['quantity','Qty'],['sale_price','Sale Price'],['total','Total']] as const).map(([field, label]) => (
            <button key={field} onClick={() => handleSort(field)} className="inline-flex items-center gap-0.5 py-0.5 px-1.5 -mx-1.5 rounded hover:text-[var(--ui-text)] transition group">
              {label}<SortIcon field={field} />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {isFirstLoad ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
        ) : allClientServices.length === 0 ? (
          <EmptyState
            message={hasActiveFilters ? 'No client services match your filters.' : 'No client services found. Apply a product to a client to get started.'}
            action={
              canCreate && !hasActiveFilters ? (
                <Button onClick={() => setIsCreateOpen(true)} variant="primary" size="sm">
                  Apply Client Service
                </Button>
              ) : undefined
            }
          />
        ) : (
          sortedClientServices.map((r) => {
            const belowCost =
              r.sale_price != null &&
              r.renewable_product?.cost_price != null &&
              parseFloat(r.sale_price) < parseFloat(r.renewable_product.cost_price)

            return (
              <button
                key={r.id}
                className={[
                  'w-full rounded-md border p-3 text-left transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]/60',
                  belowCost
                    ? 'border-red-300 bg-red-400/20'
                    : 'app-inner-box border-[var(--ui-border)]',
                ].join(' ')}
                onClick={() => setSelectedClientService(r)}
              >
                <div className="grid gap-2 md:grid-cols-[2fr_1.5fr_1.5fr_1fr_1.3fr_0.5fr_0.8fr_0.8fr]">
                  <span className="font-medium text-sm text-[var(--ui-text)] truncate">
                    {r.description ?? r.renewable_product?.name ?? '—'}
                    {belowCost && (
                      <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400">Below Cost</span>
                    )}
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
                    {r.quantity != null && r.quantity > 1 ? r.quantity : '1'}
                  </span>
                  <span className="text-sm text-[var(--ui-muted)]">
                    {r.sale_price ? `$${r.sale_price}` : '—'}
                  </span>
                  <span className="text-sm text-[var(--ui-muted)]">
                    {r.sale_price ? `$${((r.quantity ?? 1) * parseFloat(r.sale_price)).toFixed(2)}` : '—'}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {!isFirstLoad && allClientServices.length > 0 && (
        <LoadMoreButton
          hasMore={hasMore}
          isLoading={isFetching && !isFirstLoad}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      )}

      {isCreateOpen && (
        <CreateClientServiceModal
          onClose={() => setIsCreateOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {selectedClientService && (
        <ClientServiceDetailModal
          clientService={selectedClientService}
          onClose={() => setSelectedClientService(null)}
          onUpdated={handleUpdated}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </Card>
  )
}

export function ClientServicesPage() {
  return (
    <ErrorBoundary>
      <ClientServicesContent />
    </ErrorBoundary>
  )
}
